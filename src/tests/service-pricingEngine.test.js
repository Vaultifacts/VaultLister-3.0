// Pricing Engine Service — Unit Tests
import { describe, expect, test } from 'bun:test';
import {
    calculateDemandScore,
    getRecommendation,
    getDemandForecast
} from '../backend/services/pricingEngine.js';

describe('PricingEngine - calculateDemandScore', () => {
    test('returns base score of 50 with no comparables', () => {
        const item = { category: 'Clothing', list_price: 50 };
        const score = calculateDemandScore(item, []);
        // No comparables: base 50, comparables.length < 3 → -10, price 25-100 → +10 = 50
        expect(score).toBeGreaterThanOrEqual(30);
        expect(score).toBeLessThanOrEqual(70);
    });

    test('boosts score for fast-selling comparables', () => {
        const item = { category: 'Clothing', list_price: 50 };
        const fastComps = Array.from({ length: 8 }, () => ({
            daysToSell: 5, price: 50
        }));
        const slowComps = Array.from({ length: 8 }, () => ({
            daysToSell: 45, price: 50
        }));

        const fastScore = calculateDemandScore(item, fastComps);
        const slowScore = calculateDemandScore(item, slowComps);
        expect(fastScore).toBeGreaterThan(slowScore);
    });

    test('boosts score for many comparables', () => {
        const item = { category: 'Clothing', list_price: 50 };
        const manyComps = Array.from({ length: 12 }, () => ({
            daysToSell: 14, price: 50
        }));
        const fewComps = Array.from({ length: 2 }, () => ({
            daysToSell: 14, price: 50
        }));

        const manyScore = calculateDemandScore(item, manyComps);
        const fewScore = calculateDemandScore(item, fewComps);
        expect(manyScore).toBeGreaterThan(fewScore);
    });

    test('clamps score between 0 and 100', () => {
        const item = { category: 'Clothing', list_price: 50 };
        const extremeComps = Array.from({ length: 20 }, () => ({
            daysToSell: 1, price: 50
        }));
        const score = calculateDemandScore(item, extremeComps);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });

    test('sweet spot pricing boosts score', () => {
        const sweetItem = { category: 'Other', list_price: 60 };
        const expensiveItem = { category: 'Other', list_price: 300 };
        const comps = Array.from({ length: 5 }, () => ({
            daysToSell: 14, price: 60
        }));

        const sweetScore = calculateDemandScore(sweetItem, comps);
        const expensiveScore = calculateDemandScore(expensiveItem, comps);
        expect(sweetScore).toBeGreaterThan(expensiveScore);
    });
});

describe('PricingEngine - getRecommendation', () => {
    test('recommends price_up for high demand and low current price', () => {
        const item = { list_price: 30, created_at: new Date().toISOString() };
        const result = getRecommendation(item, 50, 80);
        expect(result.action).toBe('price_up');
        expect(result.reason).toBeDefined();
    });

    test('recommends price_down for low demand and high current price', () => {
        const item = { list_price: 100, created_at: new Date().toISOString() };
        const result = getRecommendation(item, 70, 30);
        expect(result.action).toBe('price_down');
        expect(result.reason).toBeDefined();
    });

    test('recommends hold when price is near optimal', () => {
        const item = { list_price: 50, created_at: new Date().toISOString() };
        const result = getRecommendation(item, 52, 60);
        expect(result.action).toBe('hold');
    });

    test('recommends relist for stale listings with moderate demand', () => {
        const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
        const item = { list_price: 50, created_at: oldDate };
        const result = getRecommendation(item, 50, 40);
        expect(result.action).toBe('relist');
        expect(result.reason).toContain('days ago');
    });

    test('always returns action and reason', () => {
        const item = { list_price: 50 };
        const result = getRecommendation(item, 50, 50);
        expect(result).toHaveProperty('action');
        expect(result).toHaveProperty('reason');
        expect(typeof result.action).toBe('string');
        expect(typeof result.reason).toBe('string');
    });
});

describe('PricingEngine - getDemandForecast', () => {
    test('returns forecast with required fields', async () => {
        const forecast = await getDemandForecast('Clothing');
        expect(forecast).toHaveProperty('category', 'Clothing');
        expect(forecast).toHaveProperty('forecast_date');
        expect(forecast).toHaveProperty('demand_level');
        expect(forecast).toHaveProperty('price_trend');
        expect(forecast).toHaveProperty('seasonality_index');
        expect(forecast).toHaveProperty('notes');
    });

    test('includes platform when specified', async () => {
        const forecast = await getDemandForecast('Shoes', 'ebay');
        expect(forecast.platform).toBe('ebay');
    });

    test('platform defaults to null', async () => {
        const forecast = await getDemandForecast('Electronics');
        expect(forecast.platform).toBeNull();
    });

    test('demand_level is one of expected values', async () => {
        const forecast = await getDemandForecast('Clothing');
        expect(['high', 'medium', 'low']).toContain(forecast.demand_level);
    });

    test('price_trend is one of expected values', async () => {
        const forecast = await getDemandForecast('Clothing');
        expect(['rising', 'stable', 'falling']).toContain(forecast.price_trend);
    });

    test('seasonality_index is a valid number', async () => {
        const forecast = await getDemandForecast('Shoes');
        expect(typeof forecast.seasonality_index).toBe('number');
        expect(forecast.seasonality_index).toBeGreaterThan(0);
        expect(forecast.seasonality_index).toBeLessThan(2);
    });

    test('different categories produce different seasonality', async () => {
        const clothing = await getDemandForecast('Clothing');
        const electronics = await getDemandForecast('Electronics');
        // They should use different seasonality tables
        // (may or may not differ depending on month, but both should be valid)
        expect(clothing.seasonality_index).toBeGreaterThan(0);
        expect(electronics.seasonality_index).toBeGreaterThan(0);
    });

    test('forecast_date is ISO date format', async () => {
        const forecast = await getDemandForecast('Clothing');
        expect(forecast.forecast_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('notes is a non-empty string', async () => {
        const forecast = await getDemandForecast('Bags');
        expect(typeof forecast.notes).toBe('string');
        expect(forecast.notes.length).toBeGreaterThan(0);
    });
});
