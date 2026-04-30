// src/backend/middleware/validate.js
// Zod-based request body validation helper for VaultLister route handlers.
//
// Usage in a route handler:
//
//   import { validateBody } from '../middleware/validate.js';
//   import { z } from 'zod';
//
//   const CreateItemSchema = z.object({
//       title: z.string().min(1).max(200),
//       price: z.coerce.number().positive(),
//       condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
//   });
//
//   export async function inventoryRouter(ctx) {
//       if (ctx.method === 'POST' && ctx.path === '/') {
//           const { data, error } = validateBody(ctx.body, CreateItemSchema);
//           if (error) return error;
//           // data is fully typed and coerced — use directly
//           const { title, price, condition } = data;
//           ...
//       }
//   }
//
// On success: returns { data: <parsed+coerced object> }
// On failure: returns { error: { status: 422, data: { error, errors[] } } }
//   where errors[] = [{ field: 'price', message: 'Expected number, received string' }]
//
// The caller pattern `const { data, error } = validateBody(...); if (error) return error;`
// matches the existing { status, data } return convention in all VaultLister route handlers.

import { z } from 'zod';

/**
 * Validate `input` against a Zod schema.
 * @param {unknown} input - Typically ctx.body
 * @param {z.ZodTypeAny} schema - Any Zod schema
 * @returns {{ data: T } | { error: { status: number, data: object } }}
 */
export function validateBody(input, schema) {
    const result = schema.safeParse(input ?? {});

    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.length > 0 ? issue.path.join('.') : '_body',
            message: issue.message,
        }));

        return {
            error: {
                status: 422,
                data: {
                    error: 'Validation failed',
                    errors,
                },
            },
        };
    }

    return { data: result.data };
}

/**
 * Validate query parameters against a Zod schema.
 * Same return convention as validateBody.
 * @param {object} query - ctx.query
 * @param {z.ZodTypeAny} schema
 */
export function validateQuery(query, schema) {
    const result = schema.safeParse(query ?? {});

    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.length > 0 ? issue.path.join('.') : '_query',
            message: issue.message,
        }));

        return {
            error: {
                status: 400,
                data: {
                    error: 'Invalid query parameters',
                    errors,
                },
            },
        };
    }

    return { data: result.data };
}
