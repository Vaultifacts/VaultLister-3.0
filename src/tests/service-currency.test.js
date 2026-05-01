import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';

const { getRates } = await import('../backend/services/currencyService.js?service-currency-test');

afterEach(() => {
    mock.restore();
});

describe('currencyService', () => {
    test('returns fallback rates when the exchange-rate fetch fails', async () => {
        const fetchSpy = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));

        const rates = await getRates();

        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(rates).toEqual({ USD: 1, EUR: 0.925, GBP: 0.795, AUD: 1.53, JPY: 149.5, CAD: 1.36 });
    });
});
