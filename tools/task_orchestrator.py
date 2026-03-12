"""
Select the safest next task from Notion feedback.

Input:   generated/notion_feedback.json
Output:  generated/next_task.json

Scoring model:
  Design / Documentation / Strategy  → 90
  Definition / Metrics               → 75
  Testing / Harness                  → 70
  Refactor                           → 50
  Large system change                → 30

Skip: blocked, high-risk, unbounded tasks.
Tie-break: priority → risk → impact → Notion order.

Usage:
    python tools/task_orchestrator.py
    python tools/task_orchestrator.py -v   # verbose scoring output
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from notion_config import GENERATED_DIR, require_sync_enabled

_INPUT_FILE  = os.path.join(GENERATED_DIR, "notion_feedback.json")
_OUTPUT_FILE = os.path.join(GENERATED_DIR, "next_task.json")

# ---------------------------------------------------------------------------
# Scoring rules
# ---------------------------------------------------------------------------

_PHASE_PATTERN = re.compile(r"\[P(\d+)-(\d+)\]", re.IGNORECASE)
_BLOCKED_PATTERNS = re.compile(r"\bblocked until\b", re.IGNORECASE)
_HIGH_RISK_PATTERNS = re.compile(r"\b(dangerous|destructive|irreversible|drop|delete all|wipe|nuclear|force push)\b", re.IGNORECASE)

_RISK_LABELS = {
    "blocked": "task is blocked on an external dependency",
    "high-risk": "task is flagged as high-risk or destructive",
}


def _score_task(title: str, index: int, blockers: list) -> tuple[float, str, bool]:
    """
    Primary sort: Notion order (phase then step number extracted from [Px-y] prefix).
    Score is used only to flag tasks that should be skipped.
    Returns (sort_key, rationale, should_skip).
    """
    # Hard skip: destructive actions
    if _HIGH_RISK_PATTERNS.search(title):
        return 9999, "high-risk", True

    # Soft skip: externally blocked (e.g. waiting for Etsy approval)
    # These appear in the list but the orchestrator notes them
    is_blocked = bool(_BLOCKED_PATTERNS.search(title))

    # Extract phase/step from [Px-y] prefix for deterministic ordering
    m = _PHASE_PATTERN.search(title)
    if m:
        phase, step = int(m.group(1)), int(m.group(2))
        sort_key = phase * 100 + step
        rationale = f"Phase {phase}, step {step}"
    else:
        # No phase tag — sort after all tagged tasks, use Notion order as tie-break
        sort_key = 9000 + index
        rationale = "no phase tag — appended after roadmap"

    if is_blocked:
        rationale += " (externally blocked — skip for now)"
        return sort_key, rationale, True

    return sort_key, rationale, False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    require_sync_enabled()

    parser = argparse.ArgumentParser(description="Select safest next task from Notion feedback")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    os.makedirs(GENERATED_DIR, exist_ok=True)

    if not os.path.exists(_INPUT_FILE):
        print(f"[error] {_INPUT_FILE} not found — run notion_feedback.py first")
        sys.exit(1)

    with open(_INPUT_FILE, encoding="utf-8") as f:
        feedback = json.load(f)

    priorities = feedback.get("active_priorities", [])
    blockers   = feedback.get("blockers", [])
    high_sev   = feedback.get("high_severity_domains", [])

    if args.verbose:
        print(f"\nLoaded {len(priorities)} active priorities, {len(blockers)} blockers")
        print(f"High-severity domains: {high_sev}\n")

    scored = []
    for i, task in enumerate(priorities):
        title = task.get("title", "")
        already_done = task.get("checked", False)
        if already_done:
            if args.verbose:
                print(f"  [skip] already completed: {title!r}")
            continue

        score, rationale, skip = _score_task(title, i, blockers)
        entry = {
            "title": title,
            "score": round(score, 2),
            "rationale": rationale,
            "skipped": skip,
            "notion_order": i,
        }
        scored.append(entry)
        if args.verbose:
            flag = "SKIP" if skip else f"score={score:.1f}"
            print(f"  [{flag}] {title!r}  — {rationale}")

    # Filter skipped
    candidates = [t for t in scored if not t["skipped"]]

    if not candidates:
        print("\n[warn] No eligible tasks found. Check active_priorities in Notion.")
        selected = None
        rationale = "No eligible tasks"
    else:
        # Sort by phase order (sort_key asc), then notion_order as tie-break
        candidates.sort(key=lambda t: (t["score"], t["notion_order"]))
        selected = candidates[0]
        rationale = selected["rationale"]
        print(f"\nSelected task: {selected['title']!r}  ({rationale})")

    output = {
        "selected_task": selected or {"title": None, "score": 0, "rationale": rationale},
        "all_scored": scored,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with open(_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Next task written to {_OUTPUT_FILE}")


if __name__ == "__main__":
    main()
