import { builtinModules } from 'module';

import { rollup } from 'rollup';

import dts from 'rollup-plugin-dts';
import { swc, defineRollupSwcOption } from '../src/index';

import pkg from '../package.json';
const deps = Object.keys(pkg.dependencies);
const peerDeps = Object.keys(pkg.peerDependencies);

const entries = {
  index: './src/index.ts',
  directive: './src/directive.ts'
};

async function main() {
  const external = [...deps, ...peerDeps, ...builtinModules];

  async function build() {
    const bundle = await rollup({
      input: entries,
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
      bundle.write({ dir: './dist/', entryFileNames: '[name].js', format: 'cjs', exports: 'named', interop: 'auto' }),
      bundle.write({ dir: './dist/', entryFileNames: '[name].mjs', format: 'esm', exports: 'named', interop: 'auto' })
    ]);
  }

  async function createDtsFile() {
    const bundle = await rollup({
      input: entries,
      external,
      plugins: [dts()]
    });

    return bundle.write({ dir: './dist/', entryFileNames: '[name].d.ts' });
  }

  return Promise.all([build(), createDtsFile()]).then(() => console.log('build finished!'));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
