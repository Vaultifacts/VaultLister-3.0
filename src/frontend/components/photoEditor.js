// Photo Editor Component (Vanilla JS)
// Provides both basic Canvas API editing and advanced Cloudinary features

const PhotoEditor = {
    // Current image data
    image: null,
    canvas: null,
    ctx: null,
    originalImage: null,
    currentEdits: {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        rotation: 0,
        flipH: false,
        flipV: false,
        filter: 'none'
    },

    // Initialize the photo editor
    async open(imageId) {
        try {
            // Fetch image data
            this.image = await api.get(`/image-bank/${imageId}`);

            // Load the original image
            this.originalImage = await this.loadImage(this.image.file_path);

            // Reset edits
            this.currentEdits = {
                brightness: 0,
                contrast: 0,
                saturation: 0,
                rotation: 0,
                flipH: false,
                flipV: false,
                filter: 'none'
            };

            // Create and open modal
            const modalContent = this.render();
            modals.open('photoEditor', modalContent, {
                maxWidth: '1200px',
                onClose: () => this.cleanup()
            });

            // Setup canvas after modal is rendered
            setTimeout(() => {
                this.setupCanvas();
                this.drawImage();
            }, 100);
        } catch (error) {
            toast.error('Failed to open photo editor: ' + error.message);
        }
    },

    // Load image from URL
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    },

    // Setup canvas element
    setupCanvas() {
        this.canvas = document.getElementById('photo-editor-canvas'); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');

        // Set canvas size to fit container while maintaining aspect ratio
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth;
        const maxHeight = container.clientHeight;

        const scale = Math.min(
            maxWidth / this.originalImage.width,
            maxHeight / this.originalImage.height,
            1 // Don't upscale
        );

        this.canvas.width = this.originalImage.width * scale;
        this.canvas.height = this.originalImage.height * scale;
    },

    // Draw image with current edits
    drawImage() {
        if (!this.ctx || !this.originalImage) return;

        const { width, height } = this.canvas;

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Save context state
        this.ctx.save();

        // Apply transformations
        this.ctx.translate(width / 2, height / 2);

        // Rotation
        if (this.currentEdits.rotation !== 0) {
            this.ctx.rotate((this.currentEdits.rotation * Math.PI) / 180);
        }

        // Flip
        const scaleX = this.currentEdits.flipH ? -1 : 1;
        const scaleY = this.currentEdits.flipV ? -1 : 1;
        this.ctx.scale(scaleX, scaleY);

        // Draw image centered
        this.ctx.drawImage(
            this.originalImage,
            -width / 2,
            -height / 2,
            width,
            height
        );

        // Restore context
        this.ctx.restore();

        // Apply filters and adjustments
        this.applyFilters();
    },

    // Apply filters and color adjustments
    applyFilters() {
        if (!this.ctx) return;

        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;

        // Apply brightness
        if (this.currentEdits.brightness !== 0) {
            const brightness = this.currentEdits.brightness * 2.55;
            for (let i = 0; i < data.length; i += 4) {
                data[i] += brightness;
                data[i + 1] += brightness;
                data[i + 2] += brightness;
            }
        }

        // Apply contrast
        if (this.currentEdits.contrast !== 0) {
            const contrast = (this.currentEdits.contrast + 100) / 100;
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

            for (let i = 0; i < data.length; i += 4) {
                data[i] = factor * (data[i] - 128) + 128;
                data[i + 1] = factor * (data[i + 1] - 128) + 128;
                data[i + 2] = factor * (data[i + 2] - 128) + 128;
            }
        }

        // Apply saturation
        if (this.currentEdits.saturation !== 0) {
            const saturation = this.currentEdits.saturation / 100;

            for (let i = 0; i < data.length; i += 4) {
                const gray = 0.2989 * data[i] + 0.5870 * data[i + 1] + 0.1140 * data[i + 2];
                data[i] = gray + saturation * (data[i] - gray);
                data[i + 1] = gray + saturation * (data[i + 1] - gray);
                data[i + 2] = gray + saturation * (data[i + 2] - gray);
            }
        }

        // Apply preset filters
        if (this.currentEdits.filter !== 'none') {
            this.applyPresetFilter(data, this.currentEdits.filter);
        }

        // Put modified image data back
        this.ctx.putImageData(imageData, 0, 0);
    },

    // Apply preset filters
    applyPresetFilter(data, filterName) {
        switch (filterName) {
            case 'grayscale':
                for (let i = 0; i < data.length; i += 4) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    data[i] = data[i + 1] = data[i + 2] = gray;
                }
                break;

            case 'sepia':
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
                    data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
                    data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
                }
                break;

            case 'vintage':
                for (let i = 0; i < data.length; i += 4) {
                    data[i] += 40;
                    data[i + 1] += 20;
                    data[i + 2] -= 20;
                }
                break;
        }
    },

    // Rotate image
    rotate(degrees) {
        this.currentEdits.rotation = (this.currentEdits.rotation + degrees) % 360;
        this.drawImage();
    },

    // Flip horizontal
    flipHorizontal() {
        this.currentEdits.flipH = !this.currentEdits.flipH;
        this.drawImage();
    },

    // Flip vertical
    flipVertical() {
        this.currentEdits.flipV = !this.currentEdits.flipV;
        this.drawImage();
    },

    // Set brightness
    setBrightness(value) {
        this.currentEdits.brightness = value;
        this.updateSliderValue('brightness', value);
        this.drawImage();
    },

    // Set contrast
    setContrast(value) {
        this.currentEdits.contrast = value;
        this.updateSliderValue('contrast', value);
        this.drawImage();
    },

    // Set saturation
    setSaturation(value) {
        this.currentEdits.saturation = value;
        this.updateSliderValue('saturation', value);
        this.drawImage();
    },

    // Set filter
    setFilter(filterName) {
        this.currentEdits.filter = filterName;
        this.drawImage();
    },

    // Update slider value display
    updateSliderValue(name, value) {
        const display = document.getElementById(`${name}-value`); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
        if (display) {
            display.textContent = value > 0 ? `+${value}` : value;
        }
    },

    // Reset all edits
    reset() {
        this.currentEdits = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
            filter: 'none'
        };

        // Reset slider inputs
        ['brightness', 'contrast', 'saturation'].forEach(name => {
            const slider = document.getElementById(`${name}-slider`); // nosemgrep: javascript.browser.security.insecure-document-method.insecure-document-method
            if (slider) slider.value = 0;
            this.updateSliderValue(name, 0);
        });

        this.drawImage();
    },

    // Save edited image
    async save() {
        if (!this.canvas) return;

        try {
            // Convert canvas to blob
            const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/jpeg', 0.95));

            // Create FormData and upload
            const formData = new FormData();
            formData.append('image', blob, `${this.image.id}_edited.jpg`);
            formData.append('original_id', this.image.id);
            formData.append('edits', JSON.stringify(this.currentEdits));

            // Upload edited image
            const result = await api.post('/image-bank/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('Image saved!');

            // Reload Image Bank
            await handlers.loadImageBank();

            // Close editor
            modals.close();
        } catch (error) {
            toast.error('Failed to save image: ' + error.message);
        }
    },

    // Advanced Cloudinary editing
    async cloudinaryEdit(action) {
        try {
            let params = {};

            switch (action) {
                case 'remove-bg':
                    params = { action: 'remove-background', image_id: this.image.id };
                    break;
                case 'enhance':
                    params = { action: 'auto-enhance', image_id: this.image.id };
                    break;
                case 'smart-crop':
                    const width = prompt('Enter target width:', '800');
                    const height = prompt('Enter target height:', '800');
                    if (!width || !height) return;

                    params = {
                        action: 'smart-crop',
                        image_id: this.image.id,
                        width: parseInt(width),
                        height: parseInt(height)
                    };
                    break;
            }

            const result = await api.post('/image-bank/cloudinary-edit', params);

            if (result.success) {
                toast.success('Advanced edit applied! Reloading image...');

                // Reload the image with the new URL
                this.originalImage = await this.loadImage(result.url);
                this.setupCanvas();
                this.drawImage();
            } else {
                toast.error(result.error || 'Failed to apply edit');
            }
        } catch (error) {
            toast.error('Cloudinary edit failed: ' + error.message);
        }
    },

    // Cleanup
    cleanup() {
        if (this.originalImage && this.originalImage.src && this.originalImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.originalImage.src);
        }
        this.originalImage = null;
        this.image = null;
        this.canvas = null;
        this.ctx = null;
    },

    // Render UI
    render() {
        return `
            <div class="photo-editor">
                <!-- Toolbar -->
                <div class="photo-editor-toolbar">
                    <h2 class="text-lg font-bold">${escapeHtml(this.image.title || this.image.original_filename)}</h2>
                    <div class="flex gap-2">
                        <button class="btn btn-secondary" onclick="PhotoEditor.reset()">
                            Reset
                        </button>
                        <button class="btn btn-primary" onclick="PhotoEditor.save()">
                            Save Changes
                        </button>
                    </div>
                </div>

                <div class="photo-editor-container">
                    <!-- Tools Sidebar -->
                    <div class="photo-editor-sidebar">
                        <div class="editor-section">
                            <h3 class="editor-section-title">Transform</h3>
                            <div class="editor-tools">
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.rotate(90)">
                                    🔄 Rotate Right
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.rotate(-90)">
                                    🔄 Rotate Left
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.flipHorizontal()">
                                    ↔️ Flip Horizontal
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.flipVertical()">
                                    ↕️ Flip Vertical
                                </button>
                            </div>
                        </div>

                        <div class="editor-section">
                            <h3 class="editor-section-title">Adjustments</h3>
                            <div class="editor-control">
                                <label class="flex justify-between">
                                    <span>Brightness</span>
                                    <span id="brightness-value">0</span>
                                </label>
                                <input type="range" class="w-full" id="brightness-slider" min="-100" max="100" value="0"
                                       oninput="PhotoEditor.setBrightness(parseInt(this.value))">
                            </div>
                            <div class="editor-control">
                                <label class="flex justify-between">
                                    <span>Contrast</span>
                                    <span id="contrast-value">0</span>
                                </label>
                                <input type="range" class="w-full" id="contrast-slider" min="-100" max="100" value="0"
                                       oninput="PhotoEditor.setContrast(parseInt(this.value))">
                            </div>
                            <div class="editor-control">
                                <label class="flex justify-between">
                                    <span>Saturation</span>
                                    <span id="saturation-value">0</span>
                                </label>
                                <input type="range" class="w-full" id="saturation-slider" min="-100" max="100" value="0"
                                       oninput="PhotoEditor.setSaturation(parseInt(this.value))">
                            </div>
                        </div>

                        <div class="editor-section">
                            <h3 class="editor-section-title">Filters</h3>
                            <div class="editor-tools">
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.setFilter('none')">
                                    None
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.setFilter('grayscale')">
                                    Grayscale
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.setFilter('sepia')">
                                    Sepia
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.setFilter('vintage')">
                                    Vintage
                                </button>
                            </div>
                        </div>

                        <div class="editor-section">
                            <h3 class="editor-section-title">Advanced (Cloudinary)</h3>
                            <div class="editor-tools">
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.cloudinaryEdit('remove-bg')">
                                    ✨ Remove Background
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.cloudinaryEdit('enhance')">
                                    ✨ Auto Enhance
                                </button>
                                <button class="btn btn-block btn-sm" onclick="PhotoEditor.cloudinaryEdit('smart-crop')">
                                    ✨ Smart Crop
                                </button>
                            </div>
                            <p class="text-xs text-gray-500 mt-2">
                                Advanced features require Cloudinary configuration
                            </p>
                        </div>
                    </div>

                    <!-- Canvas Area -->
                    <div class="photo-editor-canvas-container">
                        <canvas id="photo-editor-canvas"></canvas>
                    </div>
                </div>
            </div>
        `;
    }
};
