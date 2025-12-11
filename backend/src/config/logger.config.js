// src/config/logger.js
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import chalk from 'chalk';
import configEnv from './env.config.js';

// Ensure logs folder exists
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// -----------------------
// File log format (plain, timestamped)
// -----------------------
const fileFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
});

// -----------------------
// Console log format (colored, no timestamp)
// -----------------------
const consoleFormat = winston.format.printf(({ level, message, stack }) => {
  switch (level) {
    case 'error':
      return chalk.red(`[ERROR]: ${stack || message}`);
    case 'warn':
      return chalk.yellow(`[WARN]: ${stack || message}`);
    case 'debug':
      return chalk.blue(`[DEBUG]: ${stack || message}`); 
    case 'info':
    default:
      // Special green for "Server started"
      if (message.includes('Server started')) return chalk.green(`[INFO]: ${message}`);
      return chalk.green(`[INFO]: ${stack || message}`);
  }
});

// -----------------------
// Create logger
// -----------------------
const logger = winston.createLogger({
  level: configEnv.LOG_LEVEL || 'info',
  transports: [
    // File transports (always active)
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        fileFormat
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        fileFormat
      ),
    }),
  ],
});

// -----------------------
// Development-only console logs
// -----------------------
if (configEnv.NODE_ENV === 'development') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

export default logger;
