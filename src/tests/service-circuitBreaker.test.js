// Unit tests for circuit breaker utility (REM-16)

import { describe, expect, test, beforeEach } from 'bun:test';
import { circuitBreaker, getCircuitState, resetCircuit, resetAllCircuits } from '../backend/shared/circuitBreaker.js';

beforeEach(() => {
    resetAllCircuits();
});

describe('Circuit Breaker', () => {
    test('passes through successful calls', async () => {
        const result = await circuitBreaker('test-success', () => Promise.resolve('ok'));
        expect(result).toBe('ok');
    });

    test('passes through errors when under threshold', async () => {
        let caught;
        try {
            await circuitBreaker('test-fail', () => Promise.reject(new Error('fail')), { failureThreshold: 3 });
        } catch (e) { caught = e; }
        expect(caught.message).toBe('fail');
        const state = getCircuitState('test-fail');
        expect(state.state).toBe('CLOSED');
        expect(state.failures).toBe(1);
    });

    test('opens circuit after reaching failure threshold', async () => {
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker('test-open', () => Promise.reject(new Error('fail')), { failureThreshold: 3 });
            } catch {}
        }
        const state = getCircuitState('test-open');
        expect(state.state).toBe('OPEN');
        expect(state.failures).toBe(3);
    });

    test('returns fallback when circuit is open', async () => {
        // Open the circuit
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker('test-fallback', () => Promise.reject(new Error('fail')), { failureThreshold: 3, cooldownMs: 60000 });
            } catch {}
        }
        // Next call should return fallback
        const result = await circuitBreaker('test-fallback', () => Promise.resolve('should not run'), {
            fallback: () => 'fallback-value',
            cooldownMs: 60000,
        });
        expect(result).toBe('fallback-value');
    });

    test('returns error object when circuit is open and no fallback provided', async () => {
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker('test-no-fallback', () => Promise.reject(new Error('fail')), { failureThreshold: 3, cooldownMs: 60000 });
            } catch {}
        }
        const result = await circuitBreaker('test-no-fallback', () => Promise.resolve('nope'), { cooldownMs: 60000 });
        expect(result.error).toBeDefined();
        expect(result.error).toContain('Service temporarily unavailable');
    });

    test('resets to CLOSED on success after failures', async () => {
        // 2 failures (under threshold of 3)
        for (let i = 0; i < 2; i++) {
            try {
                await circuitBreaker('test-reset', () => Promise.reject(new Error('fail')), { failureThreshold: 3 });
            } catch {}
        }
        expect(getCircuitState('test-reset').failures).toBe(2);

        // Success resets
        await circuitBreaker('test-reset', () => Promise.resolve('ok'), { failureThreshold: 3 });
        expect(getCircuitState('test-reset').failures).toBe(0);
        expect(getCircuitState('test-reset').state).toBe('CLOSED');
    });

    test('transitions to HALF_OPEN after cooldown expires', async () => {
        // Open the circuit with short cooldown
        for (let i = 0; i < 2; i++) {
            try {
                await circuitBreaker('test-halfopen', () => Promise.reject(new Error('fail')), { failureThreshold: 2, cooldownMs: 1 });
            } catch {}
        }
        expect(getCircuitState('test-halfopen').state).toBe('OPEN');

        // Wait for cooldown
        await new Promise(r => setTimeout(r, 10));

        // Next call should transition to HALF_OPEN and execute
        const result = await circuitBreaker('test-halfopen', () => Promise.resolve('recovered'), { failureThreshold: 2, cooldownMs: 1 });
        expect(result).toBe('recovered');
        expect(getCircuitState('test-halfopen').state).toBe('CLOSED');
    });

    test('HALF_OPEN failure returns to OPEN', async () => {
        // Open the circuit with short cooldown
        for (let i = 0; i < 2; i++) {
            try {
                await circuitBreaker('test-halfopen-fail', () => Promise.reject(new Error('fail')), { failureThreshold: 2, cooldownMs: 1 });
            } catch {}
        }

        await new Promise(r => setTimeout(r, 10));

        // Half-open test request fails
        try {
            await circuitBreaker('test-halfopen-fail', () => Promise.reject(new Error('still failing')), { failureThreshold: 2, cooldownMs: 60000 });
        } catch {}
        expect(getCircuitState('test-halfopen-fail').state).toBe('OPEN');
    });

    test('separate circuits are independent', async () => {
        // Fail circuit A
        for (let i = 0; i < 3; i++) {
            try {
                await circuitBreaker('circuit-a', () => Promise.reject(new Error('fail')), { failureThreshold: 3, cooldownMs: 60000 });
            } catch {}
        }
        expect(getCircuitState('circuit-a').state).toBe('OPEN');

        // Circuit B is unaffected
        const result = await circuitBreaker('circuit-b', () => Promise.resolve('ok'));
        expect(result).toBe('ok');
        expect(getCircuitState('circuit-b').state).toBe('CLOSED');
    });

    test('resetCircuit clears state', async () => {
        await circuitBreaker('test-clear', () => Promise.resolve('ok'));
        expect(getCircuitState('test-clear')).not.toBeNull();

        resetCircuit('test-clear');
        expect(getCircuitState('test-clear')).toBeNull();
    });

    test('getCircuitState returns null for unknown circuit', () => {
        expect(getCircuitState('nonexistent')).toBeNull();
    });

    test('preserves async return values', async () => {
        const obj = { id: 1, data: [1, 2, 3] };
        const result = await circuitBreaker('test-value', () => Promise.resolve(obj));
        expect(result).toEqual(obj);
    });
});
