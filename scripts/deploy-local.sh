#!/usr/bin/env bash
# VaultLister Local Deployment Script
# Starts the server and sets up the local environment

set -e  # Exit on error

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         VaultLister Local Deployment                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun.js is not installed!"
    echo "   Install it with: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✓ Bun.js found: $(bun --version)"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✓ Created .env from template"
        echo "   Please edit .env and add your secrets!"
    else
        echo "❌ .env.example not found!"
        exit 1
    fi
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    bun install
    echo "✓ Dependencies installed"
else
    echo "✓ Dependencies already installed"
fi

# Initialize database if it doesn't exist
if [ ! -f "data/vaultlister.db" ]; then
    echo "📊 Initializing database..."
    bun run db:init
    echo "✓ Database initialized"

    # Ask if user wants to seed with demo data
    read -p "   Seed with demo data? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        bun run db:seed
        echo "✓ Database seeded with demo data"
        echo "   Demo credentials: demo@vaultlister.com / DemoPassword123!"
    fi
else
    echo "✓ Database already exists"
fi

# Build frontend (optional, for production)
if [ "$1" == "--build" ]; then
    echo "🔨 Building frontend..."
    bun run build
    echo "✓ Frontend built"
fi

# Start the server
echo ""
echo "🚀 Starting VaultLister server..."
echo ""

if [ "$1" == "--production" ]; then
    NODE_ENV=production bun run start
else
    bun run dev
fi
