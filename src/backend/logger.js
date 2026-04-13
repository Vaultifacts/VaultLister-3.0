// src/backend/logger.js
// Public re-export of the shared logger singleton.
// All backend code that needs logging should import from here or from
// src/backend/shared/logger.js — both resolve to the same instance.

export { logger, createLogger, logger as default } from './shared/logger.js';
