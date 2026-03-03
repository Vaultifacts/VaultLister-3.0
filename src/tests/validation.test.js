// Unit tests for validation.js validators
import { describe, expect, test } from 'bun:test';
import {
    isPresent, isNonEmptyString, isValidNumber, isPositiveNumber,
    isNonNegativeNumber, isValidInteger, isInRange,
    minLength, maxLength, lengthInRange,
    isValidEmail, isValidUrl, isValidPhone,
    isValidDateFormat, isValidISODateTime, isValidUUID, isValidSlug,
    isValidPrice, isValidQuantity, isValidSKU, isValidBarcode,
    isArray, isNonEmptyArray, arrayMinLength, arrayMaxLength,
    isObject, hasRequiredKeys, isOneOf, areAllOneOf,
    createSchema, Rules
} from '../backend/shared/validation.js';

describe('Basic Type Validators', () => {
    test('isPresent', () => {
        expect(isPresent('hello')).toBe(true);
        expect(isPresent(0)).toBe(true);
        expect(isPresent(false)).toBe(true);
        expect(isPresent(null)).toBe(false);
        expect(isPresent(undefined)).toBe(false);
        expect(isPresent('')).toBe(false);
    });

    test('isNonEmptyString', () => {
        expect(isNonEmptyString('hi')).toBe(true);
        expect(isNonEmptyString('')).toBe(false);
        expect(isNonEmptyString(123)).toBe(false);
        expect(isNonEmptyString(null)).toBe(false);
    });

    test('isValidNumber', () => {
        expect(isValidNumber(42)).toBe(true);
        expect(isValidNumber('42')).toBe(true);
        expect(isValidNumber(0)).toBe(true);
        expect(isValidNumber('abc')).toBe(false);
        expect(isValidNumber(NaN)).toBe(false);
    });

    test('isPositiveNumber', () => {
        expect(isPositiveNumber(1)).toBe(true);
        expect(isPositiveNumber(0)).toBe(false);
        expect(isPositiveNumber(-1)).toBe(false);
    });

    test('isNonNegativeNumber', () => {
        expect(isNonNegativeNumber(0)).toBe(true);
        expect(isNonNegativeNumber(5)).toBe(true);
        expect(isNonNegativeNumber(-1)).toBe(false);
    });

    test('isValidInteger', () => {
        expect(isValidInteger(5)).toBe(true);
        expect(isValidInteger(0)).toBe(true);
        expect(isValidInteger(3.14)).toBe(false);
    });

    test('isInRange', () => {
        expect(isInRange(5, 1, 10)).toBe(true);
        expect(isInRange(1, 1, 10)).toBe(true);
        expect(isInRange(10, 1, 10)).toBe(true);
        expect(isInRange(0, 1, 10)).toBe(false);
        expect(isInRange(11, 1, 10)).toBe(false);
    });
});

describe('String Validators', () => {
    test('minLength / maxLength / lengthInRange', () => {
        expect(minLength('hello', 3)).toBe(true);
        expect(minLength('hi', 3)).toBe(false);
        expect(maxLength('hi', 5)).toBe(true);
        expect(maxLength('toolongstring', 5)).toBe(false);
        expect(lengthInRange('test', 2, 10)).toBe(true);
    });

    test('isValidEmail', () => {
        expect(isValidEmail('user@example.com')).toBe(true);
        expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
        expect(isValidEmail('not-an-email')).toBe(false);
        expect(isValidEmail('@domain.com')).toBe(false);
        expect(isValidEmail('')).toBe(false);
    });

    test('isValidUrl', () => {
        expect(isValidUrl('https://example.com')).toBe(true);
        expect(isValidUrl('http://localhost:3000')).toBe(true);
        expect(isValidUrl('not-a-url')).toBe(false);
        expect(isValidUrl('')).toBe(false);
    });

    test('isValidPhone', () => {
        expect(isValidPhone('+1 555-123-4567')).toBe(true);
        expect(isValidPhone('(555) 123-4567')).toBe(true);
        expect(isValidPhone('abc')).toBe(false);
    });

    test('isValidDateFormat', () => {
        expect(isValidDateFormat('2024-01-15')).toBe(true);
        expect(isValidDateFormat('01/15/2024')).toBe(false);
        expect(isValidDateFormat('not-a-date')).toBe(false);
    });

    test('isValidUUID', () => {
        expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(isValidUUID('not-a-uuid')).toBe(false);
        expect(isValidUUID('')).toBe(false);
    });

    test('isValidSlug', () => {
        expect(isValidSlug('my-cool-slug')).toBe(true);
        expect(isValidSlug('slug123')).toBe(true);
        expect(isValidSlug('NOT_VALID')).toBe(false);
        expect(isValidSlug('has space')).toBe(false);
    });
});

describe('Business Validators', () => {
    test('isValidPrice', () => {
        expect(isValidPrice(9.99)).toBe(true);
        expect(isValidPrice(0)).toBe(true);
        expect(isValidPrice(999999.99)).toBe(true);
        expect(isValidPrice(-1)).toBe(false);
        expect(isValidPrice(9.999)).toBe(false);
    });

    test('isValidQuantity', () => {
        expect(isValidQuantity(1)).toBe(true);
        expect(isValidQuantity(0)).toBe(true);
        expect(isValidQuantity(-1)).toBe(false);
        expect(isValidQuantity(3.5)).toBe(false);
    });

    test('isValidSKU', () => {
        expect(isValidSKU('SKU-001')).toBe(true);
        expect(isValidSKU('ABC_123')).toBe(true);
        expect(isValidSKU('')).toBe(false);
        expect(isValidSKU('a'.repeat(51))).toBe(false);
    });

    test('isValidBarcode', () => {
        expect(isValidBarcode('012345678901')).toBe(true);   // UPC-A (12 digits)
        expect(isValidBarcode('0123456789012')).toBe(true);  // EAN-13 (13 digits)
        expect(isValidBarcode('12345')).toBe(false);         // Too short
        expect(isValidBarcode('abcdefghijkl')).toBe(false);  // Not digits
    });
});

describe('Array & Object Validators', () => {
    test('isArray / isNonEmptyArray', () => {
        expect(isArray([])).toBe(true);
        expect(isArray('not array')).toBe(false);
        expect(isNonEmptyArray([1])).toBe(true);
        expect(isNonEmptyArray([])).toBe(false);
    });

    test('arrayMinLength / arrayMaxLength', () => {
        expect(arrayMinLength([1, 2, 3], 2)).toBe(true);
        expect(arrayMinLength([1], 2)).toBe(false);
        expect(arrayMaxLength([1, 2], 3)).toBe(true);
        expect(arrayMaxLength([1, 2, 3, 4], 3)).toBe(false);
    });

    test('isObject', () => {
        expect(isObject({})).toBe(true);
        expect(isObject({ a: 1 })).toBe(true);
        expect(isObject(null)).toBe(false);
        expect(isObject([])).toBe(false);
        expect(isObject('str')).toBe(false);
    });

    test('hasRequiredKeys', () => {
        expect(hasRequiredKeys({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
        expect(hasRequiredKeys({ a: 1 }, ['a', 'b'])).toBe(false);
    });

    test('isOneOf / areAllOneOf', () => {
        expect(isOneOf('red', ['red', 'blue', 'green'])).toBe(true);
        expect(isOneOf('yellow', ['red', 'blue', 'green'])).toBe(false);
        expect(areAllOneOf(['red', 'blue'], ['red', 'blue', 'green'])).toBe(true);
        expect(areAllOneOf(['red', 'yellow'], ['red', 'blue', 'green'])).toBe(false);
    });
});

describe('Schema Validation', () => {
    test('createSchema validates correctly', () => {
        const schema = createSchema({
            name: [Rules.required(), Rules.nonEmptyString(), Rules.maxLength(100)],
            email: [Rules.required(), Rules.email()],
            age: [Rules.positiveNumber()]
        });

        const validResult = schema.validate({ name: 'John', email: 'john@test.com', age: 25 });
        expect(validResult.valid).toBe(true);
        expect(validResult.errors).toHaveLength(0);

        const invalidResult = schema.validate({ name: '', email: 'not-email' });
        expect(invalidResult.valid).toBe(false);
        expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test('Rules.required rejects empty values', () => {
        const rule = Rules.required();
        expect(rule.validate(null).valid).toBe(false);
        expect(rule.validate('value').valid).toBe(true);
    });

    test('Rules.price validates correctly', () => {
        const rule = Rules.price();
        expect(rule.validate(9.99).valid).toBe(true);
        expect(rule.validate(-1).valid).toBe(false);
    });

    test('Rules.oneOf validates set membership', () => {
        const rule = Rules.oneOf(['a', 'b', 'c']);
        expect(rule.validate('a').valid).toBe(true);
        expect(rule.validate('d').valid).toBe(false);
    });
});
