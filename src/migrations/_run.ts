import fs from 'fs';
import { homedir } from 'os';
import { join as pathJoin } from 'path';
import { migrations } from './_migrations';
import { outro } from '@clack/prompts';
import chalk from 'chalk';
import {
  getConfig,
  getIsGlobalConfigFileExist,
  OCO_AI_PROVIDER_ENUM
} from '../commands/config';

const migrationsFile = pathJoin(homedir(), '.opencommit_migrations');

const getCompletedMigrations = (): string[] => {
  if (!fs.existsSync(migrationsFile)) {
    return [];
  }
  const data = fs.readFileSync(migrationsFile, 'utf-8');
  return data ? JSON.parse(data) : [];
};

const saveCompletedMigration = (migrationName: string) => {
  const completedMigrations = getCompletedMigrations();
  completedMigrations.push(migrationName);
  fs.writeFileSync(
    migrationsFile,
    JSON.stringify(completedMigrations, null, 2)
  );
};

export const runMigrations = async () => {
  // if no config file, we assume it's a new installation and no migrations are needed
  if (!getIsGlobalConfigFileExist()) return;

  const config = getConfig();
  if (config.OCO_AI_PROVIDER === OCO_AI_PROVIDER_ENUM.TEST) return;

  // skip unhandled providers in migration00
  if (
    [
      OCO_AI_PROVIDER_ENUM.DEEPSEEK,
      OCO_AI_PROVIDER_ENUM.GROQ,
      OCO_AI_PROVIDER_ENUM.MISTRAL,
      OCO_AI_PROVIDER_ENUM.MLX,
      OCO_AI_PROVIDER_ENUM.OPENROUTER,
    ].includes(config.OCO_AI_PROVIDER)
  ) {
    return;
  }

  const completedMigrations = getCompletedMigrations();

  let isMigrated = false;

  for (const migration of migrations) {
    if (!completedMigrations.includes(migration.name)) {
      try {
        console.log('Applying migration', migration.name);
        migration.run();
        console.log('Migration applied successfully', migration.name);
        saveCompletedMigration(migration.name);
      } catch (error) {
        outro(
          `${chalk.red('Failed to apply migration')} ${
            migration.name
          }: ${error}`
        );
        process.exit(1);
      }

      isMigrated = true;
    }
  }

  if (isMigrated) {
    outro(
      `${chalk.green(
        '✔'
      )} Migrations to your config were applied successfully. Please rerun.`
    );
    process.exit(0);
  }
};
