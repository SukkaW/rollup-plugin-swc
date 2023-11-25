import type { Plugin as RollupPlugin } from 'rollup';

import fs from 'fs';
import { extname, resolve, dirname, join } from 'path';
import { createFilter, type FilterPattern } from '@rollup/pluginutils';
import type {
  Options as SwcOptions,
  JscTarget,
  JsMinifyOptions
} from '@swc/core';
import {
  transform as swcTransform,
  minify as swcMinify
} from '@swc/core';
import createDeepMerge from '@fastify/deepmerge';

import { getOptions } from './options';

export type PluginOptions = {
  include?: FilterPattern,
  exclude?: FilterPattern,
  extensions?: string[] | undefined,
  /**
   * Use given tsconfig file instead
   * Disable it by setting to `false`
   */
  tsconfig?: string | false | undefined
} & Omit<SwcOptions, 'filename' | 'include' | 'exclude'>;

const INCLUDE_REGEXP = /\.[cm]?[jt]sx?$/;
const EXCLUDE_REGEXP = /node_modules/;

const ACCEPTED_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.cjs', '.jsx'];

const deepmerge = createDeepMerge({
  all: true,
  mergeArray(options) {
    // overwrite instead of concatenating arrays
    return (target, source) => options.clone(source);
  }
});

const fileExists = (path: string) => {
  return fs.promises.access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
};

function swc(options: PluginOptions = {}): RollupPlugin {
  const filter = createFilter(
    options.include || INCLUDE_REGEXP,
    options.exclude || EXCLUDE_REGEXP
  );

  const extensions = options.extensions || ACCEPTED_EXTENSIONS;

  const resolveFile = async (resolved: string, index = false) => {
    const fileWithoutExt = resolved.replace(INCLUDE_REGEXP, '');

    for (const ext of extensions) {
      const file = index ? join(resolved, `index${ext}`) : `${fileWithoutExt}${ext}`;
      // We need to respect the order, and we only check one file at a time, and we can return early
      // eslint-disable-next-line no-await-in-loop -- see above
      if (await fileExists(file)) return file;
    }
    return null;
  };

  return {
    name: 'swc',
    async resolveId(importee, importer) {
      // ignore IDs with null character, these belong to other plugins
      if (importee.startsWith('\0')) {
        return null;
      }

      if (importer && importee.startsWith('.')) {
        const resolved = resolve(
          importer ? dirname(importer) : process.cwd(),
          importee
        );

        let file = await resolveFile(resolved);
        if (file) return file;
        if (!file && await fileExists(resolved) && (await fs.promises.stat(resolved)).isDirectory()) {
          file = await resolveFile(resolved, true);
          if (file) return file;
        }
      }
    },

    async transform(code: string, id: string) {
      if (!filter(id)) {
        return null;
      }

      const ext = extname(id);
      if (!extensions.includes(ext)) return null;

      const isTypeScript = ext === '.ts' || ext === '.mts' || ext === '.cts' || ext === '.tsx';
      const isTsx = ext === '.tsx';
      const isJsx = ext === '.jsx';

      const tsconfigOptions
        = options.tsconfig === false
          ? {}
          : getOptions(this, dirname(id), options.tsconfig);

      let enaleExperimentalDecorators = false;
      if (isTypeScript) {
        try {
          const packageJsonPath = require.resolve('typescript/package.json', { paths: [process.cwd()] });
          const { version } = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
          const [major] = version.split('.');
          // typescript 5.x
          if (+major >= 5) enaleExperimentalDecorators = true;
        } catch {
          this.warn({
            message: 'Failed to find TypeScript. Please check if TypeScript has been installed.',
            pluginCode: 'SWC_TYPESCRIPT_NOT_EXISTS'
          });
        }
      }

      // TODO: SWC is about to add "preserve" jsx
      // https://github.com/swc-project/swc/pull/5661
      // Respect "preserve" after swc adds the support
      const useReact17NewTransform = tsconfigOptions.jsx === 'react-jsx' || tsconfigOptions.jsx === 'react-jsxdev';

      const swcOptionsFromTsConfig: SwcOptions = {
        jsc: {
          externalHelpers: tsconfigOptions.importHelpers,
          parser: {
            syntax: isTypeScript ? 'typescript' : 'ecmascript',
            [isTypeScript ? 'tsx' : 'jsx']: isTypeScript ? isTsx : isJsx,
            decorators: enaleExperimentalDecorators || tsconfigOptions.experimentalDecorators
          },
          transform: {
            decoratorMetadata: tsconfigOptions.emitDecoratorMetadata,
            // @ts-expect-error -- swc types loose this :(
            decoratorVersion: enaleExperimentalDecorators ? '2022-03' : '2021-12',
            react: {
              runtime: useReact17NewTransform
                ? 'automatic'
                : 'classic',
              importSource: tsconfigOptions.jsxImportSource,
              pragma: tsconfigOptions.jsxFactory,
              pragmaFrag: tsconfigOptions.jsxFragmentFactory,
              development: tsconfigOptions.jsx === 'react-jsxdev' ? true : undefined
            }
          },
          target: tsconfigOptions.target?.toLowerCase() as JscTarget | undefined,
          baseUrl: tsconfigOptions.baseUrl,
          paths: tsconfigOptions.paths
        }
      };

      const {
        // @ts-expect-error -- We have to make sure that we don't pass these options to swc
        filename: _1, // We will use `id` from rollup instead
        include: _2, // Rollup's filter is incompatible with swc's filter
        exclude: _3,
        tsconfig: _4, // swc doesn't have tsconfig option
        extensions: _5, // swc doesn't have extensions option
        minify: _6, // We will disable minify during transform, and perform minify in renderChunk
        ...restSwcOptions
      } = options;

      const swcOption = deepmerge<SwcOptions[]>(
        swcOptionsFromTsConfig,
        restSwcOptions,
        {
          jsc: {
            minify: undefined // Disable minify on transform, do it on renderChunk
          },
          filename: id,
          minify: false // Disable minify on transform, do it on renderChunk
        }
      );

      return swcTransform(
        code,
        swcOption
      );
    },

    renderChunk(code: string) {
      if (options.minify || options.jsc?.minify?.mangle || options.jsc?.minify?.compress) {
        return swcMinify(code, {
          ...options.jsc?.minify,
          module: true
        });
      }

      return null;
    }
  };
}

function minify(options: JsMinifyOptions = {}): RollupPlugin {
  return {
    name: 'swc-minify',

    renderChunk(code: string) {
      return swcMinify(code, options);
    }
  };
}

function defineRollupSwcOption(option: PluginOptions) {
  return option;
}

function defineRollupSwcMinifyOption(option: JsMinifyOptions) {
  return option;
}

export default swc;
export { swc, defineRollupSwcOption, minify, defineRollupSwcMinifyOption };
export { preserveUseDirective } from './directive';
