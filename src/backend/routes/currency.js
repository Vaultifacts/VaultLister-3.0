import { getRates } from '../services/currencyService.js';

export async function currencyRouter(ctx) {
    const { method, path } = ctx;

    if (method === 'GET' && (path === '/rates' || path === '/')) {
        const result = await getRates();
        return { status: 200, data: result };
    }

    return { status: 404, data: { error: 'Not found' } };
}
