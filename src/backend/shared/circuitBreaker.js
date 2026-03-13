// Circuit breaker for external dependencies (REM-16)
// States: CLOSED (normal) → OPEN (failing, return fallback) → HALF_OPEN (test recovery)

import { logger } from './logger.js';

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

const circuits = new Map();

const DEFAULTS = {
    failureThreshold: 5,
    cooldownMs: 30000,
    halfOpenMaxAttempts: 1,
};

function getCircuit(name, opts = {}) {
    if (!circuits.has(name)) {
        circuits.set(name, {
            name,
            state: STATES.CLOSED,
            failures: 0,
            lastFailureTime: 0,
            failureThreshold: opts.failureThreshold ?? DEFAULTS.failureThreshold,
            cooldownMs: opts.cooldownMs ?? DEFAULTS.cooldownMs,
            halfOpenAttempts: 0,
            halfOpenMaxAttempts: opts.halfOpenMaxAttempts ?? DEFAULTS.halfOpenMaxAttempts,
        });
    }
    return circuits.get(name);
}

/**
 * Execute a function through a circuit breaker.
 * @param {string} name - Unique circuit name (e.g., 'notion', 'anthropic', 'ebay-sync')
 * @param {Function} fn - Async function to execute
 * @param {Object} [opts] - Options
 * @param {Function} [opts.fallback] - Fallback function called when circuit is open
 * @param {number} [opts.failureThreshold=5] - Consecutive failures before opening
 * @param {number} [opts.cooldownMs=30000] - Time in ms before half-open retry
 * @returns {Promise<*>} Result of fn() or fallback()
 */
export async function circuitBreaker(name, fn, opts = {}) {
    const circuit = getCircuit(name, opts);

    if (circuit.state === STATES.OPEN) {
        const elapsed = Date.now() - circuit.lastFailureTime;
        if (elapsed >= circuit.cooldownMs) {
            circuit.state = STATES.HALF_OPEN;
            circuit.halfOpenAttempts = 0;
            logger.info(`[CircuitBreaker] ${name}: OPEN → HALF_OPEN (cooldown elapsed)`);
        } else {
            logger.debug(`[CircuitBreaker] ${name}: OPEN — returning fallback (${Math.round((circuit.cooldownMs - elapsed) / 1000)}s remaining)`);
            if (opts.fallback) return opts.fallback();
            throw new Error(`Circuit breaker OPEN for ${name}`);
        }
    }

    if (circuit.state === STATES.HALF_OPEN && circuit.halfOpenAttempts >= circuit.halfOpenMaxAttempts) {
        if (opts.fallback) return opts.fallback();
        throw new Error(`Circuit breaker HALF_OPEN limit reached for ${name}`);
    }

    try {
        if (circuit.state === STATES.HALF_OPEN) circuit.halfOpenAttempts++;
        const result = await fn();
        // Success — reset circuit
        if (circuit.state !== STATES.CLOSED) {
            logger.info(`[CircuitBreaker] ${name}: ${circuit.state} → CLOSED (success)`);
        }
        circuit.state = STATES.CLOSED;
        circuit.failures = 0;
        circuit.halfOpenAttempts = 0;
        return result;
    } catch (error) {
        circuit.failures++;
        circuit.lastFailureTime = Date.now();

        if (circuit.state === STATES.HALF_OPEN) {
            circuit.state = STATES.OPEN;
            logger.warn(`[CircuitBreaker] ${name}: HALF_OPEN → OPEN (test request failed: ${error.message})`);
        } else if (circuit.failures >= circuit.failureThreshold) {
            circuit.state = STATES.OPEN;
            logger.warn(`[CircuitBreaker] ${name}: CLOSED → OPEN (${circuit.failures} consecutive failures)`);
        }

        throw error;
    }
}

/** Get current state of a circuit (for monitoring/testing) */
export function getCircuitState(name) {
    const circuit = circuits.get(name);
    if (!circuit) return null;
    return { name: circuit.name, state: circuit.state, failures: circuit.failures, lastFailureTime: circuit.lastFailureTime };
}

/** Reset a circuit to CLOSED (for testing/admin) */
export function resetCircuit(name) {
    circuits.delete(name);
}

/** Reset all circuits (for testing) */
export function resetAllCircuits() {
    circuits.clear();
}
