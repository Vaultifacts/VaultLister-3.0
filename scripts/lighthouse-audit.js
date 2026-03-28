#!/usr/bin/env bun
// Lighthouse Performance Audit Script
// Note: Requires Chrome/Chromium to be installed

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║         VaultLister Lighthouse Audit                      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Check if Lighthouse is installed globally
function checkLighthouse() {
    try {
        execSync('lighthouse --version', { stdio: 'ignore' });  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process
        return true;
    } catch {
        return false;
    }
}

// Check if server is running
function checkServer(url) {
    try {
        // Use Node fetch instead of curl for cross-platform compat
        const { execSync: ex } = require('child_process');
        ex(`node -e "fetch('${url}').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"`, { stdio: 'pipe', timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

// Run Lighthouse audit
function runAudit(url) {
    console.log(`🔍 Auditing: ${url}\n`);

    try {
        const outputDir = './lighthouse-reports';
        const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
        const outputFile = `${outputDir}/report-${timestamp}.html`;

        // Create output directory if it doesn't exist
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }

        // Run Lighthouse
        console.log('⏳ Running audit (this may take a minute)...\n');

        const command = `lighthouse ${url} \\
            --output=html \\
            --output-path=${outputFile} \\
            --preset=desktop \\
            --throttling-method=simulate \\
            --quiet`;

        execSync(command, { stdio: 'inherit' });  // nosemgrep: javascript.lang.security.detect-child-process.detect-child-process

        console.log(`\n✅ Audit complete!`);
        console.log(`   Report saved to: ${outputFile}\n`);

        // Try to extract scores from the HTML report
        try {
            const report = Bun.file(outputFile).text();

            // Simple regex to find scores (not perfect but works)
            const performanceMatch = report.match(/"performance":\s*([0-9.]+)/);
            const accessibilityMatch = report.match(/"accessibility":\s*([0-9.]+)/);
            const bestPracticesMatch = report.match(/"best-practices":\s*([0-9.]+)/);
            const seoMatch = report.match(/"seo":\s*([0-9.]+)/);
            const pwaMatch = report.match(/"pwa":\s*([0-9.]+)/);

            if (performanceMatch) {
                console.log('📊 Scores:');
                console.log(`   Performance:     ${Math.round(performanceMatch[1] * 100)}/100`);
                console.log(`   Accessibility:   ${Math.round(accessibilityMatch[1] * 100)}/100`);
                console.log(`   Best Practices:  ${Math.round(bestPracticesMatch[1] * 100)}/100`);
                console.log(`   SEO:             ${Math.round(seoMatch[1] * 100)}/100`);
                console.log(`   PWA:             ${Math.round(pwaMatch[1] * 100)}/100\n`);

                // Check if we meet targets
                const perfScore = Math.round(performanceMatch[1] * 100);
                if (perfScore >= 90) {
                    console.log('✅ Performance target met (>90)');
                } else {
                    console.log(`⚠️  Performance below target: ${perfScore}/90`);
                }
            }
        } catch (error) {
            console.log('⚠️  Could not extract scores from report');
        }

        return true;
    } catch (error) {
        console.error(`❌ Audit failed: ${error.message}`);
        return false;
    }
}

// Main
async function main() {
    const url = process.argv[2] || 'http://localhost:3000';

    // Check if Lighthouse is installed
    if (!checkLighthouse()) {
        console.log('❌ Lighthouse is not installed globally!');
        console.log('   Install it with: npm install -g lighthouse\n');
        console.log('   Or use npx: npx lighthouse ' + url);
        console.log('\n⚠️  Skipping Lighthouse audit (optional for development)\n');
        console.log('   Manual performance testing:');
        console.log('   1. Open Chrome DevTools (F12)');
        console.log('   2. Go to Lighthouse tab');
        console.log('   3. Run audit for Desktop\n');
        return false;
    }

    // Check if server is running
    console.log('🔍 Checking if server is running...');
    if (!checkServer(url)) {
        console.log(`❌ Server is not running at ${url}`);
        console.log('   Start the server first: bun run dev\n');
        return false;
    }

    console.log(`✓ Server is running at ${url}\n`);

    // Run audit
    const success = await runAudit(url);

    return success;
}

main().then(success => {
    process.exit(success ? 0 : 1);
});
