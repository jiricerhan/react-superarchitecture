/**
 * stylelint-config-superarchitecture
 *
 * The CSS half of the container / view architecture, as lint rules:
 *   - BEM class names: `.block`, `.block__element`, `.block--modifier`, `.block__element--modifier`
 *   - only single-class selectors: one class, optionally with pseudo-classes / pseudo-elements / attribute states;
 *     no combinators, no chained classes, no tag or id selectors
 *   - no `!important`
 *   - at most one level of nesting (`&__element`, `&--modifier`, `&:hover` sugar under the block)
 *   - modifiers, states and media queries only set custom properties; elements read them with `var(--…)`
 *
 * `.scss` files are parsed with postcss-scss through an override, so `.module.scss` works out of the box.
 * Full reasoning: docs/05-css-architecture.md in the repo.
 */
import postcssScss from 'postcss-scss';
import modifierSetsTokensOnly from './lib/modifier-sets-tokens-only.js';

const KEBAB = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
/** block, optional __element, optional --modifier */
export const BEM_CLASS_PATTERN = `^${KEBAB}(?:__${KEBAB})?(?:--${KEBAB})?$`;

export default {
  plugins: [modifierSetsTokensOnly],
  rules: {
    // naming
    'selector-class-pattern': [
      BEM_CLASS_PATTERN,
      {
        resolveNestedSelectors: true,
        message: (selector) => `Expected class "${selector}" to be BEM: block, block__element, block--modifier, block__element--modifier (kebab-case)`,
      },
    ],

    // only single-class selectors
    'selector-max-class': 1,
    'selector-max-compound-selectors': 1,
    'selector-max-combinators': 0,
    'selector-max-universal': 0,
    'selector-max-id': 0,
    'selector-max-type': 0,
    'selector-max-attribute': 1,
    'selector-no-qualifying-type': true,

    // no escape hatches
    'declaration-no-important': true,

    // nesting: one level of `&` sugar under the block at most
    'max-nesting-depth': [1, { ignoreAtRules: ['media', 'container', 'supports', 'include'] }],

    // the core trick
    'superarchitecture/modifier-sets-tokens-only': true,
  },
  overrides: [
    {
      files: ['**/*.scss'],
      customSyntax: postcssScss,
    },
  ],
};
