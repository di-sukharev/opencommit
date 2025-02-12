import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { execa } from 'execa';
import { createHash } from 'crypto';

export interface CommitCacheData {
  message: string;
  timestamp: number;
  files: string[];
  repoPath: string;
}

export class CommitCache {
  private static readonly XDG_CACHE_HOME = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  private static readonly CACHE_DIR = join(CommitCache.XDG_CACHE_HOME, 'opencommit');

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
    return join(this.CACHE_DIR, `${repoHash}_commit_cache.json`);
  }

  private static ensureCacheDir() {
    if (!existsSync(this.CACHE_DIR)) {
      mkdirSync(this.CACHE_DIR, { recursive: true });
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

      // Verify if the cache is for the current repository
      if (cacheData.repoPath !== repoPath) {
        return null;
      }

      // Get current staged files
      const currentFiles = await this.getStagedFiles();
      
      // Compare file lists (order doesn't matter)
      const cachedFileSet = new Set(cacheData.files);
      const currentFileSet = new Set(currentFiles);
      
      // Check if the file sets are equal
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
    try {
      if (!existsSync(this.CACHE_DIR)) {
        return;
      }

      const files = readdirSync(this.CACHE_DIR);
      const now = Date.now();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const file of files) {
        if (!file.endsWith('_commit_cache.json')) continue;

        const filePath = join(this.CACHE_DIR, file);
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