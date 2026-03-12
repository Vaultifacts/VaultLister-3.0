// Mock OAuth Provider
// Simulates platform OAuth flows for demo/development purposes
// No real platform credentials needed

import crypto from 'crypto';

export async function mockOAuthRouter(ctx) {
    const { method, path, query: queryParams, body } = ctx;

    // Extract platform from path
    const pathParts = path.split('/');
    const platform = pathParts[1]; // /poshmark/authorize -> poshmark

    // GET /mock-oauth/:platform/authorize - Show mock login page
    if (method === 'GET' && path.match(/^\/[a-z]+\/authorize$/)) {
        const { client_id, redirect_uri, state, scope, response_type } = queryParams;

        if (!client_id || !redirect_uri || !state) {
            return {
                status: 400,
                data: { error: 'Missing required parameters' }
            };
        }

        // Return HTML page that simulates platform login
        return {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
            body: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mock ${getPlatformName(platform)} OAuth</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
            background: linear-gradient(135deg, ${getPlatformGradient(platform)});
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            max-width: 500px;
            width: 100%;
            padding: 40px;
            text-align: center;
        }

        .platform-logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, ${getPlatformGradient(platform)});
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
        }

        h1 {
            font-size: 28px;
            margin-bottom: 12px;
            color: #1a202c;
        }

        .subtitle {
            color: #718096;
            margin-bottom: 32px;
            font-size: 16px;
        }

        .app-info {
            background: #f7fafc;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 24px;
            text-align: left;
        }

        .app-name {
            font-weight: 600;
            font-size: 18px;
            color: #2d3748;
            margin-bottom: 16px;
        }

        .scopes {
            margin-top: 12px;
        }

        .scopes h3 {
            font-size: 14px;
            font-weight: 600;
            color: #4a5568;
            margin-bottom: 12px;
        }

        .scopes ul {
            list-style: none;
            text-align: left;
        }

        .scopes li {
            padding: 8px 0;
            color: #4a5568;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .scopes li::before {
            content: "✓";
            color: #48bb78;
            font-weight: bold;
            font-size: 18px;
        }

        .actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 24px;
        }

        button {
            padding: 14px 28px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            width: 100%;
        }

        .btn-primary {
            background: linear-gradient(135deg, ${getPlatformGradient(platform)});
            color: white;
            box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }

        .btn-secondary {
            background: white;
            color: #4a5568;
            border: 2px solid #e2e8f0;
        }

        .btn-secondary:hover {
            background: #f7fafc;
            border-color: #cbd5e0;
        }

        .demo-badge {
            display: inline-block;
            background: #fef5e7;
            color: #d97706;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 24px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="platform-logo">${getPlatformIcon(platform)}</div>
        <h1>Connect to ${getPlatformName(platform)}</h1>
        <p class="subtitle">VaultLister wants to access your ${getPlatformName(platform)} account</p>

        <div class="app-info">
            <div class="app-name">📦 VaultLister</div>

            <div class="scopes">
                <h3>This app will be able to:</h3>
                <ul>
                    <li>View your profile information</li>
                    <li>Read your listings</li>
                    <li>Create and update listings</li>
                    <li>View sales data</li>
                </ul>
            </div>
        </div>

        <div class="actions">
            <button class="btn-primary" onclick="approve()">
                Authorize VaultLister
            </button>
            <button class="btn-secondary" onclick="deny()">
                Cancel
            </button>
        </div>

        <div class="demo-badge">
            🧪 DEMO MODE - Mock OAuth
        </div>
    </div>

    <script>
        function approve() {
            // Generate mock authorization code
            const code = 'mock_auth_code_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16) + '_' + Date.now();
            const redirectUrl = decodeURIComponent('${encodeURIComponent(redirect_uri)}') + '?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(decodeURIComponent('${encodeURIComponent(state)}'));
            window.location.href = redirectUrl;
        }

        function deny() {
            const redirectUrl = decodeURIComponent('${encodeURIComponent(redirect_uri)}') + '?error=access_denied&state=' + encodeURIComponent(decodeURIComponent('${encodeURIComponent(state)}')) + '&error_description=' + encodeURIComponent('User denied authorization');
            window.location.href = redirectUrl;
        }
    </script>
</body>
</html>
            `
        };
    }

    // POST /mock-oauth/:platform/token - Exchange code for tokens
    if (method === 'POST' && path.match(/^\/[a-z]+\/token$/)) {
        // Mock always returns success with instant tokens
        return {
            status: 200,
            data: {
                access_token: `mock_access_${platform}_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
                refresh_token: `mock_refresh_${platform}_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`,
                token_type: 'Bearer',
                expires_in: 3600,
                scope: 'read write listings profile'
            }
        };
    }

    // GET /mock-oauth/:platform/user - Get user info
    if (method === 'GET' && path.match(/^\/[a-z]+\/user$/)) {
        const userId = crypto.randomUUID().split('-')[0];

        return {
            status: 200,
            data: {
                id: `demo_${platform}_user_${userId}`,
                username: `demo_${platform}_seller`,
                email: `demo@${platform}.example.com`,
                display_name: `Demo ${getPlatformName(platform)} Seller`,
                avatar_url: null,
                verified: true,
                created_at: new Date().toISOString()
            }
        };
    }

    // POST /mock-oauth/:platform/revoke - Revoke token
    if (method === 'POST' && path.match(/^\/[a-z]+\/revoke$/)) {
        // Mock revocation always succeeds
        return {
            status: 200,
            data: {
                success: true,
                message: 'Token revoked successfully'
            }
        };
    }

    return { status: 404, data: { error: 'Mock OAuth route not found' } };
}

// ===== Helper Functions =====

function getPlatformName(platform) {
    const names = {
        poshmark: 'Poshmark',
        ebay: 'eBay',
        whatnot: 'Whatnot',
        depop: 'Depop',
        shopify: 'Shopify',
        facebook: 'Facebook Marketplace',
        mercari: 'Mercari',
        grailed: 'Grailed'
    };
    return names[platform] || platform.replace(/[^a-zA-Z0-9 -]/g, '').charAt(0).toUpperCase() + platform.replace(/[^a-zA-Z0-9 -]/g, '').slice(1);
}

function getPlatformIcon(platform) {
    const icons = {
        poshmark: '👗',
        ebay: '🛒',
        whatnot: '🎥',
        depop: '👕',
        shopify: '🛍️',
        facebook: '🏪',
        mercari: '📦',
        grailed: '👔'
    };
    return icons[platform] || '🏬';
}

function getPlatformGradient(platform) {
    const gradients = {
        poshmark: '#ac74d6, #d946b6',
        ebay: '#0064d2, #008bff',
        whatnot: '#00c853, #00e676',
        depop: '#ff2600, #ff4d4d',
        shopify: '#96bf48, #7ab55c',
        facebook: '#1877f2, #42a5f5',
        mercari: '#ea5c47, #ef7b6f',
        grailed: '#000000, #4a4a4a'
    };
    return gradients[platform] || '#667eea, #764ba2';
}
