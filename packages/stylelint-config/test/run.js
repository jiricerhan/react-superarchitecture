/**
 * Self-check: runs stylelint programmatically on inline good / bad fixtures.
 * `node test/run.js` exits non-zero when an expectation fails.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';

const configPath = fileURLToPath(new URL('../index.js', import.meta.url));
const fixtureDir = path.dirname(fileURLToPath(import.meta.url));

const TOKENS_ONLY = 'superarchitecture/modifier-sets-tokens-only';

/** @type {{ name: string, code: string, expect: string[], options?: object, file?: string }[]} */
const cases = [
  // ------------------------------------------------------------------ good
  {
    name: 'flat BEM module: block/elements read tokens, modifier/state/media set them',
    expect: [],
    code: `
.task {
  --task-title-color: var(--color-text);
  --task-shadow: none;
  display: flex;
  box-shadow: var(--task-shadow);
  padding: var(--task-padding, var(--space-4));
}
.task:hover { --task-shadow: var(--task-hover-shadow, var(--shadow-2)); }
.task:focus-visible { --task-outline: 2px solid var(--color-focus); }
.task[aria-selected='true'] { --task-title-color: var(--color-brand); }
.task--selected {
  --task-title-color: var(--color-brand);
  --task-hover-shadow: var(--shadow-3);
}
.task__title { color: var(--task-title-color); }
.task__title--done { --task-title-decoration: line-through; }
.task__title::before { content: ''; display: inline-block; }
.task__count:first-child { margin: 0; }
@media (min-width: 768px) {
  .task { --task-padding: var(--space-6); }
}
@container board (min-width: 600px) {
  .task { --task-padding: var(--space-5); }
}
`,
  },
  {
    name: 'SCSS: one level of & sugar under the block is fine',
    expect: [],
    code: `
.column {
  display: grid;
  gap: var(--column-gap, var(--space-3));
  &__title { font-size: var(--column-title-size, var(--font-size-3)); }
  &--compact { --column-gap: var(--space-1); }
  &:hover { --column-title-color: var(--color-brand); }
}
@include md-n-above {
  .column { --column-gap: var(--space-5); }
}
`,
  },
  {
    name: 'option allow: listed properties may stay in a state / modifier',
    expect: [],
    options: { allow: ['transition', 'display'] },
    code: `
.task { color: var(--task-color, inherit); }
.task:hover { transition: color 200ms; }
.task--hidden { display: none; }
`,
  },
  {
    name: 'option atRules: an @include that is not a breakpoint can be exempted',
    expect: [],
    options: { atRules: ['media', 'container'] },
    code: `
@include some-mixin {
  .task { padding: 0; }
}
`,
  },

  // ------------------------------------------------------------------- bad
  {
    name: 'modifier reaching into an element (descendant combinator)',
    expect: ['selector-max-class', 'selector-max-compound-selectors', 'selector-max-combinators', TOKENS_ONLY],
    code: `.task--dark .task__title { color: white; }`,
  },
  {
    name: 'state setting a real property',
    expect: [TOKENS_ONLY],
    code: `.task:hover { box-shadow: 0 2px 4px black; }`,
  },
  {
    name: 'modifier setting a real property',
    expect: [TOKENS_ONLY],
    code: `.task__title--done { text-decoration: line-through; }`,
  },
  {
    name: 'attribute state setting a real property',
    expect: [TOKENS_ONLY],
    code: `.task[data-selected='true'] { border-color: blue; }`,
  },
  {
    name: 'media query setting a real property',
    expect: [TOKENS_ONLY],
    code: `@media (min-width: 768px) { .task { padding: 24px; } }`,
  },
  {
    name: 'breakpoint mixin setting a real property',
    expect: [TOKENS_ONLY],
    code: `@include md-n-above { .task { padding: 24px; } }`,
  },
  {
    name: 'nested & state setting a real property',
    expect: [TOKENS_ONLY],
    code: `.task { &:hover { color: red; } }`,
  },
  {
    name: 'allow does not cover unlisted properties',
    expect: [TOKENS_ONLY],
    options: { allow: ['transition'] },
    code: `.task:hover { transition: color 200ms; color: red; }`,
  },
  {
    name: 'two classes on one selector',
    expect: ['selector-max-class'],
    code: `.task.is-selected { --task-color: blue; }`,
  },
  {
    name: 'non-BEM class name',
    expect: ['selector-class-pattern'],
    code: `.taskTitle { color: red; }`,
  },
  {
    name: 'non-BEM element separator',
    expect: ['selector-class-pattern'],
    code: `.task_title { color: red; }`,
  },
  {
    name: 'tag selector',
    expect: ['selector-max-type', 'selector-max-compound-selectors', 'selector-max-combinators'],
    code: `.task h3 { margin: 0; }`,
  },
  {
    name: 'qualified tag selector',
    expect: ['selector-max-type', 'selector-no-qualifying-type'],
    code: `div.task { margin: 0; }`,
  },
  {
    name: 'id selector',
    expect: ['selector-max-id'],
    code: `#board { margin: 0; }`,
  },
  {
    name: '!important',
    expect: ['declaration-no-important'],
    code: `.task { margin: 0 !important; }`,
  },
  {
    name: 'nested selector under the block (not & sugar)',
    expect: ['selector-max-class', 'selector-max-compound-selectors', 'selector-max-combinators'],
    code: `.task { .task__title { margin: 0; } }`,
  },
  {
    name: 'nesting deeper than one level',
    expect: ['max-nesting-depth'],
    code: `.task { &__body { &--wide { --task-body-width: 100%; } } }`,
  },
];

let failed = 0;

for (const c of cases) {
  const config = { extends: [configPath] };
  if (c.options) config.rules = { [TOKENS_ONLY]: [true, c.options] };

  const result = await stylelint.lint({
    code: c.code,
    codeFilename: path.join(fixtureDir, c.file ?? 'Task.module.scss'),
    config,
  });

  const warnings = result.results.flatMap((r) => r.warnings);
  const invalid = result.results.flatMap((r) => r.invalidOptionWarnings ?? []);
  const parseErrors = result.results.flatMap((r) => r.parseErrors ?? []);
  const got = [...new Set(warnings.map((w) => w.rule))].sort();
  const want = [...new Set(c.expect)].sort();
  const ok = invalid.length === 0 && parseErrors.length === 0 && got.length === want.length && got.every((r, i) => r === want[i]);

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!ok) {
    failed += 1;
    console.log(`      expected: ${want.join(', ') || '(no warnings)'}`);
    console.log(`      got:      ${got.join(', ') || '(no warnings)'}`);
    for (const w of warnings) console.log(`      - [${w.rule}] ${w.line}:${w.column} ${w.text}`);
    for (const w of invalid) console.log(`      - invalid option: ${w.text}`);
    for (const e of parseErrors) console.log(`      - parse error: ${e.text ?? e}`);
  }
}

console.log(`\n${cases.length - failed}/${cases.length} cases passed`);
process.exit(failed === 0 ? 0 : 1);
