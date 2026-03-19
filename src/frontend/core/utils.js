'use strict';
// Utility functions, error handlers, UI helpers
// Extracted from app.js lines 1-7717

// VaultLister Frontend Application
// Lightweight SPA with vanilla JS

// ============================================
// Global Error Handlers
// ============================================
window.onerror = function(message, source, lineno, colno, error) {
    console.error('[GlobalError]', message, source, lineno, colno, error);
    return false; // Let default handler also fire
};

window.addEventListener('unhandledrejection', function(event) {
    console.error('[UnhandledRejection]', event.reason);
});

// ============================================
// Utility Functions
// ============================================
// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function highlightText(text, query) {
    if (!text || !query) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(`(${q})`, 'gi'), '<mark class="search-highlight">$1</mark>');
}

// Format a Date as YYYY-MM-DD in the LOCAL timezone (not UTC)
// Use instead of toISOString().split('T')[0] which shifts dates near midnight
function toLocalDate(d) {
    if (!(d instanceof Date)) d = new Date(d);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================
// UI Enhancement Utilities - Session 28
// ============================================

// Form validation utilities (additional helpers)
const formUtils = {
    // Validate a single input field with rules object
    validateInput(input, rules = {}) {
        const value = input.value.trim();
        const errors = [];

        if (rules.required && !value) {
            errors.push('This field is required');
        }
        if (rules.minLength && value.length < rules.minLength) {
            errors.push(`Minimum ${rules.minLength} characters required`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
            errors.push(`Maximum ${rules.maxLength} characters allowed`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
            errors.push(rules.patternMessage || 'Invalid format');
        }
        if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push('Invalid email address');
        }
        if (rules.number && value && isNaN(Number(value))) {
            errors.push('Must be a number');
        }
        if (rules.min !== undefined && Number(value) < rules.min) {
            errors.push(`Minimum value is ${rules.min}`);
        }
        if (rules.max !== undefined && Number(value) > rules.max) {
            errors.push(`Maximum value is ${rules.max}`);
        }

        return { valid: errors.length === 0, errors };
    },

    // Show validation state on input
    showValidation(input, isValid, message = '') {
        input.classList.remove('is-valid', 'is-invalid');
        input.classList.add(isValid ? 'is-valid' : 'is-invalid');

        // Remove existing feedback
        const existingFeedback = input.parentElement.querySelector('.invalid-feedback, .valid-feedback');
        if (existingFeedback) existingFeedback.remove();

        // Add new feedback if message provided
        if (message) {
            const feedback = document.createElement('div');
            feedback.className = isValid ? 'valid-feedback' : 'invalid-feedback';
            feedback.textContent = message;
            input.parentElement.appendChild(feedback);
        }
    },

    // Clear validation state
    clearValidation(input) {
        input.classList.remove('is-valid', 'is-invalid');
        const feedback = input.parentElement.querySelector('.invalid-feedback, .valid-feedback');
        if (feedback) feedback.remove();
    },

    // Password strength checker
    checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        const levels = ['weak', 'weak', 'fair', 'good', 'strong', 'strong'];
        return { score: strength, level: levels[strength] };
    }
};

// Character counter for textareas
const charCounter = {
    init(textarea, maxLength) {
        const counter = document.createElement('div');
        counter.className = 'char-counter';
        counter.textContent = `0 / ${maxLength}`;
        textarea.parentElement.appendChild(counter);

        textarea.addEventListener('input', () => {
            const current = textarea.value.length;
            counter.textContent = `${current} / ${maxLength}`;
            counter.classList.remove('warning', 'danger');
            if (current > maxLength * 0.9) {
                counter.classList.add('danger');
            } else if (current > maxLength * 0.75) {
                counter.classList.add('warning');
            }
        });
    }
};

// Ripple effect for buttons
const rippleEffect = {
    init() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-ripple');
            if (!btn) return;

            const ripple = document.createElement('span');
            ripple.className = 'ripple-effect';
            const rect = btn.getBoundingClientRect();
            ripple.style.left = `${e.clientX - rect.left}px`;
            ripple.style.top = `${e.clientY - rect.top}px`;
            btn.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    }
};

// Table sorting utilities
const tableSorter = {
    sortTable(table, columnIndex, direction = 'asc') {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
            const aValue = a.cells[columnIndex].textContent.trim();
            const bValue = b.cells[columnIndex].textContent.trim();

            // Try numeric comparison first
            const aNum = parseFloat(aValue.replace(/[$,]/g, ''));
            const bNum = parseFloat(bValue.replace(/[$,]/g, ''));

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return direction === 'asc' ? aNum - bNum : bNum - aNum;
            }

            // Fall back to string comparison
            return direction === 'asc'
                ? aValue.localeCompare(bValue)
                : bValue.localeCompare(aValue);
        });

        rows.forEach(row => tbody.appendChild(row));
    },

    initSortableHeaders(table) {
        const headers = table.querySelectorAll('th.sortable');
        headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                const currentDirection = header.classList.contains('sorted-asc') ? 'desc' : 'asc';

                // Remove sort classes from all headers
                headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));

                // Add sort class to clicked header
                header.classList.add(`sorted-${currentDirection}`);

                this.sortTable(table, index, currentDirection);
            });
        });
    }
};

// Animation helpers
const animations = {
    // Fade in element
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';

        requestAnimationFrame(() => {
            element.style.transition = `opacity ${duration}ms ease`;
            element.style.opacity = '1';
        });

        return new Promise(resolve => setTimeout(resolve, duration));
    },

    // Fade out element
    fadeOut(element, duration = 300) {
        element.style.transition = `opacity ${duration}ms ease`;
        element.style.opacity = '0';

        return new Promise(resolve => {
            setTimeout(() => {
                element.style.display = 'none';
                resolve();
            }, duration);
        });
    },

    // Slide in from direction
    slideIn(element, direction = 'up', duration = 300) {
        const transforms = {
            up: 'translateY(20px)',
            down: 'translateY(-20px)',
            left: 'translateX(20px)',
            right: 'translateX(-20px)'
        };

        element.style.opacity = '0';
        element.style.transform = transforms[direction];
        element.style.display = 'block';

        requestAnimationFrame(() => {
            element.style.transition = `all ${duration}ms ease`;
            element.style.opacity = '1';
            element.style.transform = 'translate(0, 0)';
        });

        return new Promise(resolve => setTimeout(resolve, duration));
    },

    // Stagger children animations
    staggerChildren(parent, animation = 'fade-in', staggerDelay = 50) {
        const children = Array.from(parent.children);
        children.forEach((child, index) => {
            child.style.opacity = '0';
            child.classList.add(animation);
            child.style.animationDelay = `${index * staggerDelay}ms`;
            child.style.animationFillMode = 'forwards';
        });
    }
};

// Tooltip controller
const tooltips = {
    show(element, text, position = 'top') {
        element.setAttribute('data-tooltip', text);
        element.setAttribute('data-tooltip-position', position);
    },

    hide(element) {
        element.removeAttribute('data-tooltip');
        element.removeAttribute('data-tooltip-position');
    }
};

// Alert component
const alerts = {
    create(type, title, message, dismissible = true) {
        const icons = {
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
        };

        const id = `alert-${Date.now()}`;
        const html = `
            <div id="${id}" class="alert alert-${type}">
                <span class="alert-icon">${icons[type]}</span>
                <div class="alert-content">
                    ${title ? `<div class="alert-title">${escapeHtml(title)}</div>` : ''}
                    <div class="alert-description">${escapeHtml(message)}</div>
                </div>
                ${dismissible ? `<button class="alert-dismiss" onclick="document.getElementById('${id}').remove()">×</button>` : ''}
            </div>
        `;

        return html;
    }
};

// Breadcrumb generator
const breadcrumbs = {
    generate(items) {
        if (!items || items.length === 0) return '';

        const separator = '<span class="breadcrumb-separator">/</span>';

        return `
            <nav class="breadcrumb" aria-label="Breadcrumb">
                ${items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    if (isLast) {
                        return `<span class="breadcrumb-item active" aria-current="page">${escapeHtml(item.label)}</span>`;
                    }
                    return `
                        <span class="breadcrumb-item">
                            <a href="#" onclick="${item.onclick || `router.navigate('${item.page}')`}; return false;">${escapeHtml(item.label)}</a>
                        </span>
                        ${separator}
                    `;
                }).join('')}
            </nav>
        `;
    }
};

// Empty state generator
const emptyStates = {
    generate(options = {}) {
        const {
            icon = 'package',
            title = 'No items found',
            description = 'There are no items to display.',
            actionLabel = null,
            actionOnclick = null,
            secondaryLabel = null,
            secondaryOnclick = null,
            variant = '' // '', 'compact', 'inline'
        } = options;

        return `
            <div class="empty-state ${variant}">
                <div class="empty-state-icon">${components.icon(icon, 64)}</div>
                <h3 class="empty-state-title">${escapeHtml(title)}</h3>
                <p class="empty-state-description">${escapeHtml(description)}</p>
                ${actionLabel || secondaryLabel ? `
                    <div class="empty-state-actions">
                        ${actionLabel ? `<button class="btn btn-primary" onclick="${escapeHtml(actionOnclick)}">${escapeHtml(actionLabel)}</button>` : ''}
                        ${secondaryLabel ? `<button class="btn btn-secondary" onclick="${escapeHtml(secondaryOnclick)}">${escapeHtml(secondaryLabel)}</button>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }
};

// Content placeholder/skeleton loader generator
const skeletons = {
    // Generate a skeleton line
    line(width = '100%') {
        return `<div class="skeleton-loading" style="width: ${width}; height: 16px; margin-bottom: 8px;"></div>`;
    },

    // Generate a skeleton card
    card() {
        return `
            <div class="card">
                <div class="card-body">
                    <div class="skeleton-loading" style="width: 60%; height: 20px; margin-bottom: 12px;"></div>
                    <div class="skeleton-loading" style="width: 100%; height: 14px; margin-bottom: 8px;"></div>
                    <div class="skeleton-loading" style="width: 80%; height: 14px; margin-bottom: 8px;"></div>
                    <div class="skeleton-loading" style="width: 40%; height: 14px;"></div>
                </div>
            </div>
        `;
    },

    // Generate skeleton table rows
    tableRows(count = 5, columns = 4) {
        let rows = '';
        for (let i = 0; i < count; i++) {
            rows += '<tr>';
            for (let j = 0; j < columns; j++) {
                const width = Math.floor(Math.random() * 40) + 60;
                rows += `<td><div class="skeleton-loading" style="width: ${width}%; height: 16px;"></div></td>`;
            }
            rows += '</tr>';
        }
        return rows;
    },

    // Generate content placeholder
    content(lines = 3) {
        return `
            <div class="content-placeholder">
                ${Array(lines).fill(0).map(() => '<div class="content-placeholder-line"></div>').join('')}
            </div>
        `;
    }
};

// Status indicator generator
const statusIndicators = {
    dot(status, animated = false) {
        const statusMap = {
            'active': 'online',
            'online': 'online',
            'success': 'online',
            'inactive': 'offline',
            'offline': 'offline',
            'pending': 'away',
            'warning': 'away',
            'error': 'busy',
            'busy': 'busy'
        };
        const dotClass = statusMap[status] || 'offline';
        return `<span class="status-dot ${dotClass} ${animated ? 'animated' : ''}"></span><span class="sr-only">${status}</span>`;
    }
};

// ============================================
// Interactive Components - Session 28 Part 2
// ============================================

// Toggle Switch Controller
const toggleSwitch = {
    create(id, label, checked = false, onChange = null) {
        return `
            <label class="toggle-switch">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}
                    ${onChange ? `onchange="${onChange}"` : ''}>
                <span class="toggle-switch-slider"></span>
                ${label ? `<span class="toggle-switch-label">${escapeHtml(label)}</span>` : ''}
            </label>
        `;
    }
};

// Stepper/Quantity Input Controller
const stepper = {
    create(id, value = 1, min = 0, max = 999, onChange = null) {
        return `
            <div class="stepper" data-stepper-id="${id}">
                <button type="button" class="stepper-btn" onclick="stepper.decrement('${id}')" ${value <= min ? 'disabled' : ''}>−</button>
                <input type="number" class="stepper-input" id="${id}" value="${value}"
                    min="${min}" max="${max}" onchange="stepper.validate('${id}')">
                <button type="button" class="stepper-btn" onclick="stepper.increment('${id}')" ${value >= max ? 'disabled' : ''}>+</button>
            </div>
        `;
    },
    increment(id) {
        const input = document.getElementById(id);
        if (!input) return;
        const max = parseInt(input.max) || 999;
        const current = parseInt(input.value) || 0;
        if (current < max) {
            input.value = current + 1;
            this.updateButtons(id);
            input.dispatchEvent(new Event('change'));
        }
    },
    decrement(id) {
        const input = document.getElementById(id);
        if (!input) return;
        const min = parseInt(input.min) || 0;
        const current = parseInt(input.value) || 0;
        if (current > min) {
            input.value = current - 1;
            this.updateButtons(id);
            input.dispatchEvent(new Event('change'));
        }
    },
    validate(id) {
        const input = document.getElementById(id);
        if (!input) return;
        const min = parseInt(input.min) || 0;
        const max = parseInt(input.max) || 999;
        let value = parseInt(input.value) || min;
        value = Math.max(min, Math.min(max, value));
        input.value = value;
        this.updateButtons(id);
    },
    updateButtons(id) {
        const container = document.querySelector(`[data-stepper-id="${id}"]`);
        if (!container) return;
        const input = container.querySelector('input');
        const [decBtn, incBtn] = container.querySelectorAll('.stepper-btn');
        const min = parseInt(input.min) || 0;
        const max = parseInt(input.max) || 999;
        const value = parseInt(input.value) || 0;
        decBtn.disabled = value <= min;
        incBtn.disabled = value >= max;
    }
};

// Accordion Controller
const accordion = {
    toggle(element) {
        const item = element.closest('.accordion-item');
        if (!item) return;

        const isOpen = item.classList.contains('open');

        // Close all other items in the same accordion (optional)
        const accordion = item.closest('.accordion');
        if (accordion && accordion.dataset.singleOpen === 'true') {
            accordion.querySelectorAll('.accordion-item.open').forEach(openItem => {
                if (openItem !== item) openItem.classList.remove('open');
            });
        }

        item.classList.toggle('open', !isOpen);
    },

    openAll(accordionEl) {
        accordionEl.querySelectorAll('.accordion-item').forEach(item => {
            item.classList.add('open');
        });
    },

    closeAll(accordionEl) {
        accordionEl.querySelectorAll('.accordion-item').forEach(item => {
            item.classList.remove('open');
        });
    }
};

// Range Slider Controller
const rangeSlider = {
    init(sliderId) {
        const slider = document.getElementById(sliderId);
        if (!slider) return;

        const track = slider.parentElement.querySelector('.range-slider-track');
        const valueDisplay = slider.parentElement.querySelector('.range-slider-value');

        const updateSlider = () => {
            const min = parseInt(slider.min) || 0;
            const max = parseInt(slider.max) || 100;
            const value = parseInt(slider.value) || 0;
            const percentage = ((value - min) / (max - min)) * 100;

            if (track) track.style.width = `${percentage}%`;
            if (valueDisplay) valueDisplay.textContent = value;
        };

        slider.addEventListener('input', updateSlider);
        updateSlider();
    }
};

// Progress Circle Generator
const progressCircle = {
    create(percentage, size = 80, strokeWidth = 8, options = {}) {
        const { showValue = true, colorClass = '' } = options;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percentage / 100) * circumference;

        return `
            <div class="progress-circle ${colorClass}" style="width: ${size}px; height: ${size}px;">
                <svg width="${size}" height="${size}">
                    <circle class="progress-circle-bg" cx="${size/2}" cy="${size/2}" r="${radius}"
                        stroke-width="${strokeWidth}"/>
                    <circle class="progress-circle-progress" cx="${size/2}" cy="${size/2}" r="${radius}"
                        stroke-width="${strokeWidth}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"/>
                </svg>
                ${showValue ? `<span class="progress-circle-value">${Math.round(percentage)}%</span>` : ''}
            </div>
        `;
    }
};

// Sparkline Chart Generator
const sparkline = {
    create(data, width = 100, height = 30, options = {}) {
        const { showArea = true, trend = null } = options;

        if (!data || data.length < 2) return '';

        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        const points = data.map((value, index) => {
            const x = (index / Math.max(data.length - 1, 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        const areaPoints = `0,${height} ${points} ${width},${height}`;

        const trendClass = trend || (data[data.length - 1] > data[0] ? 'trend-up' : 'trend-down');

        return `
            <div class="sparkline ${trendClass}">
                <svg class="sparkline-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                    ${showArea ? `<polygon class="sparkline-area" points="${areaPoints}"/>` : ''}
                    <polyline class="sparkline-line" points="${points}" fill="none"/>
                </svg>
            </div>
        `;
    }
};

// Bottom Sheet Controller
const bottomSheet = {
    open(sheetId) {
        const sheet = document.getElementById(sheetId);
        const backdrop = document.getElementById(`${sheetId}-backdrop`);
        if (sheet) sheet.classList.add('open');
        if (backdrop) backdrop.classList.add('visible');
        document.body.style.overflow = 'hidden';
    },

    close(sheetId) {
        const sheet = document.getElementById(sheetId);
        const backdrop = document.getElementById(`${sheetId}-backdrop`);
        if (sheet) sheet.classList.remove('open');
        if (backdrop) backdrop.classList.remove('visible');
        document.body.style.overflow = '';
    },

    create(id, title, content) {
        return `
            <div id="${id}-backdrop" class="bottom-sheet-backdrop" onclick="bottomSheet.close('${id}')"></div>
            <div id="${id}" class="bottom-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
                <div class="bottom-sheet-handle"></div>
                <div class="bottom-sheet-header">
                    <span class="bottom-sheet-title">${escapeHtml(title)}</span>
                    <button class="btn-icon" aria-label="Close" onclick="bottomSheet.close('${id}')">×</button>
                </div>
                <div class="bottom-sheet-content">
                    ${content}
                </div>
            </div>
        `;
    }
};

// Scroll to Top Button Controller
const scrollToTop = {
    init() {
        const button = document.querySelector('.scroll-to-top');
        if (!button) return;

        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                button.classList.add('visible');
            } else {
                button.classList.remove('visible');
            }
        });

        button.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
};

// Floating Action Button Controller
const fab = {
    toggle(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.classList.toggle('open');
    },

    close(containerId) {
        const container = document.getElementById(containerId);
        if (container) container.classList.remove('open');
    }
};

// Inline Edit Controller
const inlineEdit = {
    start(element, currentValue, onSave) {
        const originalContent = element.textContent;
        element.classList.add('editing');

        element.innerHTML = `
            <input type="text" class="inline-edit-input" value="${escapeHtml(currentValue)}" aria-label="Edit value">
            <div class="inline-edit-actions">
                <button class="inline-edit-save">Save</button>
                <button class="inline-edit-cancel">Cancel</button>
            </div>
        `;

        const input = element.querySelector('input');
        const saveBtn = element.querySelector('.inline-edit-save');
        const cancelBtn = element.querySelector('.inline-edit-cancel');

        input.focus();
        input.select();

        const save = () => {
            const newValue = input.value.trim();
            if (newValue && newValue !== currentValue) {
                onSave(newValue);
            } else {
                cancel();
            }
        };

        const cancel = () => {
            element.classList.remove('editing');
            element.textContent = originalContent;
        };

        saveBtn.addEventListener('click', save);
        cancelBtn.addEventListener('click', cancel);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
        });
    }
};

// Shortcuts Help Display Generator
const shortcutsHelp = {
    items: [
        { keys: ['Ctrl', 'K'], label: 'Open command palette' },
        { keys: ['Ctrl', 'D'], label: 'Go to Dashboard' },
        { keys: ['Ctrl', 'I'], label: 'Go to Inventory' },
        { keys: ['Ctrl', 'E'], label: 'Edit selected item' },
        { keys: ['Ctrl', 'S'], label: 'Save changes' },
        { keys: ['Escape'], label: 'Close modal' },
        { keys: ['?'], label: 'Show shortcuts help' },
        { keys: ['Alt', '1-5'], label: 'Quick navigation' }
    ],

    render() {
        return `
            <div class="shortcuts-grid">
                ${this.items.map(s => `
                    <div class="shortcut-item">
                        <span class="shortcut-label">${escapeHtml(s.label)}</span>
                        <span class="shortcut-keys">
                            ${s.keys.map(k => `<span class="shortcut-key">${k}</span>`).join('')}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Infinite Scroll Controller
const infiniteScroll = {
    init(containerId, loadMore, options = {}) {
        const { threshold = 200 } = options;
        const container = document.getElementById(containerId);
        if (!container) return;

        let loading = false;
        let hasMore = true;

        const checkScroll = () => {
            if (loading || !hasMore) return;

            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollHeight - scrollTop - clientHeight < threshold) {
                loading = true;
                // Set timeout fallback to prevent infinite loading state
                const loadingTimeout = setTimeout(() => { loading = false; snackbar.show('Failed to load more items. Scroll to retry.', 'warning'); }, 30000);
                loadMore().then((moreAvailable) => {
                    clearTimeout(loadingTimeout);
                    loading = false;
                    hasMore = moreAvailable !== false;
                }).catch((err) => {
                    console.error('Infinite scroll load error:', err);
                    clearTimeout(loadingTimeout);
                    loading = false;  // Reset on error to allow retry
                });
            }
        };

        container.addEventListener('scroll', checkScroll);

        return {
            refresh: () => { hasMore = true; checkScroll(); },
            stop: () => { hasMore = false; container.removeEventListener('scroll', checkScroll); }
        };
    }
};

// Date formatting utilities
const dateUtils = {
    formatRelative(date) {
        const now = new Date();
        const d = new Date(date);
        const diffMs = now - d;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return d.toLocaleDateString();
    },

    formatDate(date, format = 'short') {
        const d = new Date(date);
        const options = format === 'long'
            ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
            : { year: 'numeric', month: 'short', day: 'numeric' };
        return d.toLocaleDateString(undefined, options);
    }
};

// ============================================
// Part 3: Advanced UI Components
// ============================================

// Donut Chart Generator
const donutChart = {
    create(data, options = {}) {
        const { size = 120, strokeWidth = 20, showCenter = true, centerLabel = '', centerValue = '' } = options;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const total = data.reduce((sum, item) => sum + item.value, 0);

        let offset = 0;
        const segments = data.map(item => {
            const percentage = total > 0 ? item.value / total : 0;
            const segmentLength = circumference * percentage;
            const segment = {
                offset,
                length: segmentLength,
                color: item.color || '#6366f1',
                label: item.label,
                value: item.value,
                percentage: (percentage * 100).toFixed(1)
            };
            offset += segmentLength;
            return segment;
        });

        return `
            <div class="donut-chart" style="width: ${size}px; height: ${size}px;">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                    ${segments.map(seg => `
                        <circle
                            cx="${size / 2}" cy="${size / 2}" r="${radius}"
                            fill="none" stroke="${seg.color}" stroke-width="${strokeWidth}"
                            stroke-dasharray="${seg.length} ${circumference - seg.length}"
                            stroke-dashoffset="${-seg.offset}"
                            transform="rotate(-90 ${size / 2} ${size / 2})"
                            data-label="${escapeHtml(seg.label)}"
                            data-value="${seg.value}"
                        />
                    `).join('')}
                </svg>
                ${showCenter ? `
                    <div class="donut-chart-center">
                        <span class="donut-chart-value">${escapeHtml(centerValue || total.toString())}</span>
                        ${centerLabel ? `<span class="donut-chart-label">${escapeHtml(centerLabel)}</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    },

    createLegend(data) {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        return `
            <div class="donut-legend">
                ${data.map(item => `
                    <div class="donut-legend-item">
                        <span class="donut-legend-color" style="background-color: ${item.color}"></span>
                        <span class="donut-legend-label">${escapeHtml(item.label)}</span>
                        <span class="donut-legend-value">${item.value} (${(total > 0 ? (item.value / total) * 100 : 0).toFixed(1)}%)</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Funnel Chart Generator
const funnelChart = {
    create(data, options = {}) {
        const { showPercentage = true, showConversion = true } = options;
        const maxValue = Math.max(...data.map(d => d.value));

        return `
            <div class="funnel-chart">
                ${data.map((item, i) => {
                    const widthPercent = (item.value / maxValue) * 100;
                    const conversionRate = i > 0 ? ((item.value / data[i - 1].value) * 100).toFixed(1) : 100;
                    return `
                        <div class="funnel-stage" style="--width: ${widthPercent}%">
                            <div class="funnel-bar" style="background-color: ${item.color || '#6366f1'}">
                                <span class="funnel-label">${escapeHtml(item.label)}</span>
                                <span class="funnel-value">${item.value.toLocaleString()}${showPercentage ? ` (${((item.value / maxValue) * 100).toFixed(1)}%)` : ''}</span>
                            </div>
                            ${showConversion && i > 0 ? `<span class="funnel-conversion">${conversionRate}% conversion</span>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
};

// KPI Widget Generator
const kpiWidget = {
    create(options) {
        const { label, value, change = null, trend = null, icon = null, subtitle = null, color = 'primary' } = options;
        const trendClass = trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : '';
        const changeSign = change > 0 ? '+' : '';

        return `
            <div class="kpi-widget ${color}">
                ${icon ? `<div class="kpi-icon">${components.icon(icon, 24)}</div>` : ''}
                <div class="kpi-content">
                    <div class="kpi-label">${escapeHtml(label)}</div>
                    <div class="kpi-value">${escapeHtml(String(value))}</div>
                    ${change !== null ? `
                        <div class="kpi-change ${trendClass}">
                            ${trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''}
                            ${changeSign}${change}%
                        </div>
                    ` : ''}
                    ${subtitle ? `<div class="kpi-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                </div>
            </div>
        `;
    },

    createGrid(kpis) {
        return `<div class="kpi-grid">${kpis.map(kpi => this.create(kpi)).join('')}</div>`;
    }
};

// Step Indicator Controller
const stepIndicator = {
    create(steps, currentStep = 0, options = {}) {
        const { orientation = 'horizontal', clickable = false } = options;

        return `
            <div class="step-indicator ${orientation}" data-current="${currentStep}">
                ${steps.map((step, i) => {
                    const status = i < currentStep ? 'completed' : i === currentStep ? 'active' : 'pending';
                    return `
                        <div class="step ${status}" data-step="${i}" ${clickable ? `onclick="stepIndicator.goTo(this, ${i})"` : ''}>
                            <div class="step-circle">
                                ${status === 'completed' ? components.icon('check', 16) : i + 1}
                            </div>
                            <div class="step-content">
                                <div class="step-title">${escapeHtml(step.title)}</div>
                                ${step.subtitle ? `<div class="step-subtitle">${escapeHtml(step.subtitle)}</div>` : ''}
                            </div>
                        </div>
                        ${i < steps.length - 1 ? '<div class="step-connector"></div>' : ''}
                    `;
                }).join('')}
            </div>
        `;
    },

    goTo(element, stepIndex) {
        const container = element.closest('.step-indicator');
        const steps = container.querySelectorAll('.step');

        steps.forEach((step, i) => {
            step.classList.remove('completed', 'active', 'pending');
            if (i < stepIndex) step.classList.add('completed');
            else if (i === stepIndex) step.classList.add('active');
            else step.classList.add('pending');
        });

        container.dataset.current = stepIndex;
        container.dispatchEvent(new CustomEvent('stepchange', { detail: { step: stepIndex } }));
    }
};

// Timeline Generator
const timeline = {
    create(events, options = {}) {
        const { alternating = false, showTime = true } = options;

        return `
            <div class="timeline ${alternating ? 'alternating' : ''}">
                ${events.map((event, i) => `
                    <div class="timeline-item ${event.type || ''}" data-index="${i}">
                        <div class="timeline-marker" style="${event.color ? `background-color: ${event.color}` : ''}">
                            ${event.icon ? components.icon(event.icon, 14) : ''}
                        </div>
                        <div class="timeline-content">
                            <div class="timeline-header">
                                <span class="timeline-title">${escapeHtml(event.title)}</span>
                                ${showTime && event.time ? `<span class="timeline-time">${dateUtils.formatRelative(event.time)}</span>` : ''}
                            </div>
                            ${event.description ? `<div class="timeline-description">${escapeHtml(event.description)}</div>` : ''}
                            ${event.tags ? `<div class="timeline-tags">${event.tags.map(t => `<span class="timeline-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Activity Feed Generator
const activityFeed = {
    create(activities, options = {}) {
        const { maxItems = 10, showAvatar = true, grouped = false } = options;
        const items = activities.slice(0, maxItems);

        return `
            <div class="activity-feed ${grouped ? 'grouped' : ''}">
                ${items.map(activity => `
                    <div class="activity-item ${activity.type || ''}">
                        ${showAvatar ? `
                            <div class="activity-avatar">
                                ${activity.avatar ? `<img src="${activity.avatar}" alt="${escapeHtml(activity.user || 'User avatar')}">` : activity.initials || activity.user?.charAt(0) || '?'}
                            </div>
                        ` : ''}
                        <div class="activity-content">
                            <div class="activity-message">
                                ${activity.user ? `<strong>${escapeHtml(activity.user)}</strong> ` : ''}
                                ${escapeHtml(activity.action)}
                                ${activity.target ? ` <span class="activity-target">${escapeHtml(activity.target)}</span>` : ''}
                            </div>
                            <div class="activity-meta">
                                <span class="activity-time">${dateUtils.formatRelative(activity.time)}</span>
                                ${activity.platform ? `<span class="activity-platform">${escapeHtml(activity.platform)}</span>` : ''}
                            </div>
                        </div>
                        ${activity.amount ? `<div class="activity-amount ${activity.type === 'sale' ? 'positive' : ''}">${activity.amount}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Snackbar Controller
const snackbar = {
    queue: [],
    showing: false,

    show(message, options = {}) {
        const { duration = 3000, action = null, actionLabel = 'Undo', type = 'info' } = options;

        this.queue.push({ message, duration, action, actionLabel, type });
        if (!this.showing) this.next();
    },

    next() {
        if (this.queue.length === 0) {
            this.showing = false;
            return;
        }

        this.showing = true;
        const { message, duration, action, actionLabel, type } = this.queue.shift();

        let container = document.querySelector('.snackbar-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'snackbar-container';
            document.body.appendChild(container);
        }

        const snackbarEl = document.createElement('div');
        snackbarEl.className = `snackbar ${type}`;
        snackbarEl.setAttribute('role', 'status');
        snackbarEl.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        snackbarEl.innerHTML = `
            <span class="snackbar-message">${escapeHtml(message)}</span>
            ${action ? `<button class="snackbar-action" type="button">${escapeHtml(actionLabel)}</button>` : ''}
            <button class="snackbar-close" type="button" aria-label="Dismiss">&times;</button>
        `;

        container.appendChild(snackbarEl);

        const actionBtn = snackbarEl.querySelector('.snackbar-action');
        if (actionBtn && action) actionBtn.addEventListener('click', () => { action(); this.dismiss(snackbarEl); });

        snackbarEl.querySelector('.snackbar-close').addEventListener('click', () => this.dismiss(snackbarEl));

        setTimeout(() => snackbarEl.classList.add('show'), 10);
        if (duration > 0) setTimeout(() => this.dismiss(snackbarEl), duration);
    },

    dismiss(el) {
        el.classList.remove('show');
        setTimeout(() => {
            el.remove();
            this.next();
        }, 300);
    },

    success(message, options = {}) { this.show(message, { ...options, type: 'success' }); },
    error(message, options = {}) { this.show(message, { ...options, type: 'error' }); },
    warning(message, options = {}) { this.show(message, { ...options, type: 'warning' }); }
};

// Tag Input Controller
const tagInput = {
    create(id, options = {}) {
        const { placeholder = 'Add tag...', maxTags = 10, suggestions = [], initialTags = [] } = options;
        const tagsJson = JSON.stringify(initialTags);

        return `
            <div class="tag-input-container" id="${id}" data-max="${maxTags}" data-tags='${tagsJson}'>
                <div class="tag-input-tags">
                    ${initialTags.map(tag => `
                        <span class="tag-input-tag">
                            ${escapeHtml(tag)}
                            <button type="button" class="tag-input-remove" onclick="tagInput.removeTag('${id}', '${escapeHtml(tag)}')">&times;</button>
                        </span>
                    `).join('')}
                </div>
                <input type="text" class="tag-input-field" placeholder="${escapeHtml(placeholder)}" aria-label="Add tags"
                    onkeydown="tagInput.handleKeydown(event, '${id}')"
                    onfocus="tagInput.showSuggestions('${id}')"
                    onblur="setTimeout(() => tagInput.hideSuggestions('${id}'), 200)">
                ${suggestions.length > 0 ? `
                    <div class="tag-input-suggestions" data-suggestions='${JSON.stringify(suggestions)}'>
                        ${suggestions.map(s => `<div class="tag-suggestion" onclick="tagInput.addTag('${id}', '${escapeHtml(s)}')">${escapeHtml(s)}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    handleKeydown(event, id) {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            const value = event.target.value.trim();
            if (value) this.addTag(id, value);
            event.target.value = '';
        } else if (event.key === 'Backspace' && !event.target.value) {
            const container = document.getElementById(id);
            const tags = JSON.parse(container.dataset.tags || '[]');
            if (tags.length > 0) this.removeTag(id, tags[tags.length - 1]);
        }
    },

    addTag(id, tag) {
        const container = document.getElementById(id);
        const tags = JSON.parse(container.dataset.tags || '[]');
        const max = parseInt(container.dataset.max) || 10;

        if (tags.length >= max || tags.includes(tag)) return;

        tags.push(tag);
        container.dataset.tags = JSON.stringify(tags);

        const tagsContainer = container.querySelector('.tag-input-tags');
        const tagEl = document.createElement('span');
        tagEl.className = 'tag-input-tag';
        tagEl.innerHTML = `${escapeHtml(tag)}<button type="button" class="tag-input-remove" onclick="tagInput.removeTag('${id}', '${escapeHtml(tag)}')">&times;</button>`;
        tagsContainer.appendChild(tagEl);

        container.dispatchEvent(new CustomEvent('tagschange', { detail: { tags } }));
    },

    removeTag(id, tag) {
        const container = document.getElementById(id);
        const tags = JSON.parse(container.dataset.tags || '[]').filter(t => t !== tag);
        container.dataset.tags = JSON.stringify(tags);

        const tagEls = container.querySelectorAll('.tag-input-tag');
        tagEls.forEach(el => {
            if (el.textContent.trim().replace('×', '') === tag) el.remove();
        });

        container.dispatchEvent(new CustomEvent('tagschange', { detail: { tags } }));
    },

    getTags(id) {
        const container = document.getElementById(id);
        return JSON.parse(container.dataset.tags || '[]');
    },

    showSuggestions(id) {
        const container = document.getElementById(id);
        const suggestions = container.querySelector('.tag-input-suggestions');
        if (suggestions) suggestions.classList.add('show');
    },

    hideSuggestions(id) {
        const container = document.getElementById(id);
        const suggestions = container.querySelector('.tag-input-suggestions');
        if (suggestions) suggestions.classList.remove('show');
    }
};

// Star Rating Controller
const starRating = {
    create(id, options = {}) {
        const { value = 0, max = 5, readonly = false, size = 'md', showValue = true } = options;

        return `
            <div class="star-rating ${size} ${readonly ? 'readonly' : ''}" id="${id}" data-value="${value}" data-max="${max}">
                <div class="star-rating-stars" ${!readonly ? `role="radiogroup" aria-label="Star rating"` : ''}>
                    ${Array.from({ length: max }, (_, i) => `
                        <span class="star ${i < value ? 'filled' : ''}" data-index="${i}"
                            ${!readonly ? `role="button" tabindex="0" aria-label="${i + 1} star${i + 1 > 1 ? 's' : ''}" onclick="starRating.setValue('${id}', ${i + 1})" onmouseover="starRating.preview('${id}', ${i + 1})" onmouseout="starRating.restore('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();starRating.setValue('${id}', ${i + 1})}"` : `aria-hidden="true"`}>
                            ${components.icon('star', size === 'sm' ? 16 : size === 'lg' ? 28 : 20)}
                        </span>
                    `).join('')}
                </div>
                ${showValue ? `<span class="star-rating-value">${value}/${max}</span>` : ''}
            </div>
        `;
    },

    setValue(id, value) {
        const container = document.getElementById(id);
        container.dataset.value = value;
        this.render(id, value);
        container.dispatchEvent(new CustomEvent('ratingchange', { detail: { value } }));
    },

    preview(id, value) {
        this.render(id, value, true);
    },

    restore(id) {
        const container = document.getElementById(id);
        this.render(id, parseInt(container.dataset.value) || 0);
    },

    render(id, value, preview = false) {
        const container = document.getElementById(id);
        const stars = container.querySelectorAll('.star');
        const valueDisplay = container.querySelector('.star-rating-value');
        const max = parseInt(container.dataset.max) || 5;

        stars.forEach((star, i) => {
            star.classList.toggle('filled', i < value);
            star.classList.toggle('preview', preview && i < value);
        });

        if (valueDisplay && !preview) valueDisplay.textContent = `${value}/${max}`;
    },

    getValue(id) {
        const container = document.getElementById(id);
        return parseInt(container.dataset.value) || 0;
    }
};

// Comment Thread Generator
const commentThread = {
    create(comments, options = {}) {
        const { showReply = true, maxDepth = 3 } = options;

        const renderComment = (comment, depth = 0) => `
            <div class="comment" data-id="${comment.id}" style="--depth: ${depth}">
                <div class="comment-avatar">
                    ${comment.avatar ? `<img src="${comment.avatar}" alt="${escapeHtml(comment.author || 'Comment author avatar')}">` : comment.author?.charAt(0) || '?'}
                </div>
                <div class="comment-body">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHtml(comment.author)}</span>
                        <span class="comment-time">${dateUtils.formatRelative(comment.time)}</span>
                    </div>
                    <div class="comment-content">${escapeHtml(comment.content)}</div>
                    <div class="comment-actions">
                        ${showReply && depth < maxDepth ? `<button class="comment-reply-btn" onclick="commentThread.showReplyForm('${comment.id}')">Reply</button>` : ''}
                        ${comment.likes !== undefined ? `<button class="comment-like-btn" onclick="commentThread.like('${comment.id}')">${components.icon('heart', 14)} ${comment.likes}</button>` : ''}
                    </div>
                    <div class="comment-reply-form" id="reply-form-${comment.id}" style="display: none;"></div>
                    ${comment.replies?.length > 0 ? `
                        <div class="comment-replies">
                            ${comment.replies.map(r => renderComment(r, depth + 1)).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        return `<div class="comment-thread">${comments.map(c => renderComment(c)).join('')}</div>`;
    },

    showReplyForm(commentId) {
        const form = document.getElementById(`reply-form-${commentId}`);
        form.style.display = 'block';
        form.innerHTML = `
            <textarea class="comment-input" placeholder="Write a reply..." rows="2"></textarea>
            <div class="comment-form-actions">
                <button class="btn btn-sm" onclick="commentThread.cancelReply('${commentId}')">Cancel</button>
                <button class="btn btn-sm btn-primary" onclick="commentThread.submitReply('${commentId}')">Reply</button>
            </div>
        `;
        form.querySelector('textarea').focus();
    },

    cancelReply(commentId) {
        const form = document.getElementById(`reply-form-${commentId}`);
        form.style.display = 'none';
        form.innerHTML = '';
    },

    submitReply(commentId) {
        const form = document.getElementById(`reply-form-${commentId}`);
        const content = form.querySelector('textarea').value.trim();
        if (!content) return;

        const comment = document.querySelector(`[data-id="${commentId}"]`);
        comment.dispatchEvent(new CustomEvent('reply', { bubbles: true, detail: { commentId, content } }));
        this.cancelReply(commentId);
    },

    like(commentId) {
        const comment = document.querySelector(`[data-id="${commentId}"]`);
        comment.dispatchEvent(new CustomEvent('like', { bubbles: true, detail: { commentId } }));
    }
};

// Copy to Clipboard Handler
const copyButton = {
    init() {
        document.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', () => this.copy(btn));
        });
    },

    async copy(element) {
        const target = element.dataset.copy;
        let text = '';

        if (target.startsWith('#')) {
            const el = document.querySelector(target);
            text = el?.value || el?.textContent || '';
        } else {
            text = target;
        }

        try {
            await navigator.clipboard.writeText(text);
            this.showFeedback(element, true);
        } catch (err) {
            this.showFeedback(element, false);
        }
    },

    showFeedback(element, success) {
        const originalHtml = element.innerHTML;
        element.innerHTML = success ? `${components.icon('check', 16)} Copied!` : `${components.icon('x', 16)} Failed`;
        element.classList.add(success ? 'copy-success' : 'copy-error');

        setTimeout(() => {
            element.innerHTML = originalHtml;
            element.classList.remove('copy-success', 'copy-error');
        }, 2000);
    }
};

// Share Menu Controller
const shareMenu = {
    create(options = {}) {
        const { url = window.location.href, title = document.title, text = '' } = options;

        const platforms = [
            { id: 'twitter', label: 'Twitter', url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text || title)}` },
            { id: 'facebook', label: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
            { id: 'linkedin', label: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
            { id: 'email', label: 'Email', url: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}` }
        ];

        return `
            <div class="share-menu">
                ${platforms.map(p => `
                    <a href="${p.url}" target="_blank" rel="noopener" class="share-option" data-platform="${p.id}">
                        ${components.icon(p.id, 20)}
                        <span>${p.label}</span>
                    </a>
                `).join('')}
                <button class="share-option" onclick="shareMenu.copyLink('${escapeHtml(url)}')">
                    ${components.icon('link', 20)}
                    <span>Copy Link</span>
                </button>
                ${navigator.share ? `
                    <button class="share-option" onclick="shareMenu.native('${escapeHtml(url)}', '${escapeHtml(title)}', '${escapeHtml(text)}')">
                        ${components.icon('share', 20)}
                        <span>More...</span>
                    </button>
                ` : ''}
            </div>
        `;
    },

    async copyLink(url) {
        try {
            await navigator.clipboard.writeText(url);
            snackbar.success('Link copied to clipboard');
        } catch {
            snackbar.error('Failed to copy link');
        }
    },

    async native(url, title, text) {
        try {
            await navigator.share({ url, title, text });
        } catch (err) {
            if (err.name !== 'AbortError') snackbar.error('Failed to share');
        }
    }
};

// Countdown Timer Controller
const countdown = {
    timers: new Map(),

    create(id, targetDate, options = {}) {
        const { format = 'full', onComplete = null, labels = { days: 'd', hours: 'h', minutes: 'm', seconds: 's' } } = options;

        return `
            <div class="countdown" id="${id}" data-target="${new Date(targetDate).getTime()}" data-format="${format}">
                ${format === 'full' ? `
                    <div class="countdown-unit"><span class="countdown-value" data-unit="days">00</span><span class="countdown-label">${labels.days}</span></div>
                    <div class="countdown-separator">:</div>
                ` : ''}
                <div class="countdown-unit"><span class="countdown-value" data-unit="hours">00</span><span class="countdown-label">${labels.hours}</span></div>
                <div class="countdown-separator">:</div>
                <div class="countdown-unit"><span class="countdown-value" data-unit="minutes">00</span><span class="countdown-label">${labels.minutes}</span></div>
                <div class="countdown-separator">:</div>
                <div class="countdown-unit"><span class="countdown-value" data-unit="seconds">00</span><span class="countdown-label">${labels.seconds}</span></div>
            </div>
        `;
    },

    start(id, onComplete = null) {
        if (this.timers.has(id)) return;

        const update = () => {
            const el = document.getElementById(id);
            if (!el) { this.stop(id); return; }

            const target = parseInt(el.dataset.target);
            const now = Date.now();
            const diff = Math.max(0, target - now);

            if (diff === 0) {
                this.stop(id);
                el.classList.add('completed');
                if (onComplete) onComplete();
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            const setValue = (unit, value) => {
                const unitEl = el.querySelector(`[data-unit="${unit}"]`);
                if (unitEl) unitEl.textContent = String(value).padStart(2, '0');
            };

            setValue('days', days);
            setValue('hours', hours);
            setValue('minutes', minutes);
            setValue('seconds', seconds);
        };

        update();
        this.timers.set(id, setInterval(update, 1000));
    },

    stop(id) {
        if (this.timers.has(id)) {
            clearInterval(this.timers.get(id));
            this.timers.delete(id);
        }
    },

    stopAll() {
        this.timers.forEach((intervalId) => clearInterval(intervalId));
        this.timers.clear();
    }
};

// Onboarding Tour Controller
const onboardingTour = {
    currentTour: null,
    currentStep: 0,

    start(steps, options = {}) {
        const { onComplete = null, onSkip = null, showProgress = true } = options;

        this.currentTour = { steps, onComplete, onSkip, showProgress };
        this.currentStep = 0;
        this.showStep();
    },

    showStep() {
        if (!this.currentTour) return;

        this.removeHighlight();
        const step = this.currentTour.steps[this.currentStep];
        const target = document.querySelector(step.target);

        if (!target) {
            this.next();
            return;
        }

        // Highlight target
        target.classList.add('tour-highlight');

        // Position tooltip
        const rect = target.getBoundingClientRect();
        const position = step.position || 'bottom';

        let tooltipEl = document.querySelector('.tour-tooltip');
        if (!tooltipEl) {
            tooltipEl = document.createElement('div');
            tooltipEl.className = 'tour-tooltip';
            document.body.appendChild(tooltipEl);
        }

        const isLast = this.currentStep === this.currentTour.steps.length - 1;
        const progress = this.currentTour.showProgress ? `<span class="tour-progress">${this.currentStep + 1}/${this.currentTour.steps.length}</span>` : '';

        tooltipEl.innerHTML = `
            <div class="tour-tooltip-content">
                ${step.title ? `<div class="tour-tooltip-title">${escapeHtml(step.title)}</div>` : ''}
                <div class="tour-tooltip-text">${escapeHtml(step.content)}</div>
                <div class="tour-tooltip-footer">
                    ${progress}
                    <div class="tour-tooltip-actions">
                        <button class="btn btn-sm" onclick="onboardingTour.skip()">Skip</button>
                        ${this.currentStep > 0 ? '<button class="btn btn-sm" onclick="onboardingTour.prev()">Back</button>' : ''}
                        <button class="btn btn-sm btn-primary" onclick="onboardingTour.next()">${isLast ? 'Finish' : 'Next'}</button>
                    </div>
                </div>
            </div>
        `;

        tooltipEl.className = `tour-tooltip ${position} show`;

        // Position tooltip relative to target
        const tooltipRect = tooltipEl.getBoundingClientRect();
        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - tooltipRect.height - 10;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 10;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - 10;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + 10;
                break;
        }

        tooltipEl.style.top = `${Math.max(10, top)}px`;
        tooltipEl.style.left = `${Math.max(10, left)}px`;

        // Scroll target into view
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    next() {
        if (!this.currentTour) return;

        if (this.currentStep < this.currentTour.steps.length - 1) {
            this.currentStep++;
            this.showStep();
        } else {
            this.complete();
        }
    },

    prev() {
        if (!this.currentTour || this.currentStep === 0) return;
        this.currentStep--;
        this.showStep();
    },

    skip() {
        if (this.currentTour?.onSkip) this.currentTour.onSkip();
        this.end();
    },

    complete() {
        if (this.currentTour?.onComplete) this.currentTour.onComplete();
        this.end();
    },

    end() {
        this.removeHighlight();
        const tooltip = document.querySelector('.tour-tooltip');
        if (tooltip) tooltip.remove();
        this.currentTour = null;
        this.currentStep = 0;
    },

    removeHighlight() {
        document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    }
};

// ============================================
// Part 4: Form Inputs & Data Display Utilities
// ============================================

// Password Visibility Toggle
const passwordToggle = {
    create(inputId) {
        return `
            <div class="password-input-wrapper" data-for="${inputId}">
                <input type="password" id="${inputId}" class="form-input">
                <button type="button" class="password-toggle" aria-label="Toggle password visibility" onclick="passwordToggle.toggle('${inputId}')">
                    <span class="icon-visible">${components.icon('eye', 18)}</span>
                    <span class="icon-hidden">${components.icon('eye-off', 18)}</span>
                </button>
            </div>
        `;
    },

    toggle(inputId) {
        const wrapper = document.querySelector(`[data-for="${inputId}"]`);
        const input = document.getElementById(inputId);
        if (!wrapper || !input) return;

        const isVisible = wrapper.classList.toggle('visible');
        input.type = isVisible ? 'text' : 'password';
    }
};

// OTP Input Controller
const otpInput = {
    create(id, length = 6, options = {}) {
        const { separator = false, separatorIndex = 3 } = options;
        const inputs = Array.from({ length }, (_, i) => {
            const showSeparator = separator && i === separatorIndex;
            return `
                ${showSeparator ? '<span class="otp-input-separator">-</span>' : ''}
                <input type="text" maxlength="1" class="otp-input" aria-label="OTP digit ${i + 1}"
                    data-otp-id="${id}" data-index="${i}"
                    oninput="otpInput.handleInput(event, '${id}', ${i})"
                    onkeydown="otpInput.handleKeydown(event, '${id}', ${i})"
                    onpaste="otpInput.handlePaste(event, '${id}')">
            `;
        }).join('');

        return `<div class="otp-input-container" id="${id}" data-length="${length}">${inputs}</div>`;
    },

    handleInput(event, id, index) {
        const value = event.target.value;
        if (!/^\d*$/.test(value)) {
            event.target.value = '';
            return;
        }

        if (value) {
            event.target.classList.add('filled');
            this.focusNext(id, index);
        } else {
            event.target.classList.remove('filled');
        }

        this.checkComplete(id);
    },

    handleKeydown(event, id, index) {
        if (event.key === 'Backspace' && !event.target.value) {
            this.focusPrev(id, index);
        } else if (event.key === 'ArrowLeft') {
            this.focusPrev(id, index);
        } else if (event.key === 'ArrowRight') {
            this.focusNext(id, index);
        }
    },

    handlePaste(event, id) {
        event.preventDefault();
        const paste = (event.clipboardData || window.clipboardData).getData('text');
        const digits = paste.replace(/\D/g, '').split('').slice(0, 6);

        const container = document.getElementById(id);
        const inputs = container.querySelectorAll('.otp-input');

        digits.forEach((digit, i) => {
            if (inputs[i]) {
                inputs[i].value = digit;
                inputs[i].classList.add('filled');
            }
        });

        if (digits.length > 0) {
            const lastIndex = Math.min(digits.length - 1, inputs.length - 1);
            inputs[lastIndex].focus();
        }

        this.checkComplete(id);
    },

    focusNext(id, index) {
        const container = document.getElementById(id);
        const length = parseInt(container.dataset.length);
        if (index < length - 1) {
            const next = container.querySelector(`[data-index="${index + 1}"]`);
            if (next) next.focus();
        }
    },

    focusPrev(id, index) {
        if (index > 0) {
            const container = document.getElementById(id);
            const prev = container.querySelector(`[data-index="${index - 1}"]`);
            if (prev) prev.focus();
        }
    },

    getValue(id) {
        const container = document.getElementById(id);
        const inputs = container.querySelectorAll('.otp-input');
        return Array.from(inputs).map(i => i.value).join('');
    },

    checkComplete(id) {
        const container = document.getElementById(id);
        const length = parseInt(container.dataset.length);
        const value = this.getValue(id);

        if (value.length === length) {
            container.dispatchEvent(new CustomEvent('otpcomplete', { detail: { value } }));
        }
    },

    setError(id) {
        const container = document.getElementById(id);
        const inputs = container.querySelectorAll('.otp-input');
        inputs.forEach(input => input.classList.add('error'));
        setTimeout(() => inputs.forEach(input => input.classList.remove('error')), 500);
    },

    clear(id) {
        const container = document.getElementById(id);
        const inputs = container.querySelectorAll('.otp-input');
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled', 'error');
        });
        inputs[0]?.focus();
    }
};

// Currency Input Formatter
const currencyInput = {
    create(id, options = {}) {
        const { symbol = '$', suffix = '', value = '', placeholder = '0.00' } = options;

        return `
            <div class="currency-input-wrapper ${suffix ? 'has-suffix' : ''}">
                <span class="currency-prefix">${symbol}</span>
                <input type="text" id="${id}" class="form-input"
                    value="${value}" placeholder="${placeholder}"
                    oninput="currencyInput.format('${id}')"
                    onblur="currencyInput.formatFinal('${id}')">
                ${suffix ? `<span class="currency-suffix">${suffix}</span>` : ''}
            </div>
        `;
    },

    format(id) {
        const input = document.getElementById(id);
        let value = input.value.replace(/[^0-9.]/g, '');

        // Only allow one decimal point
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }

        // Limit decimal places
        if (parts[1]?.length > 2) {
            value = parts[0] + '.' + parts[1].slice(0, 2);
        }

        input.value = value;
    },

    formatFinal(id) {
        const input = document.getElementById(id);
        const value = parseFloat(input.value) || 0;
        input.value = value.toFixed(2);
    },

    getValue(id) {
        const input = document.getElementById(id);
        return parseFloat(input.value) || 0;
    },

    setValue(id, value) {
        const input = document.getElementById(id);
        input.value = parseFloat(value).toFixed(2);
    }
};

// Form Wizard Controller
const formWizard = {
    create(id, steps, options = {}) {
        const { initialStep = 0 } = options;
        const progress = (initialStep / (steps.length - 1)) * 100;

        return `
            <div class="form-wizard" id="${id}" data-current="${initialStep}">
                <div class="wizard-progress">
                    <div class="wizard-progress-fill" style="width: ${progress}%"></div>
                    ${steps.map((step, i) => `
                        <div class="wizard-step ${i < initialStep ? 'completed' : ''} ${i === initialStep ? 'active' : ''}">
                            <div class="wizard-step-number">${i < initialStep ? '✓' : i + 1}</div>
                            <div class="wizard-step-label">${escapeHtml(step.label)}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="wizard-content">
                    ${steps.map((step, i) => `
                        <div class="wizard-panel ${i === initialStep ? 'active' : ''}" data-step="${i}">
                            ${step.content}
                        </div>
                    `).join('')}
                </div>
                <div class="wizard-actions">
                    <button type="button" class="btn" onclick="formWizard.prev('${id}')" ${initialStep === 0 ? 'disabled' : ''}>Previous</button>
                    <button type="button" class="btn btn-primary" onclick="formWizard.next('${id}')">
                        ${initialStep === steps.length - 1 ? 'Complete' : 'Next'}
                    </button>
                </div>
            </div>
        `;
    },

    next(id) {
        const wizard = document.getElementById(id);
        const current = parseInt(wizard.dataset.current);
        const steps = wizard.querySelectorAll('.wizard-step');
        const panels = wizard.querySelectorAll('.wizard-panel');

        if (current < steps.length - 1) {
            this.goTo(id, current + 1);
        } else {
            wizard.dispatchEvent(new CustomEvent('wizardcomplete'));
        }
    },

    prev(id) {
        const wizard = document.getElementById(id);
        const current = parseInt(wizard.dataset.current);
        if (current > 0) {
            this.goTo(id, current - 1);
        }
    },

    goTo(id, stepIndex) {
        const wizard = document.getElementById(id);
        const steps = wizard.querySelectorAll('.wizard-step');
        const panels = wizard.querySelectorAll('.wizard-panel');
        const progressFill = wizard.querySelector('.wizard-progress-fill');
        const prevBtn = wizard.querySelector('.wizard-actions button:first-child');
        const nextBtn = wizard.querySelector('.wizard-actions button:last-child');

        wizard.dataset.current = stepIndex;

        // Update steps
        steps.forEach((step, i) => {
            step.classList.remove('completed', 'active');
            if (i < stepIndex) step.classList.add('completed');
            else if (i === stepIndex) step.classList.add('active');

            const number = step.querySelector('.wizard-step-number');
            number.textContent = i < stepIndex ? '✓' : i + 1;
        });

        // Update panels
        panels.forEach((panel, i) => {
            panel.classList.toggle('active', i === stepIndex);
        });

        // Update progress
        progressFill.style.width = `${(stepIndex / (steps.length - 1)) * 100}%`;

        // Update buttons
        prevBtn.disabled = stepIndex === 0;
        nextBtn.textContent = stepIndex === steps.length - 1 ? 'Complete' : 'Next';

        wizard.dispatchEvent(new CustomEvent('stepchange', { detail: { step: stepIndex } }));
    }
};

// Data Grid Controller
const dataGrid = {
    state: new Map(),

    init(id, options = {}) {
        const { data = [], columns = [], pageSize = 10, sortable = true, filterable = true } = options;

        this.state.set(id, {
            data,
            columns,
            pageSize,
            sortable,
            filterable,
            currentPage: 1,
            sortColumn: null,
            sortDirection: 'asc',
            filters: {},
            selected: new Set()
        });

        return this.render(id);
    },

    render(id) {
        const state = this.state.get(id);
        if (!state) return '';

        const { data, columns, pageSize, currentPage, sortColumn, sortDirection } = state;

        // Apply filters and sorting
        let filtered = this.applyFilters(id, data);
        let sorted = this.applySort(filtered, sortColumn, sortDirection);

        // Paginate
        const totalPages = Math.ceil(sorted.length / pageSize);
        const start = (currentPage - 1) * pageSize;
        const pageData = sorted.slice(start, start + pageSize);

        return `
            <div class="data-grid" id="${id}">
                <div class="data-grid-header">
                    <div class="data-grid-search">
                        <input type="text" placeholder="Search..." aria-label="Search table" onkeyup="dataGrid.search('${id}', this.value)">
                    </div>
                    <div class="data-grid-actions">
                        <span class="data-grid-info">${sorted.length} items</span>
                    </div>
                </div>
                <table class="data-grid-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `
                                <th class="${state.sortable && col.sortable !== false ? 'sortable' : ''} ${sortColumn === col.key ? 'sorted' : ''}"
                                    ${state.sortable && col.sortable !== false ? `onclick="dataGrid.sort('${id}', '${col.key}')"` : ''}>
                                    ${escapeHtml(col.label)}
                                    ${state.sortable && col.sortable !== false ? `
                                        <span class="sort-icon">${sortColumn === col.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}</span>
                                    ` : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${pageData.map(row => `
                            <tr data-id="${row.id || ''}" class="${state.selected.has(row.id) ? 'selected' : ''}">
                                ${columns.map(col => `<td>${col.render ? col.render(row[col.key], row) : escapeHtml(String(row[col.key] ?? ''))}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="data-grid-footer">
                    <span>Showing ${start + 1}-${Math.min(start + pageSize, sorted.length)} of ${sorted.length}</span>
                    <div class="data-grid-pagination">
                        <button onclick="dataGrid.goToPage('${id}', ${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>←</button>
                        ${this.renderPagination(id, currentPage, totalPages)}
                        <button onclick="dataGrid.goToPage('${id}', ${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>→</button>
                    </div>
                </div>
            </div>
        `;
    },

    renderPagination(id, current, total) {
        if (total <= 1) return '';
        const pages = [];
        const windowSize = 2;
        const start = Math.max(1, current - windowSize);
        const end = Math.min(total, current + windowSize);
        if (start > 1) pages.push(`<button onclick="dataGrid.goToPage('${id}', 1)">1</button>`);
        if (start > 2) pages.push(`<span style="padding: 0 4px;">&hellip;</span>`);
        for (let i = start; i <= end; i++) {
            pages.push(`<button class="${i === current ? 'active' : ''}" onclick="dataGrid.goToPage('${id}', ${i})">${i}</button>`);
        }
        if (end < total - 1) pages.push(`<span style="padding: 0 4px;">&hellip;</span>`);
        if (end < total) pages.push(`<button onclick="dataGrid.goToPage('${id}', ${total})">${total}</button>`);
        return pages.join('');
    },

    sort(id, column) {
        const state = this.state.get(id);
        if (!state) return;

        if (state.sortColumn === column) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            state.sortColumn = column;
            state.sortDirection = 'asc';
        }

        this.refresh(id);
    },

    applySort(data, column, direction) {
        if (!column) return data;
        return [...data].sort((a, b) => {
            const aVal = a[column] ?? '';
            const bVal = b[column] ?? '';
            const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            return direction === 'asc' ? cmp : -cmp;
        });
    },

    applyFilters(id, data) {
        const state = this.state.get(id);
        const filters = state.filters;
        if (Object.keys(filters).length === 0) return data;

        return data.filter(row => {
            return Object.entries(filters).every(([key, value]) => {
                if (!value) return true;
                const rowVal = String(row[key] ?? '').toLowerCase();
                return rowVal.includes(value.toLowerCase());
            });
        });
    },

    search(id, query) {
        const state = this.state.get(id);
        if (!state) return;

        state.filters._search = query;
        state.currentPage = 1;
        this.refresh(id);
    },

    goToPage(id, page) {
        const state = this.state.get(id);
        if (!state) return;

        const totalPages = Math.ceil(state.data.length / state.pageSize);
        state.currentPage = Math.max(1, Math.min(page, totalPages));
        this.refresh(id);
    },

    refresh(id) {
        const container = document.getElementById(id);
        if (container) {
            container.outerHTML = this.render(id);
        }
    }
};

// File Upload Controller
const fileUpload = {
    create(id, options = {}) {
        const { accept = '*', multiple = true, maxSize = 10 * 1024 * 1024, maxFiles = 10 } = options;

        return `
            <div class="file-upload-container" id="${id}" data-max-size="${maxSize}" data-max-files="${maxFiles}">
                <div class="file-upload-zone"
                    ondragover="fileUpload.handleDragOver(event)"
                    ondragleave="fileUpload.handleDragLeave(event)"
                    ondrop="fileUpload.handleDrop(event, '${id}')"
                    onclick="document.getElementById('${id}-input').click()">
                    <div class="upload-icon">${components.icon('upload-cloud', 48)}</div>
                    <div class="upload-text">Drag files here or click to upload</div>
                    <div class="upload-hint">Max ${Math.round(maxSize / 1024 / 1024)}MB per file</div>
                </div>
                <input type="file" id="${id}-input" accept="${accept}" ${multiple ? 'multiple' : ''}
                    style="display: none" onchange="fileUpload.handleSelect(event, '${id}')">
                <div class="file-preview-grid" id="${id}-previews"></div>
            </div>
        `;
    },

    handleDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drag-over');
    },

    handleDragLeave(event) {
        event.currentTarget.classList.remove('drag-over');
    },

    handleDrop(event, id) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over');
        const input = document.getElementById(`${id}-input`);
        const acceptAttr = input ? input.accept : '';
        const allowedTypes = acceptAttr ? acceptAttr.split(',').map(t => t.trim()).filter(Boolean) : [];
        let files = Array.from(event.dataTransfer.files);
        if (allowedTypes.length > 0) {
            const before = files.length;
            files = files.filter(file => allowedTypes.some(type => {
                if (type.endsWith('/*')) return file.type.startsWith(type.slice(0, -1));
                if (type.startsWith('.')) return file.name.toLowerCase().endsWith(type.toLowerCase());
                return file.type === type;
            }));
            const rejected = before - files.length;
            if (rejected > 0) snackbar.show(`${rejected} file(s) rejected: unsupported type`, 'warning');
        }
        this.processFiles(id, files);
    },

    handleSelect(event, id) {
        const files = Array.from(event.target.files);
        this.processFiles(id, files);
        event.target.value = '';
    },

    processFiles(id, files) {
        const container = document.getElementById(id);
        const maxSize = parseInt(container.dataset.maxSize);
        const maxFiles = parseInt(container.dataset.maxFiles);
        const previewsEl = document.getElementById(`${id}-previews`);
        const currentCount = previewsEl.children.length;

        files.slice(0, maxFiles - currentCount).forEach(file => {
            if (file.size > maxSize) {
                snackbar.error(`${file.name} is too large`);
                return;
            }

            const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const preview = document.createElement('div');
            preview.className = 'file-preview-item';
            preview.id = fileId;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <img src="${e.target.result}" alt="${escapeHtml(file.name)}">
                        <button class="file-preview-remove" onclick="fileUpload.remove('${fileId}')">&times;</button>
                    `;
                };
                reader.readAsDataURL(file);
            } else {
                preview.innerHTML = `
                    <div class="file-icon">${components.icon('file', 32)}</div>
                    <button class="file-preview-remove" onclick="fileUpload.remove('${fileId}')">&times;</button>
                `;
            }

            previewsEl.appendChild(preview);
            container.dispatchEvent(new CustomEvent('fileadded', { detail: { file, fileId } }));
        });
    },

    remove(fileId) {
        const preview = document.getElementById(fileId);
        if (preview) {
            preview.remove();
            const container = preview.closest('.file-upload-container');
            if (container) {
                container.dispatchEvent(new CustomEvent('fileremoved', { detail: { fileId } }));
            }
        }
    }
};

// Date Range Picker
const dateRangePicker = {
    create(id, options = {}) {
        const { startDate = null, endDate = null, presets = true } = options;

        const formatDate = (d) => d ? new Date(d).toLocaleDateString() : '';
        const displayText = startDate && endDate
            ? `${formatDate(startDate)} - ${formatDate(endDate)}`
            : 'Select date range';

        return `
            <div class="date-range-picker" id="${id}">
                <div class="date-range-input" onclick="dateRangePicker.toggle('${id}')">
                    ${components.icon('calendar', 16)}
                    <span class="date-range-text">${displayText}</span>
                    ${components.icon('chevron-down', 16)}
                </div>
                <div class="date-range-dropdown">
                    ${presets ? `
                        <div class="date-range-presets">
                            <button class="date-range-preset" onclick="dateRangePicker.setPreset('${id}', 'today')">Today</button>
                            <button class="date-range-preset" onclick="dateRangePicker.setPreset('${id}', 'yesterday')">Yesterday</button>
                            <button class="date-range-preset" onclick="dateRangePicker.setPreset('${id}', 'last7')">Last 7 days</button>
                            <button class="date-range-preset" onclick="dateRangePicker.setPreset('${id}', 'last30')">Last 30 days</button>
                            <button class="date-range-preset" onclick="dateRangePicker.setPreset('${id}', 'thisMonth')">This month</button>
                            <button class="date-range-preset" onclick="dateRangePicker.setPreset('${id}', 'lastMonth')">Last month</button>
                        </div>
                    ` : ''}
                    <div class="date-range-calendars">
                        <div class="date-range-calendar" data-calendar="start"></div>
                        <div class="date-range-calendar" data-calendar="end"></div>
                    </div>
                </div>
            </div>
        `;
    },

    toggle(id) {
        const picker = document.getElementById(id);
        const dropdown = picker.querySelector('.date-range-dropdown');
        dropdown.classList.toggle('show');
    },

    setPreset(id, preset) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start, end;

        switch (preset) {
            case 'today':
                start = end = new Date(today);
                break;
            case 'yesterday': {
                const d = new Date(today);
                d.setDate(d.getDate() - 1);
                start = end = d;
                break;
            }
            case 'last7': {
                end = new Date();
                const d = new Date(today);
                d.setDate(d.getDate() - 7);
                start = d;
                break;
            }
            case 'last30': {
                end = new Date();
                const d = new Date(today);
                d.setDate(d.getDate() - 30);
                start = d;
                break;
            }
            case 'thisMonth':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date();
                break;
            case 'lastMonth':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
        }

        this.setRange(id, start, end);
    },

    setRange(id, start, end) {
        const picker = document.getElementById(id);
        const text = picker.querySelector('.date-range-text');
        const dropdown = picker.querySelector('.date-range-dropdown');

        text.textContent = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
        dropdown.classList.remove('show');

        picker.dispatchEvent(new CustomEvent('rangechange', { detail: { start, end } }));
    }
};

// Tree View Controller
const treeView = {
    create(id, data, options = {}) {
        const { onSelect = null, expandAll = false } = options;

        const renderNode = (node, level = 0) => {
            const hasChildren = node.children?.length > 0;
            const expanded = expandAll || node.expanded;

            return `
                <div class="tree-node ${hasChildren ? '' : 'leaf'} ${expanded ? 'expanded' : ''}"
                    data-id="${node.id}" data-level="${level}">
                    <div class="tree-node-content" onclick="treeView.handleClick('${id}', '${node.id}')">
                        <span class="tree-toggle">${hasChildren ? '▶' : ''}</span>
                        ${node.icon ? `<span class="tree-icon">${components.icon(node.icon, 16)}</span>` : ''}
                        <span class="tree-label">${escapeHtml(node.label)}</span>
                        ${node.badge ? `<span class="tree-badge">${node.badge}</span>` : ''}
                    </div>
                    ${hasChildren ? `
                        <div class="tree-children">
                            ${node.children.map(child => renderNode(child, level + 1)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        };

        return `
            <div class="tree-view" id="${id}">
                ${data.map(node => renderNode(node)).join('')}
            </div>
        `;
    },

    handleClick(treeId, nodeId) {
        const tree = document.getElementById(treeId);
        const node = tree.querySelector(`[data-id="${nodeId}"]`);

        if (node.classList.contains('leaf')) {
            // Select leaf node
            tree.querySelectorAll('.tree-node').forEach(n => n.classList.remove('selected'));
            node.classList.add('selected');
            tree.dispatchEvent(new CustomEvent('nodeselect', { detail: { nodeId } }));
        } else {
            // Toggle branch
            node.classList.toggle('expanded');
        }
    },

    expandAll(id) {
        const tree = document.getElementById(id);
        tree.querySelectorAll('.tree-node').forEach(n => n.classList.add('expanded'));
    },

    collapseAll(id) {
        const tree = document.getElementById(id);
        tree.querySelectorAll('.tree-node').forEach(n => n.classList.remove('expanded'));
    }
};

// Stat Counter Animation
const statCounter = {
    animate(elementId, endValue, options = {}) {
        const { duration = 1000, prefix = '', suffix = '', decimals = 0 } = options;
        const element = document.getElementById(elementId);
        if (!element) return;

        const startValue = 0;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = startValue + (endValue - startValue) * eased;

            element.textContent = prefix + current.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
            element.classList.add('animating');

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.classList.remove('animating');
            }
        };

        requestAnimationFrame(update);
    }
};

// Before/After Slider
const beforeAfterSlider = {
    create(id, beforeSrc, afterSrc, options = {}) {
        const { initialPosition = 50 } = options;

        return `
            <div class="before-after-slider" id="${id}"
                onmousedown="beforeAfterSlider.startDrag(event, '${id}')"
                ontouchstart="beforeAfterSlider.startDrag(event, '${id}')">
                <img src="${afterSrc}" alt="After" class="after-image">
                <div class="before-image" style="width: ${initialPosition}%">
                    <img src="${beforeSrc}" alt="Before">
                </div>
                <div class="slider-handle" style="left: ${initialPosition}%"></div>
                <span class="before-label">Before</span>
                <span class="after-label">After</span>
            </div>
        `;
    },

    startDrag(event, id) {
        event.preventDefault();
        const slider = document.getElementById(id);

        const onMove = (e) => {
            const rect = slider.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

            slider.querySelector('.before-image').style.width = `${percent}%`;
            slider.querySelector('.slider-handle').style.left = `${percent}%`;
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove);
        document.addEventListener('touchend', onEnd);
    }
};

// JSON Viewer
const jsonViewer = {
    render(data, options = {}) {
        const { collapsed = false } = options;

        const renderValue = (value, key = null, depth = 0) => {
            const type = Array.isArray(value) ? 'array' : typeof value;
            const indent = '  '.repeat(depth);

            if (value === null) {
                return `<span class="json-null">null</span>`;
            }

            if (type === 'object' || type === 'array') {
                const isArray = type === 'array';
                const entries = isArray ? value : Object.entries(value);
                const openBracket = isArray ? '[' : '{';
                const closeBracket = isArray ? ']' : '}';

                if (entries.length === 0) {
                    return `<span class="json-bracket">${openBracket}${closeBracket}</span>`;
                }

                return `
                    <span class="json-collapsible ${collapsed && depth > 0 ? 'collapsed' : ''}" onclick="this.classList.toggle('collapsed')">
                        <span class="json-bracket">${openBracket}</span>
                    </span>
                    <div class="json-content">
                        ${(isArray ? entries.map((v, i) => [i, v]) : entries).map(([k, v], i, arr) => `
                            ${indent}  ${!isArray ? `<span class="json-key">"${escapeHtml(k)}"</span>: ` : ''}${renderValue(v, k, depth + 1)}${i < arr.length - 1 ? ',' : ''}
                        `).join('\n')}
                    </div>
                    ${indent}<span class="json-bracket">${closeBracket}</span>
                `;
            }

            if (type === 'string') {
                return `<span class="json-string">"${escapeHtml(value)}"</span>`;
            }

            if (type === 'number') {
                return `<span class="json-number">${value}</span>`;
            }

            if (type === 'boolean') {
                return `<span class="json-boolean">${value}</span>`;
            }

            return escapeHtml(String(value));
        };

        return `<div class="json-viewer"><pre>${renderValue(data)}</pre></div>`;
    }
};

// Diff Viewer
const diffViewer = {
    render(before, after, options = {}) {
        const { showLineNumbers = true } = options;
        const beforeLines = before.split('\n');
        const afterLines = after.split('\n');

        // Simple line-by-line diff
        const maxLines = Math.max(beforeLines.length, afterLines.length);
        const lines = [];

        for (let i = 0; i < maxLines; i++) {
            const beforeLine = beforeLines[i];
            const afterLine = afterLines[i];

            if (beforeLine === afterLine) {
                lines.push({ type: 'unchanged', content: beforeLine, lineNum: i + 1 });
            } else if (beforeLine && !afterLine) {
                lines.push({ type: 'removed', content: beforeLine, lineNum: i + 1 });
            } else if (!beforeLine && afterLine) {
                lines.push({ type: 'added', content: afterLine, lineNum: i + 1 });
            } else {
                lines.push({ type: 'removed', content: beforeLine, lineNum: i + 1 });
                lines.push({ type: 'added', content: afterLine, lineNum: i + 1 });
            }
        }

        return `
            <div class="diff-viewer">
                <div class="diff-header">
                    <span>Changes</span>
                    <span>${lines.filter(l => l.type === 'added').length} additions, ${lines.filter(l => l.type === 'removed').length} deletions</span>
                </div>
                ${lines.map(line => `
                    <div class="diff-line ${line.type}">
                        ${showLineNumbers ? `<span class="diff-line-number">${line.lineNum}</span>` : ''}
                        <span class="diff-line-content">${line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '} ${escapeHtml(line.content || '')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Connection status is handled by offlineManager (see Part 22)

// ============================================
// Part 5: Charts, Mobile & Data Display Utilities
// ============================================

// Radar/Spider Chart Generator
const radarChart = {
    create(id, data, options = {}) {
        const { size = 300, levels = 5, maxValue = 100, showLabels = true } = options;
        const center = size / 2;
        const radius = (size - 60) / 2;
        const angleSlice = (Math.PI * 2) / data.labels.length;

        // Generate grid levels
        const gridLevels = Array.from({ length: levels }, (_, i) => {
            const r = radius * ((i + 1) / levels);
            const points = data.labels.map((_, j) => {
                const angle = angleSlice * j - Math.PI / 2;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            }).join(' ');
            return `<polygon class="radar-grid" points="${points}"/>`;
        }).join('');

        // Generate axes
        const axes = data.labels.map((label, i) => {
            const angle = angleSlice * i - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            const labelX = center + (radius + 20) * Math.cos(angle);
            const labelY = center + (radius + 20) * Math.sin(angle);
            return `
                <line class="radar-axis" x1="${center}" y1="${center}" x2="${x}" y2="${y}"/>
                ${showLabels ? `<text class="radar-axis-label" x="${labelX}" y="${labelY}" dy="0.35em">${escapeHtml(label)}</text>` : ''}
            `;
        }).join('');

        // Generate data areas
        const areas = data.series.map(series => {
            const points = series.values.map((value, i) => {
                const r = (value / maxValue) * radius;
                const angle = angleSlice * i - Math.PI / 2;
                return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            }).join(' ');

            const dots = series.values.map((value, i) => {
                const r = (value / maxValue) * radius;
                const angle = angleSlice * i - Math.PI / 2;
                return `<circle class="radar-point" cx="${center + r * Math.cos(angle)}" cy="${center + r * Math.sin(angle)}" r="4" stroke="${series.color}"/>`;
            }).join('');

            return `
                <polygon class="radar-area" points="${points}" fill="${series.color}" stroke="${series.color}"/>
                ${dots}
            `;
        }).join('');

        const legend = data.series.map(s => `
            <div class="radar-legend-item">
                <div class="radar-legend-color" style="background: ${s.color}"></div>
                <span>${escapeHtml(s.label)}</span>
            </div>
        `).join('');

        return `
            <div class="radar-chart" id="${id}">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                    ${gridLevels}
                    ${axes}
                    ${areas}
                </svg>
                <div class="radar-legend">${legend}</div>
            </div>
        `;
    }
};

// Scatter Plot Generator
const scatterPlot = {
    create(id, data, options = {}) {
        const { width = 400, height = 300, xLabel = '', yLabel = '', showGrid = true } = options;
        const padding = 40;
        const plotWidth = width - padding * 2;
        const plotHeight = height - padding * 2;

        const xMin = Math.min(...data.map(d => d.x));
        const xMax = Math.max(...data.map(d => d.x));
        const yMin = Math.min(...data.map(d => d.y));
        const yMax = Math.max(...data.map(d => d.y));

        const scaleX = (x) => padding + ((x - xMin) / (xMax - xMin)) * plotWidth;
        const scaleY = (y) => height - padding - ((y - yMin) / (yMax - yMin)) * plotHeight;

        const gridLines = showGrid ? `
            ${[0, 0.25, 0.5, 0.75, 1].map(t => `
                <line class="scatter-grid-line" x1="${padding}" y1="${padding + t * plotHeight}" x2="${width - padding}" y2="${padding + t * plotHeight}"/>
                <line class="scatter-grid-line" x1="${padding + t * plotWidth}" y1="${padding}" x2="${padding + t * plotWidth}" y2="${height - padding}"/>
            `).join('')}
        ` : '';

        const points = data.map((d, i) => `
            <circle class="scatter-point" cx="${scaleX(d.x)}" cy="${scaleY(d.y)}" r="${d.size || 6}"
                data-x="${d.x}" data-y="${d.y}" data-label="${escapeHtml(d.label || '')}"
                fill="${d.color || 'var(--primary-500)'}"
                onmouseover="scatterPlot.showTooltip(event, this)"
                onmouseout="scatterPlot.hideTooltip()"/>
        `).join('');

        return `
            <div class="scatter-plot" id="${id}">
                <svg width="${width}" height="${height}">
                    ${gridLines}
                    <line class="scatter-axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"/>
                    <line class="scatter-axis" x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"/>
                    ${xLabel ? `<text class="scatter-axis-label" x="${width / 2}" y="${height - 8}">${escapeHtml(xLabel)}</text>` : ''}
                    ${yLabel ? `<text class="scatter-axis-label" x="12" y="${height / 2}" transform="rotate(-90, 12, ${height / 2})">${escapeHtml(yLabel)}</text>` : ''}
                    ${points}
                </svg>
                <div class="scatter-tooltip" style="display: none;"></div>
            </div>
        `;
    },

    showTooltip(event, point) {
        const container = point.closest('.scatter-plot');
        const tooltip = container.querySelector('.scatter-tooltip');
        const x = point.dataset.x;
        const y = point.dataset.y;
        const label = point.dataset.label;

        tooltip.textContent = '';
        if (label) {
            const strong = document.createElement('strong');
            strong.textContent = label;
            tooltip.appendChild(strong);
            tooltip.appendChild(document.createElement('br'));
        }
        tooltip.appendChild(document.createTextNode(`X: ${x}, Y: ${y}`));
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.offsetX + 10}px`;
        tooltip.style.top = `${event.offsetY - 30}px`;
    },

    hideTooltip() {
        document.querySelectorAll('.scatter-tooltip').forEach(t => t.style.display = 'none');
    }
};

// Gauge/Meter Generator
const gauge = {
    create(id, value, options = {}) {
        const { size = 120, max = 100, strokeWidth = 12, label = '', thresholds = { warning: 70, danger: 90 } } = options;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius * 0.75; // 270 degrees
        const percentage = Math.min(value / max, 1);
        const offset = circumference * (1 - percentage);

        let status = 'success';
        if (value >= thresholds.danger) status = 'danger';
        else if (value >= thresholds.warning) status = 'warning';

        return `
            <div class="gauge ${status}" id="${id}" style="width: ${size}px; height: ${size}px;">
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                    <circle class="gauge-background" cx="${size / 2}" cy="${size / 2}" r="${radius}"
                        stroke-width="${strokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference * 0.25}"
                        transform="rotate(135, ${size / 2}, ${size / 2})"/>
                    <circle class="gauge-value" cx="${size / 2}" cy="${size / 2}" r="${radius}"
                        stroke-width="${strokeWidth}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset + circumference * 0.25}"
                        transform="rotate(135, ${size / 2}, ${size / 2})"/>
                </svg>
                <div class="gauge-center">
                    <span class="gauge-number">${value}${max === 100 ? '%' : ''}</span>
                    ${label ? `<span class="gauge-label">${escapeHtml(label)}</span>` : ''}
                </div>
            </div>
        `;
    },

    update(id, value) {
        const container = document.getElementById(id);
        if (!container) return;

        const circle = container.querySelector('.gauge-value');
        const number = container.querySelector('.gauge-number');
        const size = container.offsetWidth;
        const strokeWidth = 12;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius * 0.75;
        const percentage = Math.min(value / 100, 1);
        const offset = circumference * (1 - percentage);

        circle.style.strokeDashoffset = offset + circumference * 0.25;
        number.textContent = `${value}%`;
    }
};

// Dual Range Slider
const dualRangeSlider = {
    create(id, options = {}) {
        const { min = 0, max = 100, minValue = 25, maxValue = 75, step = 1, prefix = '', suffix = '' } = options;

        return `
            <div class="dual-range-slider" id="${id}" data-min="${min}" data-max="${max}">
                <div class="dual-range-track"></div>
                <div class="dual-range-fill" style="left: ${((minValue - min) / (max - min)) * 100}%; right: ${100 - ((maxValue - min) / (max - min)) * 100}%"></div>
                <input type="range" class="dual-range-min" min="${min}" max="${max}" step="${step}" value="${minValue}"
                    aria-label="Minimum value" oninput="dualRangeSlider.update('${id}')">
                <input type="range" class="dual-range-max" min="${min}" max="${max}" step="${step}" value="${maxValue}"
                    aria-label="Maximum value" oninput="dualRangeSlider.update('${id}')">
            </div>
            <div class="dual-range-values">
                <span class="dual-range-min-value">${prefix}${minValue}${suffix}</span>
                <span class="dual-range-max-value">${prefix}${maxValue}${suffix}</span>
            </div>
        `;
    },

    update(id) {
        const container = document.getElementById(id);
        const minInput = container.querySelector('.dual-range-min');
        const maxInput = container.querySelector('.dual-range-max');
        const fill = container.querySelector('.dual-range-fill');
        const min = parseInt(container.dataset.min);
        const max = parseInt(container.dataset.max);

        let minVal = parseInt(minInput.value);
        let maxVal = parseInt(maxInput.value);

        if (minVal > maxVal - 1) {
            minInput.value = maxVal - 1;
            minVal = maxVal - 1;
        }
        if (maxVal < minVal + 1) {
            maxInput.value = minVal + 1;
            maxVal = minVal + 1;
        }

        fill.style.left = `${((minVal - min) / (max - min)) * 100}%`;
        fill.style.right = `${100 - ((maxVal - min) / (max - min)) * 100}%`;

        const minDisplay = container.nextElementSibling.querySelector('.dual-range-min-value');
        const maxDisplay = container.nextElementSibling.querySelector('.dual-range-max-value');
        if (minDisplay) minDisplay.textContent = minVal;
        if (maxDisplay) maxDisplay.textContent = maxVal;

        container.dispatchEvent(new CustomEvent('rangechange', { detail: { min: minVal, max: maxVal } }));
    },

    getValues(id) {
        const container = document.getElementById(id);
        return {
            min: parseInt(container.querySelector('.dual-range-min').value),
            max: parseInt(container.querySelector('.dual-range-max').value)
        };
    }
};

// Bottom Sheet Controller (Mobile)
const bottomSheetMobile = {
    create(id, options = {}) {
        const { title = '', content = '', actions = [] } = options;

        return `
            <div class="bottom-sheet-backdrop" id="${id}-backdrop" onclick="bottomSheetMobile.close('${id}')"></div>
            <div class="bottom-sheet" id="${id}">
                <div class="bottom-sheet-handle"></div>
                ${title ? `
                    <div class="bottom-sheet-header">
                        <span class="bottom-sheet-title">${escapeHtml(title)}</span>
                        <button class="bottom-sheet-close" aria-label="Close" onclick="bottomSheetMobile.close('${id}')">${components.icon('x', 20)}</button>
                    </div>
                ` : ''}
                <div class="bottom-sheet-content">${content}</div>
                ${actions.length > 0 ? `
                    <div class="bottom-sheet-actions">
                        ${actions.map(a => `<button class="btn ${a.primary ? 'btn-primary' : ''}" onclick="${a.action}">${escapeHtml(a.label)}</button>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    open(id) {
        const backdrop = document.getElementById(`${id}-backdrop`);
        const sheet = document.getElementById(id);
        if (backdrop) backdrop.classList.add('show');
        if (sheet) sheet.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    close(id) {
        const backdrop = document.getElementById(`${id}-backdrop`);
        const sheet = document.getElementById(id);
        if (backdrop) backdrop.classList.remove('show');
        if (sheet) sheet.classList.remove('show');
        document.body.style.overflow = '';
    }
};

// Swipeable Card Controller
const swipeCard = {
    create(id, cards, options = {}) {
        const { onSwipeLeft = null, onSwipeRight = null } = options;

        return `
            <div class="swipe-card-container" id="${id}" data-current="0">
                ${cards.map((card, i) => `
                    <div class="swipe-card" data-index="${i}" style="z-index: ${cards.length - i}">
                        ${card.image ? `<img class="swipe-card-image" src="${card.image}" alt="${escapeHtml(card.title || 'Swipe card image')}">` : ''}
                        <div class="swipe-card-content">
                            <h3 class="swipe-card-title">${escapeHtml(card.title)}</h3>
                            <p class="swipe-card-description">${escapeHtml(card.description || '')}</p>
                        </div>
                        <div class="swipe-indicator left">NOPE</div>
                        <div class="swipe-indicator right">LIKE</div>
                    </div>
                `).join('')}
                <div class="swipe-card-actions">
                    <button class="swipe-action-btn reject" aria-label="Reject" onclick="swipeCard.swipe('${id}', 'left')">${components.icon('x', 24)}</button>
                    <button class="swipe-action-btn accept" aria-label="Accept" onclick="swipeCard.swipe('${id}', 'right')">${components.icon('heart', 24)}</button>
                </div>
            </div>
        `;
    },

    swipe(id, direction) {
        const container = document.getElementById(id);
        const current = parseInt(container.dataset.current);
        const card = container.querySelector(`[data-index="${current}"]`);

        if (!card) return;

        card.style.transform = `translateX(${direction === 'left' ? '-150%' : '150%'}) rotate(${direction === 'left' ? '-30' : '30'}deg)`;
        card.style.opacity = '0';

        setTimeout(() => {
            card.style.display = 'none';
            container.dataset.current = current + 1;
            container.dispatchEvent(new CustomEvent('swipe', { detail: { direction, index: current } }));
        }, 300);
    }
};

// Expandable Table Rows
const expandableTable = {
    toggle(row) {
        row.classList.toggle('expanded');
        const content = row.nextElementSibling;
        if (content?.classList.contains('expand-content')) {
            content.style.display = row.classList.contains('expanded') ? 'table-row' : 'none';
        }
    },

    expandAll(tableId) {
        const table = document.getElementById(tableId);
        table.querySelectorAll('tr.expandable').forEach(row => {
            row.classList.add('expanded');
            const content = row.nextElementSibling;
            if (content?.classList.contains('expand-content')) {
                content.style.display = 'table-row';
            }
        });
    },

    collapseAll(tableId) {
        const table = document.getElementById(tableId);
        table.querySelectorAll('tr.expandable').forEach(row => {
            row.classList.remove('expanded');
            const content = row.nextElementSibling;
            if (content?.classList.contains('expand-content')) {
                content.style.display = 'none';
            }
        });
    }
};

// Column Visibility Toggle
const columnToggle = {
    init(tableId, columns) {
        const state = columns.reduce((acc, col) => ({ ...acc, [col.key]: col.visible !== false }), {});
        this.applyVisibility(tableId, state);
        return state;
    },

    toggle(tableId, columnKey, state) {
        state[columnKey] = !state[columnKey];
        this.applyVisibility(tableId, state);
        return state;
    },

    applyVisibility(tableId, state) {
        const table = document.getElementById(tableId);
        if (!table) return;

        Object.entries(state).forEach(([key, visible]) => {
            const cells = table.querySelectorAll(`[data-column="${key}"]`);
            cells.forEach(cell => {
                cell.style.display = visible ? '' : 'none';
            });
        });
    }
};

// Inline Cell Edit
const inlineCellEdit = {
    start(cell, onSave) {
        if (cell.classList.contains('editing')) return;

        const currentValue = cell.textContent.trim();
        cell.classList.add('editing');
        cell.innerHTML = `<input type="text" value="${escapeHtml(currentValue)}" aria-label="Edit cell value" onblur="inlineCellEdit.save(this, ${onSave ? 'true' : 'false'})" onkeydown="inlineCellEdit.handleKey(event)">`;
        const input = cell.querySelector('input');
        input.focus();
        input.select();
        cell._onSave = onSave;
    },

    handleKey(event) {
        if (event.key === 'Enter') {
            event.target.blur();
        } else if (event.key === 'Escape') {
            const cell = event.target.closest('.editable-cell');
            cell.classList.remove('editing');
            cell.innerHTML = cell._originalValue || event.target.defaultValue;
        }
    },

    save(input, hasCallback) {
        const cell = input.closest('.editable-cell');
        const newValue = input.value.trim();
        cell.classList.remove('editing');
        cell.textContent = newValue;

        if (hasCallback && cell._onSave) {
            cell._onSave(newValue);
        }
    }
};

// Side Panel Controller
const sidePanel = {
    create(id, options = {}) {
        const { title = '', content = '', position = 'right', footer = '' } = options;

        return `
            <div class="side-panel-backdrop" id="${id}-backdrop" onclick="sidePanel.close('${id}')"></div>
            <div class="side-panel ${position}" id="${id}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
                <div class="side-panel-header">
                    <span class="side-panel-title">${escapeHtml(title)}</span>
                    <button class="side-panel-close" aria-label="Close" onclick="sidePanel.close('${id}')">${components.icon('x', 20)}</button>
                </div>
                <div class="side-panel-content">${content}</div>
                ${footer ? `<div class="side-panel-footer">${footer}</div>` : ''}
            </div>
        `;
    },

    open(id) {
        const backdrop = document.getElementById(`${id}-backdrop`);
        const panel = document.getElementById(id);
        if (backdrop) backdrop.classList.add('show');
        if (panel) panel.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    close(id) {
        const backdrop = document.getElementById(`${id}-backdrop`);
        const panel = document.getElementById(id);
        if (backdrop) backdrop.classList.remove('show');
        if (panel) panel.classList.remove('show');
        document.body.style.overflow = '';
    }
};

// Inline Confirmation
const inlineConfirm = {
    show(triggerId, onConfirm) {
        const trigger = document.getElementById(triggerId);
        const container = trigger.closest('.inline-confirm');
        container.classList.add('confirming');
        container._onConfirm = onConfirm;
    },

    confirm(containerId) {
        const container = document.getElementById(containerId) || document.querySelector('.inline-confirm.confirming');
        if (container?._onConfirm) {
            container._onConfirm();
        }
        this.cancel(containerId);
    },

    cancel(containerId) {
        const container = document.getElementById(containerId) || document.querySelector('.inline-confirm.confirming');
        if (container) {
            container.classList.remove('confirming');
        }
    }
};

// Comparison View
const comparisonView = {
    create(id, items, fields) {
        return `
            <div class="comparison-view" id="${id}">
                ${items.map((item, i) => `
                    <div class="comparison-panel">
                        <div class="comparison-panel-header">
                            <span class="comparison-panel-title">${escapeHtml(item.title || `Item ${i + 1}`)}</span>
                        </div>
                        <div class="comparison-panel-content">
                            ${fields.map(field => {
                                const value = item[field.key];
                                const otherValue = items[1 - i]?.[field.key];
                                const isDifferent = value !== otherValue;
                                const isBetter = field.compare && field.compare(value, otherValue) > 0;
                                const isWorse = field.compare && field.compare(value, otherValue) < 0;

                                return `
                                    <div class="comparison-row">
                                        <div class="comparison-label">${escapeHtml(field.label)}</div>
                                        <div class="comparison-value ${isDifferent ? 'different' : ''} ${isBetter ? 'better' : ''} ${isWorse ? 'worse' : ''}">
                                            ${field.render ? field.render(value) : escapeHtml(String(value ?? '-'))}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Reorderable List
const reorderableList = {
    init(listId, onReorder) {
        const list = document.getElementById(listId);
        if (!list) return;

        let draggedItem = null;

        list.querySelectorAll('.reorderable-item').forEach(item => {
            item.draggable = true;

            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                list.querySelectorAll('.reorderable-item').forEach(i => i.classList.remove('drag-over'));

                if (onReorder) {
                    const order = Array.from(list.querySelectorAll('.reorderable-item')).map(i => i.dataset.id);
                    onReorder(order);
                }
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    item.classList.add('drag-over');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                if (draggedItem && draggedItem !== item) {
                    const rect = item.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        list.insertBefore(draggedItem, item);
                    } else {
                        list.insertBefore(draggedItem, item.nextSibling);
                    }
                }
            });
        });
    }
};

// Signature Pad
const signaturePad = {
    create(id, options = {}) {
        const { width = 400, height = 150 } = options;

        return `
            <div class="signature-pad-container" id="${id}-container">
                <canvas class="signature-pad" id="${id}" width="${width}" height="${height}"></canvas>
                <div class="signature-pad-actions">
                    <span class="signature-pad-hint">Sign above</span>
                    <button class="signature-pad-clear" onclick="signaturePad.clear('${id}')">Clear</button>
                </div>
            </div>
        `;
    },

    init(id) {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');
        const container = document.getElementById(`${id}-container`);
        let drawing = false;
        let lastX = 0;
        let lastY = 0;

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            return { x, y };
        };

        const start = (e) => {
            e.preventDefault();
            drawing = true;
            container.classList.add('active');
            const pos = getPos(e);
            lastX = pos.x;
            lastY = pos.y;
        };

        const draw = (e) => {
            if (!drawing) return;
            e.preventDefault();
            const pos = getPos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            lastX = pos.x;
            lastY = pos.y;
        };

        const end = () => {
            drawing = false;
        };

        canvas.addEventListener('mousedown', start);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', end);
        canvas.addEventListener('mouseleave', end);
        canvas.addEventListener('touchstart', start);
        canvas.addEventListener('touchmove', draw);
        canvas.addEventListener('touchend', end);
    },

    clear(id) {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    toDataURL(id) {
        const canvas = document.getElementById(id);
        return canvas.toDataURL('image/png');
    },

    isEmpty(id) {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        return !data.some(channel => channel !== 0);
    }
};

// Email List Input
const emailListInput = {
    create(id, options = {}) {
        const { placeholder = 'Enter email addresses...', initialEmails = [] } = options;

        return `
            <div class="email-list-input" id="${id}" data-emails='${JSON.stringify(initialEmails)}'>
                ${initialEmails.map(email => this.createChip(email)).join('')}
                <input type="email" placeholder="${escapeHtml(placeholder)}" aria-label="Add email address"
                    onkeydown="emailListInput.handleKeydown(event, '${id}')"
                    onblur="emailListInput.addFromInput('${id}')">
            </div>
        `;
    },

    createChip(email) {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        return `
            <span class="email-chip ${isValid ? '' : 'invalid'}" data-email="${escapeHtml(email)}">
                ${escapeHtml(email)}
                <button class="email-chip-remove" onclick="emailListInput.remove(this)">&times;</button>
            </span>
        `;
    },

    handleKeydown(event, id) {
        if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
            event.preventDefault();
            this.addFromInput(id);
        } else if (event.key === 'Backspace' && !event.target.value) {
            const container = document.getElementById(id);
            const chips = container.querySelectorAll('.email-chip');
            if (chips.length > 0) {
                chips[chips.length - 1].remove();
                this.updateData(id);
            }
        }
    },

    addFromInput(id) {
        const container = document.getElementById(id);
        const input = container.querySelector('input');
        const email = input.value.trim().replace(/,/g, '');

        if (email) {
            const chip = document.createElement('span');
            chip.className = `email-chip ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'invalid'}`;
            chip.dataset.email = email;
            chip.innerHTML = `${escapeHtml(email)}<button class="email-chip-remove" onclick="emailListInput.remove(this)">&times;</button>`;
            container.insertBefore(chip, input);
            input.value = '';
            this.updateData(id);
        }
    },

    remove(button) {
        const chip = button.closest('.email-chip');
        const container = chip.closest('.email-list-input');
        chip.remove();
        this.updateData(container.id);
    },

    updateData(id) {
        const container = document.getElementById(id);
        const emails = Array.from(container.querySelectorAll('.email-chip')).map(c => c.dataset.email);
        container.dataset.emails = JSON.stringify(emails);
        container.dispatchEvent(new CustomEvent('emailschange', { detail: { emails } }));
    },

    getEmails(id) {
        const container = document.getElementById(id);
        return JSON.parse(container.dataset.emails || '[]');
    },

    getValidEmails(id) {
        const container = document.getElementById(id);
        return Array.from(container.querySelectorAll('.email-chip:not(.invalid)')).map(c => c.dataset.email);
    }
};

// Trend Indicator
const trendIndicator = {
    create(value, options = {}) {
        const { showValue = true, suffix = '%' } = options;
        const trend = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
        const displayValue = Math.abs(value);

        return `
            <span class="trend-indicator ${trend}">
                <span class="trend-arrow"></span>
                ${showValue ? `<span>${displayValue}${suffix}</span>` : ''}
            </span>
        `;
    }
};

// ============================================
// Part 6: Accessibility, E-commerce & Celebrations
// ============================================

// ARIA Live Announcer
const ariaAnnounce = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'aria-live-polite';
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'true');
            document.body.appendChild(this.container);
        }
    },

    polite(message) {
        this.init();
        this.container.setAttribute('aria-live', 'polite');
        this.container.textContent = '';
        setTimeout(() => { this.container.textContent = message; }, 100);
    },

    assertive(message) {
        this.init();
        this.container.setAttribute('aria-live', 'assertive');
        this.container.textContent = '';
        setTimeout(() => { this.container.textContent = message; }, 100);
    }
};

// Focus Trap for Modals
const focusTrap = {
    activeTraps: new Map(),

    trap(containerId, returnFocusTo = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableElements = container.querySelectorAll(focusableSelectors);
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        const handleKeydown = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };

        container.addEventListener('keydown', handleKeydown);
        this.activeTraps.set(containerId, { handler: handleKeydown, returnFocusTo: returnFocusTo || document.activeElement });

        if (firstFocusable) firstFocusable.focus();
    },

    release(containerId) {
        const trap = this.activeTraps.get(containerId);
        if (!trap) return;

        const container = document.getElementById(containerId);
        if (container) {
            container.removeEventListener('keydown', trap.handler);
        }

        if (trap.returnFocusTo) {
            trap.returnFocusTo.focus();
        }

        this.activeTraps.delete(containerId);
    }
};

// Success Checkmark Animation
const successCheckmark = {
    create(options = {}) {
        const { size = 56 } = options;
        return `
            <div class="success-checkmark" style="width: ${size}px; height: ${size}px;">
                <svg viewBox="0 0 24 24">
                    <path class="checkmark-path" d="M5 12l5 5L19 7"/>
                </svg>
            </div>
        `;
    },

    show(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = this.create();
            ariaAnnounce.polite('Success');
        }
    }
};

// Error Feedback
const errorFeedback = {
    shake(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('error-shake');
            setTimeout(() => element.classList.remove('error-shake'), 400);
        }
    },

    flash(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('error-flash');
            setTimeout(() => element.classList.remove('error-flash'), 500);
        }
    }
};

// Product Card Generator
const productCard = {
    create(product, options = {}) {
        const { showWishlist = true, showRating = true, showActions = true } = options;
        const hasDiscount = product.originalPrice && product.originalPrice > product.price;
        const discount = hasDiscount ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;

        return `
            <div class="product-card" data-id="${product.id}">
                <div class="product-card-image">
                    <img src="${product.image}" alt="${escapeHtml(product.title)}" loading="lazy">
                    <div class="product-card-badges">
                        ${product.badge ? `<span class="badge-sale ${product.badge}">${product.badge.toUpperCase()}</span>` : ''}
                        ${product.inventory ? `<span class="inventory-badge ${product.inventory.status}"><span class="inventory-badge-dot"></span>${product.inventory.label}</span>` : ''}
                    </div>
                    ${showWishlist ? `
                        <button class="product-card-wishlist ${product.wishlisted ? 'active' : ''}" onclick="productCard.toggleWishlist('${product.id}')">
                            ${components.icon('heart', 18)}
                        </button>
                    ` : ''}
                </div>
                <div class="product-card-body">
                    ${product.brand ? `<div class="product-card-brand">${escapeHtml(product.brand)}</div>` : ''}
                    <h3 class="product-card-title">${escapeHtml(product.title)}</h3>
                    ${showRating && product.rating ? `
                        <div class="product-card-rating">
                            <span class="product-card-rating-stars">${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}</span>
                            ${product.reviewCount ? `<span class="product-card-rating-count">(${product.reviewCount})</span>` : ''}
                        </div>
                    ` : ''}
                    <div class="product-card-price">
                        <span class="product-card-price-current">$${product.price.toFixed(2)}</span>
                        ${hasDiscount ? `
                            <span class="product-card-price-original">$${product.originalPrice.toFixed(2)}</span>
                            <span class="product-card-price-discount">-${discount}%</span>
                        ` : ''}
                    </div>
                </div>
                ${showActions ? `
                    <div class="product-card-actions">
                        <button class="btn btn-primary" onclick="productCard.addToCart('${product.id}')">Add to Cart</button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    toggleWishlist(productId) {
        const btn = document.querySelector(`[data-id="${productId}"] .product-card-wishlist`);
        if (btn) {
            btn.classList.toggle('active');
            const isActive = btn.classList.contains('active');
            ariaAnnounce.polite(isActive ? 'Added to wishlist' : 'Removed from wishlist');
        }
    },

    addToCart(productId) {
        ariaAnnounce.polite('Added to cart');
        snackbar.success('Added to cart');
    }
};

// Variant Selector
const variantSelector = {
    create(id, variants, options = {}) {
        const { type = 'button', label = 'Select option', selected = null } = options;

        return `
            <div class="variant-selector" id="${id}" data-selected="${selected || ''}">
                <div class="variant-selector-label">
                    <span>${escapeHtml(label)}</span>
                    <span class="variant-selector-selected">${selected ? escapeHtml(selected) : 'None selected'}</span>
                </div>
                <div class="variant-options">
                    ${variants.map(v => {
                        const isSelected = v.value === selected;
                        const isDisabled = v.disabled || v.outOfStock;

                        if (type === 'color') {
                            return `
                                <button class="variant-option color-swatch ${isSelected ? 'selected' : ''}"
                                    style="background-color: ${v.color}"
                                    data-value="${escapeHtml(v.value)}"
                                    ${isDisabled ? 'disabled' : ''}
                                    onclick="variantSelector.select('${id}', '${escapeHtml(v.value)}')"
                                    aria-label="${escapeHtml(v.label)}">
                                </button>
                            `;
                        }

                        return `
                            <button class="variant-option ${isSelected ? 'selected' : ''}"
                                data-value="${escapeHtml(v.value)}"
                                ${isDisabled ? 'disabled' : ''}
                                onclick="variantSelector.select('${id}', '${escapeHtml(v.value)}')">
                                ${escapeHtml(v.label)}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    select(id, value) {
        const container = document.getElementById(id);
        if (!container) return;

        container.querySelectorAll('.variant-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === value);
        });

        container.dataset.selected = value;
        const selectedLabel = container.querySelector('.variant-selector-selected');
        if (selectedLabel) selectedLabel.textContent = value;

        container.dispatchEvent(new CustomEvent('variantchange', { detail: { value } }));
    },

    getSelected(id) {
        const container = document.getElementById(id);
        return container?.dataset.selected || null;
    }
};

// Presence Indicator
const presenceIndicator = {
    create(status, options = {}) {
        const { size = 'md' } = options;
        const sizeClass = size === 'sm' ? 'style="width: 8px; height: 8px;"' : size === 'lg' ? 'style="width: 16px; height: 16px;"' : '';

        return `<span class="presence-dot ${status}" ${sizeClass}></span>`;
    },

    update(elementId, status) {
        const dot = document.getElementById(elementId);
        if (dot) {
            dot.className = `presence-dot ${status}`;
        }
    }
};

// Typing Indicator
const typingIndicator = {
    create(userName = null) {
        return `
            <div class="typing-indicator">
                <div class="typing-indicator-dots">
                    <span></span><span></span><span></span>
                </div>
                ${userName ? `<span>${escapeHtml(userName)} is typing...</span>` : '<span>Someone is typing...</span>'}
            </div>
        `;
    }
};

// Confetti Celebration
const confetti = {
    colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'],

    celebrate(options = {}) {
        const { count = 100, duration = 3000 } = options;

        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);

        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = `${Math.random() * 100}%`;
            piece.style.background = this.colors[Math.floor(Math.random() * this.colors.length)];
            piece.style.animationDelay = `${Math.random() * 0.5}s`;
            piece.style.animationDuration = `${2 + Math.random() * 2}s`;
            piece.style.transform = `rotate(${Math.random() * 360}deg)`;

            if (Math.random() > 0.5) {
                piece.style.borderRadius = '50%';
            }

            container.appendChild(piece);
        }

        setTimeout(() => container.remove(), duration);
    }
};

// Achievement Toast
const achievementToast = {
    show(options) {
        const { icon = '🏆', label = 'Achievement Unlocked', title } = options;

        const toast = document.createElement('div');
        toast.className = 'achievement-toast';
        toast.innerHTML = `
            <div class="achievement-badge-icon">${icon}</div>
            <div class="achievement-content">
                <div class="achievement-label">${escapeHtml(label)}</div>
                <div class="achievement-title">${escapeHtml(title)}</div>
            </div>
        `;

        document.body.appendChild(toast);
        ariaAnnounce.assertive(`${label}: ${title}`);

        setTimeout(() => {
            toast.style.animation = 'achievementSlide 0.3s ease reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
};

// Milestone Celebration
const milestoneCelebration = {
    show(options) {
        const { icon = '🎉', title, description, stat, statLabel, onClose } = options;

        const overlay = document.createElement('div');
        overlay.className = 'milestone-overlay';
        overlay.innerHTML = `
            <div class="milestone-card">
                <div class="milestone-icon">${icon}</div>
                <h2 class="milestone-title">${escapeHtml(title)}</h2>
                <p class="milestone-description">${escapeHtml(description)}</p>
                ${stat ? `
                    <div class="milestone-stat">${stat}</div>
                    ${statLabel ? `<div class="milestone-stat-label">${escapeHtml(statLabel)}</div>` : ''}
                ` : ''}
                <button class="btn btn-primary" style="margin-top: 24px;" onclick="milestoneCelebration.close()">Continue</button>
            </div>
        `;

        overlay._onClose = onClose;
        document.body.appendChild(overlay);
        confetti.celebrate();

        ariaAnnounce.assertive(`Milestone: ${title}`);
    },

    close() {
        const overlay = document.querySelector('.milestone-overlay');
        if (overlay) {
            if (overlay._onClose) overlay._onClose();
            overlay.remove();
        }
    }
};

// Audio Player Controller
const audioPlayer = {
    create(id, src, options = {}) {
        const { title = 'Audio' } = options;

        return `
            <div class="audio-player" id="${id}" data-src="${src}">
                <button class="audio-player-btn" onclick="audioPlayer.toggle('${id}')" aria-label="Play">
                    ${components.icon('play', 20)}
                </button>
                <div class="audio-player-progress">
                    <div class="audio-player-track" onclick="audioPlayer.seek(event, '${id}')">
                        <div class="audio-player-track-fill" style="width: 0%"></div>
                    </div>
                    <div class="audio-player-time">
                        <span class="audio-player-current">0:00</span>
                        <span class="audio-player-duration">0:00</span>
                    </div>
                </div>
                <div class="audio-player-volume">
                    ${components.icon('volume-2', 16)}
                    <input type="range" min="0" max="100" value="100" aria-label="Volume" onchange="audioPlayer.setVolume('${id}', this.value)">
                </div>
            </div>
        `;
    },

    instances: new Map(),

    init(id) {
        const container = document.getElementById(id);
        if (!container || this.instances.has(id)) return;

        const audio = new Audio(container.dataset.src);
        this.instances.set(id, audio);

        audio.addEventListener('timeupdate', () => this.updateProgress(id));
        audio.addEventListener('loadedmetadata', () => this.updateDuration(id));
        audio.addEventListener('ended', () => this.onEnded(id));
    },

    toggle(id) {
        this.init(id);
        const audio = this.instances.get(id);
        const container = document.getElementById(id);
        const btn = container.querySelector('.audio-player-btn');

        if (audio.paused) {
            audio.play();
            btn.innerHTML = components.icon('pause', 20);
            btn.setAttribute('aria-label', 'Pause');
        } else {
            audio.pause();
            btn.innerHTML = components.icon('play', 20);
            btn.setAttribute('aria-label', 'Play');
        }
    },

    seek(event, id) {
        const audio = this.instances.get(id);
        if (!audio) return;

        const track = event.currentTarget;
        const rect = track.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    },

    setVolume(id, value) {
        const audio = this.instances.get(id);
        if (audio) audio.volume = value / 100;
    },

    updateProgress(id) {
        const audio = this.instances.get(id);
        const container = document.getElementById(id);
        if (!audio || !container) return;

        const percent = (audio.currentTime / audio.duration) * 100;
        container.querySelector('.audio-player-track-fill').style.width = `${percent}%`;
        container.querySelector('.audio-player-current').textContent = this.formatTime(audio.currentTime);
    },

    updateDuration(id) {
        const audio = this.instances.get(id);
        const container = document.getElementById(id);
        if (!audio || !container) return;

        container.querySelector('.audio-player-duration').textContent = this.formatTime(audio.duration);
    },

    onEnded(id) {
        const container = document.getElementById(id);
        const btn = container.querySelector('.audio-player-btn');
        btn.innerHTML = components.icon('play', 20);
        btn.setAttribute('aria-label', 'Play');
    },

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
};

// Image Carousel Controller
const imageCarousel = {
    create(id, images, options = {}) {
        const { showThumbs = true, showDots = true, showNav = true } = options;

        return `
            <div class="image-carousel" id="${id}" data-current="0">
                <div class="image-carousel-main">
                    <img src="${images[0]}" alt="Image 1">
                    ${showNav ? `
                        <button class="image-carousel-nav prev" aria-label="Previous image" onclick="imageCarousel.prev('${id}')">${components.icon('chevron-left', 20)}</button>
                        <button class="image-carousel-nav next" aria-label="Next image" onclick="imageCarousel.next('${id}')">${components.icon('chevron-right', 20)}</button>
                    ` : ''}
                </div>
                ${showDots ? `
                    <div class="image-carousel-dots">
                        ${images.map((_, i) => `<button class="image-carousel-dot ${i === 0 ? 'active' : ''}" onclick="imageCarousel.goTo('${id}', ${i})"></button>`).join('')}
                    </div>
                ` : ''}
                ${showThumbs ? `
                    <div class="image-carousel-thumbs">
                        ${images.map((img, i) => `<div class="image-carousel-thumb ${i === 0 ? 'active' : ''}" onclick="imageCarousel.goTo('${id}', ${i})"><img src="${img}" alt="Thumbnail ${i + 1}"></div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    goTo(id, index) {
        const container = document.getElementById(id);
        if (!container) return;

        const images = container.querySelectorAll('.image-carousel-thumbs img, .image-carousel-dots + script');
        const mainImg = container.querySelector('.image-carousel-main img');
        const thumbs = container.querySelectorAll('.image-carousel-thumb');
        const dots = container.querySelectorAll('.image-carousel-dot');

        if (thumbs[index]) {
            mainImg.src = thumbs[index].querySelector('img').src;
        }

        thumbs.forEach((t, i) => t.classList.toggle('active', i === index));
        dots.forEach((d, i) => d.classList.toggle('active', i === index));

        container.dataset.current = index;
    },

    next(id) {
        const container = document.getElementById(id);
        const current = parseInt(container.dataset.current);
        const total = container.querySelectorAll('.image-carousel-thumb').length || container.querySelectorAll('.image-carousel-dot').length;
        this.goTo(id, (current + 1) % total);
    },

    prev(id) {
        const container = document.getElementById(id);
        const current = parseInt(container.dataset.current);
        const total = container.querySelectorAll('.image-carousel-thumb').length || container.querySelectorAll('.image-carousel-dot').length;
        this.goTo(id, (current - 1 + total) % total);
    }
};

// Progressive Image Loader
const progressiveImage = {
    load(imgElement) {
        const fullSrc = imgElement.dataset.src;
        if (!fullSrc) return;

        const container = imgElement.closest('.progressive-image');
        const fullImg = new Image();

        fullImg.onload = () => {
            imgElement.src = fullSrc;
            imgElement.classList.add('full');
            container?.classList.add('loaded');
        };

        fullImg.src = fullSrc;
    },

    _observer: null,

    observeAll() {
        if (this._observer) this._observer.disconnect();
        if (!('IntersectionObserver' in window)) { document.querySelectorAll('[data-lazy-src]').forEach(el => this.load(el)); return; }
        this._observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.load(entry.target);
                    this._observer.unobserve(entry.target);
                }
            });
        }, { rootMargin: '50px' });

        document.querySelectorAll('.progressive-image img[data-src]').forEach(img => {
            this._observer.observe(img);
        });
    }
};

// ============================================
// Part 7: Form Input Masks & Enhanced Utilities
// ============================================

// Credit Card Input Mask
const creditCardMask = {
    init(input) {
        if (!input) return;

        const brandIcon = document.createElement('span');
        brandIcon.className = 'card-brand-icon';
        input.parentElement?.insertBefore(brandIcon, input);

        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            const brand = this.detectBrand(value);

            // Format with spaces
            if (brand === 'amex') {
                value = value.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3').trim();
            } else {
                value = value.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
            }

            e.target.value = value.substring(0, brand === 'amex' ? 17 : 19);
            this.updateBrandIcon(brandIcon, brand);
        });
    },

    detectBrand(number) {
        if (/^4/.test(number)) return 'visa';
        if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'mastercard';
        if (/^3[47]/.test(number)) return 'amex';
        if (/^6011|65|64[4-9]/.test(number)) return 'discover';
        return 'unknown';
    },

    updateBrandIcon(icon, brand) {
        icon.className = `card-brand-icon card-brand-${brand}`;
        icon.setAttribute('data-brand', brand);
    },

    validate(number) {
        const digits = number.replace(/\D/g, '');
        if (digits.length < 13 || digits.length > 19) return false;

        // Luhn algorithm
        let sum = 0;
        let isEven = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let digit = parseInt(digits[i], 10);
            if (isEven) {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
            isEven = !isEven;
        }
        return sum % 10 === 0;
    }
};

// Phone Input Mask
const phoneInputMask = {
    init(input, options = {}) {
        if (!input) return;

        const format = options.format || 'us'; // us, international

        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');

            if (format === 'us') {
                if (value.length > 10) value = value.substring(0, 10);
                if (value.length >= 6) {
                    value = `(${value.substring(0, 3)}) ${value.substring(3, 6)}-${value.substring(6)}`;
                } else if (value.length >= 3) {
                    value = `(${value.substring(0, 3)}) ${value.substring(3)}`;
                }
            } else {
                // International format
                if (value.length > 15) value = value.substring(0, 15);
                if (value.length > 0) {
                    value = '+' + value.replace(/(\d{1,3})(\d{1,3})?(\d{1,4})?(\d{1,4})?/, (m, p1, p2, p3, p4) => {
                        let result = p1;
                        if (p2) result += ' ' + p2;
                        if (p3) result += ' ' + p3;
                        if (p4) result += ' ' + p4;
                        return result;
                    });
                }
            }

            e.target.value = value;
        });
    }
};

// Date Shortcuts - Natural language date input
const dateShortcuts = {
    shortcuts: {
        'today': () => new Date(),
        'tomorrow': () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; },
        'yesterday': () => { const d = new Date(); d.setDate(d.getDate() - 1); return d; },
        'next week': () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; },
        'next month': () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; },
        'eow': () => { const d = new Date(); d.setDate(d.getDate() + (5 - d.getDay())); return d; }, // End of week (Friday)
        'eom': () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0); }, // End of month
    },

    init(input) {
        if (!input) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'date-shortcuts-dropdown';
        dropdown.innerHTML = Object.keys(this.shortcuts).map(key =>
            `<div class="date-shortcut-item" data-shortcut="${key}">${key}</div>`
        ).join('');
        input.parentElement?.appendChild(dropdown);

        input.addEventListener('focus', () => dropdown.classList.add('show'));
        input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('show'), 200));

        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.date-shortcut-item');
            if (item) {
                const shortcut = item.dataset.shortcut;
                const date = this.shortcuts[shortcut]();
                input.value = this.formatDate(date);
                input.dispatchEvent(new Event('change'));
                dropdown.classList.remove('show');
            }
        });

        input.addEventListener('input', (e) => {
            const value = e.target.value.toLowerCase().trim();
            if (this.shortcuts[value]) {
                const date = this.shortcuts[value]();
                input.value = this.formatDate(date);
            }
        });
    },

    formatDate(date) {
        return toLocalDate(date);
    }
};

// Conditional Fields - Show/hide field groups based on conditions
const conditionalFields = {
    init(container) {
        if (!container) return;

        const triggers = container.querySelectorAll('[data-condition-trigger]');

        triggers.forEach(trigger => {
            const targetSelector = trigger.dataset.conditionTarget;
            const showValue = trigger.dataset.conditionValue;

            const updateVisibility = () => {
                const targets = container.querySelectorAll(targetSelector);
                const value = trigger.type === 'checkbox' ? trigger.checked.toString() : trigger.value;
                const shouldShow = showValue ? value === showValue : !!value;

                targets.forEach(target => {
                    target.classList.toggle('conditional-hidden', !shouldShow);
                    target.querySelectorAll('input, select, textarea').forEach(input => {
                        input.disabled = !shouldShow;
                    });
                });
            };

            trigger.addEventListener('change', updateVisibility);
            updateVisibility(); // Initial state
        });
    }
};

// Form Section - Collapsible form sections
const formSection = {
    render(title, content, options = {}) {
        const { collapsed = false, icon = null } = options;
        const id = `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        return `
            <div class="form-section ${collapsed ? 'collapsed' : ''}" data-section-id="${id}">
                <div class="form-section-header" onclick="formSection.toggle('${id}')">
                    ${icon ? components.icon(icon, 18) : ''}
                    <span class="form-section-title">${title}</span>
                    <span class="form-section-toggle">${components.icon('chevron-down', 16)}</span>
                </div>
                <div class="form-section-content">
                    ${content}
                </div>
            </div>
        `;
    },

    toggle(id) {
        const section = document.querySelector(`[data-section-id="${id}"]`);
        if (section) {
            section.classList.toggle('collapsed');
        }
    },

    expandAll(container) {
        container?.querySelectorAll('.form-section').forEach(s => s.classList.remove('collapsed'));
    },

    collapseAll(container) {
        container?.querySelectorAll('.form-section').forEach(s => s.classList.add('collapsed'));
    }
};

// Auto Save Visual Indicator
const autoSaveIndicator = {
    timers: new Map(),

    init(form, options = {}) {
        if (!form) return;

        const {
            delay = 2000,
            onSave = null,
            indicator = null
        } = options;

        const indicatorEl = indicator || this.createIndicator(form);

        form.addEventListener('input', () => {
            this.updateStatus(indicatorEl, 'typing');

            // Clear existing timer
            if (this.timers.has(form)) {
                clearTimeout(this.timers.get(form));
            }

            // Set new timer
            this.timers.set(form, setTimeout(async () => {
                this.updateStatus(indicatorEl, 'saving');

                try {
                    if (onSave) {
                        await onSave(new FormData(form));
                    }
                    this.updateStatus(indicatorEl, 'saved');
                } catch (error) {
                    this.updateStatus(indicatorEl, 'error');
                }
            }, delay));
        });
    },

    createIndicator(form) {
        const indicator = document.createElement('div');
        indicator.className = 'auto-save-indicator';
        indicator.innerHTML = '<span class="auto-save-text">All changes saved</span>';
        form.appendChild(indicator);
        return indicator;
    },

    updateStatus(indicator, status) {
        if (!indicator) return;

        const statusMap = {
            typing: { text: 'Editing...', class: 'typing' },
            saving: { text: 'Saving...', class: 'saving' },
            saved: { text: 'All changes saved', class: 'saved' },
            error: { text: 'Save failed', class: 'error' }
        };

        const { text, class: cls } = statusMap[status] || statusMap.saved;
        indicator.className = `auto-save-indicator ${cls}`;
        indicator.querySelector('.auto-save-text').textContent = text;
    }
};

// Validation Summary - Error summary with jump links
const validationSummary = {
    render(errors) {
        if (!errors || errors.length === 0) return '';

        return `
            <div class="validation-summary" role="alert" aria-live="polite">
                <div class="validation-summary-header">
                    ${components.icon('alert-circle', 18)}
                    <span>Please fix ${errors.length} error${errors.length > 1 ? 's' : ''} before submitting</span>
                </div>
                <ul class="validation-summary-list">
                    ${errors.map(err => `
                        <li>
                            <a href="#${err.fieldId}" onclick="validationSummary.focusField('${err.fieldId}')">${err.message}</a>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    },

    focusField(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.focus();
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    collectErrors(form) {
        const errors = [];
        form.querySelectorAll(':invalid').forEach(field => {
            if (field.id && field.validationMessage) {
                errors.push({
                    fieldId: field.id,
                    message: field.validationMessage
                });
            }
        });
        return errors;
    }
};

// Form Progress Bar
const formProgress = {
    init(form, progressBar) {
        if (!form || !progressBar) return;

        const updateProgress = () => {
            const fields = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
            let filled = 0;
            let total = 0;

            fields.forEach(field => {
                if (field.offsetParent !== null) { // Only visible fields
                    total++;
                    if (field.value.trim() || (field.type === 'checkbox' && field.checked)) {
                        filled++;
                    }
                }
            });

            const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
            progressBar.style.setProperty('--progress', `${percent}%`);
            progressBar.setAttribute('aria-valuenow', percent);

            const label = progressBar.querySelector('.form-progress-label');
            if (label) label.textContent = `${percent}% complete`;
        };

        form.addEventListener('input', updateProgress);
        form.addEventListener('change', updateProgress);
        updateProgress();
    },

    render() {
        return `
            <div class="form-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                <div class="form-progress-fill"></div>
                <span class="form-progress-label">0% complete</span>
            </div>
        `;
    }
};

// Recent Pages Widget
const recentPages = {
    storageKey: 'vaultlister_recent_pages',
    maxItems: 8,

    add(page, title) {
        const pages = this.get();
        const existing = pages.findIndex(p => p.page === page);

        if (existing > -1) {
            pages.splice(existing, 1);
        }

        pages.unshift({ page, title, timestamp: Date.now() });

        if (pages.length > this.maxItems) {
            pages.pop();
        }

        localStorage.setItem(this.storageKey, JSON.stringify(pages));
    },

    get() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        } catch {
            return [];
        }
    },

    render() {
        const pages = this.get();
        if (pages.length === 0) return '';

        return `
            <div class="recent-pages-widget">
                <div class="recent-pages-header">
                    ${components.icon('clock', 16)}
                    <span>Recent Pages</span>
                </div>
                <div class="recent-pages-list">
                    ${pages.map(p => `
                        <a href="#" class="recent-page-item" onclick="router.navigate('${p.page}'); return false;">
                            ${p.title}
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }
};

// Table Row Selection
const tableSelection = {
    state: new Map(),

    init(table, options = {}) {
        if (!table) return;

        const tableId = table.id || `table-${Date.now()}`;
        this.state.set(tableId, new Set());

        const { onSelectionChange = null } = options;

        // Header checkbox
        const headerCheckbox = table.querySelector('thead input[type="checkbox"]');
        if (headerCheckbox) {
            headerCheckbox.addEventListener('change', () => {
                const selected = this.state.get(tableId);
                const rows = table.querySelectorAll('tbody tr');

                rows.forEach(row => {
                    const checkbox = row.querySelector('input[type="checkbox"]');
                    const rowId = row.dataset.id;

                    if (headerCheckbox.checked) {
                        selected.add(rowId);
                        checkbox && (checkbox.checked = true);
                        row.classList.add('selected');
                    } else {
                        selected.clear();
                        checkbox && (checkbox.checked = false);
                        row.classList.remove('selected');
                    }
                });

                onSelectionChange?.(Array.from(selected));
            });
        }

        // Row checkboxes
        table.querySelectorAll('tbody tr').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"]');
            const rowId = row.dataset.id;

            if (checkbox) {
                checkbox.addEventListener('change', () => {
                    const selected = this.state.get(tableId);

                    if (checkbox.checked) {
                        selected.add(rowId);
                        row.classList.add('selected');
                    } else {
                        selected.delete(rowId);
                        row.classList.remove('selected');
                    }

                    // Update header checkbox
                    const allChecked = table.querySelectorAll('tbody input[type="checkbox"]:checked').length ===
                                       table.querySelectorAll('tbody input[type="checkbox"]').length;
                    if (headerCheckbox) headerCheckbox.checked = allChecked;

                    onSelectionChange?.(Array.from(selected));
                });
            }
        });
    },

    getSelected(tableId) {
        return Array.from(this.state.get(tableId) || []);
    },

    clearSelection(tableId) {
        this.state.set(tableId, new Set());
        const table = document.getElementById(tableId);
        if (table) {
            table.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            table.querySelectorAll('tr.selected').forEach(row => row.classList.remove('selected'));
        }
    }
};

// Table Export
const tableExport = {
    toCSV(table, filename = 'export.csv') {
        if (!table) return;

        const rows = [];
        const headers = [];

        // Get headers
        table.querySelectorAll('thead th').forEach(th => {
            if (!th.querySelector('input[type="checkbox"]')) {
                headers.push(this.escapeCSV(th.textContent.trim()));
            }
        });
        rows.push(headers.join(','));

        // Get data rows
        table.querySelectorAll('tbody tr').forEach(tr => {
            const cells = [];
            tr.querySelectorAll('td').forEach(td => {
                if (!td.querySelector('input[type="checkbox"]')) {
                    cells.push(this.escapeCSV(td.textContent.trim()));
                }
            });
            rows.push(cells.join(','));
        });

        const csv = rows.join('\n');
        this.download(csv, filename, 'text/csv');
    },

    escapeCSV(value) {
        if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
            value = "'" + value;
        }
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    },

    download(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    render(tableId) {
        return `
            <div class="table-export-menu">
                <button class="btn btn-secondary btn-sm" onclick="tableExport.toCSV(document.getElementById('${tableId}'), '${tableId}.csv')">
                    ${components.icon('download', 14)} Export CSV
                </button>
            </div>
        `;
    }
};

// Row Hover Actions
const rowHoverActions = {
    init(table, actions) {
        if (!table || !actions) return;

        table.querySelectorAll('tbody tr').forEach(row => {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'row-hover-actions';
            actionsContainer.innerHTML = actions.map(action => `
                <button class="row-action-btn" title="${action.label}" data-action="${action.id}">
                    ${components.icon(action.icon, 14)}
                </button>
            `).join('');

            const lastCell = row.querySelector('td:last-child');
            if (lastCell) {
                lastCell.style.position = 'relative';
                lastCell.appendChild(actionsContainer);
            }

            actionsContainer.addEventListener('click', (e) => {
                const btn = e.target.closest('.row-action-btn');
                if (btn) {
                    const actionId = btn.dataset.action;
                    const action = actions.find(a => a.id === actionId);
                    action?.onClick?.(row.dataset.id, row);
                }
            });
        });
    }
};

// Pull to Refresh (Mobile)
const pullToRefresh = {
    init(container, onRefresh) {
        if (!container || !onRefresh) return;

        let startY = 0;
        let pulling = false;

        const indicator = document.createElement('div');
        indicator.className = 'pull-to-refresh-indicator';
        indicator.innerHTML = `
            <div class="pull-refresh-spinner"></div>
            <span class="pull-refresh-text">Pull to refresh</span>
        `;
        container.insertBefore(indicator, container.firstChild);

        container.addEventListener('touchstart', (e) => {
            if (container.scrollTop === 0) {
                startY = e.touches[0].clientY;
                pulling = true;
            }
        });

        container.addEventListener('touchmove', (e) => {
            if (!pulling) return;

            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;

            if (diff > 0 && diff < 150) {
                indicator.style.transform = `translateY(${diff}px)`;
                indicator.classList.toggle('ready', diff > 80);
                indicator.querySelector('.pull-refresh-text').textContent =
                    diff > 80 ? 'Release to refresh' : 'Pull to refresh';
            }
        });

        container.addEventListener('touchend', async () => {
            if (!pulling) return;
            pulling = false;

            if (indicator.classList.contains('ready')) {
                indicator.classList.add('refreshing');
                indicator.querySelector('.pull-refresh-text').textContent = 'Refreshing...';

                try {
                    await onRefresh();
                } finally {
                    indicator.classList.remove('refreshing', 'ready');
                    indicator.style.transform = '';
                }
            } else {
                indicator.style.transform = '';
            }
        });
    }
};

// Swipe Row Actions
const swipeRow = {
    init(row, options = {}) {
        if (!row) return;

        const {
            leftAction = null,
            rightAction = null,
            threshold = 80
        } = options;

        let startX = 0;
        let currentX = 0;

        const content = row.querySelector('.swipe-row-content') || row;

        row.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            content.style.transition = 'none';
        });

        row.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX - startX;

            // Limit swipe distance
            if (Math.abs(currentX) > 120) {
                currentX = currentX > 0 ? 120 : -120;
            }

            content.style.transform = `translateX(${currentX}px)`;

            // Show action indicators
            if (currentX > threshold && leftAction) {
                row.classList.add('swipe-left-active');
            } else if (currentX < -threshold && rightAction) {
                row.classList.add('swipe-right-active');
            } else {
                row.classList.remove('swipe-left-active', 'swipe-right-active');
            }
        });

        row.addEventListener('touchend', () => {
            content.style.transition = 'transform 0.2s ease';

            if (currentX > threshold && leftAction) {
                leftAction(row);
            } else if (currentX < -threshold && rightAction) {
                rightAction(row);
            }

            content.style.transform = '';
            row.classList.remove('swipe-left-active', 'swipe-right-active');
            currentX = 0;
        });
    }
};

// Rich Tooltip
const richTooltip = {
    show(target, content, options = {}) {
        const { position = 'top', width = 'auto' } = options;

        // Remove existing
        this.hide();

        const tooltip = document.createElement('div');
        tooltip.className = `rich-tooltip rich-tooltip-${position}`;
        tooltip.style.width = width;
        tooltip.textContent = content;
        document.body.appendChild(tooltip);

        // Position
        const rect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - tooltipRect.height - 8;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 8;
                left = rect.left + (rect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.left - tooltipRect.width - 8;
                break;
            case 'right':
                top = rect.top + (rect.height - tooltipRect.height) / 2;
                left = rect.right + 8;
                break;
        }

        tooltip.style.top = `${Math.max(8, top)}px`;
        tooltip.style.left = `${Math.max(8, left)}px`;

        requestAnimationFrame(() => tooltip.classList.add('show'));

        return tooltip;
    },

    hide() {
        document.querySelectorAll('.rich-tooltip').forEach(t => t.remove());
    },

    init(selector) {
        document.querySelectorAll(selector).forEach(el => {
            el.addEventListener('mouseenter', () => {
                const content = el.dataset.tooltipContent || el.title;
                const position = el.dataset.tooltipPosition || 'top';
                if (content) {
                    el.removeAttribute('title');
                    this.show(el, content, { position });
                }
            });

            el.addEventListener('mouseleave', () => this.hide());
        });
    }
};

// ============================================
// Part 8: Autocomplete, Navigation, Dashboard Widgets
// ============================================

// Smart Autocomplete Input with Suggestions
const smartAutocomplete = {
    instances: new Map(),

    init(input, options = {}) {
        if (!input) return;

        const {
            data = [],
            fetchData = null,
            onSelect = null,
            minChars = 1,
            maxResults = 10,
            groupBy = null,
            renderItem = null
        } = options;

        const container = document.createElement('div');
        container.className = 'autocomplete-container';
        input.parentNode.insertBefore(container, input);
        container.appendChild(input);
        input.classList.add('autocomplete-input');

        const clearBtn = document.createElement('button');
        clearBtn.className = 'autocomplete-clear';
        clearBtn.innerHTML = '×';
        clearBtn.type = 'button';
        container.appendChild(clearBtn);

        const dropdown = document.createElement('div');
        dropdown.className = 'autocomplete-dropdown';
        container.appendChild(dropdown);

        let highlightedIndex = -1;
        let results = [];

        const updateDropdown = async (query) => {
            if (query.length < minChars) {
                dropdown.classList.remove('show');
                return;
            }

            // Show loading
            dropdown.innerHTML = '<div class="autocomplete-loading"><div class="autocomplete-loading-spinner"></div></div>';
            dropdown.classList.add('show');

            // Get results
            if (fetchData) {
                results = await fetchData(query);
            } else {
                results = data.filter(item => {
                    const searchText = typeof item === 'string' ? item : item.label || item.title;
                    return searchText.toLowerCase().includes(query.toLowerCase());
                });
            }

            results = results.slice(0, maxResults);

            if (results.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-empty">No results found</div>';
                return;
            }

            // Group results if groupBy is set
            let html = '';
            if (groupBy) {
                const groups = {};
                results.forEach(item => {
                    const group = item[groupBy] || 'Other';
                    if (!groups[group]) groups[group] = [];
                    groups[group].push(item);
                });

                Object.entries(groups).forEach(([group, items]) => {
                    html += `<div class="autocomplete-group">
                        <div class="autocomplete-group-label">${escapeHtml(group)}</div>
                        ${items.map((item, i) => this.renderItem(item, query, renderItem)).join('')}
                    </div>`;
                });
            } else {
                html = results.map((item, i) => this.renderItem(item, query, renderItem)).join('');
            }

            dropdown.innerHTML = html;
            highlightedIndex = -1;
        };

        input.addEventListener('input', (e) => updateDropdown(e.target.value));
        input.addEventListener('focus', () => {
            if (input.value.length >= minChars) {
                updateDropdown(input.value);
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            dropdown.classList.remove('show');
            input.focus();
        });

        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.autocomplete-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
            } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                items[highlightedIndex].click();
            } else if (e.key === 'Escape') {
                dropdown.classList.remove('show');
            }

            items.forEach((item, i) => {
                item.classList.toggle('highlighted', i === highlightedIndex);
            });
        });

        dropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.autocomplete-item');
            if (item) {
                const index = parseInt(item.dataset.index, 10);
                const selected = results[index];
                input.value = typeof selected === 'string' ? selected : selected.label || selected.title;
                dropdown.classList.remove('show');
                onSelect?.(selected);
            }
        });

        this.instances.set(input, { container, dropdown, results });
    },

    renderItem(item, query, customRender) {
        if (customRender) return customRender(item, query);

        const label = typeof item === 'string' ? item : item.label || item.title;
        const subtitle = item.subtitle || '';
        const icon = item.icon || '';
        const index = typeof item === 'object' ? item._index : 0;

        const highlighted = label.replace(
            new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
            '<span class="autocomplete-highlight">$1</span>'
        );

        return `
            <div class="autocomplete-item" data-index="${index}">
                ${icon ? `<div class="autocomplete-item-icon">${icon}</div>` : ''}
                <div class="autocomplete-item-content">
                    <div class="autocomplete-item-title">${highlighted}</div>
                    ${subtitle ? `<div class="autocomplete-item-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                </div>
            </div>
        `;
    }
};

// Smart Category Selector
const categorySelector = {
    init(trigger, options = {}) {
        if (!trigger) return;

        const {
            categories = [],
            favorites = [],
            onSelect = null,
            value = null
        } = options;

        const container = document.createElement('div');
        container.className = 'category-selector';
        trigger.parentNode.insertBefore(container, trigger);
        container.appendChild(trigger);
        trigger.classList.add('category-selector-trigger');

        const dropdown = document.createElement('div');
        dropdown.className = 'category-selector-dropdown';
        container.appendChild(dropdown);

        let selectedValue = value;

        const render = () => {
            dropdown.innerHTML = `
                <div class="category-selector-search">
                    <input type="text" placeholder="Search categories..." aria-label="Search categories" />
                </div>
                ${favorites.length ? `
                    <div class="category-selector-favorites">
                        <div class="category-selector-favorites-label">Frequently used</div>
                        <div class="category-selector-favorites-list">
                            ${favorites.map(f => `
                                <span class="category-favorite-chip" data-value="${f.value}">${f.label}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                <div class="category-selector-tree">
                    ${this.renderTree(categories, selectedValue)}
                </div>
            `;
        };

        render();

        trigger.addEventListener('click', () => {
            trigger.classList.toggle('open');
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                trigger.classList.remove('open');
                dropdown.classList.remove('show');
            }
        });

        dropdown.addEventListener('click', (e) => {
            const chip = e.target.closest('.category-favorite-chip');
            const item = e.target.closest('.category-tree-item');
            const toggle = e.target.closest('.category-tree-toggle');

            if (toggle) {
                e.stopPropagation();
                const parent = toggle.closest('.category-tree-item');
                const children = parent.nextElementSibling;
                toggle.classList.toggle('expanded');
                children?.classList.toggle('expanded');
                return;
            }

            if (chip || item) {
                const value = (chip || item).dataset.value;
                selectedValue = value;
                this.updateTrigger(trigger, categories, value);
                trigger.classList.remove('open');
                dropdown.classList.remove('show');
                onSelect?.(value);
            }
        });

        const searchInput = dropdown.querySelector('input');
        searchInput?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            dropdown.querySelectorAll('.category-tree-item').forEach(item => {
                const label = item.querySelector('.category-tree-label').textContent.toLowerCase();
                item.style.display = label.includes(query) ? '' : 'none';
            });
        });
    },

    renderTree(categories, selected, depth = 0) {
        return categories.map(cat => {
            const hasChildren = cat.children && cat.children.length > 0;
            return `
                <div class="category-tree-item ${cat.value === selected ? 'selected' : ''}"
                     data-value="${cat.value}" style="padding-left: ${12 + depth * 20}px">
                    ${hasChildren ? `
                        <span class="category-tree-toggle">${components.icon('chevron-right', 14)}</span>
                    ` : '<span style="width: 20px"></span>'}
                    <span class="category-tree-label">${cat.label}</span>
                    ${cat.count ? `<span class="category-tree-count">(${cat.count})</span>` : ''}
                </div>
                ${hasChildren ? `
                    <div class="category-tree-children">
                        ${this.renderTree(cat.children, selected, depth + 1)}
                    </div>
                ` : ''}
            `;
        }).join('');
    },

    updateTrigger(trigger, categories, value) {
        const path = this.findPath(categories, value);
        trigger.innerHTML = `
            <span class="category-selector-value">
                <span class="category-selector-breadcrumb">
                    ${path.map(p => `<span>${p}</span>`).join(' / ')}
                </span>
            </span>
            ${components.icon('chevron-down', 14)}
        `;
    },

    findPath(categories, value, path = []) {
        for (const cat of categories) {
            if (cat.value === value) return [...path, cat.label];
            if (cat.children) {
                const found = this.findPath(cat.children, value, [...path, cat.label]);
                if (found) return found;
            }
        }
        return null;
    }
};

// Inline Field Editing (Enhanced)
const inlineFieldEdit = {
    init(element, options = {}) {
        if (!element) return;

        const {
            type = 'text',
            onSave = null,
            validate = null
        } = options;

        element.classList.add('inline-editable');
        const originalContent = element.textContent;
        const value = element.dataset.value || element.textContent.trim();

        const editIcon = document.createElement('span');
        editIcon.className = 'inline-editable-icon';
        editIcon.innerHTML = components.icon('edit-2', 12);
        element.appendChild(editIcon);

        element.addEventListener('click', () => {
            if (element.classList.contains('editing')) return;

            element.classList.add('editing');
            element.innerHTML = `
                <input type="${type}" class="inline-editable-input" value="${value}" aria-label="Edit value" />
                <div class="inline-editable-actions">
                    <button class="inline-editable-btn save" aria-label="Save">${components.icon('check', 12)}</button>
                    <button class="inline-editable-btn cancel" aria-label="Cancel">${components.icon('x', 12)}</button>
                </div>
            `;

            const input = element.querySelector('input');
            input.focus();
            input.select();

            const save = async () => {
                const newValue = input.value.trim();

                if (validate && !validate(newValue)) {
                    input.classList.add('is-invalid');
                    return;
                }

                element.innerHTML = '<div class="inline-editable-saving">Saving...</div>';

                try {
                    if (onSave) await onSave(newValue);
                    element.dataset.value = newValue;
                    element.textContent = newValue;
                } catch (error) {
                    element.textContent = originalContent;
                }

                element.classList.remove('editing');
                element.appendChild(editIcon);
            };

            const cancel = () => {
                element.textContent = originalContent;
                element.classList.remove('editing');
                element.appendChild(editIcon);
            };

            element.querySelector('.save').addEventListener('click', save);
            element.querySelector('.cancel').addEventListener('click', cancel);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') cancel();
            });
        });
    }
};

// Multi-Select Tag Picker
const tagPicker = {
    init(container, options = {}) {
        if (!container) return;

        const {
            tags = [],
            suggestions = [],
            recentTags = [],
            maxTags = Infinity,
            onAdd = null,
            onRemove = null,
            allowCreate = true
        } = options;

        let selectedTags = [...tags];

        const inputContainer = document.createElement('div');
        inputContainer.className = 'tag-picker-input-container';

        const input = document.createElement('input');
        input.className = 'tag-picker-input';
        input.placeholder = 'Add tags...';

        const dropdown = document.createElement('div');
        dropdown.className = 'tag-picker-dropdown';

        container.innerHTML = '';
        container.classList.add('tag-picker');
        container.appendChild(inputContainer);
        container.appendChild(dropdown);

        const render = () => {
            inputContainer.innerHTML = selectedTags.map(tag => `
                <span class="tag-picker-tag">
                    ${tag}
                    <span class="tag-picker-tag-remove" data-tag="${tag}">×</span>
                </span>
            `).join('');
            inputContainer.appendChild(input);
        };

        const showDropdown = (query = '') => {
            const filtered = suggestions.filter(s =>
                !selectedTags.includes(s.label) &&
                s.label.toLowerCase().includes(query.toLowerCase())
            );

            dropdown.innerHTML = `
                ${recentTags.length ? `
                    <div class="tag-picker-section">
                        <div class="tag-picker-section-label">Recent</div>
                        ${recentTags.filter(t => !selectedTags.includes(t)).slice(0, 5).map(t => `
                            <div class="tag-picker-suggestion" data-tag="${t}">${t}</div>
                        `).join('')}
                    </div>
                ` : ''}
                ${filtered.length ? `
                    <div class="tag-picker-section">
                        <div class="tag-picker-section-label">Suggestions</div>
                        ${filtered.slice(0, 8).map(s => `
                            <div class="tag-picker-suggestion" data-tag="${s.label}">
                                ${s.label}
                                ${s.count ? `<span class="tag-picker-suggestion-count">${s.count}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${allowCreate && query && !suggestions.some(s => s.label.toLowerCase() === query.toLowerCase()) ? `
                    <div class="tag-picker-create" data-tag="${query}">
                        + Create "${query}"
                    </div>
                ` : ''}
            `;

            dropdown.classList.add('show');
        };

        const addTag = (tag) => {
            if (selectedTags.length >= maxTags || selectedTags.includes(tag)) return;
            selectedTags.push(tag);
            render();
            onAdd?.(tag, selectedTags);
            input.value = '';
            dropdown.classList.remove('show');
        };

        const removeTag = (tag) => {
            selectedTags = selectedTags.filter(t => t !== tag);
            render();
            onRemove?.(tag, selectedTags);
        };

        render();

        input.addEventListener('focus', () => showDropdown());
        input.addEventListener('input', (e) => showDropdown(e.target.value));

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                addTag(input.value.trim());
            } else if (e.key === 'Backspace' && !input.value && selectedTags.length) {
                removeTag(selectedTags[selectedTags.length - 1]);
            }
        });

        inputContainer.addEventListener('click', (e) => {
            const remove = e.target.closest('.tag-picker-tag-remove');
            if (remove) {
                removeTag(remove.dataset.tag);
            } else {
                input.focus();
            }
        });

        dropdown.addEventListener('click', (e) => {
            const suggestion = e.target.closest('.tag-picker-suggestion, .tag-picker-create');
            if (suggestion) {
                addTag(suggestion.dataset.tag);
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        return {
            getTags: () => [...selectedTags],
            setTags: (newTags) => { selectedTags = [...newTags]; render(); },
            clear: () => { selectedTags = []; render(); }
        };
    }
};

// Toast Notification Queue
const toastQueue = {
    container: null,
    queue: [],
    maxVisible: 3,

    init() {
        if (this.container) return;

        this.container = document.createElement('div');
        this.container.className = 'toast-queue';
        document.body.appendChild(this.container);
    },

    show(options = {}) {
        this.init();

        const {
            type = 'info',
            title = '',
            message = '',
            duration = 5000,
            actions = [],
            dismissible = true
        } = options;

        const id = Date.now();
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.dataset.id = id;

        const iconMap = {
            success: 'check',
            error: 'x',
            warning: 'alert-triangle',
            info: 'info'
        };

        toast.innerHTML = `
            <div class="toast-icon">${components.icon(iconMap[type], 14)}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
                ${actions.length ? `
                    <div class="toast-actions">
                        ${actions.map(a => `
                            <button class="toast-action-btn ${a.primary ? 'primary' : 'secondary'}"
                                    data-action="${a.id}">${a.label}</button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            ${dismissible ? '<div class="toast-close">×</div>' : ''}
            ${duration > 0 ? `<div class="toast-progress" style="animation-duration: ${duration}ms"></div>` : ''}
        `;

        this.container.appendChild(toast);
        this.queue.push({ id, toast, duration });

        // Animate in
        requestAnimationFrame(() => toast.classList.add('show'));

        // Event handlers
        toast.querySelector('.toast-close')?.addEventListener('click', () => this.dismiss(id));

        toast.querySelectorAll('.toast-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = actions.find(a => a.id === btn.dataset.action);
                action?.onClick?.();
                this.dismiss(id);
            });
        });

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(id), duration);
        }

        return id;
    },

    dismiss(id) {
        const item = this.queue.find(q => q.id === id);
        if (!item) return;

        item.toast.classList.add('dismissing');
        setTimeout(() => {
            item.toast.remove();
            this.queue = this.queue.filter(q => q.id !== id);
        }, 300);
    },

    success(message, options = {}) {
        return this.show({ type: 'success', message, ...options });
    },

    error(message, options = {}) {
        return this.show({ type: 'error', message, ...options });
    },

    warning(message, options = {}) {
        return this.show({ type: 'warning', message, ...options });
    },

    info(message, options = {}) {
        return this.show({ type: 'info', message, ...options });
    },

    clearAll() {
        this.queue.forEach(q => this.dismiss(q.id));
    }
};

// Info Banner
const infoBanner = {
    render(options = {}) {
        const {
            type = 'info',
            title = '',
            message = '',
            dismissible = true,
            fullWidth = false,
            actions = []
        } = options;

        const iconMap = {
            info: 'info',
            success: 'check-circle',
            warning: 'alert-triangle',
            error: 'alert-circle',
            neutral: 'bell'
        };

        const id = `banner-${Date.now()}`;

        return `
            <div class="info-banner banner-${type} ${fullWidth ? 'info-banner-fullwidth' : ''}" id="${id}">
                <div class="info-banner-icon">${components.icon(iconMap[type], 20)}</div>
                <div class="info-banner-content">
                    ${title ? `<div class="info-banner-title">${title}</div>` : ''}
                    <div class="info-banner-text">${message}</div>
                </div>
                ${actions.length ? `
                    <div class="info-banner-actions">
                        ${actions.map(a => `
                            <button class="btn btn-sm ${a.primary ? 'btn-primary' : 'btn-secondary'}"
                                    onclick="${a.onclick}">${a.label}</button>
                        `).join('')}
                    </div>
                ` : ''}
                ${dismissible ? `
                    <button class="info-banner-dismiss" onclick="document.getElementById('${id}').remove()">
                        ${components.icon('x', 16)}
                    </button>
                ` : ''}
            </div>
        `;
    },

    show(container, options) {
        const html = this.render(options);
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        container?.insertAdjacentHTML('afterbegin', html);
    }
};

// Breadcrumb Navigation
const breadcrumbNav = {
    render(items) {
        return `
            <nav class="breadcrumb-nav" aria-label="Breadcrumb">
                ${items.map((item, i) => {
                    const isLast = i === items.length - 1;

                    if (isLast) {
                        return `
                            <span class="breadcrumb-item">
                                <span class="breadcrumb-current" aria-current="page">${item.label}</span>
                            </span>
                        `;
                    }

                    if (item.children) {
                        return `
                            <span class="breadcrumb-item breadcrumb-dropdown">
                                <span class="breadcrumb-dropdown-trigger breadcrumb-link">
                                    ${item.label} ${components.icon('chevron-down', 12)}
                                </span>
                                <div class="breadcrumb-dropdown-menu">
                                    ${item.children.map(c => `
                                        <a href="${c.href || '#'}" class="breadcrumb-dropdown-item"
                                           onclick="router.navigate('${c.page}'); return false;">${c.label}</a>
                                    `).join('')}
                                </div>
                            </span>
                            <span class="breadcrumb-separator">/</span>
                        `;
                    }

                    return `
                        <span class="breadcrumb-item">
                            <a href="${item.href || '#'}" class="breadcrumb-link"
                               onclick="router.navigate('${item.page}'); return false;">${item.label}</a>
                        </span>
                        <span class="breadcrumb-separator">/</span>
                    `;
                }).join('')}
            </nav>
        `;
    },

    init() {
        document.addEventListener('click', (e) => {
            const trigger = e.target.closest('.breadcrumb-dropdown-trigger');
            if (trigger) {
                const menu = trigger.nextElementSibling;
                menu?.classList.toggle('show');
            } else {
                document.querySelectorAll('.breadcrumb-dropdown-menu.show').forEach(m => m.classList.remove('show'));
            }
        });
    }
};

// Mega Menu
const megaMenu = {
    render(options = {}) {
        const { sections = [], footerLinks = [] } = options;

        return `
            <div class="mega-menu">
                <div class="mega-menu-grid">
                    ${sections.map(section => `
                        <div class="mega-menu-section">
                            <div class="mega-menu-section-title">${section.title}</div>
                            ${section.items.map(item => `
                                <div class="mega-menu-item" onclick="router.navigate('${item.page}')">
                                    <div class="mega-menu-item-icon">${components.icon(item.icon, 18)}</div>
                                    <div class="mega-menu-item-content">
                                        <div class="mega-menu-item-title">
                                            ${item.label}
                                            ${item.badge ? `<span class="mega-menu-item-badge">${item.badge}</span>` : ''}
                                        </div>
                                        ${item.description ? `<div class="mega-menu-item-desc">${item.description}</div>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
                ${footerLinks.length ? `
                    <div class="mega-menu-footer">
                        ${footerLinks.map(link => `
                            <a href="${link.href || '#'}" class="mega-menu-footer-link"
                               onclick="router.navigate('${link.page}'); return false;">
                                ${link.label} ${components.icon('arrow-right', 14)}
                            </a>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    init(trigger, menuContent) {
        if (!trigger) return;

        const container = document.createElement('div');
        container.className = 'mega-menu-container';
        trigger.parentNode.insertBefore(container, trigger);
        container.appendChild(trigger);
        trigger.classList.add('mega-menu-trigger');
        container.insertAdjacentHTML('beforeend', menuContent);

        const menu = container.querySelector('.mega-menu');

        trigger.addEventListener('mouseenter', () => menu?.classList.add('show'));
        container.addEventListener('mouseleave', () => menu?.classList.remove('show'));
    }
};

// Progress Stepper
const progressStepper = {
    render(steps, currentStep = 0, options = {}) {
        const { vertical = false } = options;

        return `
            <div class="progress-stepper ${vertical ? 'vertical' : ''}">
                ${steps.map((step, i) => {
                    let status = '';
                    if (i < currentStep) status = 'completed';
                    else if (i === currentStep) status = 'active';
                    if (step.error) status = 'error';

                    return `
                        <div class="progress-step ${status}">
                            <div class="progress-step-indicator">
                                ${status === 'completed' ? components.icon('check', 16) :
                                  status === 'error' ? components.icon('x', 16) : (i + 1)}
                            </div>
                            ${vertical ? `
                                <div class="progress-step-content">
                                    <div class="progress-step-label">${step.label}</div>
                                    ${step.description ? `<div class="progress-step-desc">${step.description}</div>` : ''}
                                </div>
                            ` : `
                                <div class="progress-step-label">${step.label}</div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
};

// Revenue Trend Widget
const revenueWidget = {
    render(data = {}) {
        const {
            value = 0,
            change = 0,
            period = 'This Month',
            sparklineData = [],
            comparisons = []
        } = data;

        const changeClass = change >= 0 ? 'positive' : 'negative';
        const changeIcon = change >= 0 ? 'trending-up' : 'trending-down';

        return `
            <div class="revenue-widget">
                <div class="revenue-widget-header">
                    <div class="revenue-widget-title">Revenue</div>
                    <div class="revenue-widget-period">${period}</div>
                </div>
                <div class="revenue-widget-value">$${value.toLocaleString()}</div>
                <div class="revenue-widget-change ${changeClass}">
                    ${components.icon(changeIcon, 14)}
                    ${change >= 0 ? '+' : ''}${change}%
                </div>
                ${sparklineData.length ? `
                    <div class="revenue-widget-chart">
                        ${this.renderSparkline(sparklineData)}
                    </div>
                ` : ''}
                ${comparisons.length ? `
                    <div class="revenue-widget-comparison">
                        ${comparisons.map(c => `
                            <div class="revenue-comparison-item">
                                <div class="revenue-comparison-label">${c.label}</div>
                                <div class="revenue-comparison-value">$${c.value.toLocaleString()}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderSparkline(data) {
        const width = 280;
        const height = 60;
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;

        const points = data.map((val, i) => {
            const x = (i / Math.max(data.length - 1, 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        const areaPoints = `0,${height} ${points} ${width},${height}`;

        return `
            <svg class="revenue-sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="revenue-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color: var(--primary-500); stop-opacity: 0.3" />
                        <stop offset="100%" style="stop-color: var(--primary-500); stop-opacity: 0" />
                    </linearGradient>
                </defs>
                <polygon class="revenue-sparkline-area" points="${areaPoints}" />
                <polyline class="revenue-sparkline-line" points="${points}" />
            </svg>
        `;
    }
};

// Goal Progress Widget
const goalWidget = {
    render(data = {}) {
        const {
            title = 'Monthly Goal',
            current = 0,
            target = 100,
            unit = '$',
            daysRemaining = 0
        } = data;

        const percent = Math.min(Math.round((current / target) * 100), 100);
        const circumference = 2 * Math.PI * 54; // radius = 54
        const offset = circumference - (percent / 100) * circumference;

        return `
            <div class="goal-widget">
                <div class="goal-widget-ring">
                    <svg width="140" height="140" viewBox="0 0 120 120">
                        <circle class="goal-ring-bg" cx="60" cy="60" r="54" />
                        <circle class="goal-ring-progress" cx="60" cy="60" r="54"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${offset}" />
                    </svg>
                    <div class="goal-widget-ring-content">
                        <div class="goal-widget-percent">${percent}%</div>
                        <div class="goal-widget-label">Complete</div>
                    </div>
                </div>
                <div class="goal-widget-title">${title}</div>
                <div class="goal-widget-values">
                    <strong>${unit}${current.toLocaleString()}</strong> of ${unit}${target.toLocaleString()}
                </div>
                ${daysRemaining > 0 ? `
                    <div class="goal-widget-countdown">
                        ${components.icon('clock', 14)}
                        <strong>${daysRemaining}</strong> days remaining
                    </div>
                ` : ''}
            </div>
        `;
    }
};

// Activity Stream
const activityStream = {
    render(activities = [], options = {}) {
        const { title = 'Recent Activity', showFilter = true, maxItems = 10 } = options;

        return `
            <div class="activity-stream">
                <div class="activity-stream-header">
                    <div class="activity-stream-title">
                        ${components.icon('activity', 18)}
                        ${title}
                    </div>
                    ${showFilter ? '<span class="activity-stream-filter">Filter</span>' : ''}
                </div>
                <div class="activity-stream-list">
                    ${activities.slice(0, maxItems).map(a => this.renderItem(a)).join('')}
                </div>
                ${activities.length > maxItems ? `
                    <div class="activity-stream-footer">
                        <span class="activity-stream-more">View all activity</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    renderItem(activity) {
        const typeIcons = {
            sale: 'dollar-sign',
            listing: 'tag',
            offer: 'message-circle',
            inventory: 'package'
        };

        return `
            <div class="activity-stream-item">
                <div class="activity-stream-icon ${activity.type}">
                    ${components.icon(typeIcons[activity.type] || 'activity', 16)}
                </div>
                <div class="activity-stream-content">
                    <div class="activity-stream-text">${activity.text}</div>
                    <div class="activity-stream-meta">
                        <span class="activity-stream-time">${activity.time}</span>
                        ${activity.platform ? `<span>• ${activity.platform}</span>` : ''}
                    </div>
                </div>
                ${activity.amount ? `
                    <div class="activity-stream-amount ${activity.amount > 0 ? 'positive' : ''}">
                        ${activity.amount > 0 ? '+' : ''}$${Math.abs(activity.amount).toFixed(2)}
                    </div>
                ` : ''}
            </div>
        `;
    }
};

// High Contrast Mode Toggle
const highContrastMode = {
    isEnabled: false,

    toggle() {
        this.isEnabled = !this.isEnabled;
        document.body.classList.toggle('high-contrast', this.isEnabled);
        localStorage.setItem('vaultlister_high_contrast', this.isEnabled);
        return this.isEnabled;
    },

    init() {
        const saved = localStorage.getItem('vaultlister_high_contrast');
        if (saved === 'true') {
            this.isEnabled = true;
            document.body.classList.add('high-contrast');
        }
    },

    render() {
        return `
            <button class="high-contrast-toggle" onclick="highContrastMode.toggle()" aria-pressed="${this.isEnabled}">
                ${components.icon('eye', 16)}
                High Contrast ${this.isEnabled ? 'On' : 'Off'}
            </button>
        `;
    }
};

// Keyboard Navigation Indicator
const keyboardNavIndicator = {
    init() {
        // Detect keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-nav');
        });

        // Add indicator element
        const indicator = document.createElement('div');
        indicator.className = 'keyboard-nav-indicator';
        indicator.innerHTML = `
            ${components.icon('navigation', 14)}
            <span>Keyboard navigation active</span>
        `;
        document.body.appendChild(indicator);
    }
};

// Sticky Section Header Observer
const stickySectionObserver = {
    _observer: null,

    init(selector = '.sticky-section-header') {
        if (this._observer) this._observer.disconnect();
        if (!('IntersectionObserver' in window)) return;
        const headers = document.querySelectorAll(selector);

        this._observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    entry.target.classList.toggle('stuck', !entry.isIntersecting);
                });
            },
            { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
        );

        headers.forEach(header => this._observer.observe(header));
    }
};

// Table Row Grouping
const tableGrouping = {
    init(table) {
        if (!table) return;

        table.querySelectorAll('.table-group-header').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('collapsed');
            });
        });
    },

    collapseAll(table) {
        table?.querySelectorAll('.table-group-header').forEach(h => h.classList.add('collapsed'));
    },

    expandAll(table) {
        table?.querySelectorAll('.table-group-header').forEach(h => h.classList.remove('collapsed'));
    }
};

// ============================================
// Part 9: Visualization, Interactive & Engagement
// ============================================

// Bubble Chart
const bubbleChart = {
    render(container, data, options = {}) {
        if (!container) return;

        const {
            width = 400,
            height = 300,
            xKey = 'x',
            yKey = 'y',
            sizeKey = 'size',
            colorKey = 'color',
            labelKey = 'label',
            colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']
        } = options;

        const maxX = Math.max(...data.map(d => d[xKey]));
        const maxY = Math.max(...data.map(d => d[yKey]));
        const maxSize = Math.max(...data.map(d => d[sizeKey]));

        const bubbles = data.map((d, i) => {
            const x = (d[xKey] / maxX) * (width - 80) + 40;
            const y = height - (d[yKey] / maxY) * (height - 60) - 30;
            const size = Math.max(20, (d[sizeKey] / maxSize) * 60);
            const color = colors[i % colors.length];

            return `
                <div class="bubble" style="
                    left: ${x - size/2}px;
                    top: ${y - size/2}px;
                    width: ${size}px;
                    height: ${size}px;
                    background: ${color};
                " data-index="${i}">
                    <span class="bubble-tooltip">
                        ${d[labelKey]}<br/>
                        ${xKey}: ${d[xKey]}<br/>
                        ${yKey}: ${d[yKey]}
                    </span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="bubble-chart" style="width: ${width}px; height: ${height}px;">
                <div class="bubble-chart-area">${bubbles}</div>
            </div>
        `;
    }
};

// Heatmap Grid
const heatmapGrid = {
    render(container, data, options = {}) {
        if (!container) return;

        const {
            rows = 7,
            cols = 12,
            xLabels = [],
            yLabels = [],
            maxValue = null
        } = options;

        const max = maxValue || Math.max(...data.flat());

        const getLevel = (value) => {
            if (value === 0) return 0;
            const ratio = value / max;
            if (ratio < 0.2) return 1;
            if (ratio < 0.4) return 2;
            if (ratio < 0.6) return 3;
            if (ratio < 0.8) return 4;
            return 5;
        };

        const cells = data.map((row, y) =>
            row.map((value, x) => `
                <div class="heatmap-cell" data-level="${getLevel(value)}" data-value="${value}">
                    <span class="heatmap-tooltip">${value}</span>
                </div>
            `).join('')
        ).join('');

        container.innerHTML = `
            <div class="heatmap-grid" style="grid-template-columns: repeat(${cols}, 1fr);">
                ${cells}
            </div>
            ${xLabels.length ? `<div class="heatmap-labels-x">${xLabels.map(l => `<span>${l}</span>`).join('')}</div>` : ''}
        `;
    }
};

// Multi-Series Line Chart
const multiLineChart = {
    render(container, series, options = {}) {
        if (!container) return;

        const {
            width = 400,
            height = 250,
            padding = 40,
            showLegend = true,
            showGrid = true
        } = options;

        const allValues = series.flatMap(s => s.data);
        const maxValue = Math.max(...allValues);
        const minValue = Math.min(...allValues);
        const range = maxValue - minValue || 1;

        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const lines = series.map((s, i) => {
            const points = s.data.map((val, x) => {
                const px = padding + (x / Math.max(s.data.length - 1, 1)) * chartWidth;
                const py = padding + chartHeight - ((val - minValue) / range) * chartHeight;
                return `${px},${py}`;
            }).join(' ');

            return `<polyline class="chart-line series-${i + 1}" points="${points}" />`;
        }).join('');

        const gridLines = showGrid ? Array.from({ length: 5 }, (_, i) => {
            const y = padding + (i / 4) * chartHeight;
            return `<line class="chart-grid-line" x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
        }).join('') : '';

        const legend = showLegend ? `
            <div class="chart-legend">
                ${series.map((s, i) => `
                    <div class="chart-legend-item">
                        <span class="chart-legend-line" style="background: var(--${['primary', 'success', 'warning', 'error'][i]}-500)"></span>
                        ${s.name}
                    </div>
                `).join('')}
            </div>
        ` : '';

        container.innerHTML = `
            <div class="multi-line-chart">
                <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
                    ${gridLines}
                    ${lines}
                </svg>
            </div>
            ${legend}
        `;
    }
};

// Numeric Spinner
const numericSpinner = {
    init(container, options = {}) {
        if (!container) return;

        const {
            value = 0,
            min = 0,
            max = Infinity,
            step = 1,
            format = (v) => v.toString(),
            onChange = null
        } = options;

        let currentValue = value;

        const render = () => {
            container.innerHTML = `
                <div class="numeric-spinner">
                    <button class="numeric-spinner-btn decrease" ${currentValue <= min ? 'disabled' : ''}>−</button>
                    <input type="text" class="numeric-spinner-input" value="${format(currentValue)}" aria-label="Number value" />
                    <button class="numeric-spinner-btn increase" ${currentValue >= max ? 'disabled' : ''}>+</button>
                </div>
            `;

            const input = container.querySelector('.numeric-spinner-input');
            const decreaseBtn = container.querySelector('.decrease');
            const increaseBtn = container.querySelector('.increase');

            decreaseBtn.addEventListener('click', () => {
                if (currentValue > min) {
                    currentValue = Math.max(min, currentValue - step);
                    input.value = format(currentValue);
                    onChange?.(currentValue);
                    render();
                }
            });

            increaseBtn.addEventListener('click', () => {
                if (currentValue < max) {
                    currentValue = Math.min(max, currentValue + step);
                    input.value = format(currentValue);
                    onChange?.(currentValue);
                    render();
                }
            });

            input.addEventListener('change', (e) => {
                const parsed = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''));
                if (!isNaN(parsed)) {
                    currentValue = Math.min(max, Math.max(min, parsed));
                    input.value = format(currentValue);
                    onChange?.(currentValue);
                }
            });
        };

        render();

        return {
            getValue: () => currentValue,
            setValue: (v) => { currentValue = v; render(); }
        };
    }
};

// Color Picker
const colorPicker = {
    presets: [
        '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
        '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
    ],

    init(container, options = {}) {
        if (!container) return;

        const { value = '#6366f1', onChange = null } = options;
        let currentColor = value;

        const render = () => {
            container.innerHTML = `
                <div class="color-picker">
                    <div class="color-picker-trigger">
                        <div class="color-picker-swatch" style="background: ${currentColor}"></div>
                        <span class="color-picker-value">${currentColor}</span>
                    </div>
                    <div class="color-picker-dropdown">
                        <div class="color-picker-swatches">
                            ${this.presets.map(c => `
                                <div class="color-picker-preset ${c === currentColor ? 'selected' : ''}"
                                     style="background: ${c}" data-color="${c}"></div>
                            `).join('')}
                        </div>
                        <div class="color-picker-input-row">
                            <input type="text" class="color-picker-hex-input" value="${currentColor}" aria-label="Hex color code" />
                        </div>
                    </div>
                </div>
            `;

            const trigger = container.querySelector('.color-picker-trigger');
            const dropdown = container.querySelector('.color-picker-dropdown');
            const swatches = container.querySelectorAll('.color-picker-preset');
            const hexInput = container.querySelector('.color-picker-hex-input');

            trigger.addEventListener('click', () => dropdown.classList.toggle('show'));

            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            swatches.forEach(swatch => {
                swatch.addEventListener('click', () => {
                    currentColor = swatch.dataset.color;
                    render();
                    onChange?.(currentColor);
                });
            });

            hexInput.addEventListener('change', (e) => {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    currentColor = e.target.value;
                    render();
                    onChange?.(currentColor);
                }
            });
        };

        render();

        return {
            getValue: () => currentColor,
            setValue: (c) => { currentColor = c; render(); }
        };
    }
};

// Time Input Component
const timeInput = {
    init(container, options = {}) {
        if (!container) return;

        const { value = '12:00', use24Hour = false, onChange = null } = options;
        let [hours, minutes] = value.split(':').map(Number);
        let period = hours >= 12 ? 'PM' : 'AM';

        if (!use24Hour && hours > 12) hours -= 12;
        if (!use24Hour && hours === 0) hours = 12;

        const render = () => {
            container.innerHTML = `
                <div class="time-input">
                    <input type="text" class="time-input-segment hour" value="${String(hours).padStart(2, '0')}" maxlength="2" aria-label="Hours" />
                    <span class="time-input-separator">:</span>
                    <input type="text" class="time-input-segment minute" value="${String(minutes).padStart(2, '0')}" maxlength="2" aria-label="Minutes" />
                    ${!use24Hour ? `<button class="time-input-period">${period}</button>` : ''}
                </div>
            `;

            const hourInput = container.querySelector('.hour');
            const minuteInput = container.querySelector('.minute');
            const periodBtn = container.querySelector('.time-input-period');

            const update = () => {
                let h = hours;
                if (!use24Hour) {
                    if (period === 'PM' && h !== 12) h += 12;
                    if (period === 'AM' && h === 12) h = 0;
                }
                onChange?.(`${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
            };

            hourInput.addEventListener('change', (e) => {
                const v = parseInt(e.target.value, 10);
                const max = use24Hour ? 23 : 12;
                hours = Math.min(max, Math.max(use24Hour ? 0 : 1, v || 0));
                e.target.value = String(hours).padStart(2, '0');
                update();
            });

            minuteInput.addEventListener('change', (e) => {
                const v = parseInt(e.target.value, 10);
                minutes = Math.min(59, Math.max(0, v || 0));
                e.target.value = String(minutes).padStart(2, '0');
                update();
            });

            periodBtn?.addEventListener('click', () => {
                period = period === 'AM' ? 'PM' : 'AM';
                periodBtn.textContent = period;
                update();
            });
        };

        render();
    }
};

// Toggle Button Group
const toggleButtonGroup = {
    render(options, selected, onChange) {
        const id = `toggle-${Date.now()}`;

        return `
            <div class="toggle-button-group" id="${id}">
                ${options.map((opt, i) => `
                    <button class="toggle-button ${opt.value === selected ? 'active' : ''}"
                            data-value="${opt.value}" onclick="toggleButtonGroup.select('${id}', '${opt.value}')">
                        ${opt.icon ? components.icon(opt.icon, 14) : ''}
                        ${opt.label}
                    </button>
                `).join('')}
            </div>
        `;
    },

    select(groupId, value) {
        const group = document.getElementById(groupId);
        if (!group) return;

        group.querySelectorAll('.toggle-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    },

    getSelected(groupId) {
        const active = document.querySelector(`#${groupId} .toggle-button.active`);
        return active?.dataset.value;
    }
};

// Quantity Adjuster
const quantityAdjuster = {
    init(container, options = {}) {
        if (!container) return;

        const {
            value = 1,
            min = 1,
            max = 999,
            presets = [1, 5, 10, 25],
            onChange = null
        } = options;

        let currentValue = value;

        const render = () => {
            container.innerHTML = `
                <div class="quantity-adjuster">
                    <div class="quantity-adjuster-controls">
                        <button class="quantity-adjuster-btn decrease" ${currentValue <= min ? 'disabled' : ''}>−</button>
                        <input type="number" class="quantity-adjuster-value" value="${currentValue}" min="${min}" max="${max}" aria-label="Quantity" />
                        <button class="quantity-adjuster-btn increase" ${currentValue >= max ? 'disabled' : ''}>+</button>
                    </div>
                    <div class="quantity-adjuster-presets">
                        ${presets.map(p => `
                            <button class="quantity-preset ${p === currentValue ? 'active' : ''}" data-value="${p}">${p}</button>
                        `).join('')}
                    </div>
                </div>
            `;

            const input = container.querySelector('.quantity-adjuster-value');
            const decreaseBtn = container.querySelector('.decrease');
            const increaseBtn = container.querySelector('.increase');
            const presetBtns = container.querySelectorAll('.quantity-preset');

            decreaseBtn.addEventListener('click', () => {
                if (currentValue > min) {
                    currentValue--;
                    render();
                    onChange?.(currentValue);
                }
            });

            increaseBtn.addEventListener('click', () => {
                if (currentValue < max) {
                    currentValue++;
                    render();
                    onChange?.(currentValue);
                }
            });

            input.addEventListener('change', (e) => {
                currentValue = Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min));
                render();
                onChange?.(currentValue);
            });

            presetBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    currentValue = parseInt(btn.dataset.value, 10);
                    render();
                    onChange?.(currentValue);
                });
            });
        };

        render();

        return {
            getValue: () => currentValue,
            setValue: (v) => { currentValue = v; render(); }
        };
    }
};

// Price Range Slider
const priceRangeSlider = {
    init(container, options = {}) {
        if (!container) return;

        const {
            min = 0,
            max = 1000,
            minValue = 0,
            maxValue = 1000,
            step = 1,
            format = (v) => `$${v}`,
            onChange = null
        } = options;

        let currentMin = minValue;
        let currentMax = maxValue;

        const render = () => {
            const minPercent = ((currentMin - min) / (max - min)) * 100;
            const maxPercent = ((currentMax - min) / (max - min)) * 100;

            container.innerHTML = `
                <div class="price-range-slider">
                    <div class="price-range-track">
                        <div class="price-range-fill" style="left: ${minPercent}%; width: ${maxPercent - minPercent}%"></div>
                        <div class="price-range-thumb min" style="left: ${minPercent}%"></div>
                        <div class="price-range-thumb max" style="left: ${maxPercent}%"></div>
                    </div>
                    <div class="price-range-inputs">
                        <div class="price-range-input-group">
                            <label>Min</label>
                            <input type="text" class="price-range-input min-input" value="${format(currentMin)}" aria-label="Minimum price" />
                        </div>
                        <div class="price-range-input-group">
                            <label>Max</label>
                            <input type="text" class="price-range-input max-input" value="${format(currentMax)}" aria-label="Maximum price" />
                        </div>
                    </div>
                    <div class="price-range-labels">
                        <span>${format(min)}</span>
                        <span>${format(max)}</span>
                    </div>
                </div>
            `;

            const track = container.querySelector('.price-range-track');
            const thumbs = container.querySelectorAll('.price-range-thumb');
            const minInput = container.querySelector('.min-input');
            const maxInput = container.querySelector('.max-input');

            thumbs.forEach(thumb => {
                let isDragging = false;

                thumb.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    document.body.style.userSelect = 'none';
                });

                document.addEventListener('mousemove', (e) => {
                    if (!isDragging) return;

                    const rect = track.getBoundingClientRect();
                    const percent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                    const value = Math.round((percent / 100) * (max - min) + min);

                    if (thumb.classList.contains('min')) {
                        currentMin = Math.min(value, currentMax - step);
                    } else {
                        currentMax = Math.max(value, currentMin + step);
                    }

                    render();
                    onChange?.({ min: currentMin, max: currentMax });
                });

                document.addEventListener('mouseup', () => {
                    isDragging = false;
                    document.body.style.userSelect = '';
                });
            });

            minInput.addEventListener('change', (e) => {
                const v = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''));
                if (!isNaN(v)) {
                    currentMin = Math.min(v, currentMax - step);
                    render();
                    onChange?.({ min: currentMin, max: currentMax });
                }
            });

            maxInput.addEventListener('change', (e) => {
                const v = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''));
                if (!isNaN(v)) {
                    currentMax = Math.max(v, currentMin + step);
                    render();
                    onChange?.({ min: currentMin, max: currentMax });
                }
            });
        };

        render();

        return {
            getRange: () => ({ min: currentMin, max: currentMax }),
            setRange: (minV, maxV) => { currentMin = minV; currentMax = maxV; render(); }
        };
    }
};

// Split View
const splitView = {
    init(container, options = {}) {
        if (!container) return;

        const { vertical = false, initialSplit = 50, minSize = 100 } = options;
        const divider = container.querySelector('.split-view-divider');
        const panels = container.querySelectorAll('.split-view-panel');

        if (!divider || panels.length < 2) return;

        let isDragging = false;

        divider.addEventListener('mousedown', () => {
            isDragging = true;
            document.body.style.userSelect = 'none';
            document.body.style.cursor = vertical ? 'row-resize' : 'col-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const rect = container.getBoundingClientRect();
            let percent;

            if (vertical) {
                percent = ((e.clientY - rect.top) / rect.height) * 100;
            } else {
                percent = ((e.clientX - rect.left) / rect.width) * 100;
            }

            percent = Math.min(80, Math.max(20, percent));

            panels[0].style[vertical ? 'height' : 'width'] = `${percent}%`;
            panels[1].style[vertical ? 'height' : 'width'] = `${100 - percent}%`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        });
    }
};

// Collapsible Sidebar
const collapsibleSidebar = {
    init(sidebar) {
        if (!sidebar) return;

        const toggle = sidebar.querySelector('.sidebar-toggle');
        if (!toggle) return;

        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
        });

        // Restore state
        if (localStorage.getItem('sidebar_collapsed') === 'true') {
            sidebar.classList.add('collapsed');
        }
    }
};

// Floating Action Button Menu
const fabMenu = {
    init(container) {
        if (!container) return;

        const mainBtn = container.querySelector('.fab-main');
        if (!mainBtn) return;

        mainBtn.addEventListener('click', () => {
            container.classList.toggle('open');
            mainBtn.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('open');
                mainBtn.classList.remove('open');
            }
        });
    },

    render(actions) {
        return `
            <div class="fab-menu">
                <div class="fab-actions">
                    ${actions.map(a => `
                        <div class="fab-action">
                            <button class="fab-action-btn" onclick="${a.onclick}" title="${a.label}">
                                ${components.icon(a.icon, 20)}
                            </button>
                            <span class="fab-action-label">${a.label}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="fab-main">${components.icon('plus', 24)}</button>
            </div>
        `;
    }
};

// Stacked Cards
const stackedCards = {
    init(container, options = {}) {
        if (!container) return;

        const { onSwipeLeft = null, onSwipeRight = null } = options;
        const cards = container.querySelectorAll('.stacked-card');

        let currentIndex = 0;

        const swipe = (direction) => {
            const card = cards[currentIndex];
            if (!card) return;

            card.classList.add(direction === 'left' ? 'swiping-left' : 'swiping-right');

            setTimeout(() => {
                card.style.display = 'none';
                currentIndex++;

                if (direction === 'left') onSwipeLeft?.(currentIndex - 1);
                else onSwipeRight?.(currentIndex - 1);

                // Restack remaining cards
                cards.forEach((c, i) => {
                    if (i >= currentIndex) {
                        const offset = i - currentIndex;
                        c.style.zIndex = 3 - offset;
                        c.style.transform = `translateY(${offset * 10}px) scale(${1 - offset * 0.05})`;
                    }
                });
            }, 400);
        };

        container.querySelectorAll('.stacked-card-action.reject').forEach(btn => {
            btn.addEventListener('click', () => swipe('left'));
        });

        container.querySelectorAll('.stacked-card-action.accept').forEach(btn => {
            btn.addEventListener('click', () => swipe('right'));
        });

        return { swipe, getCurrentIndex: () => currentIndex };
    }
};

// Inline Date Picker
const inlineDatePicker = {
    init(container, options = {}) {
        if (!container) return;

        const {
            value = new Date(),
            minDate = null,
            maxDate = null,
            onChange = null
        } = options;

        let currentDate = new Date(value);
        let viewDate = new Date(value);

        const render = () => {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const today = new Date();

            const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

            const days = [];
            for (let i = 0; i < firstDay; i++) {
                const prevMonthDays = new Date(year, month, 0).getDate();
                days.push({ day: prevMonthDays - firstDay + i + 1, otherMonth: true });
            }
            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(year, month, i);
                days.push({
                    day: i,
                    today: date.toDateString() === today.toDateString(),
                    selected: date.toDateString() === currentDate.toDateString(),
                    disabled: (minDate && date < minDate) || (maxDate && date > maxDate)
                });
            }
            const remaining = 42 - days.length;
            for (let i = 1; i <= remaining; i++) {
                days.push({ day: i, otherMonth: true });
            }

            container.innerHTML = `
                <div class="inline-date-picker">
                    <div class="date-picker-header">
                        <div class="date-picker-nav">
                            <button class="date-picker-nav-btn prev-month">${components.icon('chevron-left', 16)}</button>
                        </div>
                        <div class="date-picker-title">${monthNames[month]} ${year}</div>
                        <div class="date-picker-nav">
                            <button class="date-picker-nav-btn next-month">${components.icon('chevron-right', 16)}</button>
                        </div>
                    </div>
                    <div class="date-picker-weekdays">
                        ${dayNames.map(d => `<span class="date-picker-weekday">${d}</span>`).join('')}
                    </div>
                    <div class="date-picker-days">
                        ${days.map(d => `
                            <button class="date-picker-day ${d.otherMonth ? 'other-month' : ''} ${d.today ? 'today' : ''} ${d.selected ? 'selected' : ''} ${d.disabled ? 'disabled' : ''}"
                                    data-day="${d.day}" ${d.disabled ? 'disabled' : ''}>
                                ${d.day}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            container.querySelector('.prev-month').addEventListener('click', () => {
                viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
                render();
            });

            container.querySelector('.next-month').addEventListener('click', () => {
                viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
                render();
            });

            container.querySelectorAll('.date-picker-day:not(.other-month):not(.disabled)').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), parseInt(btn.dataset.day, 10));
                    render();
                    onChange?.(currentDate);
                });
            });
        };

        render();

        return {
            getValue: () => currentDate,
            setValue: (d) => { currentDate = new Date(d); viewDate = new Date(d); render(); }
        };
    }
};

// Relative Time Display
const relativeTime = {
    format(date) {
        const now = new Date();
        const diff = now - new Date(date);
        if (isNaN(diff)) return 'unknown';
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        if (days < 30) return `${Math.floor(days / 7)}w ago`;
        if (days < 365) return `${Math.floor(days / 30)}mo ago`;
        return `${Math.floor(days / 365)}y ago`;
    },

    render(date) {
        const d = new Date(date);
        const formatted = this.format(date);
        const full = d.toLocaleString();

        return `<span class="relative-time" data-tooltip="${full}">${components.icon('clock', 14)} ${formatted}</span>`;
    }
};

// Faceted Search
const facetedSearch = {
    init(container, facets, options = {}) {
        if (!container) return;

        const { onChange = null } = options;
        const selected = new Map();

        facets.forEach(f => selected.set(f.key, new Set()));

        const render = () => {
            container.innerHTML = `
                <div class="faceted-search">
                    <div class="faceted-search-header">
                        <span class="faceted-search-title">Filters</span>
                        <span class="faceted-search-clear" onclick="facetedSearch.clearAll()">Clear all</span>
                    </div>
                    ${facets.map(facet => `
                        <div class="faceted-section">
                            <div class="faceted-section-title">${facet.label}</div>
                            ${facet.options.slice(0, 5).map(opt => `
                                <div class="faceted-option ${selected.get(facet.key).has(opt.value) ? 'selected' : ''}"
                                     data-facet="${facet.key}" data-value="${opt.value}">
                                    <div class="faceted-checkbox">${selected.get(facet.key).has(opt.value) ? components.icon('check', 12) : ''}</div>
                                    <span class="faceted-label">${opt.label}</span>
                                    <span class="faceted-count">(${opt.count})</span>
                                </div>
                            `).join('')}
                            ${facet.options.length > 5 ? `<span class="faceted-show-more">Show ${facet.options.length - 5} more</span>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;

            container.querySelectorAll('.faceted-option').forEach(opt => {
                opt.addEventListener('click', () => {
                    const facetKey = opt.dataset.facet;
                    const value = opt.dataset.value;
                    const facetSet = selected.get(facetKey);

                    if (facetSet.has(value)) {
                        facetSet.delete(value);
                    } else {
                        facetSet.add(value);
                    }

                    render();
                    onChange?.(Object.fromEntries([...selected.entries()].map(([k, v]) => [k, [...v]])));
                });
            });
        };

        render();

        return {
            getSelected: () => Object.fromEntries([...selected.entries()].map(([k, v]) => [k, [...v]])),
            clearAll: () => { selected.forEach(s => s.clear()); render(); onChange?.({}); }
        };
    }
};

// Streak Counter Widget
const streakWidget = {
    render(count, label = 'day streak') {
        const isMilestone = count > 0 && count % 7 === 0;

        return `
            <div class="streak-counter ${isMilestone ? 'milestone' : ''}">
                <span class="streak-icon">${components.icon('zap', 24)}</span>
                <span class="streak-count">${count}</span>
                <span class="streak-label">${label}</span>
            </div>
        `;
    }
};

// Challenge Banner
const challengeBanner = {
    render(challenge) {
        const percent = Math.round((challenge.current / challenge.target) * 100);

        return `
            <div class="challenge-banner">
                <div class="challenge-icon">${components.icon(challenge.icon || 'target', 24)}</div>
                <div class="challenge-content">
                    <div class="challenge-title">${challenge.title}</div>
                    <div class="challenge-description">${challenge.description}</div>
                </div>
                <div class="challenge-progress">
                    <div class="challenge-progress-bar">
                        <div class="challenge-progress-fill" style="width: ${percent}%"></div>
                    </div>
                    <div class="challenge-progress-text">${challenge.current}/${challenge.target}</div>
                </div>
            </div>
        `;
    }
};

// Reward Badge
const rewardBadge = {
    render(badge) {
        const percent = badge.earned ? 100 : Math.round((badge.progress || 0) / (badge.target || 1) * 100);

        return `
            <div class="reward-badge ${badge.earned ? 'earned' : ''} ${badge.locked ? 'locked' : ''}">
                <div class="reward-badge-icon">${badge.icon || '🏆'}</div>
                <div class="reward-badge-name">${badge.name}</div>
                ${!badge.earned && badge.progress !== undefined ? `
                    <div class="reward-badge-progress">
                        <div class="reward-badge-progress-fill" style="width: ${percent}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
    }
};

// Debounced Search
const debouncedSearch = {
    init(input, options = {}) {
        if (!input) return;

        const { delay = 300, onSearch = null, minChars = 2 } = options;
        let timer = null;

        const container = input.closest('.debounced-search');

        input.addEventListener('input', (e) => {
            const value = e.target.value;

            container?.classList.toggle('has-value', value.length > 0);

            if (timer) clearTimeout(timer);

            if (value.length >= minChars) {
                container?.classList.add('searching');

                timer = setTimeout(() => {
                    container?.classList.remove('searching');
                    onSearch?.(value);
                }, delay);
            } else {
                container?.classList.remove('searching');
            }
        });

        const clearBtn = container?.querySelector('.debounced-search-clear');
        clearBtn?.addEventListener('click', () => {
            input.value = '';
            container?.classList.remove('has-value', 'searching');
            input.focus();
            onSearch?.('');
        });
    }
};

// ============================================
// Part 10: Advanced Forms, Data Management & Polish
// ============================================

// Form State Persistence
const formPersistence = {
    storagePrefix: 'vaultlister_form_',

    save(formId, data) {
        const key = this.storagePrefix + formId;
        localStorage.setItem(key, JSON.stringify({
            data,
            timestamp: Date.now()
        }));
    },

    load(formId) {
        const key = this.storagePrefix + formId;
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load form state:', e);
        }
        return null;
    },

    clear(formId) {
        localStorage.removeItem(this.storagePrefix + formId);
    },

    init(form, options = {}) {
        if (!form) return;

        const formId = form.id || `form-${Date.now()}`;
        const { onRestore = null, maxAge = 24 * 60 * 60 * 1000 } = options;

        // Check for saved state
        const saved = this.load(formId);
        if (saved && (Date.now() - saved.timestamp) < maxAge) {
            this.showRecoveryBanner(form, saved, formId, onRestore);
        }

        // Auto-save on input
        form.addEventListener('input', () => {
            const data = Object.fromEntries(new FormData(form));
            // Remove sensitive fields before persisting
            delete data.password;
            delete data.current_password;
            delete data.new_password;
            delete data.confirm_password;
            delete data.currentPassword;
            delete data.newPassword;
            delete data.api_key;
            delete data.apiKey;
            delete data.secret;
            delete data.token;
            this.save(formId, data);
        });

        // Clear on submit
        form.addEventListener('submit', () => {
            this.clear(formId);
        });
    },

    showRecoveryBanner(form, saved, formId, onRestore) {
        const banner = document.createElement('div');
        banner.className = 'form-recovery-banner';
        banner.innerHTML = `
            <span class="form-recovery-icon">${components.icon('save', 20)}</span>
            <div class="form-recovery-content">
                <div class="form-recovery-title">Unsaved changes found</div>
                <div class="form-recovery-text">Would you like to restore your previous work?</div>
            </div>
            <div class="form-recovery-actions">
                <button class="form-recovery-btn restore">Restore</button>
                <button class="form-recovery-btn discard">Discard</button>
            </div>
        `;

        form.insertBefore(banner, form.firstChild);

        banner.querySelector('.restore').addEventListener('click', () => {
            Object.entries(saved.data).forEach(([name, value]) => {
                const field = form.elements[name];
                if (field) field.value = value;
            });
            banner.remove();
            onRestore?.(saved.data);
        });

        banner.querySelector('.discard').addEventListener('click', () => {
            this.clear(formId);
            banner.remove();
        });
    }
};

// Advanced Search with Operators
const advancedSearch = {
    operators: {
        'AND': (a, b) => a && b,
        'OR': (a, b) => a || b,
        'NOT': (a) => !a
    },

    parseQuery(query) {
        const tokens = [];
        const regex = /(".*?"|\S+)/g;
        let match;

        while ((match = regex.exec(query)) !== null) {
            let token = match[1];
            if (token.startsWith('"') && token.endsWith('"')) {
                token = { type: 'exact', value: token.slice(1, -1) };
            } else if (token.includes(':')) {
                const [field, value] = token.split(':');
                token = { type: 'field', field, value };
            } else if (['AND', 'OR', 'NOT'].includes(token.toUpperCase())) {
                token = { type: 'operator', value: token.toUpperCase() };
            } else {
                token = { type: 'term', value: token };
            }
            tokens.push(token);
        }

        return tokens;
    },

    buildFilter(tokens) {
        return (item) => {
            let result = true;
            let operator = 'AND';

            for (const token of tokens) {
                if (token.type === 'operator') {
                    operator = token.value;
                    continue;
                }

                let matches = false;
                if (token.type === 'exact') {
                    matches = Object.values(item).some(v =>
                        String(v).toLowerCase() === token.value.toLowerCase()
                    );
                } else if (token.type === 'field') {
                    matches = String(item[token.field] || '').toLowerCase()
                        .includes(token.value.toLowerCase());
                } else {
                    matches = Object.values(item).some(v =>
                        String(v).toLowerCase().includes(token.value.toLowerCase())
                    );
                }

                if (operator === 'NOT') {
                    matches = !matches;
                    operator = 'AND';
                }

                result = operator === 'OR' ? result || matches : result && matches;
            }

            return result;
        };
    },

    init(input, options = {}) {
        if (!input) return;

        const { onSearch = null, showHelp = true } = options;

        if (showHelp) {
            const help = document.createElement('div');
            help.className = 'search-operators-help';
            help.innerHTML = `
                <div class="search-operator">
                    <span class="search-operator-key">"exact phrase"</span>
                    <span class="search-operator-desc">Search for exact match</span>
                </div>
                <div class="search-operator">
                    <span class="search-operator-key">field:value</span>
                    <span class="search-operator-desc">Search specific field</span>
                </div>
                <div class="search-operator">
                    <span class="search-operator-key">AND / OR / NOT</span>
                    <span class="search-operator-desc">Combine search terms</span>
                </div>
            `;
            input.parentElement?.appendChild(help);
        }

        input.addEventListener('input', (e) => {
            const tokens = this.parseQuery(e.target.value);
            const filter = this.buildFilter(tokens);
            onSearch?.(filter, tokens);
        });
    }
};

// Column Visibility Manager
const columnManager = {
    init(trigger, table, options = {}) {
        if (!trigger || !table) return;

        const { columns = [], onChange = null } = options;
        let visibleColumns = new Set(columns.filter(c => c.visible !== false).map(c => c.id));

        const dropdown = document.createElement('div');
        dropdown.className = 'column-manager-dropdown';

        const render = () => {
            dropdown.innerHTML = `
                <div class="column-manager-header">
                    <span class="column-manager-title">Columns</span>
                    <span class="column-manager-reset">Reset</span>
                </div>
                <div class="column-manager-list">
                    ${columns.map(col => `
                        <div class="column-manager-item ${visibleColumns.has(col.id) ? 'visible' : ''}"
                             data-id="${col.id}" draggable="true">
                            <span class="column-manager-drag">${components.icon('grip-vertical', 14)}</span>
                            <div class="column-manager-checkbox">
                                ${visibleColumns.has(col.id) ? components.icon('check', 12) : ''}
                            </div>
                            <span class="column-manager-label">${col.label}</span>
                        </div>
                    `).join('')}
                </div>
            `;

            dropdown.querySelector('.column-manager-reset').addEventListener('click', () => {
                visibleColumns = new Set(columns.filter(c => c.visible !== false).map(c => c.id));
                render();
                applyVisibility();
            });

            dropdown.querySelectorAll('.column-manager-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    if (visibleColumns.has(id)) {
                        visibleColumns.delete(id);
                    } else {
                        visibleColumns.add(id);
                    }
                    render();
                    applyVisibility();
                });
            });
        };

        const applyVisibility = () => {
            columns.forEach((col, i) => {
                const cells = table.querySelectorAll(`th:nth-child(${i + 1}), td:nth-child(${i + 1})`);
                cells.forEach(cell => {
                    cell.style.display = visibleColumns.has(col.id) ? '' : 'none';
                });
            });
            onChange?.([...visibleColumns]);
        };

        trigger.parentElement?.appendChild(dropdown);
        trigger.classList.add('column-manager-trigger');

        trigger.addEventListener('click', () => {
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        render();

        return {
            getVisible: () => [...visibleColumns],
            setVisible: (ids) => { visibleColumns = new Set(ids); render(); applyVisibility(); }
        };
    }
};

// Notification Groups
const notificationGroups = {
    render(groups) {
        return groups.map(group => `
            <div class="notification-group" data-group-id="${group.id}">
                <div class="notification-group-header" onclick="notificationGroups.toggle('${escapeHtml(group.id)}')">
                    <div class="notification-group-icon">${components.icon(group.icon, 18)}</div>
                    <div class="notification-group-content">
                        <div class="notification-group-title">${escapeHtml(group.title)}</div>
                        <div class="notification-group-subtitle">${escapeHtml(group.subtitle)}</div>
                    </div>
                    <span class="notification-group-badge">${group.items.length}</span>
                    <span class="notification-group-toggle">${components.icon('chevron-down', 16)}</span>
                </div>
                <div class="notification-group-items">
                    ${group.items.map(item => `
                        <div class="notification-group-item">
                            <span class="notification-item-dot ${item.read ? 'read' : ''}"></span>
                            <span class="notification-item-text">${item.text}</span>
                            <span class="notification-item-time">${item.time}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    toggle(groupId) {
        const group = document.querySelector(`[data-group-id="${groupId}"]`);
        group?.classList.toggle('expanded');
    },

    expandAll() {
        document.querySelectorAll('.notification-group').forEach(g => g.classList.add('expanded'));
    },

    collapseAll() {
        document.querySelectorAll('.notification-group').forEach(g => g.classList.remove('expanded'));
    }
};

// Shopping Cart Drawer
const cartDrawer = {
    isOpen: false,
    items: [],

    open() {
        this.isOpen = true;
        document.querySelector('.cart-drawer')?.classList.add('open');
        document.querySelector('.cart-drawer-overlay')?.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    close() {
        this.isOpen = false;
        document.querySelector('.cart-drawer')?.classList.remove('open');
        document.querySelector('.cart-drawer-overlay')?.classList.remove('open');
        document.body.style.overflow = '';
    },

    toggle() {
        this.isOpen ? this.close() : this.open();
    },

    addItem(item) {
        this.items.push(item);
        this.render();
    },

    removeItem(index) {
        this.items.splice(index, 1);
        this.render();
    },

    getTotal() {
        return this.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    },

    render() {
        const drawer = document.querySelector('.cart-drawer-items');
        if (!drawer) return;

        if (this.items.length === 0) {
            drawer.innerHTML = `
                <div class="cart-drawer-empty">
                    <div class="cart-drawer-empty-icon">${components.icon('shopping-cart', 64)}</div>
                    <p>Your cart is empty</p>
                </div>
            `;
        } else {
            drawer.innerHTML = this.items.map((item, i) => `
                <div class="cart-item">
                    <img class="cart-item-image" src="${item.image}" alt="${item.title}" />
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.title}</div>
                        <div class="cart-item-meta">${item.meta || ''}</div>
                        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                    </div>
                    <span class="cart-item-remove" onclick="cartDrawer.removeItem(${i})">
                        ${components.icon('x', 16)}
                    </span>
                </div>
            `).join('');
        }

        const total = document.querySelector('.cart-summary-row.total span:last-child');
        if (total) {
            total.textContent = `$${this.getTotal().toFixed(2)}`;
        }

        const countBadge = document.querySelector('.cart-drawer-count');
        if (countBadge) {
            countBadge.textContent = this.items.length;
        }
    }
};

// Reaction Picker
const reactionPicker = {
    categories: {
        'popular': ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'],
        'smileys': ['😀', '😃', '😄', '😁', '😅', '🤣', '😊', '😇'],
        'gestures': ['👍', '👎', '👌', '✌️', '🤞', '👏', '🙌', '🤝'],
        'hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔']
    },

    init(container, options = {}) {
        if (!container) return;

        const { onReact = null, reactions = {} } = options;

        container.innerHTML = `
            <div class="reaction-picker">
                <button class="reaction-picker-trigger">
                    ${components.icon('smile', 14)} React
                </button>
                <div class="reaction-picker-dropdown">
                    <div class="reaction-picker-tabs">
                        ${Object.keys(this.categories).map((cat, i) => `
                            <button class="reaction-picker-tab ${i === 0 ? 'active' : ''}" data-category="${cat}">
                                ${this.categories[cat][0]}
                            </button>
                        `).join('')}
                    </div>
                    <div class="reaction-picker-grid">
                        ${this.categories.popular.map(e => `
                            <span class="reaction-emoji" data-emoji="${e}">${e}</span>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="reactions-display">
                ${Object.entries(reactions).map(([emoji, count]) => `
                    <span class="reaction-badge" data-emoji="${emoji}">
                        <span class="reaction-badge-emoji">${emoji}</span>
                        <span class="reaction-badge-count">${count}</span>
                    </span>
                `).join('')}
            </div>
        `;

        const trigger = container.querySelector('.reaction-picker-trigger');
        const dropdown = container.querySelector('.reaction-picker-dropdown');
        const grid = container.querySelector('.reaction-picker-grid');
        const tabs = container.querySelectorAll('.reaction-picker-tab');

        trigger.addEventListener('click', () => dropdown.classList.toggle('show'));

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const category = tab.dataset.category;
                grid.innerHTML = this.categories[category].map(e => `
                    <span class="reaction-emoji" data-emoji="${e}">${e}</span>
                `).join('');
            });
        });

        grid.addEventListener('click', (e) => {
            const emoji = e.target.closest('.reaction-emoji');
            if (emoji) {
                onReact?.(emoji.dataset.emoji);
                dropdown.classList.remove('show');
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });
    }
};

// Mention Autocomplete
const mentionAutocomplete = {
    init(textarea, options = {}) {
        if (!textarea) return;

        const { users = [], onMention = null } = options;

        const container = textarea.parentElement;
        container.classList.add('mention-input-container');

        const suggestions = document.createElement('div');
        suggestions.className = 'mention-suggestions';
        container.appendChild(suggestions);

        let mentionStart = -1;
        let highlightedIndex = 0;

        textarea.addEventListener('input', (e) => {
            const value = e.target.value;
            const cursorPos = e.target.selectionStart;
            const textBeforeCursor = value.substring(0, cursorPos);
            const atMatch = textBeforeCursor.match(/@(\w*)$/);

            if (atMatch) {
                mentionStart = cursorPos - atMatch[0].length;
                const query = atMatch[1].toLowerCase();
                const filtered = users.filter(u =>
                    u.name.toLowerCase().includes(query) ||
                    u.handle.toLowerCase().includes(query)
                ).slice(0, 5);

                if (filtered.length > 0) {
                    this.showSuggestions(suggestions, filtered, highlightedIndex);
                    this.positionSuggestions(suggestions, textarea, mentionStart);
                } else {
                    suggestions.classList.remove('show');
                }
            } else {
                mentionStart = -1;
                suggestions.classList.remove('show');
            }
        });

        textarea.addEventListener('keydown', (e) => {
            if (!suggestions.classList.contains('show')) return;

            const items = suggestions.querySelectorAll('.mention-suggestion');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
                this.updateHighlight(items, highlightedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                this.updateHighlight(items, highlightedIndex);
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                items[highlightedIndex]?.click();
            } else if (e.key === 'Escape') {
                suggestions.classList.remove('show');
            }
        });

        suggestions.addEventListener('click', (e) => {
            const item = e.target.closest('.mention-suggestion');
            if (item && mentionStart >= 0) {
                const user = users.find(u => u.handle === item.dataset.handle);
                if (user) {
                    const before = textarea.value.substring(0, mentionStart);
                    const after = textarea.value.substring(textarea.selectionStart);
                    textarea.value = `${before}@${user.handle} ${after}`;
                    textarea.focus();
                    const newPos = mentionStart + user.handle.length + 2;
                    textarea.setSelectionRange(newPos, newPos);
                    suggestions.classList.remove('show');
                    onMention?.(user);
                }
            }
        });
    },

    showSuggestions(container, users, highlighted) {
        container.innerHTML = users.map((u, i) => `
            <div class="mention-suggestion ${i === highlighted ? 'highlighted' : ''}" data-handle="${escapeHtml(u.handle)}">
                <div class="mention-avatar">${u.avatar || escapeHtml(u.name.charAt(0).toUpperCase())}</div>
                <div class="mention-user-info">
                    <div class="mention-user-name">${escapeHtml(u.name)}</div>
                    <div class="mention-user-handle">@${escapeHtml(u.handle)}</div>
                </div>
            </div>
        `).join('');
        container.classList.add('show');
    },

    positionSuggestions(container, textarea, startPos) {
        const rect = textarea.getBoundingClientRect();
        container.style.top = `${rect.height + 4}px`;
        container.style.left = '0';
    },

    updateHighlight(items, index) {
        items.forEach((item, i) => {
            item.classList.toggle('highlighted', i === index);
        });
    }
};

// Interactive Product Tour
const productTour = {
    steps: [],
    currentStep: 0,
    overlay: null,
    spotlight: null,
    tooltip: null,

    init(steps) {
        this.steps = steps;
        this.currentStep = 0;
        this.createElements();
    },

    createElements() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'tour-overlay';

        this.spotlight = document.createElement('div');
        this.spotlight.className = 'tour-spotlight';

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tour-tooltip';

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.spotlight);
        document.body.appendChild(this.tooltip);
    },

    start() {
        this.currentStep = 0;
        this.showStep();
    },

    showStep() {
        const step = this.steps[this.currentStep];
        if (!step) {
            this.end();
            return;
        }

        const target = document.querySelector(step.target);
        if (!target) {
            this.next();
            return;
        }

        const rect = target.getBoundingClientRect();

        // Position spotlight
        this.spotlight.style.left = `${rect.left - 8}px`;
        this.spotlight.style.top = `${rect.top - 8}px`;
        this.spotlight.style.width = `${rect.width + 16}px`;
        this.spotlight.style.height = `${rect.height + 16}px`;

        // Render tooltip
        this.tooltip.innerHTML = `
            <div class="tour-tooltip-header">
                <div class="tour-tooltip-step">Step ${this.currentStep + 1} of ${this.steps.length}</div>
                <div class="tour-tooltip-title">${step.title}</div>
            </div>
            <div class="tour-tooltip-body">${step.content}</div>
            <div class="tour-tooltip-footer">
                <div class="tour-progress">
                    ${this.steps.map((_, i) => `
                        <span class="tour-progress-dot ${i < this.currentStep ? 'completed' : ''} ${i === this.currentStep ? 'active' : ''}"></span>
                    `).join('')}
                </div>
                <div class="tour-actions">
                    <button class="tour-btn skip" onclick="productTour.end()">Skip</button>
                    <button class="tour-btn next" onclick="productTour.next()">
                        ${this.currentStep === this.steps.length - 1 ? 'Finish' : 'Next'}
                    </button>
                </div>
            </div>
        `;

        // Position tooltip
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let top = rect.bottom + 16;
        let left = rect.left;

        if (top + tooltipRect.height > window.innerHeight) {
            top = rect.top - tooltipRect.height - 16;
        }
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 16;
        }

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    next() {
        this.currentStep++;
        if (this.currentStep >= this.steps.length) {
            this.end();
        } else {
            this.showStep();
        }
    },

    end() {
        this.overlay?.remove();
        this.spotlight?.remove();
        this.tooltip?.remove();
        localStorage.setItem('vaultlister_tour_complete', 'true');
    }
};

// Number Counter Animation
const animatedCounter = {
    animate(element, targetValue, options = {}) {
        if (!element) return;

        const {
            duration = 1000,
            format = (v) => Math.round(v).toLocaleString(),
            easing = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        } = options;

        const startValue = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
        const startTime = performance.now();

        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easing(progress);
            const currentValue = startValue + (targetValue - startValue) * easedProgress;

            element.textContent = format(currentValue);

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };

        requestAnimationFrame(update);
    }
};

// Error Shake Animation
const shakeError = {
    shake(element) {
        if (!element) return;
        element.classList.add('shake-error', 'input-error-highlight');
        setTimeout(() => {
            element.classList.remove('shake-error');
        }, 400);
    },

    clearError(element) {
        element?.classList.remove('input-error-highlight');
    }
};

// Feature Discovery
const featureDiscovery = {
    shown: (() => { try { return new Set(JSON.parse(localStorage.getItem('vaultlister_features_shown') || '[]')); } catch { return new Set(); } })(),

    show(featureId, options = {}) {
        if (this.shown.has(featureId)) return false;

        const { title, description, target } = options;
        const element = document.querySelector(target);
        if (!element) return false;

        const callout = document.createElement('div');
        callout.className = 'feature-callout';
        callout.innerHTML = `
            <span class="feature-badge feature-callout-badge">New</span>
            <div class="feature-callout-title">${title}</div>
            <div class="feature-callout-text">${description}</div>
            <button class="feature-callout-dismiss" onclick="featureDiscovery.dismiss('${featureId}', this)">
                ${components.icon('x', 16)}
            </button>
        `;

        element.parentElement?.insertBefore(callout, element);

        return true;
    },

    dismiss(featureId, button) {
        this.shown.add(featureId);
        localStorage.setItem('vaultlister_features_shown', JSON.stringify([...this.shown]));
        button?.closest('.feature-callout')?.remove();
    },

    reset() {
        this.shown.clear();
        localStorage.removeItem('vaultlister_features_shown');
    }
};

// Saved Searches
const savedSearches = {
    storageKey: 'vaultlister_saved_searches',

    get() {
        try {
            return JSON.parse(localStorage.getItem(this.storageKey) || '[]');
        } catch {
            return [];
        }
    },

    save(name, query) {
        const searches = this.get();
        searches.push({ name, query, createdAt: Date.now() });
        localStorage.setItem(this.storageKey, JSON.stringify(searches.slice(-10)));
    },

    remove(index) {
        const searches = this.get();
        searches.splice(index, 1);
        localStorage.setItem(this.storageKey, JSON.stringify(searches));
    },

    render(onSelect) {
        const searches = this.get();
        if (searches.length === 0) return '';

        return `
            <div class="saved-searches">
                <div class="saved-searches-title">Saved Searches</div>
                ${searches.map((s, i) => `
                    <div class="saved-search-item" onclick="${onSelect}('${s.query}')">
                        <span class="saved-search-icon">${components.icon('search', 14)}</span>
                        <span class="saved-search-name">${s.name}</span>
                        <span class="saved-search-delete" onclick="event.stopPropagation(); savedSearches.remove(${i})">
                            ${components.icon('x', 12)}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Data Diff View
const dataDiff = {
    render(before, after, fields) {
        const changes = fields.map(field => {
            const oldVal = before[field.key];
            const newVal = after[field.key];
            const changed = oldVal !== newVal;

            return { field, oldVal, newVal, changed };
        });

        return `
            <div class="diff-view">
                <div class="diff-column before">
                    <div class="diff-column-header">Before</div>
                    <div class="diff-content">
                        ${changes.map(c => `
                            <div class="diff-line ${c.changed ? 'removed' : 'unchanged'}">
                                <strong>${c.field.label}:</strong> ${c.oldVal ?? '(empty)'}
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="diff-column after">
                    <div class="diff-column-header">After</div>
                    <div class="diff-content">
                        ${changes.map(c => `
                            <div class="diff-line ${c.changed ? 'added' : 'unchanged'}">
                                <strong>${c.field.label}:</strong> ${c.newVal ?? '(empty)'}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }
};

// Shortcuts Manager (Enhanced)
const shortcutsManager = {
    shortcuts: [],

    register(shortcut) {
        this.shortcuts.push(shortcut);
    },

    init() {
        document.addEventListener('keydown', (e) => {
            const key = [];
            if (e.metaKey || e.ctrlKey) key.push('Cmd');
            if (e.shiftKey) key.push('Shift');
            if (e.altKey) key.push('Alt');
            key.push(e.key.toUpperCase());

            const combo = key.join('+');
            const shortcut = this.shortcuts.find(s => s.keys === combo);

            if (shortcut && !shortcut.disabled) {
                e.preventDefault();
                shortcut.action();
            }
        });
    },

    render() {
        const grouped = {};
        this.shortcuts.forEach(s => {
            if (!grouped[s.category]) grouped[s.category] = [];
            grouped[s.category].push(s);
        });

        return `
            <div class="shortcuts-modal">
                ${Object.entries(grouped).map(([category, shortcuts]) => `
                    <div class="shortcuts-section">
                        <div class="shortcuts-section-title">${category}</div>
                        ${shortcuts.map(s => `
                            <div class="shortcut-row">
                                <span class="shortcut-action">${s.description}</span>
                                <div class="shortcut-keys">
                                    ${s.keys.split('+').map(k => `<span class="shortcut-key">${k}</span>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    }
};

// Global error handlers
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Unhandled error:', { message, source, lineno, colno, error });
};
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
});

// Initialize UI enhancements on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Enable smooth scroll
    document.documentElement.classList.add('smooth-scroll');

    // Initialize ripple effect
    rippleEffect.init();

    // Keep aria-expanded in sync for dropdown triggers
    document.addEventListener('click', (e) => {
        const dropdown = e.target.closest('.dropdown');
        if (dropdown) {
            const trigger = dropdown.querySelector('[aria-haspopup]');
            if (trigger) {
                requestAnimationFrame(() => {
                    trigger.setAttribute('aria-expanded', dropdown.classList.contains('open'));
                });
            }
        }
    });
});

// ============================================