import { CommitCache } from '../../src/utils/commitCache';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, rmdirSync } from 'fs';
import { execSync } from 'child_process';

describe('CommitCache', () => {
  const TEST_DIR = join(process.cwd(), 'test-repos');
  const TEST_REPO = join(TEST_DIR, 'test-repo');
  let originalCwd: string;

  beforeAll(() => {
    // Save original working directory
    originalCwd = process.cwd();
    
    // Create test directory and repository
    execSync(`
      mkdir -p "${TEST_REPO}"
      cd "${TEST_REPO}"
      git init
      git config user.name "test"
      git config user.email "test@test.com"
      echo "test" > test.txt
      git add test.txt
    `);

    // Ensure cache is enabled for tests
    process.env.OCO_ENABLE_CACHE = 'true';
  });

  beforeEach(() => {
    // Change to test repository directory
    process.chdir(TEST_REPO);
  });

  afterEach(() => {
    // Return to original directory
    process.chdir(originalCwd);
  });

  afterAll(() => {
    // Clean up test repositories
    execSync(`rm -rf "${TEST_DIR}"`);
    delete process.env.OCO_ENABLE_CACHE;
  });

  it('should save and retrieve commit message', async () => {
    const testMessage = 'test commit message';

    await CommitCache.saveCommitMessage(testMessage);
    const cached = await CommitCache.getLastCommitMessage();

    expect(cached).not.toBeNull();
    expect(cached?.message).toBe(testMessage);
    expect(cached?.files).toEqual(['test.txt']);
  });

  it('should not retrieve message with different files', async () => {
    const testMessage = 'test commit message';

    // Add a new file to change the staged files list
    execSync('echo "different" > different.txt && git add different.txt');

    await CommitCache.saveCommitMessage(testMessage);
    
    // Change back to original state
    execSync('git reset different.txt && rm different.txt');
    
    const cached = await CommitCache.getLastCommitMessage();

    expect(cached).toBeNull();
  });

  it('should clear cache after successful commit', async () => {
    const testMessage = 'test commit message';

    await CommitCache.saveCommitMessage(testMessage);
    await CommitCache.clearCache();
    const cached = await CommitCache.getLastCommitMessage();

    expect(cached).toBeNull();
  });

  it('should handle multiple repositories', async () => {
    // Create second test repository
    const TEST_REPO2 = join(TEST_DIR, 'test-repo2');
    execSync(`
      mkdir -p "${TEST_REPO2}"
      cd "${TEST_REPO2}"
      git init
      git config user.name "test"
      git config user.email "test@test.com"
      echo "test2" > test2.txt
      git add test2.txt
    `);

    // Save message in first repo
    process.chdir(TEST_REPO);
    const testMessage1 = 'test commit message 1';
    await CommitCache.saveCommitMessage(testMessage1);

    // Save message in second repo
    process.chdir(TEST_REPO2);
    const testMessage2 = 'test commit message 2';
    await CommitCache.saveCommitMessage(testMessage2);

    // Check first repo cache
    process.chdir(TEST_REPO);
    const cached1 = await CommitCache.getLastCommitMessage();
    expect(cached1?.message).toBe(testMessage1);
    expect(cached1?.files).toEqual(['test.txt']);

    // Check second repo cache
    process.chdir(TEST_REPO2);
    const cached2 = await CommitCache.getLastCommitMessage();
    expect(cached2?.message).toBe(testMessage2);
    expect(cached2?.files).toEqual(['test2.txt']);
  });

  it('should clean up old caches', async () => {
    const testMessage = 'test commit message';

    // Mock Date.now() to return a fixed timestamp
    const realDateNow = Date.now;
    const mockNow = new Date('2024-01-01').getTime();
    global.Date.now = jest.fn(() => mockNow);

    // Save message with mocked timestamp
    await CommitCache.saveCommitMessage(testMessage);

    // Restore real Date.now
    global.Date.now = realDateNow;

    // Run cleanup with current time (which should be > 7 days after mocked time)
    await CommitCache.cleanupOldCaches();
    
    // Try to retrieve the message
    const cached = await CommitCache.getLastCommitMessage();
    expect(cached).toBeNull();
  });
}); 