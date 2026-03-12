"""
One-time workspace initializer — populates Checklist, Health Dashboard, and Gap Audit.

Run once after verify_permissions.py passes. Safe to re-run: never duplicates blocks.

Usage:
    python tools/notion_workspace_init.py
    python tools/notion_workspace_init.py --dry-run
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from notion_config import MAIN_PAGE_ID, CHECKLIST_PAGE_ID, GENERATED_DIR, require_sync_enabled
from notion_client import NotionClient

# Resolved from the main page block tree
HEALTH_DASHBOARD_ID = "31f3f0ec-f382-80db-a9a6-ec258d82c3fb"
GAP_AUDIT_DB_ID     = "31f3f0ec-f382-804e-9356-edad7ac5f019"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(block: dict) -> str:
    btype = block.get("type", "")
    content = block.get(btype, {})
    parts = content.get("rich_text", []) or content.get("text", [])
    return "".join(p.get("plain_text", "") for p in parts)


def _label_exists(blocks: list, label: str) -> bool:
    label_lower = label.lower()
    return any(label_lower in _extract_text(b).lower() for b in blocks)


def _heading(text: str, level: int = 2) -> dict:
    htype = f"heading_{level}"
    return {
        "object": "block",
        "type": htype,
        htype: {"rich_text": [{"type": "text", "text": {"content": text}}]},
    }


def _paragraph(text: str) -> dict:
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": [{"type": "text", "text": {"content": text}}]},
    }


def _todo(text: str, checked: bool = False) -> dict:
    return {
        "object": "block",
        "type": "to_do",
        "to_do": {
            "rich_text": [{"type": "text", "text": {"content": text}}],
            "checked": checked,
        },
    }


def _bullet(text: str) -> dict:
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": text}}]},
    }


def _divider() -> dict:
    return {"object": "block", "type": "divider", "divider": {}}


# ---------------------------------------------------------------------------
# Health Dashboard
# ---------------------------------------------------------------------------

HEALTH_METRIC_LABELS = [
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


def init_health_dashboard(client: NotionClient, dry_run: bool):
    print("\n── Health Dashboard ──────────────────────────────────────────")
    try:
        blocks = client.get_all_block_children(HEALTH_DASHBOARD_ID)
    except RuntimeError as exc:
        print(f"  [warn] Cannot read Health Dashboard: {exc}")
        return

    children = []

    if not _label_exists(blocks, "Project Health"):
        children.append(_heading("Project Health", level=1))
        children.append(_paragraph("Auto-synced on every git commit via notion_sync.py"))
        children.append(_divider())
        children.append(_heading("Metrics", level=2))

    for label in HEALTH_METRIC_LABELS:
        if _label_exists(blocks, label):
            print(f"  [skip] Already exists: '{label}'")
        else:
            children.append(_paragraph(f"{label}: —"))
            print(f"  [create] '{label}'")

    if not children:
        print("  Health Dashboard already fully initialized.")
        return

    if dry_run:
        print(f"  [dry-run] Would append {len(children)} block(s)")
        return

    try:
        client.append_block_children(HEALTH_DASHBOARD_ID, children)
        print(f"  Appended {len(children)} block(s) to Health Dashboard.")
    except RuntimeError as exc:
        print(f"  [warn] Could not append to Health Dashboard: {exc}")


# ---------------------------------------------------------------------------
# Checklist page — Layer 1 / 2 / 3 structure
# ---------------------------------------------------------------------------

LAYER1_ITEMS = [
    "Inventory management",
    "Cross-listing to 9 platforms",
    "Poshmark automation (closet sharing, follow-back, offer rules)",
    "Offer management",
    "Sales tracking",
    "Analytics dashboard",
    "AI listing generation via Claude",
    "Image bank with AI tagging",
    "Chrome extension",
    "Authentication (JWT + MFA + OAuth)",
    "Docker deployment",
    "CI/CD pipeline (GitHub Actions)",
]

LAYER3_ITEMS = [
    "Design: define gap audit severity criteria",
    "Testing: improve E2E coverage for offer management",
    "Documentation: update API docs for new auth endpoints",
]


def init_checklist(client: NotionClient, dry_run: bool):
    print("\n── Checklist Page ────────────────────────────────────────────")
    try:
        blocks = client.get_all_block_children(CHECKLIST_PAGE_ID)
    except RuntimeError as exc:
        print(f"  [warn] Cannot read Checklist page: {exc}")
        return

    children = []

    # Layer 1
    if not _label_exists(blocks, "Layer 1"):
        children.append(_heading("Layer 1 — Project Deliverables", level=1))
        children.append(_paragraph(
            "Completion percentage is calculated from this section only. "
            "Check items as they are verified complete."
        ))
        for item in LAYER1_ITEMS:
            children.append(_todo(item, checked=False))
        children.append(_divider())
        print(f"  [create] Layer 1 section ({len(LAYER1_ITEMS)} items)")
    else:
        print("  [skip] Layer 1 already exists")

    # Layer 2
    if not _label_exists(blocks, "Layer 2"):
        children.append(_heading("Layer 2 — Gap Audit Findings", level=1))
        children.append(_paragraph(
            "Engineering improvement opportunities discovered during analysis. "
            "These NEVER reduce the completion percentage. "
            "Track findings in the Gap Audit database."
        ))
        children.append(_divider())
        print("  [create] Layer 2 section")
    else:
        print("  [skip] Layer 2 already exists")

    # Layer 3
    if not _label_exists(blocks, "Layer 3"):
        children.append(_heading("Layer 3 — Active Priorities", level=1))
        children.append(_paragraph(
            "Subset of improvements selected for execution. "
            "task_orchestrator.py scores these and selects the safest next task."
        ))
        for item in LAYER3_ITEMS:
            children.append(_todo(item, checked=False))
        children.append(_divider())
        children.append(_heading("Blockers", level=2))
        children.append(_paragraph("None"))
        print(f"  [create] Layer 3 section ({len(LAYER3_ITEMS)} starter items)")
    else:
        print("  [skip] Layer 3 already exists")

    if not children:
        print("  Checklist already fully initialized.")
        return

    if dry_run:
        print(f"  [dry-run] Would append {len(children)} block(s)")
        return

    try:
        client.append_block_children(CHECKLIST_PAGE_ID, children)
        print(f"  Appended {len(children)} block(s) to Checklist page.")
    except RuntimeError as exc:
        print(f"  [warn] Could not append to Checklist: {exc}")


# ---------------------------------------------------------------------------
# Gap Audit database — starter rows
# ---------------------------------------------------------------------------

STARTER_GAPS = [
    {"Domain": "Testing",       "Severity": "High",   "Finding": "E2E coverage missing for offer management flows"},
    {"Domain": "Documentation", "Severity": "Medium", "Finding": "API docs incomplete for auth endpoints"},
    {"Domain": "Performance",   "Severity": "Low",    "Finding": "No caching strategy defined for analytics queries"},
]


def init_gap_audit(client: NotionClient, dry_run: bool):
    print("\n── Gap Audit Database ────────────────────────────────────────")
    try:
        existing = client.query_database(GAP_AUDIT_DB_ID)
        existing_count = len(existing.get("results", []))
    except RuntimeError as exc:
        print(f"  [warn] Cannot query Gap Audit database: {exc}")
        return

    if existing_count > 0:
        print(f"  [skip] Gap Audit already has {existing_count} row(s) — not adding starters.")
        return

    if dry_run:
        print(f"  [dry-run] Would create {len(STARTER_GAPS)} starter rows")
        return

    created = 0
    for gap in STARTER_GAPS:
        props = {
            "Name": {"title": [{"type": "text", "text": {"content": gap["Finding"]}}]},
        }
        # Add Domain and Severity as select if they exist in the schema
        # (gracefully skip if schema doesn't have them yet)
        try:
            props["Domain"]   = {"select": {"name": gap["Domain"]}}
            props["Severity"] = {"select": {"name": gap["Severity"]}}
        except Exception:
            pass

        try:
            client.create_page(
                parent={"type": "database_id", "database_id": GAP_AUDIT_DB_ID},
                properties=props,
            )
            created += 1
            print(f"  [create] {gap['Domain']} / {gap['Severity']}: {gap['Finding'][:50]}")
        except RuntimeError as exc:
            print(f"  [warn] Could not create row: {exc}")

    print(f"  Added {created} starter row(s) to Gap Audit database.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    require_sync_enabled()

    parser = argparse.ArgumentParser(description="Initialize Notion workspace structure")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without API calls")
    args = parser.parse_args()

    os.makedirs(GENERATED_DIR, exist_ok=True)

    try:
        client = NotionClient()
    except Exception as exc:
        print(f"[warn] Could not create Notion client: {exc}")
        sys.exit(0)

    if args.dry_run:
        print("[dry-run] No changes will be made.\n")

    init_health_dashboard(client, dry_run=args.dry_run)
    init_checklist(client, dry_run=args.dry_run)
    init_gap_audit(client, dry_run=args.dry_run)

    print("\nWorkspace initialization complete.")
    print("Next: python tools/notion_sync.py  — to populate metrics in Health Dashboard")


if __name__ == "__main__":
    main()
