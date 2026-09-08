/**
 * superarchitecture/modifier-sets-tokens-only
 *
 * Modifiers, states and media queries only set tokens; elements only read them.
 *
 * Inside any rule whose selector carries a BEM modifier (`--`), a state pseudo-class (`:hover`, `:focus`,
 * `:focus-visible`, `:focus-within`, `:active`, `:disabled`, `:checked`, ...), an `[aria-*]` / `[data-*]` attribute
 * state, or inside an `@media` / `@container` at-rule, every declaration must be a custom property (`--x: ...`).
 *
 * Options (secondary):
 *   allow:    string[]  properties that are still allowed in such rules (default: [])
 *   states:   string[]  pseudo-class names treated as states (replaces the default list)
 *   atRules:  string[]  at-rule names whose bodies count as "config" (default: ['media', 'container', 'include'])
 */
import stylelint from 'stylelint';

const { createPlugin, utils } = stylelint;

export const ruleName = 'superarchitecture/modifier-sets-tokens-only';

export const messages = utils.ruleMessages(ruleName, {
  rejected: (prop, where) =>
    `Modifiers, states and media queries only set tokens; move "${prop}" to the element and read it with var(--…) (found in ${where})`,
});

const DEFAULT_STATES = [
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'visited',
  'target',
  'disabled',
  'enabled',
  'checked',
  'indeterminate',
  'invalid',
  'valid',
  'required',
  'optional',
  'placeholder-shown',
  'read-only',
  'open',
  'popover-open',
  'empty',
];

const DEFAULT_AT_RULES = ['media', 'container', 'include'];

const isString = (v) => typeof v === 'string';

/** the reason a selector counts as configuration, or null */
function configReasonOfSelector(selector, states) {
  // strip strings and comments so attribute values / comments cannot fake a marker
  const s = selector.replace(/"[^"]*"|'[^']*'/g, '""').replace(/\/\*[\s\S]*?\*\//g, '');
  if (/(^|[^-])--(?!-)/.test(s.replace(/var\(/g, ''))) return `modifier "${selector.trim()}"`;
  const pseudo = s.match(/:(?!:)([a-z-]+)/g);
  if (pseudo) {
    for (const p of pseudo) {
      const name = p.slice(1);
      if (states.includes(name)) return `state "${selector.trim()}"`;
    }
  }
  if (/\[\s*(aria-|data-)/.test(s)) return `state "${selector.trim()}"`;
  return null;
}

/** walks up from a declaration; returns why its context is configuration, or null */
function configReason(decl, states, atRules) {
  let node = decl.parent;
  while (node && node.type !== 'root') {
    if (node.type === 'rule') {
      const reason = configReasonOfSelector(node.selector, states);
      if (reason) return reason;
    } else if (node.type === 'atrule' && atRules.includes(node.name)) {
      return `@${node.name}${node.params ? ` ${node.params.trim()}` : ''}`;
    }
    node = node.parent;
  }
  return null;
}

const ruleFunction = (primary, secondary) => (root, result) => {
  const valid = utils.validateOptions(
    result,
    ruleName,
    { actual: primary, possible: [true] },
    {
      actual: secondary,
      possible: { allow: [isString], states: [isString], atRules: [isString] },
      optional: true,
    },
  );
  if (!valid) return;

  const allow = new Set(secondary?.allow ?? []);
  const states = secondary?.states ?? DEFAULT_STATES;
  const atRules = secondary?.atRules ?? DEFAULT_AT_RULES;

  root.walkDecls((decl) => {
    const prop = decl.prop;
    if (prop.startsWith('--') || prop.startsWith('$')) return; // a token (or an SCSS variable) is what we want here
    if (allow.has(prop.toLowerCase())) return;
    const where = configReason(decl, states, atRules);
    if (!where) return;
    utils.report({
      ruleName,
      result,
      node: decl,
      message: messages.rejected(prop, where),
      word: prop,
    });
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;
ruleFunction.meta = {
  url: 'https://github.com/jiricerhan/react-superarchitecture/blob/main/packages/stylelint-config/README.md',
};

export default createPlugin(ruleName, ruleFunction);
