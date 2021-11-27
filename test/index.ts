import path from 'path';
import fs from 'fs';
import { rollup, Plugin as RollupPlugin } from 'rollup';
import { swc, PluginOptions } from '../src';
import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';

import 'chai/register-should';

const tmpDir = path.join(__dirname, '.temp');

const realFs = (folderName: string, files: Record<string, string>) => {
  const testDir = path.join(tmpDir, `rollup-plugin-swc/${folderName}`);
  Object.keys(files).forEach((file) => {
    const absolute = path.join(testDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, files[file], 'utf8');
  });
  return testDir;
};

const build = async (
  options?: PluginOptions,
  {
    input = './fixture/index.js',
    otherRollupPlugins = [],
    sourcemap = false,
    dir = '.'
  }: {
    input?: string | string[]
    otherRollupPlugins?: RollupPlugin[]
    sourcemap?: boolean
    dir?: string
  } = {}
) => {
  const build = await rollup({
    input: [...(Array.isArray(input) ? input : [input])].map((v) => path.resolve(dir, v)),
    plugins: [...otherRollupPlugins, swc(options)]
  });
  const { output } = await build.generate({ format: 'esm', sourcemap });
  return output;
};

const getTestName = () => String(Date.now());

describe('swc', () => {
  before(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('simple', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        import Foo from './foo'
        console.log(Foo)
      `,
      './fixture/foo.tsx': `
        export default class Foo {
          render() {
            return <div className="hehe">hello there!!!</div>
          }
        }
      `
    });
    const output = await build({}, { dir });
    output[0].code.should.equal(`class Foo {
    render() {
        return(/*#__PURE__*/ React.createElement("div", {
            className: "hehe"
        }, "hello there!!!"));
    }
}

console.log(Foo);
`);
  });

  it('minify', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        import Foo from './foo'
        console.log(Foo)
      `,
      './fixture/foo.tsx': `
        export default class Foo {
          render() {
            return <div className="hehe">hello there!!!</div>
          }
        }
      `
    });
    const output = await build({ minify: true, jsc: { target: 'es2022' } }, { dir });
    output[0].code.should.equal(`class Foo{render(){return React.createElement("div",{className:"hehe"},"hello there!!!")}}console.log(Foo)
`);
  });

  it('load index.(x)', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        import Foo from './foo'
        console.log(Foo)
      `,
      './fixture/foo/index.tsx': `
        export default class Foo {
          render() {
            return <div className="hehe">hello there!!!</div>
          }
        }
      `
    });

    const output = await build({}, { dir });

    output[0].code.should.equal(`class Foo {
    render() {
        return(/*#__PURE__*/ React.createElement("div", {
            className: "hehe"
        }, "hello there!!!"));
    }
}

console.log(Foo);
`);
  });

  it('load json', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
          import foo from './foo.json'
          console.log(foo)
        `,
      './fixture/foo.json': `
        {
          "foo": true
        }
      `
    });

    const output = await build(
      {},
      { otherRollupPlugins: [json()], dir }
    );

    output[0].code.should.equal(`var foo = true;
var foo$1 = {
\tfoo: foo
};

console.log(foo$1);
`);
  });

  it('support rollup virtual module (e.g. commonjs plugin)', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        const Foo = require('./foo')
        const { Bar } = require('./bar')
        console.log(Foo, Bar)
      `,
      './fixture/foo.js': `
        module.exports = 'foo'
      `,
      './fixture/bar.js': `
        exports.Bar = 'bar'
      `
    });
    const output = await build(
      {},
      { otherRollupPlugins: [commonjs()], dir }
    );
    output[0].code.should.equal(`var fixture = {};

var foo = 'foo';

var bar = {};

bar.Bar = 'bar';

const Foo = foo;
const { Bar  } = bar;
console.log(Foo, Bar);

export { fixture as default };
`);
  });

  it('use custom jsxFactory (h) from tsconfig', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.tsx': `
        export const foo = <div>foo</div>
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": {
            "jsxFactory": "h"
          }
        }
      `
    });

    const output = await build({}, { input: './fixture/index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ h("div", null, "foo");

export { foo };
`);
  });

  it('use custom jsxFactory (h) from jsconfig.json', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.tsx': `
        export const foo = <div>foo</div>
      `,
      './fixture/jsconfig.json': `
        {
          "compilerOptions": {
            "jsxFactory": "h"
          }
        }
      `
    });

    const output = await build({}, { input: './fixture/index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ h("div", null, "foo");

export { foo };
`);
  });

  it('use tsconfig.json when tsconfig.json & jsconfig.json both exists', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.tsx': `
        export const foo = <div>foo</div>
      `,
      './fixture/jsconfig.json': `
        {
          "compilerOptions": {
            "jsxFactory": "h"
          }
        }
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": {
            "jsxFactory": "m"
          }
        }
    `
    });

    const output = await build({}, { input: './fixture/index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ m("div", null, "foo");

export { foo };
`);
  });

  it('use custom tsconfig.json', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.jsx': `
        export const foo = <div>foo</div>
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": {
            "jsxFactory": "h"
          }
        }
      `,
      './fixture/tsconfig.build.json': `
        {
          "compilerOptions": {
            "jsxFactory": "custom"
          }
        }
      `
    });

    const output = await build(
      { tsconfig: 'tsconfig.build.json' },
      { input: './fixture/index.jsx', dir }
    );
    output[0].code.should.equal(`var foo = /*#__PURE__*/ custom("div", null, "foo");

export { foo };
`);
  });
});
