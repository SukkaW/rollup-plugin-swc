/* eslint-disable @typescript-eslint/no-duplicate-type-constituents -- rollup version type overlapping */
import path from 'path';
import fsp from 'fs/promises';

import { PathScurry } from 'path-scurry';

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
    input = './index.js',
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

const tests = (rollupImpl: typeof rollup2 | typeof rollup3 | typeof rollup4, isolateDir: string) => {
  const fixture = async (fixtureName: string) => {
    const fixtureDir = path.join(__dirname, 'fixtures', fixtureName);
    const testDir = path.join(isolateDir, 'rollup-plugin-swc', fixtureName);

    const dirs = new Set<string>();
    const files: Array<[from: string, to: string]> = [];

    const pw = new PathScurry(fixtureDir);
    for await (const entry of pw) {
      if (entry.isFile()) {
        const from = entry.fullpath();
        const to = path.join(testDir, entry.relative());
        const toDir = path.dirname(to);

        dirs.add(toDir);
        files.push([from, to]);
      }
    }

    await Promise.all(Array.from(dirs).map(dir => fsp.mkdir(dir, { recursive: true })));
    await Promise.all(files.map(([from, to]) => fsp.copyFile(from, to)));

    return testDir;
  };

  it('simple', async () => {
    const dir = await fixture('simple');
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
    const dir = await fixture('minify');
    const output = await build(rollupImpl, { minify: true, jsc: { target: 'es2022' } }, { dir });
    output[0].code.should.equal('class Foo{render(){return React.createElement("div",{className:"hehe"},"hello there!!!")}}console.log(Foo);\n');
  });

  it('standalone minify', async () => {
    const dir = await fixture('standalone-minify');
    const output = await runMinify(rollupImpl, {}, { dir });
    output[0].code.should.equal('console.log(1e4),console.log("bc");\n');
  });

  it('resolve index.(x)', async () => {
    const dir = await fixture('resolve-index');
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
    const dir = await fixture('load-json');

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
    const dir = await fixture('rollup-commonjs');
    const output = await build(
      rollupImpl,
      { jsc: { target: 'es2022' } },
      { otherRollupPlugins: [commonjs()], dir }
    );
    output[0].code.should.equal(`var rollupCommonjs = {};

var foo = 'foo';

var bar = {};

bar.Bar = 'bar';

const Foo = foo;
const { Bar } = bar;
console.log(Foo, Bar);

export { rollupCommonjs as default };
`);
  });

  it('use custom jsxFactory (h) from tsconfig', async () => {
    const dir = await fixture('tsconfig-custom-jsx-factory');

    const output = await build(rollupImpl, {}, { input: './index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ h("div", null, "foo");

export { foo };\n`);
  });

  it('use custom jsxFactory (h) from jsconfig.json', async () => {
    const dir = await fixture('jsconfig-custom-jsx-factory');

    const output = await build(rollupImpl, {}, { input: './index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ h("div", null, "foo");

export { foo };\n`);
  });

  it('react 17 jsx transform', async () => {
    const dir = await fixture('react-17-jsx-transform');

    (
      await build(rollupImpl, { tsconfig: 'tsconfig.react-jsx.json' }, { input: './index.tsx', dir, external: 'react/jsx-runtime' })
    )[0].code.should.equal(`import { jsx } from 'react/jsx-runtime';

function Foo() {
    return /*#__PURE__*/ jsx("div", {
        children: "foo"
    });
}

export { Foo };\n`);

    (
      await build(rollupImpl, { tsconfig: 'tsconfig.react-jsxdev.json' }, { input: './index.tsx', dir, external: 'react/jsx-dev-runtime' })
    )[0].code.should.equal(`import { jsxDEV } from 'react/jsx-dev-runtime';

function Foo() {
    return /*#__PURE__*/ jsxDEV("div", {
        children: "foo"
    }, void 0, false, {
        fileName: "${dir}/index.tsx",
        lineNumber: 1,
        columnNumber: 32
    }, this);
}

export { Foo };\n`);

    (
      await build(rollupImpl, { tsconfig: 'tsconfig.compiled.json' }, { input: './index.tsx', dir, external: '@compiled/react/jsx-runtime' })
    )[0].code.should.equal(`import { jsx } from '@compiled/react/jsx-runtime';

function Foo() {
    return /*#__PURE__*/ jsx("div", {
        children: "foo"
    });
}

export { Foo };\n`);
  });

  it('use tsconfig.json when tsconfig.json & jsconfig.json both exists', async () => {
    const dir = await fixture('tsconfig-jsconfig');

    const output = await build(rollupImpl, {}, { input: './index.tsx', dir });
    output[0].code.should.equal(`var foo = /*#__PURE__*/ React.createElement(React.Fragment, null, /*#__PURE__*/ React.createElement("div", null, "foo"));

export { foo };
`);
  });

  it('use custom tsconfig.json', async () => {
    const dir = await fixture('custom-tsconfig');

    const output = await build(
      rollupImpl,
      { tsconfig: 'tsconfig.build.json' },
      { input: './index.jsx', dir }
    );
    output[0].code.should.equal(`var foo = /*#__PURE__*/ custom("div", null, "foo");

export { foo };
`);
  });

  it('disable reading tsconfig.json', async () => {
    const dir = await fixture('disable-reading-tsconfig');

    const output = await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.jsx', dir }
    );
    output[0].code.should.equal(`const foo = 1;

export { foo };
`);
  });

  it('load jsx/tsx', async () => {
    const dir = await fixture('load-jsx-tsx');

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
    const dir = await fixture('tsconfig-extends');

    (await build(
      rollupImpl,
      {},
      { input: './index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ custom("div", null, "foo");

export { foo };
`);

    (await build(
      rollupImpl,
      { tsconfig: 'jsconfig.custom.json' },
      { input: './index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ custom("div", null, "foo");

export { foo };
`);
  });

  it('tsconfig resolve to nearest tsconfig', async () => {
    const dir = await fixture('tsconfig-resolve-to-nearest-tsconfig');

    (await build(
      rollupImpl,
      {},
      { input: './index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ hFoo("div", null, "foo");\n
var bar = /*#__PURE__*/ hBar("div", null, "bar");\n
var baz = /*#__PURE__*/ h("div", null, foo, bar);\n
export { baz };
`);
  });

  it('tsconfig - specify full path', async () => {
    const dir = await fixture('tsconfig-full-path');

    const tsconfigPath = path.resolve(dir, './foo/bar/tsconfig.json');

    (await build(
      rollupImpl,
      { tsconfig: tsconfigPath },
      { input: './index.jsx', dir }
    ))[0].code.should.equal(`var foo = /*#__PURE__*/ hFoo("div", null, "foo");\n
export { foo };
`);
  });

  it('tsconfig - baseUrl & paths', async () => {
    const dir = await fixture('tsconfig-baseurl-paths');

    (await build(
      rollupImpl,
      {},
      { input: './src/index.ts', dir }
    ))[0].code.should.equal(`var a = function(input) {
    return "a" + input;
};

var b = "b";

console.log(a(b));
`);
  });

  it('tsconfig - paths', async () => {
    const dir = await fixture('tsconfig-paths');

    (await build(
      rollupImpl,
      {},
      { input: './src/index.ts', dir }
    ))[0].code.should.equal(`var a = function(input) {
    return "a" + input;
};

var b = "b";

console.log(a(b));
`);
  });

  it('target - include other files', async () => {
    const dir = await fixture('extensions');

    (await build(
      rollupImpl,
      { extensions: ['.ts', '.mts', '.cts'], tsconfig: false },
      { input: './index.mts', dir, otherRollupPlugins: [commonjs({ extensions: ['.cts'] })] }
    ))[0].code.should.equal(`var foo = "sukka";\n
console.log(foo);
`);
  });

  it('directive - include "use client"', async () => {
    const dir = await fixture('directive-include-use-client');

    (await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.tsx', dir, otherRollupPluginsAfterSwc: [preserveUseDirective()] }
    ))[0].code.should.equal(`'use client';
function client() {
    return React.useState(null);
}

export { client as default };
`);
  });

  it('directive - merge "use client"', async () => {
    const dir = await fixture('directive-merge-use-client');

    (await build(
      rollupImpl,
      { tsconfig: false },
      { input: './index.tsx', dir, otherRollupPluginsAfterSwc: [preserveUseDirective()] }
    ))[0].code.should.equal(`'use client';
'use sukka';
var foo = "sukka";

var bar = "sukka";

export { bar, foo };
`);
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
