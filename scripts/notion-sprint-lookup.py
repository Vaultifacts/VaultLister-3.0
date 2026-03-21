#!/usr/bin/env python3
"""
notion-sprint-lookup.py — Query Sprint Board items and cache locally.

Two modes:
  1. `sync`   — fetch all non-Done items from Notion, write to .notion-sprint-cache.json
  2. `match`  — fuzzy-match a commit message against cached items, return page IDs

Usage:
  python scripts/notion-sprint-lookup.py sync
  python scripts/notion-sprint-lookup.py match "fix OAuth rate limiting"

The commit-msg hook calls `match` mode to auto-suggest Notion-Done trailers.
The post-commit hook calls `sync` to keep the cache fresh (background, non-blocking).

Requires: NOTION_TOKEN or NOTION_INTEGRATION_TOKEN in environment.
Cache file: .notion-sprint-cache.json (gitignored)
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

NOTION_VERSION = "2022-06-28"
TOKEN = os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_INTEGRATION_TOKEN", "")
# To find this ID: open Sprint Board in Notion → Share → copy link → extract UUID
# The integration must be connected to this database (Share → Invite → select integration)
SPRINT_DB_ID = os.environ.get("NOTION_SPRINT_DB_ID", "5ce9f0c81de68361a52981b74ee61e84")
CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".notion-sprint-cache.json")

# Stop words to ignore during matching
STOP_WORDS = frozenset([
    "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or", "is",
    "fix", "feat", "auto", "add", "update", "set", "get", "use", "make",
    "all", "from", "with", "not", "this", "that", "its", "was", "are", "has",
])


def api_request(method, url, body=None):
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_sprint_items():
    """Fetch all non-Done items from the Sprint Board database."""
    url = f"https://api.notion.com/v1/databases/{SPRINT_DB_ID}/query"
    body = {
        "filter": {
            "property": "Status",
            "select": {
                "does_not_equal": "Done"
            }
        },
        "page_size": 100
    }
    items = []
    has_more = True
    start_cursor = None

    while has_more:
        if start_cursor:
            body["start_cursor"] = start_cursor
        result = api_request("POST", url, body)

        for page in result.get("results", []):
            props = page.get("properties", {})
            title_prop = props.get("Task Name", {})
            title_parts = title_prop.get("title", [])
            title = "".join(t.get("plain_text", "") for t in title_parts)

            status_prop = props.get("Status", {})
            status = (status_prop.get("select") or {}).get("name", "")

            priority_prop = props.get("Priority", {})
            priority = (priority_prop.get("select") or {}).get("name", "")

            tags_prop = props.get("Tags", {})
            tags = [t.get("name", "") for t in tags_prop.get("multi_select", [])]

            page_id = page["id"].replace("-", "")

            items.append({
                "id": page_id,
                "title": title,
                "status": status,
                "priority": priority,
                "tags": tags,
            })

        has_more = result.get("has_more", False)
        start_cursor = result.get("next_cursor")

    return items


def sync_cache():
    """Fetch Sprint Board items and write to local cache."""
    if not TOKEN:
        print("NOTION_TOKEN not set — cannot sync", file=sys.stderr)
        sys.exit(1)

    try:
        items = fetch_sprint_items()
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"items": items, "synced_at": __import__("datetime").datetime.now().isoformat()}, f, indent=2)
        print(f"Synced {len(items)} Sprint Board items to {CACHE_FILE}")
    except Exception as e:
        print(f"Sync failed: {e}", file=sys.stderr)
        sys.exit(1)


def load_cache():
    """Load cached Sprint Board items."""
    if not os.path.exists(CACHE_FILE):
        return []
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("items", [])
    except Exception:
        return []


def tokenize(text):
    """Extract meaningful words from text."""
    words = re.findall(r"[a-zA-Z]{3,}", text.lower())
    return [w for w in words if w not in STOP_WORDS]


def score_match(commit_tokens, item):
    """Score how well a commit message matches a Sprint Board item."""
    title_tokens = set(tokenize(item["title"]))
    tag_tokens = set(t.lower() for t in item.get("tags", []))

    if not title_tokens:
        return 0

    # Count matching tokens
    commit_set = set(commit_tokens)
    title_hits = len(commit_set & title_tokens)
    tag_hits = len(commit_set & tag_tokens)

    # Score = percentage of item title tokens matched + tag bonus
    score = (title_hits / len(title_tokens)) * 100
    score += tag_hits * 10  # bonus for matching tags

    return score


def match_commit(commit_msg):
    """Find Sprint Board items that match a commit message."""
    items = load_cache()
    if not items:
        # Try to sync if cache is empty and token is available
        if TOKEN:
            try:
                items = fetch_sprint_items()
            except Exception:
                pass
        if not items:
            return []

    commit_tokens = tokenize(commit_msg)
    if not commit_tokens:
        return []

    scored = []
    for item in items:
        s = score_match(commit_tokens, item)
        if s >= 30:  # minimum 30% match threshold
            scored.append((s, item))

    scored.sort(key=lambda x: -x[0])
    return scored[:5]  # top 5 matches


def main():
    if len(sys.argv) < 2:
        print("Usage: notion-sprint-lookup.py sync|match [commit-msg]")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "verify":
        # Verify integration can access Sprint Board — use in pre-push or session start
        if not TOKEN:
            print("FAIL: NOTION_TOKEN not set", file=sys.stderr)
            sys.exit(1)
        try:
            items = fetch_sprint_items()
            print(f"OK: integration can access Sprint Board ({len(items)} non-Done items)")
        except Exception as e:
            print(f"FAIL: Cannot access Sprint Board — {e}", file=sys.stderr)
            print("Fix: ensure NOTION_INTEGRATION_TOKEN in .env belongs to an integration", file=sys.stderr)
            print("     that is connected to the Sprint Board page in Notion.", file=sys.stderr)
            sys.exit(1)

    elif cmd == "sync":
        sync_cache()

    elif cmd == "match":
        if len(sys.argv) < 3:
            print("Usage: notion-sprint-lookup.py match \"commit message\"")
            sys.exit(1)
        commit_msg = " ".join(sys.argv[2:])
        matches = match_commit(commit_msg)
        if matches:
            print(f"Matching Sprint Board items ({len(matches)}):")
            for score, item in matches:
                print(f"  [{score:.0f}%] {item['title']}")
                print(f"       Notion-Done: {item['id']}")
                print(f"       Status: {item['status']}  Priority: {item['priority']}")
                print()
        else:
            print("No matching Sprint Board items found.")
            print("Use: Notion-Skip: <reason>")

    elif cmd == "auto":
        # Called by commit-msg hook — outputs just the best matching ID or empty
        if len(sys.argv) < 3:
            sys.exit(0)
        commit_msg = " ".join(sys.argv[2:])
        matches = match_commit(commit_msg)
        if matches and matches[0][0] >= 50:  # only auto-suggest at 50%+ confidence
            print(matches[0][1]["id"])
        sys.exit(0)

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
