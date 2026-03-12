"""
Verify that the Notion integration has access to all required resources.

Exit 0 — all checks passed
Exit 1 — one or more checks failed

Usage:
    python tools/verify_permissions.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from notion_config import (
    MAIN_PAGE_ID,
    CHECKLIST_PAGE_ID,
    NOTION_INTEGRATION_TOKEN,
    require_sync_enabled,
)
from notion_client import NotionClient

INTEGRATION_NAME = "VaultLister Sync"

RESOURCES = [
    ("Root page",        MAIN_PAGE_ID,      "page"),
    ("Checklist page",   CHECKLIST_PAGE_ID, "page"),
]

# Derived resource IDs discovered at runtime
_HEALTH_DASHBOARD_TITLE = "Health Dashboard"
_GAP_AUDIT_TITLE        = "Gap Audit"


def _check_page(client: NotionClient, label: str, page_id: str) -> tuple[bool, str]:
    try:
        client.get_page(page_id)
        return True, "OK"
    except RuntimeError as exc:
        msg = str(exc)
        if "404" in msg:
            return False, "Not found — share this page with the integration"
        if "403" in msg:
            return False, "Access denied — share with integration"
        return False, f"Error: {msg[:80]}"


def _search_for(client: NotionClient, title: str) -> tuple[bool, str, str]:
    """Search Notion for a page/database by title. Returns (found, id, status)."""
    try:
        results = client.search(title)
        for item in results.get("results", []):
            item_title = ""
            if item.get("object") == "database":
                title_parts = item.get("title", [])
                item_title = "".join(p.get("plain_text", "") for p in title_parts)
            elif item.get("object") == "page":
                props = item.get("properties", {})
                title_prop = props.get("title") or props.get("Name") or {}
                title_parts = title_prop.get("title", [])
                item_title = "".join(p.get("plain_text", "") for p in title_parts)
            if title.lower() in item_title.lower():
                return True, item["id"], "OK (found by search)"
        return False, "", "Not found — create this page/database in Notion"
    except RuntimeError as exc:
        return False, "", f"Search error: {str(exc)[:80]}"


def _fmt_row(label: str, id_: str, status: str, ok: bool) -> str:
    marker = "✓" if ok else "✗"
    id_display = id_[:8] + "…" if id_ else "—"
    return f"  {marker}  {label:<30}  {id_display:<12}  {status}"


def main():
    require_sync_enabled()

    client = NotionClient(NOTION_INTEGRATION_TOKEN)
    rows = []
    all_ok = True

    print("\nNotion Permission Check")
    print("=" * 70)

    # Static pages
    for label, page_id, _ in RESOURCES:
        ok, status = _check_page(client, label, page_id)
        if not ok:
            all_ok = False
        rows.append((label, page_id, status, ok))

    # Dynamic searches
    for title in [_HEALTH_DASHBOARD_TITLE, _GAP_AUDIT_TITLE]:
        found, found_id, status = _search_for(client, title)
        if not found:
            all_ok = False
        rows.append((title, found_id, status, found))

    # Print table
    print(f"\n  {'':2}  {'Resource':<30}  {'ID':<12}  Status")
    print(f"  {'':2}  {'-'*30}  {'-'*12}  {'-'*30}")
    for label, id_, status, ok in rows:
        print(_fmt_row(label, id_, status, ok))

    print()

    if not all_ok:
        print("ACTION REQUIRED:")
        print(f"  1. Open the Notion page in your browser.")
        print(f"  2. Click '...' (More) → 'Add connections'.")
        print(f"  3. Search for and add '{INTEGRATION_NAME}'.")
        print(f"  4. Re-run: python tools/verify_permissions.py")
        print()
        sys.exit(1)
    else:
        print("All checks passed. Integration has access to all required resources.")
        print()
        sys.exit(0)


if __name__ == "__main__":
    main()
