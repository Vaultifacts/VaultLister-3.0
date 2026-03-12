"""
Synchronize repository metrics to the Notion workspace.

Rules:
  - Non-destructive: PATCH-only, never recreate pages or duplicate blocks
  - Block matching by heading/label text — never by position index
  - If a label is missing: log warning, continue safely
  - API failure: print warning, exit 0 (never block commits)

Usage:
    python tools/notion_sync.py             # live sync
    python tools/notion_sync.py --dry-run   # print what would change, no API calls
    python tools/notion_sync.py --audit     # print full block tree of root page
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from notion_config import MAIN_PAGE_ID, GENERATED_DIR, require_sync_enabled
from notion_client import NotionClient

# ---------------------------------------------------------------------------
# Metric detection
# ---------------------------------------------------------------------------

def _detect_version() -> str | None:
    pkg = os.path.join(os.path.dirname(os.path.dirname(__file__)), "package.json")
    try:
        with open(pkg, encoding="utf-8") as f:
            data = json.load(f)
        return data.get("version")
    except Exception as exc:
        print(f"  [warn] version detection failed: {exc}")
        return None


def _detect_test_counts() -> dict | None:
    status_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "memory", "STATUS.md"
    )
    try:
        with open(status_path, encoding="utf-8") as f:
            content = f.read()
        import re
        e2e_match = re.search(r"E2E[^0-9]*(\d+)\s*pass[^0-9]*(\d+)\s*fail", content, re.IGNORECASE)
        unit_match = re.search(r"[Uu]nit[^0-9]*(\d+)\s*pass[^0-9]*(\d+)\s*fail", content, re.IGNORECASE)
        result = {}
        if e2e_match:
            result["e2e_pass"] = int(e2e_match.group(1))
            result["e2e_fail"] = int(e2e_match.group(2))
        if unit_match:
            result["unit_pass"] = int(unit_match.group(1))
            result["unit_fail"] = int(unit_match.group(2))
        return result if result else None
    except Exception as exc:
        print(f"  [warn] test count detection failed: {exc}")
        return None


def _detect_task_counts() -> dict | None:
    status_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "memory", "STATUS.md"
    )
    try:
        with open(status_path, encoding="utf-8") as f:
            content = f.read()
        import re
        open_tasks = len(re.findall(r"^\s*- \[ \]", content, re.MULTILINE))
        done_tasks = len(re.findall(r"^\s*- \[x\]", content, re.MULTILINE | re.IGNORECASE))
        return {"open": open_tasks, "done": done_tasks}
    except Exception as exc:
        print(f"  [warn] task count detection failed: {exc}")
        return None


def _detect_commit_stats() -> dict | None:
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--pretty=%h|%s|%ci"],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(os.path.dirname(__file__)),
        )
        if result.returncode != 0:
            return None
        parts = result.stdout.strip().split("|", 2)
        if len(parts) < 3:
            return None
        return {"hash": parts[0], "message": parts[1], "date": parts[2].strip()}
    except Exception as exc:
        print(f"  [warn] commit stats detection failed: {exc}")
        return None


def collect_metrics() -> dict:
    metrics = {}
    version = _detect_version()
    if version:
        metrics["version"] = version

    tests = _detect_test_counts()
    if tests:
        metrics.update(tests)

    tasks = _detect_task_counts()
    if tasks:
        metrics["open_tasks"] = tasks["open"]
        metrics["done_tasks"] = tasks["done"]

    commit = _detect_commit_stats()
    if commit:
        metrics["last_commit_hash"] = commit["hash"]
        metrics["last_commit_msg"] = commit["message"]
        metrics["last_commit_date"] = commit["date"]

    metrics["synced_at"] = datetime.now(timezone.utc).isoformat()
    return metrics


# ---------------------------------------------------------------------------
# Block tree utilities
# ---------------------------------------------------------------------------

def _extract_text(block: dict) -> str:
    """Extract plain text from any rich-text block."""
    btype = block.get("type", "")
    content = block.get(btype, {})
    parts = content.get("rich_text", []) or content.get("text", [])
    return "".join(p.get("plain_text", "") for p in parts)


def print_block_tree(client: NotionClient, block_id: str, indent: int = 0):
    try:
        children = client.get_all_block_children(block_id)
    except RuntimeError as exc:
        print(f"{'  '*indent}[error reading children: {exc}]")
        return
    for block in children:
        btype = block.get("type", "unknown")
        text = _extract_text(block)
        print(f"{'  '*indent}[{btype}] {text[:80]!r}  (id={block['id'][:8]}…)")
        if block.get("has_children"):
            print_block_tree(client, block["id"], indent + 1)


# ---------------------------------------------------------------------------
# Block matching and update
# ---------------------------------------------------------------------------

def _find_block_by_label(blocks: list, label: str) -> dict | None:
    """Return the first block whose plain text contains label (case-insensitive)."""
    label_lower = label.lower()
    for block in blocks:
        text = _extract_text(block).lower()
        if label_lower in text:
            return block
    return None


def _make_paragraph_update(text: str) -> dict:
    return {
        "paragraph": {
            "rich_text": [{"type": "text", "text": {"content": text}}]
        }
    }


_HEALTH_DASHBOARD_ID = "31f3f0ec-f382-80db-a9a6-ec258d82c3fb"


def sync_metrics(client: NotionClient, metrics: dict, dry_run: bool):
    """Update (PATCH) metric blocks on the Health Dashboard page."""
    try:
        blocks = client.get_all_block_children(_HEALTH_DASHBOARD_ID)
    except RuntimeError as exc:
        print(f"[warn] Could not read Health Dashboard blocks: {exc}")
        return

    sync_rows = [
        ("version",           metrics.get("version"),           "Release Version"),
        ("e2e_pass",          metrics.get("e2e_pass"),          "E2E Tests Passing"),
        ("e2e_fail",          metrics.get("e2e_fail"),          "E2E Tests Failing"),
        ("unit_pass",         metrics.get("unit_pass"),         "Unit Tests Passing"),
        ("open_tasks",        metrics.get("open_tasks"),        "Open Tasks"),
        ("done_tasks",        metrics.get("done_tasks"),        "Completed Tasks"),
        ("last_commit_hash",  metrics.get("last_commit_hash"),  "Last Commit"),
        ("last_commit_msg",   metrics.get("last_commit_msg"),   "Last Commit Message"),
        ("synced_at",         metrics.get("synced_at"),         "Last Synced"),
    ]

    for _key, value, label in sync_rows:
        if value is None:
            continue
        block = _find_block_by_label(blocks, label)
        if block is None:
            print(f"  [warn] Label not found in page: '{label}' — skipping")
            continue
        new_text = f"{label}: {value}"
        if dry_run:
            print(f"  [dry-run] Would update block {block['id'][:8]}… → {new_text!r}")
        else:
            try:
                client.update_block(block["id"], _make_paragraph_update(new_text))
                print(f"  [sync] Updated '{label}'")
            except RuntimeError as exc:
                print(f"  [warn] Could not update '{label}': {exc}")


# ---------------------------------------------------------------------------
# Init — create metric label blocks if missing
# ---------------------------------------------------------------------------

_METRIC_LABELS = [
    "Release Version",
    "E2E Tests Passing",
    "E2E Tests Failing",
    "Unit Tests Passing",
    "Open Tasks",
    "Completed Tasks",
    "Last Commit",
    "Last Commit Message",
    "Last Synced",
]


def init_metric_blocks(client: NotionClient, dry_run: bool, page_id: str = None):
    """Append any missing metric label blocks to the Health Dashboard. Never duplicates."""
    target = page_id or _HEALTH_DASHBOARD_ID
    try:
        blocks = client.get_all_block_children(target)
    except RuntimeError as exc:
        print(f"[warn] Could not read page blocks: {exc}")
        return

    to_create = []
    for label in _METRIC_LABELS:
        existing = _find_block_by_label(blocks, label)
        if existing:
            print(f"  [skip] Already exists: '{label}'")
        else:
            to_create.append(label)
            print(f"  [create] Missing: '{label}'")

    if not to_create:
        print("\nAll metric blocks already present — nothing to create.")
        return

    if dry_run:
        print(f"\n[dry-run] Would append {len(to_create)} block(s) — no API calls made.")
        return

    children = [
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": f"{label}: —"}}]
            },
        }
        for label in to_create
    ]

    try:
        client.append_block_children(target, children)
        print(f"\nAppended {len(to_create)} metric block(s) to Health Dashboard.")
    except RuntimeError as exc:
        print(f"[warn] Could not append blocks: {exc}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    require_sync_enabled()

    parser = argparse.ArgumentParser(description="Sync repo metrics to Notion")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without making API calls")
    parser.add_argument("--audit", action="store_true", help="Print full block tree of root page")
    parser.add_argument("--init", action="store_true", help="Create missing metric label blocks on the root page (run once)")
    args = parser.parse_args()

    os.makedirs(GENERATED_DIR, exist_ok=True)

    try:
        client = NotionClient()
    except Exception as exc:
        print(f"[warn] Could not create Notion client: {exc}")
        sys.exit(0)

    if args.audit:
        print(f"\nBlock tree for page {MAIN_PAGE_ID}:\n")
        print_block_tree(client, MAIN_PAGE_ID)
        sys.exit(0)

    if args.init:
        try:
            init_metric_blocks(client, dry_run=args.dry_run, page_id=_HEALTH_DASHBOARD_ID)
        except Exception as exc:
            print(f"[warn] Init failed: {exc}")
            sys.exit(0)
        sys.exit(0)

    metrics = collect_metrics()
    print(f"\nDetected metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")
    print()

    if args.dry_run:
        print("[dry-run] No API calls will be made.\n")

    try:
        sync_metrics(client, metrics, dry_run=args.dry_run)
    except Exception as exc:
        print(f"[warn] Sync failed: {exc}")
        sys.exit(0)

    print("\nSync complete." if not args.dry_run else "\nDry-run complete.")
    sys.exit(0)


if __name__ == "__main__":
    main()
