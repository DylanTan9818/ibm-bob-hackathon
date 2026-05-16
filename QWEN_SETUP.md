# Setup Guide for Qwen/DashScope API

This guide shows you how to configure the DevOps Autopilot system to use Alibaba's Qwen models via DashScope API.

## 🎯 Why Qwen/DashScope?

- **Cost-effective**: Generally cheaper than OpenAI/Anthropic
- **High performance**: Qwen models are competitive with GPT-4
- **Regional availability**: Better latency in Asia-Pacific region
- **OpenAI-compatible**: Uses the same API format as OpenAI

## 📋 Prerequisites

1. **DashScope API Key**: Get from https://dashscope.console.aliyun.com/
2. **Docker & Docker Compose**: For running the application
3. **Your region**: Choose the appropriate base URL

## 🚀 Step-by-Step Setup

### Step 1: Get Your DashScope API Key

1. Go to https://dashscope.console.aliyun.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)

### Step 2: Configure Environment

```bash
# In your project root
cd /Users/dylantan/Documents/GitHub/ibm-bob-hackathon

# Copy the example environment file
cp .env.example .env
```

### Step 3: Edit .env File

Open `.env` and configure for DashScope:

```env
# DashScope/Qwen Configuration
DASHSCOPE_API_KEY=sk-your-actual-dashscope-api-key-here
LLM_PROVIDER=dashscope
LLM_MODEL=qwen-plus
LLM_TEMPERATURE=0.7

# Choose your region's base URL
# Singapore (recommended for Malaysia)
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Other regions:
# US: https://dashscope-us.aliyuncs.com/compatible-mode/v1
# China: https://dashscope.aliyuncs.com/compatible-mode/v1
# Hong Kong: https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1
```

### Step 4: Choose Your Model

Available Qwen models:

| Model | Description | Best For |
|-------|-------------|----------|
| `qwen-plus` | Balanced performance and cost | General use (recommended) |
| `qwen-turbo` | Faster, lower cost | Simple tasks |
| `qwen-max` | Highest quality | Complex reasoning |
| `qwen2.5-72b-instruct` | Latest version | Advanced tasks |

Update in `.env`:
```env
LLM_MODEL=qwen-plus  # or qwen-turbo, qwen-max, etc.
```

### Step 5: Start the Application

```bash
# Start all services
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs
docker-compose logs -f backend
```

### Step 6: Verify Configuration

```bash
# Test health endpoint
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "environment": "development",
  "llm_provider": "dashscope"
}
```

### Step 7: Test with Qwen

```bash
# Test incident triage
curl -X POST http://localhost:8000/api/v1/incidents/triage \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU usage on prod-server-01",
    "description": "CPU at 95% for 10 minutes, affecting user requests",
    "source": "prometheus",
    "metadata": {}
  }'
```

You should get a response with a `task_id`. Check the task status:

```bash
curl http://localhost:8000/api/v1/tasks/{task_id}
```

## 🌍 Regional Base URLs

Choose the base URL closest to your location for best performance:

### Asia-Pacific
```env
# Singapore (best for Malaysia, Southeast Asia)
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Hong Kong
DASHSCOPE_BASE_URL=https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1
```

### Americas
```env
# US (Virginia)
DASHSCOPE_BASE_URL=https://dashscope-us.aliyuncs.com/compatible-mode/v1
```

### China Mainland
```env
# Beijing
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

## 💰 Cost Comparison

Approximate costs (as of 2024):

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| qwen-turbo | ~$0.30 | ~$0.60 |
| qwen-plus | ~$0.80 | ~$2.00 |
| qwen-max | ~$2.00 | ~$6.00 |
| GPT-4 Turbo | ~$10.00 | ~$30.00 |

**Qwen is typically 5-10x cheaper than GPT-4!**

## 🔧 Complete .env Example for Qwen

```env
# LLM Configuration - DashScope/Qwen
DASHSCOPE_API_KEY=sk-your-dashscope-api-key-here
LLM_PROVIDER=dashscope
LLM_MODEL=qwen-plus
LLM_TEMPERATURE=0.7
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1

# Database Configuration
DATABASE_URL=postgresql://devops_user:devops_pass@postgres:5432/devops_autopilot
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Redis Configuration
REDIS_URL=redis://redis:6379/0
REDIS_MAX_CONNECTIONS=50

# ChromaDB Configuration
CHROMA_HOST=chromadb
CHROMA_PORT=8000
CHROMA_PERSIST_DIRECTORY=/data/chromadb

# Application Configuration
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4
LOG_LEVEL=INFO
ENVIRONMENT=development

# Security
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Agent Configuration
MAX_AGENT_RETRIES=3
AGENT_TIMEOUT_SECONDS=300
HUMAN_APPROVAL_REQUIRED=true

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090

# Frontend
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws
```

## 🧪 Testing Different Models

You can easily switch between models by updating `.env`:

```bash
# Stop services
docker-compose down

# Edit .env and change LLM_MODEL
nano .env

# Restart services
docker-compose up -d
```

## ⚠️ Troubleshooting

### Issue: "Invalid API key"
```bash
# Check your API key is correct
echo $DASHSCOPE_API_KEY

# Make sure it starts with 'sk-'
# Regenerate key if needed from DashScope console
```

### Issue: "Connection timeout"
```bash
# Try a different regional base URL
# Singapore users should use:
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

### Issue: "Model not found"
```bash
# Check available models:
# qwen-plus, qwen-turbo, qwen-max, qwen2.5-72b-instruct

# Update in .env:
LLM_MODEL=qwen-plus
```

### Issue: Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. Missing DASHSCOPE_API_KEY in .env
# 2. Wrong LLM_PROVIDER (should be 'dashscope')
# 3. Invalid base URL
```

## 📊 Performance Tips

1. **Use qwen-plus for production**: Best balance of quality and cost
2. **Use qwen-turbo for development**: Faster responses, lower cost
3. **Set appropriate temperature**: 
   - 0.7 for balanced responses (default)
   - 0.3 for more deterministic outputs
   - 0.9 for more creative responses

4. **Monitor token usage**: Check DashScope console for usage statistics

## 🔄 Switching Between Providers

You can easily switch between OpenAI, Anthropic, and DashScope:

```env
# For OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4-turbo-preview

# For Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-3-opus-20240229

# For DashScope/Qwen
LLM_PROVIDER=dashscope
DASHSCOPE_API_KEY=sk-...
LLM_MODEL=qwen-plus
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Just update `.env` and restart:
```bash
docker-compose restart backend
```

## 📚 Additional Resources

- **DashScope Console**: https://dashscope.console.aliyun.com/
- **API Documentation**: https://help.aliyun.com/zh/dashscope/
- **Model Pricing**: Check DashScope console for latest pricing
- **Model Comparison**: https://qwenlm.github.io/

## ✅ Quick Checklist

- [ ] Got DashScope API key
- [ ] Copied `.env.example` to `.env`
- [ ] Set `DASHSCOPE_API_KEY` in `.env`
- [ ] Set `LLM_PROVIDER=dashscope`
- [ ] Set `LLM_MODEL=qwen-plus` (or your choice)
- [ ] Set correct `DASHSCOPE_BASE_URL` for your region
- [ ] Started services with `docker-compose up -d`
- [ ] Tested health endpoint
- [ ] Tested incident triage
- [ ] Opened http://localhost:3000

You're all set! The system is now using Qwen models via DashScope API. 🎉