# react-superarchitecture

**Don't mix logic and markup.**

One rule, taken seriously, and a whole React architecture falls out of it: where files go, what a component may import, where state lives, why things re-render, and how the CSS is written. This repository is that architecture written down as guidelines, packaged as Claude skills, and enforced by lint rules.

It comes out of years of building React applications, in teams and on side projects, and two meetup talks. The text was generated with AI from the author's instructions, notes, and existing team guidelines, and then read, corrected, and used. Treat it as opinionated, not neutral.

---

## The rule

A **view** is a component that takes props and returns markup. It holds no state, runs no effects, calls no data hooks, and **never imports a container**. A **container** is a component that reads data through hooks, creates handlers, and renders **only views and other containers**, with no markup of its own. Containers compose other containers by creating their elements and handing them to views as `ReactNode` slots.

```tsx
// Task.tsx — a view: props in, markup out
export function Task({ title, actions }: { title: string; actions: ReactNode }) {
  return (
    <div className="task">
      <h3 className="task__title">{title}</h3>
      {actions}
    </div>
  );
}

// TaskContainer.tsx — a container: data in, one view out
export const TaskContainer = memo(function TaskContainer({ id }: { id: string }) {
  const title = useTaskTitle(id);
  return <Task title={title} actions={<TaskActionsContainer taskId={id} />} />;
});
```

The import graph becomes flat (containers import containers and their own view; views import only other views: `Button`, `Input`, a heading) while the render tree stays as deep as it needs to be. React puts the two together at runtime.

What you get:

- **Views are pure functions.** Storybook stories and tests need no providers, no mocks, no fetch.
- **Two crafts, two kinds of files.** UI in views, logic in containers.
- **Predictable rendering.** Only containers subscribe, so `memo` on containers is the complete optimisation story.
- **A contract on one edge.** The view's props type is the interface between data and UI; a change on either side is visible there.
- **Server components for free.** A server component cannot be used inside a client one, but it can be passed through a slot. Same shape, same rule.

---

## What is in here

```
docs/                          guidelines (read in order)
  01-repo-structure.md         folders, file naming, import direction, path aliases
  02-containers-and-views.md   the rule: definitions, consequences, islands, memo, FAQ
  03-data-flow.md              hooks as data API, minimal subscription, small writes,
                               designing containers from data (views → data → places → containers)
  04-modules.md                modules, shared layer, module boundaries and cycles
  05-css-architecture.md       BEM, tokens as custom properties, modifiers set tokens
  06-tooling.md                lint rules, stylelint, analyzer, skills
.claude/skills/                skills for Claude Code (copy into your project)
  containers-and-views/
  module-scaffolding/
  css-architecture/
  refactoring-to-containers/
  reviewing-architecture/
packages/
  eslint-plugin/               eslint-plugin-superarchitecture: 13 rules + standalone runner
  stylelint-config/            stylelint-config-superarchitecture: BEM + tokens rules
examples/
  board/src/                   a kanban board written by the rules
    modules/board/             containers, views, hooks.ts, boardSlice.ts, index.ts
    components/Card/           the shared markup view
    store/                     store.ts + typed base hooks
    app/App.tsx                composition root (Provider + BoardContainer)
```

---

## How to use it

**Read.** Start with `docs/02-containers-and-views.md` (the rule) and `docs/03-data-flow.md` (how data reaches views). Then `01` for where files go, `04` for modules, `05` for CSS. Every guideline ends with a checklist.

**Lint.** Add the ESLint plugin and turn rules on one at a time, starting with `view-no-container-import`:

```js
// eslint.config.mjs
import tseslint from 'typescript-eslint';
import superarchitecture from 'eslint-plugin-superarchitecture';

export default [
  ...tseslint.configs.recommended,
  superarchitecture.configs.recommended,
  { settings: { superarchitecture: { modulesDir: 'src/modules', sharedDir: 'src/components', aliases: { '@/': 'src/' } } } },
];
```

To turn on a single rule instead of the whole set:

```js
export default [
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { superarchitecture },
    rules: { 'superarchitecture/view-no-container-import': 'error' },
    settings: { superarchitecture: { modulesDir: 'src/modules', sharedDir: 'src/components' } },
  },
];
```

Or get a report on any codebase without touching its config:

```sh
node packages/eslint-plugin/bin/check.js --root ../my-app --modules src/modules --shared src/components
```

For CSS: `extends: ['stylelint-config-superarchitecture']` with `customSyntax: 'postcss-scss'`.

**Run it.** Node 18+ and Yarn 1 (or npm). Install the two packages once, then lint the example and run the stylelint self-test from the repository root:

```sh
(cd packages/eslint-plugin && yarn) && (cd packages/stylelint-config && yarn)
npm run check:example     # 0 violations expected
npm run test:stylelint    # 21 cases
```

**Let Claude follow it.** Copy `.claude/skills/` into your project. Claude Code picks the skills up automatically: when you ask it to add a component, wire data, style something, scaffold a module, or review a PR, it applies these rules and points to the guideline it used.

**Look at the example.** `examples/board/src/` is small enough to read in ten minutes: one module (`modules/board`) with eight containers, their views, a slice with small writes and a `hooks.ts` that is the whole data API; one shared view (`components/Card`); and the store assembly (`store/`). `npm run check:example` lints it with the module rules on.

---

## Adopting it on an existing codebase

1. Pick one view that imports a container. Give it a `ReactNode` prop instead and let the container above fill it.
2. Move the hook out of a view into a container above it, or into a child container placed in a slot.
3. Split one wide hook (`useBoard()`) into narrow, id-addressed ones (`useTaskTitle(id)`).
4. Turn on `view-no-container-import`. Get it to zero. Turn on the next rule.
5. Delete the Storybook decorators and Jest mocks that stopped being necessary.

The `refactoring-to-containers` skill walks through the same steps with code.

---

## Where it comes from

- Talk: *Jedno jednoduché pravidlo, které změnilo, jak píšu React aplikace* (Frontendisti, September 2026).
- Talk: the CSS part comes from an earlier Frontendisti talk on BEM and custom properties (June 2026).
- The numbers in docs 02 and 03 come from an import/render graph analyzer that is not published yet.

## License

0BSD. Use it, copy it, change it, ship it; no attribution required.
