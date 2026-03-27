// Input Sanitization and Validation Utilities

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes potentially dangerous HTML tags and attributes
 * @param {string} input - The string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeHtml(input) {
    if (!input || typeof input !== 'string') return input;

    // Remove script tags and their content
    let sanitized = input.replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, '').replace(/<script[^>]*>/gi, '');

    // Remove event handlers (onclick, onerror, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

    // Remove dangerous URL protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/vbscript:/gi, '');

    // Remove data: protocol (can be used for XSS in any form)
    sanitized = sanitized.replace(/data:/gi, '');

    // Remove iframe tags
    sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

    // Remove object and embed tags
    sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    sanitized = sanitized.replace(/<embed\b[^<]*>/gi, '');

    sanitized = sanitized.replace(/\x00/g, '');

    return sanitized;
}

/**
 * Validate and sanitize text input
 * @param {string} input - The text to validate
 * @param {Object} options - Validation options
 * @param {number} options.maxLength - Maximum length allowed
 * @param {number} options.minLength - Minimum length required
 * @param {boolean} options.required - Whether field is required
 * @param {string} options.fieldName - Name of field for error messages
 * @returns {Object} { valid: boolean, value: string, error: string }
 */
export function validateText(input, options = {}) {
    const {
        maxLength = 1000,
        minLength = 0,
        required = false,
        fieldName = 'Field'
    } = options;

    // Check if required
    if (required && (!input || input.trim().length === 0)) {
        return {
            valid: false,
            value: null,
            error: `${fieldName} is required`
        };
    }

    // If not required and empty, return null
    if (!input) {
        return { valid: true, value: null, error: null };
    }

    // Convert to string
    const text = String(input);

    // Check length constraints
    if (text.length > maxLength) {
        return {
            valid: false,
            value: null,
            error: `${fieldName} must be ${maxLength} characters or less (currently ${text.length})`
        };
    }

    if (text.length < minLength) {
        return {
            valid: false,
            value: null,
            error: `${fieldName} must be at least ${minLength} characters`
        };
    }

    // Sanitize the text
    const sanitized = sanitizeHtml(text);

    return {
        valid: true,
        value: sanitized,
        error: null
    };
}

/**
 * Validate and sanitize inventory item data
 * @param {Object} data - The inventory item data
 * @param {boolean} isUpdate - Whether this is an update (allows partial data)
 * @returns {Object} { valid: boolean, sanitized: Object, errors: Array }
 */
export function validateInventoryData(data, isUpdate = false) {
    const errors = [];
    const sanitized = {};

    // Title validation
    if (!isUpdate || data.title !== undefined) {
        const titleValidation = validateText(data.title, {
            maxLength: 500,
            minLength: 1,
            required: !isUpdate,
            fieldName: 'Title'
        });

        if (!titleValidation.valid) {
            errors.push(titleValidation.error);
        } else {
            sanitized.title = titleValidation.value;
        }
    }

    // Description validation
    if (data.description !== undefined) {
        const descValidation = validateText(data.description, {
            maxLength: 2000,
            required: false,
            fieldName: 'Description'
        });

        if (!descValidation.valid) {
            errors.push(descValidation.error);
        } else {
            sanitized.description = descValidation.value;
        }
    }

    // Brand validation
    if (data.brand !== undefined) {
        const brandValidation = validateText(data.brand, {
            maxLength: 200,
            required: false,
            fieldName: 'Brand'
        });

        if (!brandValidation.valid) {
            errors.push(brandValidation.error);
        } else {
            sanitized.brand = brandValidation.value;
        }
    }

    // Category validation
    if (data.category !== undefined) {
        const categoryValidation = validateText(data.category, {
            maxLength: 100,
            required: false,
            fieldName: 'Category'
        });

        if (!categoryValidation.valid) {
            errors.push(categoryValidation.error);
        } else {
            sanitized.category = categoryValidation.value;
        }
    }

    // Subcategory validation
    if (data.subcategory !== undefined) {
        const subcategoryValidation = validateText(data.subcategory, {
            maxLength: 100,
            required: false,
            fieldName: 'Subcategory'
        });

        if (!subcategoryValidation.valid) {
            errors.push(subcategoryValidation.error);
        } else {
            sanitized.subcategory = subcategoryValidation.value;
        }
    }

    // Notes validation
    if (data.notes !== undefined) {
        const notesValidation = validateText(data.notes, {
            maxLength: 1000,
            required: false,
            fieldName: 'Notes'
        });

        if (!notesValidation.valid) {
            errors.push(notesValidation.error);
        } else {
            sanitized.notes = notesValidation.value;
        }
    }

    // Location validation
    if (data.location !== undefined) {
        const locationValidation = validateText(data.location, {
            maxLength: 200,
            required: false,
            fieldName: 'Location'
        });

        if (!locationValidation.valid) {
            errors.push(locationValidation.error);
        } else {
            sanitized.location = locationValidation.value;
        }
    }

    // Pass through other non-text fields without sanitization
    const passThrough = [
        'sku', 'size', 'color', 'condition', 'costPrice', 'listPrice',
        'quantity', 'weight', 'dimensions', 'material', 'tags', 'images',
        'thumbnailUrl', 'status', 'customFields', 'purchaseDate', 'supplier'
    ];

    passThrough.forEach(field => {
        if (data[field] !== undefined) {
            sanitized[field] = data[field];
        }
    });

    return {
        valid: errors.length === 0,
        sanitized,
        errors
    };
}

/**
 * Validate price values
 * @param {number} price - The price to validate
 * @param {string} fieldName - Name of the price field
 * @returns {Object} { valid: boolean, error: string }
 */
export function validatePrice(price, fieldName = 'Price') {
    if (price === null || price === undefined) {
        return { valid: true, error: null };
    }

    const numPrice = Number(price);

    if (isNaN(numPrice) || !isFinite(numPrice)) {
        return {
            valid: false,
            error: `${fieldName} must be a valid number`
        };
    }

    if (numPrice < 0) {
        return {
            valid: false,
            error: `${fieldName} must be zero or positive`
        };
    }

    if (numPrice > 1000000) {
        return {
            valid: false,
            error: `${fieldName} must be less than $1,000,000`
        };
    }

    return { valid: true, error: null };
}
