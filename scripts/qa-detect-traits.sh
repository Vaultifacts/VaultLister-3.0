#!/usr/bin/env bash
# QA Trait Auto-Detection Script
# Runs ALL 56 trait checks mechanically. No skipping. No assumptions.
# Output: one line per trait — DETECTED or NOT_DETECTED with evidence.

set -uo pipefail
ROOT="${1:-.}"
cd "$ROOT"

check() {
  local num="$1" name="$2" result="$3" evidence="$4"
  # Sanitize result to integer
  result=$(echo "$result" | tr -d '[:space:]' | grep -o '^[0-9]*' || echo 0)
  [ -z "$result" ] && result=0
  if [ "$result" -gt 0 ]; then
    echo "DETECTED: T${num} (${name}) — ${evidence}"
  else
    echo "NOT_DETECTED: T${num} (${name})"
  fi
}

# Safe grep -c wrapper: always returns a single integer
gcount() {
  grep -c "$@" 2>/dev/null | awk -F: '{s+=$NF}END{print s+0}'
}

# Universal traits (01-14) — always detected
for i in 01 02 03 04 05 06 07 08 09 10 11 12 13 14; do
  names=("Functional" "Visual/UI" "Empty States" "Error States" "Data Integrity" "Performance" "Security" "Accessibility" "Copy/Content" "Edge Cases" "Regression" "Smoke" "Exploratory" "Deployment")
  idx=$((10#$i - 1))
  echo "DETECTED: T${i} (${names[$idx]}) — universal, always included"
done

# T15 Responsive
r=$(grep -rl "@media.*max-width\|@media.*min-width" src/frontend/styles/ 2>/dev/null | wc -l)
check 15 "Responsive" "$r" "${r} CSS files with @media queries"

# T16 Dark Mode
r=$(grep -rl "dark-mode\|dark_mode\|darkMode\|prefers-color-scheme" src/frontend/ 2>/dev/null | wc -l)
check 16 "Dark Mode" "$r" "${r} files with dark mode references"

# T17 SPA Routing
r=$(grep -rl "location.hash\|pushState\|router.navigate\|router.register" src/frontend/ 2>/dev/null | wc -l)
check 17 "SPA Routing" "$r" "${r} files with routing logic"

# T18 Forms & Validation
r=$(grep -rl "<form\|onsubmit\|handleSubmit" src/frontend/ 2>/dev/null | wc -l)
check 18 "Forms/Validation" "$r" "${r} files with forms"

# T19 Modals & Dialogs
r=$(grep -rl 'role="dialog"\|modals\.show\|modals\.close\|modals\.open' src/frontend/ 2>/dev/null | wc -l)
check 19 "Modals/Dialogs" "$r" "${r} files with modal references"

# T20 Authentication
r=$(grep -rl "isAuthenticated\|authGuard\|login\|logout\|JWT" src/frontend/ src/backend/ 2>/dev/null | wc -l)
check 20 "Auth" "$r" "${r} files with auth logic"

# T21 API Endpoints
r=$(ls src/backend/routes/ 2>/dev/null | wc -l)
check 21 "API Endpoints" "$r" "${r} route files"

# T22 Database
r=$(gcount "DATABASE_URL\|postgres\|pg\|mysql\|sqlite\|mongoose" package.json .env.example)
check 22 "Database" "$r" "${r} database references"

# T23 File Uploads
r=$(grep -rl 'type="file"\|FormData\|multer\|sharp\|dropzone' src/ 2>/dev/null | wc -l)
check 23 "File Uploads" "$r" "${r} files with upload logic"

# T24 Notifications & Toasts
r=$(grep -rl "toast\.success\|toast\.error\|toast\.info\|toast\.warning" src/frontend/ 2>/dev/null | wc -l)
check 24 "Notifications/Toasts" "$r" "${r} files with toast calls"

# T25 WebSocket
r=$(grep -rl "WebSocket\|websocket\|wss://\|socket\.io" src/ 2>/dev/null | wc -l)
check 25 "WebSocket/Real-Time" "$r" "${r} files with WebSocket references"

# T26 Keyboard Shortcuts
r=$(grep -rl "keydown\|commandPalette\|shortcut" src/frontend/ 2>/dev/null | wc -l)
check 26 "Keyboard Shortcuts" "$r" "${r} files with keyboard handlers"

# T27 Drag & Drop
r=$(grep -rl 'draggable="true"\|dragstart\|dragend\|initDragDrop' src/frontend/ 2>/dev/null | wc -l)
check 27 "Drag & Drop" "$r" "${r} files with drag handlers"

# T28 Charts & Data Visualization
r=$(grep -rl "sparkline\|gauge\|heatmap\|chart\|Chart\|SVG.*viewBox" src/frontend/ui/ 2>/dev/null | wc -l)
check 28 "Charts/DataViz" "$r" "${r} files with chart components"

# T29 Tables & Data Grids
r=$(grep -rl "<table\|<thead\|<tbody\|<th" src/frontend/ 2>/dev/null | wc -l)
check 29 "Tables/Grids" "$r" "${r} files with table elements"

# T30 PWA / Offline
r=0; [ -f public/sw.js ] && r=1; [ -f src/frontend/sw.js ] && r=1
r2=$(grep -rl "serviceWorker\|offlineQueue\|offlineMode" src/frontend/ 2>/dev/null | wc -l)
r=$((r + r2))
check 30 "PWA/Offline" "$r" "${r} PWA signals (sw.js + offline code)"

# T31 Payments & Billing
r=$(gcount "stripe\|STRIPE\|paypal\|PAYPAL\|braintree" package.json .env.example)
check 31 "Payments/Billing" "$r" "${r} payment references"

# T32 E-Commerce
r=$(grep -rl "addToCart\|cart\|checkout\|inventory\|sku\|stock" src/frontend/ 2>/dev/null | wc -l)
check 32 "E-Commerce" "$r" "${r} files with e-commerce logic"

# T33 Marketplace Integrations
r=$(grep -rl "ebay\|etsy\|poshmark\|mercari\|shopify\|crosslist\|cross-list" src/ 2>/dev/null | wc -l)
check 33 "Marketplace" "$r" "${r} files with marketplace references"

# T34 Multi-Tenant / SaaS
r=$(grep -rl "subscription\|plan\|tier\|freemium\|tenant" src/ 2>/dev/null | wc -l)
check 34 "Multi-Tenant/SaaS" "$r" "${r} files with subscription/tenant logic"

# T35 Email / Transactional
r=$(gcount "resend\|RESEND\|nodemailer\|sendgrid\|SMTP" package.json .env.example)
check 35 "Email/Transactional" "$r" "${r} email service references"

# T36 Browser Extension
r=0; [ -f src/extension/manifest.json ] && r=1
check 36 "Browser Extension" "$r" "src/extension/manifest.json $([ $r -gt 0 ] && echo 'exists' || echo 'not found')"

# T37 Background Workers
r=$(gcount "bullmq\|bull\|bee-queue\|agenda" package.json)
r2=0; [ -d worker/ ] && r2=1
r=$((r + r2))
check 37 "Background Workers" "$r" "${r} worker signals (deps + worker/ dir)"

# T38 AI / ML
r=$(gcount "@anthropic-ai/sdk\|openai\|langchain\|tensorflow" package.json)
r2=$(gcount "ANTHROPIC_API_KEY\|OPENAI_API_KEY" .env.example)
r=$((r + r2))
check 38 "AI/ML" "$r" "${r} AI SDK references"

# T39 Search / Filter / Sort
r=$(grep -rl "debounce.*search\|handleSearch\|filterBy\|sortBy\|TSVECTOR" src/ 2>/dev/null | wc -l)
check 39 "Search/Filter/Sort" "$r" "${r} files with search/filter logic"

# T40 i18n / Localization
r=0; [ -d src/frontend/i18n ] && r=1
r2=$(gcount "i18next\|react-intl\|vue-i18n" package.json)
r=$((r + r2))
check 40 "i18n/Localization" "$r" "${r} i18n signals"

# T41 Compliance / Legal
r=$(grep -rl "cookie.*consent\|cookie.*banner\|terms\|privacy" src/frontend/ 2>/dev/null | wc -l)
check 41 "Compliance/Legal" "$r" "${r} files with compliance references"

# T42 Onboarding / First-Run
r=$(grep -rl "onboarding\|getStarted\|welcome\|firstRun" src/frontend/ 2>/dev/null | wc -l)
check 42 "Onboarding/First-Run" "$r" "${r} files with onboarding logic"

# T43 Analytics / Dashboards
r=$(grep -rl "dashboard\|analytics\|metrics\|KPI" src/frontend/ 2>/dev/null | wc -l)
check 43 "Analytics/Dashboards" "$r" "${r} files with analytics/dashboard"

# T44 Settings & Preferences
r=$(grep -rl "settings\|preferences\|userSettings" src/frontend/pages/ 2>/dev/null | wc -l)
check 44 "Settings/Preferences" "$r" "${r} files with settings pages"

# T45 Cross-Browser — ALWAYS included for web projects
r=0; [ -f src/frontend/index.html ] && r=1
check 45 "Cross-Browser" "$r" "web project with HTML frontend"

# T46 Print
r=$(grep -rl "@media print\|window\.print" src/frontend/ 2>/dev/null | wc -l)
check 46 "Print" "$r" "${r} files with print styles/handlers"

# T47 Calendar / Scheduling
r=$(grep -rl "calendar\|schedule\|appointment\|fullcalendar" src/frontend/ 2>/dev/null | wc -l)
check 47 "Calendar/Scheduling" "$r" "${r} files with calendar/schedule"

# T48 Chat / Messaging
r=$(grep -rl "chat\|vaultBuddy\|conversation\|sendMessage" src/frontend/ 2>/dev/null | wc -l)
check 48 "Chat/Messaging" "$r" "${r} files with chat features"

# T49 Admin / Back-Office
r=$(grep -rl "is_admin\|isAdmin\|adminMetrics\|adminOnly" src/ 2>/dev/null | wc -l)
check 49 "Admin/Back-Office" "$r" "${r} files with admin logic"

# T50 Desktop / Electron
r=$(gcount "electron\|tauri\|neutralino" package.json)
check 50 "Desktop/Electron" "$r" "${r} desktop framework references"

# T51 CLI Tool
r=0
grep -q '"bin"' package.json 2>/dev/null && r=1
r2=$(gcount "commander\|yargs\|minimist\|oclif" package.json)
r=$((r + r2))
check 51 "CLI Tool" "$r" "${r} CLI signals"

# T52 Mobile Native
r=$(gcount "react-native\|expo\|@capacitor" package.json)
r2=0; [ -d ios ] && r2=1; [ -d android ] && r2=$((r2+1))
r=$((r + r2))
check 52 "Mobile Native" "$r" "${r} mobile framework signals"

# T53 Embedded / IoT
r=$(grep -rl "GPIO\|I2C\|SPI\|UART\|MQTT\|mqtt" src/ 2>/dev/null | wc -l)
check 53 "Embedded/IoT" "$r" "${r} embedded/IoT references"

# T54 Game
r=$(gcount "phaser\|pixi\.js\|three\.js\|babylon\|matter-js" package.json)
check 54 "Game" "$r" "${r} game engine references"

# T55 Video / Streaming
r=$(grep -rl "getUserMedia\|MediaStream\|<video\|MediaRecorder\|WebRTC\|hls\.js" src/frontend/ 2>/dev/null | wc -l)
check 55 "Video/Streaming" "$r" "${r} files with video/media features"

# T56 Geolocation / Maps
r=$(gcount "mapbox\|leaflet\|@googlemaps\|GOOGLE_MAPS\|MAPBOX" package.json .env.example)
r2=$(grep -rl "navigator\.geolocation\|getCurrentPosition" src/frontend/ 2>/dev/null | wc -l)
r=$((r + r2))
check 56 "Geolocation/Maps" "$r" "${r} map/geo references"

echo ""
echo "=== SUMMARY ==="
echo "Detection complete. Review above for DETECTED/NOT_DETECTED per trait."
