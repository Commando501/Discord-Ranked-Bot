
#!/bin/bash
# Deployment script for Discord matchmaking bot

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== Discord Matchmaking Bot Deployment ==="
echo "Starting deployment process..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ $NODE_MAJOR -lt 20 ]; then
    echo "Warning: Recommended Node.js version is 20.x or higher. Found $NODE_VERSION"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "Warning: .env file not found"
    echo "Creating example .env file..."
    echo "# Configure these environment variables" > .env
    echo "DATABASE_URL=postgresql://username:password@localhost:5432/database_name" >> .env
    echo "DISCORD_TOKEN=your_discord_bot_token" >> .env
    echo "SESSION_SECRET=your_session_secret" >> .env
    echo "Created .env file. Please edit it with your real configuration."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Building application..."
npm run build

# Check for database export directory
if [ ! -d "exports" ]; then
    mkdir -p exports
    echo "Created exports directory for database backups"
fi

# Create database backups
echo "Creating database backups..."
echo "Creating JSON backup..."
npx tsx server/utils/export-db-script.ts

# Create SQL backup if pg_dump is available
if command -v pg_dump &> /dev/null; then
    echo "Creating SQL backup..."
    npx tsx server/utils/db-export.ts
else
    echo "pg_dump not found, skipping SQL backup"
fi

echo "Deployment completed successfully!"
echo "Start the application with: npm start"
