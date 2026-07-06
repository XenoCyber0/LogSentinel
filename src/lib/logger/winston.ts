import winston from 'winston';
import { env } from '@/env';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

const logFormat = env.NODE_ENV === 'production'
  ? combine(timestamp(), errors({ stack: true }), json())
  : combine(
      colorize(),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      printf(({ level, message, timestamp, stack, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;
        if (stack) log += `\n${stack}`;
        if (Object.keys(meta).length > 0) log += ` ${JSON.stringify(meta)}`;
        return log;
      })
    );

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: logFormat,
  transports: [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
  exitOnError: false,
});

// Mask sensitive data in logs
export function maskSensitive(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sensitive = ['password', 'token', 'secret', 'key', 'authorization'];
  const masked = { ...obj };
  
  for (const key of Object.keys(masked)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      masked[key] = '***REDACTED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitive(masked[key]);
    }
  }
  
  return masked;
}
