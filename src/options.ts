import { getTsconfig, parseTsconfig } from 'get-tsconfig';
import path from 'path';

import type { TsConfigJson } from 'get-tsconfig';
import type { TransformPluginContext } from 'rollup';

const cache = new Map<string, TsConfigJson.CompilerOptions>();

export const getOptions = (
  ctx: TransformPluginContext,
  cwd: string,
  tsconfig?: string
) => {
  const cacheKey = `${cwd}:${tsconfig ?? 'undefined'}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? {};
  }

  if (tsconfig && path.isAbsolute(tsconfig)) {
    const compilerOptions = parseTsconfig(tsconfig).compilerOptions ?? {};

    const tsconfigDir = path.dirname(tsconfig);
    if (compilerOptions.paths != null || compilerOptions.baseUrl != null) {
      compilerOptions.baseUrl = compilerOptions.baseUrl != null
        ? path.resolve(tsconfigDir, compilerOptions.baseUrl)
        : tsconfigDir;
    }

    cache.set(cacheKey, compilerOptions);
    return compilerOptions;
  }

  let result = getTsconfig(cwd, tsconfig || 'tsconfig.json');
  // Only fallback to `jsconfig.json` when tsconfig can not be resolved AND custom tsconfig filename is not provided
  if (!result && !tsconfig) {
    ctx.warn({
      message: 'Can\'t find tsconfig.json, trying jsconfig.json now',
      pluginCode: 'SWC_TSCONFIG_NOT_EXISTS'
    });
    result = getTsconfig(cwd, 'jsconfig.json');
  }

  const compilerOptions = result?.config.compilerOptions ?? {};
  if (compilerOptions.paths != null || compilerOptions.baseUrl != null) {
    if (result?.path) {
      const tsconfigDir = path.dirname(result.path);
      compilerOptions.baseUrl = compilerOptions.baseUrl != null
        ? path.resolve(tsconfigDir, compilerOptions.baseUrl)
        : tsconfigDir;
    }
  }

  cache.set(cacheKey, compilerOptions);
  return compilerOptions;
};
