'use strict';
// Authentication + voice commands
// Extracted from app.js lines 37271-37527

// ============================================
// Authentication
// ============================================
const auth = {
    async login(event) {
        event.preventDefault();
        if (this._isSubmitting) return;
        this._isSubmitting = true;
        const form = event.target;
        form.querySelectorAll('.field-error, .field-valid').forEach(el => {
            el.classList.remove('field-error', 'field-valid');
        });
        const email = form.email.value;
        const password = form.password.value;
        const submitBtn = document.getElementById('login-submit-btn');
        const alertDiv = document.getElementById('login-alert');
        const inputs = form.querySelectorAll('input');

        // Clear previous error/lockout messages on retry
        if (alertDiv) {
            alertDiv.style.display = 'none';
            alertDiv.className = 'login-alert';
        }

        // Loading state
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = sanitizeHTML('<span class="auth-spinner"></span> Signing in...');  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        }
        inputs.forEach(i => i.disabled = true);

        try {
            const data = await api.post('/auth/login', { email, password });

            // Handle MFA challenge — backend returns mfaRequired without a token
            if (data.mfaRequired) {
                store.setState({ pendingMfaToken: data.mfaToken });
                modals.show(`
                    <div class="modal-header"><h3>Two-Factor Authentication</h3><button class="modal-close" aria-label="Close" onclick="modals.close()">&times;</button></div>
                    <div class="modal-body">
                        <p style="margin-bottom: 16px;">Enter the 6-digit code from your authenticator app.</p>
                        <form onsubmit="handlers.verifyMfaLogin(event)">
                            <input type="text" class="form-input" name="code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required autofocus style="text-align:center; font-size:24px; letter-spacing:8px;">
                            <button type="submit" class="btn btn-primary" style="width:100%; margin-top:12px;">Verify</button>
                        </form>
                    </div>
                `);
                return;
            }

            // Remember me: use sessionStorage if unchecked
            const rememberMe = document.getElementById('remember-me')?.checked;
            if (!rememberMe) {
                store.setState({ useSessionStorage: true });
            }

            store.setState({
                user: data.user,
                token: data.token,
                refreshToken: data.refreshToken
            });
            // Connect WebSocket immediately after login (DOMContentLoaded already fired)
            if (window.VaultListerSocket) {
                window.VaultListerSocket.connect(data.token).catch(() => {});
            }
            if (window._loginBanCountdown) {
                clearInterval(window._loginBanCountdown);
                window._loginBanCountdown = null;
            }
            const dest = store.state._intendedRoute || 'dashboard';
            store.setState({ _intendedRoute: null });
            router.navigate(dest);
            toast.success('Welcome back!');
        } catch (error) {
            // Show specific message for rate limiting (429)
            if (error.status === 429) {
                const retryAfter = error.data?.retryAfter || error.data?.retry_after;
                const isIpBan = error.data?.error?.includes('temporarily blocked') || (retryAfter && retryAfter > 60);
                if (alertDiv) {
                    if (isIpBan) {
                        let secondsLeft = retryAfter || 900;
                        const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
                        alertDiv.innerHTML = sanitizeHTML(`<strong>Too many failed attempts.</strong> Login is temporarily locked for security. Try again in <span id="login-ban-countdown">${fmt(secondsLeft)}</span>.`);  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                        alertDiv.className = 'login-alert alert-danger';
                        alertDiv.style.display = 'block';
                        if (window._loginBanCountdown) clearInterval(window._loginBanCountdown);
                        window._loginBanCountdown = setInterval(() => {
                            secondsLeft--;
                            const el = document.getElementById('login-ban-countdown');
                            if (secondsLeft <= 0 || !el) {
                                clearInterval(window._loginBanCountdown);
                                if (alertDiv) alertDiv.style.display = 'none';
                                return;
                            }
                            el.textContent = fmt(secondsLeft);
                        }, 1000);
                    } else {
                        const mins = retryAfter ? Math.ceil(retryAfter / 60) : null;
                        const msg = mins ? `Too many login attempts. Please wait ${mins} minute${mins !== 1 ? 's' : ''}.` : 'Too many login attempts. Please wait a moment.';
                        alertDiv.innerHTML = sanitizeHTML(`<strong>Rate limited.</strong> ${msg}`);  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                        alertDiv.className = 'login-alert alert-warning';
                        alertDiv.style.display = 'block';
                    }
                }
                toast.error(isIpBan ? 'Login temporarily locked. See message on screen.' : 'Too many attempts. Please wait.');
                return;
            }

            // Show remaining attempts / lockout info
            if (alertDiv && error.data) {
                if (error.data.locked) {
                    const mins = Math.ceil((error.data.retryAfter || 900) / 60);
                    alertDiv.innerHTML = sanitizeHTML(`<strong>Account locked.</strong> Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`);  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                    alertDiv.className = 'login-alert alert-danger';
                    alertDiv.style.display = 'block';
                    // Start countdown
                    let secondsLeft = error.data.retryAfter || 900;
                    if (window._lockoutCountdown) clearInterval(window._lockoutCountdown);
                    window._lockoutCountdown = setInterval(() => {
                        secondsLeft--;
                        if (secondsLeft <= 0) {
                            clearInterval(window._lockoutCountdown);
                            alertDiv.style.display = 'none';
                            return;
                        }
                        const m = Math.floor(secondsLeft / 60);
                        const s = secondsLeft % 60;
                        alertDiv.innerHTML = sanitizeHTML(`<strong>Account locked.</strong> Try again in ${m}:${s.toString().padStart(2, '0')}`);  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                    }, 1000);
                } else if (typeof error.data.remainingAttempts === 'number' && error.data.remainingAttempts <= 3) {
                    alertDiv.innerHTML = sanitizeHTML(`<strong>Warning:</strong> ${error.data.remainingAttempts} attempt${error.data.remainingAttempts !== 1 ? 's' : ''} remaining before lockout.`);  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
                    alertDiv.className = 'login-alert alert-warning';
                    alertDiv.style.display = 'block';
                } else {
                    alertDiv.style.display = 'none';
                }
            }
            toast.error(error.message || 'Invalid email or password');
        } finally {
            this._isSubmitting = false;
            // Restore form state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = sanitizeHTML('Sign In');  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            }
            inputs.forEach(i => i.disabled = false);
        }
    },

    async logout() {
        try {
            await api.post('/auth/logout', { refreshToken: store.state.refreshToken });
        } catch (e) {}

        store.setState({ user: null, token: null, refreshToken: null, useSessionStorage: false });
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('vaultlister_')) localStorage.removeItem(key);
        });
        sessionStorage.clear();
        // Clear SW SWR cache so next user on shared device cannot see this user's
        // templates or checklist data from the service worker cache.
        navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER_CACHE' });
        router.navigate('login');
        toast.info('Logged out successfully');
    },

    isAuthenticated() {
        return !!store.state.token;
    },

    async register(event) {
        event.preventDefault();
        if (this._isSubmitting) return;
        this._isSubmitting = true;
        const form = event.target;
        const email = form.email.value;
        const username = form.username.value;
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;
        const submitBtn = document.getElementById('register-submit-btn');
        const inputs = form.querySelectorAll('input');

        if (password !== confirmPassword) {
            this._isSubmitting = false;
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 12) {
            this._isSubmitting = false;
            toast.error('Password must be at least 12 characters');
            return;
        }

        // Loading state
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = sanitizeHTML('<span class="auth-spinner"></span> Creating account...');  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        }
        inputs.forEach(i => i.disabled = true);

        try {
            const data = await api.post('/auth/register', { email, username, password });
            store.setState({
                user: data.user,
                token: data.token,
                refreshToken: data.refreshToken,
                pendingVerificationEmail: email
            });
            router.navigate('email-verification');
            toast.success('Account created successfully!');
        } catch (error) {
            toast.error(error.message || 'Registration failed');
        } finally {
            this._isSubmitting = false;
            // Restore form state
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = sanitizeHTML('Create Account');  // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            }
            inputs.forEach(i => i.disabled = false);
        }
    }
};

// ============================================
// Voice Commands (Web Speech API)
// ============================================
const voiceCommands = {
    recognition: null,
    isListening: false,

    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            if (!event.results?.[0]?.[0]?.transcript) return;
            const command = event.results[0][0].transcript.toLowerCase();
            this.processCommand(command);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            const indicator = document.getElementById('voice-indicator');
            if (indicator) {
                indicator.classList.add('hidden');
            }
        };
    },

    start() {
        if (!this.recognition) {
            toast.warning('Voice commands not supported in this browser');
            return;
        }

        this.recognition.start();
        this.isListening = true;
        const indicator = document.getElementById('voice-indicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
    },

    processCommand(command) {
        if (command.includes('go to') || command.includes('open')) {
            if (command.includes('dashboard')) router.navigate('dashboard');
            else if (command.includes('inventory')) router.navigate('inventory');
            else if (command.includes('listing')) router.navigate('listings');
            else if (command.includes('sales')) router.navigate('sales');
            else if (command.includes('settings')) router.navigate('settings');
        } else if (command.includes('add item') || command.includes('new item')) {
            modals.addItem();
        } else if (command.includes('search')) {
            document.getElementById('global-search')?.focus();
        } else {
            toast.info(`Command not recognized: "${command}"`);
        }
    }
};
