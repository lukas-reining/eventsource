export type LogLevel = keyof Logger;
export const LOG_LEVELS: Array<LogLevel> = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
];

export interface Logger {
  trace(...args: unknown[]): void;

  debug(...args: unknown[]): void;

  info(...args: unknown[]): void;

  warn(...args: unknown[]): void;

  error(...args: unknown[]): void;
}

export class ConsoleLogger implements Logger {
  constructor(private logLevel: LogLevel = 'info') {}

  trace(...args: unknown[]): void {
    if (['trace'].includes(this.logLevel)) {
      console.trace(...args);
    }
  }

  debug(...args: unknown[]): void {
    if (['trace', 'debug'].includes(this.logLevel)) {
      console.debug(...args);
    }
  }

  info(...args: unknown[]): void {
    if (['trace', 'debug', 'info'].includes(this.logLevel)) {
      console.log(...args);
    }
  }

  warn(...args: unknown[]): void {
    if (['trace', 'debug', 'info', 'warn'].includes(this.logLevel)) {
      console.warn(...args);
    }
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }
}
