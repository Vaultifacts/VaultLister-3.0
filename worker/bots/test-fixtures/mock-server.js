import path from 'path';
import fs from 'fs';

const PAGES_DIR = path.join(import.meta.dir || path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), 'pages');

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
    if (typeof Bun !== 'undefined') {
        // Bun runtime
        _server = Bun.serve({ port: 0, fetch: handleRequest });
        _port = _server.port;
    } else {
        // Node.js runtime (Playwright tests)
        const http = await import('http');
        _server = http.createServer(async (req, res) => {
            const url = new URL(req.url, `http://localhost`);
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
                const request = new Request(`http://localhost${req.url}`, {
                    method: req.method,
                    headers: req.headers,
                    body: req.method === 'POST' ? body : undefined,
                });
                const response = await handleRequest(request);
                const respBody = await response.text();
                const headers = {};
                response.headers.forEach((v, k) => { headers[k] = v; });
                res.writeHead(response.status, headers);
                res.end(respBody);
            });
        });
        await new Promise(resolve => {
            _server.listen(0, '127.0.0.1', () => {
                _port = _server.address().port;
                resolve();
            });
        });
    }
    return _port;
}

export async function stop() {
    if (_server) {
        if (typeof Bun !== 'undefined') {
            _server.stop(true);
        } else {
            await new Promise(resolve => _server.close(resolve));
        }
        _server = null;
        _port = 0;
    }
}

export function getPort() {
    return _port;
}
