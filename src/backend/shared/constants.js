// Centralized constants for VaultLister backend
// Consolidates magic numbers scattered across route files

export const PAGINATION = {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 200,
};

export const CONTENT_LIMITS = {
    TITLE_MAX_LENGTH: 200,
    DESCRIPTION_MAX_LENGTH: 5000,
    TAG_MAX_LENGTH: 50,
    TAG_MAX_COUNT: 10,
    URL_MAX_LENGTH: 2048,
    SQL_MAX_LENGTH: 10000,
    JSON_FIELD_MAX: 50000,
};

export const CACHE = {
    DEFAULT_TTL_MS: 5 * 60 * 1000,
    MAX_ENTRIES: 1000,
};

export const TIMEOUTS = {
    API_REQUEST_MS: 30000,
    WORKER_POLL_MS: 60000,
};
