export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

const currentLevel: LogLevel = LogLevel.DEBUG

function shouldLog(level: LogLevel): boolean {
  const order = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
  return order.indexOf(level) >= order.indexOf(currentLevel)
}

export const logger: Logger = {
  debug(message, ...args) {
    if (shouldLog(LogLevel.DEBUG)) console.debug(`[DEBUG] ${message}`, ...args)
  },
  info(message, ...args) {
    if (shouldLog(LogLevel.INFO)) console.info(`[INFO] ${message}`, ...args)
  },
  warn(message, ...args) {
    if (shouldLog(LogLevel.WARN)) console.warn(`[WARN] ${message}`, ...args)
  },
  error(message, ...args) {
    if (shouldLog(LogLevel.ERROR)) console.error(`[ERROR] ${message}`, ...args)
  },
}
