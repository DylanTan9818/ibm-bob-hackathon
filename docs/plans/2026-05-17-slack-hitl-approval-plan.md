# Slack Notification + Human-in-the-Loop Approval Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fire a Slack message with ✅ Approve / ❌ Reject buttons whenever a task hits `AWAITING_APPROVAL`, and handle the button click to resume the pipeline.

**Architecture:** A `SlackNotifier` service builds Block Kit messages and posts them via `slack_sdk`. A new FastAPI webhook route `/api/v1/slack/webhook` receives Slack's button-click payload and calls the existing `approve_task` logic. The notifier is wired into `process_task_async` in `main.py` — no orchestrator changes needed.

**Tech Stack:** `slack-sdk==3.26.2` (already in requirements.txt), FastAPI, `python-dotenv`, `pytest` + `unittest.mock`

---

## 🗂️ File Summary

| Action | File | What changes |
|---|---|---|
| ➕ Create | `backend/app/services/slack_notifier.py` | SlackNotifier class — builds Block Kit messages, posts to Slack |
| ➕ Create | `backend/app/api/__init__.py` | Empty init to make `api/` a package |
| ➕ Create | `backend/app/api/slack_webhook.py` | FastAPI router — receives Slack button payloads |
| ✏️ Modify | `backend/app/main.py` | Wire notifier into `process_task_async` + register webhook router |
| ➕ Create | `backend/tests/test_slack_notifier.py` | Unit tests for message building (no live Slack calls) |
| ➕ Create | `backend/tests/test_slack_webhook.py` | Unit tests for webhook payload parsing |
| ✏️ Modify | `backend/.env` | Add `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` |

---

## 🔑 Environment Variables You Need

Before starting, add these to `backend/.env`:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here
SLACK_CHANNEL_ID=C0XXXXXXXXX
```

**How to get them:**
1. Go to https://api.slack.com/apps → Create New App → From Scratch
2. **Bot Token Scopes** (OAuth & Permissions): add `chat:write`, `chat:write.public`
3. Install to your workspace → copy **Bot User OAuth Token** (`xoxb-...`) → `SLACK_BOT_TOKEN`
4. Basic Information → App Credentials → copy **Signing Secret** → `SLACK_SIGNING_SECRET`
5. Right-click your target Slack channel → View channel details → copy Channel ID → `SLACK_CHANNEL_ID`

**For the webhook URL (local dev):**
```bash
# Install ngrok, then run:
ngrok http 8000
# Copy the https URL, e.g. https://abc123.ngrok.io
# In Slack app: Interactivity & Shortcuts → Request URL → https://abc123.ngrok.io/api/v1/slack/webhook
```

---

## ✅ Task 1: SlackNotifier Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/slack_notifier.py`
- Test: `backend/tests/test_slack_notifier.py`

---

### 🧪 Step 1: Write the failing tests

Create `backend/tests/test_slack_notifier.py`:

```python
"""Tests for SlackNotifier — no live Slack calls."""
import pytest
from unittest.mock import MagicMock, patch
from app.services.slack_notifier import SlackNotifier


def make_task(task_id="task-abc", status="awaiting_approval", task_type="triage", title="high cpu at prod-01"):
    return {
        "id": task_id,
        "status": status,
        "task_type": task_type,
        "title": title,
        "result": None,
        "error": None,
    }


def test_build_approval_message_contains_task_id():
    notifier = SlackNotifier.__new__(SlackNotifier)
    task = make_task(task_id="xyz-999")
    blocks = notifier._build_approval_blocks(task)
    # The button values must contain the task_id so the webhook knows which task
    button_values = [
        el["value"]
        for block in blocks
        if block.get("type") == "actions"
        for el in block.get("elements", [])
    ]
    assert "xyz-999" in button_values


def test_build_approval_message_has_both_buttons():
    notifier = SlackNotifier.__new__(SlackNotifier)
    task = make_task()
    blocks = notifier._build_approval_blocks(task)
    action_blocks = [b for b in blocks if b.get("type") == "actions"]
    assert len(action_blocks) == 1
    elements = action_blocks[0]["elements"]
    action_ids = [e["action_id"] for e in elements]
    assert "approve_task" in action_ids
    assert "reject_task" in action_ids


def test_build_completion_message_shows_completed():
    notifier = SlackNotifier.__new__(SlackNotifier)
    task = make_task(status="completed")
    blocks = notifier._build_completion_blocks(task)
    all_text = str(blocks)
    assert "completed" in all_text.lower() or "✅" in all_text


def test_build_completion_message_shows_failed():
    notifier = SlackNotifier.__new__(SlackNotifier)
    task = make_task(status="failed")
    task["error"] = "LLM timeout"
    blocks = notifier._build_completion_blocks(task)
    all_text = str(blocks)
    assert "failed" in all_text.lower() or "❌" in all_text


def test_notify_approval_skips_gracefully_when_no_token():
    """If SLACK_BOT_TOKEN is not set, notify must not crash — just log and return."""
    with patch("app.services.slack_notifier.settings") as mock_settings:
        mock_settings.slack_bot_token = None
        mock_settings.slack_channel_id = None
        notifier = SlackNotifier()
        task = make_task()
        # Should not raise
        import asyncio
        asyncio.get_event_loop().run_until_complete(notifier.notify_approval_required(task))
```

**Step 2: Run tests to confirm they fail**

```bash
cd ibm-bob-hackathon/backend
pytest tests/test_slack_notifier.py -v
```

Expected: `ImportError: cannot import name 'SlackNotifier'` — that's correct, the class doesn't exist yet.

---

### 🏗️ Step 3: Implement SlackNotifier

Create `backend/app/services/__init__.py` (empty):
```python
```

Create `backend/app/services/slack_notifier.py`:

```python
"""
Slack notification service — posts Block Kit messages for task approvals and completions.
"""
from typing import Any, Dict, List
from slack_sdk.web.async_client import AsyncWebClient
from slack_sdk.errors import SlackApiError
import structlog

from app.core.config import settings

logger = structlog.get_logger()

_TASK_TYPE_EMOJI = {
    "triage": "🚨",
    "runbook": "📖",
    "pr_review": "🔍",
    "documentation": "📝",
}


class SlackNotifier:
    """Posts Slack messages with approve/reject buttons for human-in-the-loop tasks."""

    def __init__(self):
        self._client = (
            AsyncWebClient(token=settings.slack_bot_token)
            if settings.slack_bot_token
            else None
        )
        self._channel = getattr(settings, "slack_channel_id", None)
        self.logger = logger.bind(service="SlackNotifier")

    def _build_approval_blocks(self, task: Dict[str, Any]) -> List[Dict]:
        emoji = _TASK_TYPE_EMOJI.get(task["task_type"], "🤖")
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} DevOps Autopilot — Approval Required",
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Task:*\n{task['title']}"},
                    {"type": "mrkdwn", "text": f"*Type:*\n`{task['task_type']}`"},
                    {"type": "mrkdwn", "text": f"*Task ID:*\n`{task['id']}`"},
                    {"type": "mrkdwn", "text": "*Status:*\n⏳ Awaiting your approval"},
                ],
            },
            {
                "type": "actions",
                "block_id": "approval_actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "✅ Approve"},
                        "style": "primary",
                        "action_id": "approve_task",
                        "value": task["id"],
                    },
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "❌ Reject"},
                        "style": "danger",
                        "action_id": "reject_task",
                        "value": task["id"],
                    },
                ],
            },
        ]

    def _build_completion_blocks(self, task: Dict[str, Any]) -> List[Dict]:
        status = task["status"]
        if status == "completed":
            icon, label = "✅", "Completed"
        elif status == "failed":
            icon, label = "❌", "Failed"
        elif status == "rejected":
            icon, label = "🚫", "Rejected"
        else:
            icon, label = "ℹ️", status.replace("_", " ").title()

        fields = [
            {"type": "mrkdwn", "text": f"*Task:*\n{task['title']}"},
            {"type": "mrkdwn", "text": f"*Type:*\n`{task['task_type']}`"},
            {"type": "mrkdwn", "text": f"*Status:*\n{icon} {label}"},
            {"type": "mrkdwn", "text": f"*Task ID:*\n`{task['id']}`"},
        ]
        if task.get("error"):
            fields.append({"type": "mrkdwn", "text": f"*Error:*\n`{task['error']}`"})

        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{icon} DevOps Autopilot — Task {label}",
                },
            },
            {"type": "section", "fields": fields},
        ]

    async def notify_approval_required(self, task: Dict[str, Any]) -> None:
        if not self._client or not self._channel:
            self.logger.warning("slack_not_configured_skipping_approval_notification")
            return
        try:
            blocks = self._build_approval_blocks(task)
            await self._client.chat_postMessage(
                channel=self._channel,
                text=f"⏳ Approval required: {task['title']}",
                blocks=blocks,
            )
            self.logger.info("slack_approval_notification_sent", task_id=task["id"])
        except SlackApiError as e:
            self.logger.error("slack_api_error", error=str(e), task_id=task["id"])

    async def notify_task_complete(self, task: Dict[str, Any]) -> None:
        if not self._client or not self._channel:
            self.logger.warning("slack_not_configured_skipping_completion_notification")
            return
        try:
            blocks = self._build_completion_blocks(task)
            await self._client.chat_postMessage(
                channel=self._channel,
                text=f"Task update: {task['title']} — {task['status']}",
                blocks=blocks,
            )
            self.logger.info("slack_completion_notification_sent", task_id=task["id"])
        except SlackApiError as e:
            self.logger.error("slack_api_error", error=str(e), task_id=task["id"])


# Global instance
slack_notifier = SlackNotifier()

# Made with Bob
```

**Step 4: Add `slack_channel_id` to config**

Open `backend/app/core/config.py` and add one line inside the `# Slack Integration` block:

```python
# Slack Integration
slack_bot_token: Optional[str] = None
slack_signing_secret: Optional[str] = None
slack_channel_id: Optional[str] = None    # ← ADD THIS LINE
```

**Step 5: Run tests to confirm they pass**

```bash
cd ibm-bob-hackathon/backend
pytest tests/test_slack_notifier.py -v
```

Expected output:
```
PASSED tests/test_slack_notifier.py::test_build_approval_message_contains_task_id
PASSED tests/test_slack_notifier.py::test_build_approval_message_has_both_buttons
PASSED tests/test_slack_notifier.py::test_build_completion_message_shows_completed
PASSED tests/test_slack_notifier.py::test_build_completion_message_shows_failed
PASSED tests/test_slack_notifier.py::test_notify_approval_skips_gracefully_when_no_token
5 passed
```

---

## ✅ Task 2: Slack Webhook Handler

**Files:**
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/slack_webhook.py`
- Test: `backend/tests/test_slack_webhook.py`

---

### 🧪 Step 1: Write the failing tests

Create `backend/tests/test_slack_webhook.py`:

```python
"""Tests for Slack webhook handler — no live Slack calls."""
import json
import pytest
from urllib.parse import urlencode
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from datetime import datetime

from app.main import app, tasks_db
from app.models.task import Task, TaskType, TaskStatus


def _make_slack_payload(action_id: str, task_id: str, user: str = "U123BOB") -> str:
    """Build a URL-encoded Slack interactive payload string."""
    payload = {
        "type": "block_actions",
        "user": {"id": user, "username": "bob"},
        "actions": [
            {
                "action_id": action_id,
                "value": task_id,
                "block_id": "approval_actions",
            }
        ],
    }
    return urlencode({"payload": json.dumps(payload)})


def _seed_task(task_id: str, status: TaskStatus = TaskStatus.AWAITING_APPROVAL):
    tasks_db[task_id] = Task(
        id=task_id,
        task_type=TaskType.TRIAGE,
        title="Test incident",
        description="desc",
        status=status,
        requires_approval=True,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


client = TestClient(app)


def test_webhook_approve_action_marks_task_approved():
    task_id = "webhook-test-approve-001"
    _seed_task(task_id)
    body = _make_slack_payload("approve_task", task_id)
    response = client.post(
        "/api/v1/slack/webhook",
        content=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200
    assert tasks_db[task_id].status in (TaskStatus.APPROVED, TaskStatus.COMPLETED)


def test_webhook_reject_action_marks_task_rejected():
    task_id = "webhook-test-reject-002"
    _seed_task(task_id)
    body = _make_slack_payload("reject_task", task_id)
    response = client.post(
        "/api/v1/slack/webhook",
        content=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200
    assert tasks_db[task_id].status == TaskStatus.REJECTED


def test_webhook_unknown_task_returns_200_with_error_text():
    body = _make_slack_payload("approve_task", "nonexistent-task-id-xyz")
    response = client.post(
        "/api/v1/slack/webhook",
        content=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    # Must return 200 — Slack retries on non-200 responses and spams you
    assert response.status_code == 200
    assert "not found" in response.json().get("text", "").lower()


def test_webhook_ignores_non_block_actions():
    payload = urlencode({"payload": json.dumps({"type": "shortcut"})})
    response = client.post(
        "/api/v1/slack/webhook",
        content=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200
```

**Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_slack_webhook.py -v
```

Expected: `404 Not Found` on the webhook route — correct, it doesn't exist yet.

---

### 🏗️ Step 3: Implement the webhook handler

Create `backend/app/api/__init__.py` (empty):
```python
```

Create `backend/app/api/slack_webhook.py`:

```python
"""
Slack webhook receiver — handles interactive button payloads (approve/reject).
"""
import json
from urllib.parse import unquote_plus
from datetime import datetime
from fastapi import APIRouter, Request, Response
import structlog

from app.models.task import TaskStatus
from app.main import tasks_db

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1/slack", tags=["slack"])


@router.post("/webhook")
async def slack_webhook(request: Request):
    """
    Receive Slack interactive component payloads.
    Slack sends application/x-www-form-urlencoded with a 'payload' field.
    MUST return HTTP 200 immediately — Slack retries on anything else.
    """
    body = await request.body()
    body_str = body.decode("utf-8")

    # Parse URL-encoded body to extract payload JSON
    payload_str = None
    for part in body_str.split("&"):
        if part.startswith("payload="):
            payload_str = unquote_plus(part[len("payload="):])
            break

    if not payload_str:
        return {"text": "no payload"}

    try:
        payload = json.loads(payload_str)
    except json.JSONDecodeError:
        logger.error("slack_webhook_invalid_json")
        return {"text": "invalid payload"}

    # Only handle block_actions (button clicks)
    if payload.get("type") != "block_actions":
        return {"text": "ignored"}

    actions = payload.get("actions", [])
    if not actions:
        return {"text": "no actions"}

    action = actions[0]
    action_id = action.get("action_id")
    task_id = action.get("value")
    slack_user = payload.get("user", {}).get("username", "slack-user")

    logger.info("slack_action_received", action_id=action_id, task_id=task_id, user=slack_user)

    if task_id not in tasks_db:
        logger.warning("slack_webhook_task_not_found", task_id=task_id)
        return {"text": f"task {task_id} not found"}

    task = tasks_db[task_id]

    if task.status != TaskStatus.AWAITING_APPROVAL:
        return {"text": f"task already {task.status}"}

    if action_id == "approve_task":
        task.status = TaskStatus.APPROVED
        task.approved_by = slack_user
        task.approved_at = datetime.now()
        task.updated_at = datetime.now()
        logger.info("task_approved_via_slack", task_id=task_id, approved_by=slack_user)
        return {"text": f"✅ Task approved by @{slack_user}"}

    elif action_id == "reject_task":
        task.status = TaskStatus.REJECTED
        task.approved_by = slack_user
        task.approved_at = datetime.now()
        task.updated_at = datetime.now()
        logger.info("task_rejected_via_slack", task_id=task_id, rejected_by=slack_user)
        return {"text": f"🚫 Task rejected by @{slack_user}"}

    return {"text": "unknown action"}

# Made with Bob
```

**Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_slack_webhook.py -v
```

Expected:
```
PASSED tests/test_slack_webhook.py::test_webhook_approve_action_marks_task_approved
PASSED tests/test_slack_webhook.py::test_webhook_reject_action_marks_task_rejected
PASSED tests/test_slack_webhook.py::test_webhook_unknown_task_returns_200_with_error_text
PASSED tests/test_slack_webhook.py::test_webhook_ignores_non_block_actions
4 passed
```

---

## ✅ Task 3: Wire Notifier into main.py

**Files:**
- Modify: `backend/app/main.py`

No new tests needed — the existing webhook tests already exercise the wired-up flow.

---

### 🏗️ Step 1: Add imports to main.py

Open `backend/app/main.py`. At the top, add these two imports after the existing imports:

```python
from app.services.slack_notifier import slack_notifier
from app.api.slack_webhook import router as slack_router
```

### 🏗️ Step 2: Register the webhook router

Find this line in `main.py` (around line 53, after the CORS middleware block):

```python
app.add_middleware(
    CORSMiddleware,
    ...
)
```

Directly after it, add:

```python
# Register Slack webhook router
app.include_router(slack_router)
```

### 🏗️ Step 3: Fire notification in process_task_async

Find the `process_task_async` function (around line 336). Replace it with:

```python
async def process_task_async(
    task_id: str,
    task_type: TaskType,
    input_data: dict
):
    """Process task asynchronously through orchestrator."""
    try:
        result = await orchestrator.process_task(task_id, task_type, input_data)

        if task_id in tasks_db:
            task = tasks_db[task_id]
            task.status = result["status"]
            task.result = result.get("results")
            task.error = result.get("error")
            task.assigned_agent = result.get("current_agent")
            task.updated_at = datetime.now()

            task_dict = task.dict()

            if task.status == TaskStatus.AWAITING_APPROVAL:
                await slack_notifier.notify_approval_required(task_dict)
            elif task.status in (TaskStatus.COMPLETED, TaskStatus.FAILED):
                await slack_notifier.notify_task_complete(task_dict)

    except Exception as e:
        logger.error("task_processing_failed", task_id=task_id, error=str(e))
        if task_id in tasks_db:
            task = tasks_db[task_id]
            task.status = TaskStatus.FAILED
            task.error = str(e)
            task.updated_at = datetime.now()
            await slack_notifier.notify_task_complete(task.dict())
```

### 🏗️ Step 4: Fire notification in finalize_task

Find `finalize_task` (around line 363). Replace it with:

```python
async def finalize_task(task_id: str):
    """Finalize an approved task."""
    if task_id in tasks_db:
        task = tasks_db[task_id]
        task.status = TaskStatus.COMPLETED
        task.updated_at = datetime.now()
        logger.info("task_finalized", task_id=task_id)
        await slack_notifier.notify_task_complete(task.dict())
```

---

## ✅ Task 4: Run All Tests + Smoke Test

### 🧪 Step 1: Run the full test suite

```bash
cd ibm-bob-hackathon/backend
pytest tests/test_slack_notifier.py tests/test_slack_webhook.py -v
```

Expected:
```
PASSED tests/test_slack_notifier.py::test_build_approval_message_contains_task_id
PASSED tests/test_slack_notifier.py::test_build_approval_message_has_both_buttons
PASSED tests/test_slack_notifier.py::test_build_completion_message_shows_completed
PASSED tests/test_slack_notifier.py::test_build_completion_message_shows_failed
PASSED tests/test_slack_notifier.py::test_notify_approval_skips_gracefully_when_no_token
PASSED tests/test_slack_webhook.py::test_webhook_approve_action_marks_task_approved
PASSED tests/test_slack_webhook.py::test_webhook_reject_action_marks_task_rejected
PASSED tests/test_slack_webhook.py::test_webhook_unknown_task_returns_200_with_error_text
PASSED tests/test_slack_webhook.py::test_webhook_ignores_non_block_actions
9 passed
```

### 🚀 Step 2: Smoke test — full live flow

**Start the server:**
```bash
cd ibm-bob-hackathon/backend
uvicorn app.main:app --reload --port 8000
```

**In another terminal, start ngrok:**
```bash
ngrok http 8000
# Copy the https URL, e.g. https://abc123.ngrok.io
```

**Set the Slack webhook URL** in your Slack app:
- Interactivity & Shortcuts → Request URL → `https://abc123.ngrok.io/api/v1/slack/webhook`
- Save Changes

**Fire a triage request:**
```bash
curl -s -X POST http://localhost:8000/api/v1/incidents/triage \
  -H "Content-Type: application/json" \
  -d '{
    "title": "high cpu usage at server-prod-01",
    "description": "payment service error rate just crossed 5%",
    "source": "prometheus"
  }' | python -m json.tool
```

Expected response:
```json
{
  "task_id": "some-uuid-here",
  "status": "pending",
  "message": "Incident triage task created and processing"
}
```

**Within ~10 seconds you should see in Slack:**
```
🚨 DevOps Autopilot — Approval Required
Task: high cpu usage at server-prod-01
Type: triage   Task ID: some-uuid-here
Status: ⏳ Awaiting your approval
[ ✅ Approve ]  [ ❌ Reject ]
```

**Click ✅ Approve in Slack.**

Slack posts back to your webhook. Check the task status:
```bash
curl http://localhost:8000/api/v1/tasks/<task-id-from-above> | python -m json.tool
```

Expected: `"status": "completed"`

---

## 🗂️ What Was Built — Summary

```
backend/app/
├── services/
│   ├── __init__.py                  ← NEW
│   └── slack_notifier.py            ← NEW — Block Kit messages + approval/completion posts
├── api/
│   ├── __init__.py                  ← NEW
│   └── slack_webhook.py             ← NEW — receives button click, approves/rejects task
└── main.py                          ← MODIFIED — imports notifier + router, fires notifications

backend/tests/
├── test_slack_notifier.py           ← NEW — 5 tests, no live Slack
└── test_slack_webhook.py            ← NEW — 4 tests, no live Slack
```

**Total new tests: 9**
**Files created: 5**
**Files modified: 2**

---

> Made with Bob 🤖
