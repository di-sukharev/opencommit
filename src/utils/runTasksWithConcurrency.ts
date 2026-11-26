export type AsyncTask<T> = () => Promise<T>;

export async function runTasksWithConcurrency<T>(
  tasks: AsyncTask<T>[],
  concurrency: number
): Promise<T[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer');
  }

  const results = new Array<T>(tasks.length);
  let nextTaskIndex = 0;
  let hasFailed = false;
  let firstError: unknown;

  const runWorker = async () => {
    while (!hasFailed) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;

      if (taskIndex >= tasks.length) return;

      try {
        results[taskIndex] = await tasks[taskIndex]();
      } catch (error) {
        if (!hasFailed) firstError = error;
        hasFailed = true;
      }
    }
  };

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  if (hasFailed) throw firstError;

  return results;
}
