#!/bin/sh

# The /app/data directory is mapped via Docker volumes.

# Run Prisma db push to create/update the database schema
echo "Running Prisma db push..."
if ! ./node_modules/.bin/prisma db push --accept-data-loss; then
  echo "Error: Prisma db push failed!"
  # Don't exit yet, let the server try to start so logs are visible
fi

# Start the Next.js standalone server
echo "Starting Next.js..."
exec node server.js
