const FALLBACK_RATES = { USD: 1, EUR: 0.925, GBP: 0.795, AUD: 1.53, JPY: 149.5, CAD: 1.36 };
let cache = { rates: null, fetchedAt: 0 };
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function getRates(options = {}) {
    if (cache.rates && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
        return cache.rates;
    }
    const fetchRates = options.fetch || fetch;
    try {
        const res = await fetchRates('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,AUD,JPY,CAD');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const rates = { USD: 1, ...data.rates };
        cache = { rates, fetchedAt: Date.now() };
        return rates;
    } catch {
        return FALLBACK_RATES;
    }
}
