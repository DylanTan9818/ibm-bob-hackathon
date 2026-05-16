# DevOps Autopilot Multi-Agent System - Setup Guide

This guide will help you set up and run the DevOps Autopilot Multi-Agent System.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Docker** (20.10+) and **Docker Compose** (2.0+)
- **Python** 3.11+ (for local development)
- **Node.js** 18+ (for local development)
- **Git**

## 🔑 Required API Keys

You'll need at least one of the following LLM provider API keys:

- **OpenAI API Key**: Get from https://platform.openai.com/api-keys
- **Anthropic API Key**: Get from https://console.anthropic.com/

Optional integrations:
- GitHub Personal Access Token
- Jira API Token
- Slack Bot Token
- PagerDuty API Key

## 🚀 Quick Start with Docker (Recommended)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ibm-bob-hackathon
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Required: Choose one LLM provider
OPENAI_API_KEY=sk-your-openai-api-key-here
# OR
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

LLM_PROVIDER=openai  # or anthropic
LLM_MODEL=gpt-4-turbo-preview  # or claude-3-opus-20240229

# Optional: Integration keys
GITHUB_TOKEN=ghp_your_github_token
JIRA_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_api_token
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
PAGERDUTY_API_KEY=your_pagerduty_api_key
```

### 3. Start All Services

```bash
docker-compose up -d
```

This will start:
- **Backend API** on http://localhost:8000
- **Frontend** on http://localhost:3000
- **PostgreSQL** on localhost:5432
- **Redis** on localhost:6379
- **ChromaDB** on localhost:8001

### 4. Verify Services

Check that all services are running:

```bash
docker-compose ps
```

Access the application:
- **Frontend Dashboard**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### 5. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 6. Stop Services

```bash
docker-compose down

# To also remove volumes (database data)
docker-compose down -v
```

## 💻 Local Development Setup

### Backend Setup

1. **Create Virtual Environment**

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. **Install Dependencies**

```bash
pip install -r requirements.txt
```

3. **Set Environment Variables**

```bash
export OPENAI_API_KEY=your-key-here
export DATABASE_URL=postgresql://devops_user:devops_pass@localhost:5432/devops_autopilot
export REDIS_URL=redis://localhost:6379/0
```

4. **Start Backend**

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. **Install Dependencies**

```bash
cd frontend
npm install
```

2. **Set Environment Variables**

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

3. **Start Frontend**

```bash
npm run dev
```

The frontend will be available at http://localhost:3000

## 🧪 Testing the System

### 1. Test Incident Triage

```bash
curl -X POST http://localhost:8000/api/v1/incidents/triage \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU usage on prod-server-01",
    "description": "CPU at 95% for 10 minutes, affecting user requests",
    "source": "prometheus",
    "metadata": {
      "server": "prod-server-01",
      "metric": "cpu_usage",
      "value": 95
    }
  }'
```

### 2. Test Runbook Generation

```bash
curl -X POST http://localhost:8000/api/v1/runbooks/generate \
  -H "Content-Type: application/json" \
  -d '{
    "incident_title": "Database connection pool exhausted",
    "incident_description": "Application cannot connect to database",
    "error_logs": "ERROR: connection pool exhausted",
    "metadata": {}
  }'
```

### 3. Test PR Review

```bash
curl -X POST http://localhost:8000/api/v1/prs/review \
  -H "Content-Type: application/json" \
  -d '{
    "pr_url": "https://github.com/org/repo/pull/123",
    "repository": "org/repo",
    "pr_number": 123,
    "title": "Add new feature",
    "description": "This PR adds a new feature",
    "files_changed": ["src/app.py", "tests/test_app.py"]
  }'
```

### 4. Check Task Status

```bash
# Get task by ID
curl http://localhost:8000/api/v1/tasks/{task_id}

# List all tasks
curl http://localhost:8000/api/v1/tasks
```

### 5. Approve a Task

```bash
curl -X POST http://localhost:8000/api/v1/tasks/{task_id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "approved_by": "admin@example.com",
    "comment": "Looks good"
  }'
```

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (React)                       │
│                  http://localhost:3000                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                Backend API (FastAPI)                     │
│                  http://localhost:8000                   │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  PostgreSQL  │  │    Redis     │  │  ChromaDB    │
│   :5432      │  │    :6379     │  │   :8001      │
└──────────────┘  └──────────────┘  └──────────────┘
```

## 🔧 Configuration

### LLM Provider Configuration

**OpenAI:**
```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4-turbo-preview
OPENAI_API_KEY=sk-...
```

**Anthropic:**
```env
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-opus-20240229
ANTHROPIC_API_KEY=sk-ant-...
```

### Agent Configuration

```env
MAX_AGENT_RETRIES=3
AGENT_TIMEOUT_SECONDS=300
HUMAN_APPROVAL_REQUIRED=true
```

### Database Configuration

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
```

## 🐛 Troubleshooting

### Backend won't start

1. Check if all required environment variables are set
2. Verify database connection: `docker-compose logs postgres`
3. Check backend logs: `docker-compose logs backend`

### Frontend can't connect to backend

1. Verify backend is running: `curl http://localhost:8000/health`
2. Check CORS settings in `backend/app/main.py`
3. Verify `VITE_API_URL` in frontend environment

### LLM API errors

1. Verify API key is correct
2. Check API rate limits
3. Ensure sufficient credits/quota
4. Review logs: `docker-compose logs backend`

### Database connection errors

1. Check PostgreSQL is running: `docker-compose ps postgres`
2. Verify DATABASE_URL is correct
3. Check database logs: `docker-compose logs postgres`

## 📊 Monitoring

### View Metrics

Prometheus metrics are exposed at:
```
http://localhost:8000/metrics
```

### Database Access

Connect to PostgreSQL:
```bash
docker-compose exec postgres psql -U devops_user -d devops_autopilot
```

### Redis Access

Connect to Redis:
```bash
docker-compose exec redis redis-cli
```

## 🔒 Security Considerations

1. **Never commit `.env` file** - It contains sensitive API keys
2. **Change default passwords** in production
3. **Use HTTPS** in production
4. **Implement proper authentication** for the API
5. **Restrict CORS origins** in production
6. **Rotate API keys** regularly
7. **Use secrets management** (e.g., AWS Secrets Manager, HashiCorp Vault)

## 📚 Next Steps

1. **Customize Agents**: Modify agent prompts in `backend/app/agents/`
2. **Add Integrations**: Implement GitHub, Jira, Slack integrations
3. **Enhance Frontend**: Build out the React components
4. **Add Authentication**: Implement user authentication
5. **Set up CI/CD**: Automate testing and deployment
6. **Configure Monitoring**: Set up Prometheus and Grafana
7. **Write Tests**: Add unit and integration tests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review logs for error messages

## 🎯 Production Deployment

For production deployment:

1. Use managed services (RDS, ElastiCache, etc.)
2. Set up proper monitoring and alerting
3. Implement backup strategies
4. Use container orchestration (Kubernetes, ECS)
5. Set up CI/CD pipelines
6. Implement proper logging aggregation
7. Use secrets management
8. Set up SSL/TLS certificates
9. Implement rate limiting
10. Configure auto-scaling

Refer to deployment-specific documentation for your cloud provider.