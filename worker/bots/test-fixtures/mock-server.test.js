import { test, expect, beforeAll, afterAll } from 'bun:test';
import { start, stop, getPort } from './mock-server.js';

let port;
beforeAll(async () => { port = await start(); });
afterAll(async () => { await stop(); });

test('server starts and returns a port', () => {
    expect(port).toBeGreaterThan(0);
    expect(getPort()).toBe(port);
});

test('GET /login returns HTML', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('id="email"');
});

test('GET /login?captcha=1 injects captcha element', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login?captcha=1`);
    const body = await res.text();
    expect(body).toContain('id="captcha-container"');
});

test('POST /login without credentials returns 401', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`, {
        method: 'POST',
        body: new URLSearchParams({ email: '', pass: '' }),
        redirect: 'manual'
    });
    expect(res.status).toBe(401);
});

test('POST /login with credentials redirects and sets cookie', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`, {
        method: 'POST',
        body: new URLSearchParams({ email: 'test@test.com', pass: 'password' }),
        redirect: 'manual'
    });
    expect(res.status).toBe(302);
    expect(res.headers.get('set-cookie')).toContain('fb_session=1');
});

test('GET /marketplace/create/item returns HTML with Lexical editor', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/create/item`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('data-lexical-editor');
});

test('GET /marketplace/you/selling returns HTML with listing links', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/you/selling`);
    const body = await res.text();
    expect(body).toContain('/marketplace/item/');
});

test('GET /marketplace/item/12345 returns HTML with Edit button', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/marketplace/item/12345`);
    const body = await res.text();
    expect(body).toContain('Edit listing');
});

test('GET /?verify=1 redirects to /marketplace/verify', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/?verify=1`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/marketplace/verify');
});

test('GET /?checkpoint=1 redirects to /checkpoint', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/?checkpoint=1`, { redirect: 'manual' });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/checkpoint');
});
