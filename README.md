# MatchMaker - Discord Competitive Gaming Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A sophisticated Discord bot platform revolutionizing competitive gaming management through intelligent matchmaking and user-centric features.

![MatchMaker Demo](docs/images/matchmaker-demo.png)

## 🎮 Overview

MatchMaker is a powerful Discord bot designed to facilitate competitive matchmaking for gaming communities. It allows users to queue for matches, tracks player rankings through an MMR (Matchmaking Rating) system, and provides various commands for match management, player statistics, and administrative functions.

### Key Features

- **Intelligent Matchmaking**: Balanced team creation based on player MMR
- **Real-time Queue Management**: Join/leave queue with Discord slash commands
- **Player Statistics Tracking**: Win rates, MMR, and performance metrics
- **Match History**: Detailed records of past matches and outcomes
- **Vote System**: In-match voting for results and player kicks
- **Configurable Settings**: Highly customizable bot behavior
- **Season Management**: Support for competitive seasons and rankings

## 📋 Table of Contents

- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Setup](#setup)
  - [Configuration](#configuration)
- [Usage](#usage)
  - [Player Commands](#player-commands)
  - [Admin Commands](#admin-commands)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## 🔧 Installation

### Prerequisites

- Node.js 16.x or later
- PostgreSQL database
- Discord Bot Token
- Discord Server with admin privileges

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/matchmaker.git
   cd matchmaker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create a `.env` file in the root directory):
   ```
   # Discord Bot Configuration
   DISCORD_TOKEN=your_discord_bot_token
   
   # Database Configuration
   DATABASE_URL=postgresql://username:password@localhost:5432/matchmaker
   ```

4. Initialize the database:
   ```bash
   npm run db:push
   ```

5. Start the application:
   ```bash
   npm run dev  # For development
   # or
   npm run build && npm start  # For production
   ```

### Configuration

The bot is highly configurable through the `discordbot-config.json` file. You can adjust the following settings:

- **General Settings**: Bot status, logging levels, admin roles
- **Matchmaking Settings**: Queue limits, team formation rules
- **MMR System**: Starting MMR, K-factor, streak bonuses
- **Season Management**: Season dates, rank tiers, MMR resets
- **Match Rules**: Voting thresholds, match time limits
- **Notifications**: DM and channel notification preferences

Refer to the [Configuration Guide](docs/configuration.md) for detailed documentation.

## 💻 Usage

### Player Commands

| Command | Description |
|---------|-------------|
| `/queue` | Join the matchmaking queue |
| `/leave` | Leave the matchmaking queue |
| `/list` | List all players currently in the queue |
| `/profile [user]` | View player statistics (yours or another player's) |
| `/history [user] [count]` | View match history (yours or another player's) |
| `/streak [user]` | Display current win/loss streak |
| `/votekick [target]` | Vote to kick a player from a match |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/forcematch [players...]` | Force create a match with specified players |
| `/endmatch [match_id] [winning_team]` | End a match and record results |
| `/resetqueue` | Reset the queue |

## 🏗️ Architecture

The application follows a layered architecture pattern with the following primary layers:

1. **Interface Layer** - Discord bot commands and interactions
2. **Service Layer** - Core business logic and functionality
3. **Data Access Layer** - Database interactions and data models
4. **Configuration Layer** - System settings and configuration management

Key technologies:
- TypeScript for strong typing and better developer experience
- Discord.js for Discord API interactions
- Drizzle ORM for database operations with PostgreSQL
- Service-oriented design for modularity
- Singleton pattern for critical services
- Event-driven communication between components

For more details, see the [Architecture Guide](docs/architecture.md).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
