'use strict';

(function () {
    const STORAGE_KEY = 'vaultlister_state';
    const DASHBOARD_URL = '/?app=1#dashboard';
    const LOGIN_URL = '/?app=1#login';

    function parseState(raw) {
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    function getStoredState() {
        const sessionState = parseState(sessionStorage.getItem(STORAGE_KEY));
        const localState = parseState(localStorage.getItem(STORAGE_KEY));
        return {
            session: sessionState,
            local: localState,
            user: sessionState?.user || localState?.user || null,
            refreshToken: sessionState?.refreshToken || null,
            token: sessionState?.token || null
        };
    }

    function getDisplayName(user) {
        if (!user || typeof user !== 'object') return 'Account';
        return user.full_name || user.username || user.email || 'Account';
    }

    function getInitials(user) {
        const source = getDisplayName(user).trim();
        if (!source || source === 'Account') return 'VL';
        const parts = source.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return source.slice(0, 2).toUpperCase();
    }

    async function hasActiveSession(stored) {
        if (stored.token && stored.user) return true;
        try {
            const response = await fetch('/api/auth/session-status', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    function clearClientSession() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            Object.keys(localStorage).forEach((key) => {
                if (key.startsWith('vaultlister_')) {
                    localStorage.removeItem(key);
                }
            });
        } catch {}

        try {
            sessionStorage.clear();
        } catch {}
    }

    async function getCsrfToken() {
        try {
            const response = await fetch('/api/settings/announcement', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            });
            return response.headers.get('X-CSRF-Token') || response.headers.get('CSRF-Token') || '';
        } catch {
            return '';
        }
    }

    async function performLogout(refreshToken, trigger) {
        if (trigger) {
            trigger.disabled = true;
            trigger.textContent = 'Logging out...';
        }

        try {
            const csrfToken = await getCsrfToken();
            const headers = { 'Content-Type': 'application/json' };
            if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers,
                body: JSON.stringify(refreshToken ? { refreshToken } : {})
            });
        } catch {
            // Clear local session state even if the network request fails.
        } finally {
            clearClientSession();
            window.location.href = LOGIN_URL;
        }
    }

    function closeProfileMenus() {
        document.querySelectorAll('.public-auth-menu.open').forEach((menu) => {
            menu.classList.remove('open');
        });
        document.querySelectorAll('.public-profile-trigger[aria-expanded="true"]').forEach((button) => {
            button.setAttribute('aria-expanded', 'false');
        });
    }

    function buildDesktopAuthShell(user, refreshToken) {
        const shell = document.createElement('div');
        shell.className = 'public-auth-shell';
        shell.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'public-profile-trigger';
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', `Open account menu (${getInitials(user)})`);
        trigger.textContent = getInitials(user);

        const menu = document.createElement('div');
        menu.className = 'public-auth-menu';
        menu.setAttribute('role', 'menu');

        const header = document.createElement('div');
        header.className = 'public-auth-menu-header';

        const label = document.createElement('span');
        label.className = 'public-auth-menu-label';
        label.textContent = 'Signed In';

        const userLabel = document.createElement('span');
        userLabel.className = 'public-auth-menu-user';
        userLabel.textContent = getDisplayName(user);

        header.append(label, userLabel);

        const dashboardLink = document.createElement('a');
        dashboardLink.className = 'public-auth-item';
        dashboardLink.href = DASHBOARD_URL;
        dashboardLink.setAttribute('role', 'menuitem');
        dashboardLink.textContent = 'Return to Dashboard';

        const logoutButton = document.createElement('button');
        logoutButton.type = 'button';
        logoutButton.className = 'public-auth-item-btn public-auth-item-danger';
        logoutButton.setAttribute('role', 'menuitem');
        logoutButton.textContent = 'Logout';
        logoutButton.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            performLogout(refreshToken, logoutButton);
        });

        trigger.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            const willOpen = !menu.classList.contains('open');
            closeProfileMenus();
            if (willOpen) {
                menu.classList.add('open');
                trigger.setAttribute('aria-expanded', 'true');
            }
        });

        menu.addEventListener('click', function (event) {
            event.stopPropagation();
        });

        menu.append(header, dashboardLink, logoutButton);
        shell.append(trigger, menu);
        return shell;
    }

    function mountDesktopAuth(user, refreshToken) {
        const navActions = document.querySelector('.nav-actions');
        if (!navActions || navActions.dataset.publicAuthMounted === '1') return;

        navActions.querySelectorAll('a[href="/?app=1#login"], a[href="/?app=1#register"]').forEach((node) => {
            node.remove();
        });

        navActions.appendChild(buildDesktopAuthShell(user, refreshToken));
        navActions.dataset.publicAuthMounted = '1';
    }

    function mountMobileAuth(user, refreshToken) {
        document.querySelectorAll('.mobile-nav-actions').forEach((container) => {
            if (container.dataset.publicAuthMounted === '1') return;

            container.querySelectorAll('a[href="/?app=1#login"], a[href="/?app=1#register"]').forEach((node) => {
                node.remove();
            });

            const group = document.createElement('div');
            group.className = 'public-auth-mobile-group';

            const userLabel = document.createElement('div');
            userLabel.className = 'public-auth-mobile-user';
            userLabel.textContent = getDisplayName(user);

            const dashboardLink = document.createElement('a');
            dashboardLink.className = 'btn btn-primary';
            dashboardLink.href = DASHBOARD_URL;
            dashboardLink.textContent = 'Return to Dashboard';

            const logoutButton = document.createElement('button');
            logoutButton.type = 'button';
            logoutButton.className = 'btn btn-ghost';
            logoutButton.textContent = 'Logout';
            logoutButton.addEventListener('click', function () {
                performLogout(refreshToken, logoutButton);
            });

            group.append(userLabel, dashboardLink, logoutButton);
            container.appendChild(group);
            container.dataset.publicAuthMounted = '1';
        });
    }

    document.addEventListener('click', function (event) {
        if (!event.isTrusted) {
            return;
        }
        if (event.target instanceof Element && event.target.closest('.public-auth-shell')) {
            return;
        }
        closeProfileMenus();
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeProfileMenus();
        }
    });

    document.addEventListener('DOMContentLoaded', async function () {
        const stored = getStoredState();
        if (!(await hasActiveSession(stored))) return;

        mountDesktopAuth(stored.user, stored.refreshToken);
        mountMobileAuth(stored.user, stored.refreshToken);
    });
})();
