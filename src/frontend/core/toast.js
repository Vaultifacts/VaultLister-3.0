'use strict';
// Toast notification system
// Extracted from app.js lines 8552-8639

// ============================================
// Toast Notifications
// ============================================
const toast = {
    activeToasts: [],
    maxToasts: 5,

    show(message, type = 'info', options = {}) {
        const { duration = 5000, undoAction = null, undoLabel = 'Undo', showProgress = true } = options;
        const container = document.getElementById('toast-container');

        // Limit number of toasts
        while (this.activeToasts.length >= this.maxToasts) {
            const oldest = this.activeToasts.shift();
            oldest?.remove();
        }

        const toastEl = document.createElement('div');
        const toastId = 'toast-' + Date.now();
        toastEl.id = toastId;
        toastEl.className = `toast toast-${type}`;
        toastEl.setAttribute('role', type === 'error' ? 'alert' : 'status');
        toastEl.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

        toastEl.innerHTML = `
            <span class="toast-icon">${this.getIcon(type)}</span>
            <div class="toast-content">
                <p class="toast-message">${escapeHtml(message)}</p>
                ${undoAction ? `
                    <div class="toast-actions">
                        <button class="toast-action-btn undo" onclick="toast.handleUndo('${toastId}', ${undoAction})">${escapeHtml(undoLabel)}</button>
                    </div>
                ` : ''}
            </div>
            <button class="toast-close" aria-label="Dismiss notification" onclick="toast.dismiss('${toastId}')">${components.icon('close', 14)}</button>
            ${showProgress && duration > 0 ? `<div class="toast-progress" style="animation-duration: ${duration}ms"></div>` : ''}
        `;

        container.appendChild(toastEl);
        this.activeToasts.push(toastEl);

        if (duration > 0) {
            setTimeout(() => this.dismiss(toastId), duration);
        }

        return toastId;
    },

    dismiss(toastId) {
        const toastEl = document.getElementById(toastId);
        if (toastEl) {
            toastEl.classList.add('toast-exit');
            setTimeout(() => {
                toastEl.remove();
                this.activeToasts = this.activeToasts.filter(t => t.id !== toastId);
            }, 200);
        }
    },

    handleUndo(toastId, undoFn) {
        if (typeof undoFn === 'function') {
            undoFn();
        }
        this.dismiss(toastId);
        this.success('Action undone');
    },

    getIcon(type) {
        const icons = {
            success: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            error: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            warning: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
        };
        return icons[type] || icons.info;
    },

    success(message, options = {}) { return this.show(message, 'success', options); },
    error(message, options = {}) { return this.show(message, 'error', { duration: 7000, ...options }); },
    warning(message, options = {}) { return this.show(message, 'warning', options); },
    info(message, options = {}) { return this.show(message, 'info', options); },

    // Helper for destructive actions with undo
    withUndo(message, undoAction, type = 'success') {
        return this.show(message, type, { undoAction, duration: 8000 });
    }
};
