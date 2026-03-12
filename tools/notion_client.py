"""
Robust Notion API client with automatic retry and backoff.

All HTTP calls go through _request(). Retry on transient errors.
Never swallows errors silently — raises RuntimeError with full context.
"""

import time

import requests

from notion_config import NOTION_INTEGRATION_TOKEN, NOTION_VERSION

_BASE_URL = "https://api.notion.com/v1"
_TIMEOUT = 30
_MAX_RETRIES = 3
_RETRY_STATUSES = {408, 409, 429, 500, 502, 503, 504}
_BACKOFF = [1, 2, 4]


class NotionClient:
    def __init__(self, token: str = NOTION_INTEGRATION_TOKEN):
        self._headers = {
            "Authorization": f"Bearer {token}",
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Core request method
    # ------------------------------------------------------------------

    def _request(self, method: str, path: str, **kwargs) -> dict:
        url = f"{_BASE_URL}/{path.lstrip('/')}"
        last_exc = None

        for attempt in range(_MAX_RETRIES):
            try:
                resp = requests.request(
                    method,
                    url,
                    headers=self._headers,
                    timeout=_TIMEOUT,
                    **kwargs,
                )
            except requests.RequestException as exc:
                last_exc = exc
                if attempt < _MAX_RETRIES - 1:
                    time.sleep(_BACKOFF[attempt])
                continue

            if resp.status_code < 400:
                return resp.json() if resp.content else {}

            if resp.status_code in _RETRY_STATUSES and attempt < _MAX_RETRIES - 1:
                retry_after = int(resp.headers.get("Retry-After", _BACKOFF[attempt]))
                time.sleep(retry_after)
                continue

            # Final failure — raise with full context
            try:
                body = resp.text[:500]
            except Exception:
                body = "<unreadable>"

            raise RuntimeError(
                f"{method} {path} → {resp.status_code}: {body}"
            )

        if last_exc:
            raise RuntimeError(
                f"{method} {path} → network error after {_MAX_RETRIES} attempts: {last_exc}"
            )

        raise RuntimeError(f"{method} {path} → failed after {_MAX_RETRIES} attempts")

    # ------------------------------------------------------------------
    # Public Notion API methods
    # ------------------------------------------------------------------

    def get_page(self, page_id: str) -> dict:
        return self._request("GET", f"pages/{page_id}")

    def get_block_children(self, block_id: str, start_cursor: str = None) -> dict:
        params = {"page_size": 100}
        if start_cursor:
            params["start_cursor"] = start_cursor
        return self._request("GET", f"blocks/{block_id}/children", params=params)

    def get_all_block_children(self, block_id: str) -> list:
        """Paginate through all children."""
        results = []
        cursor = None
        while True:
            page = self.get_block_children(block_id, start_cursor=cursor)
            results.extend(page.get("results", []))
            if not page.get("has_more"):
                break
            cursor = page.get("next_cursor")
        return results

    def append_block_children(self, block_id: str, children: list) -> dict:
        return self._request(
            "PATCH",
            f"blocks/{block_id}/children",
            json={"children": children},
        )

    def update_block(self, block_id: str, payload: dict) -> dict:
        return self._request("PATCH", f"blocks/{block_id}", json=payload)

    def search(self, query: str = "", **filters) -> dict:
        body = {"query": query}
        body.update(filters)
        return self._request("POST", "search", json=body)

    def create_page(self, parent: dict, properties: dict, children: list = None) -> dict:
        body = {"parent": parent, "properties": properties}
        if children:
            body["children"] = children
        return self._request("POST", "pages", json=body)

    def create_database(self, parent: dict, title: list, properties: dict) -> dict:
        body = {
            "parent": parent,
            "title": title,
            "properties": properties,
            "is_inline": True,
        }
        return self._request("POST", "databases", json=body)

    def query_database(self, database_id: str, filter_obj: dict = None, sorts: list = None) -> dict:
        body = {}
        if filter_obj:
            body["filter"] = filter_obj
        if sorts:
            body["sorts"] = sorts
        return self._request("POST", f"databases/{database_id}/query", json=body)
