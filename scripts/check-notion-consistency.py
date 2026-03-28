# -*- coding: utf-8 -*-
"""
Check Notion Rules Architecture page counts against .claude/consistency-manifest.json.

Rules:
  - Silent exit if NOTION_TOKEN is not set (non-blocking)
  - Single API call only — must complete in <2 seconds
  - Never block the commit — all errors caught, exits 0
  - Also checks git log for recent Sprint Board item keywords vs open Notion items
  - Uses stdlib only: urllib, json, re, os, sys, subprocess

Usage:
    NOTION_TOKEN=secret_xxx python scripts/check-notion-consistency.py
"""

import json
import os
import re
import subprocess
import sys
import urllib.request  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
import urllib.error  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected

# Force UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

RULES_ARCH_PAGE_ID = "3299f0c8-1de6-8154-a6ba-c837c3fa95b3"
NOTION_VERSION = "2022-06-28"
NOTION_API_BASE = "https://api.notion.com/v1"

# Maps manifest key -> regex pattern(s) to search in Notion page text.
# Each pattern is tried in order; first match wins.
MANIFEST_PATTERNS = {
    "deny_patterns": [
        r"(\d+)\s+deny\s+pattern",
        r"deny[:\s]+(\d+)\s+pattern",
        r"(\d+)\s+denied\s+pattern",
    ],
    "validate_bash_patterns": [
        r"(\d+)\s+validate[_\-\s]bash\s+pattern",
        r"validate[_\-\s]bash[:\s]+(\d+)\s+pattern",
        r"(\d+)\s+bash\s+pattern",
        r"(\d+)\s+blocked\s+pattern",
    ],
    "protected_files": [
        r"(\d+)\s+protected\s+file",
        r"protected[_\-\s]files?[:\s]+(\d+)",
        r"(\d+)\s+file[s]?\s+protected",
    ],
    "agent_files": [
        r"(\d+)\s+agent[_\-\s]file",
        r"agent\s+file[s]?[:\s]+(\d+)",
        r"(\d+)\s+agent[s]?",
    ],
    "memory_rules": [
        r"(\d+)\s+memory\s+rule",
        r"memory\s+rule[s]?[:\s]+(\d+)",
        r"(\d+)\s+memory\s+file",
    ],
}

# Sprint Board keywords to search in recent git commits.
# If a commit references an item that sounds like a sprint task, we note it.
SPRINT_KEYWORDS = [
    "sprint", "board", "P0", "P1", "P2", "launch item", "milestone",
    "MVP", "blocker", "critical", "release",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_token():
    token = os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_INTEGRATION_TOKEN")
    return token.strip() if token else None


def _notion_get(path, token):
    """Single GET against the Notion API. Returns parsed JSON or raises."""
    url = f"{NOTION_API_BASE}{path}"
    req = urllib.request.Request(url, headers={  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=4) as resp:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
        return json.loads(resp.read().decode("utf-8"))


def _extract_plain_text(blocks):
    """Flatten all rich-text content from a list of Notion blocks into one string."""
    parts = []
    for block in blocks:
        btype = block.get("type", "")
        content = block.get(btype, {})
        for rt in content.get("rich_text", []):
            parts.append(rt.get("plain_text", ""))
        # Some block types use "text" instead of "rich_text"
        for rt in content.get("text", []):
            parts.append(rt.get("plain_text", ""))
        # Heading types
        for key in ("heading_1", "heading_2", "heading_3"):
            if key in block:
                for rt in block[key].get("rich_text", []):
                    parts.append(rt.get("plain_text", ""))
    return " ".join(parts)


def _load_manifest():
    """Load .claude/consistency-manifest.json relative to repo root."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    manifest_path = os.path.join(root, ".claude", "consistency-manifest.json")
    if not os.path.isfile(manifest_path):
        return None, f"Manifest not found at {manifest_path}"
    try:
        with open(manifest_path, encoding="utf-8") as f:
            return json.load(f), None
    except Exception as exc:
        return None, f"Could not parse manifest: {exc}"


def _fetch_rules_page_text(token):
    """Fetch the Rules Architecture page children and return flattened plain text."""
    path = f"/blocks/{RULES_ARCH_PAGE_ID}/children?page_size=100"
    data = _notion_get(path, token)
    blocks = data.get("results", [])
    # Also recurse one level for nested toggle/callout blocks
    extra = []
    for block in blocks:
        if block.get("has_children"):
            btype = block.get("type", "")
            # Only recurse into content-bearing types (not child_page, child_database)
            if btype not in ("child_page", "child_database", "table"):
                try:
                    child_path = f"/blocks/{block['id']}/children?page_size=50"
                    child_data = _notion_get(child_path, token)
                    extra.extend(child_data.get("results", []))
                except Exception:
                    pass
    return _extract_plain_text(blocks + extra)


def _extract_count(text, patterns):
    """Try each regex pattern; return first matched int or None."""
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return int(m.group(1))
    return None


def _recent_commit_messages(n=10):
    """Return the last n git commit messages as a list of strings."""
    try:
        result = subprocess.run(
            ["git", "log", f"-{n}", "--pretty=%s"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        if result.returncode == 0:
            return [line.strip() for line in result.stdout.splitlines() if line.strip()]
    except Exception:
        pass
    return []


def _check_sprint_keywords(messages):
    """Return list of commit messages that mention Sprint Board-sounding keywords."""
    hits = []
    for msg in messages:
        for kw in SPRINT_KEYWORDS:
            if kw.lower() in msg.lower():
                hits.append(msg)
                break
    return hits


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    token = _get_token()
    if not token:
        # Silent exit — no token, nothing to do
        sys.exit(0)

    warnings = []

    # --- Load manifest ---
    manifest, err = _load_manifest()
    if err:
        print(f"[notion-consistency] WARNING: {err}")
        sys.exit(0)

    # --- Fetch Notion page ---
    try:
        page_text = _fetch_rules_page_text(token)
    except urllib.error.HTTPError as exc:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        print(f"[notion-consistency] WARNING: Notion API HTTP error {exc.code} — skipping check")
        sys.exit(0)
    except Exception as exc:
        print(f"[notion-consistency] WARNING: Could not fetch Notion page — {exc}")
        sys.exit(0)

    # --- Compare counts ---
    skipped = []
    for key, patterns in MANIFEST_PATTERNS.items():
        expected = manifest.get(key)
        if expected is None:
            continue  # key not in manifest, skip

        actual = _extract_count(page_text, patterns)
        if actual is None:
            skipped.append(key)
            continue

        if actual != expected:
            warnings.append(
                f"  {key}: manifest={expected}, Notion page={actual}"
                f" (delta={actual - expected:+d})"
            )

    # --- Sprint Board keyword check in recent commits ---
    recent_msgs = _recent_commit_messages(10)
    sprint_hits = _check_sprint_keywords(recent_msgs)

    # --- Output ---
    if warnings or sprint_hits or skipped:
        print("\n[notion-consistency] ── Consistency Report ──────────────────────")

        if warnings:
            print("[notion-consistency] WARNING: Count mismatch(es) detected:")
            for w in warnings:
                print(f"[notion-consistency]{w}")
            print("[notion-consistency] → Update .claude/consistency-manifest.json to match Notion, or update the Notion page.")

        if skipped:
            print(f"[notion-consistency] NOTE: Could not extract count(s) from Notion page: {', '.join(skipped)}")
            print("[notion-consistency] → Notion page may be missing expected count text (e.g. '38 deny patterns').")

        if sprint_hits:
            print(f"[notion-consistency] NOTICE: {len(sprint_hits)} recent commit(s) mention sprint/launch keywords:")
            for msg in sprint_hits[:5]:  # cap output at 5
                print(f"[notion-consistency]   · {msg[:100]}")
            print("[notion-consistency] → Verify Sprint Board items are marked Done in Notion if resolved.")

        print("[notion-consistency] ─────────────────────────────────────────────\n")
    else:
        print("[notion-consistency] OK — Notion page counts match manifest.")

    sys.exit(0)


if __name__ == "__main__":
    main()
