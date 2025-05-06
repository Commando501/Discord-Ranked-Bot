
# Host Migration Guide

This document provides instructions for migrating the Discord matchmaking bot to a new server host.

## Prerequisites

- Node.js 20.x or higher
- PostgreSQL database
- Discord bot token
- Git

## Migration Steps

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd discord-matchmaking-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

1. **Create a PostgreSQL database** on your new host
2. **Export the existing database** from Replit:
   ```bash
   npx tsx server/utils/export-db-script.ts
   ```
   This creates a JSON export in the `exports/` directory.

3. **Copy the export file** to your new host
4. **Import the data** on your new host:
   ```bash
   npx tsx server/utils/import-db-script.ts ./exports/db-export-[timestamp].json
   ```

### 4. Environment Configuration

Create a `.env` file in the project root with the following variables:

```
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
DISCORD_TOKEN=your_discord_bot_token
SESSION_SECRET=your_session_secret
```

### 5. Build and Start the Application

For development:
```bash
npm run dev
```

For production:
```bash
npm run build
npm start
```

## Configuration Options

### Discord Bot

The bot requires the `DISCORD_TOKEN` environment variable to function. You can obtain this from the [Discord Developer Portal](https://discord.com/developers/applications).

### Database Connection

Make sure the `DATABASE_URL` environment variable is properly configured for your database:
- Format: `postgresql://username:password@hostname:port/database_name`
- Example: `postgresql://myuser:mypassword@localhost:5432/matchmaking_bot`

### Web Panel

The web dashboard runs on port 5000 by default. Make sure this port is accessible on your host if you want to use the admin dashboard.

## Troubleshooting

- **Discord Bot Not Connecting**: Check your `DISCORD_TOKEN` and ensure the bot has the correct permissions
- **Database Connection Errors**: Verify your `DATABASE_URL` and ensure PostgreSQL is running
- **Missing Discord Interactions**: Make sure to re-register slash commands with `/register` after migrating

## Exporting and Importing Database

### Exporting Data

The system provides two methods for exporting your database:

1. **SQL Export** (recommended for full database structure):
   ```bash
   npx tsx server/utils/db-export.ts
   ```
   This creates a complete SQL dump with table structures and data.

2. **JSON Export** (for data-only migration):
   ```bash
   npx tsx server/utils/export-db-script.ts
   ```
   This exports just the data in JSON format.

### Importing Data

1. **Import SQL File**:
   - If you have direct database access:
     ```bash
     psql $DATABASE_URL -f ./exports/your-export-file.sql
     ```
   
2. **Import JSON File**:
   ```bash
   npx tsx server/utils/import-db-script.ts ./exports/your-export-file.json
   ```

3. **Convert SQL to JSON** (if you need to use a SQL export with the JSON import tool):
   ```bash
   npx tsx server/utils/convert-sql-script.ts ./exports/your-export-file.sql
   npx tsx server/utils/import-db-script.ts ./exports/your-export-file.json
   ```

## Regular Backups

Set up a scheduled task to run the export scripts regularly:

```bash
# For SQL export
npx tsx server/utils/db-export.ts

# For JSON export
npx tsx server/utils/export-db-script.ts
```

This ensures you have recent backups of your data in multiple formats.
