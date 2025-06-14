#!/bin/bash

set -e

echo "🚀 Starting production deployment..."

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy --schema=./src/prisma/schema.prisma

# Start the application
echo "▶️ Starting the application..."
node dist/main 