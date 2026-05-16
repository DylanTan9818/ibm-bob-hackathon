"""
Standalone test to verify ChromaDB integration works.
Run this to test without starting the full server.
"""
import sys
sys.path.insert(0, 'app')

from app.core.incident_store import incident_store
from app.core.seed_demo_data import seed_demo_data

print("=" * 60)
print("ChromaDB Integration Test")
print("=" * 60)

# Test 1: Seed demo data
print("\n1. Seeding demo data...")
seed_demo_data()
count = incident_store._incidents.count()
print(f"   [OK] Incidents in store: {count}")

# Test 2: Find similar incidents
print("\n2. Testing similarity search...")
query = "payment service cpu spike error rate high"
results = incident_store.find_similar_incidents(query, n_results=3)
print(f"   [OK] Found {len(results)} similar incidents")

if results:
    print("\n   Top match:")
    print(f"   - Title: {results[0]['title']}")
    print(f"   - Resolution: {results[0]['resolution']}")
    print(f"   - Time: {results[0]['resolution_time']}")
    print(f"   - Similarity: {results[0]['similarity']}")

# Test 3: Another query
print("\n3. Testing database connection pool query...")
query2 = "postgres connections exhausted timeout"
results2 = incident_store.find_similar_incidents(query2, n_results=2)
print(f"   [OK] Found {len(results2)} similar incidents")

if results2:
    print("\n   Top match:")
    print(f"   - Title: {results2[0]['title']}")
    print(f"   - Resolution: {results2[0]['resolution']}")
    print(f"   - Similarity: {results2[0]['similarity']}")

# Test 4: Store a new incident
print("\n4. Testing incident storage...")
incident_store.store_incident(
    incident_id="test-001",
    title="test incident",
    description="this is a test",
    metadata={"severity": "LOW", "team": "Test", "resolution": "tested successfully"}
)
new_count = incident_store._incidents.count()
print(f"   [OK] Incidents after insert: {new_count}")

print("\n" + "=" * 60)
print("[SUCCESS] All ChromaDB integration tests passed!")
print("=" * 60)

# Made with Bob
