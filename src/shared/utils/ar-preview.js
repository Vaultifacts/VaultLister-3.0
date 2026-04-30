// AR Preview Utility - WebAR Lite
// Provides simple AR preview capabilities using WebXR/camera overlay

/**
 * AR Preview Manager
 * Uses device camera to overlay product images for visualization
 */
export class ARPreview {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.stream = null;
        this.isActive = false;
        this.currentImage = null;
        this.imagePosition = { x: 0.5, y: 0.5 };
        this.imageScale = 0.5;
        this.imageRotation = 0;
    }

    /**
     * Check if AR is supported
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Initialize the AR preview
     */
    async init(containerId) {
        if (!ARPreview.isSupported()) {
            throw new Error('AR preview not supported on this device');
        }

        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error('Container element not found');
        }

        // Create video element for camera feed
        this.video = document.createElement('video');
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('autoplay', '');
        this.video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;';

        // Create canvas for overlay
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
        this.ctx = this.canvas.getContext('2d');

        // Add to container
        container.style.position = 'relative';
        container.style.overflow = 'hidden';
        container.innerHTML = ''; // nosemgrep: javascript.browser.security.insecure-document-method
        container.appendChild(this.video);
        container.appendChild(this.canvas);

        // Add touch/mouse controls
        this.setupControls(container);

        return this;
    }

    /**
     * Start the camera
     */
    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });

            this.video.srcObject = this.stream;
            await this.video.play();

            // Set canvas size to match video
            this.canvas.width = this.video.videoWidth || 1280;
            this.canvas.height = this.video.videoHeight || 720;

            this.isActive = true;
            this._lastFrameTime = 0;
            this.renderLoop();

            console.log('[AR] Camera started');
            return true;
        } catch (error) {
            console.error('[AR] Failed to start camera:', error);
            if (error.name === 'NotAllowedError') {
                const e = new Error(
                    'Camera permission was denied. Please allow camera access in your browser settings and try again.',
                );
                e.name = 'NotAllowedError';
                throw e;
            }
            if (error.name === 'NotFoundError') {
                const e = new Error('No camera found on this device. AR preview requires a camera.');
                e.name = 'NotFoundError';
                throw e;
            }
            throw error;
        }
    }

    /**
     * Stop the camera
     */
    stop() {
        this.isActive = false;

        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
        }

        console.log('[AR] Camera stopped');
    }

    /**
     * Load an image for preview
     */
    async loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                this.currentImage = img;
                console.log('[AR] Image loaded:', img.width, 'x', img.height);
                resolve(img);
            };

            img.onerror = () => {
                reject(new Error('Failed to load image'));
            };

            img.src = src;
        });
    }

    /**
     * Render loop
     */
    renderLoop(timestamp = 0) {
        if (!this.isActive) return;

        // 30 fps limiter — skip frame if less than ~33ms has elapsed
        const elapsed = timestamp - (this._lastFrameTime || 0);
        if (elapsed < 33) {
            requestAnimationFrame((t) => this.renderLoop(t));
            return;
        }
        this._lastFrameTime = timestamp;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw product image if loaded
        if (this.currentImage) {
            this.drawProductOverlay();
        }

        // Continue loop
        requestAnimationFrame((t) => this.renderLoop(t));
    }

    /**
     * Draw the product overlay
     */
    drawProductOverlay() {
        const img = this.currentImage;
        if (!img) return;

        const { width, height } = this.canvas;

        // Calculate image dimensions
        const imgWidth = img.width * this.imageScale;
        const imgHeight = img.height * this.imageScale;

        // Calculate position
        const x = width * this.imagePosition.x - imgWidth / 2;
        const y = height * this.imagePosition.y - imgHeight / 2;

        // Save context state
        this.ctx.save();

        // Apply rotation
        if (this.imageRotation !== 0) {
            const centerX = x + imgWidth / 2;
            const centerY = y + imgHeight / 2;
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate((this.imageRotation * Math.PI) / 180);
            this.ctx.translate(-centerX, -centerY);
        }

        // Draw shadow
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowOffsetX = 5;
        this.ctx.shadowOffsetY = 5;

        // Draw image
        this.ctx.drawImage(img, x, y, imgWidth, imgHeight);

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Setup touch/mouse controls
     */
    setupControls(container) {
        let isDragging = false;
        let lastX, lastY;
        let lastDistance = 0;

        // Mouse events
        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const rect = container.getBoundingClientRect();
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;

            this.imagePosition.x += deltaX / rect.width;
            this.imagePosition.y += deltaY / rect.height;

            // Clamp position
            this.imagePosition.x = Math.max(0.1, Math.min(0.9, this.imagePosition.x));
            this.imagePosition.y = Math.max(0.1, Math.min(0.9, this.imagePosition.y));

            lastX = e.clientX;
            lastY = e.clientY;
        });

        container.addEventListener('mouseup', () => {
            isDragging = false;
        });

        container.addEventListener('mouseleave', () => {
            isDragging = false;
        });

        // Mouse wheel for scaling
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            this.imageScale = Math.max(0.1, Math.min(2, this.imageScale + delta));
        });

        // Touch events
        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                isDragging = true;
                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Pinch to zoom
                lastDistance = this.getTouchDistance(e.touches);
            }
        });

        container.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 1 && isDragging) {
                const rect = container.getBoundingClientRect();
                const deltaX = e.touches[0].clientX - lastX;
                const deltaY = e.touches[0].clientY - lastY;

                this.imagePosition.x += deltaX / rect.width;
                this.imagePosition.y += deltaY / rect.height;

                this.imagePosition.x = Math.max(0.1, Math.min(0.9, this.imagePosition.x));
                this.imagePosition.y = Math.max(0.1, Math.min(0.9, this.imagePosition.y));

                lastX = e.touches[0].clientX;
                lastY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Pinch to zoom
                const distance = this.getTouchDistance(e.touches);
                const delta = (distance - lastDistance) / 200;
                this.imageScale = Math.max(0.1, Math.min(2, this.imageScale + delta));
                lastDistance = distance;
            }
        });

        container.addEventListener('touchend', () => {
            isDragging = false;
            lastDistance = 0;
        });
    }

    /**
     * Get distance between two touch points
     */
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Set image position (0-1 range)
     */
    setPosition(x, y) {
        this.imagePosition.x = Math.max(0, Math.min(1, x));
        this.imagePosition.y = Math.max(0, Math.min(1, y));
    }

    /**
     * Set image scale
     */
    setScale(scale) {
        this.imageScale = Math.max(0.1, Math.min(2, scale));
    }

    /**
     * Set image rotation (degrees)
     */
    setRotation(degrees) {
        this.imageRotation = degrees;
    }

    /**
     * Rotate image by degrees
     */
    rotate(degrees) {
        this.imageRotation += degrees;
    }

    /**
     * Take a snapshot
     */
    takeSnapshot() {
        // Create snapshot canvas
        const snapshot = document.createElement('canvas');
        snapshot.width = this.canvas.width;
        snapshot.height = this.canvas.height;
        const ctx = snapshot.getContext('2d');

        // Draw video frame
        ctx.drawImage(this.video, 0, 0);

        // Draw overlay
        ctx.drawImage(this.canvas, 0, 0);

        // Return as data URL
        return snapshot.toDataURL('image/png');
    }

    /**
     * Reset position and scale
     */
    reset() {
        this.imagePosition = { x: 0.5, y: 0.5 };
        this.imageScale = 0.5;
        this.imageRotation = 0;
    }
}

/**
 * Simple AR preview without camera (image overlay)
 */
export class SimpleAROverlay {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.backgroundImage = null;
        this.overlayImage = null;
        this.position = { x: 50, y: 50 };
        this.scale = 0.5;
    }

    /**
     * Set background image
     */
    setBackground(src) {
        this.container.style.backgroundImage = `url(${src})`;
        this.container.style.backgroundSize = 'cover';
        this.container.style.backgroundPosition = 'center';
    }

    /**
     * Add overlay image
     */
    addOverlay(src, options = {}) {
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = `
            position: absolute;
            left: ${options.x || 50}%;
            top: ${options.y || 50}%;
            transform: translate(-50%, -50%) scale(${options.scale || 0.5});
            cursor: move;
            filter: drop-shadow(0 5px 10px rgba(0,0,0,0.3));
            transition: transform 0.1s;
        `;

        // Make draggable
        this.makeDraggable(img);

        this.container.appendChild(img);
        this.overlayImage = img;

        return img;
    }

    /**
     * Make element draggable
     */
    makeDraggable(element) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialLeft = parseFloat(element.style.left) || 50;
            initialTop = parseFloat(element.style.top) || 50;
            element.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const rect = this.container.getBoundingClientRect();
            const deltaX = ((e.clientX - startX) / rect.width) * 100;
            const deltaY = ((e.clientY - startY) / rect.height) * 100;

            element.style.left = `${Math.max(10, Math.min(90, initialLeft + deltaX))}%`;
            element.style.top = `${Math.max(10, Math.min(90, initialTop + deltaY))}%`;
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            element.style.cursor = 'move';
        });

        // Touch events
        element.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            initialLeft = parseFloat(element.style.left) || 50;
            initialTop = parseFloat(element.style.top) || 50;
        });

        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;

            const rect = this.container.getBoundingClientRect();
            const deltaX = ((e.touches[0].clientX - startX) / rect.width) * 100;
            const deltaY = ((e.touches[0].clientY - startY) / rect.height) * 100;

            element.style.left = `${Math.max(10, Math.min(90, initialLeft + deltaX))}%`;
            element.style.top = `${Math.max(10, Math.min(90, initialTop + deltaY))}%`;
        });

        document.addEventListener('touchend', () => {
            isDragging = false;
        });
    }

    /**
     * Clear all overlays
     */
    clear() {
        const overlays = this.container.querySelectorAll('img');
        overlays.forEach((img) => img.remove());
    }
}

// Export helper function
export function createARPreview(containerId) {
    if (ARPreview.isSupported()) {
        return new ARPreview().init(containerId);
    }
    return new SimpleAROverlay(containerId);
}
