#!/usr/bin/env bash
# qa-detect-traits.sh — Codebase trait auto-detection for QA Skill System
# Usage: bash scripts/qa-detect-traits.sh [project-root]
# Output: DETECTED/NOT_DETECTED for each of 56 traits
# Traits 01-14: Universal (always included)
# Traits 15-56: Conditional (detected from codebase signals)

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT" || { echo "ERROR: Cannot cd to $PROJECT_ROOT"; exit 1; }

DETECTED_COUNT=0
NOT_DETECTED_COUNT=0
DETECTED_LIST=()
NOT_DETECTED_LIST=()

# Safe grep count — returns 0 on no match (avoids set -e issues)
gcount() {
    local pattern="$1"; shift
    local result
    result=$(grep -rl --include='*.js' --include='*.ts' --include='*.css' --include='*.html' --include='*.json' --include='*.md' "$pattern" "$@" 2>/dev/null | wc -l)
    echo "${result// /}"
}

# Grep count with specific file types
gcount_type() {
    local pattern="$1"
    local types="$2"  # e.g. "*.css"
    shift 2
    local result
    result=$(grep -rl --include="$types" "$pattern" "$@" 2>/dev/null | wc -l)
    echo "${result// /}"
}

# Check if file/dir exists
has_file() { [ -e "$1" ] && echo 1 || echo 0; }
has_dir() { [ -d "$1" ] && echo 1 || echo 0; }

# Check package.json for dependency
has_dep() {
    if [ -f "package.json" ]; then
        grep -q "\"$1\"" package.json 2>/dev/null && echo 1 || echo 0
    else
        echo 0
    fi
}

# Check .env.example for variable prefix
has_env() {
    local pattern="$1"
    local result=0
    for f in .env.example .env.sample; do
        if [ -f "$f" ] && grep -q "$pattern" "$f" 2>/dev/null; then
            result=1
            break
        fi
    done
    echo "$result"
}

# Record a trait result
record() {
    local num="$1"
    local name="$2"
    local detected="$3"
    local reason="${4:-}"
    detected=$((detected + 0))  # sanitize to integer
    if [ "$detected" -gt 0 ]; then
        DETECTED_COUNT=$((DETECTED_COUNT + 1))
        DETECTED_LIST+=("T${num}")
        if [ -n "$reason" ]; then
            echo "DETECTED: Trait ${num} (${name}) — ${reason}"
        else
            echo "DETECTED: Trait ${num} (${name})"
        fi
    else
        NOT_DETECTED_COUNT=$((NOT_DETECTED_COUNT + 1))
        NOT_DETECTED_LIST+=("T${num}")
        echo "NOT_DETECTED: Trait ${num} (${name})"
    fi
}

echo "━━━ QA TRAIT DETECTION ━━━"
echo "Project: $(basename "$(pwd)")"
echo "Scanning: $(pwd)"
echo ""

# ═══════════════════════════════════════════════════
# UNIVERSAL TRAITS (01-14) — Always included
# ═══════════════════════════════════════════════════
echo "── Universal Traits (always included) ──"
record "01" "Functional" 1 "universal"
record "02" "Visual/UI" 1 "universal"
record "03" "Empty States" 1 "universal"
record "04" "Error States" 1 "universal"
record "05" "Data Integrity" 1 "universal"
record "06" "Performance" 1 "universal"
record "07" "Security" 1 "universal"
record "08" "Accessibility" 1 "universal"
record "09" "Copy/Content" 1 "universal"
record "10" "Edge Cases" 1 "universal"
record "11" "Regression" 1 "universal"
record "12" "Smoke" 1 "universal"
record "13" "Exploratory" 1 "universal"
record "14" "Deployment" 1 "universal"

echo ""
echo "── Conditional Traits (detecting...) ──"

# ═══════════════════════════════════════════════════
# CONDITIONAL TRAITS (15-56) — Detected from codebase
# ═══════════════════════════════════════════════════

# T15: Responsive
s=0
s=$((s + $(gcount_type '@media.*max-width\|@media.*min-width' '*.css' .)))
s=$((s + $(gcount_type 'viewport' '*.html' .)))
s=$((s + $(has_dep tailwindcss) + $(has_dep bootstrap) + $(has_dep bulma)))
record "15" "Responsive" "$s" "${s} signal(s)"

# T16: Dark Mode
s=0
s=$((s + $(gcount 'dark-mode\|dark_mode\|darkMode\|theme-dark' .)))
s=$((s + $(gcount_type 'prefers-color-scheme' '*.css' .)))
s=$((s + $(gcount 'toggleTheme\|setTheme\|darkModeToggle' .)))
record "16" "Dark Mode" "$s" "${s} signal(s)"

# T17: SPA Routing
s=0
s=$((s + $(gcount 'window\.location\.hash\|pushState\|popstate' .)))
s=$((s + $(gcount 'router\.navigate\|router\.register\|handleRoute' .)))
s=$((s + $(has_dep react-router) + $(has_dep vue-router)))
f=$(find . -maxdepth 4 -name 'router.js' -o -name 'router.ts' 2>/dev/null | wc -l)
s=$((s + f))
record "17" "SPA Routing" "$s" "${s} signal(s)"

# T18: Forms & Validation
s=0
s=$((s + $(gcount 'handleSubmit\|onsubmit\|\.validate\|validation' .)))
s=$((s + $(has_dep formik) + $(has_dep yup) + $(has_dep zod) + $(has_dep joi)))
record "18" "Forms & Validation" "$s" "${s} signal(s)"

# T19: Modals & Dialogs
s=0
s=$((s + $(gcount 'role="dialog"\|\.modal\|showModal\|modals\.show\|modals\.open' .)))
record "19" "Modals & Dialogs" "$s" "${s} signal(s)"

# T20: Authentication
s=0
s=$((s + $(gcount 'isAuthenticated\|authGuard\|requireAuth' .)))
s=$((s + $(gcount 'jsonwebtoken\|bcrypt\|JWT' .)))
f=$(find . -maxdepth 4 -name 'auth.js' -o -name 'auth.ts' 2>/dev/null | wc -l)
s=$((s + f))
s=$((s + $(has_dep passport) + $(has_dep jsonwebtoken) + $(has_dep bcryptjs)))
record "20" "Authentication" "$s" "${s} signal(s)"

# T21: API Endpoints
s=0
s=$((s + $(has_dir "src/backend/routes")))
s=$((s + $(gcount 'app\.get(\|app\.post(\|router\.get(' .)))
s=$((s + $(gcount 'Bun\.serve' .)))
s=$((s + $(has_dep express) + $(has_dep koa) + $(has_dep fastify) + $(has_dep hono)))
record "21" "API Endpoints" "$s" "${s} signal(s)"

# T22: Database
s=0
s=$((s + $(has_dep postgres) + $(has_dep pg) + $(has_dep mysql2) + $(has_dep prisma) + $(has_dep knex)))
s=$((s + $(has_env 'DATABASE_URL')))
s=$((s + $(has_dir "migrations") + $(has_dir "src/backend/db")))
s=$((s + $(gcount 'query\.get\|query\.all\|query\.run\|prisma\.' .)))
record "22" "Database" "$s" "${s} signal(s)"

# T23: File Uploads
s=0
s=$((s + $(gcount 'type="file"\|FileReader\|FormData' .)))
s=$((s + $(has_dep multer) + $(has_dep sharp) + $(has_dep formidable)))
s=$((s + $(gcount 'upload\|dropzone' .)))
record "23" "File Uploads" "$s" "${s} signal(s)"

# T24: Notifications & Toasts
s=0
s=$((s + $(gcount 'toast\.success\|toast\.error\|toast(' .)))
s=$((s + $(gcount 'showNotification\|\.notification' .)))
s=$((s + $(has_dep react-hot-toast) + $(has_dep sonner) + $(has_dep react-toastify)))
record "24" "Notifications & Toasts" "$s" "${s} signal(s)"

# T25: WebSocket / Real-Time
s=0
s=$((s + $(gcount 'WebSocket\|new WebSocket\|ws://' .)))
s=$((s + $(gcount 'websocket.*upgrade\|Bun.*websocket' .)))
s=$((s + $(has_dep ws) + $(has_dep socket.io)))
record "25" "WebSocket / Real-Time" "$s" "${s} signal(s)"

# T26: Keyboard Shortcuts
s=0
s=$((s + $(gcount 'keydown.*ctrl\|keydown.*meta\|hotkey\|shortcut' .)))
s=$((s + $(gcount 'Ctrl+\|Cmd+' .)))
s=$((s + $(has_dep hotkeys-js) + $(has_dep mousetrap) + $(has_dep tinykeys)))
record "26" "Keyboard Shortcuts" "$s" "${s} signal(s)"

# T27: Drag & Drop
s=0
s=$((s + $(gcount 'draggable="true"\|dragstart\|dragend\|dragover' .)))
s=$((s + $(gcount 'initDragDrop\|Sortable\|Draggable' .)))
s=$((s + $(has_dep sortablejs) + $(has_dep dragula)))
record "27" "Drag & Drop" "$s" "${s} signal(s)"

# T28: Charts & Data Visualization
s=0
s=$((s + $(has_dep chart.js) + $(has_dep d3) + $(has_dep recharts) + $(has_dep apexcharts)))
s=$((s + $(gcount 'new Chart(\|sparkline\|gauge\|heatmap' .)))
s=$((s + $(gcount 'pie.*chart\|bar.*chart\|lineChart\|doughnut' .)))
record "28" "Charts & Data Viz" "$s" "${s} signal(s)"

# T29: Tables & Data Grids
s=0
s=$((s + $(gcount '<table\|<thead\|<tbody\|<th' .)))
s=$((s + $(gcount 'sortable.*column\|column.*sort\|toggleSort' .)))
record "29" "Tables & Data Grids" "$s" "${s} signal(s)"

# T30: PWA / Offline
s=0
f=$(find . -maxdepth 3 -name 'sw.js' -o -name 'service-worker.js' 2>/dev/null | wc -l)
s=$((s + f))
s=$((s + $(gcount 'navigator\.serviceWorker\|serviceWorker\.register' .)))
s=$((s + $(gcount 'offlineQueue\|offlineMode\|isOnline' .)))
f=$(find . -maxdepth 3 -name 'manifest.json' -o -name 'manifest.webmanifest' 2>/dev/null | wc -l)
s=$((s + f))
record "30" "PWA / Offline" "$s" "${s} signal(s)"

# T31: Payments & Billing
s=0
s=$((s + $(has_dep stripe) + $(has_dep paypal) + $(has_dep braintree)))
s=$((s + $(gcount 'checkout\|subscription\|billing' .)))
s=$((s + $(has_env 'STRIPE_\|PAYPAL_')))
record "31" "Payments & Billing" "$s" "${s} signal(s)"

# T32: E-Commerce
s=0
s=$((s + $(gcount 'addToCart\|cart\|checkout\|order\|product' .)))
s=$((s + $(gcount 'inventory\|stock\|quantity\|sku' .)))
record "32" "E-Commerce" "$s" "${s} signal(s)"

# T33: Marketplace Integrations
s=0
s=$((s + $(gcount 'ebay\|etsy\|poshmark\|mercari\|shopify' .)))
s=$((s + $(gcount 'crosslist\|cross-list\|sync.*platform' .)))
s=$((s + $(has_dir "worker/bots")))
record "33" "Marketplace Integrations" "$s" "${s} signal(s)"

# T34: Multi-Tenant / SaaS
s=0
s=$((s + $(gcount 'tenant\|tenantId\|organization\|workspace' .)))
s=$((s + $(gcount 'subscription\|plan\|tier\|freemium' .)))
s=$((s + $(gcount 'canAccess\|hasFeature\|checkTier' .)))
record "34" "Multi-Tenant / SaaS" "$s" "${s} signal(s)"

# T35: Email / Transactional
s=0
s=$((s + $(has_dep resend) + $(has_dep nodemailer)))
s=$((s + $(gcount 'sendEmail\|sendMail\|transactional' .)))
s=$((s + $(has_env 'SMTP_\|RESEND_\|SENDGRID_')))
record "35" "Email / Transactional" "$s" "${s} signal(s)"

# T36: Browser Extension
s=0
s=$((s + $(gcount 'chrome\.runtime\|chrome\.tabs\|browser\.runtime' .)))
f=$(find . -maxdepth 3 -name 'manifest.json' -exec grep -l 'manifest_version' {} \; 2>/dev/null | wc -l)
s=$((s + f))
f=$(find . -maxdepth 3 -name 'popup.html' -o -name 'content.js' -o -name 'background.js' 2>/dev/null | wc -l)
s=$((s + f))
record "36" "Browser Extension" "$s" "${s} signal(s)"

# T37: Background Workers
s=0
s=$((s + $(has_dep bullmq) + $(has_dep bull) + $(has_dep agenda) + $(has_dep bree)))
s=$((s + $(has_dir "worker")))
s=$((s + $(gcount 'Queue\|Worker.*process\|addJob' .)))
f=$(find . -maxdepth 3 -name 'Dockerfile' -path '*/worker/*' 2>/dev/null | wc -l)
s=$((s + f))
record "37" "Background Workers" "$s" "${s} signal(s)"

# T38: AI / ML
s=0
s=$((s + $(has_dep '@anthropic-ai/sdk') + $(has_dep openai) + $(has_dep langchain)))
s=$((s + $(has_env 'ANTHROPIC_API_KEY\|OPENAI_API_KEY')))
s=$((s + $(has_dir "src/shared/ai")))
s=$((s + $(gcount 'generateListing\|aiGenerate\|chatCompletion' .)))
record "38" "AI / ML" "$s" "${s} signal(s)"

# T39: Search / Filter / Sort
s=0
s=$((s + $(gcount 'handleSearch\|filterBy\|sortBy\|debounce.*search' .)))
s=$((s + $(gcount 'TSVECTOR\|textsearch\|ILIKE' .)))
s=$((s + $(has_dep elasticsearch) + $(has_dep algolia) + $(has_dep meilisearch)))
record "39" "Search / Filter / Sort" "$s" "${s} signal(s)"

# T40: i18n / Localization
s=0
s=$((s + $(has_dep i18next) + $(has_dep react-intl) + $(has_dep vue-i18n)))
s=$((s + $(has_dir "i18n") + $(has_dir "locales") + $(has_dir "translations")))
s=$((s + $(gcount 'useTranslation\|formatMessage' .)))
record "40" "i18n / Localization" "$s" "${s} signal(s)"

# T41: Compliance / Legal
s=0
s=$((s + $(gcount 'cookie.*consent\|cookie.*banner\|gdpr' .)))
f=$(find . -maxdepth 3 -name 'terms.html' -o -name 'privacy.html' -o -name 'about.html' 2>/dev/null | wc -l)
s=$((s + f))
s=$((s + $(gcount 'cookieConsent\|acceptCookies' .)))
record "41" "Compliance / Legal" "$s" "${s} signal(s)"

# T42: Onboarding / First-Run
s=0
s=$((s + $(gcount 'onboarding\|getStarted\|welcome\|firstRun\|tour' .)))
s=$((s + $(has_dep react-joyride) + $(has_dep shepherd)))
record "42" "Onboarding / First-Run" "$s" "${s} signal(s)"

# T43: Analytics / Dashboards
s=0
s=$((s + $(gcount 'dashboard\|analytics\|metrics\|KPI' .)))
f=$(find . -maxdepth 5 -name '*dashboard*' -o -name '*analytics*' 2>/dev/null | wc -l)
s=$((s + f))
record "43" "Analytics / Dashboards" "$s" "${s} signal(s)"

# T44: Settings & Preferences
s=0
s=$((s + $(gcount 'settings\|preferences\|userSettings' .)))
f=$(find . -maxdepth 5 -name '*settings*' 2>/dev/null | wc -l)
s=$((s + f))
record "44" "Settings & Preferences" "$s" "${s} signal(s)"

# T45: Cross-Browser
s=0
# Always included for web projects — check for HTML/CSS frontend
f=$(find . -maxdepth 3 -name '*.html' 2>/dev/null | wc -l)
s=$((s + f))
record "45" "Cross-Browser" "$s" "${s} signal(s)"

# T46: Print
s=0
s=$((s + $(gcount_type '@media print' '*.css' .)))
s=$((s + $(gcount 'window\.print' .)))
record "46" "Print" "$s" "${s} signal(s)"

# T47: Calendar / Scheduling
s=0
s=$((s + $(has_dep '@fullcalendar') + $(has_dep date-fns) + $(has_dep dayjs) + $(has_dep moment)))
s=$((s + $(gcount 'calendar\|schedule\|appointment' .)))
f=$(find . -maxdepth 5 -name '*calendar*' 2>/dev/null | wc -l)
s=$((s + f))
record "47" "Calendar / Scheduling" "$s" "${s} signal(s)"

# T48: Chat / Messaging
s=0
s=$((s + $(gcount 'chat\|sendMessage\|conversation' .)))
f=$(find . -maxdepth 5 -name '*chat*' 2>/dev/null | wc -l)
s=$((s + f))
record "48" "Chat / Messaging" "$s" "${s} signal(s)"

# T49: Admin / Back-Office
s=0
s=$((s + $(gcount 'is_admin\|isAdmin\|role.*admin\|adminOnly' .)))
s=$((s + $(gcount 'adminMetrics\|adminDashboard\|featureFlags' .)))
f=$(find . -maxdepth 4 -name '*admin*' 2>/dev/null | wc -l)
s=$((s + f))
record "49" "Admin / Back-Office" "$s" "${s} signal(s)"

# T50: Desktop / Electron
s=0
s=$((s + $(has_dep electron) + $(has_dep tauri) + $(has_dep neutralinojs)))
f=$(find . -maxdepth 3 -name 'electron-builder.yml' -o -name 'forge.config.js' 2>/dev/null | wc -l)
s=$((s + f))
record "50" "Desktop / Electron" "$s" "${s} signal(s)"

# T51: CLI Tool
s=0
if [ -f "package.json" ]; then
    grep -q '"bin"' package.json 2>/dev/null && s=$((s + 1))
fi
s=$((s + $(has_dep commander) + $(has_dep yargs) + $(has_dep minimist) + $(has_dep oclif)))
f=$(find . -maxdepth 3 -name 'cli.js' -o -name 'cli.ts' 2>/dev/null | wc -l)
s=$((s + f))
s=$((s + $(has_dir "bin")))
record "51" "CLI Tool" "$s" "${s} signal(s)"

# T52: Mobile Native
s=0
s=$((s + $(has_dep react-native) + $(has_dep expo)))
s=$((s + $(has_dir "ios") + $(has_dir "android")))
f=$(find . -maxdepth 3 -name '*.swift' -o -name '*.kt' 2>/dev/null | wc -l)
s=$((s + f))
record "52" "Mobile Native" "$s" "${s} signal(s)"

# T53: Embedded / IoT
s=0
s=$((s + $(has_dep mqtt) + $(has_dep johnny-five) + $(has_dep serialport)))
s=$((s + $(gcount 'GPIO\|I2C\|SPI\|UART' .)))
f=$(find . -maxdepth 3 -name 'platformio.ini' 2>/dev/null | wc -l)
s=$((s + f))
record "53" "Embedded / IoT" "$s" "${s} signal(s)"

# T54: Game
s=0
s=$((s + $(has_dep phaser) + $(has_dep pixi.js) + $(has_dep three.js) + $(has_dep matter-js)))
s=$((s + $(gcount 'gameLoop\|sprite\|collision' .)))
f=$(find . -maxdepth 3 -name '*.unity' -o -name '*.uproject' 2>/dev/null | wc -l)
s=$((s + f))
record "54" "Game" "$s" "${s} signal(s)"

# T55: Video / Streaming
s=0
s=$((s + $(gcount '<video\|<audio\|MediaStream\|getUserMedia' .)))
s=$((s + $(gcount 'WebRTC\|RTCPeerConnection\|MediaRecorder' .)))
s=$((s + $(has_dep hls.js) + $(has_dep video.js) + $(has_dep mediasoup)))
record "55" "Video / Streaming" "$s" "${s} signal(s)"

# T56: Geolocation / Maps
s=0
s=$((s + $(gcount 'navigator\.geolocation\|getCurrentPosition' .)))
s=$((s + $(has_dep leaflet) + $(has_dep mapbox-gl)))
s=$((s + $(has_env 'GOOGLE_MAPS_KEY\|MAPBOX_TOKEN')))
record "56" "Geolocation / Maps" "$s" "${s} signal(s)"

# ═══════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════
echo ""
echo "━━━ DETECTION SUMMARY ━━━"
echo "Detected:     ${DETECTED_COUNT} of 56"
echo "Not Detected: ${NOT_DETECTED_COUNT} of 56"
echo ""
echo "Detected traits: ${DETECTED_LIST[*]}"
echo "Not detected:    ${NOT_DETECTED_LIST[*]}"
