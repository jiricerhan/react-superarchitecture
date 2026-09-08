# stylelint-config-superarchitecture

The CSS half of the container / view architecture, as stylelint rules. Convention-based, no build step:
a `.module.scss` next to its view, BEM class names, one class per selector, and one trick that removes every
nested selector: **modifiers, states and media queries only set custom properties; elements only read them.**

The reasoning and the full examples are in [`docs/05-css-architecture.md`](../../docs/05-css-architecture.md).

## What it enforces

| rule | what it says |
|---|---|
| `selector-class-pattern` | class names are BEM in kebab-case: `block`, `block__element`, `block--modifier`, `block__element--modifier` |
| `selector-max-class: 1` | one class per selector; `.task.is-selected` is two, use `.task--selected` |
| `selector-max-compound-selectors: 1`, `selector-max-combinators: 0` | no descendant, child or sibling combinators; parent-to-child goes through a token |
| `selector-max-type: 0`, `selector-max-id: 0`, `selector-max-universal: 0` | no tag, id or `*` selectors |
| `selector-no-qualifying-type` | no `div.task` |
| `selector-max-attribute: 1` | at most one attribute state on the class (`.task[aria-selected='true']`) |
| `declaration-no-important` | no `!important`; with single-class selectors there is nothing to fight |
| `max-nesting-depth: 1` | at most one level of `&__element` / `&--modifier` / `&:hover` sugar under the block; `@media`, `@container`, `@supports` and `@include` wrappers do not count |
| `superarchitecture/modifier-sets-tokens-only` | inside a modifier (`--`), a state (`:hover`, `:focus-visible`, `:disabled`, `[aria-*]`, `[data-*]`, ...) or an `@media` / `@container` / `@include` block, every declaration is a custom property |

Pseudo-classes and pseudo-elements on the single class are fine (`.task:hover`, `.task__title::before`,
`.task__item:first-child`). Only *state* pseudo-classes are held to the tokens-only rule; structural ones
(`:first-child`, `:nth-child`, `:not`) are not.

## Install

```sh
npm install -D stylelint stylelint-config-superarchitecture
# or
yarn add -D stylelint stylelint-config-superarchitecture
```

Requires stylelint 16 or newer. `postcss-scss` comes with the config.

## Use

```js
// stylelint.config.js
export default {
  extends: ['stylelint-config-superarchitecture'],
};
```

`.scss` files are parsed with `postcss-scss` through an `overrides` entry in the config, so `*.module.scss` works
without further setup. If you want SCSS parsing for every file (say `.css` files that use `@include`), set it globally:

```js
export default {
  extends: ['stylelint-config-superarchitecture'],
  customSyntax: 'postcss-scss',
};
```

Run it on the views:

```sh
npx stylelint "src/**/*.module.scss"
```

## The custom rule: `superarchitecture/modifier-sets-tokens-only`

```scss
/* ❌ reported: the modifier and the state set real properties */
.task--selected { border-color: var(--color-brand); }
.task:hover { box-shadow: var(--shadow-2); }
@media (min-width: 768px) { .task { padding: var(--space-6); } }

/* ✅ the block reads tokens; modifier, state and breakpoint set them */
.task {
  border-color: var(--task-border-color, var(--color-border));
  box-shadow: var(--task-shadow, none);
  padding: var(--task-padding, var(--space-4));
}
.task--selected { --task-border-color: var(--color-brand); }
.task:hover { --task-shadow: var(--shadow-2); }
@media (min-width: 768px) { .task { --task-padding: var(--space-6); } }
```

Message: `Modifiers, states and media queries only set tokens; move "padding" to the element and read it with var(--…) (found in @media (min-width: 768px))`.

Options (secondary):

| option | default | meaning |
|---|---|---|
| `allow` | `[]` | properties that may still appear in a modifier / state / media block, e.g. `['transition', 'display']` |
| `states` | hover, focus, focus-visible, focus-within, active, visited, target, disabled, enabled, checked, indeterminate, invalid, valid, required, optional, placeholder-shown, read-only, open, popover-open, empty | pseudo-classes treated as states (replaces the list) |
| `atRules` | `['media', 'container', 'include']` | at-rules whose bodies count as configuration; `include` covers breakpoint mixins such as `@include md-n-above { … }` |

```js
export default {
  extends: ['stylelint-config-superarchitecture'],
  rules: {
    'superarchitecture/modifier-sets-tokens-only': [true, { allow: ['transition', 'display'] }],
  },
};
```

The rule can also be used on its own, without the rest of the config:

```js
import modifierSetsTokensOnly from 'stylelint-config-superarchitecture/modifier-sets-tokens-only';

export default {
  plugins: [modifierSetsTokensOnly],
  rules: { 'superarchitecture/modifier-sets-tokens-only': true },
};
```

## How to relax

Override any rule in your own config; `null` turns it off.

```js
export default {
  extends: ['stylelint-config-superarchitecture'],
  rules: {
    // legacy folder still uses nesting
    'max-nesting-depth': 2,
    // a design-system package that ships tag resets
    'selector-max-type': null,
  },
  overrides: [
    // global token and theme files are not modules: allow the :root / theme scope selectors there
    { files: ['src/styles/**/*.scss'], rules: { 'selector-class-pattern': null, 'selector-max-type': null } },
  ],
};
```

Do not relax `superarchitecture/modifier-sets-tokens-only` for a whole project; use `allow` for the one or two
properties your team decides to keep (typically `transition` and `display`), or a `/* stylelint-disable-next-line */`
with a reason at the single place that needs it.

## Development

```sh
yarn install
node test/run.js
```

`test/run.js` lints inline good / bad fixtures and exits non-zero when an expectation fails.
