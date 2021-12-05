import fs from 'fs';
import JoyCon from 'joycon';
import { parse } from 'jsonc-parser';

const joycon = new JoyCon();

joycon.addLoader({
  test: /\.json$/,
  load: async (file) => {
    const content = await fs.promises.readFile(file, { encoding: 'utf-8' });
    return parse(content);
  }
});

export const getOptions = async (
  cwd: string,
  tsconfig?: string
): Promise<{
  importHelpers?: boolean,
  esModuleInterop?: boolean,
  experimentalDecorators?: boolean,
  emitDecoratorMetadata?: boolean,
  jsxFactory?: string,
  jsxFragmentFactory?: string,
  jsxImportSource?: string,
  target?: string,
  baseUrl?: string,
  paths?: { [from: string]: [string] }
}> => {
  // joycon has its builtin-cache support
  const { data, path } = await joycon.load([tsconfig || 'tsconfig.json', 'jsconfig.json'], cwd);
  if (path && data) {
    const {
      importHelpers,
      esModuleInterop,
      experimentalDecorators,
      emitDecoratorMetadata,
      jsxFactory,
      jsxFragmentFactory,
      jsxImportSource,
      target,
      baseUrl,
      paths
    } = data.compilerOptions || {};
    return {
      importHelpers,
      esModuleInterop,
      experimentalDecorators,
      emitDecoratorMetadata,
      jsxFactory,
      jsxFragmentFactory,
      jsxImportSource,
      target,
      baseUrl,
      paths
    };
  }
  return {};
};
