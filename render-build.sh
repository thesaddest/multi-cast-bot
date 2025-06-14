#!/bin/bash

set -e

echo "🚀 Starting Render build process..."

# Install dependencies
echo "📦 Installing dependencies..."
yarn install --frozen-lockfile

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=./src/prisma/schema.prisma

# Build the application
echo "🏗️ Building the application..."
yarn build

echo "✅ Build completed successfully!" 