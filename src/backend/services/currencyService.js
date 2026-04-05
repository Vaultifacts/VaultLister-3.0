import { fetchWithTimeout } from '../shared/fetchWithTimeout.js';

const FALLBACK_RATES = { EUR: 0.925, GBP: 0.795, CAD: 1.365, AUD: 1.535, JPY: 149.8 };
const API_URL = process.env.CURRENCY_API_URL || 'https://api.frankfurter.app/latest';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

let _cache = null;
let _cacheTime = 0;

export async function getRates(base = 'USD') {
    if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) {
        return { rates: _cache, source: 'cache', updatedAt: new Date(_cacheTime).toISOString() };
    }
    try {
        const res = await fetchWithTimeout(`${API_URL}?from=${base}`, { timeoutMs: 5000 });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _cache = data.rates;
        _cacheTime = Date.now();
        return { rates: _cache, source: 'live', updatedAt: new Date(_cacheTime).toISOString() };
    } catch (err) {
        console.error('[Currency] API failed, using fallback:', err.message);
        return { rates: FALLBACK_RATES, source: 'fallback', updatedAt: null };
    }
}

export { FALLBACK_RATES };
