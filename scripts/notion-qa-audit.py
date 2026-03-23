#!/usr/bin/env python3
"""
notion-qa-audit.py — Query and update QA Walkthrough Checklist items.

Uses Notion REST API with structured property filters (not semantic search)
to reliably find ALL items by Result status.

Usage:
  python scripts/notion-qa-audit.py audit
  python scripts/notion-qa-audit.py list Fail
  python scripts/notion-qa-audit.py list Issue
  python scripts/notion-qa-audit.py update <page-id> Pass "Fixed in commit abc123"

Requires: NOTION_TOKEN or NOTION_INTEGRATION_TOKEN in environment.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

NOTION_VERSION = "2022-06-28"
TOKEN = os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_INTEGRATION_TOKEN", "")
QA_DB_ID = os.environ.get("NOTION_QA_DB_ID", "298e00f79d854a0fb97daabdfc199dbf")
QA_DB_ID_FALLBACK = "878a764b06144208934fbf13a5706f07"

VALID_RESULTS = {"Pass", "Fail", "Issue", "Skipped", "To Do"}


def api_request(method, url, body=None):
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            retry_after = int(exc.headers.get("Retry-After", "2"))
            print(f"  Rate limited. Waiting {retry_after}s...", file=sys.stderr)
            time.sleep(retry_after)
            return api_request(method, url, body)
        body_text = ""
        try:
            body_text = exc.read().decode("utf-8", errors="replace")[:300]
        except Exception:
            pass
        raise RuntimeError(f"HTTP {exc.code}: {body_text}") from exc


def query_database(db_id, filter_obj=None):
    """Query all pages from the QA database, with optional filter. Handles pagination."""
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    body = {"page_size": 100}
    if filter_obj:
        body["filter"] = filter_obj

    items = []
    has_more = True
    start_cursor = None

    while has_more:
        if start_cursor:
            body["start_cursor"] = start_cursor
        result = api_request("POST", url, body)
        for page in result.get("results", []):
            items.append(extract_item(page))
        has_more = result.get("has_more", False)
        start_cursor = result.get("next_cursor")

    return items


def extract_item(page):
    """Extract properties from a Notion page into a flat dict."""
    props = page.get("properties", {})
    page_id = page["id"].replace("-", "")

    title_parts = props.get("Item", {}).get("title", [])
    title = "".join(t.get("plain_text", "") for t in title_parts)

    result = (props.get("Result", {}).get("select") or {}).get("name", "")
    section = (props.get("Section", {}).get("select") or {}).get("name", "")
    severity = (props.get("Severity", {}).get("select") or {}).get("name", "")
    priority = (props.get("Priority", {}).get("select") or {}).get("name", "")
    num = props.get("#", {}).get("number") or 0

    notes_parts = props.get("Notes", {}).get("rich_text", [])
    notes = "".join(t.get("plain_text", "") for t in notes_parts)

    return {
        "id": page_id,
        "num": num,
        "title": title,
        "result": result,
        "section": section,
        "severity": severity,
        "priority": priority,
        "notes": notes,
    }


def resolve_db_id():
    """Try primary DB ID, fall back to collection ID."""
    for db_id in [QA_DB_ID, QA_DB_ID_FALLBACK]:
        try:
            url = f"https://api.notion.com/v1/databases/{db_id}"
            api_request("GET", url)
            return db_id
        except RuntimeError as e:
            if "404" in str(e) or "400" in str(e):
                continue
            raise
    print("ERROR: Could not access QA Walkthrough database with either ID.", file=sys.stderr)
    print(f"  Tried: {QA_DB_ID}", file=sys.stderr)
    print(f"  Tried: {QA_DB_ID_FALLBACK}", file=sys.stderr)
    print("  Ensure the Notion integration is shared with the QA database.", file=sys.stderr)
    sys.exit(1)


def cmd_audit(db_id):
    """Show counts by Result status."""
    items = query_database(db_id)
    counts = {}
    for item in items:
        r = item["result"] or "(empty)"
        counts[r] = counts.get(r, 0) + 1

    print(f"\nQA Walkthrough Checklist — {len(items)} items\n")
    for status in ["Pass", "Fail", "Issue", "Skipped", "To Do", "(empty)"]:
        if status in counts:
            print(f"  {status:10s} {counts[status]:>4d}")
    print()


def cmd_list(db_id, status):
    """List all items with a given Result status."""
    status = normalize_result(status)
    filter_obj = {"property": "Result", "select": {"equals": status}}
    items = query_database(db_id, filter_obj)
    items.sort(key=lambda x: x["num"])

    print(f"\n{status} items: {len(items)}\n")
    print(f"{'#':>4s}  {'Page ID':32s}  {'Section':30s}  {'Sev':8s}  {'Title':40s}  Notes")
    print("-" * 140)
    for item in items:
        title = item["title"][:40]
        notes = item["notes"][:60].replace("\n", " ")
        section = item["section"][:30]
        sev = item["severity"][:8]
        print(f"{item['num']:4.0f}  {item['id']:32s}  {section:30s}  {sev:8s}  {title:40s}  {notes}")
    print()


def cmd_update(db_id, page_id, result, notes=None):
    """Update a single page's Result and optionally Notes."""
    result = normalize_result(result)
    url = f"https://api.notion.com/v1/pages/{page_id}"
    props = {"Result": {"select": {"name": result}}}
    if notes is not None:
        props["Notes"] = {"rich_text": [{"text": {"content": notes}}]}

    payload = {"properties": props}
    api_request("PATCH", url, payload)

    # Fetch updated page to confirm
    page_data = api_request("GET", url)
    item = extract_item(page_data)
    print(f"Updated: #{item['num']:.0f} \"{item['title'][:50]}\" → {result}")


def normalize_result(s):
    """Normalize result string to match Notion select options."""
    mapping = {
        "pass": "Pass", "fail": "Fail", "issue": "Issue",
        "skipped": "Skipped", "skip": "Skipped",
        "to do": "To Do", "todo": "To Do",
    }
    normalized = mapping.get(s.lower().strip(), s)
    if normalized not in VALID_RESULTS:
        print(f"ERROR: Invalid result '{s}'. Must be one of: {', '.join(sorted(VALID_RESULTS))}", file=sys.stderr)
        sys.exit(1)
    return normalized


def main():
    if not TOKEN:
        print("ERROR: NOTION_TOKEN or NOTION_INTEGRATION_TOKEN not set.", file=sys.stderr)
        print("  Set it in .env or export it: export NOTION_TOKEN=ntn_...", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1].lower()
    db_id = resolve_db_id()

    if cmd == "audit":
        cmd_audit(db_id)
    elif cmd == "list":
        if len(sys.argv) < 3:
            print("Usage: notion-qa-audit.py list <status>", file=sys.stderr)
            sys.exit(1)
        cmd_list(db_id, sys.argv[2])
    elif cmd == "update":
        if len(sys.argv) < 4:
            print("Usage: notion-qa-audit.py update <page-id> <result> [notes]", file=sys.stderr)
            sys.exit(1)
        page_id = sys.argv[2]
        result = sys.argv[3]
        notes = sys.argv[4] if len(sys.argv) > 4 else None
        cmd_update(db_id, page_id, result, notes)
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
