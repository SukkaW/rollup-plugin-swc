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
