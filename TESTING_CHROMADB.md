# 🧪 Testing ChromaDB Similar Incident Lookup

This guide shows you how to test the ChromaDB integration both with automated tests and through the UI.

---

## 🔧 Prerequisites

1. **Backend dependencies installed**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Frontend dependencies installed**:
   ```bash
   cd frontend
   npm install
   ```

3. **Environment variables configured** (`.env` file in root):
   ```
   OPENAI_API_KEY=your_key_here
   # or
   AZURE_OPENAI_API_KEY=your_key_here
   AZURE_OPENAI_ENDPOINT=your_endpoint_here
   ```

---

## ✅ Method 1: Automated Tests (Fastest)

### Run Core ChromaDB Tests

```bash
cd backend
python -m pytest tests/test_incident_store.py -v
```

**Expected output:**
```
✅ test_store_and_find_incident PASSED
✅ test_find_returns_empty_when_no_incidents PASSED
✅ test_find_returns_top_n_by_similarity PASSED
✅ test_store_and_find_runbook PASSED
✅ test_does_not_crash_on_exact_self_match PASSED
✅ test_store_overwrites_existing_id PASSED
6 passed in ~4 seconds
```

### Run Standalone Integration Test

```bash
cd backend
python test_chromadb_integration.py
```

**Expected output:**
```
============================================================
ChromaDB Integration Test
============================================================

1. Seeding demo data...
   [OK] Incidents in store: 5

2. Testing similarity search...
   [OK] Found 3 similar incidents

   Top match:
   - Title: high cpu usage on payment service
   - Resolution: rolled back payment-service from v2.3.1 to v2.3.0
   - Time: 18 minutes
   - Similarity: 0.774

3. Testing database connection pool query...
   [OK] Found 2 similar incidents

   Top match:
   - Title: database connection pool exhausted
   - Resolution: increased max_connections to 200 and restarted connection pool manager
   - Similarity: 0.761

4. Testing incident storage...
   [OK] Incidents after insert: 6

============================================================
[SUCCESS] All ChromaDB integration tests passed!
============================================================
```

---

## 🌐 Method 2: Full UI Testing (Most Visual)

### Step 1: Start the Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

**Look for this in the logs:**
```
2026-05-17 02:41:20 [info] incident_store_initialized
2026-05-17 02:41:20 [info] demo_data_seeded count=5
```

✅ If you see `demo_data_seeded`, the 5 demo incidents are loaded!

### Step 2: Start the Frontend

Open a new terminal:

```bash
cd frontend
npm run dev
```

Frontend will start at `http://localhost:5173`

### Step 3: Test Triage Page

1. **Navigate to**: `http://localhost:5173/triage`

2. **Enter a similar incident**:
   - **Title**: `payment service cpu spike`
   - **Description**: `payment service error rate high, cpu at 95%`
   - **Source**: `manual`

3. **Click**: "Submit for Triage"

4. **Wait for results** (~10-30 seconds depending on LLM)

5. **✅ Expected Result**: You should see a new section called **"Similar Past Incidents"** with:
   - 📚 Green header with book icon
   - Card showing: "high cpu usage on payment service"
   - Resolution: "rolled back payment-service from v2.3.1 to v2.3.0"
   - Time: "18 minutes"
   - Similarity badge: "~77.4% match"

### Step 4: Test Runbook Page

1. **Navigate to**: `http://localhost:5173/runbook`

2. **Enter a similar incident**:
   - **Incident Title**: `database connection pool exhausted`
   - **Incident Description**: `postgres connections all in use, app timing out`

3. **Click**: "Generate Runbook"

4. **Wait for results** (~10-30 seconds)

5. **✅ Expected Result**: You should see **"Similar Past Incidents"** section with:
   - Card showing: "database connection pool exhausted"
   - Resolution: "increased max_connections to 200 and restarted connection pool manager"
   - Similarity badge: "~76.1% match"

---

## 🎯 Quick Visual Test (No LLM Required)

If you want to test just the ChromaDB functionality without waiting for LLM responses:

```bash
cd backend
python test_chromadb_integration.py
```

This runs in **~2 seconds** and proves:
- ✅ ChromaDB is working
- ✅ Demo data is seeded
- ✅ Similarity search returns correct results
- ✅ Storage and retrieval work

---

## 🔍 What to Look For

### ✅ Success Indicators

**In Backend Logs:**
```
[info] incident_store_initialized
[info] demo_data_seeded count=5
[info] similar_incidents_found count=3
```

**In Frontend UI:**
- Green "Similar Past Incidents" section appears
- Shows 1-3 similar incidents with details
- Similarity percentages displayed (e.g., "77.4% match")
- Resolution and time information visible

### ❌ Troubleshooting

**If similar incidents don't appear:**

1. **Check backend logs** for `demo_data_seeded`
   - If missing, demo data didn't load
   - Run: `python test_chromadb_integration.py` to verify

2. **Check API response** in browser DevTools:
   - Open Network tab
   - Look for `/api/v1/tasks/{task_id}` response
   - Verify `similar_incidents` array is present and not empty

3. **Verify ChromaDB is working**:
   ```bash
   cd backend
   python -c "from app.core.incident_store import incident_store; print(incident_store._incidents.count())"
   ```
   Should print: `5` (or more if you've added incidents)

---

## 📊 Demo Scenarios

### Scenario 1: CPU Spike (High Similarity)
**Input**: "payment service cpu spike"
**Expected Match**: "high cpu usage on payment service" (~77% similarity)

### Scenario 2: Database Issues (High Similarity)
**Input**: "postgres connections exhausted"
**Expected Match**: "database connection pool exhausted" (~76% similarity)

### Scenario 3: Memory Problems (Medium Similarity)
**Input**: "application memory leak"
**Expected Match**: "memory leak in order processing service" (~60-70% similarity)

### Scenario 4: Disk Space (Medium Similarity)
**Input**: "disk full on server"
**Expected Match**: "disk full on logging server" (~65-75% similarity)

### Scenario 5: SSL/TLS (High Similarity)
**Input**: "certificate expired"
**Expected Match**: "ssl certificate expiry on api gateway" (~70-80% similarity)

---

## 🎬 Demo Flow for Presentation

1. **Show empty state** (optional):
   - Delete ChromaDB data: `rm -rf backend/chroma_data`
   - Restart backend
   - First triage shows no similar incidents

2. **Triage first incident**:
   - Title: "payment service high cpu"
   - Shows triage results but no similar incidents

3. **Triage similar incident**:
   - Title: "payment cpu spike error rate high"
   - **NOW shows similar incident** from step 2!
   - Displays resolution and time

4. **Generate runbook**:
   - Title: "database connection pool full"
   - Shows similar incident with resolution
   - Demonstrates institutional memory across agents

---

## 📝 Notes

- **Demo data persists** between server restarts (stored in `backend/chroma_data/`)
- **To reset demo data**: Delete `backend/chroma_data/` folder and restart backend
- **Similarity threshold**: ChromaDB returns top 3 matches, typically 60-90% similarity
- **Performance**: Similarity search takes ~50-100ms, very fast!

---

## 🚀 Quick Start (TL;DR)

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Quick test
cd backend
python test_chromadb_integration.py
```

Then open `http://localhost:5173/triage` and submit an incident similar to the demo data!

---

**Made with Bob** 🤖