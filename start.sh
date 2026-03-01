#!/bin/sh

# Ensure the data directory exists
mkdir -p /app/data

# Run Prisma db push to create/update the database schema in the persistent volume
echo "Running Prisma db push..."
npx prisma db push

# Start the Next.js standalone server
echo "Starting Next.js..."
exec node server.js
