import fs from 'fs';
import { homedir } from 'os';
import { join as pathJoin } from 'path';
import { migrations } from './_migrations';

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
  const completedMigrations = getCompletedMigrations();

  console.log('Completed migrations:', completedMigrations);
  console.log('Migration files:', migrations);

  for (const migration of migrations) {
    if (!completedMigrations.includes(migration.name)) {
      try {
        await migration.run();
        saveCompletedMigration(migration.name);
        console.log(`Migration ${migration.name} applied successfully.`);
      } catch (error) {
        console.error(`Failed to apply migration ${migration.name}:`, error);
      }
    }
  }
};
