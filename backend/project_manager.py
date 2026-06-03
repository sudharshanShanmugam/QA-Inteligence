"""Project registry — stores project metadata in a JSON file."""
import json, uuid, threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

class ProjectManager:
    def __init__(self):
        from config import settings
        base = Path(settings.DATA_DIR) if settings.DATA_DIR else Path("./backend/data")
        self._path = base / "projects.json"
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._projects: Dict[str, dict] = self._load()

    def _load(self) -> dict:
        if self._path.exists():
            try:
                return json.loads(self._path.read_text())
            except Exception:
                return {}
        return {}

    def _save(self):
        self._path.write_text(json.dumps(self._projects, indent=2))

    def create(self, name: str, description: str = "") -> dict:
        with self._lock:
            pid = str(uuid.uuid4())[:8]
            project = {
                "id": pid,
                "name": name,
                "description": description,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            self._projects[pid] = project
            self._save()
            return project

    def list_all(self) -> List[dict]:
        with self._lock:
            return sorted(self._projects.values(), key=lambda p: p["created_at"], reverse=True)

    def get(self, pid: str) -> Optional[dict]:
        with self._lock:
            return self._projects.get(pid)

    def delete(self, pid: str) -> bool:
        with self._lock:
            if pid not in self._projects:
                return False
            del self._projects[pid]
            self._save()
            return True

project_manager = ProjectManager()
