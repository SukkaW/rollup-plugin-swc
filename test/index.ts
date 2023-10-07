/* eslint-disable @typescript-eslint/no-duplicate-type-constituents -- rollup version type overlapping */
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import { rollup as rollup2 } from 'rollup2';
import { rollup as rollup3 } from 'rollup3';
import { rollup as rollup4 } from 'rollup';
import type { Plugin as RollupPlugin, ExternalOption, InputOption, RollupOutput } from 'rollup';

import type { PluginOptions } from '../src';
import { swc, minify, preserveUseDirective } from '../src';

import json from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';

import type { JsMinifyOptions } from '@swc/core';

import { should } from 'chai';
import { cleanup, init } from './ramdisk';
should();

const rollupInvriant = (v: RollupOutput['output'][number] | undefined | null) => {
  if (v == null) {
    throw new Error('Invariant failed');
  }
  if (!('code' in v)) {
    throw new Error('Non rollup output module found!');
  }
  return v;
};

const build = async (
  rollupImpl: typeof rollup2 | typeof rollup3 | typeof rollup4,
  options?: PluginOptions,
  {
    input = './fixture/index.js',
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
  } = {}
) => {
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
};

const runMinify = async (
  rollupImpl: typeof rollup2 | typeof rollup3 | typeof rollup4,
  options: JsMinifyOptions,
  {
    input = './fixture/index.js',
    otherRollupPlugins = [],
    sourcemap = false,
    dir = '.'
  }
) => {
  const build = await rollupImpl({
    input: [...(Array.isArray(input) ? input : [input])].map((v) => path.resolve(dir, v)),
    plugins: [...otherRollupPlugins, minify(options)] as any
  });
  const { output } = await build.generate({ format: 'esm', sourcemap });
  return output;
};

const getTestName = () => String(Date.now());

const tests = (rollupImpl: typeof rollup2 | typeof rollup3 | typeof rollup4, isolateDir: string) => {
  const realFs = async (folderName: string, files: Record<string, string>) => {
    const testDir = path.join(isolateDir, 'rollup-plugin-swc', folderName);

    await Promise.all(Object.keys(files).map(async (file) => {
      const absolute = path.join(testDir, file);
      await fsp.mkdir(path.dirname(absolute), { recursive: true });
      return fsp.writeFile(absolute, files[file], 'utf-8');
    }));

    return testDir;
  };

  it('simple', async () => {
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
      './fixture/index.js': `
        console.log(10000);
        console.log('b'      +      'c');
      `
    });
    const output = await runMinify(rollupImpl, {}, { dir });
    output[0].code.should.equal('console.log(1e4),console.log("bc");\n');
  });

  it('load index.(x)', async () => {
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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

  it('disable reading tsconfig.json', async () => {
    const dir = await realFs(getTestName(), {
      './fixture/index.jsx': `
        export const foo = 1;
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": {
            "target": "esnext"
          }
        }
      `,
      './fixture/.swcrc': `
      {
        "env": {
          "targets": "defaults, not dead"
        }
      }
      `
    });

    const output = await build(
      rollupImpl,
      { tsconfig: false },
      { input: './fixture/index.jsx', dir }
    );
    output[0].code.should.equal(`const foo = 1;

export { foo };
`);
  });

  it('load jsx/tsx', async () => {
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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
    const dir = await realFs(getTestName(), {
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

  it('tsconfig - baseUrl & paths', async () => {
    const dir = await realFs(getTestName(), {
      './fixture/src/components/a.ts': `
        export const a = (input) => 'a' + input;
      `,
      './fixture/src/lib/b.ts': `
        export const b = 'b';
      `,
      './fixture/src/index.ts': `
        import { a } from '@/components/a'
        import { b } from '@/lib/b'
        console.log(a(b));
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": {
            "baseUrl": "./",
            "paths": {
              "@/*": [
                "./src/*"
              ]
            },
          }
        }
      `
    });

    (await build(
      rollupImpl,
      {},
      { input: './fixture/src/index.ts', dir }
    ))[0].code.should.equal(`var a = function(input) {
    return "a" + input;
};

var b = "b";

console.log(a(b));
`);
  });

  it('tsconfig - paths', async () => {
    const dir = await realFs(getTestName(), {
      './fixture/src/components/a.ts': `
        export const a = (input) => 'a' + input;
      `,
      './fixture/src/lib/b.ts': `
        export const b = 'b';
      `,
      './fixture/src/index.ts': `
        import { a } from '@/components/a'
        import { b } from '@/lib/b'
        console.log(a(b));
      `,
      './fixture/tsconfig.json': `
        {
          "compilerOptions": {
            "paths": {
              "@/*": [
                "./src/*"
              ]
            },
          }
        }
      `
    });

    (await build(
      rollupImpl,
      {},
      { input: './fixture/src/index.ts', dir }
    ))[0].code.should.equal(`var a = function(input) {
    return "a" + input;
};

var b = "b";

console.log(a(b));
`);
  });

  it('target - include other files', async () => {
    const dir = await realFs(getTestName(), {
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

  it('directive - include "use client"', async () => {
    const dir = await realFs(getTestName(), {
      './fixture/index.tsx': `
      'use client'

      export default function client() {
        return React.useState(null) 
      }
      `
    });

    (await build(
      rollupImpl,
      { tsconfig: false },
      { input: './fixture/index.tsx', dir, otherRollupPluginsAfterSwc: [preserveUseDirective()] }
    ))[0].code.should.equal(`'use client';
function client() {
    return React.useState(null);
}

export { client as default };
`);
  });

  it('directive - merge "use client"', async () => {
    const dir = await realFs(getTestName(), {
      './fixture/foo.ts': `
        "use client";
        "use sukka";
        export const foo = 'sukka';
      `,
      './fixture/bar.ts': `
        "use client";
        export const bar = 'sukka';
      `,
      './fixture/index.tsx': `
      export { foo } from './foo';
      export { bar } from './bar';
      `
    });

    (await build(
      rollupImpl,
      { tsconfig: false },
      { input: './fixture/index.tsx', dir, otherRollupPluginsAfterSwc: [preserveUseDirective()] }
    ))[0].code.should.equal(`'use client';
'use sukka';
var foo = "sukka";

var bar = "sukka";

export { bar, foo };
`);
  });

  it('directive - only output "use client" / "use server" in the specfic entry', async () => {
    const dir = await realFs(getTestName(), {
      './fixture/client.ts': `
        "use client";
        export const foo = 'client';
      `,
      './fixture/server.ts': `
        'use server';
        export const bar = 'server';
      `
    });

    const output = (await build(
      rollupImpl,
      { tsconfig: false },
      {
        input: {
          client: './fixture/client.ts',
          server: './fixture/server.ts'
        },
        dir, otherRollupPluginsAfterSwc: [preserveUseDirective()]
      }
    ));

    rollupInvriant(output.find(i => i.fileName === 'client.js') as any).code.should.equal(`'use client';
var foo = "client";

export { foo };
`);

    rollupInvriant(output.find(i => i.fileName === 'server.js') as any).code.should.equal(`'use server';
var bar = "server";

export { bar };
`);
  });
};

describe('rollup-plugin-swc3', () => {
  const ramDiskPath = init('rolluppluginswc3test');

  describe('swc (rollup 2)', () => {
    const isolateDir = path.join(ramDiskPath, 'rollup2');
    tests(rollup2, isolateDir);
  });

  describe('swc (rollup 3)', () => {
    const isolateDir = path.join(ramDiskPath, 'rollup3');
    tests(rollup3, isolateDir);
  });

  describe('swc (rollup 4)', () => {
    const isolateDir = path.join(ramDiskPath, 'rollup4');
    tests(rollup4, isolateDir);
  });

  after(() => {
    cleanup(ramDiskPath);
  });
});
