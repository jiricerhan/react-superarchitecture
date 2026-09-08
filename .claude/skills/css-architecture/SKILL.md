---
name: css-architecture
description: >
  Writes and reviews view styles in this architecture: a `.module.scss` next to
  its view, BEM class names, single-class selectors, CSS custom properties as
  tokens, and the core trick that modifiers, states and breakpoints only set
  tokens while elements only read them. Use whenever creating or editing a
  `.module.scss`, adding CSS classes to a view, or when the user says "style
  this", "add CSS", "make it responsive", "add a variant", "add a dark theme",
  "add a hover / selected state". Not for container code (containers have no
  styles) and not for choosing a design system.
---

# CSS Architecture

Quick reference. The full reasoning, the before / after for every rule and the FAQ are in
**`docs/05-css-architecture.md`**; the rules are enforced by `packages/stylelint-config`
(`stylelint-config-superarchitecture`). Read the doc when a case is not covered here.

## When to use

- a view needs styles, a class, a variant, a state, a breakpoint or a theme
- an existing `.module.scss` is being changed
- a review asks "is this CSS right?"

Not for containers: a container renders no host element and imports no styles. If styling seems to belong in a
container, the value belongs in a prop of its view.

## The rule

> Every selector is one class. Modifiers, states and breakpoints only set tokens; block and elements only read them.

## Checklist

- **Location**: `Task.module.scss` next to `Task.tsx`, imported only there. Block = view name in kebab-case (`.task`).
- **Names**: `.task`, `.task__title`, `.task--selected`, `.task__title--done`. Bracket notation in JSX, `cx` for conditionals.
- **Selectors**: one class, optionally with pseudo-classes / pseudo-elements / one attribute state. No combinators,
  no `.a.b`, no tag, no id, no `*`, no `:has()`.
- **Tags**: one block or element class per tag plus its modifiers; no mixes. Blocks nest, never interlace; a slot is the
  border of a block.
- **Nesting**: flat by default; at most one level of `&__`, `&--`, `&:hover` sugar under the block. `@media` /
  `@include` wrap rules, they are not inside them.
- **Tokens**: global tokens (`--color-*`, `--space-*`, ...) for what never changes; a component token (`--task-*`) read
  with a fallback for what a modifier, state or breakpoint changes. No hard-coded values, no token that nothing sets.
- **Real properties** (`color`, `padding`, `display`, `transition`, ...) only in `.block` and `.block__element`.
- **Modifiers, states, `@media`, `@container`, breakpoint mixins**: only `--token: value` lines.
- **States wired once**: `.task:hover { --task-shadow: var(--task-hover-shadow, …) }`; a variant supplies
  `--task-hover-shadow`, it does not add `.task--x:hover`.
- **Props → classes**: variants and states arrive as props and become `--modifiers`; hover / focus / active are CSS;
  no `useState` for styling; no inline style except a dynamic custom property.
- **Themes**: a scope overrides global tokens (`.theme-dark { --color-surface: … }`); never `.theme-dark .task`.
- **Never**: `!important`, styled-components / emotion, `:global` on a module class, `.parent .child`.
- **File order**: `@use`, block, block states, block modifiers, elements (+ their states / modifiers), breakpoints last.

## The token pattern

```scss
/* block and elements: real properties, reading tokens with the default as fallback */
.task {
  padding: var(--task-padding, var(--space-4));
  border: 1px solid var(--task-border-color, var(--color-border));
  box-shadow: var(--task-shadow, none);
  transition: box-shadow 200ms ease;
}
.task__title { color: var(--task-title-color, var(--color-text)); }

/* states: wired once, set tokens, with a per-variant hook */
.task:hover { --task-shadow: var(--task-hover-shadow, var(--shadow-2)); }
.task:focus-visible { --task-outline: 2px solid var(--color-focus); }

/* modifiers: configuration, including the values for states */
.task--selected {
  --task-border-color: var(--color-brand);
  --task-hover-shadow: var(--shadow-3);
}

/* breakpoints at the end: configuration on the block */
@include md-n-above {
  .task { --task-padding: var(--space-6); }
}
```

```tsx
import cx from 'classnames';
import styles from './Task.module.scss';

<div className={cx(styles['task'], selected && styles['task--selected'], variant && styles[`task--${variant}`])}>
  <h3 className={styles['task__title']}>{title}</h3>
</div>
```

Use positional `condition && styles['…']` arguments; `{ [styles['task--selected']]: selected }` is a TypeScript error
because module lookups are `string | undefined`.

## How to add a variant

1. Add the prop to the view (`variant?: 'compact' | 'wide'`) and the class: `variant && styles[\`task--${variant}\`]`.
2. For every property the variant changes, make sure the block / element reads a component token with the current
   value as fallback: `padding: var(--task-padding, var(--space-4))`.
3. Write the modifier as a list of tokens only: `.task--compact { --task-padding: var(--space-2); }`.
4. If the variant changes a state (a different hover), set that state's token: `--task-hover-shadow: …`.
5. Nothing else changes. If you wrote a second class in one selector, go back to step 2.

## How to add a state

1. Decide the source: a pseudo-class (`:hover`, `:focus-visible`, `:disabled`), an attribute the markup already carries
   (`[aria-selected='true']`, `[data-dragging]`), or a value from the container (`selected` → `.task--selected`).
   One source per state; hover is never a prop.
2. Give each changed property a token on the block / element, if it has none yet.
3. Wire the state once: `.task:hover { --task-shadow: var(--task-hover-shadow, var(--shadow-2)); }`.
4. Variants that need a different value for the state set `--task-hover-shadow` in their modifier.
5. `transition` lives on the element, not in the state.

## How to add a breakpoint

1. Mobile-first: the block and elements describe the small screen.
2. Each property that changes reads a token: `font-size: var(--task-title-size, var(--font-size-3))`.
3. At the end of the file, one breakpoint block on the **block** sets the tokens:
   `@include md-n-above { .task { --task-title-size: var(--font-size-4); } }`.
4. Elements get no media query of their own. `@container` works the same way.

## How to add a theme

1. Themes live in `src/styles/themes.scss` as a scope overriding global tokens: `.theme-dark { --color-surface: …; }`.
2. Components need no change: their component tokens fall back to global tokens.
3. A component that must differ in a way no global token describes gets a prop and a `--modifier`, not a
   `.theme-dark .task` rule. If three components need it, add a global token.

## Review checklist

- [ ] every selector is a single class (plus pseudo / one attribute); zero combinators, zero `.a.b`
- [ ] every rule with `--`, `:hover`-like state, `[aria-*]` / `[data-*]`, `@media`, `@container`, `@include`
      contains only custom properties
- [ ] every component token is read somewhere with a fallback and set somewhere; global tokens used directly otherwise
- [ ] no hard-coded colour / spacing / size where a token exists
- [ ] the view computes no state for styling; class names come from props; no inline style beyond a `--var`
- [ ] the container imports no styles and has no `className`
- [ ] no `!important`, no styled-components / emotion, no `:global`, no `.theme-* .block`
- [ ] file order: block, states, modifiers, elements, breakpoints
- [ ] `npx stylelint "src/**/*.module.scss"` passes with `stylelint-config-superarchitecture`

## Lint

```js
// stylelint.config.js
export default { extends: ['stylelint-config-superarchitecture'] };
```

The custom rule `superarchitecture/modifier-sets-tokens-only` reports a real property in a modifier / state / media
block. If the team decides to keep `transition` or `display` there, use `[true, { allow: ['transition', 'display'] }]`
project-wide; do not disable the rule per file.

---
Full reference: `docs/05-css-architecture.md`. Related: `docs/02-containers-and-views.md` (views own markup and
styles, containers own neither; hover is CSS).
