import { getTsconfig, parseTsconfig } from 'get-tsconfig';
import { resolve } from '@dual-bundle/import-meta-resolve';
import path from 'node:path';
import fs from 'node:fs';

import type { TsConfigJson } from 'get-tsconfig';
import type { TransformPluginContext } from 'rollup';
import { fileURLToPath, pathToFileURL } from 'node:url';

const cache = new Map<string, TsConfigJson.CompilerOptions>();

// TypeScript resolves `paths` without `baseUrl` relative to the tsconfig that sets `paths`,
// which can be an extended tsconfig. get-tsconfig keeps that directory under this symbol
function getImplicitBaseUrl(compilerOptions: TsConfigJson.CompilerOptions): string | undefined {
  const symbol = Object.getOwnPropertySymbols(compilerOptions).find((s) => s.description === 'implicitBaseUrl');
  const value: unknown = symbol && (compilerOptions as Record<symbol, unknown>)[symbol];
  return typeof value === 'string' ? value : undefined;
}

function resolveBaseUrl(compilerOptions: TsConfigJson.CompilerOptions, tsconfigPath: string) {
  if (compilerOptions.paths == null && compilerOptions.baseUrl == null) return;

  const tsconfigDir = path.dirname(tsconfigPath);
  compilerOptions.baseUrl = compilerOptions.baseUrl == null
    ? getImplicitBaseUrl(compilerOptions) ?? tsconfigDir
    : path.resolve(tsconfigDir, compilerOptions.baseUrl);
}

export function getOptions(
  ctx: TransformPluginContext,
  cwd: string,
  tsconfig?: string
) {
  const cacheKey = `${cwd}:${tsconfig ?? 'undefined'}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey) ?? {};
  }

  if (tsconfig && path.isAbsolute(tsconfig)) {
    const compilerOptions = parseTsconfig(tsconfig).compilerOptions ?? {};
    resolveBaseUrl(compilerOptions, tsconfig);

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
  if (result?.path) {
    resolveBaseUrl(compilerOptions, result.path);
  }

  cache.set(cacheKey, compilerOptions);
  return compilerOptions;
}

export function checkIsLegacyTypeScript() {
  try {
    const tsPath = resolve('typescript/package.json', typeof __filename === 'string' ? pathToFileURL(__filename).href : import.meta.url);
    const { version } = JSON.parse(fs.readFileSync(fileURLToPath(tsPath), 'utf-8'));
    const [major] = version.split('.', 1);
    // typescript 5+ enable experimentalDecorators by default so we think it's not legacy
    return +major < 5;
  } catch {
    return false;
  }
}
