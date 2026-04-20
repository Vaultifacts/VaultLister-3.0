import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 10,
    duration: '30s',
    thresholds: {
        http_req_duration: ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
    // Health check
    const health = http.get(`${BASE}/api/health`);
    check(health, { 'health 200': (r) => r.status === 200 });

    // Landing page
    const landing = http.get(BASE);
    check(landing, { 'landing 200': (r) => r.status === 200 });

    // Pricing page
    const pricing = http.get(`${BASE}/pricing.html`);
    check(pricing, { 'pricing 200': (r) => r.status === 200 });

    sleep(1);
}
