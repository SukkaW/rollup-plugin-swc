import path from 'path';
import fs from 'fs';
import { rollup } from 'rollup2';
import { rollup as rollup3, type Plugin as RollupPlugin, type ExternalOption } from 'rollup';

import type { PluginOptions } from '../src';
import { swc, minify } from '../src';

import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import { tmpdir } from 'os';

import type { JsMinifyOptions } from '@swc/core';

import { should } from 'chai';
should();

const tmpDir = path.join(tmpdir() ?? __dirname, '.temp-rollup-plugin-swc-testing');

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
  rollupImpl: typeof rollup | typeof rollup3,
  options?: PluginOptions,
  {
    input = './fixture/index.js',
    otherRollupPlugins = [],
    sourcemap = false,
    dir = '.',
    external
  }: {
    input?: string | string[]
    otherRollupPlugins?: RollupPlugin[]
    sourcemap?: boolean
    dir?: string,
    external?: ExternalOption
  } = {}
) => {
  const build = await rollupImpl({
    input: [...(Array.isArray(input) ? input : [input])].map((v) => path.resolve(dir, v)),
    plugins: [...otherRollupPlugins, swc(options)] as any,
    external
  });
  const { output } = await build.generate({ format: 'esm', sourcemap });
  return output;
};

const runMinify = async (
  options: JsMinifyOptions,
  {
    input = './fixture/index.js',
    otherRollupPlugins = [],
    sourcemap = false,
    dir = '.'
  }
) => {
  const build = await rollup({
    input: [...(Array.isArray(input) ? input : [input])].map((v) => path.resolve(dir, v)),
    plugins: [...otherRollupPlugins, minify(options)] as any
  });
  const { output } = await build.generate({ format: 'esm', sourcemap });
  return output;
};

const getTestName = () => String(Date.now());

const tests = (rollupImpl: typeof rollup | typeof rollup3) => {
  it('simple', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        import Foo from './foo'
        console.log(Foo)
        import bar from './bar'
        console.log(bar)
      `,
      './fixture/foo.tsx': `
        export default class Foo {
          render() {
            return <div className="hehe">hello there!!!</div>
          }
        }
      `,
      './fixture/bar.mjs': `
        const bar = 'baz'
        export default bar
      `
    });
    const output = await build(rollupImpl, {}, { dir });
    output[0].code.should.equal(`function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
var Foo = /*#__PURE__*/ function() {
    function Foo() {
        _class_call_check(this, Foo);
    }
    _create_class(Foo, [
        {
            key: "render",
            value: function render() {
                return /*#__PURE__*/ React.createElement("div", {
                    className: "hehe"
                }, "hello there!!!");
            }
        }
    ]);
    return Foo;
}();

var bar = "baz";

console.log(Foo);
console.log(bar);\n`);
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
    const output = await build(rollupImpl, { minify: true, jsc: { target: 'es2022' } }, { dir });
    output[0].code.should.equal('class Foo{render(){return React.createElement("div",{className:"hehe"},"hello there!!!")}}console.log(Foo);\n');
  });

  it('standalone minify', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        console.log(10000);
        console.log('b'      +      'c');
      `
    });
    const output = await runMinify({}, { dir });
    output[0].code.should.equal('console.log(1e4),console.log("bc");\n');
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

    const output = await build(rollupImpl, { jsc: { target: 'es2022' } }, { dir });

    output[0].code.should.equal(`class Foo {
    render() {
        return /*#__PURE__*/ React.createElement("div", {
            className: "hehe"
        }, "hello there!!!");
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
      rollupImpl,
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
      rollupImpl,
      { jsc: { target: 'es2022' } },
      { otherRollupPlugins: [commonjs()], dir }
    );
    output[0].code.should.equal(`var fixture = {};

var foo = 'foo';

var bar = {};

bar.Bar = 'bar';

const Foo = foo;
const { Bar } = bar;
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

    const output = await build(rollupImpl, {}, { input: './fixture/index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ h("div", null, "foo");

export { foo };\n`);
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

    const output = await build(rollupImpl, {}, { input: './fixture/index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ h("div", null, "foo");

export { foo };\n`);
  });

  it('react 17 jsx transform', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.tsx': `
        export function Foo() { return <div>foo</div> }
      `,
      './fixture/tsconfig.react-jsx.json': `
        {
          "compilerOptions": {
            "jsx": "react-jsx"
          }
        }
      `,
      './fixture/tsconfig.react-jsxdev.json': `
        {
          "compilerOptions": {
            "jsx": "react-jsxdev"
          }
        }
      `,
      './fixture/tsconfig.compiled.json': `
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "jsxImportSource": "@compiled/react"
          }
        }
      `
    });

    (
      await build(rollupImpl, { tsconfig: 'tsconfig.react-jsx.json' }, { input: './fixture/index.tsx', dir, external: 'react/jsx-runtime' })
    )[0].code.should.equal(`import { jsx } from 'react/jsx-runtime';

function Foo() {
    return /*#__PURE__*/ jsx("div", {
        children: "foo"
    });
}

export { Foo };\n`);

    (
      await build(rollupImpl, { tsconfig: 'tsconfig.react-jsxdev.json' }, { input: './fixture/index.tsx', dir, external: 'react/jsx-dev-runtime' })
    )[0].code.should.equal(`import { jsxDEV } from 'react/jsx-dev-runtime';

function Foo() {
    return /*#__PURE__*/ jsxDEV("div", {
        children: "foo"
    }, void 0, false, {
        fileName: "${dir}/fixture/index.tsx",
        lineNumber: 2,
        columnNumber: 40
    }, this);
}

export { Foo };\n`);

    (
      await build(rollupImpl, { tsconfig: 'tsconfig.compiled.json' }, { input: './fixture/index.tsx', dir, external: '@compiled/react/jsx-runtime' })
    )[0].code.should.equal(`import { jsx } from '@compiled/react/jsx-runtime';

function Foo() {
    return /*#__PURE__*/ jsx("div", {
        children: "foo"
    });
}

export { Foo };\n`);
  });

  it('use tsconfig.json when tsconfig.json & jsconfig.json both exists', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.tsx': `
        export const foo = <><div>foo</div></>
      `,
      './fixture/jsconfig.json': `
        {
          "compilerOptions": {
            "jsxFactory": "m",
            "jsxFragmentFactory": "React.Fragment"
          }
        }
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": {
          }
        }
    `
    });

    const output = await build(rollupImpl, {}, { input: './fixture/index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement("div", null, "foo"));

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
      rollupImpl,
      { tsconfig: 'tsconfig.build.json' },
      { input: './fixture/index.jsx', dir }
    );
    output[0].code.should.equal(`var foo = /*#__PURE__*/ custom("div", null, "foo");

export { foo };
`);
  });

  it('load jsx/tsx', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.js': `
        import Foo from './foo.jsx'
  
        console.log(Foo)
      `,
      './fixture/foo.tsx': `
        import { util } from './some.util'
        export default class Foo {
          render() {
            return <div className="sukka">{util}</div>
          }
        }
      `,
      './fixture/some.util.ts': `
        export const util = 42
      `
    });

    const output = await build(rollupImpl, { jsc: { target: 'es2022' } }, { dir });
    output[0].code.should.eq(`const util = 42;

class Foo {
    render() {
        return /*#__PURE__*/ React.createElement("div", {
            className: "sukka"
        }, util);
    }
}

console.log(Foo);\n`);
  });

  it('tsconfig extends', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.jsx': `
        export const foo = <div>foo</div>
      `,
      './fixture/tsconfig.json': `
        {
          "extends": "./tsconfig.build.json",
          "compilerOptions": {}
        }
      `,
      './fixture/tsconfig.build.json': `
        {
          "compilerOptions": {
            "jsxFactory": "custom"
          }
        }
      `,
      './fixture/jsconfig.json': `
        {
          "extends": "./tsconfig.build.json",
          "compilerOptions": {}
        }
      `
    });

    (await build(
      rollupImpl,
      {},
      { input: './fixture/index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ custom("div", null, "foo");

export { foo };
`);

    (await build(
      rollupImpl,
      { tsconfig: 'jsconfig.json' },
      { input: './fixture/index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ custom("div", null, "foo");

export { foo };
`);
  });

  it('tsconfig resolve to nearest tsconfig', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.jsx': `
        import { foo } from './foo';
        import { bar } from './bar';
        export const baz = <div>{foo}{bar}</div>
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": { "jsxFactory": "h" }
        }
      `,
      './fixture/foo/index.jsx': `
        export const foo = <div>foo</div>
      `,
      './fixture/foo/tsconfig.json': `
        {
          "compilerOptions": { "jsxFactory": "hFoo" }
        }
      `,
      './fixture/bar/index.tsx': `
        export const bar = <div>bar</div>
      `,
      './fixture/bar/tsconfig.json': `
        {
          "compilerOptions": { "jsxFactory": "hBar" }
        }
      `
    });

    (await build(
      rollupImpl,
      {},
      { input: './fixture/index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ hFoo("div", null, "foo");\n
var bar = /*#__PURE__*/ hBar("div", null, "bar");\n
var baz = /*#__PURE__*/ h("div", null, foo, bar);\n
export { baz };
`);
  });

  it('tsconfig - specify full path', async () => {
    const dir = realFs(getTestName(), {
      './fixture/index.jsx': `
        export const foo = <div>foo</div>
      `,
      './fixture/foo/bar/tsconfig.json': `
        {
          "compilerOptions": { "jsxFactory": "hFoo" }
        }
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": { "jsxFactory": "hBar" }
        }
      `
    });

    const tsconfigPath = path.resolve(dir, './fixture/foo/bar/tsconfig.json');

    (await build(
      rollupImpl,
      { tsconfig: tsconfigPath },
      { input: './fixture/index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ hFoo("div", null, "foo");\n
export { foo };
`);
  });

  it('target - include other files', async () => {
    const dir = realFs(getTestName(), {
      './fixture/module.cts': `
        module.exports.foo = 'sukka';
      `,
      './fixture/index.mts': `
        import { foo } from './module'
        console.log(foo);
      `
    });

    (await build(
      rollupImpl,
      { extensions: ['.ts', '.mts', '.cts'], tsconfig: false },
      { input: './fixture/index.mts', dir, otherRollupPlugins: [commonjs({ extensions: ['.cts'] })] }
    ))[0].code.should.equal(`var foo = "sukka";\n
console.log(foo);
`);
  });
};

describe('swc (rollup 2)', () => {
  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  tests(rollup);
});

describe('swc (rollup 3)', () => {
  after(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  tests(rollup3);
});
