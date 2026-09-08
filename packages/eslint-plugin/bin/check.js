#!/usr/bin/env node
/**
 * Run the twographs rules over a project without touching its ESLint config.
 *   node bin/check.js --root C:/projects/akicolors --modules src/modules --shared src/components --alias @/=src/ [--dir src] [--json]
 */
import path from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import plugin from '../index.js';

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const has = (name) => argv.includes(`--${name}`);

const root = path.resolve(arg('root', process.cwd()));
const modulesDir = arg('modules', '');
const sharedDir = arg('shared', '');
// note for Git Bash on Windows: MSYS rewrites "@/=src/" into a Windows path; pass MSYS_NO_PATHCONV=1 or rely on the default
const aliasArg = arg('alias', '@/=src/').replace(/@[A-Za-z]:\/[^=]*\//, '@/');
const aliases = Object.fromEntries(aliasArg.split(',').filter(Boolean).map((a) => a.split('=')));
const dir = arg('dir', 'src');
const moduleSharedDirs = (arg('module-shared', 'shared,public') || '').split(',').filter(Boolean);

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      ignores: ['**/node_modules/**', '**/__tests__/**', '**/*.test.*', '**/*.stories.*', '**/dist/**', '**/.next/**'],
      languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
      settings: { twographs: { root, modulesDir, sharedDir, moduleSharedDirs, aliases } },
      ...plugin.configs.recommended,
    },
  ],
});

const results = await eslint.lintFiles([path.join(root, dir, '**/*.{ts,tsx}')]);
const byRule = new Map();
const byFile = [];
for (const r of results) {
  if (!r.messages.length) continue;
  const rel = path.relative(root, r.filePath).replace(/\\/g, '/');
  byFile.push({ file: rel, messages: r.messages.map((m) => ({ rule: m.ruleId, line: m.line, message: m.message, severity: m.severity })) });
  for (const m of r.messages) byRule.set(m.ruleId, (byRule.get(m.ruleId) ?? 0) + 1);
}
if (has('json')) { console.log(JSON.stringify({ root, files: results.length, byRule: Object.fromEntries(byRule), byFile }, null, 2)); process.exit(0); }
console.log(`${results.length} files linted in ${root}`);
for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${rule}`);
if (has('verbose')) for (const f of byFile) { console.log(`\n${f.file}`); for (const m of f.messages) console.log(`  ${m.line}: [${m.rule?.replace('twographs/', '')}] ${m.message}`); }
process.exit(byRule.size ? 1 : 0);
