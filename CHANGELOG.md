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
