import module from 'module';
import { rollup } from 'rollup';

import dts from 'rollup-plugin-dts';
import { swc } from '../src/index';

const pkg: { [k: string]: any } = require('../package.json');
const deps = Object.keys(pkg.dependencies);

async function main() {
  const external = [...deps, ...module.builtinModules]

  async function build() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [swc()],
    });

    return bundle.write({ file: './dist/index.js', format: 'cjs' });
  }

  async function createDtsFile() {
    const bundle = await rollup({
      input: './src/index.ts',
      external,
      plugins: [dts()],
    });

    return bundle.write({ file: './dist/index.d.ts' });
  }

  return Promise.all([build(), createDtsFile()]);
}

main().catch(err => {
  console.error(err)
  process.exit(1)
});
