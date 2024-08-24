import { intro, outro, spinner } from '@clack/prompts';
import { command } from 'cleye';
import { execa } from 'execa';
import { getIgnoredFolders } from '../utils/git';
import { COMMANDS } from './ENUMS';
import chalk from 'chalk';

const findInFiles = async (
  query: string[],
  ignoredFolders: string[]
): Promise<string | null> => {
  const searchQuery = query.join('[^ \\n]*');

  const withIgnoredFolders =
    ignoredFolders.length > 0
      ? [
          '--',
          ' ',
          '.',
          ' ',
          ignoredFolders.map((folder) => `:^${folder}`).join(' ')
        ]
      : [];

  const params = [
    '--no-pager',
    'grep',
    '-p',
    '-n',
    '-i',
    '-w',
    '--break',
    '--color=always',
    '-C',
    '1',
    '--heading',
    '--threads',
    '3',
    '-E',
    searchQuery,
    ...withIgnoredFolders
  ];

  try {
    const { stdout } = await execa('git', params);
    return stdout;
  } catch (error) {
    return null;
  }
};

const generatePermutations = (arr: string[]): string[][] => {
  const result: string[][] = [];
  const used: boolean[] = new Array(arr.length).fill(false);
  const current: string[] = [];

  function backtrack() {
    if (current.length === arr.length) {
      result.push([...current]);
      return;
    }

    const seen = new Set<string>();
    for (let i = 0; i < arr.length; i++) {
      if (used[i] || seen.has(arr[i])) continue;
      used[i] = true;
      current.push(arr[i]);
      seen.add(arr[i]);
      backtrack();
      current.pop();
      used[i] = false;
    }
  }

  backtrack();
  return result;
};

const shuffleQuery = (query: string[]): string[][] => {
  return generatePermutations(query);
};

export const findCommand = command(
  {
    name: COMMANDS.find,
    parameters: ['<query...>']
  },
  async (argv) => {
    const query = argv._;
    const queryStr = query.join(' ');

    intro(`OpenCommit — 🔦 find`);
    const ignoredFolders = getIgnoredFolders();

    let result = await findInFiles(query, ignoredFolders);

    const searchSpinner = spinner();

    if (!result) {
      outro(`No matches found. Shuffling the query.`);

      searchSpinner.start(`Searching for matches...`);

      const allPossibleQueries = shuffleQuery(query);

      for (const possibleQuery of allPossibleQueries) {
        result = await findInFiles(possibleQuery, ignoredFolders);
        if (result) {
          searchSpinner.stop(
            `${chalk.green('✔')} found a match for ${possibleQuery.join(' ')}`
          );

          break;
        }
      }
    }

    if (result) {
      outro(result);
    } else {
      searchSpinner.stop(`${chalk.red('✘')} 404`);
    }
  }
);
