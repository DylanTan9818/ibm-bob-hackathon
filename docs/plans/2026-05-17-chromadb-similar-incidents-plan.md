# 🧠 ChromaDB Similar Incident Lookup — Implementation Plan

> Hey Bob! This plan wires up ChromaDB so both the **Triage Agent** and **Runbook Agent** can find similar past incidents instead of returning an empty list every time. After this, the demo moment is: triage the same CPU spike twice — the second time the agent says *"I've seen this before: rolled back v2.3.1, resolved in 18 minutes."* That's institutional memory live on stage. 🎯

---

## 📋 What We're Building

Right now, both agents have a `_find_similar_incidents()` method that always returns `[]`. ChromaDB is already installed (`chromadb==0.4.22` in `requirements.txt`) — we just need to wire it up.

**The plan in one picture:**

```
Triage Agent  ──┐
                ├──► IncidentStore (ChromaDB) ──► find similar ──► return top 3 past incidents
Runbook Agent ──┘
                         ▲
                         │  store_incident() / store_runbook()
                         │  (called after each resolution)
                   seed_demo_data()
                   (5 pre-loaded incidents so demo works on first run)
```

---

## 📁 Files We'll Touch

| Action | File | What changes |
|---|---|---|
| ➕ Create | `backend/app/core/incident_store.py` | ChromaDB wrapper — store + find for incidents and runbooks |
| ➕ Create | `backend/app/core/seed_demo_data.py` | Pre-loads 5 realistic incidents so demo works immediately |
| ✏️ Modify | `backend/app/agents/triage_agent.py` | Replace empty `_find_similar_incidents()` + wire `update_incident_history()` |
| ✏️ Modify | `backend/app/agents/runbook_agent.py` | Replace empty `_find_similar_incidents()` + wire `save_runbook()` |
| ✏️ Modify | `backend/app/main.py` | Call `seed_demo_data()` on startup |
| ➕ Create | `backend/tests/test_incident_store.py` | 10 tests — all in-memory, no disk, no internet |

---

## 🔑 Quick Primer: How ChromaDB Works

ChromaDB stores text + metadata. When you query it, it finds the most semantically similar stored documents.

```python
# Store an incident
store("cpu spike on payment service", metadata={"resolution": "rollback"})

# Query later
find_similar("payment service high cpu usage")
→ returns "cpu spike on payment service" with similarity 0.93  ✅
```

**Two modes:**
- **Tests** → `chromadb.Client()` — in-memory, resets between runs, no disk writes
- **Production** → uses `settings.chroma_persist_directory` — survives server restarts

No new environment variables needed. Config already has `CHROMA_PERSIST_DIRECTORY`.

---

## ✅ Task 1: Build IncidentStore

> This is the shared ChromaDB wrapper. Both agents will use it. Build and test this first before touching any agent.

**📁 Files:**
- Create: `backend/app/core/incident_store.py`
- Create: `backend/tests/test_incident_store.py`

---

### 🧪 Step 1: Write the failing tests first

Create `backend/tests/test_incident_store.py`:

```python
"""Tests for IncidentStore — all in-memory, no disk writes."""
import pytest
import chromadb
from unittest.mock import patch
from app.core.incident_store import IncidentStore


@pytest.fixture
def store():
    """Fresh in-memory IncidentStore per test."""
    in_memory_client = chromadb.Client()
    with patch("app.core.incident_store.chromadb.PersistentClient", return_value=in_memory_client):
        s = IncidentStore()
    return s


def test_store_and_find_incident(store):
    store.store_incident(
        incident_id="inc-001",
        title="high cpu usage on payment service",
        description="payment error rate crossed 5%",
        metadata={"severity": "HIGH", "team": "Platform", "resolution": "rolled back v2.3.1"}
    )
    results = store.find_similar_incidents("cpu spike payment service", n_results=1)
    assert len(results) == 1
    assert results[0]["title"] == "high cpu usage on payment service"
    assert results[0]["resolution"] == "rolled back v2.3.1"


def test_find_returns_empty_when_no_incidents(store):
    results = store.find_similar_incidents("random query", n_results=3)
    assert results == []


def test_find_returns_top_n_by_similarity(store):
    store.store_incident("inc-A", "database crash", "postgres OOM killed", {"severity": "CRITICAL", "resolution": "restarted postgres"})
    store.store_incident("inc-B", "cpu spike api gateway", "high cpu on nginx", {"severity": "HIGH", "resolution": "scaled horizontally"})
    store.store_incident("inc-C", "disk full on logging server", "syslog disk 100%", {"severity": "MEDIUM", "resolution": "rotated logs"})

    results = store.find_similar_incidents("database out of memory crash", n_results=2)
    assert len(results) == 2
    assert "database" in results[0]["title"].lower() or "postgres" in results[0]["description"].lower()


def test_store_and_find_runbook(store):
    store.store_runbook(
        runbook_id="rb-001",
        incident_title="database connection pool exhausted",
        content="Step 1: Check pool size. Step 2: Restart app. Step 3: Increase max_connections.",
        metadata={"estimated_time": "15 minutes", "team": "Database"}
    )
    results = store.find_similar_runbooks("db connection pool full", n_results=1)
    assert len(results) == 1
    assert "connection pool" in results[0]["incident_title"].lower()


def test_does_not_crash_on_exact_self_match(store):
    store.store_incident("inc-X", "payment timeout", "checkout service 30s timeout", {"severity": "HIGH", "resolution": "fixed query"})
    results = store.find_similar_incidents("payment timeout", n_results=1)
    assert len(results) == 1


def test_store_overwrites_existing_id(store):
    store.store_incident("inc-DUP", "original title", "original desc", {"severity": "LOW", "resolution": "rebooted"})
    store.store_incident("inc-DUP", "updated title", "updated desc", {"severity": "HIGH", "resolution": "patched"})
    results = store.find_similar_incidents("updated title", n_results=1)
    assert results[0]["resolution"] == "patched"
```

---

### 🔴 Step 2: Run tests — confirm they FAIL

```bash
cd ibm-bob-hackathon/backend
pytest tests/test_incident_store.py -v
```

Expected: `ImportError: cannot import name 'IncidentStore'`

Good — that's exactly what we want. Now let's build it.

---

### 🏗️ Step 3: Create IncidentStore

Create `backend/app/core/incident_store.py`:

```python
"""
Shared ChromaDB wrapper — store and find incidents and runbooks by semantic similarity.
"""
from typing import Any, Dict, List
import chromadb
from chromadb.config import Settings as ChromaSettings
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class IncidentStore:
    """
    Two ChromaDB collections:
    - 'incidents': past incidents with resolutions (used by Triage + Runbook agents)
    - 'runbooks': generated runbooks linked to incident types (used by Runbook agent)
    """

    def __init__(self):
        try:
            self._client = chromadb.PersistentClient(
                path=settings.chroma_persist_directory,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        except Exception as e:
            logger.warning("chroma_persistent_failed_using_memory", error=str(e))
            self._client = chromadb.Client()

        self._incidents = self._client.get_or_create_collection(
            name="incidents",
            metadata={"hnsw:space": "cosine"},
        )
        self._runbooks = self._client.get_or_create_collection(
            name="runbooks",
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("incident_store_initialized")

    # ── Incidents ──────────────────────────────────────────────────────────────

    def store_incident(
        self,
        incident_id: str,
        title: str,
        description: str,
        metadata: Dict[str, Any],
    ) -> None:
        document = f"{title}. {description}"
        safe_meta = {k: str(v) for k, v in metadata.items()}
        safe_meta["title"] = title
        safe_meta["description"] = description
        try:
            self._incidents.upsert(
                ids=[incident_id],
                documents=[document],
                metadatas=[safe_meta],
            )
            logger.info("incident_stored", incident_id=incident_id)
        except Exception as e:
            logger.error("incident_store_failed", error=str(e))

    def find_similar_incidents(self, query: str, n_results: int = 3) -> List[Dict[str, Any]]:
        count = self._incidents.count()
        if count == 0:
            return []
        try:
            results = self._incidents.query(
                query_texts=[query],
                n_results=min(n_results, count),
                include=["metadatas", "distances"],
            )
        except Exception as e:
            logger.error("incident_find_failed", error=str(e))
            return []

        return [
            {
                "title": m.get("title", ""),
                "description": m.get("description", ""),
                "severity": m.get("severity", ""),
                "team": m.get("team", ""),
                "resolution": m.get("resolution", ""),
                "resolution_time": m.get("resolution_time", ""),
                "similarity": round(1 - d, 3),
            }
            for m, d in zip(results["metadatas"][0], results["distances"][0])
        ]

    # ── Runbooks ───────────────────────────────────────────────────────────────

    def store_runbook(
        self,
        runbook_id: str,
        incident_title: str,
        content: str,
        metadata: Dict[str, Any],
    ) -> None:
        safe_meta = {k: str(v) for k, v in metadata.items()}
        safe_meta["incident_title"] = incident_title
        try:
            self._runbooks.upsert(
                ids=[runbook_id],
                documents=[f"{incident_title}. {content}"],
                metadatas=[safe_meta],
            )
            logger.info("runbook_stored", runbook_id=runbook_id)
        except Exception as e:
            logger.error("runbook_store_failed", error=str(e))

    def find_similar_runbooks(self, query: str, n_results: int = 3) -> List[Dict[str, Any]]:
        count = self._runbooks.count()
        if count == 0:
            return []
        try:
            results = self._runbooks.query(
                query_texts=[query],
                n_results=min(n_results, count),
                include=["metadatas", "distances"],
            )
        except Exception as e:
            logger.error("runbook_find_failed", error=str(e))
            return []

        return [
            {
                "incident_title": m.get("incident_title", ""),
                "estimated_time": m.get("estimated_time", ""),
                "team": m.get("team", ""),
                "similarity": round(1 - d, 3),
            }
            for m, d in zip(results["metadatas"][0], results["distances"][0])
        ]


# Global singleton — import this in agents
incident_store = IncidentStore()

# Made with Bob
```

---

### ✅ Step 4: Run tests — confirm they PASS

```bash
pytest tests/test_incident_store.py -v
```

Expected:
```
PASSED tests/test_incident_store.py::test_store_and_find_incident
PASSED tests/test_incident_store.py::test_find_returns_empty_when_no_incidents
PASSED tests/test_incident_store.py::test_find_returns_top_n_by_similarity
PASSED tests/test_incident_store.py::test_store_and_find_runbook
PASSED tests/test_incident_store.py::test_does_not_crash_on_exact_self_match
PASSED tests/test_incident_store.py::test_store_overwrites_existing_id
6 passed ✅
```

---

## ✅ Task 2: Wire IncidentStore into Triage Agent

> Now we replace the empty stubs in `triage_agent.py`. Two stubs to fix: `_find_similar_incidents()` and `update_incident_history()`.

**📁 Files:**
- Modify: `backend/app/agents/triage_agent.py`
- Test: append to `backend/tests/test_incident_store.py`

---

### 🧪 Step 1: Write the failing tests

Append these tests to the bottom of `backend/tests/test_incident_store.py`:

```python
# ── Triage Agent integration ───────────────────────────────────────────────────
import structlog as _structlog
from unittest.mock import AsyncMock


@pytest.mark.asyncio
async def test_triage_agent_returns_similar_incidents():
    """TriageAgent._find_similar_incidents() must call IncidentStore, not return []."""
    mock_store = AsyncMock()
    mock_store.find_similar_incidents.return_value = [
        {
            "title": "high cpu on payment service",
            "severity": "HIGH",
            "resolution": "rolled back deploy",
            "resolution_time": "12 minutes",
            "similarity": 0.91,
        }
    ]

    with patch("app.agents.triage_agent.incident_store", mock_store):
        from app.agents.triage_agent import TriageAgent
        agent = TriageAgent.__new__(TriageAgent)
        agent.logger = _structlog.get_logger().bind(agent="TriageAgent")
        results = await agent._find_similar_incidents("high cpu", "payment service error")

    assert len(results) == 1
    assert results[0]["resolution"] == "rolled back deploy"
    mock_store.find_similar_incidents.assert_called_once()


@pytest.mark.asyncio
async def test_triage_agent_update_history_calls_store():
    mock_store = AsyncMock()

    with patch("app.agents.triage_agent.incident_store", mock_store):
        from app.agents.triage_agent import TriageAgent
        agent = TriageAgent.__new__(TriageAgent)
        agent.logger = _structlog.get_logger().bind(agent="TriageAgent")
        await agent.update_incident_history(
            {"title": "db crash", "description": "OOM killed"},
            {"severity": "HIGH", "team": "Database", "resolution": "restarted postgres"}
        )

    mock_store.store_incident.assert_called_once()
```

---

### 🔴 Step 2: Run to confirm FAIL

```bash
pytest tests/test_incident_store.py::test_triage_agent_returns_similar_incidents -v
```

Expected: `AssertionError` — `_find_similar_incidents` still returns `[]`. Good.

---

### 🏗️ Step 3: Update triage_agent.py

Open `backend/app/agents/triage_agent.py`.

**1. Add import** at the top (after the existing imports):
```python
from app.core.incident_store import incident_store
```

**2. Replace** `_find_similar_incidents` (the method that returns `[]`):
```python
async def _find_similar_incidents(
    self,
    title: str,
    description: str
) -> list[Dict[str, Any]]:
    query = f"{title}. {description}"
    results = incident_store.find_similar_incidents(query, n_results=3)
    self.logger.info("similar_incidents_found", count=len(results))
    return results
```

**3. Replace** `update_incident_history` (the method that only logs):
```python
async def update_incident_history(
    self,
    incident_data: Dict[str, Any],
    resolution: Dict[str, Any]
) -> None:
    import uuid
    incident_store.store_incident(
        incident_id=str(uuid.uuid4()),
        title=incident_data.get("title", ""),
        description=incident_data.get("description", ""),
        metadata={
            "severity": resolution.get("severity", ""),
            "team": resolution.get("team", ""),
            "resolution": resolution.get("resolution", ""),
            "resolution_time": resolution.get("resolution_time", ""),
        }
    )
    self.logger.info("incident_history_updated", title=incident_data.get("title"))
```

---

### ✅ Step 4: Run tests — confirm PASS

```bash
pytest tests/test_incident_store.py::test_triage_agent_returns_similar_incidents \
       tests/test_incident_store.py::test_triage_agent_update_history_calls_store -v
```

Expected: `2 passed ✅`

---

## ✅ Task 3: Wire IncidentStore into Runbook Agent

> Same pattern as Task 2. Replace the empty stubs in `runbook_agent.py`.

**📁 Files:**
- Modify: `backend/app/agents/runbook_agent.py`
- Test: append to `backend/tests/test_incident_store.py`

---

### 🧪 Step 1: Write the failing tests

Append to `backend/tests/test_incident_store.py`:

```python
# ── Runbook Agent integration ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_runbook_agent_returns_similar_incidents():
    mock_store = AsyncMock()
    mock_store.find_similar_incidents.return_value = [
        {
            "title": "db connection pool exhausted",
            "resolution": "increased max_connections to 200 and restarted app",
            "resolution_time": "20 minutes",
            "similarity": 0.88,
        }
    ]

    with patch("app.agents.runbook_agent.incident_store", mock_store):
        from app.agents.runbook_agent import RunbookAgent
        agent = RunbookAgent.__new__(RunbookAgent)
        agent.logger = _structlog.get_logger().bind(agent="RunbookAgent")
        results = await agent._find_similar_incidents("db connection pool", "pool exhausted")

    assert len(results) == 1
    assert "max_connections" in results[0]["resolution"]


@pytest.mark.asyncio
async def test_runbook_agent_save_runbook_calls_store():
    mock_store = AsyncMock()

    with patch("app.agents.runbook_agent.incident_store", mock_store):
        from app.agents.runbook_agent import RunbookAgent
        agent = RunbookAgent.__new__(RunbookAgent)
        agent.logger = _structlog.get_logger().bind(agent="RunbookAgent")
        await agent.save_runbook(
            runbook={
                "title": "DB Connection Pool Recovery",
                "steps": [{"step_number": 1, "action": "Check pool metrics"}],
                "estimated_time": "15 minutes",
            },
            incident_id="inc-db-001"
        )

    mock_store.store_runbook.assert_called_once()
```

---

### 🔴 Step 2: Run to confirm FAIL

```bash
pytest tests/test_incident_store.py::test_runbook_agent_returns_similar_incidents -v
```

Expected: `AssertionError` — still returns `[]`.

---

### 🏗️ Step 3: Update runbook_agent.py

Open `backend/app/agents/runbook_agent.py`.

**1. Add import:**
```python
from app.core.incident_store import incident_store
```

**2. Replace** `_find_similar_incidents`:
```python
async def _find_similar_incidents(
    self,
    title: str,
    description: str
) -> list[Dict[str, Any]]:
    query = f"{title}. {description}"
    results = incident_store.find_similar_incidents(query, n_results=3)
    self.logger.info("similar_incidents_found", count=len(results))
    return results
```

**3. Replace** `save_runbook`:
```python
async def save_runbook(
    self,
    runbook: Dict[str, Any],
    incident_id: str
) -> None:
    content = " ".join(
        step.get("action", "") for step in runbook.get("steps", [])
    )
    incident_store.store_runbook(
        runbook_id=incident_id,
        incident_title=runbook.get("title", ""),
        content=content,
        metadata={
            "estimated_time": runbook.get("estimated_time", ""),
            "steps_count": str(len(runbook.get("steps", []))),
        }
    )
    self.logger.info("runbook_saved", incident_id=incident_id, title=runbook.get("title"))
```

---

### ✅ Step 4: Run tests — confirm PASS

```bash
pytest tests/test_incident_store.py::test_runbook_agent_returns_similar_incidents \
       tests/test_incident_store.py::test_runbook_agent_save_runbook_calls_store -v
```

Expected: `2 passed ✅`

---

## ✅ Task 4: Seed Demo Data

> Without pre-loaded incidents, the first demo query returns nothing. This task loads 5 realistic incidents at startup so results appear immediately on stage.

**📁 Files:**
- Create: `backend/app/core/seed_demo_data.py`
- Modify: `backend/app/main.py`

---

### 🏗️ Step 1: Create seed_demo_data.py

Create `backend/app/core/seed_demo_data.py`:

```python
"""
Pre-loads 5 realistic past incidents into ChromaDB for demo.
Only runs when the store is empty — safe to call on every startup.
"""
import structlog
from app.core.incident_store import incident_store

logger = structlog.get_logger()

_DEMO_INCIDENTS = [
    {
        "id": "demo-inc-001",
        "title": "high cpu usage on payment service",
        "description": "payment service error rate crossed 5%, cpu at 98% on server-prod-01",
        "metadata": {
            "severity": "HIGH",
            "team": "Platform",
            "resolution": "rolled back payment-service from v2.3.1 to v2.3.0",
            "resolution_time": "18 minutes",
        },
    },
    {
        "id": "demo-inc-002",
        "title": "database connection pool exhausted",
        "description": "all 100 postgres connections in use, new requests timing out after 30s",
        "metadata": {
            "severity": "HIGH",
            "team": "Database",
            "resolution": "increased max_connections to 200 and restarted connection pool manager",
            "resolution_time": "22 minutes",
        },
    },
    {
        "id": "demo-inc-003",
        "title": "memory leak in order processing service",
        "description": "order service heap growing 500MB per hour, OOM kill after 4 hours",
        "metadata": {
            "severity": "CRITICAL",
            "team": "Application",
            "resolution": "patched memory leak in cart session handler, deployed hotfix v1.9.2",
            "resolution_time": "45 minutes",
        },
    },
    {
        "id": "demo-inc-004",
        "title": "disk full on logging server",
        "description": "syslog partition at 100%, log writes failing, causing app errors",
        "metadata": {
            "severity": "MEDIUM",
            "team": "Platform",
            "resolution": "rotated and compressed old logs, added disk usage alert at 80%",
            "resolution_time": "10 minutes",
        },
    },
    {
        "id": "demo-inc-005",
        "title": "ssl certificate expiry on api gateway",
        "description": "tls cert expired at midnight, all https traffic returning 525 errors",
        "metadata": {
            "severity": "CRITICAL",
            "team": "Platform",
            "resolution": "renewed wildcard cert via certbot, reloaded nginx, updated auto-renewal cron",
            "resolution_time": "12 minutes",
        },
    },
]


def seed_demo_data() -> None:
    """Seed 5 demo incidents if the store is empty. Safe to call on every startup."""
    if incident_store._incidents.count() > 0:
        logger.info("demo_data_already_seeded_skipping")
        return

    for inc in _DEMO_INCIDENTS:
        incident_store.store_incident(
            incident_id=inc["id"],
            title=inc["title"],
            description=inc["description"],
            metadata=inc["metadata"],
        )

    logger.info("demo_data_seeded", count=len(_DEMO_INCIDENTS))

# Made with Bob
```

---

### 🏗️ Step 2: Call seed_demo_data on startup

Open `backend/app/main.py`.

**1. Add import** after existing imports:
```python
from app.core.seed_demo_data import seed_demo_data
```

**2. Update the `lifespan` function** — add one line:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("application_starting", environment=settings.environment)
    seed_demo_data()    # ← ADD THIS LINE
    yield
    logger.info("application_shutting_down")
```

---

## ✅ Task 5: Run All Tests + Smoke Test

### 🧪 Step 1: Run the full test suite

```bash
cd ibm-bob-hackathon/backend
pytest tests/test_incident_store.py -v
```

Expected:
```
PASSED tests/test_incident_store.py::test_store_and_find_incident
PASSED tests/test_incident_store.py::test_find_returns_empty_when_no_incidents
PASSED tests/test_incident_store.py::test_find_returns_top_n_by_similarity
PASSED tests/test_incident_store.py::test_store_and_find_runbook
PASSED tests/test_incident_store.py::test_does_not_crash_on_exact_self_match
PASSED tests/test_incident_store.py::test_store_overwrites_existing_id
PASSED tests/test_incident_store.py::test_triage_agent_returns_similar_incidents
PASSED tests/test_incident_store.py::test_triage_agent_update_history_calls_store
PASSED tests/test_incident_store.py::test_runbook_agent_returns_similar_incidents
PASSED tests/test_incident_store.py::test_runbook_agent_save_runbook_calls_store
10 passed ✅
```

---

### 🚀 Step 2: Smoke test — see it work live

**Start the server:**
```bash
uvicorn app.main:app --reload --port 8000
```

Server logs should show:
```json
{"event": "demo_data_seeded", "count": 5}
```

**Fire a triage request similar to demo-inc-001:**
```bash
curl -s -X POST http://localhost:8000/api/v1/incidents/triage \
  -H "Content-Type: application/json" \
  -d '{
    "title": "payment service cpu spike",
    "description": "payment service error rate at 6%, cpu pegged at 95% on prod server",
    "source": "prometheus"
  }' | python -m json.tool
```

**Grab the `task_id` from the response, then poll for results:**
```bash
curl -s http://localhost:8000/api/v1/tasks/<TASK_ID> | python -m json.tool
```

**You should now see `similar_incidents` populated — not empty!**
```json
{
  "status": "awaiting_approval",
  "result": {
    "data": {
      "severity": "HIGH",
      "similar_incidents": [
        {
          "title": "high cpu usage on payment service",
          "resolution": "rolled back payment-service from v2.3.1 to v2.3.0",
          "resolution_time": "18 minutes",
          "similarity": 0.93
        }
      ]
    }
  }
}
```

**Try the runbook agent too:**
```bash
curl -s -X POST http://localhost:8000/api/v1/runbooks/generate \
  -H "Content-Type: application/json" \
  -d '{
    "incident_title": "postgres connections exhausted",
    "incident_description": "all database connections in use, app throwing connection timeout errors"
  }' | python -m json.tool
```

Poll the task — `similar_incidents` should show `demo-inc-002`.

---

## 📦 Summary of What Was Built

```
backend/app/
├── core/
│   ├── incident_store.py      ← NEW — ChromaDB wrapper, store + find for incidents + runbooks
│   └── seed_demo_data.py      ← NEW — 5 pre-loaded incidents, runs once on startup
└── agents/
    ├── triage_agent.py        ← MODIFIED — _find_similar_incidents() + update_incident_history() wired
    └── runbook_agent.py       ← MODIFIED — _find_similar_incidents() + save_runbook() wired

backend/tests/
└── test_incident_store.py     ← NEW — 10 tests, all in-memory, no disk, no live ChromaDB
```

| Metric | Value |
|---|---|
| 🧪 New tests | 10 |
| ➕ Files created | 3 |
| ✏️ Files modified | 3 |
| 🤖 Agents improved | 2 (Triage + Runbook) |
| 💾 New dependencies | 0 (chromadb already in requirements.txt) |

---
