# DevOps Autopilot Multi-Agent System

An intelligent multi-agent orchestration system that automates DevOps toil, reducing manual work by 60-70%.

## 🎯 Features

- **Triage Agent**: Automatically classifies and routes alerts/tickets
- **Runbook Agent**: Generates resolution steps from past incidents
- **PR Review Agent**: Enforces policy rules and auto-approves safe PRs
- **Doc Agent**: Creates release notes, post-mortems, and changelogs
- **Orchestrator Agent**: Coordinates all agents with human-in-the-loop approval

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Orchestrator Agent                     │
│              (LangGraph State Machine)                   │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┬──────────────┐
        │                 │                 │              │
   ┌────▼────┐      ┌────▼────┐      ┌────▼────┐   ┌────▼────┐
   │ Triage  │      │ Runbook │      │PR Review│   │   Doc   │
   │  Agent  │      │  Agent  │      │  Agent  │   │  Agent  │
   └─────────┘      └─────────┘      └─────────┘   └─────────┘
```

## 🚀 Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Agent Framework**: LangGraph + LangChain
- **LLM**: OpenAI GPT-4 / Anthropic Claude
- **Database**: PostgreSQL
- **Vector Store**: ChromaDB
- **Cache/Queue**: Redis
- **Frontend**: React + TypeScript
- **Deployment**: Docker + Docker Compose

## 📋 Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- OpenAI API Key or Anthropic API Key

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd ibm-bob-hackathon
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

### 3. Start with Docker Compose

```bash
docker-compose up -d
```

### 4. Or run locally

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 🎮 Usage

### API Endpoints

- `POST /api/v1/incidents/triage` - Submit incident for triage
- `POST /api/v1/prs/review` - Submit PR for review
- `POST /api/v1/runbooks/generate` - Generate runbook
- `POST /api/v1/docs/generate` - Generate documentation
- `GET /api/v1/tasks/{task_id}` - Get task status
- `POST /api/v1/tasks/{task_id}/approve` - Approve agent action

### Example: Triaging an Incident

```python
import requests

response = requests.post(
    "http://localhost:8000/api/v1/incidents/triage",
    json={
        "title": "High CPU usage on prod-server-01",
        "description": "CPU at 95% for 10 minutes",
        "source": "prometheus",
        "metadata": {"server": "prod-server-01", "metric": "cpu_usage"}
    }
)

task_id = response.json()["task_id"]
print(f"Task created: {task_id}")
```

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── agents/          # Agent implementations
│   │   ├── api/             # FastAPI routes
│   │   ├── core/            # Core configuration
│   │   ├── models/          # Data models
│   │   ├── services/        # Business logic
│   │   └── main.py          # Application entry point
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   └── App.tsx
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🔧 Configuration

Key environment variables in `.env`:

```env
# LLM Configuration
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
LLM_PROVIDER=openai  # or anthropic

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/devops_autopilot

# Redis
REDIS_URL=redis://localhost:6379

# Application
API_HOST=0.0.0.0
API_PORT=8000
LOG_LEVEL=INFO
```

## 🤖 Agent Details

### Triage Agent
- Analyzes incident severity using historical data
- Routes to appropriate team based on keywords and patterns
- Suggests initial troubleshooting steps

### Runbook Agent
- Searches vector database of past incidents
- Generates step-by-step resolution procedures
- Links to relevant documentation

### PR Review Agent
- Checks code against policy rules (security, style, best practices)
- Auto-approves PRs that pass all checks
- Flags violations with explanations

### Doc Agent
- Generates release notes from Git commits
- Creates post-mortem reports from incident data
- Maintains changelog automatically

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📊 Monitoring

Access the dashboard at `http://localhost:3000` to:
- View active tasks and their status
- Approve/reject agent recommendations
- Monitor agent performance metrics
- Review audit logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with:
- [LangGraph](https://github.com/langchain-ai/langgraph)
- [LangChain](https://github.com/langchain-ai/langchain)
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)