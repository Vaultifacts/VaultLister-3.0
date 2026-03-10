# Notion AI Control System — Workflow Guide

## Overview

This system creates a deterministic, closed control loop between the repository
and a Notion workspace. It is non-destructive, resilient to API outages, and
safe for continuous automation.

```
Repository change
       ↓
    git commit
       ↓
  post-commit hook
       ↓
  notion_sync.py        ← pushes repo metrics to Notion (PATCH-only)
       ↓
  Notion updated
       ↓
  notion_feedback.py    ← reads Notion → generated/notion_feedback.json
       ↓
  task_orchestrator.py  ← scores tasks → generated/next_task.json
       ↓
  AI executes next task
       ↓
  notion_ai_log.py      ← logs execution run to Notion database
       ↓
  (loop repeats)
```

---

## Three Layers in Notion

| Layer | Content | Affects completion % |
|-------|---------|---------------------|
| Layer 1 — Project Deliverables | Features, releases, tests, infrastructure | YES |
| Layer 2 — Gap Audit Findings   | Engineering improvement opportunities | NO |
| Layer 3 — Active Priorities    | Subset selected for execution | NO |

**Rule:** Completion percentage reflects Layer 1 only.
Layer 2 findings never reduce the completion score.

---

## Setup

### 1. Install Python dependencies

```sh
pip install -r tools/requirements.txt
```

### 2. Configure `.env`

Add these variables to your `.env`:

```dotenv
NOTION_SYNC_ENABLED=true
NOTION_INTEGRATION_TOKEN=ntn_...your_token...
NOTION_MAIN_PAGE_ID=2fc3f0ecf38280ad9128f7ca8b6d4704
NOTION_CHECKLIST_PAGE_ID=31d3f0ecf3828010b878de03ac961fc9
```

### 3. Share Notion pages with integration

In each Notion page (root, checklist, health dashboard, gap audit):
1. Click `...` (More) at top right
2. Click **Add connections**
3. Search for and select your integration name

### 4. Verify permissions

```sh
python tools/verify_permissions.py
```

### 5. Install post-commit hook

The Notion sync block must be appended to the existing `.husky/post-commit`
(which already handles STATUS.md logging and Bot commit review).

```sh
cat tools/post-commit.hook >> .husky/post-commit
```

Or manually append the contents to the end of `.husky/post-commit`.

---

## Running the Scripts

### Sync repo metrics to Notion

```sh
python tools/notion_sync.py             # live sync
python tools/notion_sync.py --dry-run   # preview changes, no API calls
python tools/notion_sync.py --audit     # print full block tree
```

### Read Notion feedback

```sh
python tools/notion_feedback.py
python tools/notion_feedback.py -v      # verbose
```

Output: `generated/notion_feedback.json`

### Select next task

```sh
python tools/task_orchestrator.py
python tools/task_orchestrator.py -v    # verbose scoring
```

Output: `generated/next_task.json`

### Log an AI execution run

```sh
python tools/notion_ai_log.py \
    --task "Implement feature X" \
    --status completed \
    --duration 300 \
    --notes "All tests passed"
```

---

## Task Scoring Model

| Category | Score |
|----------|-------|
| Design / Documentation / Strategy | 90 |
| Definition / Metrics | 75 |
| Testing / Harness | 70 |
| Refactor | 50 |
| Large system change | 30 |

Tasks are skipped if they are: blocked, high-risk, or unbounded.

Tie-breaking: priority → risk → impact → Notion order.

---

## Generated Files

All runtime artifacts land in `generated/` (git-ignored):

| File | Produced by | Consumed by |
|------|-------------|-------------|
| `generated/notion_feedback.json` | `notion_feedback.py` | `task_orchestrator.py` |
| `generated/next_task.json` | `task_orchestrator.py` | AI agent / manual review |
| `generated/.ai_log_db_id` | `notion_ai_log.py` | `notion_ai_log.py` (cache) |

---

## Safety Rules

- All scripts exit 0 on API failure — commits are never blocked
- `notion_sync.py` uses PATCH only — never recreates pages or duplicates blocks
- Block matching uses heading/label text anchors, not positional indexes
- Missing labels produce a warning and continue — never crash
- `generated/` is git-ignored — no secrets or tokens are ever committed

---

## Troubleshooting

### "NOTION_SYNC_ENABLED=false — skipping"
Set `NOTION_SYNC_ENABLED=true` in `.env`.

### "Could not read Notion page blocks: GET pages/... → 404"
The page ID in `.env` is wrong, or the integration hasn't been shared.
Run `python tools/verify_permissions.py` for exact instructions.

### "Label not found in page: 'Release Version' — skipping"
The Notion page doesn't have a block containing that label text.
Add a paragraph block with text `Release Version: ` to your Notion page.

### "Gap Audit database not found"
Create a Notion database titled exactly `Gap Audit` under your root page,
then share it with the integration.

### "No eligible tasks found"
All tasks in Layer 3 are either completed, blocked, or skipped by safety rules.
Add or unblock tasks in the Notion checklist page.

### Python dependency errors
```sh
pip install -r tools/requirements.txt
```

### Post-commit hook not running
Confirm the hook is executable and the Notion block was appended:
```sh
tail -10 .husky/post-commit
```
