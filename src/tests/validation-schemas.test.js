// Validation Schemas & validateRequest — Pure Function Unit Tests
import { describe, expect, test } from 'bun:test';
import { CommonSchemas, validateRequest, createSchema, Rules } from '../backend/shared/validation.js';

describe('CommonSchemas.inventoryItem', () => {
    test('validates a valid inventory item', () => {
        const result = CommonSchemas.inventoryItem.validate({
            title: 'Vintage Widget',
            listPrice: 29.99,
            costPrice: 10.00,
            quantity: 5,
            sku: 'VW-001',
            category: 'Widgets',
            brand: 'Acme',
            condition: 'good'
        });
        expect(result.valid).toBe(true);
    });

    test('rejects missing title', () => {
        const result = CommonSchemas.inventoryItem.validate({});
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects invalid condition value', () => {
        const result = CommonSchemas.inventoryItem.validate({
            title: 'Test',
            condition: 'terrible'
        });
        expect(result.valid).toBe(false);
    });

    test('accepts minimal item with just title', () => {
        const result = CommonSchemas.inventoryItem.validate({ title: 'Basic Item' });
        expect(result.valid).toBe(true);
    });
});

describe('CommonSchemas.userRegistration', () => {
    test('validates valid registration', () => {
        const result = CommonSchemas.userRegistration.validate({
            email: 'user@example.com',
            password: 'SecurePass123!',
            name: 'Test User'
        });
        expect(result.valid).toBe(true);
    });

    test('rejects missing email', () => {
        const result = CommonSchemas.userRegistration.validate({
            password: 'SecurePass123!'
        });
        expect(result.valid).toBe(false);
    });

    test('rejects invalid email format', () => {
        const result = CommonSchemas.userRegistration.validate({
            email: 'not-an-email',
            password: 'SecurePass123!'
        });
        expect(result.valid).toBe(false);
    });

    test('rejects password shorter than 8 characters', () => {
        const result = CommonSchemas.userRegistration.validate({
            email: 'user@example.com',
            password: 'short'
        });
        expect(result.valid).toBe(false);
    });
});

describe('CommonSchemas.contactForm', () => {
    test('validates valid contact form', () => {
        const result = CommonSchemas.contactForm.validate({
            name: 'John Doe',
            email: 'john@example.com',
            message: 'Hello, I have a question.'
        });
        expect(result.valid).toBe(true);
    });

    test('rejects missing message', () => {
        const result = CommonSchemas.contactForm.validate({
            name: 'John',
            email: 'john@example.com'
        });
        expect(result.valid).toBe(false);
    });
});

describe('CommonSchemas.pagination', () => {
    test('validates valid pagination params', () => {
        const result = CommonSchemas.pagination.validate({
            limit: 25,
            offset: 0,
            page: 1
        });
        expect(result.valid).toBe(true);
    });

    test('validates with empty object (all optional)', () => {
        const result = CommonSchemas.pagination.validate({});
        expect(result.valid).toBe(true);
    });
});

describe('validateRequest', () => {
    test('returns a function (middleware)', () => {
        const middleware = validateRequest(CommonSchemas.inventoryItem);
        expect(typeof middleware).toBe('function');
    });

    test('middleware returns null for valid body', () => {
        const middleware = validateRequest(CommonSchemas.inventoryItem);
        const result = middleware({ body: { title: 'Valid Item' } });
        expect(result).toBeNull();
    });

    test('middleware returns error response for invalid body', () => {
        const middleware = validateRequest(CommonSchemas.inventoryItem);
        const result = middleware({ body: {} });
        expect(result).not.toBeNull();
        expect(result.status).toBe(400);
        expect(result.data.success).toBe(false);
        expect(result.data.error).toBeDefined();
    });

    test('middleware uses custom bodyKey when provided', () => {
        const middleware = validateRequest(CommonSchemas.contactForm, 'query');
        const result = middleware({
            query: { name: 'X', email: 'x@x.com', message: 'hi' }
        });
        expect(result).toBeNull();
    });
});

describe('createSchema + Rules', () => {
    test('custom schema validates correctly', () => {
        const schema = createSchema({
            name: [Rules.required(), Rules.nonEmptyString()],
            age: [Rules.positiveNumber()]
        });
        const result = schema.validate({ name: 'Alice', age: 30 });
        expect(result.valid).toBe(true);
    });

    test('custom schema returns errors for invalid data', () => {
        const schema = createSchema({
            email: [Rules.required(), Rules.email()]
        });
        const result = schema.validate({ email: 'not-an-email' });
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('email');
    });

    test('Rules.oneOf rejects invalid values', () => {
        const schema = createSchema({
            status: [Rules.oneOf(['active', 'inactive'])]
        });
        const result = schema.validate({ status: 'deleted' });
        expect(result.valid).toBe(false);
    });

    test('Rules.range validates boundaries', () => {
        const schema = createSchema({
            score: [Rules.range(0, 100)]
        });
        expect(schema.validate({ score: 50 }).valid).toBe(true);
        expect(schema.validate({ score: -1 }).valid).toBe(false);
        expect(schema.validate({ score: 101 }).valid).toBe(false);
    });
});
