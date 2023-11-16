## 0.10.4

- Bump `rollup-swc-preserve-directives` to the latest version

## 0.10.3

- Pass correct options to `@swc/core` (https://github.com/SukkaW/rollup-plugin-swc/pull/54 by @kdy1)

## 0.10.2

- Add warning message when tsconfig is invalid
- Add rollup 4 official support

## 0.10.1

- Fix #41
  - `rollup-plugin-swc3` now will always provide `baseUrl` (resolve to an absolute path) to swc as long as the `paths` is specified in the `tsconfig.json` or `jsconfig.json` being read.

## 0.10.0

- Fix #41
  - `rollup-plugin-swc3` now will resolve `baseUrl` to an absolute path against the `tsconfig.json` and `jsconfig.json` being read.
  - This is to align with the behavior change of the `swc`: https://github.com/swc-project/swc/issues/7799 and https://github.com/swc-project/swc/issues/7800.

## 0.9.1

- The support for `'use client'` and `'use server'` has been separated into a standalone rollup plugin [`rollup-swc-preserve-directives`](https://github.com/huozhi/rollup-plugin-swc-preserve-directives), maintained by [@huozhi](https://github.com/huozhi) and me. The previous `preserveUseDirective` named export is retained for the backward compatibility.

## 0.9.0

- Add support for bundling library for React Server Component with the proper `'use client'` and `'use server'` directives handling:
  - Merge duplicated directives in the final bundles
  - Multiple output chunks will have their own separated directives, useful when bundling client only code and server only code in different bundles.
  - Not enabled by default. manually opt-in by changing two lines of code in your `rollup.config.js`:

  ```diff
  // rollup.config.js
  // Import `preserveUseDirective` from `rollup-plugin-swc3`...
  - import { swc } from 'rollup-plugin-swc3';
  + import { swc, preserveUseDirective } from 'rollup-plugin-swc3';

  export default {
    input: 'xxxx',
    output: {},
    plugins: [
      swc(),
  +   preserveUseDirective()
    ];
  }
  ```

## 0.8.2

- Enable CI auto publish release + npm provenance

## 0.8.1

- Fix TypeScript declaration of `include` and `exclude` option (#32)

## 0.8.0

- Add new option `extensions`.
  - Along with `include` / `exclude`, this provides a granular way to specify the files that will be processed by the plugin.
  - For extensionless imports the plugin will search and resolve files for extensions in the order specified.

## 0.7.0

- Add Rollup 3.0.0 support.
  - `rollup-plugin-swc` now supports both Rollup 2 and Rollup 3.

## 0.6.0

- Supports `extends` from `tsconfig.json`/`jsconfig.json`.
- Supports passing a full path of a `tsconfig.json`/`jsconfig.json` file to `tsconfig` option.
- When finding the nearest `tsconfig.json`/`jsconfig.json` from the source file that is currently being transpiled, `rollup-plugin-swc`'s behavior is now aligned with `tsc`.

## 0.5.0

- `rollup-plugin-swc` now also respects `jsx` option from `tsconfig.json` when no corresponding swc option is provided.
  - `jsxImportSource` from `tsconfig.json` will be passed to swc's `jsc.transform.react.importSource`
  - if `tsconfig.json` specifies `jsx: react-jsx` or `jsx: react-jsxdev`, `rollup-plugin-swc` will set `jsx.tramsform.react.runtime` to `automatic`, otherwise it will be `classic`.
    - Currently, swc doesn't support preserving JSX, and will always transpile JSX into javascript code.
  - `rollup-plugin-swc` will also set `jsx.tramsform.react.development` to `true` if `tsconfig.json` specifies `jsx: react-jsxdev`.

## 0.4.2

- Remove unused dependency (@huozhi #20)

## 0.4.1

- Fix some minor issues.

## 0.4.0

- Automatically pass rollup's file `id` to swc's `filename` option.
  - It should help swc find the `.swcrc`, and also enables some other swc's functionality
- Automatically mapping `.ts/.tsx` to `.mjs/.js/.cjs/.jsx`.
  - When using native ESM, import path requires `.js/.jsx` extension for TypeScript with `"moduleResolution": "Node16"`. So rollup-plugin-swc will now try all possible extensions.
  - E.g. if you write `import Foo from 'foo.jsx'`, rollup-plugin-swc will search for `foo.ts`, `foo.tsx`, `foo.mjs`, `foo.js`, `foo.jsx`.
  - PRs are welcome if you want to make rollup-plugin-swc more spec compliant.

## 0.3.0

- Completely disable swc minify during rollup's `transform` phase.
  - Now all minify will be done in rollup's `renderChunk` phase, which is a one-pass process, resulting in even faster build performance.
- Remove the workaround for rollup's virtual module that is introduced in 0.1.2 (https://github.com/SukkaW/rollup-plugin-swc/pull/1)
  - swc has fixed the issue, and the corresponding test case has been added in https://github.com/swc-project/swc/pull/4255
  - The `peerDependencies` of swc has been updated to `>=1.2.165`. You will need to bump the version of swc to 1.2.165 or higher after this release.

## 0.2.0

- Standalone minify plugin
- Support reading `baseUrl` and `paths` from your `tsconfig.json` (and `jsconfig.json`).
  - These fields will be passed to swc directly. They won't affect how rollup resolve your imports. Please use other plugins to resolve your imports' aliases (e.g., add [rollup-plugin-typescript-paths](https://www.npmjs.com/package/rollup-plugin-typescript-paths) or [rollup-plugin-tsconfig-paths](https://www.npmjs.com/package/rollup-plugin-tsconfig-paths) before `@rollup/plugin-node-resolve`).

## 0.1.4

- Add `.mjs` extension support
- Export a `default` for use with rollup's `--configPlugin`

## 0.1.3

- Fix a bug caused by the workaround introduced in 0.1.2

## 0.1.2

- Fix transform failed when rollup virtual module is involved.
  - https://rollupjs.org/guide/en/#conventions
  - https://github.com/SukkaW/rollup-plugin-swc/pull/1
  - https://github.com/swc-project/swc/issues/2853
- Support read default config from [`jsconfig.json`](https://code.visualstudio.com/docs/languages/jsconfig) as well
  - `jsconfig.json` will be ignored if `tsconfig.json` and `jsconfig.json` both exists.

## 0.1.1

- Add `.npmignore` to reduce the size of the package.
- Use `deepmerge` to merge plugin options config with your given `tsconfig.json`.

## 0.1.0

The first release.
