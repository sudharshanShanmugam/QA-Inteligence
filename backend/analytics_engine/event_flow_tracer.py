"""
Event Flow Tracer – Brain 2, Component 9

Traces end-to-end flow: UI → API → DB → Event → Consumer → Notification.
Builds a validation checklist for each layer.
"""

from typing import Any, Dict, List, Optional
from dataclasses import dataclass


@dataclass
class FlowStep:
    layer: str
    component: str
    action: str
    data: Optional[str]
    validation_point: str


class EventFlowTracer:
    LAYERS = ["UI", "API", "DB", "Event", "Consumer", "Notification"]

    def trace(
        self,
        feature_name: str,
        apis: List[Dict[str, Any]],
        events: List[Dict[str, Any]],
        db_tables: List[Dict[str, Any]],
        modules: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Build an end-to-end flow trace for a feature."""
        steps: List[Dict[str, Any]] = []
        step_num = 1

        # ── UI Layer ──────────────────────────────────────────────────────────
        steps.append(self._step(
            step_num, "UI",
            component=f"{feature_name} Screen/Component",
            action="User triggers action (form submit / button click)",
            data="User input payload",
            validation_point=(
                "Validate: client-side form validation fires; "
                "loading state shown; inputs sanitised before send"
            ),
        ))
        step_num += 1

        # ── API Layer ─────────────────────────────────────────────────────────
        if apis:
            for api in apis[:3]:  # Show top 3 APIs
                steps.append(self._step(
                    step_num, "API",
                    component=f"{api.get('method', 'POST')} {api.get('endpoint', api.get('name', 'API'))}",
                    action="HTTP request received; auth validated; request parsed",
                    data="Validated request body / query params",
                    validation_point=(
                        "Validate: auth token present & not expired; "
                        "request body schema valid; rate-limit not exceeded; "
                        "business rule enforcement"
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "API",
                component=f"{feature_name} REST API",
                action="HTTP request received and validated",
                data="Request payload",
                validation_point="Validate: auth, schema, rate limit, idempotency key (if applicable)",
            ))
            step_num += 1

        # ── DB Layer ──────────────────────────────────────────────────────────
        if db_tables:
            for tbl in db_tables[:3]:
                steps.append(self._step(
                    step_num, "DB",
                    component=f"Table: {tbl.get('name', 'database')}",
                    action="Read/Write operation executed within transaction",
                    data=f"Schema: {tbl.get('schema_def', 'see DB schema')}",
                    validation_point=(
                        "Validate: record created/updated correctly; "
                        "constraints enforced (FK, unique, not-null); "
                        "transaction rolled back on error"
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "DB",
                component="Database (persistence layer)",
                action="Data persisted / retrieved",
                data="Entity state change",
                validation_point="Validate: ACID properties; constraint violations return correct errors",
            ))
            step_num += 1

        # ── Event Layer ───────────────────────────────────────────────────────
        if events:
            for ev in events[:3]:
                steps.append(self._step(
                    step_num, "Event",
                    component=f"Topic: {ev.get('topic', ev.get('name', 'event'))}",
                    action=f"Event published: {ev.get('name', 'domain_event')}",
                    data=f"Payload schema: {ev.get('payload_schema', 'see event definition')}",
                    validation_point=(
                        "Validate: event published exactly once (idempotency); "
                        "payload matches schema; correct partition key; "
                        "correct headers / metadata"
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "Event",
                component="Message Broker (Kafka / RabbitMQ / SQS)",
                action="Domain event published after successful DB write",
                data="Event payload with correlation ID",
                validation_point=(
                    "Validate: event published post-commit (outbox pattern); "
                    "no events on rollback; dead-letter queue handling"
                ),
            ))
            step_num += 1

        # ── Consumer Layer ────────────────────────────────────────────────────
        consumer_modules = [m for m in modules if "consumer" in m.get("name", "").lower()
                            or "subscriber" in m.get("name", "").lower()
                            or "worker" in m.get("name", "").lower()]
        if consumer_modules:
            for cm in consumer_modules[:2]:
                steps.append(self._step(
                    step_num, "Consumer",
                    component=cm.get("name", "consumer"),
                    action="Event consumed; business logic applied",
                    data="Processed event payload",
                    validation_point=(
                        "Validate: at-least-once processing handled; "
                        "idempotency checks; error → dead-letter; "
                        "consumer lag monitored"
                    ),
                ))
                step_num += 1
        else:
            steps.append(self._step(
                step_num, "Consumer",
                component="Event Consumer / Worker Service",
                action="Event consumed; downstream processing triggered",
                data="Processed payload",
                validation_point=(
                    "Validate: idempotent consumption; "
                    "failure handling (retry/DLQ); order guarantee (if required)"
                ),
            ))
            step_num += 1

        # ── Notification Layer ────────────────────────────────────────────────
        steps.append(self._step(
            step_num, "Notification",
            component="Notification Service (email / push / SMS / webhook)",
            action="End-user notified of outcome",
            data="Notification content with action result",
            validation_point=(
                "Validate: notification sent to correct recipient; "
                "correct template used; no duplicate notifications; "
                "PII not leaked in notification body"
            ),
        ))

        return steps

    def generate_flow_test_cases(self, flow_steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate test cases for each flow step's validation point."""
        test_cases = []
        for step in flow_steps:
            test_cases.append({
                "id": f"FLOW-{step['step']:03d}-{step['layer']}",
                "type": "event_flow",
                "scenario_type": "functional",
                "title": f"[{step['layer']}] {step['action']}",
                "description": step["validation_point"],
                "component": step["component"],
                "steps": [
                    f"Set up: {step['data'] or 'N/A'}",
                    f"Action: {step['action']}",
                    f"Assert: {step['validation_point']}",
                ],
                "expected_result": step["validation_point"],
                "risk_level": "high" if step["layer"] in ("API", "Event", "DB") else "medium",
            })
        return test_cases

    @staticmethod
    def _step(num: int, layer: str, component: str, action: str,
              data: Optional[str], validation_point: str) -> Dict[str, Any]:
        return {
            "step": num,
            "layer": layer,
            "component": component,
            "action": action,
            "data": data,
            "validation_point": validation_point,
        }


event_flow_tracer = EventFlowTracer()
