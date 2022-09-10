import { getTsconfig } from 'get-tsconfig';

export const getOptions = async (
  cwd: string,
  tsconfig?: string
) => {
  let result = getTsconfig(cwd, tsconfig || 'tsconfig.json');
  if (!result) {
    result = getTsconfig(cwd, 'jsconfig.json');
  }

  return result?.config.compilerOptions ?? {};
};
