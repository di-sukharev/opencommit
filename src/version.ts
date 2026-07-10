const NPM_REGISTRY = 'https://registry.npmjs.org';
const PACKAGE_NAME = 'opencommit';

type NpmLatestResponse = {
  version?: string;
};

export const getOpenCommitLatestVersion = async (): Promise<
  string | undefined
> => {
  try {
    const response = await fetch(`${NPM_REGISTRY}/${PACKAGE_NAME}/latest`);

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as NpmLatestResponse;
    return data.version;
  } catch {
    return undefined;
  }
};
