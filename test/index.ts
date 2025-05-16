import path from 'node:path';
import fsp from 'node:fs/promises';
import process from 'node:process';

import { fdir as Fdir } from 'fdir';

import { rollup as rollup2 } from 'rollup2';
import { rollup as rollup3 } from 'rollup3';
import { rollup as rollup4 } from 'rollup';
import type { Plugin as RollupPlugin, ExternalOption, InputOption, RollupOutput } from 'rollup';

import type { PluginOptions } from '../src';
import { swc, minify, preserveUseDirective } from '../src';

import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

import type { JsMinifyOptions } from '@swc/core';

import { create, destroy } from 'memdisk';

import { sync as whichSync } from 'which';
import { exec } from 'tinyexec';
import { jestExpect as expect } from 'mocha-expect-snapshot';
import 'mocha-expect-snapshot';

function rollupInvriant(v: RollupOutput['output'][number] | undefined | null) {
  if (v == null) {
    throw new Error('Invariant failed');
  }
  if (!('code' in v)) {
    throw new Error('Non rollup output module found!');
  }
  return v;
}

async function build(rollupImpl: typeof rollup2 | typeof rollup3 | typeof rollup4,
  options?: PluginOptions,
  {
    input = './index.js',
    otherRollupPlugins = [],
    otherRollupPluginsAfterSwc = [],
    sourcemap = false,
    dir = '.',
    external
  }: {
    input?: InputOption,
    otherRollupPlugins?: RollupPlugin[],
    otherRollupPluginsAfterSwc?: RollupPlugin[],
    sourcemap?: boolean,
    dir?: string,
    external?: ExternalOption
  } = {}) {
  const build = await rollupImpl({
    input: (() => {
      if (typeof input === 'string') {
        return path.resolve(dir, input);
      }
      if (Array.isArray(input)) {
        return input.map((v) => path.resolve(dir, v));
      }
      return Object.entries(input).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = path.resolve(dir, value);
        return acc;
      }, {});
    })(),
    ...(
      rollupImpl === rollup2
        ? {}
        : { logLevel: 'silent' }
    ),
    plugins: [...otherRollupPlugins, swc(options), ...otherRollupPluginsAfterSwc] as any,
    external
  });
  const { output } = await build.generate({ format: 'esm', sourcemap });
  return output;
}

async function runMinify(rollupImpl: typeof rollup2 | typeof rollup3 | typeof rollup4,
  options: JsMinifyOptions,
  {
    input = './index.js',
    otherRollupPlugins = [],
    sourcemap = false,
    dir = '.'
  }) {
  const build = await rollupImpl({
    input: [...(Array.isArray(input) ? input : [input])].map((v) => path.resolve(dir, v)),
    plugins: [...otherRollupPlugins, minify(options)] as any
  });
  const { output } = await build.generate({ format: 'esm', sourcemap });
  return output;
}

function tests(
  rollupImpl: typeof rollup2 | typeof rollup3 | typeof rollup4,
  isolateDir: string,
  packageManager: string
) {
  const fixture = async (fixtureName: string) => {
    const fixtureDir = path.join(__dirname, 'fixtures', fixtureName);
    const testDir = path.join(isolateDir, 'rollup-plugin-swc', fixtureName);

    let requireInstall = false;
    const dirs = new Set<string>();
    const files: Array<[from: string, to: string]> = [];

    const entries = await new Fdir()
      .withRelativePaths()
      .crawl(fixtureDir)
      .withPromise();

    for (const entry of entries) {
      const from = fixtureDir + path.sep + entry;
      const to = path.join(testDir, entry);
      const toDir = path.dirname(to);

      dirs.add(toDir);
      files.push([from, to]);

      if (entry === 'package.json') {
        // eslint-disable-next-line no-await-in-loop -- concurrent fs operation
        const pkg = JSON.parse(await fsp.readFile(from, 'utf8'));
        if (pkg.devDependencies || pkg.dependencies) {
          requireInstall = true;
        }
      }
    }

    await Promise.all(Array.from(dirs).map(dir => fsp.mkdir(dir, { recursive: true })));
    await Promise.all(files.map(([from, to]) => fsp.copyFile(from, to)));

    if (requireInstall) {
      await exec(packageManager, ['install'], { throwOnError: true, nodeOptions: { cwd: testDir } });
    }

    return testDir;
  };

  it('simple', async () => {
    const dir = await fixture('simple');
    const output = await build(rollupImpl, {}, { dir });
    expect(output[0]).toMatchSnapshot();
  });

  it('minify', async () => {
    const dir = await fixture('minify');
    const output = await build(rollupImpl, { minify: true, jsc: { target: 'es2022' } }, { dir });
    expect(output[0]).toMatchSnapshot();
  });

  it('standalone minify', async () => {
    const dir = await fixture('standalone-minify');
    const output = await runMinify(rollupImpl, {}, { dir });
    expect(output[0]).toMatchSnapshot();
  });

  it('resolve index.(x)', async () => {
    const dir = await fixture('resolve-index');
    const output = await build(rollupImpl, { jsc: { target: 'es2022' } }, { dir });

    expect(output[0]).toMatchSnapshot();
  });

  it('load json', async () => {
    const dir = await fixture('load-json');

    const output = await build(
      rollupImpl,
      {},
      { otherRollupPlugins: [json()], dir }
    );

    expect(output[0]).toMatchSnapshot();
  });

  it('support rollup virtual module (e.g. commonjs plugin)', async () => {
    const dir = await fixture('rollup-commonjs');
    const output = await build(
      rollupImpl,
      { jsc: { target: 'es2022' } },
      { otherRollupPlugins: [commonjs()], dir }
    );
    expect(output[0]).toMatchSnapshot();
  });

  it('use custom jsxFactory (h) from tsconfig', async () => {
    const dir = await fixture('tsconfig-custom-jsx-factory');

    const output = await build(rollupImpl, {}, { input: './index.tsx', dir });
    expect(output[0]).toMatchSnapshot();
  });

  it('use custom jsxFactory (h) from jsconfig.json', async () => {
    const dir = await fixture('jsconfig-custom-jsx-factory');

    const output = await build(rollupImpl, {}, { input: './index.tsx', dir });
    expect(output[0]).toMatchSnapshot();
  });

  it('react 17 jsx transform', async () => {
    const dir = await fixture('react-17-jsx-transform');

    expect((
      await build(rollupImpl, { tsconfig: 'tsconfig.react-jsx.json' }, { input: './index.tsx', dir, external: 'react/jsx-runtime' })
    )[0].code).toMatchSnapshot();

    expect((
      await build(rollupImpl, { tsconfig: 'tsconfig.compiled.json' }, { input: './index.tsx', dir, external: '@compiled/react/jsx-runtime' })
    )[0].code).toMatchSnapshot();
  });

  it('use tsconfig.json when tsconfig.json & jsconfig.json both exists', async () => {
    const dir = await fixture('tsconfig-jsconfig');

    const output = await build(rollupImpl, {}, { input: './index.tsx', dir });
    expect(output[0]).toMatchSnapshot();
  });

  it('use custom tsconfig.json', async () => {
    const dir = await fixture('custom-tsconfig');

    const output = await build(
      rollupImpl,
      { tsconfig: 'tsconfig.build.json' },
      { input: './index.jsx', dir }
    );
    expect(output[0]).toMatchSnapshot();
  });

  it('disable reading tsconfig.json', async () => {
    const dir = await fixture('disable-reading-tsconfig');

    const output = await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.jsx', dir }
    );
    expect(output[0]).toMatchSnapshot();
  });

  it('load jsx/tsx', async () => {
    const dir = await fixture('load-jsx-tsx');

    const output = await build(rollupImpl, { jsc: { target: 'es2022' } }, { dir });
    expect(output[0]).toMatchSnapshot();
  });

  it('tsconfig extends', async () => {
    const dir = await fixture('tsconfig-extends');

    expect((await build(
      rollupImpl,
      {},
      { input: './index.jsx', dir }
    ))[0].code).toMatchSnapshot();

    expect((await build(
      rollupImpl,
      { tsconfig: 'jsconfig.custom.json' },
      { input: './index.jsx', dir }
    ))[0].code).toMatchSnapshot();
  });

  it('tsconfig resolve to nearest tsconfig', async () => {
    const dir = await fixture('tsconfig-resolve-to-nearest-tsconfig');

    expect((await build(
      rollupImpl,
      {},
      { input: './index.jsx', dir }
    ))[0].code).toMatchSnapshot();
  });

  it('tsconfig - specify full path', async () => {
    const dir = await fixture('tsconfig-full-path');

    const tsconfigPath = path.resolve(dir, './foo/bar/tsconfig.json');

    expect((await build(
      rollupImpl,
      { tsconfig: tsconfigPath },
      { input: './index.jsx', dir }
    ))[0].code).toMatchSnapshot();
  });

  it('tsconfig - baseUrl & paths', async () => {
    const dir = await fixture('tsconfig-baseurl-paths');

    expect((await build(
      rollupImpl,
      {},
      { input: './src/index.ts', dir }
    ))[0].code).toMatchSnapshot();
  });

  it('tsconfig - paths', async () => {
    const dir = await fixture('tsconfig-paths');

    expect((await build(
      rollupImpl,
      {},
      { input: './src/index.ts', dir }
    ))[0].code).toMatchSnapshot();
  });

  it('target - include other files', async () => {
    const dir = await fixture('extensions');

    expect((await build(
      rollupImpl,
      { extensions: ['.ts', '.mts', '.cts'], tsconfig: false },
      { input: './index.mts', dir, otherRollupPlugins: [commonjs({ extensions: ['.cts'] })] }
    ))[0].code).toMatchSnapshot();
  });

  it('directive - include "use client"', async () => {
    const dir = await fixture('directive-include-use-client');

    expect((await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.tsx', dir, otherRollupPluginsAfterSwc: [preserveUseDirective()] }
    ))[0].code).toMatchSnapshot();
  });

  it('directive - merge "use client"', async () => {
    const dir = await fixture('directive-merge-use-client');

    expect((await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.tsx', dir, otherRollupPluginsAfterSwc: [preserveUseDirective()] }
    ))[0].code).toMatchSnapshot();
  });

  it('directive - only output "use client" / "use server" in the specfic entry', async () => {
    const dir = await fixture('directive-split-entry');

    const output = (await build(
      rollupImpl,
      { tsconfig: false },
      {
        input: {
          client: './client.ts',
          server: './server.ts'
        },
        dir, otherRollupPluginsAfterSwc: [preserveUseDirective()]
      }
    ));

    expect(rollupInvriant(output.find(i => i.fileName === 'client.js') as any).code).toMatchSnapshot();
    expect(rollupInvriant(output.find(i => i.fileName === 'server.js') as any).code).toMatchSnapshot();
  });

  it('issue 58 - eventemitter3', async () => {
    const dir = await fixture('issue-58');

    expect((await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.ts', dir, otherRollupPlugins: [nodeResolve(), commonjs()] }
    ))[0].code).toMatchSnapshot();
  });

  it('issue 63 - tsconfig baseUrl only + relative baseUrl', async () => {
    const dir = await fixture('tsconfig-base-url-only-relative-issue-63');

    expect((await build(
      rollupImpl,
      { tsconfig: false },
      { input: './src/index.ts', dir, otherRollupPlugins: [nodeResolve(), commonjs()] }
    ))[0].code).toMatchSnapshot();
  });

  it('detect decorator for typescript5', async () => {
    const dir = await fixture('decorators');
    expect((await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.ts', dir }
    ))[0].code).toMatchSnapshot();
  });
  it('detect legacy decorator for typescript5', async () => {
    const dir = await fixture('legacy-decorators');
    expect((await build(
      rollupImpl,
      {},
      { input: './index.ts', dir }
    ))[0].code).toMatchSnapshot();
  });
}

describe('rollup-plugin-swc3', () => {
  const packageManager = whichSync('pnpm', { nothrow: true }) || 'npm';

  const ramDiskPath = create.sync('rolluppluginswc3test', 64 * 1024 * 1024, { quiet: false });

  describe('swc (rollup 2)', () => {
    const isolateDir = path.join(ramDiskPath, 'rollup2');
    tests(rollup2, isolateDir, packageManager);
  });

  describe('swc (rollup 3)', () => {
    const isolateDir = path.join(ramDiskPath, 'rollup3');
    tests(rollup3, isolateDir, packageManager);
  });

  describe('swc (rollup 4)', () => {
    const isolateDir = path.join(ramDiskPath, 'rollup4');
    tests(rollup4, isolateDir, packageManager);
  });

  after((done) => {
    process.nextTick(() => {
      destroy.sync(ramDiskPath, { quiet: false });
      done();
    });
  });
});
