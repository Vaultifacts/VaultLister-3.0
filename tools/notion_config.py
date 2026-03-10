"""
Notion configuration — loads .env and exposes all required constants.
All other tools/notion_*.py modules import from here.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

NOTION_SYNC_ENABLED = os.getenv("NOTION_SYNC_ENABLED", "true").lower() == "true"

NOTION_INTEGRATION_TOKEN = os.getenv(
    "NOTION_INTEGRATION_TOKEN",
    "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",
)

MAIN_PAGE_ID = os.getenv(
    "NOTION_MAIN_PAGE_ID",
    "2fc3f0ecf38280ad9128f7ca8b6d4704",
)

CHECKLIST_PAGE_ID = os.getenv(
    "NOTION_CHECKLIST_PAGE_ID",
    "31d3f0ecf3828010b878de03ac961fc9",
)

NOTION_VERSION = "2022-06-28"

GENERATED_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "generated")


def require_sync_enabled():
    """Call at the top of any sync script. Exits 0 gracefully if sync is disabled."""
    if not NOTION_SYNC_ENABLED:
        print("NOTION_SYNC_ENABLED=false — skipping Notion sync.")
        sys.exit(0)
