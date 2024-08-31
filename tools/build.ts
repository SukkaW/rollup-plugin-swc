import { builtinModules } from 'node:module';
import process from 'node:process';

import { rollup, VERSION } from 'rollup';

import dts from 'rollup-plugin-dts';
import { swc, defineRollupSwcOption } from '../src/index';

import pkg from '../package.json';
const deps = Object.keys(pkg.dependencies);
const peerDeps = Object.keys(pkg.peerDependencies);

async function main() {
  const external = [...deps, ...peerDeps, ...builtinModules];

  async function build() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [swc(defineRollupSwcOption({
        jsc: {
          target: 'es2019',
          minify: {
            compress: true,
            mangle: true,
            module: true
          }
        },
        minify: true
        // The return type of swc() is `import('rollup2').Plugin` while the required type is `import('rollup3').Plugin`
        // Although they are identical, typescript is not happy about that
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
      })) as any]
    });

    return Promise.all([
      bundle.write({ file: './dist/index.js', format: 'cjs', exports: 'named', interop: 'auto' }),
      bundle.write({ file: './dist/index.mjs', format: 'esm', exports: 'named', interop: 'auto' })
    ]);
  }

  async function createDtsFile() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [dts()]
    });

    return bundle.write({ file: './dist/index.d.ts' });
  }

  console.log('rollup version', VERSION);

  return Promise.all([build(), createDtsFile()]).then(() => console.log('build finished!'));
}

main().catch(err => {
  console.error(err);
  // eslint-disable-next-line sukka/unicorn/no-process-exit -- CLI tool
  process.exit(1);
});
