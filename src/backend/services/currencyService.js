import { fetchWithTimeout } from '../shared/fetchWithTimeout.js';

const FALLBACK_RATES = { USD: 0.74, EUR: 0.68, GBP: 0.58, AUD: 1.12, MXN: 14.8 };
const BASE = 'CAD';
const API_URL = process.env.CURRENCY_API_URL || 'https://api.frankfurter.app';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

let _cache = null;
let _cacheTime = 0;

export async function getRates() {
    if (_cache && (Date.now() - _cacheTime) < CACHE_TTL) {
        return { rates: _cache, base: BASE, cached: true, timestamp: new Date(_cacheTime).toISOString() };
    }
    try {
        const res = await fetchWithTimeout(`${API_URL}/latest?base=${BASE}`, { timeoutMs: 5000 });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _cache = data.rates;
        _cacheTime = Date.now();
        return { rates: _cache, base: BASE, cached: false, timestamp: new Date(_cacheTime).toISOString() };
    } catch (err) {
        console.error('[Currency] API failed, using fallback:', err.message);
        return { rates: FALLBACK_RATES, base: BASE, cached: false, timestamp: null };
    }
}
