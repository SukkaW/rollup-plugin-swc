import { getTsconfig, parseTsconfig } from 'get-tsconfig';
import path from 'path';

import type { TsConfigJson } from 'get-tsconfig';

const cache = new Map<string, TsConfigJson.CompilerOptions>();

export const getOptions = (
  cwd: string,
  tsconfig?: string
) => {
  const cacheKey = `${cwd}:${tsconfig ?? 'undefined'}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? {};
  }

  if (tsconfig && path.isAbsolute(tsconfig)) {
    const compilerOptions = parseTsconfig(tsconfig).compilerOptions ?? {};

    if (compilerOptions.baseUrl != null) {
      compilerOptions.baseUrl = path.resolve(path.dirname(tsconfig), compilerOptions.baseUrl);
    }

    cache.set(cacheKey, compilerOptions);
    return compilerOptions;
  }

  let result = getTsconfig(cwd, tsconfig || 'tsconfig.json');
  // Only fallback to `jsconfig.json` when tsconfig can not be resolved AND custom tsconfig filename is not provided
  if (!result && !tsconfig) {
    result = getTsconfig(cwd, 'jsconfig.json');
  }

  const compilerOptions = result?.config.compilerOptions ?? {};
  if (result?.path && compilerOptions.baseUrl != null) {
    compilerOptions.baseUrl = path.resolve(path.dirname(result.path), compilerOptions.baseUrl);
  }

  cache.set(cacheKey, compilerOptions);
  return compilerOptions;
};
