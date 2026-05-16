"""Tests for IncidentStore — all in-memory, no disk writes."""
import pytest
import chromadb
from unittest.mock import patch, MagicMock
from app.core.incident_store import IncidentStore


@pytest.fixture
def store():
    """Fresh in-memory IncidentStore per test."""
    in_memory_client = chromadb.Client()
    
    # Mock PersistentClient to return our in-memory client
    mock_persistent = MagicMock(return_value=in_memory_client)
    
    with patch("app.core.incident_store.chromadb.PersistentClient", mock_persistent):
        s = IncidentStore()
    
    # Clean up collections after each test
    yield s
    
    # Delete collections to ensure clean state
    try:
        in_memory_client.delete_collection("incidents")
    except:
        pass
    try:
        in_memory_client.delete_collection("runbooks")
    except:
        pass


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

# Made with Bob
