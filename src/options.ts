import { getTsconfig, parseTsconfig } from 'get-tsconfig';
import { resolve } from '@dual-bundle/import-meta-resolve';
import path from 'node:path';
import fs from 'node:fs';

import type { TsConfigJson } from 'get-tsconfig';
import type { TransformPluginContext } from 'rollup';
import { fileURLToPath } from 'node:url';

const cache = new Map<string, TsConfigJson.CompilerOptions>();

const tsExperimentCache = new Map<string, boolean>();

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
      compilerOptions.baseUrl = compilerOptions.baseUrl == null
        ? tsconfigDir
        : path.resolve(tsconfigDir, compilerOptions.baseUrl);
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
  if (
    (compilerOptions.paths != null || compilerOptions.baseUrl != null)
    && result?.path
  ) {
    const tsconfigDir = path.dirname(result.path);
    compilerOptions.baseUrl = compilerOptions.baseUrl == null
      ? tsconfigDir
      : path.resolve(tsconfigDir, compilerOptions.baseUrl);
  }

  cache.set(cacheKey, compilerOptions);
  return compilerOptions;
};

export const getEnableExperimentalDecorators = (
  ctx: TransformPluginContext, isTypeScript: boolean, cwd: string, key?: string | boolean
) => {
  if (!isTypeScript) return false;
  const cacheKey = `${cwd}:${key ?? 'undefined'}`;
  if (tsExperimentCache.has(cacheKey)) {
    return tsExperimentCache.get(cacheKey) ?? false;
  }
  try {
    // @ts-expect-error -- It's required to using 'import.mtea.url' but i don't want to change the tsconfig.
    const tsPath = resolve('typescript/package.json', import.meta.url);
    const { version } = JSON.parse(fs.readFileSync(fileURLToPath(tsPath), 'utf-8'));
    const [major] = version.split('.');
    // Only enable experimental decorators for TypeScript 5+
    if (+major >= 5) {
      tsExperimentCache.set(cacheKey, true);
      return true;
    }
    tsExperimentCache.set(cacheKey, false);
    return false;
  } catch {
    ctx.warn({
      message: 'Failed to find TypeScript. Please check if TypeScript has been installed.',
      pluginCode: 'SWC_TYPESCRIPT_NOT_EXISTS'
    });
    return false;
  }
};
