#!/usr/bin/env python3
"""
notion-qa-audit.py — Query and update QA Walkthrough Checklist items.

Uses Notion REST API with structured property filters (not semantic search)
to reliably find ALL items by Result status.

Usage:
  python scripts/notion-qa-audit.py audit
  python scripts/notion-qa-audit.py list Fail
  python scripts/notion-qa-audit.py list Issue
  python scripts/notion-qa-audit.py verify <page-id>
  python scripts/notion-qa-audit.py update <page-id> Pass --verified "Browser: description of evidence"
  python scripts/notion-qa-audit.py update <page-id> Issue "notes"
  python scripts/notion-qa-audit.py verify-log
  python scripts/notion-qa-audit.py sections
  python scripts/notion-qa-audit.py reset-all
  python scripts/notion-qa-audit.py list-section "1. Auth & Session"
  python scripts/notion-qa-audit.py list-empty

SAFEGUARD: Setting Result to Pass requires:
  1. A prior `verify <page-id>` call within the last 30 minutes
  2. The --verified flag
  3. Notes starting with an evidence prefix: Browser:, Console:, Curl:, or Test:

Requires: NOTION_TOKEN or NOTION_INTEGRATION_TOKEN in environment.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta

NOTION_VERSION = "2022-06-28"
TOKEN = os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_INTEGRATION_TOKEN", "")
QA_DB_ID = os.environ.get("NOTION_QA_DB_ID", "298e00f79d854a0fb97daabdfc199dbf")
QA_DB_ID_FALLBACK = "878a764b06144208934fbf13a5706f07"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERIFY_LOG = os.path.join(PROJECT_ROOT, ".notion-qa-verified.log")

VALID_RESULTS = {"Pass", "Fail", "Issue", "Skipped", "To Do"}
EVIDENCE_PREFIXES = ("Browser:", "Console:", "Curl:", "Test:")


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

    pattern = (props.get("Test Pattern", {}).get("select") or {}).get("name", "")

    test_steps_parts = props.get("Test Steps", {}).get("rich_text", [])
    test_steps = "".join(t.get("plain_text", "") for t in test_steps_parts)

    expected_parts = props.get("Expected Result", {}).get("rich_text", [])
    expected = "".join(t.get("plain_text", "") for t in expected_parts)

    return {
        "id": page_id,
        "num": num,
        "title": title,
        "result": result,
        "section": section,
        "severity": severity,
        "priority": priority,
        "notes": notes,
        "pattern": pattern,
        "test_steps": test_steps,
        "expected": expected,
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


def log_entry(action, page_id, detail):
    """Append a line to the verification audit log."""
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    line = f"{ts} | {action:6s} | {page_id} | {detail}\n"
    with open(VERIFY_LOG, "a", encoding="utf-8") as f:
        f.write(line)


def check_verify_step(page_id):
    """Check that a VERIFY entry for this page-id exists within the last 30 minutes."""
    if not os.path.exists(VERIFY_LOG):
        return False
    cutoff = datetime.now() - timedelta(minutes=30)
    with open(VERIFY_LOG, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split(" | ")
            if len(parts) < 3:
                continue
            if parts[1].strip() == "VERIFY" and parts[2].strip() == page_id:
                try:
                    entry_time = datetime.strptime(parts[0].strip(), "%Y-%m-%dT%H:%M:%S")
                    if entry_time >= cutoff:
                        return True
                except ValueError:
                    continue
    return False


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


def cmd_sections(db_id):
    """Show item counts by Section."""
    items = query_database(db_id)
    counts = {}
    for item in items:
        s = item["section"] or "(no section)"
        counts[s] = counts.get(s, 0) + 1

    print(f"\nQA Walkthrough — Sections ({len(items)} items total)\n")
    print(f"  {'Section':40s}  {'Count':>5s}")
    print(f"  {'-'*40}  {'-'*5}")
    for section, count in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
        print(f"  {section:40s}  {count:>5d}")
    print(f"\n  Total sections: {len(counts)}")
    print()


def cmd_reset_all(db_id):
    """Clear all items' Result to empty (with confirmation)."""
    items = query_database(db_id)
    non_empty = [i for i in items if i["result"]]

    if not non_empty:
        print("All items already have empty Result. Nothing to reset.")
        return

    print(f"\nAbout to clear Result for {len(non_empty)} items (out of {len(items)} total).")
    if "--yes" not in sys.argv:
        print("Type 'yes' to confirm (or pass --yes flag): ", end="", flush=True)
        answer = input().strip().lower()
        if answer != "yes":
            print("Aborted.")
            return

    print(f"\nResetting {len(non_empty)} items...")
    for i, item in enumerate(non_empty, 1):
        url = f"https://api.notion.com/v1/pages/{item['id']}"
        api_request("PATCH", url, {"properties": {"Result": {"select": None}}})
        if i % 10 == 0 or i == len(non_empty):
            print(f"  {i}/{len(non_empty)} done")
        time.sleep(0.35)  # stay under Notion rate limits (~3 req/s)

    print(f"\nDone. {len(non_empty)} items reset to empty.")


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


def cmd_list_section(db_id, section_name):
    """List items with empty Result in a given section, sorted by #."""
    filter_obj = {
        "and": [
            {"property": "Section", "select": {"equals": section_name}},
            {"property": "Result", "select": {"is_empty": True}}
        ]
    }
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    body = {"page_size": 100, "filter": filter_obj, "sorts": [{"property": "#", "direction": "ascending"}]}
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

    print(f"\nSection: {section_name} — {len(items)} untested items\n")
    print(f"{'#':>4s}  {'Page ID':32s}  {'Pattern':20s}  {'Priority':8s}  Title")
    print("-" * 110)
    for item in items:
        print(f"{item['num']:4.0f}  {item['id']:32s}  {item.get('pattern','')[:20]:20s}  {item['priority']:8s}  {item['title'][:60]}")
    print()


def cmd_list_empty(db_id):
    """List all items with empty Result, sorted by #."""
    filter_obj = {"property": "Result", "select": {"is_empty": True}}
    url = f"https://api.notion.com/v1/databases/{db_id}/query"
    body = {"page_size": 100, "filter": filter_obj, "sorts": [{"property": "#", "direction": "ascending"}]}
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

    print(f"\nUntested items (empty Result): {len(items)}\n")
    print(f"{'#':>4s}  {'Page ID':32s}  {'Section':30s}  Title")
    print("-" * 110)
    for item in items:
        print(f"{item['num']:4.0f}  {item['id']:32s}  {item['section'][:30]:30s}  {item['title'][:50]}")
    print()


def cmd_verify(db_id, page_id):
    """Start a verification session for a page. Must be called before marking Pass."""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    page_data = api_request("GET", url)
    item = extract_item(page_data)

    print(f"\nVERIFY #{item['num']:.0f}: \"{item['title'][:60]}\"")
    print(f"  Section:  {item['section']}")
    print(f"  Severity: {item['severity']}")
    print(f"  Current:  {item['result']}")
    print(f"  Notes:    {item['notes'][:100]}")
    print(f"\n  → Test this item in the browser now.")
    print(f"  → Then run: notion-qa-audit.py update {page_id} Pass --verified \"Browser: <what you verified>\"")
    print()

    log_entry("VERIFY", page_id, item["title"][:80])
    print(f"  Logged to {VERIFY_LOG}")


def cmd_update(db_id, page_id, result, notes=None, verified=False):
    """Update a single page's Result and optionally Notes."""
    result = normalize_result(result)

    # SAFEGUARD: Pass requires 3 checks
    if result == "Pass":
        if not verified:
            print("ERROR: Pass updates require the --verified flag.", file=sys.stderr)
            print("  You must verify the fix in the browser before marking Pass.", file=sys.stderr)
            print(f"  Usage: notion-qa-audit.py update {page_id} Pass --verified \"Browser: <evidence>\"", file=sys.stderr)
            sys.exit(1)
        if not notes or not notes.lstrip().startswith(EVIDENCE_PREFIXES):
            print("ERROR: Pass notes must start with an evidence prefix.", file=sys.stderr)
            print(f"  Valid prefixes: {', '.join(EVIDENCE_PREFIXES)}", file=sys.stderr)
            print("  Example: --verified \"Browser: clicked all analytics tabs, content changed\"", file=sys.stderr)
            print("  Reasoning like 'Fixed by chunk fix' is NOT valid evidence.", file=sys.stderr)
            sys.exit(1)
        if not check_verify_step(page_id):
            print("ERROR: No verify step found for this page-id in the last 30 minutes.", file=sys.stderr)
            print(f"  Run first: notion-qa-audit.py verify {page_id}", file=sys.stderr)
            print("  Then test in browser, then mark Pass.", file=sys.stderr)
            sys.exit(1)

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

    # Log Pass updates for audit trail
    if result == "Pass":
        log_entry("PASS", page_id, notes[:100] if notes else "")


def cmd_verify_log():
    """Print the verification audit log."""
    if not os.path.exists(VERIFY_LOG):
        print("No verification log found.")
        return
    with open(VERIFY_LOG, "r", encoding="utf-8") as f:
        content = f.read()
    if not content.strip():
        print("Verification log is empty.")
        return
    print(f"\nVerification Log ({VERIFY_LOG}):\n")
    print(content)


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

    # Extract --verified flag from anywhere in argv
    verified = "--verified" in sys.argv
    argv_clean = [a for a in sys.argv if a != "--verified"]

    cmd = argv_clean[1].lower()
    db_id = resolve_db_id()

    if cmd == "audit":
        cmd_audit(db_id)
    elif cmd == "list":
        if len(argv_clean) < 3:
            print("Usage: notion-qa-audit.py list <status>", file=sys.stderr)
            sys.exit(1)
        cmd_list(db_id, argv_clean[2])
    elif cmd == "verify":
        if len(argv_clean) < 3:
            print("Usage: notion-qa-audit.py verify <page-id>", file=sys.stderr)
            sys.exit(1)
        cmd_verify(db_id, argv_clean[2])
    elif cmd == "update":
        if len(argv_clean) < 4:
            print("Usage: notion-qa-audit.py update <page-id> <result> [--verified] [notes]", file=sys.stderr)
            sys.exit(1)
        page_id = argv_clean[2]
        result = argv_clean[3]
        notes = argv_clean[4] if len(argv_clean) > 4 else None
        cmd_update(db_id, page_id, result, notes, verified)
    elif cmd in ("verify-log", "log"):
        cmd_verify_log()
    elif cmd == "sections":
        cmd_sections(db_id)
    elif cmd in ("reset-all", "reset"):
        cmd_reset_all(db_id)
    elif cmd in ("list-section", "section"):
        if len(argv_clean) < 3:
            print("Usage: notion-qa-audit.py list-section <section-name>", file=sys.stderr)
            sys.exit(1)
        cmd_list_section(db_id, argv_clean[2])
    elif cmd in ("list-empty", "empty"):
        cmd_list_empty(db_id)
    else:
        print(f"Unknown command: {cmd}", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
