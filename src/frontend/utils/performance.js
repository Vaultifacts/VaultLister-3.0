// Performance Utility Functions for VaultLister Frontend

/**
 * Debounce function - Delays execution until after wait time has elapsed since last call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function - Limits execution to once per wait period
 * @param {Function} func - Function to throttle
 * @param {number} wait - Milliseconds to wait between executions
 * @returns {Function} Throttled function
 */
export function throttle(func, wait = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), wait);
        }
    };
}

/**
 * Lazy load images using Intersection Observer
 * @param {string} selector - CSS selector for images to lazy load
 */
export function lazyLoadImages(selector = 'img[data-src]') {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading 50px before entering viewport
            },
        );

        document.querySelectorAll(selector).forEach((img) => {
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            imageObserver.observe(img);
        });
    } else {
        // Fallback: Load all images immediately
        document.querySelectorAll(selector).forEach((img) => {
            // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
}

/**
 * Simple in-memory cache with TTL
 */
export class Cache {
    constructor(ttl = 300000) {
        // Default 5 minutes
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now(),
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const age = Date.now() - item.timestamp;
        if (age > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    clear() {
        this.cache.clear();
    }

    delete(key) {
        this.cache.delete(key);
    }
}

/**
 * Batch DOM updates for better performance
 * @param {Function} updateFn - Function that performs DOM updates
 */
export function batchDOMUpdate(updateFn) {
    requestAnimationFrame(() => {
        updateFn();
    });
}

/**
 * Virtual scroll helper - Returns visible items based on scroll position
 * @param {Array} items - Full array of items
 * @param {number} scrollTop - Current scroll position
 * @param {number} containerHeight - Height of visible container
 * @param {number} itemHeight - Height of each item
 * @param {number} buffer - Number of items to render outside viewport
 * @returns {Object} { visibleItems, startIndex, endIndex, offsetY }
 */
export function getVisibleItems(items, scrollTop, containerHeight, itemHeight, buffer = 5) {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer);

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;

    return {
        visibleItems,
        startIndex,
        endIndex,
        offsetY,
        totalHeight: items.length * itemHeight,
    };
}

/**
 * Preload images for better UX
 * @param {Array<string>} urls - Array of image URLs to preload
 * @returns {Promise} Resolves when all images are loaded
 */
export function preloadImages(urls) {
    const promises = urls.map((url) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = resolve;
            img.onerror = reject;
            img.src = url;
        });
    });

    return Promise.all(promises);
}

/**
 * Measure performance of a function
 * @param {string} label - Label for the measurement
 * @param {Function} fn - Function to measure
 * @returns {*} Result of the function
 */
export async function measurePerformance(label, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
}

/**
 * Request Idle Callback wrapper with fallback
 * @param {Function} callback - Function to run during idle time
 * @param {Object} options - Options for requestIdleCallback
 */
export function runWhenIdle(callback, options = {}) {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(callback, options);
    } else {
        setTimeout(callback, 1);
    }
}

/**
 * Chunk array processing to avoid blocking main thread
 * @param {Array} array - Array to process
 * @param {Function} processFn - Function to process each item
 * @param {number} chunkSize - Items to process per chunk
 * @returns {Promise} Resolves when all items are processed
 */
export function chunkProcess(array, processFn, chunkSize = 100) {
    return new Promise((resolve) => {
        let index = 0;

        function processChunk() {
            const chunk = array.slice(index, index + chunkSize);
            chunk.forEach(processFn);
            index += chunkSize;

            if (index < array.length) {
                runWhenIdle(processChunk);
            } else {
                resolve();
            }
        }

        processChunk();
    });
}

/**
 * Detect slow connection
 * @returns {boolean} True if connection is slow
 */
export function isSlowConnection() {
    if ('connection' in navigator) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        return connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g';
    }
    return false;
}

/**
 * Optimize image URL based on connection speed
 * @param {string} url - Original image URL
 * @param {string} size - Desired size ('thumbnail', 'medium', 'full')
 * @returns {string} Optimized image URL
 */
export function optimizeImageURL(url, size = 'medium') {
    if (isSlowConnection()) {
        return url.replace('/original/', '/thumbnails/');
    }

    const sizeMap = {
        thumbnail: '/thumbnails/',
        medium: '/thumbnails/',
        full: '/original/',
    };

    return url.replace(/\/(original|thumbnails|edited)\//, sizeMap[size]);
}

/**
 * Clean up event listeners to prevent memory leaks
 */
export class EventManager {
    constructor() {
        this.listeners = [];
    }

    addEventListener(element, event, handler, options) {
        element.addEventListener(event, handler, options);
        this.listeners.push({ element, event, handler, options });
    }

    removeAll() {
        this.listeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.listeners = [];
    }
}

/**
 * Efficient string escaping for XSS prevention
 * (Memoized version)
 */
const escapeCache = new Map();
export function escapeHtmlFast(str) {
    if (escapeCache.has(str)) {
        return escapeCache.get(str);
    }

    const escaped = String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Limit cache size
    if (escapeCache.size > 1000) {
        escapeCache.clear();
    }

    escapeCache.set(str, escaped);
    return escaped;
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "2.5 MB")
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Compress image before upload
 * @param {File} file - Image file
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} Compressed image blob
 */
export function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Export default object with all utilities
export default {
    debounce,
    throttle,
    lazyLoadImages,
    Cache,
    batchDOMUpdate,
    getVisibleItems,
    preloadImages,
    measurePerformance,
    runWhenIdle,
    chunkProcess,
    isSlowConnection,
    optimizeImageURL,
    EventManager,
    escapeHtmlFast,
    formatFileSize,
    compressImage,
};
