import {
  confirm,
  intro,
  isCancel,
  note,
  outro,
  select,
  spinner
} from '@clack/prompts';
import chalk from 'chalk';
import { command } from 'cleye';
import { execa } from 'execa';
import { getIgnoredFolders } from '../utils/git';
import { COMMANDS } from './ENUMS';
import { OpenAiEngine } from '../engine/openAi';
import { getConfig } from './config';

type Occurrence = {
  fileName: string;
  context: {
    number: number;
    content: string;
  };
  matches: {
    number: number;
    content: string;
  }[];
};

/*
TODO:
- [ ] format declarations as file:line => context -> declaration
- [ ] format usages as file:line => context -> usage
- [ ] expand on usage to see it's call hierarchy
- [ ] generate Mermaid diagram
*/

const generateMermaid = async (stdout: string) => {
  const config = getConfig();

  const DEFAULT_CONFIG = {
    model: config.OCO_MODEL!,
    maxTokensOutput: config.OCO_TOKENS_MAX_OUTPUT!,
    maxTokensInput: config.OCO_TOKENS_MAX_INPUT!,
    baseURL: config.OCO_OPENAI_BASE_PATH!
  };
  const engine = new OpenAiEngine({
    ...DEFAULT_CONFIG,
    apiKey: config.OCO_OPENAI_API_KEY!
  });

  const diagram = await engine.generateCommitMessage([
    {
      role: 'system',
      content: `You are to generate a mermaid diagram from the given function. Strictly answer in this json format: { "mermaid": "<mermaid diagram>" }. Where <mermaid diagram> is a valid mermaid diagram, e.g:
graph TD
    A[Start] --> B[Generate Commit Message]
    B --> C{Token count >= Max?}
    C -->|Yes| D[Process file diffs]
    C -->|No| E[Generate single message]
    D --> F[Join messages]
    E --> G[Generate message]
    F --> H[End]
    G --> H
    B --> I{Error occurred?}
    I -->|Yes| J[Handle error]
    J --> H
    I -->|No| H
`
    },
    {
      role: 'user',
      content: stdout
    }
  ]);

  return JSON.parse(diagram as string);
};

export function extractFuncName(line: string) {
  const regex =
    /(?:function|export\s+const|const|let|var)?\s*(?:async\s+)?(\w+)\s*(?:=\s*(?:async\s*)?\(|\()/;
  const match = line.match(regex);
  return match ? match[1] : null;
}

function extractSingle(lineContent: string): string | null {
  const match = lineContent.match(/\s*(?:public\s+)?(?:async\s+)?(\w+)\s*=/);
  return match ? match[1] : null;
}

function mapLinesToOccurrences(input: string[], step: number = 3) {
  const occurrences: Occurrence[] = [];
  let single;

  for (let i = 0; i < input.length; i += step) {
    if (i + 1 >= input.length) break;

    const [fileName, callerLineNumber, ...callerLineContent] =
      input[i].split(/[=:]/);
    const [, definitionLineNumber, ...definitionLineContent] =
      input[i + 1].split(/[:]/);

    if (!single) single = extractSingle(definitionLineContent.join(':'));

    occurrences.push({
      fileName,
      context: {
        number: parseInt(callerLineNumber, 10),
        content: callerLineContent.join('=').trim()
      },
      matches: [
        {
          number: parseInt(definitionLineNumber, 10),
          content: definitionLineContent.join(':').trim()
        }
      ]
    });
  }

  return { occurrences, single };
}

const findDeclarations = async (query: string[], ignoredFolders: string[]) => {
  const searchQuery = `(async|function|public).*${query.join('[^ \\n]*')}`;

  outro(`Searching: ${searchQuery}`);

  const occurrences = await findInFiles({ query: searchQuery, ignoredFolders });

  if (!occurrences) return null;

  const declarations = mapLinesToOccurrences(occurrences.split('\n'));

  return declarations;
};

const findUsagesByDeclaration = async (
  declaration: string,
  ignoredFolders: string[]
) => {
  const searchQuery = `${declaration}\\(.*\\)`;

  const occurrences = await findInFiles({
    query: searchQuery,
    ignoredFolders
    // grepOptions: ['--function-context']
  });

  if (!occurrences) return null;

  const usages = mapLinesToOccurrences(
    occurrences.split('\n').filter(Boolean),
    2
  );

  return usages;
};

const buildCallHierarchy = async (
  query: string[],
  ignoredFolders: string[]
) => {};

const findInFiles = async ({
  query,
  ignoredFolders,
  grepOptions = []
}: {
  query: string;
  ignoredFolders: string[];
  grepOptions?: string[];
}): Promise<string | null> => {
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
    '--show-function', // show function caller
    '-n',
    '-i',
    ...grepOptions,
    '--break',
    '--color=never',

    // '-C',
    // '1',

    // '--full-name',
    // '--heading',
    '--threads',
    '10',
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
  const n = arr.length;
  const result: string[][] = [];
  const indices = new Int32Array(n);

  const current = new Array(n);

  for (let i = 0; i < n; i++) {
    indices[i] = i;
    current[i] = arr[i];
  }
  result.push([...current]);

  let i = 1;
  while (i < n) {
    if (indices[i] > 0) {
      const j = indices[i] % 2 === 1 ? 0 : indices[i];

      [current[i], current[j]] = [current[j], current[i]];
      result.push([...current]);
      indices[i]--;
      i = 1;
    } else {
      indices[i] = i;
      i++;
    }
  }

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

    outro(`No matches found. Searching semantically similar queries.`);

    searchSpinner.start(`Searching for matches...`);

    if (!declarations?.occurrences.length) {
      const allPossibleQueries = shuffleQuery(query).reverse();
      for (const possibleQuery of allPossibleQueries) {
        declarations = await findDeclarations(possibleQuery, ignoredFolders);
        if (declarations?.occurrences.length) break;
      }
    }

    if (!declarations?.occurrences.length) {
      searchSpinner.stop(`${chalk.red('✘')} No function declarations found.`);
      return process.exit(1);
    }

    const usages = await findUsagesByDeclaration(
      declarations.single,
      ignoredFolders
    );

    searchSpinner.stop(
      `${chalk.green('✔')} Found ${chalk.green(
        declarations.single
      )} definition and ${usages?.occurrences.length} usages.`
    );

    note(
      declarations.occurrences
        .map((o) =>
          o.matches
            .map(
              (m) =>
                `${o.fileName}:${m.number} ${chalk.cyan(
                  '==>'
                )} ${m.content.replace(
                  declarations.single,
                  chalk.green(declarations.single)
                )}`
            )
            .join('\n')
        )
        .join('\n'),
      '⍜ DECLARATIONS ⍜'
    );

    note(
      usages?.occurrences
        .map((o) =>
          o.matches.map(
            (m) =>
              `${o.fileName}:${m.number} ${chalk.cyan(
                '==>'
              )} ${m.content.replace(
                declarations.single,
                chalk.green(declarations.single)
              )}`
          )
        )
        .join('\n'),
      '⌾ USAGES ⌾'
    );

    const usage = (await select({
      message: chalk.cyan('Expand usage:'),
      options: usages!.occurrences
        .map((o) =>
          o.matches.map((m) => ({
            value: { o, m },
            label: `${chalk.yellow(`${o.fileName}:${m.number}`)} ${chalk.cyan(
              '==>'
            )} ${m.content.replace(
              declarations.single,
              chalk.green(declarations.single)
            )}`,
            hint: `parent: ${extractFuncName(o.context.content) ?? '404'}`
          }))
        )
        .flat()
    })) as { o: Occurrence; m: any };

    if (isCancel(usage)) process.exit(1);

    const { stdout } = await execa('git', [
      '--no-pager',
      'grep',
      '--function-context',
      '--heading',
      '-E',
      usage.m.content.replace('(', '\\(').replace(')', '\\)'),
      usage.o.fileName
    ]);

    const mermaidSpinner = spinner();
    mermaidSpinner.start('Generating mermaid diagram...');
    const mermaid: any = await generateMermaid(stdout);
    mermaidSpinner.stop();
    if (mermaid) console.log(mermaid.mermaid);
    else note('No mermaid diagram found.');

    const isCommitConfirmedByUser = await confirm({
      message: 'Create Excalidraw file?'
    });

    if (isCommitConfirmedByUser) outro('created diagram.excalidraw');
    else outro('Excalidraw file not created.');
  }
);
