"""
Read Notion workspace and produce machine-readable project feedback.

Reads:
  - Checklist page: Layer 1 completion, Layer 3 priorities, blockers
  - Gap audit database: domain gap counts, severity

Outputs:
  generated/notion_feedback.json

Usage:
    python tools/notion_feedback.py
    python tools/notion_feedback.py -v   # verbose output
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from notion_config import CHECKLIST_PAGE_ID, MAIN_PAGE_ID, GENERATED_DIR, require_sync_enabled
from notion_client import NotionClient

_OUTPUT_FILE = os.path.join(GENERATED_DIR, "notion_feedback.json")
_GAP_AUDIT_TITLE = "Gap Audit"


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------

def _plain_text(rich_text: list) -> str:
    return "".join(p.get("plain_text", "") for p in rich_text)


def _block_text(block: dict) -> str:
    btype = block.get("type", "")
    content = block.get(btype, {})
    return _plain_text(content.get("rich_text", []))


def _is_checked(block: dict) -> bool:
    return block.get("to_do", {}).get("checked", False)


# ---------------------------------------------------------------------------
# Checklist page parsing
# ---------------------------------------------------------------------------

def _parse_checklist(client: NotionClient, verbose: bool) -> dict:
    result = {
        "layer1_percent": 0,
        "total_items": 0,
        "completed_items": 0,
    }
    active_priorities = []
    blockers = []

    try:
        blocks = client.get_all_block_children(CHECKLIST_PAGE_ID)
    except RuntimeError as exc:
        print(f"[warn] Could not read checklist page: {exc}")
        return result, active_priorities, blockers

    # Unified parser — all to_do items across all phases count toward completion
    in_task_area = False
    in_milestones = False
    in_blockers = False
    total = 0
    done = 0

    for block in blocks:
        btype = block.get("type", "")
        text = _block_text(block).strip()
        text_lower = text.lower()

        if btype in ("heading_1", "heading_2", "heading_3"):
            if "completed milestone" in text_lower:
                in_milestones, in_blockers, in_task_area = True, False, False
            elif "blocker" in text_lower:
                in_blockers, in_milestones, in_task_area = True, False, False
            else:
                # Phase headings and any other headings = task area
                in_task_area, in_milestones, in_blockers = True, False, False
            if verbose:
                print(f"  [heading] {text!r}  tasks={in_task_area} milestones={in_milestones} blockers={in_blockers}")
            continue

        # Collect all to_do items in the task area (covers Phase 1–8 + any additions)
        if in_task_area and btype == "to_do" and text:
            total += 1
            checked = _is_checked(block)
            if checked:
                done += 1
            active_priorities.append({"title": text, "checked": checked})

        # Blockers — paragraph and bullet items under Blockers heading
        if in_blockers and btype in ("bulleted_list_item", "numbered_list_item", "paragraph") and text:
            blockers.append(text)

    if total > 0:
        result["layer1_percent"] = round(done / total * 100, 1)
        result["total_items"] = total
        result["completed_items"] = done

    return result, active_priorities, blockers


# ---------------------------------------------------------------------------
# Gap audit database
# ---------------------------------------------------------------------------

def _find_gap_audit_db(client: NotionClient) -> str | None:
    try:
        results = client.search(_GAP_AUDIT_TITLE, filter={"value": "database", "property": "object"})
        for item in results.get("results", []):
            if item.get("object") == "database":
                title_parts = item.get("title", [])
                title = _plain_text(title_parts)
                if _GAP_AUDIT_TITLE.lower() in title.lower():
                    return item["id"]
    except RuntimeError as exc:
        print(f"[warn] Gap audit database search failed: {exc}")
    return None


def _parse_gap_audit(client: NotionClient, verbose: bool) -> tuple[dict, list, list]:
    """Returns (gap_summary, high_severity_domains, all_findings)."""
    gap_summary = {}
    high_severity = []
    all_findings = []

    db_id = _find_gap_audit_db(client)
    if not db_id:
        print("[warn] Gap Audit database not found — skipping gap analysis")
        return gap_summary, high_severity, all_findings

    try:
        rows = client.query_database(db_id)
    except RuntimeError as exc:
        print(f"[warn] Could not query gap audit database: {exc}")
        return gap_summary, high_severity, all_findings

    for row in rows.get("results", []):
        props = row.get("properties", {})

        # Extract name/title
        name_prop = props.get("Name") or props.get("Finding") or {}
        if name_prop.get("type") == "title":
            name = _plain_text(name_prop.get("title", []))
        else:
            name = ""

        # Extract domain
        domain_prop = props.get("Domain") or props.get("domain") or {}
        if domain_prop.get("type") == "select":
            domain = (domain_prop.get("select") or {}).get("name", "Unknown")
        elif domain_prop.get("type") == "rich_text":
            domain = _plain_text(domain_prop.get("rich_text", []))
        else:
            domain = "Unknown"

        # Extract severity
        sev_prop = props.get("Severity") or props.get("severity") or {}
        if sev_prop.get("type") == "select":
            severity = (sev_prop.get("select") or {}).get("name", "")
        else:
            severity = ""

        gap_summary[domain] = gap_summary.get(domain, 0) + 1
        if severity.lower() in ("high", "critical", "p0", "p1"):
            if domain not in high_severity:
                high_severity.append(domain)

        if name:
            all_findings.append({"name": name, "domain": domain, "severity": severity})

        if verbose:
            print(f"  [gap] domain={domain!r} severity={severity!r} name={name[:50]!r}")

    return gap_summary, high_severity, all_findings


def _promote_gap_findings(client: NotionClient, findings: list, existing_priorities: list, verbose: bool):
    """Append Gap Audit findings to Layer 3 if not already present."""
    import re as _re
    _strip_punct = lambda s: _re.sub(r"[^\w\s]", " ", s)
    existing_titles = {_strip_punct(p["title"].lower()) for p in existing_priorities}
    to_add = []

    for f in findings:
        label = f"[GAP/{f['severity'].upper()}] {f['domain']}: {f['name']}"
        # Skip if key words from finding name already appear in any existing task
        finding_words = set(w for w in _strip_punct(f["name"].lower()).split() if len(w) >= 4)
        # Also include domain keyword for broader matching
        domain_word = _strip_punct(f["domain"].lower())
        # Require 1 match if finding has ≤1 significant words, else require 2
        threshold = 1 if len(finding_words) <= 1 else 2
        already_present = any(
            len(finding_words & set(t.split())) >= threshold or domain_word in t
            for t in existing_titles
        )
        if already_present:
            if verbose:
                print(f"  [gap-skip] Already in Layer 3: {f['name'][:50]!r}")
            continue
        to_add.append(label)

    if not to_add:
        if verbose:
            print("  [gap-promote] All Gap Audit findings already in Layer 3.")
        return []

    blocks = [
        {
            "object": "block",
            "type": "to_do",
            "to_do": {
                "rich_text": [{"type": "text", "text": {"content": title}}],
                "checked": False,
            },
        }
        for title in to_add
    ]

    # Insert before the Blockers section by appending to checklist page
    # (Blockers is at end — new gap items land just before it in practice)
    try:
        client.append_block_children(CHECKLIST_PAGE_ID, blocks)
        print(f"  [gap-promote] Added {len(to_add)} Gap Audit finding(s) to Layer 3.")
    except RuntimeError as exc:
        print(f"  [warn] Could not promote gap findings: {exc}")

    return to_add


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    require_sync_enabled()

    parser = argparse.ArgumentParser(description="Read Notion feedback → generated/notion_feedback.json")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    os.makedirs(GENERATED_DIR, exist_ok=True)

    try:
        client = NotionClient()
    except Exception as exc:
        print(f"[warn] Could not create Notion client: {exc}")
        sys.exit(0)

    if args.verbose:
        print(f"\nReading checklist page {CHECKLIST_PAGE_ID}…")

    try:
        completion_status, active_priorities, blockers = _parse_checklist(client, args.verbose)
    except Exception as exc:
        print(f"[warn] Checklist parse error: {exc}")
        completion_status = {"layer1_percent": 0, "total_items": 0, "completed_items": 0}
        active_priorities = []
        blockers = []

    if args.verbose:
        print(f"\nSearching for Gap Audit database…")

    try:
        gap_summary, high_severity_domains, all_findings = _parse_gap_audit(client, args.verbose)
    except Exception as exc:
        print(f"[warn] Gap audit parse error: {exc}")
        gap_summary = {}
        high_severity_domains = []
        all_findings = []

    # Auto-promote Gap Audit findings into Layer 3 if missing
    if all_findings:
        if args.verbose:
            print(f"\nChecking {len(all_findings)} Gap Audit finding(s) for Layer 3 promotion…")
        try:
            _promote_gap_findings(client, all_findings, active_priorities, args.verbose)
            # Re-read priorities after promotion so the feedback JSON is current
            completion_status, active_priorities, blockers = _parse_checklist(client, False)
        except Exception as exc:
            print(f"[warn] Gap promotion error: {exc}")

    feedback = {
        "completion_status": completion_status,
        "active_priorities": active_priorities,
        "blockers": blockers,
        "gap_summary": gap_summary,
        "high_severity_domains": high_severity_domains,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with open(_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(feedback, f, indent=2)

    print(f"\nFeedback written to {_OUTPUT_FILE}")
    if args.verbose:
        print(json.dumps(feedback, indent=2))


if __name__ == "__main__":
    main()
