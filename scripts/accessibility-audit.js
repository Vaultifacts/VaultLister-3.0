#!/usr/bin/env bun
// VaultLister Accessibility Audit Script
// Checks for WCAG 2.1 compliance issues

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ROOT_DIR = process.cwd();
const FRONTEND_DIR = join(ROOT_DIR, 'src', 'frontend');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
const PUBLIC_DIR = join(ROOT_DIR, 'public');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

// Color contrast ratios (WCAG 2.1 requirements)
const CONTRAST_RATIOS = {
    AA_NORMAL: 4.5,
    AA_LARGE: 3,
    AAA_NORMAL: 7,
    AAA_LARGE: 4.5
};

// Audit results
const results = {
    passed: [],
    warnings: [],
    errors: [],
    suggestions: []
};

// Get all files recursively
function getFiles(dir, extensions = ['.js', '.html', '.css']) {
    const files = [];

    try {
        const items = readdirSync(dir);
        for (const item of items) {
            const fullPath = join(dir, item);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            const stat = statSync(fullPath);

            if (stat.isDirectory() && !item.includes('node_modules')) {
                files.push(...getFiles(fullPath, extensions));
            } else if (extensions.includes(extname(item))) {
                files.push(fullPath);
            }
        }
    } catch (e) {
        // Directory doesn't exist
    }

    return files;
}

// Check for missing alt attributes on images
function checkImageAlt(content, file) {
    const imgRegex = /<img[^>]*>/gi;
    const matches = content.match(imgRegex) || [];

    for (const img of matches) {
        if (!img.includes('alt=')) {
            results.errors.push({
                rule: 'WCAG 1.1.1',
                message: 'Image missing alt attribute',
                file,
                element: img.substring(0, 100)
            });
        } else if (img.match(/alt=["'][\s]*["']/)) {
            results.warnings.push({
                rule: 'WCAG 1.1.1',
                message: 'Image has empty alt attribute - ensure this is intentional (decorative image)',
                file,
                element: img.substring(0, 100)
            });
        }
    }
}

// Check for form labels
function checkFormLabels(content, file) {
    // Check for inputs without labels
    const inputRegex = /<input[^>]*type=["'](?!hidden|submit|button|reset)[^"']*["'][^>]*>/gi;
    const matches = content.match(inputRegex) || [];

    for (const input of matches) {
        const hasId = input.match(/id=["']([^"']+)["']/);
        const hasAriaLabel = input.includes('aria-label') || input.includes('aria-labelledby');

        if (!hasAriaLabel && hasId) {
            const id = hasId[1];
            const labelRegex = new RegExp(`<label[^>]*for=["']${id}["']`, 'i');
            if (!labelRegex.test(content)) {
                results.warnings.push({
                    rule: 'WCAG 1.3.1',
                    message: 'Input may be missing associated label',
                    file,
                    element: input.substring(0, 100)
                });
            }
        } else if (!hasAriaLabel && !hasId) {
            results.errors.push({
                rule: 'WCAG 1.3.1',
                message: 'Input missing both id (for label) and aria-label',
                file,
                element: input.substring(0, 100)
            });
        }
    }
}

// Check for keyboard accessibility
function checkKeyboardAccess(content, file) {
    // Check for click handlers without keyboard equivalent
    const onclickRegex = /onclick=["'][^"']+["']/gi;
    const matches = content.match(onclickRegex) || [];

    for (const onclick of matches) {
        // Check if element is naturally focusable or has tabindex
        const elementMatch = content.match(new RegExp(`<(\\w+)[^>]*${onclick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
        if (elementMatch) {
            const tag = elementMatch[1].toLowerCase();
            const isFocusable = ['a', 'button', 'input', 'select', 'textarea'].includes(tag);

            if (!isFocusable) {
                const hasTabindex = elementMatch[0].includes('tabindex');
                const hasKeyHandler = elementMatch[0].includes('onkeydown') || elementMatch[0].includes('onkeypress') || elementMatch[0].includes('onkeyup');
                const hasRole = elementMatch[0].includes('role=');

                if (!hasTabindex || !hasKeyHandler) {
                    results.warnings.push({
                        rule: 'WCAG 2.1.1',
                        message: `Non-focusable element (${tag}) with onclick may not be keyboard accessible`,
                        file,
                        suggestion: 'Add tabindex="0" and keyboard event handler, or use a button element',
                        element: elementMatch[0].substring(0, 100)
                    });
                }

                if (!hasRole && tag !== 'div' && tag !== 'span') {
                    results.suggestions.push({
                        rule: 'WCAG 4.1.2',
                        message: `Interactive ${tag} element may benefit from explicit role`,
                        file
                    });
                }
            }
        }
    }
}

// Check heading hierarchy
function checkHeadingHierarchy(content, file) {
    const headingRegex = /<h([1-6])[^>]*>/gi;
    const headings = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
        headings.push(parseInt(match[1]));
    }

    for (let i = 1; i < headings.length; i++) {
        if (headings[i] > headings[i - 1] + 1) {
            results.warnings.push({
                rule: 'WCAG 1.3.1',
                message: `Heading level skipped: h${headings[i - 1]} followed by h${headings[i]}`,
                file
            });
        }
    }

    if (headings.length > 0 && headings[0] !== 1) {
        results.warnings.push({
            rule: 'WCAG 1.3.1',
            message: `Page should start with h1, found h${headings[0]}`,
            file
        });
    }
}

// Check for sufficient color contrast in CSS
function checkColorContrast(content, file) {
    // Check for potentially problematic color combinations
    const colorRegex = /color:\s*(#[0-9a-fA-F]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi;
    const bgColorRegex = /background(?:-color)?:\s*(#[0-9a-fA-F]{3,6}|rgb[a]?\([^)]+\)|[a-z]+)/gi;

    const lightColors = ['#fff', '#ffffff', 'white', '#f0f0f0', '#fafafa', '#f5f5f5'];
    const darkColors = ['#000', '#000000', 'black', '#333', '#333333', '#1a1a1a'];

    // Simple heuristic check for very light text on light background
    let prevBg = null;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();

        const bgMatch = line.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,6}|[a-z]+)/i);
        if (bgMatch) {
            prevBg = bgMatch[1];
        }

        const colorMatch = line.match(/(?:^|\s)color:\s*(#[0-9a-fA-F]{3,6}|[a-z]+)/i);
        if (colorMatch && prevBg) {
            const textColor = colorMatch[1];

            // Very basic check - light on light or dark on dark
            if (lightColors.includes(textColor) && lightColors.includes(prevBg)) {
                results.warnings.push({
                    rule: 'WCAG 1.4.3',
                    message: `Potentially low contrast: ${textColor} text on ${prevBg} background`,
                    file,
                    line: i + 1
                });
            }
        }
    }
}

// Check for focus indicators
function checkFocusIndicators(content, file) {
    if (content.includes('outline: none') || content.includes('outline:none') ||
        content.includes('outline: 0') || content.includes('outline:0')) {

        // Check if there's a replacement focus style
        if (!content.includes(':focus') || !content.match(/:focus[^{]*\{[^}]*(box-shadow|border|outline|background)/)) {
            results.errors.push({
                rule: 'WCAG 2.4.7',
                message: 'Focus indicator removed without visible replacement',
                file,
                suggestion: 'Ensure all focusable elements have a visible focus indicator'
            });
        }
    }
}

// Check for ARIA usage
function checkAriaUsage(content, file) {
    // Check for invalid ARIA attributes
    const ariaRegex = /aria-[a-z]+=/gi;
    const validAriaAttrs = [
        'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-hidden',
        'aria-expanded', 'aria-selected', 'aria-checked', 'aria-disabled',
        'aria-live', 'aria-atomic', 'aria-relevant', 'aria-busy',
        'aria-controls', 'aria-haspopup', 'aria-pressed', 'aria-current',
        'aria-invalid', 'aria-required', 'aria-readonly', 'aria-placeholder',
        'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext',
        'aria-modal', 'aria-orientation', 'aria-owns', 'aria-roledescription'
    ];

    const matches = content.match(ariaRegex) || [];
    for (const attr of matches) {
        const attrName = attr.slice(0, -1).toLowerCase();
        if (!validAriaAttrs.includes(attrName)) {
            results.warnings.push({
                rule: 'WCAG 4.1.2',
                message: `Unknown or misspelled ARIA attribute: ${attrName}`,
                file
            });
        }
    }

    // Check for aria-hidden on focusable elements
    if (content.includes('aria-hidden="true"')) {
        const hiddenWithFocusable = content.match(/aria-hidden="true"[^>]*(?:tabindex|href|onclick)/gi);
        if (hiddenWithFocusable) {
            results.errors.push({
                rule: 'WCAG 4.1.2',
                message: 'aria-hidden="true" used on potentially focusable element',
                file
            });
        }
    }
}

// Check for language attribute
function checkLanguage(content, file) {
    if (file.endsWith('.html') && content.includes('<html')) {
        if (!content.match(/<html[^>]*lang=/i)) {
            results.errors.push({
                rule: 'WCAG 3.1.1',
                message: 'HTML element missing lang attribute',
                file
            });
        }
    }
}

// Check for link text
function checkLinkText(content, file) {
    const linkRegex = /<a[^>]*>([^<]*)<\/a>/gi;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
        const linkText = match[1].trim().toLowerCase();
        const vagueLinkText = ['click here', 'here', 'read more', 'learn more', 'more', 'link'];

        if (vagueLinkText.includes(linkText)) {
            results.warnings.push({
                rule: 'WCAG 2.4.4',
                message: `Vague link text: "${match[1].trim()}"`,
                file,
                suggestion: 'Use descriptive link text that makes sense out of context'
            });
        }

        if (linkText === '') {
            const hasAriaLabel = match[0].includes('aria-label');
            const hasTitle = match[0].includes('title=');
            const hasImg = match[0].includes('<img');

            if (!hasAriaLabel && !hasTitle && !hasImg) {
                results.errors.push({
                    rule: 'WCAG 2.4.4',
                    message: 'Empty link without accessible name',
                    file,
                    element: match[0].substring(0, 100)
                });
            }
        }
    }
}

// Run audit
async function runAudit() {
    console.log('VaultLister Accessibility Audit');
    console.log('================================');
    console.log('Checking for WCAG 2.1 compliance...\n');

    // Get all files
    const jsFiles = getFiles(FRONTEND_DIR, ['.js']);
    const htmlFiles = [...getFiles(PUBLIC_DIR, ['.html']), ...getFiles(FRONTEND_DIR, ['.html'])];
    const cssFiles = [...getFiles(PUBLIC_DIR, ['.css']), ...getFiles(FRONTEND_DIR, ['.css'])];

    console.log(`Found ${jsFiles.length} JS files, ${htmlFiles.length} HTML files, ${cssFiles.length} CSS files\n`);

    // Audit JS files (for inline HTML/JSX)
    for (const file of jsFiles) {
        const content = readFileSync(file, 'utf-8');
        checkImageAlt(content, file);
        checkFormLabels(content, file);
        checkKeyboardAccess(content, file);
        checkAriaUsage(content, file);
        checkLinkText(content, file);
    }

    // Audit HTML files
    for (const file of htmlFiles) {
        const content = readFileSync(file, 'utf-8');
        checkImageAlt(content, file);
        checkFormLabels(content, file);
        checkHeadingHierarchy(content, file);
        checkKeyboardAccess(content, file);
        checkAriaUsage(content, file);
        checkLanguage(content, file);
        checkLinkText(content, file);
    }

    // Audit CSS files
    for (const file of cssFiles) {
        const content = readFileSync(file, 'utf-8');
        checkColorContrast(content, file);
        checkFocusIndicators(content, file);
    }

    // Print results
    console.log('Results');
    console.log('-------\n');

    if (results.errors.length > 0) {
        console.log(`❌ ERRORS (${results.errors.length}):`);
        for (const error of results.errors) {
            console.log(`  [${error.rule}] ${error.message}`);
            console.log(`    File: ${error.file}`);
            if (error.element) console.log(`    Element: ${error.element}`);
            if (error.suggestion) console.log(`    Suggestion: ${error.suggestion}`);
            console.log('');
        }
    }

    if (results.warnings.length > 0) {
        console.log(`⚠️  WARNINGS (${results.warnings.length}):`);
        for (const warning of results.warnings.slice(0, 20)) { // Limit to first 20
            console.log(`  [${warning.rule}] ${warning.message}`);
            console.log(`    File: ${warning.file}`);
            if (warning.suggestion) console.log(`    Suggestion: ${warning.suggestion}`);
            console.log('');
        }
        if (results.warnings.length > 20) {
            console.log(`  ... and ${results.warnings.length - 20} more warnings\n`);
        }
    }

    if (results.suggestions.length > 0) {
        console.log(`💡 SUGGESTIONS (${results.suggestions.length}):`);
        for (const suggestion of results.suggestions.slice(0, 10)) {
            console.log(`  [${suggestion.rule}] ${suggestion.message}`);
            console.log(`    File: ${suggestion.file}`);
            console.log('');
        }
    }

    // Summary
    console.log('\nSummary');
    console.log('-------');
    console.log(`Errors:      ${results.errors.length}`);
    console.log(`Warnings:    ${results.warnings.length}`);
    console.log(`Suggestions: ${results.suggestions.length}`);

    // Grade
    const score = Math.max(0, 100 - (results.errors.length * 10) - (results.warnings.length * 2));
    let grade;
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else grade = 'F';

    console.log(`\nAccessibility Score: ${score}/100 (Grade: ${grade})`);

    if (results.errors.length > 0) {
        console.log('\n⚠️  Fix errors before deploying to production!');
        process.exit(1);
    }

    console.log('\n✅ Audit complete!');
}

runAudit().catch(console.error);
