import { intro, outro, spinner } from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { execa } from 'execa';
import { getIgnoredFolders } from '../utils/git';
import { COMMANDS } from './ENUMS';

/* TODO:
1. find declarations
2. find usages (by calling git grep with the matching function name a123() being called and flag -w to show the call context)
3. find call hierarchy (by calling grep for the contexts where a123() being called)
4. show the call hierarchy in a tree-like format
5. provide short and concise LLM generated context for what each function does
*/

const findDeclarations = async (query: string[], ignoredFolders: string[]) => {
  const searchQuery = `(async|function)\\s+${query.join('\\S*')}.+{`;

  outro(`Searching: ${searchQuery}`);

  const occurrences = await findInFiles(searchQuery, ignoredFolders);

  if (!occurrences) return [];

  return occurrences.split('\n');
};

const findUsagesByDeclaration = async (
  declaration: string,
  ignoredFolders: string[]
) => {
  const searchQuery = `(await)? ?${declaration}\(.*\)`;

  const occurrences = await findInFiles(searchQuery, ignoredFolders);

  if (!occurrences) return [];

  return occurrences.split('\n');
};

const buildCallHierarchy = async (
  query: string[],
  ignoredFolders: string[]
) => {};

const findInFiles = async (
  query: string,
  ignoredFolders: string[]
): Promise<string | null> => {
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
    '-w', // show function wrapper, this should be used separately to show the function call hierarchy
    // '-z',
    '--break',
    '--color=never',
    '-C',
    '0',
    // '--full-name',
    '--heading',
    '--threads',
    '3',
    '-E',
    query,
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

    intro(`OpenCommit — 🔦 find`);
    const ignoredFolders = getIgnoredFolders();

    const searchSpinner = spinner();
    let declarations = await findDeclarations(query, ignoredFolders);

    outro(`Found ${declarations.length} declarations.`);

    outro(`No matches found. Searching semantically similar queries.`);

    searchSpinner.start(`Searching for matches...`);

    if (!declarations.length) {
      for (const possibleQuery of shuffleQuery(query)) {
        declarations = await findDeclarations(possibleQuery, ignoredFolders);
        if (declarations.length > 0) {
          outro(`Found ${declarations.join('\n')}`);
          break;
        }
      }
    }

    if (!declarations.length) {
      searchSpinner.stop(`${chalk.red('✘')} No function declarations found.`);
      return process.exit(1);
    }

    const funcDefinition = declarations[0];

    let usages: string[] = [];
    usages = await findUsagesByDeclaration(funcDefinition, ignoredFolders);

    searchSpinner.stop(
      `${chalk.green('✔')} Found ${funcDefinition} definition and ${
        usages.length
      } usages.`
    );

    outro(`____DECLARATIONS____:\n\n${declarations.join('\n')}`);
    outro(`____USAGES____:\n\n${usages.join('\n')}`);
  }
);
