import { runTasksWithConcurrency } from '../../src/utils/runTasksWithConcurrency';

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('runTasksWithConcurrency', () => {
  it('bounds concurrency and preserves result order', async () => {
    let activeTasks = 0;
    let maxActiveTasks = 0;
    const tasks = Array.from({ length: 12 }, (_, index) => async () => {
      activeTasks += 1;
      maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
      await wait(index % 2 === 0 ? 10 : 5);
      activeTasks -= 1;
      return index;
    });

    await expect(runTasksWithConcurrency(tasks, 3)).resolves.toEqual(
      Array.from({ length: 12 }, (_, index) => index)
    );
    expect(maxActiveTasks).toBe(3);
  });

  it('does not start queued tasks after a failure', async () => {
    const startedTasks: number[] = [];
    const tasks = Array.from({ length: 6 }, (_, index) => async () => {
      startedTasks.push(index);
      if (index === 0) {
        await wait(5);
        throw new Error('request failed');
      }
      await wait(20);
      return index;
    });

    await expect(runTasksWithConcurrency(tasks, 2)).rejects.toThrow(
      'request failed'
    );
    expect(startedTasks).toEqual([0, 1]);
  });

  it('rejects invalid concurrency values', async () => {
    await expect(runTasksWithConcurrency([], 0)).rejects.toThrow(
      'concurrency must be a positive integer'
    );
  });
});
