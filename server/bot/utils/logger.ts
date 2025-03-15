import { createLogger, format, transports } from 'winston';
import fs from 'fs';
import path from 'path';
import { defaultBotConfig } from '@shared/botConfig';

// Path to the configuration file (same as in storage.ts and config.ts)
const CONFIG_FILE_PATH = path.join(process.cwd(), 'discordbot-config.json');

// Try to read configuration from file if it exists
let loggingLevel = 'info'; // Default level

try {
  if (fs.existsSync(CONFIG_FILE_PATH)) {
    const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
    const config = JSON.parse(fileContent);
    loggingLevel = config.general?.loggingLevel || defaultBotConfig.general.loggingLevel;
    
    // Add Discord token to logger configuration
    if (process.env.DISCORD_TOKEN) {
      logger.add(new transports.Http({
        host: 'discord.com',
        path: '/api/webhooks',
        ssl: true,
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_TOKEN}`
        }
      }));
    }
  }
} catch (error) {
  console.error('[LOGGER] Error loading config for logger:', error);
}

// Define the custom format
const customFormat = format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Create the logger instance
export const logger = createLogger({
  level: loggingLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    customFormat
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        customFormat
      )
    }),
    new transports.File({ 
      filename: 'error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new transports.File({ 
      filename: 'combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
  exceptionHandlers: [
    new transports.File({ filename: 'exceptions.log' })
  ]
});

// Export a wrapper with common log methods
export default {
  info: (message: string) => logger.info(message),
  warn: (message: string) => logger.warn(message),
  error: (message: string, meta?: any) => logger.error(message, meta),
  debug: (message: string) => logger.debug(message)
};
