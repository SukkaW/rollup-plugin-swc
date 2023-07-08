/**
 * Originally created by huozhi @ GitHub <https://huozhi.im/>
 * License: MIT
 * This is from huozhi's amazing zero config bundler: https://github.com/huozhi/bunchee
 *
 * https://github.com/huozhi/bunchee/blob/23cbd6ebab992b886a207a531ec54dfa0877ab39/src/plugins/directive-plugin.ts
 *
 * Following changes are made:
 *
 * - Replace `magic-string` with `@napi-rs/magic-string`
 * - Use a Map to track directives for each module, to support multiple entries input
 */

import type { Plugin } from 'rollup';
import { MagicString } from '@napi-rs/magic-string';
import type { RenderedChunk } from 'rollup2';

const isNonNull = <T>(val: T | null | undefined): val is T => val != null;
const rDirectives = /^(?:['"]use[^'"]+['"][^\n]*|#![^\n]*)/gm;

export function preserveUseDirective(): Plugin {
  const fileDirectivesMap = new Map<string, Set<string>>();

  return {
    name: 'preserve-use-directive',

    transform(code, id) {
      const directives = new Set<string>();

      const replacedCode = code.replace(rDirectives, (match) => {
        // replace double quotes with single quotes
        directives.add(match.replace(/["]/g, '\''));
        return '';
      });

      if (directives.size) fileDirectivesMap.set(id, directives);

      return {
        code: replacedCode,
        map: null
      };
    },

    renderChunk(code, chunk, { sourcemap }) {
      // "chunk.moduleIds" is only avaliable in rollup 3. Add a fallback to be rollup 2 compatible
      const moduleIds = 'moduleIds' in chunk
        ? chunk.moduleIds
        : Object.keys((chunk as RenderedChunk).modules);

      const outputDirectives = moduleIds
        .map((id) => fileDirectivesMap.get(id))
        .filter(isNonNull)
        .reduce((acc, directives) => {
          directives.forEach((directive) => acc.add(directive));
          return acc;
        }, new Set<string>());

      if (outputDirectives.size === 0) return null;

      const s = new MagicString(code);
      s.prepend(`${Array.from(outputDirectives).join('\n')}\n`);

      return {
        code: s.toString(),
        map: sourcemap ? s.generateMap({ hires: true }).toMap() : null
      };
    }
  };
}
