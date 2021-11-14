import type { Plugin } from 'rollup';

import { existsSync, statSync } from 'fs'
import { extname, resolve, dirname, join } from 'path';
import { createFilter, FilterPattern } from '@rollup/pluginutils';
import { Config as SwcConfig, transform as swcTransform, JscTarget } from '@swc/core';

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

const resolveFile = (resolved: string, index: boolean = false) => {
  for (const ext of ['.ts', '.js', '.tsx', '.jsx']) {
    const file = index ? join(resolved, `index${ext}`) : `${resolved}${ext}`
    if (existsSync(file)) return file
  }
  return null
}

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
        )

        let file = resolveFile(resolved)
        if (file) return file
        if (!file && existsSync(resolved) && statSync(resolved).isDirectory()) {
          file = resolveFile(resolved, true)
          if (file) return file
        }
      }
    },

    async transform(code: string, id: string) {
      if (!filter(id)) {
        return null;
      }

      const ext = extname(id).slice(1);

      if (!['js', 'ts', 'jsx', 'tsx'].includes(ext)) return null;

      const tsconfigOptions =
        options.tsconfig === false
          ? {}
          : await getOptions(dirname(id), options.tsconfig);

      delete options.tsconfig;
      delete options.include;
      delete options.exclude;

      return swcTransform(code, {
        ...options,
        filename: id,
        jsc: {
          externalHelpers: options.jsc?.externalHelpers ?? tsconfigOptions.importHelpers,
          parser: {
            ...options.jsc?.parser,
            syntax: ext === 'ts' || ext === 'tsx' ? 'typescript' : 'ecmascript',
            decorators: options.jsc?.parser?.decorators ?? tsconfigOptions.experimentalDecorators
          },
          transform: {
            ...options.jsc?.transform,
            decoratorMetadata: options.jsc?.transform?.decoratorMetadata ?? tsconfigOptions.emitDecoratorMetadata,
            react: {
              ...options.jsc?.transform?.react,
              pragma: options.jsc?.transform?.react?.pragma ?? tsconfigOptions.jsxFactory,
              pragmaFrag: options.jsc?.transform?.react?.pragmaFrag ?? tsconfigOptions.jsxFragmentFactory
            },
          },
          target: options.jsc?.target ?? (tsconfigOptions.target as JscTarget | undefined),
          ...options.jsc
        },
        minify: false // Disable Minify during transform, do an overall minify when renderChunk
      });
    },

    renderChunk(code: string) {
      if (options.minify) {
        return swcTransform(code, {
          minify: options.minify,
          jsc: {
            minify: options.jsc?.minify,
            target: options.jsc?.target,
          }
        })
      }

      return null;
    }
  }
}

function defineRollupSwcOption(option: PluginOptions) {
  return option;
}

export { swc, defineRollupSwcOption };
