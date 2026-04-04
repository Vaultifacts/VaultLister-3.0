'use strict';
// UI components: sidebar, header, vaultBuddy, photoEditorModal
// Extracted from app.js lines 15284-17255

// ============================================
// Components
// ============================================
const components = {
    // Icon component
    icon(name, size = 20) {
        const icons = {
            dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
            inventory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
            list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
            crosslist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
            automation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
            offers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
            sales: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
            analytics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
            shops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
            user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
            search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
            plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
            leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
            community: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
            edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
            trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
            filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
            share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
            upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
            dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
            check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
            image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
            notification: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
            calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
            'chevron-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
            'chevron-right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
            import: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            'more-vertical': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
            archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
            eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
            'alert-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
            'external-link': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
            package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
            refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
            tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
            'wifi-off': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
            mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
            columns: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>',
            clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            'trending-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
            target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
            'chevron-left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>',
            'chevron-right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
            'chevron-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>',
            moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
            sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
            maximize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
            layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
            copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
            'external-link': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
            eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
            pause: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
            'play-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
            'pause-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>',
            circle: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"/></svg>',
            'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            'bar-chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>',
            grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
            zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            'edit-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
            gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
            box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
            'trash-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
            folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            'folder-plus': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
            'upload-cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>',
            wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/><path d="M11 6.2L9.8 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2L11 5"/></svg>',
            'dollar-sign': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
            calculator: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="8" y1="18" x2="8" y2="18.01"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>',
            percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
            'corner-up-right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>',
            'map-pin': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
            'refresh-cw': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
            'alert-triangle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
            lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>',
            'x-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            'trending-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
            'pie-chart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
            'bar-chart-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
            award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
            repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
            users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
            'arrow-right': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
            'arrow-left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
            'arrow-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
            star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
            heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
            lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
            globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
            link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
            send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
            save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
            inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
            truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
            printer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
            'credit-card': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
            shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
            flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
            info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            'file-text': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
            file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
            'message-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
            'message-square': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
            sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>',
            'log-out': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
            logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
            'help-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            'shopping-cart': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
            'shopping-bag': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
            map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
            database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
            trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
            bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
            'eye-off': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
            scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
            'check-square': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
            'minus-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
            'rotate-ccw': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
            'more-horizontal': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
            'share-2': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
            history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>',
            'thumbs-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
            palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
            shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
            code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
            book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
            loader: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>',
            'git-branch': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>',
            cpu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
            smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
            ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
            'zoom-in': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
            'zoom-out': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>'
        };
        const svg = icons[name] || '';
        const sized = svg ? svg.replace('<svg ', `<svg width="${size}" height="${size}" `) : '';
        return `<span class="icon" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${sized}</span>`;
    },

    // Sidebar component
    sidebar() {
        const { currentPage, user } = store.state;

        // Calculate low stock count for inventory badge
        const lowStockCount = (store.state.inventory || []).filter(item => {
            const qty = item.quantity != null ? item.quantity : 1;
            const threshold = item.low_stock_threshold || 5;
            return qty <= threshold && qty > 0;
        }).length;

        // Calculate out of stock count for inventory badge
        const outOfStockCount = (store.state.inventory || []).filter(item => {
            const qty = item.quantity != null ? item.quantity : 1;
            return Number(qty) === 0;
        }).length;

        // Total inventory alerts (low stock + out of stock)
        const inventoryAlerts = lowStockCount + outOfStockCount;

        // Calculate unseen orders for badge
        const unseenOrders = (store.state.orders || []).filter(o => o.status === 'pending' && !o.seen).length;

        // Calculate active checklist items for badge
        const activeChecklistItems = (store.state.checklistItems || []).filter(item => !item.completed).length;

        // Calculate draft listings for badge (listings not yet published to any platform)
        const draftListings = (store.state.listings || []).filter(l => l.status === 'draft').length;

        const navItems = [
            { section: '', items: [
                { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
            ]},
            { section: 'Sell', items: [
                { id: 'inventory', label: 'Inventory', icon: 'inventory', badge: inventoryAlerts > 0 ? inventoryAlerts : null, badgeType: 'warning' },
                { id: 'listings', label: 'Listings', icon: 'list', badge: draftListings > 0 ? draftListings : null, badgeType: 'info' },
                { id: 'orders-sales', label: 'Orders & Sales', icon: 'sales', badge: unseenOrders > 0 ? unseenOrders : null, badgeType: 'primary' },
                { id: 'offers', label: 'Offers', icon: 'offers', badge: store.state.offers.filter(o => o.status === 'pending').length || null }
            ]},
            { section: 'Manage', items: [
                { id: 'automations', label: 'Automations', icon: 'automation' },
                { id: 'financials', label: 'Financials', icon: 'dollar' },
                { id: 'analytics', label: 'Analytics', icon: 'analytics' },
                { id: 'shops', label: 'My Shops', icon: 'shops' },
                { id: 'planner', label: 'Planner', icon: 'calendar', badge: activeChecklistItems > 0 ? activeChecklistItems : null, badgeType: 'info' },
                { id: 'image-bank', label: 'Image Bank', icon: 'image' },
                { id: 'calendar', label: 'Calendar', icon: 'calendar' },
                { id: 'reports', label: 'Reports', icon: 'list' },
                { id: 'inventory-import', label: 'Import', icon: 'inventory' },
                { id: 'receipt-parser', label: 'Receipts', icon: 'dollar' },
                { id: 'community', label: 'Community', icon: 'help' },
                { id: 'roadmap', label: 'Roadmap', icon: 'list' }
            ]},
            { section: '', divider: true, items: [
                { id: 'plans-billing', label: 'Plans & Billing', icon: 'dollar' },
                { id: 'account', label: 'Account', icon: 'settings' },
                { id: 'settings', label: 'Settings', icon: 'settings' },
                { id: 'help-support', label: 'Help', icon: 'help' },
                { id: 'changelog', label: 'Changelog', icon: 'list' },
                ...(store.state.user?.is_admin ? [{ id: 'admin-metrics', label: 'Admin', icon: 'shield' }] : [])
            ]}
        ];

        // Get connected shops for quick-switch
        const shops = store.state.shops || [];
        const connectedShops = shops.filter(s => s.is_connected);
        const activeShopId = store.state.activeShopId;
        const activeShop = connectedShops.find(s => s.id === activeShopId);

        return `
            <aside class="sidebar ${store.state.sidebarCollapsed ? 'sidebar-collapsed' : ''} ${store.state.sidebarOpen ? 'open' : ''}" aria-label="Primary navigation">
                <div class="sidebar-header">
                    <div class="sidebar-logo">V</div>
                    <span class="sidebar-title">VaultLister</span>
                </div>
                ${connectedShops.length > 0 ? `
                    <div class="shop-quick-switch">
                        <div class="shop-switch-dropdown dropdown">
                            <button class="shop-switch-btn" title="Switch Shop" aria-haspopup="listbox" aria-expanded="false" onclick="event.stopPropagation(); const _dd=this.closest('.shop-switch-dropdown'); const _open=_dd.classList.toggle('open'); _dd.setAttribute('aria-expanded',_open); this.setAttribute('aria-expanded',_open);" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();const _dd=this.closest('.shop-switch-dropdown');const _open=_dd.classList.toggle('open');_dd.setAttribute('aria-expanded',_open);this.setAttribute('aria-expanded',_open);}">
                                <div class="shop-switch-current">
                                    ${activeShop ? `
                                        <span class="shop-switch-platform" style="background: ${this.getPlatformColor(activeShop.platform)}">${activeShop.platform.charAt(0).toUpperCase()}</span>
                                        <span class="shop-switch-name">${activeShop.username || activeShop.platform}</span>
                                    ` : `
                                        <span class="shop-switch-all">${this.icon('layers', 14)}</span>
                                        <span class="shop-switch-name">All Shops</span>
                                    `}
                                </div>
                                ${this.icon('chevron-down', 14)}
                            </button>
                            <div class="shop-switch-menu dropdown-menu">
                                <button class="shop-switch-item ${!activeShopId ? 'active' : ''}" onclick="handlers.switchShop(null)">
                                    <span class="shop-switch-all">${this.icon('layers', 14)}</span>
                                    <span>All Shops</span>
                                    ${!activeShopId ? this.icon('check', 14) : ''}
                                </button>
                                <div class="shop-switch-divider"></div>
                                ${connectedShops.map(shop => `
                                    <button class="shop-switch-item ${activeShopId === shop.id ? 'active' : ''}" onclick="handlers.switchShop('${escapeHtml(shop.id)}')">
                                        <span class="shop-switch-platform" style="background: ${this.getPlatformColor(shop.platform)}">${shop.platform.charAt(0).toUpperCase()}</span>
                                        <span>${shop.username || shop.platform}</span>
                                        ${activeShopId === shop.id ? this.icon('check', 14) : ''}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                ` : ''}
                <nav class="sidebar-nav" role="navigation" aria-label="Main navigation">
                    ${navItems.map(section => `
                        <div class="nav-section${section.divider ? ' nav-section-bottom' : ''}">
                            ${section.divider ? '<div class="nav-section-divider"></div>' : section.section ? `<div class="nav-section-title">${section.section}</div>` : ''}
                            ${section.items.map(item => `
                                <button class="nav-item ${currentPage === item.id ? 'active' : ''}"
                                        onclick="router.navigate('${item.id}')"
                                        title="${item.label}"
                                        data-testid="nav-${item.id}"
                                        ${currentPage === item.id ? 'aria-current="page"' : ''}>
                                    ${this.icon(item.icon)}
                                    <span>${item.label}</span>
                                    ${item.badge ? `<span class="nav-item-badge ${item.badgeType ? 'nav-item-badge-' + item.badgeType : ''}">${item.badge}</span>` : ''}
                                </button>
                            `).join('')}
                        </div>
                    `).join('')}
                </nav>
                <div class="sidebar-footer">
                    ${store.getPlanTier() === 'free' ? `<a href="#plans-billing" class="sidebar-upgrade-cta" style="display:block;padding:8px 12px;margin:8px 12px;background:var(--primary);color:white;border-radius:6px;text-align:center;text-decoration:none;font-size:13px;font-weight:500;">Upgrade to Pro</a>` : ''}
                    <div class="user-info flex items-center gap-3">
                        <div class="user-avatar">${user?.username?.[0]?.toUpperCase() || 'U'}</div>
                        <div>
                            <div class="font-medium text-sm">${user?.username || 'Guest'}</div>
                            <div class="text-xs text-gray-500">${store.getPlanTier().charAt(0).toUpperCase() + store.getPlanTier().slice(1)} Plan</div>
                        </div>
                    </div>
                    <button class="sidebar-logout-btn" onclick="auth.logout()" aria-label="Logout" data-testid="sidebar-logout-btn">
                        ${this.icon('logout', 16)}
                        <span class="sidebar-logout-label">Logout</span>
                    </button>
                    <button class="sidebar-collapse-btn" onclick="handlers.toggleSidebarCollapse()"
                            title="${store.state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
                            aria-label="${store.state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}" data-testid="sidebar-collapse-btn">
                        ${store.state.sidebarCollapsed ? '→' : '←'}
                    </button>
                </div>
            </aside>
        `;
    },

    // Header component
    header() {
        return `
            <header class="header">
                <div class="header-left">
                    <button class="menu-button" onclick="const _open=!store.state.sidebarOpen;store.setState({sidebarOpen:_open});document.querySelector('.sidebar')?.classList.toggle('open',_open);document.querySelector('.sidebar-backdrop')?.classList.toggle('active',_open);" aria-label="Toggle sidebar menu">
                        ${this.icon('menu')}
                    </button>
                    <div class="search-bar">
                        ${this.icon('search', 18)}
                        <input type="text" placeholder="Search inventory, listings..." id="global-search" aria-label="Search inventory, listings">
                    </div>
                </div>
                <div class="header-right">
                    <button class="header-icon-btn" onclick="focusMode.toggle()" title="Focus Mode" aria-label="Toggle focus mode">
                        ${this.icon('maximize', 18)}
                    </button>
                    <button class="header-icon-btn" onclick="handlers.showKeyboardShortcuts()" title="Keyboard Shortcuts (?)" aria-label="Keyboard shortcuts">
                        ${this.icon('help')}
                    </button>
                    <div class="notifications-dropdown dropdown">
                        <button class="header-icon-btn" aria-label="Notifications" aria-haspopup="listbox" aria-expanded="false" onclick="event.stopPropagation(); const _dd=this.closest('.notifications-dropdown'); const _open=_dd.classList.toggle('open'); _dd.setAttribute('aria-expanded',_open); this.setAttribute('aria-expanded',_open);" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();const _dd=this.closest('.notifications-dropdown');const _open=_dd.classList.toggle('open');_dd.setAttribute('aria-expanded',_open);this.setAttribute('aria-expanded',_open);}">
                            ${this.icon('bell')}
                            <span id="notification-badge" class="badge" style="${(typeof notificationCenter !== 'undefined' ? notificationCenter.unreadCount : store.state.notifications.length) > 0 ? 'display:flex' : 'display:none'}">${(typeof notificationCenter !== 'undefined' ? notificationCenter.unreadCount : store.state.notifications.length) || ''}</span>
                        </button>
                        <div class="dropdown-menu" style="min-width: 320px; max-width: 400px; right: 0;">
                            <div style="padding: 12px 16px; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center;">
                                <h3 style="margin: 0; font-size: 16px; font-weight: 600;">Notifications</h3>
                                ${store.state.notifications.length > 0 ? `<span class="text-xs text-gray-500">${store.state.notifications.length} new</span>` : ''}
                            </div>
                            ${store.state.notifications.length === 0 ? `
                                <div style="padding: 24px; text-align: center; color: var(--gray-500);">
                                    <div style="margin-bottom: 8px;">${this.icon('bell', 32)}</div>
                                    <div class="text-sm">No new notifications</div>
                                </div>
                            ` : store.state.notifications.slice(0, 7).map(notif => `
                                <button class="dropdown-item" onclick="event.stopPropagation(); handlers.viewNotification('${notif.id}')" style="display: block; padding: 12px 16px; border-bottom: 1px solid var(--gray-100);">
                                    <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">${escapeHtml(notif.title)}</div>
                                    <div style="font-size: 12px; color: var(--gray-600); margin-bottom: 4px;">${escapeHtml(notif.message)}</div>
                                    <div style="font-size: 11px; color: var(--gray-500);">${notif.time || 'Just now'}</div>
                                </button>
                            `).join('')}
                            <div class="dropdown-divider" style="margin: 0;"></div>
                            <button class="dropdown-item" onclick="event.stopPropagation(); document.querySelector('.notifications-dropdown')?.classList.remove('open'); router.navigate('notifications')" style="justify-content: center; font-weight: 600; color: var(--primary-600);">
                                All Notifications
                            </button>
                        </div>
                    </div>
                    <div class="user-menu dropdown" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false" aria-label="User menu" onclick="const _open=this.classList.toggle('open'); this.setAttribute('aria-expanded',_open);" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();const _open=this.classList.toggle('open');this.setAttribute('aria-expanded',_open);}">
                        <div class="user-avatar" aria-hidden="true">${store.state.user?.username?.[0]?.toUpperCase() || 'U'}</div>
                        <div class="dropdown-menu">
                            <button class="dropdown-item" onclick="router.navigate('account')" aria-label="Account">
                                ${this.icon('user', 16)} Account
                            </button>
                            <button class="dropdown-item" onclick="router.navigate('settings')" aria-label="Settings">
                                ${this.icon('settings', 16)} Settings
                            </button>
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-item" onclick="auth.logout()" aria-label="Logout" data-testid="sidebar-logout-btn">
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    // Vault Buddy floating chat button and modal
    vaultBuddy() {
        const isOpen = store.state.vaultBuddyOpen || false;
        const activeTab = store.state.vaultBuddyTab || 'home';
        const conversations = store.state.vaultBuddyConversations || [];
        const currentConversation = store.state.vaultBuddyCurrentConversation;
        const messages = store.state.vaultBuddyMessages || [];
        const isLoading = store.state.vaultBuddyLoading || false;

        // Format time for display
        const formatTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            const now = new Date();
            const normalizeToMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
            const diffDays = Math.floor((normalizeToMidnight(now) - normalizeToMidnight(date)) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;
            return date.toLocaleDateString();
        };

        const formatMessageTime = (dateStr) => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '';
            const now = new Date();
            const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isToday = date.toDateString() === now.toDateString();
            if (isToday) return time;
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            if (date.toDateString() === yesterday.toDateString()) return 'Yesterday ' + time;
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
        };

        // Format chat message with markdown-like support
        const formatChatMessage = (content) => {
            if (!content) return '';
            let formatted = escapeHtml(content);
            // Convert newlines to br
            formatted = formatted.replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
            // Convert bullet points (lines starting with - or *)
            formatted = formatted.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
            // Wrap consecutive li elements in ul
            formatted = formatted.replace(/(<li>.*?<\/li>)(<br>)?(<li>)/g, '$1$3');
            formatted = formatted.replace(/(<li>.*?<\/li>)+/g, '<ul style="margin: 8px 0; padding-left: 20px;">$&</ul>');
            // Convert numbered lists (1. 2. etc)
            formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
            // Bold text **text**
            formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            // Italic text *text*
            formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
            // Code `text`
            formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: var(--gray-100); padding: 2px 4px; border-radius: 3px;">$1</code>');
            return formatted;
        };

        // Render messages
        const renderMessages = () => {
            if (messages.length === 0) {
                return '<div class="vault-buddy-no-chats">No messages yet. Start the conversation!</div>';
            }
            return messages.map(msg => {
                const quickActionsHtml = msg.metadata?.quickActions?.length > 0 ? `
                    <div class="vault-buddy-quick-actions">
                        ${msg.metadata.quickActions.map(action => `
                            <button class="vault-buddy-quick-action"
                                    onclick="${action.route ? 'router.navigate(\'' + escapeHtml(action.route) + '\'); handlers.toggleVaultBuddy()' : escapeHtml(action.action || '')}">
                                ${escapeHtml(action.label)}
                            </button>
                        `).join('')}
                    </div>
                ` : '';
                return `
                    <div class="vault-buddy-message ${msg.role}">
                        <div class="vault-buddy-message-content">${formatChatMessage(msg.content)}</div>
                        ${msg.role === 'assistant' ? quickActionsHtml : ''}
                        <div class="vault-buddy-message-time">${formatMessageTime(msg.created_at)}</div>
                    </div>
                `;
            }).join('');
        };

        // Render chat list
        const renderChatList = () => {
            if (conversations.length === 0) {
                return `
                    <div class="vault-buddy-no-chats">
                        <p>No conversations yet.</p>
                        <button class="vault-buddy-start-btn" onclick="handlers.startNewVaultBuddyChat()">
                            Start Your First Chat
                        </button>
                    </div>
                `;
            }
            return conversations.map(conv => `
                <div class="vault-buddy-chat-item" style="position: relative;">
                    <div role="button" tabindex="0" onclick="handlers.openVaultBuddyConversation('${escapeHtml(conv.id)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();handlers.openVaultBuddyConversation('${escapeHtml(conv.id)}');}" style="cursor: pointer;" aria-label="Open conversation: ${escapeHtml(conv.title || 'New Chat')}">
                        <h5>${escapeHtml(conv.title || 'New Chat')}</h5>
                        <p>${escapeHtml(conv.last_message || 'No messages yet')}</p>
                        <div class="vault-buddy-chat-item-time">${formatTime(conv.updated_at || conv.created_at)}</div>
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); handlers.deleteVaultBuddyChat('${escapeHtml(conv.id)}')" title="Delete chat" style="position: absolute; top: 8px; right: 8px; padding: 2px 6px;">
                        ${components.icon('trash', 14)}
                    </button>
                </div>
            `).join('');
        };

        return `
            <!-- Vault Buddy Floating Button -->
            <button class="vault-buddy-fab" onclick="handlers.toggleVaultBuddy()" title="Chat with Vault Buddy">
                <div class="buddy-avatar">🤖</div>
            </button>

            <!-- Vault Buddy Chat Modal -->
            <div class="vault-buddy-modal ${isOpen ? 'open' : ''}">
                <!-- Header -->
                <div class="vault-buddy-header">
                    <div class="vault-buddy-header-left">
                        <div class="vault-buddy-header-avatar">🤖</div>
                        <div class="vault-buddy-header-info">
                            <h3>Vault Buddy</h3>
                            <span>Your VaultLister Assistant</span>
                        </div>
                    </div>
                    <button class="vault-buddy-close" aria-label="Close Vault Buddy" onclick="handlers.toggleVaultBuddy()">
                        ${this.icon('close', 18)}
                    </button>
                </div>

                ${currentConversation ? `
                    <!-- Active Chat View -->
                    <div class="vault-buddy-chat-view active">
                        <button class="vault-buddy-chat-back" onclick="handlers.backToVaultBuddyList()">
                            ← Back to chats
                        </button>
                        <div class="vault-buddy-messages" id="vault-buddy-messages">
                            ${renderMessages()}
                            ${isLoading ? `
                                <div class="vault-buddy-typing">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            ` : ''}
                        </div>
                        <div class="vault-buddy-input">
                            <input type="text"
                                   id="vault-buddy-input"
                                   placeholder="Type a message..."
                                   aria-label="Message input"
                                   onkeypress="if(event.key==='Enter')handlers.sendVaultBuddyMessage()">
                            <button aria-label="Send message" onclick="handlers.sendVaultBuddyMessage()">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="22" y1="2" x2="11" y2="13"></line>
                                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                                </svg>
                            </button>
                        </div>
                    </div>
                ` : `
                    <!-- Tab Navigation -->
                    <div class="vault-buddy-tabs">
                        <button class="vault-buddy-tab ${activeTab === 'home' ? 'active' : ''}"
                                onclick="handlers.switchVaultBuddyTab('home')">
                            ➕ Start New Chat
                        </button>
                        <button class="vault-buddy-tab ${activeTab === 'chats' ? 'active' : ''}"
                                onclick="handlers.switchVaultBuddyTab('chats')">
                            💬 My Chats
                        </button>
                    </div>

                    <!-- Tab Content -->
                    <div class="vault-buddy-content">
                        <!-- Home Tab -->
                        <div class="vault-buddy-tab-content ${activeTab === 'home' ? 'active' : ''}">
                            <div class="vault-buddy-home">
                                <div class="vault-buddy-home-icon">🤖</div>
                                <h4>Hi, I'm Vault Buddy!</h4>
                                <p>I'm here to help you with VaultLister. Here's what I can help with:</p>
                                <ul style="text-align: left; margin: 12px auto; max-width: 280px; list-style: disc; padding-left: 20px; line-height: 1.8;">
                                    <li>Inventory management &amp; tracking</li>
                                    <li>Cross-listing across platforms</li>
                                    <li>Automations &amp; scheduling</li>
                                    <li>Analytics &amp; sales insights</li>
                                    <li>Pricing strategies &amp; tips</li>
                                    <li>Shipping &amp; order help</li>
                                </ul>
                                <button class="vault-buddy-start-btn" onclick="handlers.startNewVaultBuddyChat()">
                                    Start New Chat
                                </button>
                            </div>
                        </div>

                        <!-- My Chats Tab -->
                        <div class="vault-buddy-tab-content ${activeTab === 'chats' ? 'active' : ''}">
                            <div class="vault-buddy-chats">
                                ${renderChatList()}
                            </div>
                        </div>
                    </div>
                `}
            </div>
        `;
    },

    // Stat card component with optional sparkline
    statCard(title, value, icon, change = null, color = 'primary', sparklineData = null, dataType = null) {
        const sparkline = sparklineData ? `<div class="sparkline-clickable" role="button" tabindex="0" onclick="event.stopPropagation(); handlers.expandSparkline('${dataType || title.toLowerCase()}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();handlers.expandSparkline('${dataType || title.toLowerCase()}');}" title="Click to expand chart" aria-label="Expand ${escapeHtml(title)} chart" style="cursor: pointer;">${this.sparkline(sparklineData, color)}</div>` : '';
        const periodLabel = store.state.comparisonPeriod === 'month' ? 'vs last month' : store.state.comparisonPeriod === 'year' ? 'vs last year' : 'vs last week';
        return `
            <div class="stat-card">
                <div class="stat-card-header">
                    <span class="stat-card-title">${title}</span>
                    <div style="display:flex;align-items:center;gap:4px;">
                        ${dataType ? `<button class="btn btn-ghost btn-xs stat-chart-btn" onclick="event.stopPropagation();handlers.expandSparkline('${escapeHtml(dataType)}')" title="View chart" aria-label="View ${escapeHtml(title)} chart" style="padding:2px 4px;">${this.icon('bar-chart-2', 14)}</button>` : ''}
                        <div class="stat-card-icon" style="background: var(--${color}-100); color: var(--${color}-600)">
                            ${this.icon(icon)}
                        </div>
                    </div>
                </div>
                <div class="stat-card-value-row">
                    <div class="stat-card-value" data-countup="${value}">${value}</div>
                    ${sparkline}
                </div>
                ${change !== null ? `
                    <div class="stat-card-change ${change >= 0 ? 'positive' : 'negative'}">
                        ${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}%
                        <span class="text-gray-500">${periodLabel}</span>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Sparkline chart component (SVG-based)
    sparkline(data, color = 'primary', width = 80, height = 24) {
        if (!data || data.length < 2) return '';
        const max = Math.max(...data);
        const min = Math.min(...data);
        const range = max - min || 1;
        const points = data.map((val, i) => {
            const x = (i / Math.max(data.length - 1, 1)) * width;
            const y = height - ((val - min) / range) * height;
            return `${x},${y}`;
        }).join(' ');

        return `
            <div class="sparkline" title="Trend: ${data[0]} → ${data[data.length - 1]}">
                <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                    <polyline
                        fill="none"
                        stroke="var(--${color}-500)"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        points="${points}"
                    />
                    <circle cx="${width}" cy="${height - ((data[data.length - 1] - min) / range) * height}" r="3" fill="var(--${color}-500)"/>
                </svg>
            </div>
        `;
    },

    // Progress ring component
    progressRing(percent, size = 60, strokeWidth = 6, color = 'primary', label = '') {
        const radius = (size - strokeWidth) / 2;
        const circumference = radius * 2 * Math.PI;
        const offset = circumference - (percent / 100) * circumference;

        return `
            <div class="progress-ring-container" style="width: ${size}px; height: ${size}px;">
                <svg class="progress-ring" width="${size}" height="${size}">
                    <circle
                        class="progress-ring-bg"
                        stroke="var(--gray-200)"
                        stroke-width="${strokeWidth}"
                        fill="transparent"
                        r="${radius}"
                        cx="${size / 2}"
                        cy="${size / 2}"
                    />
                    <circle
                        class="progress-ring-progress"
                        stroke="var(--${color}-500)"
                        stroke-width="${strokeWidth}"
                        stroke-linecap="round"
                        fill="transparent"
                        r="${radius}"
                        cx="${size / 2}"
                        cy="${size / 2}"
                        style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; transform: rotate(-90deg); transform-origin: center;"
                    />
                </svg>
                <div class="progress-ring-label">
                    <span class="progress-ring-percent">${Math.round(percent)}%</span>
                    ${label ? `<span class="progress-ring-text">${label}</span>` : ''}
                </div>
            </div>
        `;
    },

    // Progress bar with label
    progressBar(percent, label = '', color = 'primary', showPercent = true) {
        return `
            <div class="progress-bar-container">
                ${label ? `<div class="progress-bar-header"><span class="progress-bar-label">${escapeHtml(label)}</span>${showPercent ? `<span class="progress-bar-percent">${Math.round(percent)}%</span>` : ''}</div>` : ''}
                <div class="progress-bar-track">
                    <div class="progress-bar-fill" style="width: ${Math.min(100, percent)}%; background: var(--${color}-500);"></div>
                </div>
            </div>
        `;
    },

    // Breadcrumb navigation component
    breadcrumb(currentPage) {
        function humanizeSlug(slug) {
            return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
        const pageInfo = {
            'dashboard': { label: 'Dashboard', section: 'Sell' },
            'inventory': { label: 'Inventory', section: 'Sell' },
            'listings': { label: 'Listings', section: 'Sell' },
            'orders': { label: 'Orders', section: 'Sell' },
            'orders-sales': { label: 'Orders & Sales', section: 'Sell' },
            'offers': { label: 'Offers', section: 'Sell' },
            'automations': { label: 'Automations', section: 'Manage' },
            'checklist': { label: 'Checklist', section: 'Manage' },
            'planner': { label: 'Planner', section: 'Manage' },
            'image-bank': { label: 'Image Bank', section: 'Manage' },
            'calendar': { label: 'Calendar', section: 'Manage' },
            'size-charts': { label: 'Size Charts', section: 'Manage' },
            'shops': { label: 'My Shops', section: 'Manage' },
            'platform-health': { label: 'Platform Health', section: 'Manage' },
            'transactions': { label: 'Transactions', section: 'Manage' },
            'financials': { label: 'Financials', section: 'Manage' },
            'analytics': { label: 'Analytics', section: 'Manage' },
            'predictions': { label: 'Predictions', section: 'Manage' },
            'suppliers': { label: 'Suppliers', section: 'Manage' },
            'market-intel': { label: 'Market Intel', section: 'Manage' },
            'settings': { label: 'Settings', section: '' },
            'help-support': { label: 'Help', section: '' },
            'roadmap': { label: 'Roadmap', section: '' },
            'changelog': { label: 'Changelog', section: '' },
            'about': { label: 'About Us', section: '' },
            'terms': { label: 'Terms of Service', section: '' },
            'privacy': { label: 'Privacy Policy', section: '' },
            'sales': { label: 'Sales', section: 'Sell' },
            'reports': { label: 'Reports', section: 'Manage' },
            'report-builder': { label: 'Report Builder', section: 'Manage' },
            'heatmaps': { label: 'Heatmaps', section: 'Manage' },
            'community': { label: 'Community', section: '' },
            'admin-metrics': { label: 'Admin Metrics', section: '' },
            'recently-deleted': { label: 'Recently Deleted', section: 'Sell' },
            'receipt-parser': { label: 'Receipt Parser', section: 'Manage' },
            'whatnot-live': { label: 'Whatnot Live', section: 'Manage' },
            'shipping-labels': { label: 'Shipping Labels', section: 'Sell' }
        };

        const info = pageInfo[currentPage] || { label: humanizeSlug(currentPage), section: '' };

        return `
            <nav class="breadcrumb" aria-label="Breadcrumb">
                <a href="#" class="breadcrumb-item" aria-label="Dashboard home" onclick="router.navigate('dashboard'); return false;">
                    <span class="breadcrumb-home">${this.icon('home', 16)}</span>
                </a>
                <span class="breadcrumb-separator">${this.icon('chevron-right', 14)}</span>
                ${info.section ? `
                    <span class="breadcrumb-item">${info.section}</span>
                    <span class="breadcrumb-separator">${this.icon('chevron-right', 14)}</span>
                ` : ''}
                <span class="breadcrumb-item current" aria-current="page">${info.label}</span>
            </nav>
        `;
    },

    // Enhanced empty state component
    emptyState(options = {}) {
        const {
            icon = 'inbox',
            title = 'No items yet',
            description = 'Get started by adding your first item.',
            actionLabel = null,
            actionHandler = null,
            secondaryActionLabel = null,
            secondaryActionHandler = null,
            tip = null,
            variant = 'default' // 'default', 'compact', 'inline'
        } = options;

        return `
            <div class="empty-state ${variant}">
                <div class="empty-state-icon">${this.icon(icon, 64)}</div>
                <h3 class="empty-state-title">${escapeHtml(title)}</h3>
                <p class="empty-state-description">${escapeHtml(description)}</p>
                ${actionLabel || secondaryActionLabel ? `
                    <div class="empty-state-actions">
                        ${actionLabel ? `<button class="btn btn-primary" onclick="${actionHandler}">${this.icon('plus', 16)} ${escapeHtml(actionLabel)}</button>` : ''}
                        ${secondaryActionLabel ? `<button class="btn btn-secondary" onclick="${secondaryActionHandler}">${escapeHtml(secondaryActionLabel)}</button>` : ''}
                    </div>
                ` : ''}
                ${tip ? `
                    <div class="empty-state-tip">
                        <div class="empty-state-tip-header">
                            ${this.icon('lightbulb', 16)}
                            <span>Quick Tip</span>
                        </div>
                        <p class="empty-state-tip-text">${escapeHtml(tip)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // Loading state component
    loadingState(options = {}) {
        const {
            message = 'Loading...',
            showProgress = false,
            progress = 0,
            variant = 'default' // 'default', 'branded', 'inline'
        } = options;

        if (variant === 'branded') {
            return `
                <div class="loading-branded">
                    <div class="loading-branded-icon">${this.icon('loader', 48)}</div>
                    <div class="loading-branded-text">${escapeHtml(message)}</div>
                    ${showProgress ? `
                        <div class="loading-branded-progress">
                            <div class="loading-branded-progress-bar" style="width: ${progress}%; animation: none;"></div>
                        </div>
                    ` : `
                        <div class="loading-branded-progress">
                            <div class="loading-branded-progress-bar"></div>
                        </div>
                    `}
                </div>
            `;
        }

        return `
            <div class="loading-spinner">
                <div class="loading-spinner-ring"></div>
            </div>
        `;
    },

    // Skeleton loader component
    skeleton(type = 'text', count = 3) {
        if (type === 'card') {
            return `
                <div class="skeleton-card">
                    <div class="skeleton skeleton-text" style="width: 40%; height: 20px;"></div>
                    <div class="skeleton skeleton-text" style="width: 100%;"></div>
                    <div class="skeleton skeleton-text" style="width: 80%;"></div>
                </div>
            `;
        }

        if (type === 'table') {
            return Array.from({ length: count }, () => `
                <div class="skeleton-table-row">
                    <div class="skeleton skeleton-table-cell" style="flex: 0.5;"></div>
                    <div class="skeleton skeleton-table-cell" style="flex: 2;"></div>
                    <div class="skeleton skeleton-table-cell" style="flex: 1;"></div>
                    <div class="skeleton skeleton-table-cell" style="flex: 1;"></div>
                </div>
            `).join('');
        }

        if (type === 'avatar') {
            return `<div class="skeleton skeleton-avatar"></div>`;
        }

        return Array.from({ length: count }, (_, i) => `
            <div class="skeleton skeleton-text" style="width: ${i === count - 1 ? '60%' : '100%'};"></div>
        `).join('');
    },

    // Comparison bar (this week vs last week)
    comparisonBar(current, previous, label, color = 'primary') {
        const max = Math.max(current, previous) || 1;
        const currentPercent = (current / max) * 100;
        const previousPercent = (previous / max) * 100;
        const change = previous > 0 ? ((current - previous) / previous * 100).toFixed(1) : 0;
        const isUp = current >= previous;

        return `
            <div class="comparison-bar">
                <div class="comparison-bar-header">
                    <span class="comparison-bar-label">${escapeHtml(label)}</span>
                    <span class="comparison-bar-change ${isUp ? 'positive' : 'negative'}">
                        ${isUp ? '↑' : '↓'} ${Math.abs(change)}%
                    </span>
                </div>
                <div class="comparison-bar-rows">
                    <div class="comparison-bar-row">
                        <span class="comparison-bar-period">This period</span>
                        <div class="comparison-bar-track">
                            <div class="comparison-bar-fill current" style="width: ${currentPercent}%; background: var(--${color}-500);"></div>
                        </div>
                        <span class="comparison-bar-value">${current.toLocaleString()}</span>
                    </div>
                    <div class="comparison-bar-row">
                        <span class="comparison-bar-period">Last period</span>
                        <div class="comparison-bar-track">
                            <div class="comparison-bar-fill previous" style="width: ${previousPercent}%; background: var(--${color}-200);"></div>
                        </div>
                        <span class="comparison-bar-value">${previous.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        `;
    },

    // Activity feed item
    activityItem(icon, title, description, timestamp, type = 'default') {
        const colors = { sale: 'green', offer: 'blue', inventory: 'purple', automation: 'yellow', error: 'red', default: 'gray', listing: 'blue', relist: 'blue', shipped: 'green' };
        const color = colors[type] || colors.default;
        const relativeTime = this.relativeTime(timestamp);
        const navRoutes = { sale: 'sales', offer: 'offers', inventory: 'inventory', listing: 'listings', relist: 'listings', shipped: 'orders' };
        const route = navRoutes[type];
        const clickAttr = route ? `onclick="router.navigate('${route}')" style="cursor: pointer;"` : '';

        return `
            <div class="activity-item clickable" ${clickAttr}>
                <div class="activity-icon" style="background: var(--${color}-100); color: var(--${color}-600);">
                    ${this.icon(icon, 16)}
                </div>
                <div class="activity-content">
                    <div class="activity-title">${escapeHtml(title)}</div>
                    <div class="activity-description">${escapeHtml(description)}</div>
                </div>
                <div class="activity-time" title="${new Date(timestamp).toLocaleString()}">${relativeTime}</div>
            </div>
        `;
    },

    // Activity feed container
    activityFeed(activities, maxItems = 10) {
        const items = activities.slice(0, maxItems);
        return `
            <div class="activity-feed">
                ${items.length > 0 ? items.map(a => this.activityItem(a.icon, a.title, a.description, a.timestamp, a.type)).join('') :
                    this.emptyState('No recent activity', 'Your sales, offers, and listing activity will appear here.', 'Add Inventory', "router.navigate('inventory')")
                }
            </div>
        `;
    },

    // Relative time helper
    relativeTime(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const seconds = Math.floor((now - then) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return then.toLocaleDateString();
    },

    // Inline editable field
    inlineEdit(value, fieldId, type = 'text', options = {}) {
        const { onSave = '', prefix = '', suffix = '', min = '', max = '', step = '' } = options;
        return `
            <span class="inline-edit" data-field="${fieldId}" data-value="${escapeHtml(value)}">
                <span class="inline-edit-display" role="button" tabindex="0" aria-label="Edit field" onclick="inlineEditor.startEdit('${fieldId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();inlineEditor.startEdit('${fieldId}');}">${prefix}${escapeHtml(value)}${suffix}</span>
                <input type="${type}" class="inline-edit-input hidden" value="${escapeHtml(value)}" aria-label="Edit field"
                    ${min ? `min="${min}"` : ''} ${max ? `max="${max}"` : ''} ${step ? `step="${step}"` : ''}
                    onblur="inlineEditor.save('${fieldId}')"
                    onkeydown="inlineEditor.handleKey(event, '${fieldId}')"
                    data-onsave="${onSave}">
            </span>
        `;
    },

    // Autocomplete input
    autocompleteInput(name, label, suggestions = [], options = {}) {
        const { value = '', placeholder = '', required = false } = options;
        const suggestionsJson = JSON.stringify(suggestions).replace(/"/g, '&quot;');
        return `
            <div class="form-group autocomplete-wrapper" id="autocomplete-${name}">
                <label class="form-label ${required ? 'required' : ''}">${escapeHtml(label)}</label>
                <input type="text" class="form-input" id="${name}" name="${name}"
                    value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"
                    ${required ? 'required' : ''}
                    autocomplete="off"
                    data-suggestions="${suggestionsJson}"
                    onfocus="autocomplete.show('${name}')"
                    oninput="autocomplete.filter('${name}', this.value)"
                    onblur="setTimeout(() => autocomplete.hide('${name}'), 200)">
                <div class="autocomplete-dropdown hidden" id="dropdown-${name}"></div>
            </div>
        `;
    },

    // Help tooltip with info icon
    helpTooltip(text, learnMoreUrl = null) {
        return `
            <span class="help-tooltip" data-tooltip="${escapeHtml(text)}">
                ${this.icon('help', 14)}
                ${learnMoreUrl ? `<a href="${learnMoreUrl}" target="_blank" class="help-link">Learn more</a>` : ''}
            </span>
        `;
    },

    // Inline notification banner
    inlineBanner(message, type = 'info', dismissible = true, id = null) {
        const bannerId = id || 'banner-' + Date.now();
        const colors = { info: 'blue', warning: 'yellow', error: 'red', success: 'green' };
        const icons = { info: 'alert-circle', warning: 'alert-circle', error: 'close', success: 'check' };
        const color = colors[type] || colors.info;
        const icon = icons[type] || icons.info;

        return `
            <div class="inline-banner inline-banner-${type}" id="${bannerId}" style="--banner-color: var(--${color}-500);">
                <div class="inline-banner-icon">${this.icon(icon, 18)}</div>
                <div class="inline-banner-content">${message}</div>
                ${dismissible ? `
                    <button class="inline-banner-dismiss" onclick="banners.dismiss('${bannerId}')" title="Dismiss">
                        ${this.icon('close', 16)}
                    </button>
                ` : ''}
            </div>
        `;
    },

    // Onboarding checklist
    onboardingChecklist(steps, dismissible = true) {
        const completed = steps.filter(s => s.completed).length;
        const percent = (completed / steps.length) * 100;
        const isMinimized = onboarding.isMinimized();

        return `
            <div class="onboarding-checklist ${isMinimized ? 'minimized' : ''}" id="onboarding-checklist">
                <div class="onboarding-header">
                    <div class="onboarding-title">
                        <span>Getting Started</span>
                        <span class="onboarding-progress">${completed}/${steps.length}</span>
                    </div>
                    <div class="onboarding-actions">
                        <button class="onboarding-minimize" onclick="event.stopPropagation(); onboarding.minimize()" title="${isMinimized ? 'Expand' : 'Minimize'}">
                            ${isMinimized ? '▼' : '▲'}
                        </button>
                        ${dismissible ? `<button class="onboarding-dismiss" onclick="event.stopPropagation(); onboarding.dismiss()" title="Dismiss">×</button>` : ''}
                    </div>
                </div>
                <div class="onboarding-progress-bar">
                    <div class="onboarding-progress-fill" style="width: ${percent}%"></div>
                </div>
                ${!isMinimized ? `
                <div class="onboarding-steps">
                    ${steps.map((step, i) => `
                        <div class="onboarding-step ${step.completed ? 'completed' : ''}" ${step.action ? `role="button" tabindex="0" onclick="${step.action}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();(${step.action})();}" aria-label="${escapeHtml(step.title)}"` : ''}>
                            <div class="onboarding-step-check">
                                ${step.completed ? this.icon('check', 14) : `<span>${i + 1}</span>`}
                            </div>
                            <div class="onboarding-step-content">
                                <div class="onboarding-step-title">${escapeHtml(step.title)}</div>
                                <div class="onboarding-step-description">${escapeHtml(step.description)}</div>
                            </div>
                            ${!step.completed ? `<div class="onboarding-step-arrow">${this.icon('chevron-right', 16)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        `;
    },

    // Enhanced image upload zone
    imageUploadZone(id, options = {}) {
        const { multiple = true, maxSize = '5MB', accept = 'images' } = options;
        return `
            <div class="image-upload-zone" id="${id}">
                <div class="image-upload-icon">${this.icon('image', 48)}</div>
                <div class="image-upload-text">Drag and drop images here, or click to browse</div>
                <div class="image-upload-hint">Max ${maxSize} per file • PNG, JPG, WebP</div>
                <div class="image-upload-paste-hint">
                    <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste from clipboard
                </div>
            </div>
            <div class="image-thumbnails" id="${id}-thumbnails"></div>
        `;
    },

    // Back to top button
    backToTop() {
        return `
            <button class="back-to-top hidden" id="back-to-top" onclick="window.scrollTo({top: 0, behavior: 'smooth'})" title="Back to top" aria-label="Back to top">
                ${this.icon('chevron-down', 20)}
            </button>
        `;
    },

    // Offline indicator
    offlineIndicator() {
        return `
            <div class="offline-indicator hidden" id="offline-indicator">
                <div class="offline-icon">${this.icon('wifi-off', 16)}</div>
                <span>You're offline</span>
                <span class="offline-queue" id="offline-queue"></span>
            </div>
        `;
    },

    // Breadcrumb navigation
    breadcrumbs(items) {
        return `
            <nav class="breadcrumbs">
                ${items.map((item, i) => `
                    ${i > 0 ? '<span class="breadcrumb-separator">/</span>' : ''}
                    ${item.href ? `
                        <a href="#" class="breadcrumb-item" onclick="router.navigate('${item.href}')">${escapeHtml(item.label)}</a>
                    ` : `
                        <span class="breadcrumb-item active">${escapeHtml(item.label)}</span>
                    `}
                `).join('')}
            </nav>
        `;
    },

    // Skeleton loaders
    skeletonCard() {
        return `
            <div class="skeleton-card">
                <div class="skeleton skeleton-title"></div>
                <div class="skeleton skeleton-text medium"></div>
                <div class="skeleton skeleton-text short"></div>
            </div>
        `;
    },

    skeletonTable(rows = 5) {
        return Array(rows).fill(0).map(() => `
            <div class="skeleton-table-row">
                <div class="skeleton skeleton-table-cell" style="flex: 0.5;"></div>
                <div class="skeleton skeleton-table-cell" style="flex: 2;"></div>
                <div class="skeleton skeleton-table-cell"></div>
                <div class="skeleton skeleton-table-cell"></div>
                <div class="skeleton skeleton-table-cell" style="flex: 0.5;"></div>
            </div>
        `).join('');
    },

    // Insight card
    insightCard(title, description, type = 'info', action = null) {
        return `
            <div class="insight-card ${type}">
                <div class="insight-icon">${this.icon('trending-up', 20)}</div>
                <div class="insight-content">
                    <div class="insight-title">${escapeHtml(title)}</div>
                    <div class="insight-description">${escapeHtml(description)}</div>
                    ${action ? `
                        <div class="insight-action">
                            <button class="insight-action-btn" onclick="${action.handler}">${action.label}</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // Quick filter pills
    filterPills(filters, activeFilters = []) {
        return `
            <div class="filter-pills">
                ${filters.map(f => `
                    <button class="filter-pill ${activeFilters.includes(f.id) ? 'active' : ''}"
                            onclick="quickFilters.toggle('${f.id}')">
                        ${f.icon ? this.icon(f.icon, 14) : ''}
                        ${f.label}
                        ${f.count !== undefined ? `<span class="filter-pill-count">${f.count}</span>` : ''}
                    </button>
                `).join('')}
                ${activeFilters.length > 0 ? `
                    <button class="filter-pills-clear" onclick="quickFilters.clearAll()" aria-label="Clear all filters">Clear all</button>
                ` : ''}
            </div>
        `;
    },

    // Status indicator with dot
    statusIndicator(status, label) {
        const statusMap = { synced: 'synced', syncing: 'syncing', error: 'error', offline: 'offline' };
        return `
            <div class="status-indicator">
                <span class="status-dot ${statusMap[status] || 'offline'}"></span>
                <span>${label || status}</span>
            </div>
        `;
    },

    // Pull to refresh indicator
    pullToRefresh() {
        return `
            <div class="pull-to-refresh" id="pull-to-refresh">
                <div class="pull-to-refresh-spinner"></div>
            </div>
        `;
    },

    // Loading button
    loadingButton(text, onClick, loading = false, type = 'primary') {
        return `
            <button class="btn btn-${type} ${loading ? 'btn-loading' : ''}" onclick="${onClick}" ${loading ? 'disabled' : ''}>
                ${text}
            </button>
        `;
    },

    // Standardized page header component
    pageHeader(title, description, actions = '') {
        return `
            <div class="page-header flex justify-between items-start">
                <div>
                    <h1 class="page-title">${escapeHtml(title)}</h1>
                    <p class="page-description">${escapeHtml(description)}</p>
                </div>
                ${actions ? `<div class="flex gap-2">${actions}</div>` : ''}
            </div>
        `;
    },

    // Empty state component with illustration
    emptyState(icon, title, description, actionText = null, actionHandler = null, actionIcon = 'plus') {
        return `
            <div class="empty-state-container">
                <div class="empty-state-icon-wrapper">
                    ${this.icon(icon, 48)}
                </div>
                <h3 class="empty-state-title">${escapeHtml(title)}</h3>
                <p class="empty-state-description">${escapeHtml(description)}</p>
                ${actionText && actionHandler ? `
                    <button class="btn btn-primary mt-4" onclick="${actionHandler}">
                        ${this.icon(actionIcon, 16)} ${escapeHtml(actionText)}
                    </button>
                ` : ''}
            </div>
        `;
    },

    // Skeleton loader component
    skeleton(type = 'text', count = 1) {
        const skeletons = {
            text: '<div class="skeleton skeleton-text"></div>',
            title: '<div class="skeleton skeleton-title"></div>',
            avatar: '<div class="skeleton skeleton-avatar"></div>',
            card: `
                <div class="skeleton-card">
                    <div class="skeleton skeleton-image"></div>
                    <div class="skeleton skeleton-title" style="margin-top: 12px;"></div>
                    <div class="skeleton skeleton-text" style="margin-top: 8px;"></div>
                    <div class="skeleton skeleton-text" style="margin-top: 4px; width: 60%;"></div>
                </div>
            `,
            row: `
                <div class="skeleton-row">
                    <div class="skeleton skeleton-avatar"></div>
                    <div style="flex: 1;">
                        <div class="skeleton skeleton-text" style="width: 40%;"></div>
                        <div class="skeleton skeleton-text" style="width: 70%; margin-top: 4px;"></div>
                    </div>
                </div>
            `,
            table: `
                <div class="skeleton-table">
                    <div class="skeleton skeleton-text" style="height: 40px; margin-bottom: 8px;"></div>
                    <div class="skeleton skeleton-text" style="height: 48px; margin-bottom: 4px;"></div>
                    <div class="skeleton skeleton-text" style="height: 48px; margin-bottom: 4px;"></div>
                    <div class="skeleton skeleton-text" style="height: 48px; margin-bottom: 4px;"></div>
                    <div class="skeleton skeleton-text" style="height: 48px;"></div>
                </div>
            `
        };
        return Array(count).fill(skeletons[type] || skeletons.text).join('');
    },

    // Loading button component
    loadingButton(text, onclick, isLoading = false, variant = 'primary', icon = null) {
        return `
            <button class="btn btn-${variant} ${isLoading ? 'btn-loading' : ''}"
                    onclick="${onclick}"
                    ${isLoading ? 'disabled' : ''}>
                ${isLoading ? `
                    <span class="btn-spinner"></span>
                    <span>Loading...</span>
                ` : `
                    ${icon ? this.icon(icon, 16) : ''}
                    <span>${escapeHtml(text)}</span>
                `}
            </button>
        `;
    },

    // Page loading overlay
    pageLoader(message = 'Loading...') {
        return `
            <div class="page-loader-overlay">
                <div class="page-loader-content">
                    <div class="page-loader-spinner"></div>
                    <p class="page-loader-message">${escapeHtml(message)}</p>
                </div>
            </div>
        `;
    },

    // Tooltip wrapper
    tooltip(content, text, position = 'top') {
        return `
            <span class="tooltip-wrapper" data-tooltip="${escapeHtml(text)}" data-tooltip-position="${position}">
                ${content}
            </span>
        `;
    },

    // Breadcrumb navigation (array-based — for custom breadcrumb paths)
    breadcrumbItems(items) {
        return `
            <nav class="breadcrumb" aria-label="Breadcrumb">
                ${items.map((item, index) => `
                    ${index > 0 ? '<span class="breadcrumb-separator">/</span>' : ''}
                    ${item.href ? `
                        <a href="#" onclick="router.navigate('${item.href}'); return false;" class="breadcrumb-link">${escapeHtml(item.label)}</a>
                    ` : `
                        <span class="breadcrumb-current">${escapeHtml(item.label)}</span>
                    `}
                `).join('')}
            </nav>
        `;
    },

    // Confirmation dialog component
    confirmDialog(title, message, onConfirm, confirmText = 'Confirm', isDanger = false) {
        return `
            <div class="confirm-dialog">
                <h3 class="confirm-dialog-title">${escapeHtml(title)}</h3>
                <p class="confirm-dialog-message">${escapeHtml(message)}</p>
                <div class="confirm-dialog-actions">
                    <button class="btn btn-secondary" onclick="modals.close()">Cancel</button>
                    <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" onclick="${onConfirm}; modals.close();">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        `;
    },

    // Form input with validation
    formInput(name, label, options = {}) {
        const { type = 'text', value = '', required = false, placeholder = '', maxLength = null, pattern = null, errorMsg = '' } = options;
        const requiredClass = required ? 'required' : '';
        return `
            <div class="form-group" id="form-group-${name}">
                <label class="form-label ${requiredClass}" for="${name}">${escapeHtml(label)}</label>
                <div class="form-input-wrapper">
                    <input type="${type}"
                           class="form-input"
                           id="${name}"
                           name="${name}"
                           value="${escapeHtml(value)}"
                           placeholder="${escapeHtml(placeholder)}"
                           ${required ? 'required' : ''}
                           ${maxLength ? `maxlength="${maxLength}"` : ''}
                           ${pattern ? `pattern="${pattern}"` : ''}
                           onblur="formValidation.validateField('${name}')"
                           oninput="formValidation.clearError('${name}')">
                    <span class="form-validation-icon" id="validation-icon-${name}"></span>
                </div>
                <div class="form-error hidden" id="error-${name}">${escapeHtml(errorMsg)}</div>
                ${maxLength ? `<div class="form-char-counter" id="counter-${name}">0 / ${maxLength}</div>` : ''}
            </div>
        `;
    },

    // Validation summary component
    validationSummary(errors = []) {
        if (errors.length === 0) return '';
        return `
            <div class="validation-summary">
                <div class="validation-summary-title">
                    ${this.icon('alert-circle', 16)} Please fix the following errors:
                </div>
                <ul class="validation-summary-list">
                    ${errors.map(err => `<li>${escapeHtml(err)}</li>`).join('')}
                </ul>
            </div>
        `;
    },

    // Get platform color for shop switch and badges
    getPlatformColor(platform) {
        const colors = {
            poshmark: '#AC1A2F',
            ebay: '#E53238',
            mercari: '#FF3B58',
            depop: '#FF2300',
            grailed: '#000000',
            facebook: '#1877F2',
            etsy: '#F1641E',
            whatnot: '#FF4757',
            shopify: '#96BF48'
        };
        return colors[platform] || '#6B7280';
    },

    // Platform badge with logo - clean letter-based design
    platformBadge(platform) {
        const colors = {
            poshmark: '#AC1A2F',
            ebay: '#E53238',
            mercari: '#FF3B58',
            depop: '#FF2300',
            grailed: '#000000',
            facebook: '#1877F2',
            etsy: '#F1641E'
        };

        const letters = {
            poshmark: 'P',
            ebay: 'e',
            mercari: 'M',
            depop: 'd',
            grailed: 'G',
            facebook: 'f',
            etsy: 'E'
        };

        const color = colors[platform] || 'var(--gray-600)';
        const letter = letters[platform] || platform?.[0]?.toUpperCase() || '?';
        const displayName = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Unknown';

        return `<span class="platform-badge" style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:${color};color:white;border-radius:4px;font-size:12px;font-weight:600;" title="${displayName}">
            <span style="width:16px;height:16px;background:white;color:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${letter}</span>
            ${displayName}
        </span>`;
    },

    // Platform logo for larger display (shop cards)
    platformLogoLarge(platform) {
        const configs = {
            poshmark: { bg: '#AC1A2F', letter: 'P', color: 'white', shape: 'circle' },
            ebay: { bg: '#FFFFFF', letters: [{l:'e',c:'#E53238'},{l:'b',c:'#0064D2'},{l:'a',c:'#F5AF02'},{l:'y',c:'#86B817'}], shape: 'rect' },
            mercari: { bg: '#FF3B58', letter: 'M', color: 'white', shape: 'circle' },
            depop: { bg: '#FF2300', letter: 'd', color: 'white', shape: 'circle' },
            grailed: { bg: '#000000', letter: 'G', color: 'white', shape: 'rect', font: 'Georgia, serif' },
            facebook: { bg: '#1877F2', svg: `<svg viewBox="0 0 48 48" width="48" height="48" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="22" fill="#1877F2"/><path d="M26.5 25h4l.5-4h-4.5v-2.5c0-1.1.4-2 2-2h2.5v-4c-.5-.1-2-.3-3.5-.3-3.5 0-6 2.1-6 6v2.8h-4v4h4v10h5v-10z" fill="white"/></svg>` },
            shopify: { bg: '#96BF48', letter: 'S', color: 'white', shape: 'rect' },
            etsy: { bg: '#F1641E', letter: 'E', color: 'white', shape: 'circle' },
            whatnot: { bg: '#FF6600', letter: 'W', color: 'white', shape: 'circle' }
        };

        const cfg = configs[platform];
        if (!cfg) {
            return `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);background:#6B7280;color:white;font-size:22px;font-weight:700;font-family:Arial,sans-serif">${(platform || '?')[0].toUpperCase()}</div>`;
        }
        if (cfg.svg) {
            return `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);overflow:hidden;background:white">${cfg.svg}</div>`;
        }
        const radius = cfg.shape === 'circle' ? '50%' : '8px';
        const border = cfg.bg === '#FFFFFF' ? 'border:1px solid #e5e7eb;' : '';
        if (cfg.letters) {
            return `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;gap:0;border-radius:${radius};box-shadow:0 2px 8px rgba(0,0,0,0.1);background:${cfg.bg};${border}font-size:14px;font-weight:700;font-family:Arial,sans-serif">${cfg.letters.map(l => `<span style="color:${l.c}">${l.l}</span>`).join('')}</div>`;
        }
        return `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:${radius};box-shadow:0 2px 8px rgba(0,0,0,0.1);background:${cfg.bg};${border}color:${cfg.color};font-size:22px;font-weight:700;font-family:${cfg.font || 'Arial, sans-serif'}">${cfg.letter}</div>`;
    },

    // Loading spinner
    spinner() {
        return '<div class="loading-spinner"></div>';
    },

    // Line chart component
    lineChart(data, options = {}) {
        const { width = 600, height = 300, color = 'var(--primary-500)', label = 'Value', comparisonData = null, comparisonColor = 'var(--gray-400)', comparisonLabel = 'Previous' } = options;

        if (!data || data.length === 0) {
            return `<div class="chart-empty">No data available</div>`;
        }

        const allValues = [...data.map(d => d.value), ...(comparisonData || []).map(d => d.value)];
        const maxValue = Math.max(...allValues, 1);
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        // Generate points for the line
        const points = data.map((d, i) => {
            const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
            const y = height - padding - (d.value / maxValue) * chartHeight;
            return `${x},${y}`;
        }).join(' ');

        // Generate dots
        const dots = data.map((d, i) => {
            const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
            const y = height - padding - (d.value / maxValue) * chartHeight;
            return `<circle cx="${x}" cy="${y}" r="4" fill="${color}" class="chart-dot" data-label="${d.label}" data-value="${d.value}"/>`;
        }).join('');

        // Generate comparison line if provided
        let comparisonSvg = '';
        if (comparisonData && comparisonData.length > 0) {
            const compPoints = comparisonData.map((d, i) => {
                const x = padding + (i / (comparisonData.length - 1 || 1)) * chartWidth;
                const y = height - padding - (d.value / maxValue) * chartHeight;
                return `${x},${y}`;
            }).join(' ');

            const compDots = comparisonData.map((d, i) => {
                const x = padding + (i / (comparisonData.length - 1 || 1)) * chartWidth;
                const y = height - padding - (d.value / maxValue) * chartHeight;
                return `<circle cx="${x}" cy="${y}" r="3" fill="${comparisonColor}" opacity="0.6" class="chart-dot" data-label="${d.label}" data-value="${d.value}"/>`;
            }).join('');

            comparisonSvg = `
                <polyline points="${compPoints}" fill="none" stroke="${comparisonColor}" stroke-width="2" stroke-dasharray="6,4" opacity="0.6"/>
                ${compDots}
            `;
        }

        return `
            <svg viewBox="0 0 ${width} ${height}" class="line-chart" style="width: 100%; height: auto;">
                <!-- Grid lines -->
                ${[0, 0.25, 0.5, 0.75, 1].map(ratio => `
                    <line x1="${padding}" y1="${height - padding - ratio * chartHeight}"
                          x2="${width - padding}" y2="${height - padding - ratio * chartHeight}"
                          stroke="var(--gray-200)" stroke-width="1" stroke-dasharray="4,4"/>
                `).join('')}

                <!-- Comparison line (behind) -->
                ${comparisonSvg}

                <!-- Line -->
                <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>

                <!-- Dots -->
                ${dots}

                <!-- X-axis labels -->
                ${data.map((d, i) => {
                    if (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1) {
                        const x = padding + (i / (data.length - 1 || 1)) * chartWidth;
                        return `<text x="${x}" y="${height - 10}" text-anchor="middle" font-size="11" fill="var(--gray-600)">${d.label}</text>`;
                    }
                    return '';
                }).join('')}

                <!-- Y-axis labels -->
                ${[0, 0.5, 1].map((ratio, i) => `
                    <text x="${padding - 10}" y="${height - padding - ratio * chartHeight + 4}"
                          text-anchor="end" font-size="11" fill="var(--gray-600)">
                        $${Math.round(maxValue * ratio)}
                    </text>
                `).join('')}

                ${comparisonData ? `
                    <!-- Legend -->
                    <rect x="${width - 180}" y="8" width="10" height="10" fill="${color}" rx="2"/>
                    <text x="${width - 166}" y="17" font-size="11" fill="var(--gray-600)">Current</text>
                    <line x1="${width - 100}" y1="13" x2="${width - 80}" y2="13" stroke="${comparisonColor}" stroke-width="2" stroke-dasharray="4,3" opacity="0.6"/>
                    <text x="${width - 76}" y="17" font-size="11" fill="var(--gray-500)">${comparisonLabel}</text>
                ` : ''}
            </svg>
        `;
    },

    // Bar chart component
    barChart(data, options = {}) {
        const { width = 600, height = 300, color = 'var(--primary-500)' } = options;

        if (!data || data.length === 0) {
            return `<div class="chart-empty">No data available</div>`;
        }

        const maxValue = Math.max(...data.map(d => d.value), 1);
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;
        const barWidth = chartWidth / data.length * 0.7;
        const barSpacing = chartWidth / data.length;

        const bars = data.map((d, i) => {
            const barHeight = (d.value / maxValue) * chartHeight;
            const x = padding + i * barSpacing + (barSpacing - barWidth) / 2;
            const y = height - padding - barHeight;

            return `
                <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}"
                      fill="${Array.isArray(color) ? color[i % color.length] : color}"
                      rx="4" class="chart-bar" data-label="${d.label}" data-value="${d.value}"/>
                <text x="${x + barWidth / 2}" y="${height - padding + 20}"
                      text-anchor="middle" font-size="11" fill="var(--gray-600)">${d.label}</text>
            `;
        }).join('');

        return `
            <svg viewBox="0 0 ${width} ${height}" class="bar-chart" style="width: 100%; height: auto;">
                <!-- Grid lines -->
                ${[0, 0.5, 1].map(ratio => `
                    <line x1="${padding}" y1="${height - padding - ratio * chartHeight}"
                          x2="${width - padding}" y2="${height - padding - ratio * chartHeight}"
                          stroke="var(--gray-200)" stroke-width="1" stroke-dasharray="4,4"/>
                `).join('')}

                <!-- Bars -->
                ${bars}

                <!-- Y-axis labels -->
                ${[0, 0.5, 1].map((ratio) => `
                    <text x="${padding - 10}" y="${height - padding - ratio * chartHeight + 4}"
                          text-anchor="end" font-size="11" fill="var(--gray-600)">
                        $${Math.round(maxValue * ratio)}
                    </text>
                `).join('')}
            </svg>
        `;
    },

    // Pie chart component
    pieChart(data, options = {}) {
        const {
            width = 300,
            height = 300,
            colors = ['#AC1A2F', '#E53238', '#FF3B58', '#FF0000', '#4299E1', '#48BB78', '#ED8936', '#9F7AEA'],
            showLegend = true,
            showPercentages = true
        } = options;

        if (!data || data.length === 0) {
            return `<div class="chart-empty">No data available</div>`;
        }

        const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
        if (total === 0) {
            return `<div class="chart-empty">No data available</div>`;
        }

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 20;

        // Generate pie segments using SVG path arcs
        let currentAngle = -Math.PI / 2; // Start at top
        const segments = data.map((d, i) => {
            const sliceAngle = (d.value / total) * 2 * Math.PI;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sliceAngle;
            currentAngle = endAngle;

            // Calculate arc path
            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);

            // Large arc flag (1 if > 180 degrees)
            const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

            const pathData = [
                `M ${centerX} ${centerY}`,
                `L ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
            ].join(' ');

            const color = Array.isArray(colors) ? colors[i % colors.length] : colors;
            const percentage = Math.round((d.value / total) * 100);

            // Calculate label position (middle of arc)
            const labelAngle = startAngle + sliceAngle / 2;
            const labelRadius = radius * 0.65;
            const labelX = centerX + labelRadius * Math.cos(labelAngle);
            const labelY = centerY + labelRadius * Math.sin(labelAngle);

            return {
                path: pathData,
                color,
                label: d.label,
                value: d.value,
                percentage,
                labelX,
                labelY,
                showLabel: percentage >= 5 // Only show label if >= 5%
            };
        });

        const legendHeight = showLegend ? Math.ceil(data.length / 2) * 24 + 16 : 0;
        const totalHeight = height + legendHeight;

        return `
            <svg viewBox="0 0 ${width} ${totalHeight}" class="pie-chart" style="width: 100%; height: auto;">
                <!-- Pie segments -->
                ${segments.map((seg, i) => `
                    <path d="${seg.path}" fill="${seg.color}" class="chart-slice"
                          data-label="${seg.label}" data-value="${seg.value}" data-percentage="${seg.percentage}%"
                          style="transition: transform 0.2s ease; transform-origin: ${centerX}px ${centerY}px;">
                        <title>${seg.label}: $${seg.value.toFixed(2)} (${seg.percentage}%)</title>
                    </path>
                `).join('')}

                <!-- Percentage labels on slices -->
                ${showPercentages ? segments.filter(s => s.showLabel).map(seg => `
                    <text x="${seg.labelX}" y="${seg.labelY}"
                          text-anchor="middle" dominant-baseline="middle"
                          font-size="12" font-weight="600" fill="white"
                          style="pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                        ${seg.percentage}%
                    </text>
                `).join('') : ''}

                <!-- Legend -->
                ${showLegend ? `
                    <g transform="translate(0, ${height + 8})">
                        ${segments.map((seg, i) => {
                            const col = i % 2;
                            const row = Math.floor(i / 2);
                            const x = col * (width / 2) + 8;
                            const y = row * 24 + 8;
                            return `
                                <g transform="translate(${x}, ${y})">
                                    <rect width="12" height="12" rx="2" fill="${seg.color}"/>
                                    <text x="18" y="10" font-size="11" fill="var(--gray-700)">
                                        ${seg.label}: $${seg.value.toFixed(2)}
                                    </text>
                                </g>
                            `;
                        }).join('')}
                    </g>
                ` : ''}
            </svg>
        `;
    },

    // Empty state
    emptyState(title, description, actionLabel = null, actionHandler = null) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${this.icon('inventory', 64)}</div>
                <h3 class="empty-state-title">${title}</h3>
                <p class="empty-state-description">${description}</p>
                ${actionLabel ? `<button class="btn btn-primary" onclick="${actionHandler}">${actionLabel}</button>` : ''}
            </div>
        `;
    },

    // Photo Editor Modal (Cloudinary AI)
    photoEditorModal() {
        const isOpen = store.state.photoEditorOpen;
        if (!isOpen) return '';

        const image = store.state.photoEditorImage;
        const transforms = store.state.photoEditorTransformations || {};
        const previewUrl = store.state.photoEditorPreviewUrl || (image?.file_path) || '';
        const isLoading = store.state.photoEditorLoading;
        const cloudinaryConfigured = store.state.cloudinaryConfigured;

        // Ensure we have an image before showing the editor
        if (!image) {
            return `
                <div class="photo-editor-overlay" role="dialog" aria-modal="true" aria-label="AI Photo Editor" onclick="handlers.closePhotoEditor()">
                    <div class="photo-editor-modal" onclick="event.stopPropagation()">
                        <div class="photo-editor-header">
                            <h2>AI Photo Editor</h2>
                            <button class="btn btn-icon" onclick="handlers.closePhotoEditor()" aria-label="Close photo editor">
                                ${this.icon('close', 20)}
                            </button>
                        </div>
                        <div class="photo-editor-setup">
                            <div class="setup-icon">&#9888;</div>
                            <h3>Image Not Found</h3>
                            <p>Unable to load the selected image. Please try again.</p>
                            <button class="btn btn-secondary" onclick="handlers.closePhotoEditor()">Close</button>
                        </div>
                    </div>
                </div>
            `;
        }

        const cropPresets = [
            { id: 'square', label: 'Square (1:1)', width: 1000, height: 1000 },
            { id: 'portrait', label: 'Portrait (4:5)', width: 800, height: 1000 },
            { id: 'landscape', label: 'Landscape (16:9)', width: 1200, height: 800 },
            { id: 'ebay', label: 'eBay (1600x1600)', width: 1600, height: 1600 },
            { id: 'poshmark', label: 'Poshmark (1080x1080)', width: 1080, height: 1080 },
            { id: 'whatnot', label: 'Mercari (1280x1280)', width: 1280, height: 1280 }
        ];

        return `
            <div class="photo-editor-overlay" onclick="handlers.closePhotoEditor()">
                <div class="photo-editor-modal" onclick="event.stopPropagation()">
                    <div class="photo-editor-header">
                        <h2>AI Photo Editor</h2>
                        <button class="btn btn-icon" onclick="handlers.closePhotoEditor()" aria-label="Close photo editor">
                            ${this.icon('close', 20)}
                        </button>
                    </div>

                    ${!cloudinaryConfigured ? `
                        <div class="photo-editor-setup">
                            <div class="setup-icon">&#9881;</div>
                            <h3>Cloudinary Not Configured</h3>
                            <p>To use AI-powered photo editing features, you need to set up Cloudinary credentials.</p>
                            <div class="setup-steps">
                                <ol>
                                    <li>Create a free account at <a href="https://cloudinary.com" target="_blank">cloudinary.com</a></li>
                                    <li>Get your Cloud Name, API Key, and API Secret from the dashboard</li>
                                    <li>Add these to your .env file:
                                        <code>CLOUDINARY_CLOUD_NAME=your-cloud-name<br>CLOUDINARY_API_KEY=your-api-key<br>CLOUDINARY_API_SECRET=your-api-secret</code>
                                    </li>
                                    <li>Restart the server</li>
                                </ol>
                            </div>
                            <button class="btn btn-secondary" onclick="handlers.closePhotoEditor()">Close</button>
                        </div>
                    ` : `
                        <div class="photo-editor-body">
                            <div class="photo-editor-images">
                                <div class="photo-editor-original">
                                    <h4>Original</h4>
                                    <div class="photo-editor-img-container">
                                        <img src="${escapeHtml(image?.file_path || '')}" alt="Original">
                                    </div>
                                </div>
                                <div class="photo-editor-preview">
                                    <h4>Preview</h4>
                                    <div class="photo-editor-img-container">
                                        <img src="${escapeHtml(previewUrl)}" alt="Preview" ${isLoading ? 'style="opacity: 0.5"' : ''}>
                                        ${isLoading ? '<div class="photo-editor-loading">Processing...</div>' : ''}
                                    </div>
                                </div>
                            </div>

                            <div class="photo-editor-controls">
                                ${!image?.cloudinary_public_id ? `
                                    <div class="photo-editor-upload-notice">
                                        <p>This image needs to be uploaded to Cloudinary first.</p>
                                        <button class="btn btn-primary btn-sm" onclick="handlers.uploadToCloudinary()">
                                            ${this.icon('upload', 14)} Upload to Cloudinary
                                        </button>
                                    </div>
                                ` : ''}

                                <div class="photo-editor-section">
                                    <h4>AI Transformations</h4>
                                    <div class="photo-editor-options">
                                        <label class="photo-editor-option">
                                            <input type="checkbox"
                                                   ${transforms.removeBackground ? 'checked' : ''}
                                                   onchange="handlers.togglePhotoTransformation('removeBackground')"
                                                   ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                            <span class="option-label">
                                                <span class="option-icon">&#128247;</span>
                                                Remove Background
                                            </span>
                                        </label>
                                        <label class="photo-editor-option">
                                            <input type="checkbox"
                                                   ${transforms.enhance ? 'checked' : ''}
                                                   onchange="handlers.togglePhotoTransformation('enhance')"
                                                   ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                            <span class="option-label">
                                                <span class="option-icon">&#10024;</span>
                                                Auto Enhance
                                            </span>
                                        </label>
                                        <label class="photo-editor-option">
                                            <input type="checkbox"
                                                   ${transforms.upscale ? 'checked' : ''}
                                                   onchange="handlers.togglePhotoTransformation('upscale')"
                                                   ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                            <span class="option-label">
                                                <span class="option-icon">&#128200;</span>
                                                AI Upscale
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div class="photo-editor-section">
                                    <h4>Rotate & Flip</h4>
                                    <div class="photo-editor-rotate-controls" style="display: flex; gap: 8px; margin-bottom: 12px;">
                                        <button class="btn btn-sm btn-secondary" onclick="handlers.rotatePhoto(-90)" ${!image?.cloudinary_public_id ? 'disabled' : ''} title="Rotate Left">
                                            ↺ Left
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="handlers.rotatePhoto(90)" ${!image?.cloudinary_public_id ? 'disabled' : ''} title="Rotate Right">
                                            ↻ Right
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="handlers.flipPhoto('horizontal')" ${!image?.cloudinary_public_id ? 'disabled' : ''} title="Flip Horizontal">
                                            ⇆ Flip H
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="handlers.flipPhoto('vertical')" ${!image?.cloudinary_public_id ? 'disabled' : ''} title="Flip Vertical">
                                            ⇅ Flip V
                                        </button>
                                    </div>
                                    <div class="photo-editor-rotation-slider" style="display: flex; align-items: center; gap: 8px;">
                                        <span class="text-xs">Fine:</span>
                                        <input type="range" min="-45" max="45" value="${transforms.rotationAngle || 0}"
                                               style="flex: 1;"
                                               onchange="handlers.setPhotoRotation(this.value)"
                                               ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                        <span class="text-xs" style="min-width: 35px;">${transforms.rotationAngle || 0}°</span>
                                    </div>
                                </div>

                                <div class="photo-editor-section">
                                    <h4>Lighting Adjustments</h4>
                                    <div class="photo-editor-sliders" style="display: flex; flex-direction: column; gap: 12px;">
                                        <div class="photo-editor-slider-row" style="display: flex; align-items: center; gap: 8px;">
                                            <label style="min-width: 80px; font-size: 13px;">Brightness</label>
                                            <input type="range" min="-50" max="50" value="${transforms.brightness || 0}"
                                                   style="flex: 1;"
                                                   onchange="handlers.setPhotoAdjustment('brightness', this.value)"
                                                   ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                            <span class="text-xs" style="min-width: 35px;">${transforms.brightness || 0}</span>
                                        </div>
                                        <div class="photo-editor-slider-row" style="display: flex; align-items: center; gap: 8px;">
                                            <label style="min-width: 80px; font-size: 13px;">Contrast</label>
                                            <input type="range" min="-50" max="50" value="${transforms.contrast || 0}"
                                                   style="flex: 1;"
                                                   onchange="handlers.setPhotoAdjustment('contrast', this.value)"
                                                   ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                            <span class="text-xs" style="min-width: 35px;">${transforms.contrast || 0}</span>
                                        </div>
                                        <div class="photo-editor-slider-row" style="display: flex; align-items: center; gap: 8px;">
                                            <label style="min-width: 80px; font-size: 13px;">Saturation</label>
                                            <input type="range" min="-50" max="50" value="${transforms.saturation || 0}"
                                                   style="flex: 1;"
                                                   onchange="handlers.setPhotoAdjustment('saturation', this.value)"
                                                   ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                            <span class="text-xs" style="min-width: 35px;">${transforms.saturation || 0}</span>
                                        </div>
                                        <div class="photo-editor-slider-row" style="display: flex; align-items: center; gap: 8px;">
                                            <label style="min-width: 80px; font-size: 13px;">Warmth</label>
                                            <input type="range" min="-50" max="50" value="${transforms.warmth || 0}"
                                                   style="flex: 1;"
                                                   onchange="handlers.setPhotoAdjustment('warmth', this.value)"
                                                   ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                            <span class="text-xs" style="min-width: 35px;">${transforms.warmth || 0}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="photo-editor-section">
                                    <h4>Smart Crop</h4>
                                    <select class="form-select photo-editor-preset"
                                            onchange="handlers.setPhotoCropPreset(this.value)"
                                            ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                        <option value="">No crop</option>
                                        ${cropPresets.map(p => `
                                            <option value="${p.id}" ${transforms.cropPreset === p.id ? 'selected' : ''}>
                                                ${p.label}
                                            </option>
                                        `).join('')}
                                    </select>
                                    <div class="photo-editor-dimensions">
                                        <input type="number"
                                               class="form-input"
                                               placeholder="Width"
                                               aria-label="Crop width"
                                               value="${transforms.cropWidth || ''}"
                                               onchange="handlers.setPhotoCropDimensions(this.value, document.querySelector('.photo-editor-dimensions input:last-child').value)"
                                               ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                        <span>x</span>
                                        <input type="number"
                                               class="form-input"
                                               placeholder="Height"
                                               aria-label="Crop height"
                                               value="${transforms.cropHeight || ''}"
                                               onchange="handlers.setPhotoCropDimensions(document.querySelector('.photo-editor-dimensions input:first-child').value, this.value)"
                                               ${!image?.cloudinary_public_id ? 'disabled' : ''}>
                                        <span>px</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="photo-editor-footer">
                            <button class="btn btn-secondary" onclick="handlers.closePhotoEditor()">Cancel</button>
                            <button class="btn btn-primary"
                                    onclick="handlers.applyPhotoEditorChanges()"
                                    ${isLoading || !image?.cloudinary_public_id ? 'disabled' : ''}>
                                ${isLoading ? 'Processing...' : 'Apply & Save'}
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }
};
