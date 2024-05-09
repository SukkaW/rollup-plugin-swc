<div align="center">
  <img src="https://pic.skk.moe/file/sukkaw/gh/rollup-plugin-swc.png" width="550px">
</div>
<h1 align="center">rollup-plugin-swc</h1>

[SWC](https://swc.rs/) is an extensible Rust-based platform for the next generation of fast developer tools. This plugin is designed to replace `rollup-plugin-typescript2`, `@rollup/plugin-typescript`, `@rollup/plugin-babel` and `rollup-plugin-terser` for you.

**New:** Building library for React Server Component support is added in `0.9.0`! `'use client'` and `'use server'` directives now are handled properly, without triggering rollup warnings. [Start using `'use client'` and `'use server'` in your library by adding two lines in your `rollup.config.js`](#react-server-component-directives-use-client-and-use-server)

> Since `0.9.1` the support for `'use client'` and `'use server'` has been separated into a standalone rollup plugin [`rollup-preserve-directives`](https://github.com/huozhi/rollup-preserve-directives), the previous `preserveUseDirective` named export is retained for the backward compatibility.

## Comparison

|                                                | [sukkaw/rollup-plugin-swc](https://github.com/SukkaW/rollup-plugin-swc) | [mentaljam/rollup-plugin-swc](https://github.com/mentaljam/rollup-plugin-swc) | [nicholasxjy/rollup-plugin-swc2](https://github.com/nicholasxjy/rollup-plugin-swc2) | [@rollup/plugin-swc](https://github.com/rollup/plugins/tree/master/packages/swc) |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `minify` your bundle in one pass[^1]           | ✅                                                                       | 🛑                                                                             | 🛑                                                                                   | 🛑                                                                                |
| Standalone `swcMinify` plugin                  | ✅                                                                       | 🛑                                                                             | 🛑                                                                                   | 🛑                                                                                |
| Config Intellisense[^2]                        | ✅                                                                       | 🛑                                                                             | 🛑                                                                                   | 🛑                                                                                |
| Reads your `tsconfig.json` and `jsconfig.json` | ✅                                                                       | 🛑                                                                             | 🛑                                                                                   | 🛑                                                                                |
| ESM export                                     | ✅                                                                       | 🟡[^3]                                                                         | 🛑                                                                                   | ✅                                                                                |
| TypeScript declarations                         | ✅                                                                       | ✅                                                                             | ✅                                                                                   | ✅                                                                                |
| Has testing                                    | ✅                                                                       | 🛑                                                                             | 🛑                                                                                   | ✅                                                                                |

[^1]: If minify is called in Rollup's `transform` phase, every individual module processed will result in a minify call. However, if minify is called in Rollup's `renderChunk` phase, the minify will only be called once in one whole pass before Rollup generates bundle, results in a faster build.
[^2]: Autocompletion and type checking in your IDE
[^3]: `mentaljam/rollup-plugin-swc` has both `main` and `module` fields in `package.json`, but has🛑`exports` field.

## Install

```bash
$ npm i @swc/core rollup-plugin-swc3
# If you prefer yarn
# yarn add @swc/core rollup-plugin-swc3
# If you prefer pnpm
# pnpm add @swc/core rollup-plugin-swc3
```

## Usage

```js
// rollup.config.js
import { swc } from 'rollup-plugin-swc3';

export default {
  input: 'xxxx',
  output: {},
  plugins: [
    swc({
      // All options are optional
      include: /\.[mc]?[jt]sx?$/, // default
      exclude: /node_modules/, // default
      tsconfig: 'tsconfig.json', // default
      // tsconfig: false, // You can also prevent `rollup-plugin-swc` from reading tsconfig.json, see below
      // And add your swc configuration here!
      // "filename" will be ignored since it is handled by rollup
      jsc: {}
    }),
  ];
}
```

If you want autocompletion in your IDE or type check:

```js
import { swc, defineRollupSwcOption } from 'rollup-plugin-swc3';

export default {
  input: 'xxxx',
  output: {},
  plugins: [
    swc(defineRollupSwcOption({
      // ... There goes the plugin's configuration
    })),
  ];
}

// or
/** @type {import('rollup-plugin-swc3').PluginOptions} */
const swcPluginConfig = {}
```

### `exclude`

- Type: `string | RegExp | Array<String | RegExp>`
- Default: `/node_modules/`

A [picomatch pattern](https://github.com/micromatch/picomatch), or array of patterns, which specifies the files in the build the plugin should *ignore*.

### `extensions`

- Type: `string[]`
- Default: `['.ts', '.tsx', '.mjs', '.js', '.cjs', '.jsx']`

Specifies the files in the build the plugin should operate on. Also, the plugin will search and resolve files for extensions in the order specified for extensionless imports.

### `include`

- Type: `string | RegExp | Array<String | RegExp>`
- Default: `/\.[mc]?[jt]sx?$/`

A [picomatch pattern](https://github.com/micromatch/picomatch), or array of patterns, which specifies the files in the build the plugin should operate on.

### `tsconfig`

- Type: `string | false | undefined`
- Default: `'tsconfig.json'`

`rollup-plugin-swc` will read your `tsconfig.json` or [`jsconfig.json`](https://code.visualstudio.com/docs/languages/jsconfig) for default values if your doesn't provide corresponding swc options:

- The configuration your passed to `rollup-plugin-swc` will always have the highest priority (higher than `tsconfig.json`/`jsconfig.json`).
- `rollup-plugin-swc` uses [`get-tsconfig`](https://www.npmjs.com/package/get-tsconfig) to find the `tsconfig.json`/`jsconfig.json` for the file currently being transpiled.
  - You can also provide a custom filename (E.g. `tsconfig.rollup.json`, `jsconfig.compile.json`) to `tsconfig` option, and `rollup-plugin-swc` will find and resolve the *nearest* file with that filename.
  - You can also provide an absolute path (E.g. `/path/to/your/tsconfig.json`) to `tsconfig` option, and `rollup-plugin-swc` will only use the provided path as a single source of truth.
- You can prevent `rollup-plugin-swc` from reading `tsconfig.json`/`jsconfig.json` by setting `tsconfig` option to `false`.
- `jsconfig.json` will be ignored if `tsconfig.json` and `jsconfig.json` both exist.
- The `extends` of `tsconfig.json`/`jsconfig.json` is ~~not supported~~ now supported.
- `compilerOptions.target` will be passed to swc's `jsc.target`.
- `compilerOptions.jsxImportSource`, `compilerOptions.jsxFactory`, and `compilerOptions.jsxFragmentFactory` will be passed to swc's `jsc.transform.react.importSource`, `jsc.transform.react.pragma` and `jsc.transform.react.pragmaFrag`.
- When `compilerOptions.jsx` is either `react-jsx` or `react-jsxdev`, swc's `jsc.transform.react.runtime` will be `automatic`, otherwise it will be `classic`.
  - `compilerOptions.jsx: react-jsxdev` will also set swc's `jsc.transform.react.development` to `true`.
  - `compilerOptions.jsx: preserve` will be ignored. swc will always transpile your jsx into javascript code.
- `compilerOptions.baseUrl` and `compilerOptions.paths` will be passed to swc's `jsc.baseUrl` and `jsc.paths` directly. They won't affect how rollup resolve your imports. If you have encounted any issue during bundling, please use other plugins to resolve your imports' aliases (e.g., add [rollup-plugin-typescript-paths](https://www.npmjs.com/package/rollup-plugin-typescript-paths) or [rollup-plugin-tsconfig-paths](https://www.npmjs.com/package/rollup-plugin-tsconfig-paths) before `@rollup/plugin-node-resolve`).
- `compilerOptions.importHelpers` will be passed to swc's `jsc.externalHelpers`. You will have to have `@swc/helpers` avaliable in your project when enabled.
- `compilerOptions.experimentalDecorators` and `compilerOptions.emitDecoratorMetadata` will be passed to swc's `jsc.parser.decorators` and `jsc.transform.decoratorMetadata`.
- `compilerOptions.esModuleInterop` will always be **ignored**, as swc requires `module.type` to exist when `module.noInterop` is given.

### Standalone Minify Plugin

If you only want to use `swc` to minify your bundle:

```js
import { minify } from 'rollup-plugin-swc3'

export default {
  plugins: [
    minify({
      // swc's minify option here
      // mangle: {}
      // compress: {}
    }),
  ],
}
```

If you want autocompletion in your IDE or type check:

```js
import { minify, defineRollupSwcMinifyOption } from 'rollup-plugin-swc3'

export default {
  plugins: [
    minify(
      defineRollupSwcMinifyOption({
        // swc's minify option here
        // mangle: {}
        // compress: {}
      })
    ),
  ],
}

// or
/** @type {import('@swc/core').JsMinifyOptions} */
const swcMinifyConfig = {}
```

If you are are using Vite and you do not want to use `terser` or `esbuild` for minification, `rollup-plugin-swc3` also provides a standalone minify plugin designed for Vite:

```js
import { defineConfig } from 'vite';
import { viteMinify } from 'rollup-plugin-swc3'

export default defineConfig({
  plugins: [
    viteMinify({
      // swc's minify option here
      // mangle: {}
      // compress: {}
    }),
  ],
})
```

### React Server Component directives (`'use client'` and `'use server'`)

~~Since version `0.9.0`, the support for `'use client'` and `'use server'` has been added:~~

> The support for `'use client'` and `'use server'` has been separated into a standalone rollup plugin [`rollup-preserve-directives`](https://github.com/huozhi/rollup-preserve-directives), maintained by [@huozhi](https://github.com/huozhi) and me. The previous `preserveUseDirective` named export is retained for the backward compatibility.

```bash
# npm
npm install -D rollup-preserve-directives
# yarn
yarn add -D rollup-preserve-directives
# pnpm
pnpm add -D rollup-preserve-directives
```

```js
// rollup.config.js
import { swc } from 'rollup-plugin-swc3';
import preserveDirectives from 'rollup-preserve-directives';

export default {
  input: 'xxxx',
  output: {},
  plugins: [
    swc(),
    // And add `preserveDirectives` plugin after the `swc` plugin
    preserveDirectives()
  ];
}
```

And that is it!

`preserveDirectives` supports:

- Merging duplicated directives in the output bundles

  ```js
  // src/foo.js
  'use sukka';
  'use foxtail';

  export const foo = 'foo';

  // src/bar.js
  'use sukka';
  export const bar = 'bar';

  // src/index.js
  export { foo } from './foo';
  export { bar } from './bar';

  // rollup.config.js
  export default {
    input: 'src/index.js',
    output: { file: 'dist/index.js' }
    plugins: [swc(), preserveDirectives()]
  }

  // dist/index.js
  'use sukka';
  'use foxtail';

  const foo = 'foo';
  const bar = 'bar';

  export { foo, bar };
  ```

- When bundle React Client Component and React Server Component separately, mutiple entries will have their own separated and correct directives:

  ```js
  // src/client.js
  'use client';
  import { useState } from 'react';
  export const Foo = () => { useState('client-only code') };

  // src/server.js
  'use server';
  import 'fs';
  export const bar = 'server only code';

  // rollup.config.js
  export default {
    // let rollup bundle client and server separately by adding two entries
    input: {
      client: 'src/client.js',
      server: 'src/server.js'
    },
    // output both client bundle and server bundle in the "dist/" directory
    output: { dir: 'dist/', entryFileName: '[name].js' }
    plugins: [swc(), preserveDirectives()]
  }

  // dist/client.js
  'use client';
  import { useState } from 'react';
  const Foo = () => { useState('client-only code') };
  export { Foo };

  // dist/server.js
  'use server';
  import 'fs';
  const bar = 'server only code';
  export { bar };
  ```

### Write your Rollup config in TypeScript

You can write your Rollup config file in `rollup.config.ts`, and use the following command:

```sh
rollup --config rollup.config.ts --configPlugin swc3
```

### TypeScript Declaration File

There are serveral ways to generate declaration file:

- Use `tsc` with `emitDeclarationOnly`, the slowest way but you get type checking, it doesn't bundle the `.d.ts` files.
- Use `rollup-plugin-dts` which generates and bundle `.d.ts`, also does type checking. It is used by this plugin as well.

### Use with Non-react JSX

You can either configure it in your `tsconfig.json` or in your `rollup.config.js`.

```js
// Vue JSX
import { swc, defineRollupSwcOption } from 'rollup-plugin-swc3';

export default {
  input: 'xxxx',
  output: {},
  plugins: [
    swc(defineRollupSwcOption({
      jsc: {
        experimental: {
          plugins: [['swc-plugin-vue-jsx', {}]] // npm i swc-plugin-vue-jsx
        }
      }
    })),
  ];
}
```

```js
// Preact
import { swc, defineRollupSwcOption } from 'rollup-plugin-swc3';

export default {
  input: 'xxxx',
  output: {},
  plugins: [
    swc(defineRollupSwcOption({
      jsc: {
        transform:{
          react: {
          pragma: 'h',
          pragmaFrag: 'Fragment'
          // To use preact/jsx-runtime:
          // importSource: 'preact',
          // runtime: 'automatic'
          }
        }
      }
    })),
  ];
}
```

---

**rollup-plugin-swc** © [Sukka](https://github.com/SukkaW), Released under the [MIT](./LICENSE) License.<br>
Inspired by [egoist](https://github.com/egoist)'s [rollup-plugin-esbuild](https://github.com/egoist/rollup-plugin-esbuild).<br>
Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/rollup-plugin-swc/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Mastodon [@sukka@acg.mn](https://acg.mn/@sukka) · Twitter [@isukkaw](https://twitter.com/isukkaw) · Keybase [@sukka](https://keybase.io/sukka)

<p align="center">
  <a href="https://github.com/sponsors/SukkaW/">
    <img src="https://sponsor.cdn.skk.moe/sponsors.svg"/>
  </a>
</p>
