# Installation Guide

This guide provides detailed steps for setting up the MatchMaker Discord bot, from creating a Discord application to deploying the bot in different environments.

## Prerequisites

Before you begin, make sure you have the following:

- Node.js 16.x or higher installed
- npm (included with Node.js) or yarn
- PostgreSQL database server
- Discord account with admin access to a server

## Discord Bot Setup

### Creating a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click on "New Application" and give your application a name
3. Navigate to the "Bot" tab and click "Add Bot"
4. Under the "Token" section, click "Reset Token" to generate a new token (save this for later)
5. Enable the following Privileged Gateway Intents:
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
6. Under "Bot Permissions", ensure the bot has the following permissions:
   - Send Messages
   - Embed Links
   - Attach Files
   - Read Message History
   - Add Reactions
   - Use Slash Commands
   - Manage Channels
   - Manage Roles

### Inviting the Bot to Your Server

1. Go to the "OAuth2" tab in your Discord application
2. Select "URL Generator"
3. Under "Scopes", select "bot" and "applications.commands"
4. Under "Bot Permissions", select the permissions listed above
5. Copy the generated URL and open it in your browser
6. Select your server and click "Authorize"

## Application Setup

### Basic Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/matchmaker.git
   cd matchmaker
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up your environment variables by creating a `.env` file in the root directory:
   ```
   # Required variables
   DISCORD_TOKEN=your_discord_bot_token
   DATABASE_URL=postgresql://username:password@localhost:5432/matchmaker
   
   # Optional variables
   NODE_ENV=development  # or production
   ```

4. Initialize the database schema:
   ```bash
   npm run db:push
   # or
   yarn db:push
   ```

5. Start the application:
   ```bash
   # Development mode with hot reloading
   npm run dev
   # or
   yarn dev
   
   # Production mode
   npm run build
   npm start
   # or
   yarn build
   yarn start
   ```

### Advanced Configuration

1. Create a custom configuration file (optional):
   ```bash
   cp config.example.json discordbot-config.json
   ```

2. Edit the configuration file to match your preferences:
   ```bash
   # Edit with your favorite editor
   nano discordbot-config.json
   ```

3. For more configuration options, refer to the [Configuration Guide](configuration.md).

## Database Setup

### Local PostgreSQL

1. Install PostgreSQL on your system
2. Create a new database and user:
   ```sql
   CREATE DATABASE matchmaker;
   CREATE USER matchmakeruser WITH ENCRYPTED PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE matchmaker TO matchmakeruser;
   ```

3. Update your `.env` file with the database connection information:
   ```
   DATABASE_URL=postgresql://matchmakeruser:your_password@localhost:5432/matchmaker
   ```

### Using Neon PostgreSQL (Cloud Option)

1. Sign up for a free account at [Neon](https://neon.tech/)
2. Create a new project and database
3. Get the connection string from the Neon dashboard
4. Update your `.env` file with the connection string:
   ```
   DATABASE_URL=postgresql://user:password@endpoint/neondb
   ```

## Deployment Options

### Development Environment

For development, you can use the built-in development server:

```bash
npm run dev
# or
yarn dev
```

This will start the server with hot reloading enabled for rapid development.

### Production Deployment

#### Traditional Hosting

1. Build the application:
   ```bash
   npm run build
   # or
   yarn build
   ```

2. Start the production server:
   ```bash
   npm start
   # or
   yarn start
   ```

3. For persistence, consider using a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start dist/server/index.js --name matchmaker
   pm2 save
   ```

#### Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t matchmaker .
   ```

2. Run the container:
   ```bash
   docker run -d \
     --name matchmaker \
     -e DISCORD_TOKEN=your_discord_bot_token \
     -e DATABASE_URL=postgresql://user:password@host:port/database \
     matchmaker
   ```

#### Cloud Run (Google Cloud)

1. Ensure you have the Google Cloud SDK installed
2. Build and deploy using the provided script:
   ```bash
   ./deploy.sh
   ```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify that your PostgreSQL server is running
   - Check the DATABASE_URL in your .env file
   - Ensure the user has proper permissions

2. **Discord Bot Not Responding**
   - Verify that your bot token is correct
   - Check that the bot has the necessary permissions
   - Ensure the required intents are enabled

3. **Command Registration Fails**
   - Ensure your bot has the `applications.commands` scope
   - Check if the guildId is correctly set in configuration (for guild-specific commands)

### Getting Help

If you encounter issues not covered in this guide:

1. Check the logs for error messages
2. Look for similar issues in the GitHub repository's Issues section
3. Create a new issue with detailed information about your problem

## Next Steps

After successful installation:

1. Customize your bot's configuration using the [Configuration Guide](configuration.md)
2. Learn about the architecture in the [Architecture Guide](architecture.md)
3. Set up roles and permissions in your Discord server for admin commands