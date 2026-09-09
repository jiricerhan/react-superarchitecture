# CSS Architecture Guidelines

How the styles of a view are written. Written for a codebase that follows the container / view split
([02-containers-and-views.md](./02-containers-and-views.md)): views own markup and styles, containers own neither.
The examples are the board (`Board`, `Column`, `Task`, `Card`), the rules are enforced by
[`stylelint-config-superarchitecture`](../packages/stylelint-config/README.md).

## The Rule

> **Every selector is one class. Modifiers, states and breakpoints only set tokens; elements only read them.**

BEM gives the first half: `.block`, `.block__element`, `.block--modifier`, nothing else in a selector. CSS custom
properties give the second half: a modifier does not reach into an element with `.task--dark .task__title`, it sets
`--task-title-color` and the element reads it. The same move handles `:hover`, `[aria-selected]` and `@media`. What is
left is a stylesheet with no nesting, no specificity, no ordering, and variants that are configuration.

The price is more custom properties. The win is that no selector ever depends on another, and every reason a pixel
changes (a variant, a state, a breakpoint, a theme) is one flat block of `--tokens` you can read top to bottom.

## Where Styles Live

- one `.module.scss` next to its view, named after it: `Task.tsx` + `Task.module.scss`
- a view imports only its own module; a module is imported by exactly one view
- **containers import no styles**: no `className`, no module, no inline style; a container renders no host element
  (`container-no-markup`), so it has nothing to style
- global files hold tokens and nothing else: `src/styles/tokens.scss` (`:root`), `src/styles/themes.scss` (theme
  scopes), `src/styles/mixins.scss` (breakpoint mixins). No global component styles, no reset beyond the one you ship on purpose
- shared views (`src/components`) follow the same rule: `Card.tsx` + `Card.module.scss`

```
src/
  styles/
    tokens.scss              # :root { --color-*, --space-*, ... }
    themes.scss              # .theme-dark { --color-surface: ... }
    mixins.scss              # @mixin md-n-above { @media (min-width: 768px) { @content } }
  components/
    Card/
      Card.tsx
      Card.module.scss
  modules/board/
    Task/
      Task.tsx
      Task.module.scss       # block: .task
      TaskContainer.tsx      # no styles
```

```tsx
// ❌ Wrong: the container knows a class name
const TaskContainer = ({ id }: { id: string }) => {
  const selected = useIsTaskSelected(id);
  return <div className={selected ? 'task task--selected' : 'task'}><Task id={id} /></div>;
};

// ✅ Right: the container passes a value, the view turns it into a class
const TaskContainer = memo(function TaskContainer({ id }: { id: string }) {
  const title = useTaskTitle(id);
  const selected = useIsTaskSelected(id);
  return <Task title={title} selected={selected} actions={<TaskActionsContainer taskId={id} />} />;
});
```

## BEM Naming

- **block** = the view, in kebab-case: `Task` → `.task`, `SelectedTask` → `.selected-task`
- **element** = a part of the block: `.task__title`, `.task__body`
- **modifier** = a variant or a state of the block or an element: `.task--selected`, `.task__title--done`
- in JSX use bracket notation for `__` and `--`; a tiny `cx` joins the conditional ones (see [Variants from props](#variants-from-props))

```tsx
import cx from 'classnames';
import styles from './Task.module.scss';

<div className={cx(styles['task'], selected && styles['task--selected'])}>
  <h3 className={cx(styles['task__title'], done && styles['task__title--done'])}>{title}</h3>
</div>
```

### Rule 1: only single-class selectors

One class per selector. Pseudo-classes, pseudo-elements and one attribute state on that class are fine. No combinators,
no chained classes, no tag or id selectors, no `*`.

```scss
/* ❌ Wrong */
.task .task__title { }              /* combinator */
.task.is-selected { }               /* two classes */
.task > h3 { }                      /* tag */
#board { }                          /* id */
div.task { }                        /* qualified */

/* ✅ Right */
.task { }
.task__title { }
.task--selected { }
.task:hover { }
.task__title::before { }
.task[aria-selected='true'] { }
```

### Rule 2: one block or element class per tag

A tag carries one block class or one element class, plus modifiers of that class. No "mix" of two blocks or an element
and a block on the same tag. When a parent needs to position a child block, the parent wraps it in an element of its own.

```tsx
/* ❌ Wrong: the column's element and the card's block on one tag */
<div className={cx(styles['column__item'], cardStyles['card'])}>…</div>

/* ✅ Right: the column owns the slot element, the card owns itself */
<div className={styles['column__item']}>{card}</div>
```

### Rule 3: blocks nest, they never interlace

A block may contain another block (`column > column__cards > task > task__title`). An element always sits inside its
own block with no other block in between. `.task > .task__body > .assignee > .task__title` is interlaced: the title
belongs to `task`, but `assignee` is in the way. In a view that means: a slot (`ReactNode` prop) is the border of the
block; whatever a container puts into it is a new block.

```tsx
/* ❌ Wrong: task elements rendered inside another block */
<div className={styles['task']}>
  <Card><h3 className={styles['task__title']}>{title}</h3></Card>
</div>

/* ✅ Right: the card is the block here; the task view passes values, not its elements */
<Card title={title} selected={selected} footer={actions}>{assignee}</Card>
```

### Rule 4: no nesting deeper than the block

Prefer flat rules. If you use SCSS nesting at all, it is one level of `&` sugar directly under the block
(`&__title`, `&--selected`, `&:hover`) and never a selector inside a selector. Media queries and mixins wrap rules,
they are not nested inside them.

```scss
/* ❌ Wrong */
.task {
  .task__title { }                  /* resolves to a combinator */
  &__body { &--wide { } }           /* two levels */
  @media (min-width: 768px) { }     /* breakpoint inside the block */
}

/* ✅ Right */
.task { }
.task__title { }
.task__body--wide { }
@media (min-width: 768px) { .task { --task-padding: var(--space-6); } }
```

## Design Tokens

Two levels of custom properties, both named, both flat.

- **global tokens** live on `:root` in `tokens.scss`: `--color-*`, `--space-*`, `--font-size-*`, `--radius-*`,
  `--shadow-*`, `--font-weight-*`, `--line-height-*`. Never a hard-coded value where a token exists
- **component tokens** are prefixed with the block: `--task-title-color`, `--task-padding`. An element reads one with a
  fallback (`var(--task-title-color, var(--color-text))`); the fallback is the default variant. Modifiers, states and
  breakpoints set them
- a component token exists because something *changes* it. Do not wrap a global token once just to have a name

```scss
/* ❌ Wrong */
.task { padding: 16px; }                                      /* hard-coded */
.task { --task-padding: var(--space-4); padding: var(--task-padding); }  /* indirection nobody uses */

/* ✅ Right */
.task { padding: var(--space-4); }                            /* nothing changes it: global token */
.task { padding: var(--task-padding, var(--space-4)); }       /* a breakpoint changes it: component token */
```

A parent may set a child's component token to customise it without knowing its markup: `.column { --card-padding:
var(--space-2); }` and every `Card` inside follows. That is the only sanctioned parent-to-child styling.

## The Trick: Config In, Pixels Out

The whole architecture rests on one sentence: **modifiers, states and breakpoints only set tokens; block and elements
only read them.** Real properties (`color`, `padding`, `box-shadow`, `display`) appear in `.block` and `.block__element`
rules and nowhere else. Every other rule is a list of `--task-*: value` lines. Three problems that BEM leaves open all
disappear with it.

### Problem 1: a modifier that reaches into an element

```scss
/* ❌ Wrong: the modifier nests, and we are back to the selectors BEM was meant to avoid */
.task__title { color: var(--color-text); }
.task__icon { color: var(--color-muted); }
.task--dark .task__title { color: white; }
.task--dark .task__icon { color: gold; }

/* ❌ Also wrong: a modifier on every element, for every variant, from every parent */
<span className="task__icon task__icon--dark" />

/* ✅ Right: token on the block, override in the modifier */
.task__title { color: var(--task-title-color, var(--color-text)); }
.task__icon { color: var(--task-icon-color, var(--color-muted)); }
.task--dark {
  --task-title-color: white;
  --task-icon-color: gold;
}
```

One modifier configures the block and all its elements; no element knows the variant exists.

### Problem 2: states multiply with variants

With tokens alone, every variant still has to repeat every state: `.task:hover`, `.task--dark:hover`,
`.task--compact:hover`. The way out is to give the state its own token and wire it **once**.

```scss
/* ❌ Wrong: the hover is rewritten for every variant */
.task:hover { --task-icon-color: white; }
.task--dark { --task-icon-color: gold; }
.task--dark:hover { --task-icon-color: orange; }

/* ✅ Right: states are configuration too */
.task__icon { color: var(--task-icon-color, var(--color-muted)); }
.task:hover { --task-icon-color: var(--task-hover-icon-color, var(--color-text)); }

.task--dark {
  --task-icon-color: gold;
  --task-hover-icon-color: orange;
}
```

The fallback in `var()` is the primary variant. A state is wired once on the block or element; a variant is a list of
values, including the values for its states. The same holds for `:focus-visible`, `:disabled`, `[aria-selected='true']`
and `[data-dragging]`: the selector sets tokens, the element reads them.

### Problem 3: breakpoints repeat the same work per element

```scss
/* ❌ Wrong: one media query per element */
@media (min-width: 768px) {
  .task { padding: var(--space-6); }
  .task__title { font-size: var(--font-size-4); }
  .task__icon { width: 20px; }
}

/* ✅ Right: the breakpoint is one config on the block */
.task { padding: var(--task-padding, var(--space-4)); }
.task__title { font-size: var(--task-title-size, var(--font-size-3)); }
.task__icon { width: var(--task-icon-size, 16px); }

@media (min-width: 768px) {
  .task {
    --task-padding: var(--space-6);
    --task-title-size: var(--font-size-4);
    --task-icon-size: 20px;
  }
}
```

Works the same in `@container`, and a variant can still override the responsive values because they are just tokens.

### The whole view

```scss
/* Task.module.scss */
@use '@/styles/mixins' as *;

/* block: reads tokens, holds the real properties */
.task {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--task-padding, var(--space-4));
  border: 1px solid var(--task-border-color, var(--color-border));
  border-radius: var(--radius-2);
  background: var(--task-background, var(--color-surface));
  box-shadow: var(--task-shadow, none);
  outline: var(--task-outline, none);
  transition: box-shadow 200ms ease;
}

/* states: wired once, set tokens */
.task:hover { --task-shadow: var(--task-hover-shadow, var(--shadow-2)); }
.task:focus-visible { --task-outline: 2px solid var(--color-focus); }

/* modifiers: configuration */
.task--selected {
  --task-border-color: var(--color-brand);
  --task-hover-shadow: var(--shadow-3);
}
.task--done {
  --task-title-color: var(--color-muted);
  --task-title-decoration: line-through;
}

/* elements: read tokens */
.task__title {
  margin: 0;
  font-size: var(--task-title-size, var(--font-size-3));
  color: var(--task-title-color, var(--color-text));
  text-decoration: var(--task-title-decoration, none);
}
.task__footer { display: flex; gap: var(--space-2); }
.task__body { color: var(--color-muted); }

/* breakpoints at the end: configuration */
@include md-n-above {
  .task {
    --task-padding: var(--space-6);
    --task-title-size: var(--font-size-4);
  }
}
```

## Variants From Props

A view turns props into class names and nothing else. A **variant** is a prop the view defines (`variant: 'compact' |
'wide'`); a **state** is a value the container computed (`selected`, `done`). Both become `--modifiers`. The view never
computes state and never toggles a class from JS on its own; hover, focus and active are CSS.

```tsx
// ❌ Wrong: state in the view, styling from JS
const Task = ({ title }: Props) => {
  const [hovered, setHovered] = useState(false);
  return <div style={{ boxShadow: hovered ? '0 2px 4px #0003' : 'none' }} onMouseEnter={() => setHovered(true)}>…</div>;
};

// ✅ Right: props in, class names out; hover is .task:hover
type Props = { title: string; selected: boolean; done: boolean; variant?: 'compact' | 'wide'; onSelect: () => void; actions: ReactNode };

const Task = ({ title, selected, done, variant, onSelect, actions }: Props) => (
  <div
    className={cx(styles['task'], selected && styles['task--selected'], done && styles['task--done'], variant && styles[`task--${variant}`])}
    onClick={onSelect}
  >
    <h3 className={styles['task__title']}>{title}</h3>
    <div className={styles['task__footer']}>{actions}</div>
  </div>
);
```

`cx` is `classnames` or three lines of your own; use positional `condition && styles['…']` arguments, not an object
(CSS module lookups are `string | undefined`, and `{ [styles['task--selected']]: selected }` is a type error).

```ts
export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');
```

Attribute states are the other sanctioned input: when the markup already carries `aria-selected`, `aria-expanded`,
`disabled` or `data-dragging`, style that instead of adding a modifier (`.task[aria-selected='true'] { --task-border-color:
… }`). One source of truth per state; do not set both.

## Themes

A theme is a scope that overrides **global** tokens. It lives in `themes.scss` (a global stylesheet, not a module) and
is applied by a class on a root element. Views never mention it: their component tokens fall back to global tokens, so
they follow the theme without a line of theme code.

```scss
/* themes.scss */
.theme-dark {
  --color-surface: #1f1f1f;
  --color-text: #f4f4f4;
  --color-border: #3a3a3a;
}
```

```scss
/* ❌ Wrong: per-component theme selectors bring the combinator back */
.theme-dark .task { background: #1f1f1f; }
.theme-dark .task__title { color: white; }

/* ✅ Right: the component reads global tokens; the theme changes those */
.task { background: var(--task-background, var(--color-surface)); }
.task__title { color: var(--task-title-color, var(--color-text)); }
```

When a component must look different in a theme in a way no global token describes, that is a variant: give the view a
prop and a `--modifier`, and let the container (or the page) decide. If the same need shows up in three components, it is
a missing global token.

## Responsive

- mobile-first: the block and elements describe the small screen; breakpoints add
- breakpoint mixins from `mixins.scss` (`md-n-above`, `lg-n-above`, ...) or plain `@media` / `@container`; the mixin is
  a wrapper around rules, never inside a rule
- **a breakpoint only sets tokens**, on the block; elements need no media query of their own
- all breakpoints at the end of the file, grouped by breakpoint

```scss
/* ❌ Wrong */
.task__title { font-size: var(--font-size-3); @include md-n-above { font-size: var(--font-size-4); } }

/* ✅ Right */
.task__title { font-size: var(--task-title-size, var(--font-size-3)); }
@include md-n-above { .task { --task-title-size: var(--font-size-4); } }
```

## What Not To Do

```scss
export const Wrapper = styled.div``;              /* ❌ styled-components / emotion: not for new code */
<div style={{ padding: 16 }} />                    /* ❌ inline style; fine only for truly dynamic values (a measured width, a drag offset) */
.task__title { margin: 0 !important; }            /* ❌ !important; single-class selectors have nothing to fight */
.board .column .task .task__title { }             /* ❌ deep selector */
.task :global(.card) { }                          /* ❌ reaching into another block; set --card-* tokens instead */
:global(.task) { }                                /* ❌ a module class leaking into the global namespace */
.task { padding: 16px; color: #333; }             /* ❌ hard-coded values where a token exists */
.task--selected { border-color: blue; }           /* ❌ a modifier setting a real property */
```

Inline styles for a truly dynamic value go through a custom property as well, so the stylesheet stays the only place with
real properties: `<div className={styles['column']} style={{ '--column-width': `${width}px` } as CSSProperties}>` and
`.column { width: var(--column-width, auto); }`.

## File Order

1. `@use` imports
2. block: the real properties, reading tokens
3. block states (`:hover`, `:focus-visible`, `[aria-*]`), setting tokens
4. block modifiers, setting tokens
5. elements and element states / modifiers
6. breakpoints at the end, grouped by breakpoint, setting tokens

## Checklist

- [ ] `View.module.scss` next to `View.tsx`, block named after the view; the container imports no styles
- [ ] every selector is a single class, optionally with pseudo-classes / pseudo-elements / one attribute state
- [ ] one block or element class per tag; blocks nest, they never interlace; slots are block borders
- [ ] no tag, id or `*` selectors; no combinators; at most one level of `&` sugar
- [ ] global tokens for anything that does not change; a component token (`--block-*`) for anything that does, read with a fallback
- [ ] real properties only in `.block` and `.block__element`
- [ ] modifiers, states and breakpoints contain only `--token: value` lines
- [ ] states are wired once on the block or element; variants supply the state values
- [ ] variants and states arrive as props and become `--modifiers`; hover is CSS; no `useState` for styling
- [ ] themes override global tokens on a scope; no `.theme-* .block` selectors
- [ ] breakpoints mobile-first, at the end of the file, tokens only
- [ ] no `!important`, no styled-components / emotion, no inline styles beyond a dynamic custom property
- [ ] `stylelint` passes with `stylelint-config-superarchitecture`

## FAQ

**Isn't this a lot of custom properties?** Yes, one per thing that changes. It replaces one nested selector per
variant × element × state, which is more, and it is grep-able: `--task-title-color` shows every reason the title
changes colour. Do not add a token for a value nothing changes.

**`display: none` in a modifier is a real property. Really a token?** Yes: `.task { display: var(--task-display, flex); }`
and `.task--hidden { --task-display: none; }`. If a team finds that pedantic, the lint has `allow: ['display',
'transition']`; keep the list short and the same for the whole project.

**Where does `transition` go?** On the element, always, since it describes how the element moves between the values the
states set. A modifier that needs another timing sets `--task-transition-duration`.

**What about `:first-child`, `:nth-child`, `:empty`?** Structural pseudo-classes are not states; a real property is fine
there. `:empty` is treated as a state by the lint because it usually reacts to data; set a token or adjust `states`.

**Can a parent style a child block?** Only by setting the child's component tokens on itself (`.column { --card-padding:
… }`). Never by selecting the child's classes.

**Why not `:has()`, `:is()`, `:where()`?** They are selectors that depend on other selectors, which is what the
architecture removes. State that a parent knows arrives as a prop from the container and becomes a modifier.

**Utility classes / Tailwind?** Not in views following this document. Utilities are unnamed modifiers; the view's
stylesheet is where the names live. A utility-only shared layer for spacing is a different architecture, not a mix.

**Third-party components?** Wrap them in a view with its own block, and pass the class names or CSS variables the library
supports. If the library needs a descendant selector, put it in one file with a `/* stylelint-disable */` and a comment
that says why; that file is the border of the architecture, not an example of it.

## Glossary

- **block**: the view's root class, named after the view
- **element**: a part of a block, `block__element`, always inside its own block
- **modifier**: a variant or state class, `block--modifier`, `block__element--modifier`; only sets tokens
- **state**: a pseudo-class or attribute state on a block or element; only sets tokens
- **global token**: a custom property on `:root` (or a theme scope), the design system's scale
- **component token**: a `--block-*` custom property read by the block or an element with a fallback
- **theme**: a scope that overrides global tokens
- **slot**: a `ReactNode` prop of a view, and the border of its block
