#!/bin/bash

set -e

echo "🚀 Starting Render build process..."

# Install dependencies (including dev dependencies for build)
echo "📦 Installing dependencies..."
yarn install --frozen-lockfile --production=false

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=./src/prisma/schema.prisma

# Build the application
echo "🏗️ Building the application..."
npx nest build

echo "✅ Build completed successfully!" 