import { builtinModules } from 'module';

import { rollup as rollup2 } from 'rollup';
import { rollup as rollup3 } from 'rollup3';

import dts from 'rollup-plugin-dts';
import { swc, defineRollupSwcOption } from '../src/index';

import pkg from '../package.json';
const deps = Object.keys(pkg.dependencies);
const peerDeps = Object.keys(pkg.peerDependencies);

async function main() {
  const external = [...deps, ...peerDeps, ...builtinModules];

  async function build() {
    const bundle = await rollup3({
      input: './src/index.ts',
      external,
      plugins: [swc(defineRollupSwcOption({
        jsc: {
          target: 'es2019'
        }
      // The return type of swc() is `import('rollup2').Plugin` while the required type is `import('rollup3').Plugin`
      // Although they are identical, typescript is not happy about that
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as any]
    });

    return Promise.all([
      bundle.write({ file: './dist/index.js', format: 'cjs', exports: 'named', interop: 'auto' }),
      bundle.write({ file: './dist/index.mjs', format: 'esm', exports: 'named', interop: 'auto' })
    ]);
  }

  async function createDtsFile() {
    // rollup-plugin-dts not yet support rollup 3, use rollup 2 to build the d.ts file
    const bundle = await rollup2({
      input: './src/index.ts',
      external,
      plugins: [dts()]
    });

    return bundle.write({ file: './dist/index.d.ts' });
  }

  return Promise.all([build(), createDtsFile()]);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
