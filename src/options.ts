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
  jsxFactory?: string;
  jsxFragmentFactory?: string;
  jsxImportSource?: string
  target?: string,
}> => {
  // This call is cached
  const { data, path } = await joycon.load([tsconfig || 'tsconfig.json'], cwd)
  if (path && data) {
    const {
      importHelpers,
      esModuleInterop,
      experimentalDecorators,
      emitDecoratorMetadata,
      jsxFactory,
      jsxFragmentFactory,
      jsxImportSource,
      target
    } = data.compilerOptions || {};
    return {
      importHelpers,
      esModuleInterop,
      experimentalDecorators,
      emitDecoratorMetadata,
      jsxFactory,
      jsxFragmentFactory,
      jsxImportSource,
      target
    }
  };
  return {}
}
