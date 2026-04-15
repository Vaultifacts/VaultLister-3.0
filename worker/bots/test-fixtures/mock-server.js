import path from 'path';
import fs from 'fs';

const PAGES_DIR = path.join(import.meta.dir, 'pages');

let _server = null;
let _port = 0;

function injectCaptcha(html) {
    return html.replace('</body>', `
<div id="captcha-container">
  <div id="captcha-placeholder" class="captcha-widget"></div>
  <iframe src="/captcha/render" id="captcha-iframe" style="display:none"></iframe>
</div>
</body>`);
}

function injectAiButton(html) {
    return html.replace('<!-- AI_BUTTON_SLOT -->', `
<button type="button" id="ai-listing-btn" style="margin:12px 0;padding:10px 16px;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">
  Create listing details
</button>`);
}

function servePage(filename, url) {
    const filePath = path.join(PAGES_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
    }
    let html = fs.readFileSync(filePath, 'utf8');
    const params = url.searchParams;
    if (params.get('captcha') === '1') {
        html = injectCaptcha(html);
    }
    if (params.get('ai') === '1') {
        html = injectAiButton(html);
    }
    return new Response(html, {
        headers: { 'content-type': 'text/html; charset=utf-8' }
    });
}

async function parseFormBody(req) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
}

function hasLoginCookie(req) {
    const cookie = req.headers.get('cookie') || '';
    return cookie.includes('fb_session=1');
}

async function handleRequest(req) {
    const url = new URL(req.url);
    const { pathname } = url;

    if (url.searchParams.get('verify') === '1') {
        return Response.redirect(`${url.origin}/marketplace/verify`, 302);
    }
    if (url.searchParams.get('checkpoint') === '1') {
        return Response.redirect(`${url.origin}/checkpoint`, 302);
    }

    if (req.method === 'POST' && pathname === '/login') {
        const body = await parseFormBody(req);
        if (!body.email || !body.pass) {
            return new Response('Invalid credentials', { status: 401 });
        }
        return new Response(null, {
            status: 302,
            headers: {
                'location': '/',
                'set-cookie': 'fb_session=1; Path=/; HttpOnly'
            }
        });
    }

    if (req.method === 'POST' && pathname === '/marketplace/create/item') {
        const id = Math.floor(Math.random() * 9000000000) + 1000000000;
        return new Response(null, {
            status: 302,
            headers: { 'location': `/marketplace/item/${id}/` }
        });
    }

    if (req.method === 'GET' && pathname === '/login') {
        return servePage('login.html', url);
    }

    if (req.method === 'GET' && pathname === '/marketplace/create/item') {
        return servePage('marketplace-create.html', url);
    }

    if (req.method === 'GET' && pathname === '/marketplace/you/selling') {
        return servePage('marketplace-selling.html', url);
    }

    if (req.method === 'GET' && /^\/marketplace\/item\/\d+\/?$/.test(pathname)) {
        return servePage('marketplace-item.html', url);
    }

    if (req.method === 'GET' && pathname === '/') {
        const loggedIn = hasLoginCookie(req);
        const profile = loggedIn
            ? `<div aria-label="Your profile" data-testid="royal_profile_link" id="profile-indicator" style="padding:8px;background:#1877f2;color:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center">U</div>`
            : '';
        const html = `<!DOCTYPE html><html><body><h1>Facebook</h1>${profile}</body></html>`;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
    }

    if (req.method === 'GET' && (pathname === '/marketplace/verify' || pathname === '/checkpoint')) {
        const label = pathname.slice(1);
        const html = `<!DOCTYPE html><html><body><h1>${label}</h1><p>Security check required.</p></body></html>`;
        return new Response(html, { headers: { 'content-type': 'text/html' } });
    }

    return new Response('Not Found', { status: 404 });
}

export async function start() {
    if (_server) return _port;
    _server = Bun.serve({
        port: 0,
        fetch: handleRequest,
    });
    _port = _server.port;
    return _port;
}

export async function stop() {
    if (_server) {
        _server.stop(true);
        _server = null;
        _port = 0;
    }
}

export function getPort() {
    return _port;
}
