"""
Dual-adapter graph client.

Tries Neo4j first (if USE_NEO4J=true); falls back to NetworkX automatically.
Both adapters expose an identical interface so the rest of the system is unaware
of which backend is in use.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

import networkx as nx
import structlog

from config import settings

log = structlog.get_logger()


# ─── Abstract Interface ──────────────────────────────────────────────────────


class GraphAdapter(ABC):
    @abstractmethod
    def upsert_node(self, label: str, node_id: str, properties: Dict[str, Any]) -> str: ...

    @abstractmethod
    def upsert_relationship(self, from_id: str, to_id: str, rel_type: str,
                             properties: Dict[str, Any] | None = None) -> None: ...

    @abstractmethod
    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]: ...

    @abstractmethod
    def find_nodes(self, label: str, filters: Dict[str, Any] | None = None) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def get_neighbors(self, node_id: str, rel_type: str | None = None,
                      direction: str = "both") -> List[Dict[str, Any]]: ...

    @abstractmethod
    def get_all_nodes(self) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def get_all_relationships(self) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def shortest_path(self, from_id: str, to_id: str) -> List[str]: ...

    @abstractmethod
    def close(self) -> None: ...


# ─── NetworkX Adapter ────────────────────────────────────────────────────────


class NetworkXAdapter(GraphAdapter):
    """In-process in-memory graph. No disk persistence."""

    def __init__(self):
        self._g: nx.MultiDiGraph = nx.MultiDiGraph()
        log.info("graph_initialised_in_memory")

    # ── write ────────────────────────────────────────────────────────────────

    def upsert_node(self, label: str, node_id: str, properties: Dict[str, Any]) -> str:
        props = {**properties, "label": label, "id": node_id}
        if self._g.has_node(node_id):
            self._g.nodes[node_id].update(props)
        else:
            self._g.add_node(node_id, **props)
        return node_id

    def upsert_relationship(self, from_id: str, to_id: str, rel_type: str,
                             properties: Dict[str, Any] | None = None) -> None:
        props = properties or {}
        self._g.add_edge(from_id, to_id, rel_type=rel_type, **props)

    # ── read ─────────────────────────────────────────────────────────────────

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        if self._g.has_node(node_id):
            return dict(self._g.nodes[node_id])
        return None

    def find_nodes(self, label: str, filters: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        results = []
        for nid, data in self._g.nodes(data=True):
            if data.get("label") != label:
                continue
            if filters:
                match = all(data.get(k) == v for k, v in filters.items())
                if not match:
                    continue
            results.append({"id": nid, **data})
        return results

    def get_neighbors(self, node_id: str, rel_type: str | None = None,
                      direction: str = "both") -> List[Dict[str, Any]]:
        neighbors = []
        if direction in ("out", "both"):
            for _, nbr, data in self._g.out_edges(node_id, data=True):
                if rel_type and data.get("rel_type") != rel_type:
                    continue
                nbr_data = dict(self._g.nodes.get(nbr, {}))
                neighbors.append({"id": nbr, "rel_type": data.get("rel_type"), **nbr_data})
        if direction in ("in", "both"):
            for src, _, data in self._g.in_edges(node_id, data=True):
                if rel_type and data.get("rel_type") != rel_type:
                    continue
                src_data = dict(self._g.nodes.get(src, {}))
                neighbors.append({"id": src, "rel_type": data.get("rel_type"), **src_data})
        return neighbors

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        return [{"id": nid, **data} for nid, data in self._g.nodes(data=True)]

    def get_all_relationships(self) -> List[Dict[str, Any]]:
        rels = []
        for u, v, data in self._g.edges(data=True):
            rels.append({"from": u, "to": v, **data})
        return rels

    def shortest_path(self, from_id: str, to_id: str) -> List[str]:
        try:
            return nx.shortest_path(self._g, from_id, to_id)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def close(self) -> None:
        pass


# ─── Neo4j Adapter ───────────────────────────────────────────────────────────


class Neo4jAdapter(GraphAdapter):
    """Neo4j adapter – requires a running Neo4j instance."""

    def __init__(self):
        from neo4j import GraphDatabase
        self._driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        log.info("neo4j_connected", uri=settings.NEO4J_URI)

    def _run(self, cypher: str, **params) -> List[Dict[str, Any]]:
        with self._driver.session() as session:
            result = session.run(cypher, **params)
            return [dict(r) for r in result]

    def upsert_node(self, label: str, node_id: str, properties: Dict[str, Any]) -> str:
        props = {**properties, "id": node_id}
        cypher = f"MERGE (n:{label} {{id: $id}}) SET n += $props RETURN n.id AS id"
        self._run(cypher, id=node_id, props=props)
        return node_id

    def upsert_relationship(self, from_id: str, to_id: str, rel_type: str,
                             properties: Dict[str, Any] | None = None) -> None:
        props = properties or {}
        cypher = (
            f"MATCH (a {{id: $from_id}}), (b {{id: $to_id}}) "
            f"MERGE (a)-[r:{rel_type}]->(b) SET r += $props"
        )
        self._run(cypher, from_id=from_id, to_id=to_id, props=props)

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        rows = self._run("MATCH (n {id: $id}) RETURN properties(n) AS props", id=node_id)
        return rows[0]["props"] if rows else None

    def find_nodes(self, label: str, filters: Dict[str, Any] | None = None) -> List[Dict[str, Any]]:
        where = ""
        if filters:
            conditions = " AND ".join(f"n.{k} = ${k}" for k in filters)
            where = f"WHERE {conditions}"
        cypher = f"MATCH (n:{label}) {where} RETURN properties(n) AS props"
        rows = self._run(cypher, **(filters or {}))
        return [r["props"] for r in rows]

    def get_neighbors(self, node_id: str, rel_type: str | None = None,
                      direction: str = "both") -> List[Dict[str, Any]]:
        rel = f":{rel_type}" if rel_type else ""
        if direction == "out":
            pattern = f"(a {{id: $id}})-[r{rel}]->(b)"
        elif direction == "in":
            pattern = f"(a {{id: $id}})<-[r{rel}]-(b)"
        else:
            pattern = f"(a {{id: $id}})-[r{rel}]-(b)"
        cypher = f"MATCH {pattern} RETURN properties(b) AS props, type(r) AS rel_type"
        rows = self._run(cypher, id=node_id)
        return [{"rel_type": r["rel_type"], **r["props"]} for r in rows]

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        rows = self._run("MATCH (n) RETURN properties(n) AS props")
        return [r["props"] for r in rows]

    def get_all_relationships(self) -> List[Dict[str, Any]]:
        rows = self._run("MATCH (a)-[r]->(b) RETURN a.id AS from, type(r) AS rel_type, b.id AS to")
        return rows

    def shortest_path(self, from_id: str, to_id: str) -> List[str]:
        cypher = (
            "MATCH p=shortestPath((a {id: $from_id})-[*]-(b {id: $to_id})) "
            "RETURN [n IN nodes(p) | n.id] AS path"
        )
        rows = self._run(cypher, from_id=from_id, to_id=to_id)
        return rows[0]["path"] if rows else []

    def close(self) -> None:
        self._driver.close()


# ─── Factory ─────────────────────────────────────────────────────────────────


def create_graph_adapter() -> GraphAdapter:
    if settings.USE_NEO4J:
        try:
            adapter = Neo4jAdapter()
            return adapter
        except Exception as e:
            log.warning("neo4j_unavailable_falling_back", error=str(e))
    return NetworkXAdapter()


# Singleton
_graph: GraphAdapter | None = None


def get_graph() -> GraphAdapter:
    global _graph
    if _graph is None:
        _graph = create_graph_adapter()
    return _graph
