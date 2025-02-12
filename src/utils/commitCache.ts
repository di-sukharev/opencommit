import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { execa } from 'execa';
import { createHash } from 'crypto';
import { getConfig } from '../commands/config';

export interface CommitCacheData {
  message: string;
  timestamp: number;
  files: string[];
  repoPath: string;
}

export class CommitCache {
  private static readonly DEFAULT_CACHE_HOME = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  private static readonly DEFAULT_CACHE_DIR = join(CommitCache.DEFAULT_CACHE_HOME, 'opencommit');

  private static getCacheDir(): string {
    const config = getConfig();
    return config.OCO_CACHE_DIR || CommitCache.DEFAULT_CACHE_DIR;
  }

  private static isCacheEnabled(): boolean {
    const config = getConfig();
    return config.OCO_ENABLE_CACHE !== false;
  }

  private static async getRepoRoot(): Promise<string> {
    try {
      const { stdout } = await execa('git', ['rev-parse', '--show-toplevel']);
      return stdout.trim();
    } catch (error) {
      throw new Error('Not a git repository');
    }
  }

  private static getCacheFilePath(repoPath: string): string {
    const repoHash = createHash('md5').update(repoPath).digest('hex');
    return join(this.getCacheDir(), `${repoHash}_commit_cache.json`);
  }

  private static ensureCacheDir() {
    if (!this.isCacheEnabled()) return;

    const cacheDir = this.getCacheDir();
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
  }

  private static async getStagedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execa('git', ['diff', '--cached', '--name-only']);
      return stdout.split('\n').filter(Boolean);
    } catch (error) {
      console.error('Error getting staged files:', error);
      return [];
    }
  }

  static async saveCommitMessage(message: string) {
    if (!this.isCacheEnabled()) return;

    this.ensureCacheDir();
    const repoPath = await this.getRepoRoot();
    const files = await this.getStagedFiles();
    
    const cacheData: CommitCacheData = {
      message,
      timestamp: Date.now(),
      files,
      repoPath
    };
    writeFileSync(this.getCacheFilePath(repoPath), JSON.stringify(cacheData, null, 2));
  }

  static async getLastCommitMessage(): Promise<CommitCacheData | null> {
    if (!this.isCacheEnabled()) return null;

    try {
      const repoPath = await this.getRepoRoot();
      const cacheFilePath = this.getCacheFilePath(repoPath);
      
      if (!existsSync(cacheFilePath)) {
        return null;
      }

      const cacheContent = readFileSync(cacheFilePath, 'utf-8');
      if (!cacheContent.trim()) {
        return null;
      }

      const cacheData = JSON.parse(cacheContent) as CommitCacheData;

      if (cacheData.repoPath !== repoPath) {
        return null;
      }

      const currentFiles = await this.getStagedFiles();
      const cachedFileSet = new Set(cacheData.files);
      const currentFileSet = new Set(currentFiles);
      
      if (cachedFileSet.size !== currentFileSet.size) {
        return null;
      }
      
      for (const file of currentFileSet) {
        if (!cachedFileSet.has(file)) {
          return null;
        }
      }

      return cacheData;
    } catch (error) {
      console.error('Error reading commit cache:', error);
      return null;
    }
  }

  static async clearCache() {
    if (!this.isCacheEnabled()) return;

    try {
      const repoPath = await this.getRepoRoot();
      const cacheFilePath = this.getCacheFilePath(repoPath);
      if (existsSync(cacheFilePath)) {
        writeFileSync(cacheFilePath, JSON.stringify({}, null, 2));
      }
    } catch (error) {
      console.error('Error clearing commit cache:', error);
    }
  }

  static async cleanupOldCaches() {
    if (!this.isCacheEnabled()) return;

    try {
      const cacheDir = this.getCacheDir();
      if (!existsSync(cacheDir)) {
        return;
      }

      const files = readdirSync(cacheDir);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const file of files) {
        if (!file.endsWith('_commit_cache.json')) continue;

        const filePath = join(cacheDir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          if (!content.trim()) continue;

          const cacheData = JSON.parse(content) as CommitCacheData;
          if (now - cacheData.timestamp > maxAge) {
            writeFileSync(filePath, JSON.stringify({}, null, 2));
          }
        } catch (error) {
          writeFileSync(filePath, JSON.stringify({}, null, 2));
        }
      }
    } catch (error) {
      console.error('Error cleaning up old caches:', error);
    }
  }
} 