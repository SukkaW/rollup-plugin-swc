/**
 * preserveUseDirective is now a separate plugin, re-export to maintain the backward compatibility
 */
import swcPreserveDirectivePlugin from 'rollup-swc-preserve-directives';
export { swcPreserveDirectivePlugin as preserveUseDirective };
