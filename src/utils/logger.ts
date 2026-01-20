import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { format } from 'util';
import chalk from 'chalk';
import { getConfig } from '../commands/config';

export class Logger {
  private static readonly DEFAULT_LOG_DIR = join(homedir(), '.cache', 'opencommit', 'logs');
  private static readonly DEFAULT_LOG_FILE = join(Logger.DEFAULT_LOG_DIR, 'opencommit.log');

  private static getLogDir(): string {
    const config = getConfig();
    return config.OCO_LOG_DIR || Logger.DEFAULT_LOG_DIR;
  }

  private static getLogFile(): string {
    return join(this.getLogDir(), 'opencommit.log');
  }

  private static isLoggingEnabled(): boolean {
    const config = getConfig();
    return config.OCO_ENABLE_LOGGING !== false;
  }

  private static ensureLogDir() {
    if (!this.isLoggingEnabled()) return;
    
    const logDir = this.getLogDir();
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  private static stripAnsi(str: string): string {
    // Remove ANSI color codes
    return str.replace(/\x1B\[\d+m/g, '');
  }

  private static writeToLog(level: string, message: string) {
    if (!this.isLoggingEnabled()) return;
    
    this.ensureLogDir();
    const timestamp = this.getTimestamp();
    const cleanMessage = this.stripAnsi(message);
    const logEntry = `[${timestamp}] [${level}] ${cleanMessage}\n`;
    appendFileSync(this.getLogFile(), logEntry);
  }

  private static formatMultilineMessage(message: string): string {
    return message.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `│ ${line}`)
      .join('\n');
  }

  static info(message: string, ...args: any[]) {
    const formattedMessage = format(message, ...args);
    this.writeToLog('INFO', formattedMessage);
    console.log(this.formatMultilineMessage(formattedMessage));
  }

  static error(message: string, ...args: any[]) {
    const formattedMessage = format(message, ...args);
    this.writeToLog('ERROR', formattedMessage);
    console.error(this.formatMultilineMessage(chalk.red(formattedMessage)));
  }

  static warn(message: string, ...args: any[]) {
    const formattedMessage = format(message, ...args);
    this.writeToLog('WARN', formattedMessage);
    console.warn(this.formatMultilineMessage(chalk.yellow(formattedMessage)));
  }

  static debug(message: string, ...args: any[]) {
    if (process.env.OCO_DEBUG) {
      const formattedMessage = format(message, ...args);
      this.writeToLog('DEBUG', formattedMessage);
      console.debug(this.formatMultilineMessage(chalk.gray(formattedMessage)));
    }
  }

  static spinner(message: string) {
    this.writeToLog('INFO', `[SPINNER] ${message}`);
  }

  static spinnerSuccess(message: string) {
    this.writeToLog('INFO', `[SPINNER_SUCCESS] ${message}`);
  }

  static spinnerError(message: string) {
    this.writeToLog('ERROR', `[SPINNER_ERROR] ${message}`);
  }

  static commitError(error: any) {
    if (error.stderr) {
      const lines = error.stderr.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      // Only write to log file, don't print to console
      lines.forEach(line => {
        this.writeToLog('ERROR', line);
      });
    }
    if (error.message) {
      // Only write to log file, don't print to console
      this.writeToLog('ERROR', error.message);
    }
  }

  static getLogPath(): string {
    return this.isLoggingEnabled() ? this.getLogFile() : 'Logging is disabled';
  }
} 