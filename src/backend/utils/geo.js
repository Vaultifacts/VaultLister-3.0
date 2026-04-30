const UNKNOWN_COUNTRY_CODES = new Set(['', 'XX', 'T1']);

function readHeader(headers, name) {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';

    const direct = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
    if (direct) return direct;

    const wanted = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === wanted) return value;
    }

    return '';
}

export function normalizeCountryCode(value) {
    const code = String(value || '')
        .trim()
        .toUpperCase();
    if (!/^[A-Z0-9]{2}$/.test(code)) return '';
    if (UNKNOWN_COUNTRY_CODES.has(code)) return '';
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return code;
}

export function getCountryCodeFromHeaders(headers = {}) {
    return normalizeCountryCode(
        readHeader(headers, 'CF-IPCountry') ||
            readHeader(headers, 'X-Vercel-IP-Country') ||
            readHeader(headers, 'X-Country-Code') ||
            readHeader(headers, 'CloudFront-Viewer-Country'),
    );
}
