// VaultLister Content Script — Injected on marketplace listing pages
// Adds a floating "Import to VaultLister" button on supported listing pages

(function () {
    'use strict';

    // Avoid duplicate injection
    if (document.getElementById('vl-import-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'vl-import-fab';
    fab.title = 'Import to VaultLister';
    fab.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>VL</span>
    `;

    fab.addEventListener('click', () => {
        // Send message to popup or background to trigger import
        chrome.runtime.sendMessage({ action: 'import_listing' }, (response) => {
            if (response?.success) {
                fab.style.background = '#059669';
                fab.querySelector('span').textContent = 'Done!';
                setTimeout(() => {
                    fab.style.background = '#f59e0b';
                    fab.querySelector('span').textContent = 'VL';
                }, 2000);
            }
        });
    });

    document.body.appendChild(fab);
})();
