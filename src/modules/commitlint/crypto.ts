import crypto from 'node:crypto';

export function computeHash(content: string, algorithm = 'sha256'): string {
  try {
    const hash = crypto.createHash(algorithm);
    hash.update(content);
    return hash.digest('hex');
  } catch (error) {
    console.error('Error while computing hash:', error);
    throw error;
  }
}
