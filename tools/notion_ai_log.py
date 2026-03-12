"""
Log AI execution runs to a Notion database titled 'AI Execution Log'.

Database resolution order (cached to avoid repeated searches):
  1. Read generated/.ai_log_db_id
  2. Search Notion by database title
  3. Create database under root page only if absent

Usage:
    python tools/notion_ai_log.py \\
        --task "Implement X" \\
        --status "completed" \\
        --duration 120 \\
        --notes "All tests passed"
"""

import argparse
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from notion_config import MAIN_PAGE_ID, GENERATED_DIR, require_sync_enabled
from notion_client import NotionClient

_DB_TITLE = "AI Execution Log"
_CACHE_FILE = os.path.join(GENERATED_DIR, ".ai_log_db_id")

_STATUS_OPTIONS = ["completed", "failed", "in_progress", "skipped"]


# ---------------------------------------------------------------------------
# Database resolution
# ---------------------------------------------------------------------------

def _read_cached_id() -> str | None:
    try:
        with open(_CACHE_FILE, encoding="utf-8") as f:
            db_id = f.read().strip()
        return db_id if db_id else None
    except FileNotFoundError:
        return None


def _write_cached_id(db_id: str):
    os.makedirs(GENERATED_DIR, exist_ok=True)
    with open(_CACHE_FILE, "w", encoding="utf-8") as f:
        f.write(db_id)


def _search_for_db(client: NotionClient) -> str | None:
    try:
        results = client.search(
            _DB_TITLE,
            filter={"value": "database", "property": "object"},
        )
        for item in results.get("results", []):
            if item.get("object") != "database":
                continue
            title_parts = item.get("title", [])
            title = "".join(p.get("plain_text", "") for p in title_parts)
            if _DB_TITLE.lower() in title.lower():
                return item["id"]
    except RuntimeError as exc:
        print(f"[warn] Search for AI log database failed: {exc}")
    return None


def _create_db(client: NotionClient) -> str:
    properties = {
        "Task": {"title": {}},
        "Status": {
            "select": {
                "options": [{"name": s} for s in _STATUS_OPTIONS]
            }
        },
        "Duration (s)": {"number": {"format": "number"}},
        "Timestamp": {"date": {}},
        "Notes": {"rich_text": {}},
    }
    title = [{"type": "text", "text": {"content": _DB_TITLE}}]
    parent = {"type": "page_id", "page_id": MAIN_PAGE_ID}
    result = client.create_database(parent=parent, title=title, properties=properties)
    return result["id"]


def resolve_db_id(client: NotionClient) -> str:
    """Return the AI Execution Log database ID, creating it if needed."""
    # 1. Cache
    cached = _read_cached_id()
    if cached:
        return cached

    # 2. Search
    found = _search_for_db(client)
    if found:
        _write_cached_id(found)
        return found

    # 3. Create
    print(f"[info] Creating '{_DB_TITLE}' database under root page…")
    db_id = _create_db(client)
    _write_cached_id(db_id)
    print(f"[info] Created database: {db_id}")
    return db_id


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def log_run(client: NotionClient, db_id: str, task: str, status: str, duration: int | None, notes: str):
    now_iso = datetime.now(timezone.utc).isoformat()

    properties = {
        "Task": {"title": [{"type": "text", "text": {"content": task}}]},
        "Status": {"select": {"name": status}},
        "Timestamp": {"date": {"start": now_iso}},
        "Notes": {"rich_text": [{"type": "text", "text": {"content": notes or ""}}]},
    }
    if duration is not None:
        properties["Duration (s)"] = {"number": duration}

    parent = {"type": "database_id", "database_id": db_id}
    client.create_page(parent=parent, properties=properties)
    print(f"[log] Run logged: task={task!r} status={status!r} duration={duration}s")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    require_sync_enabled()

    parser = argparse.ArgumentParser(description="Log an AI execution run to Notion")
    parser.add_argument("--task",     required=True, help="Task description")
    parser.add_argument("--status",   required=True, choices=_STATUS_OPTIONS, help="Execution status")
    parser.add_argument("--duration", type=int, default=None, help="Duration in seconds")
    parser.add_argument("--notes",    default="", help="Additional notes")
    args = parser.parse_args()

    os.makedirs(GENERATED_DIR, exist_ok=True)

    try:
        client = NotionClient()
    except Exception as exc:
        print(f"[warn] Could not create Notion client: {exc}")
        sys.exit(0)

    try:
        db_id = resolve_db_id(client)
        log_run(client, db_id, args.task, args.status, args.duration, args.notes)
    except RuntimeError as exc:
        print(f"[warn] Failed to log run: {exc}")
        sys.exit(0)


if __name__ == "__main__":
    main()
