import { createLogger, format, transports } from 'winston';

// Define the custom format
const customFormat = format.printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// Create the logger instance
export const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
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
  error: (message: string) => logger.error(message),
  debug: (message: string) => logger.debug(message)
};
