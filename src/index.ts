import type { Plugin } from 'rollup';

import { existsSync, statSync } from 'fs';
import { extname, resolve, dirname, join } from 'path';
import { createFilter, FilterPattern } from '@rollup/pluginutils';
import { Config as SwcConfig, JscTarget, transform as swcTransform, minify as swcMinify } from '@swc/core';
import deepmerge from 'deepmerge';

import { getOptions } from './options';

export type PluginOptions = {
  include?: FilterPattern
  exclude?: FilterPattern
  /**
   * Use given tsconfig file instead
   * Disable it by setting to `false`
   */
  tsconfig?: string | false
} & Pick<SwcConfig, Exclude<keyof SwcConfig, 'filename'>>;

const INCLUDE_REGEXP = /\.[jt]sx?$/;
const EXCLUDE_REGEXP = /node_modules/;

const resolveFile = (resolved: string, index = false) => {
  for (const ext of ['.ts', '.js', '.tsx', '.jsx']) {
    const file = index ? join(resolved, `index${ext}`) : `${resolved}${ext}`;
    if (existsSync(file)) return file;
  }
  return null;
};

function swc(options: PluginOptions = {}): Plugin {
  const filter = createFilter(
    options.include || INCLUDE_REGEXP,
    options.exclude || EXCLUDE_REGEXP
  );

  return {
    name: 'swc',

    resolveId(importee, importer) {
      if (importer && importee[0] === '.') {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          importee
        );

        let file = resolveFile(resolved);
        if (file) return file;
        if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
          file = resolveFile(resolved, true);
          if (file) return file;
        }
      }
    },

    async transform(code: string, id: string) {
      if (!filter(id)) {
        return null;
      }

      const ext = extname(id).slice(1);

      if (!['js', 'ts', 'jsx', 'tsx'].includes(ext)) return null;

      const isTypeScript = ext === 'ts' || ext === 'tsx';
      const isTsx = ext === 'tsx';
      const isJsx = ext === 'jsx';

      const tsconfigOptions
        = options.tsconfig === false
          ? {}
          : await getOptions(dirname(id), options.tsconfig);

      const swcOptionsFromTsConfig: SwcConfig = {
        jsc: {
          externalHelpers: tsconfigOptions.importHelpers,
          parser: {
            syntax: isTypeScript ? 'typescript' : 'ecmascript',
            tsx: isTypeScript ? isTsx : undefined,
            jsx: !isTypeScript ? isJsx : undefined,
            decorators: tsconfigOptions.experimentalDecorators
          },
          transform: {
            decoratorMetadata: tsconfigOptions.emitDecoratorMetadata,
            react: {
              pragma: tsconfigOptions.jsxFactory,
              pragmaFrag: tsconfigOptions.jsxFragmentFactory
            }
          },
          target: tsconfigOptions.target?.toLowerCase() as JscTarget | undefined
        }
      };

      const swcOption = deepmerge.all([
        swcOptionsFromTsConfig,
        options,
        {
          filename: id,
          include: undefined, // Rollup's filter is not compatible with swc
          exclude: undefined,
          tsconfig: undefined, // swc has no tsconfig option
          minify: false // Disable minify on transform, do it on renderChunk
        }
      ]);

      // TODO: \0 temp replacement can be removed
      // when this got fixed: https://github.com/swc-project/swc/issues/2853
      const slash0EscapeId = '\0';
      const tempString = '__SECRET_SLASH_0_ESCAPE_IDENTIFIER_DO_NOT_USE_OR_YOU_WILL_BE_FIRED__';
      // swc cannot transform module ids with "\0" (would throw
      // "error: Unterminated string constant"), which can be used by
      // some plugins (e.g. "@rollup/plugin-commonjs"), see:
      // - https://rollupjs.org/guide/en/#conventions
      // - https://github.com/rollup/plugins/blob/02fb349d315f0ffc55970fba5de20e23f8ead881/packages/commonjs/src/helpers.js#L15
      const { code: transformedCode, ...rest } = await swcTransform(
        code.replace(
          new RegExp(slash0EscapeId, 'g'), tempString
        ),
        swcOption
      );
      return {
        ...rest,
        code: transformedCode.replace(
          new RegExp(tempString, 'g'),
          slash0EscapeId
        )
      };
    },

    renderChunk(code: string) {
      if (options.minify) {
        return swcMinify(code, options.jsc?.minify);
      }

      return null;
    }
  };
}

function defineRollupSwcOption(option: PluginOptions) {
  return option;
}

export { swc, defineRollupSwcOption };
