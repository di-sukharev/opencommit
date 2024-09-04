import fs from 'fs';
import { homedir } from 'os';
import { join as pathJoin } from 'path';
import { migrations } from './_migrations';
import { outro } from '@clack/prompts';
import chalk from 'chalk';
import { getConfig, OCO_AI_PROVIDER_ENUM } from '../commands/config';

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
  const config = getConfig();
  if (config.OCO_AI_PROVIDER === OCO_AI_PROVIDER_ENUM.TEST) return;

  const completedMigrations = getCompletedMigrations();

  let isMigrated = false;

  for (const migration of migrations) {
    if (!completedMigrations.includes(migration.name)) {
      try {
        await migration.run();
        saveCompletedMigration(migration.name);
        outro(`Migration ${migration.name} applied successfully.`);
      } catch (error) {
        outro(
          `${chalk.red('Failed to apply migration')} ${
            migration.name
          }: ${error}`
        );
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
