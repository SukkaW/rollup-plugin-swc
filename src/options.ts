import { getTsconfig, parseTsconfig } from 'get-tsconfig';
import path from 'path';

export const getOptions = (
  cwd: string,
  tsconfig?: string
) => {
  if (tsconfig && path.isAbsolute(tsconfig)) {
    return parseTsconfig(tsconfig).compilerOptions ?? {};
  }

  let result = getTsconfig(cwd, tsconfig || 'tsconfig.json');
  // Only fallback to `jsconfig.json` when tsconfig can not be resolved AND custom tsconfig filename is not provided
  if (!result && !tsconfig) {
    result = getTsconfig(cwd, 'jsconfig.json');
  }

  return result?.config.compilerOptions ?? {};
};
