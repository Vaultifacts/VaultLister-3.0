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
    DB_HEALTH_CHECK_MS: 1000,
    FETCH_ABORT_MS: 10000,
    GRACEFUL_SHUTDOWN_MS: 30000,
    STARTUP_CLEANUP_DELAY_MS: 30 * 1000,
};

// Primitive time unit constants — use these to build named durations
export const ONE_SECOND = 1000;
export const ONE_MINUTE = 60 * 1000;
export const ONE_HOUR   = 60 * 60 * 1000;
export const ONE_DAY    = 24 * 60 * 60 * 1000;

export const INTERVALS = {
    WEBSOCKET_HEARTBEAT_MS: 30000,
    CSRF_TOKEN_CLEANUP_MS: 10 * 60 * 1000,
    DB_SIZE_CHECK_MS: 60 * 60 * 1000,
    DAILY_CLEANUP_MS: 24 * 60 * 60 * 1000,
    HOURLY_TASK_MS: 60 * 60 * 1000,
    TOKEN_CHECK_MS: 5 * 60 * 1000,
    METRICS_COLLECTION_MS: 30000,
};
