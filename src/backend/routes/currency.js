import { getRates } from '../services/currencyService.js';
import { logger } from '../shared/logger.js';

export async function currencyRouter(ctx) {
    try {
        const { method, path } = ctx;

        if (method === 'GET' && (path === '/rates' || path === '/')) {
            const result = await getRates();
            return { status: 200, data: result };
        }

        return { status: 404, data: { error: 'Not found' } };
    } catch (error) {
        logger.error('[Currency] Unhandled route error', { path: ctx.path, method: ctx.method, error: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}
