// Extension Logger with configurable levels
// Logs are only shown when debug mode is enabled in extension settings

const LOG_PREFIX = '[VaultLister]';

// Check if debug mode is enabled
async function isDebugEnabled() {
    try {
        const result = await chrome.storage.local.get('debugMode');
        return result.debugMode === true;
    } catch {
        return false;
    }
}

// Logger object with level-based methods
const logger = {
    async debug(...args) {
        if (await isDebugEnabled()) {
            console.debug(LOG_PREFIX, '[DEBUG]', ...args);
        }
    },

    async info(...args) {
        if (await isDebugEnabled()) {
            console.info(LOG_PREFIX, '[INFO]', ...args);
        }
    },

    async warn(...args) {
        // Warnings are always logged
        console.warn(LOG_PREFIX, '[WARN]', ...args);
    },

    async error(...args) {
        // Errors are always logged
        console.error(LOG_PREFIX, '[ERROR]', ...args);
    },

    // Synchronous versions for places where async isn't suitable
    debugSync(...args) {
        chrome.storage.local.get('debugMode', (result) => {
            if (result.debugMode) {
                console.debug(LOG_PREFIX, '[DEBUG]', ...args);
            }
        });
    },

    infoSync(...args) {
        chrome.storage.local.get('debugMode', (result) => {
            if (result.debugMode) {
                console.info(LOG_PREFIX, '[INFO]', ...args);
            }
        });
    }
};

// Enable debug mode
function enableDebug() {
    chrome.storage.local.set({ debugMode: true });
    console.info(LOG_PREFIX, 'Debug mode enabled');
}

// Disable debug mode
function disableDebug() {
    chrome.storage.local.set({ debugMode: false });
    console.info(LOG_PREFIX, 'Debug mode disabled');
}

// Export for use in service worker
if (typeof self !== 'undefined') {
    self.logger = logger;
    self.enableDebug = enableDebug;
    self.disableDebug = disableDebug;
}
