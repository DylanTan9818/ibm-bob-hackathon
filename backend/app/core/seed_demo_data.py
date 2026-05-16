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