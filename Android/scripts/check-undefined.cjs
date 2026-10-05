/**
 * Undefined-identifier check (a focused `no-undef`).
 *
 * WHY THIS EXISTS
 * Both existing checkers were blind to the bug that broke LAN connectivity:
 *   - check-all-syntax.cjs parses fine: an undefined variable is a *runtime*
 *     error, so `${BASE_URL}` parses perfectly and only throws when the user
 *     finally opens that screen.
 *   - check-imports.cjs only looks at names on the import statement, so a
 *     reference to something that was renamed away is not noticed either.
 * Both reported "all good" while `getHealth()` would throw
 * `ReferenceError: BASE_URL is not defined` on tap.
 *
 * This walks every referenced identifier and fails when it is neither declared,
 * imported, parameterised, nor a known platform/JS global.
 *
 * Usage: node scripts/check-undefined.cjs
 */
var fs = require('fs');
var path = require('path');
var parser = require('@babel/parser');
var traverse = require('@babel/traverse').default;

var ROOT = path.resolve(__dirname, '..');

/**
 * Globals that legitimately exist in React Native / Hermes and so are not
 * "undefined" bugs. Anything NOT listed here and not bound in scope is flagged.
 */
var GLOBALS = [
  // language
  'Array', 'ArrayBuffer', 'BigInt', 'Boolean', 'Date', 'Error', 'EvalError', 'Function',
  'Infinity', 'Intl', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'Promise', 'Proxy',
  'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Set', 'String', 'Symbol',
  'SyntaxError', 'TypeError', 'URIError', 'WeakMap', 'WeakSet', 'decodeURI', 'decodeURIComponent',
  'encodeURI', 'encodeURIComponent', 'escape', 'eval', 'globalThis', 'isFinite', 'isNaN',
  'parseFloat', 'parseInt', 'undefined', 'unescape',
  // commonjs / node
  '__dirname', '__filename', 'console', 'exports', 'global', 'module', 'process', 'require',
  'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout',
  // react / react-native surface used across the app
  'React', 'JSX', 'fetch', 'AbortController', 'FormData', 'Headers', 'Request', 'Response',
  'URL', 'URLSearchParams', 'TextEncoder', 'TextDecoder', 'btoa', 'atob', 'structuredClone',
  '__DEV__', 'Expo',
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(function (e) {
    var p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

var files = [path.join(ROOT, 'App.js'), path.join(ROOT, 'index.js')]
  .concat(walk(path.join(ROOT, 'src')))
  .filter(function (f) { return /\.js$/.test(f); });

var problems = [];

files.forEach(function (file) {
  var rel = path.relative(ROOT, file);
  var ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator'],
    });
  } catch (e) {
    problems.push(rel + ': parse error -> ' + e.message);
    return;
  }

  traverse(ast, {
    ReferencedIdentifier: function (pathRef) {
      var name = pathRef.node.name;
      if (GLOBALS.indexOf(name) !== -1) return;
      // A JSX tag (`<View />`) is a component reference, not a variable read.
      var parent = pathRef.parent;
      if (
        parent &&
        (parent.type === 'JSXOpeningElement' ||
          parent.type === 'JSXClosingElement' ||
          parent.type === 'JSXMemberExpression' ||
          parent.type === 'JSXAttribute')
      ) {
        return;
      }
      // Optional chaining creates a synthetic "OptionalMemberExpression" whose
      // object is still a real reference, so nothing to special-case there.
      if (pathRef.scope.hasBinding(name, true)) return;
      var line = pathRef.node.loc ? pathRef.node.loc.start.line : 0;
      problems.push(rel + ':' + line + ': "' + name + '" is not defined');
    },
  });
});

if (problems.length) {
  console.log('UNDEFINED IDENTIFIERS (' + problems.length + '):');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exitCode = 1;
} else {
  console.log('No undefined identifiers across ' + files.length + ' files');
}
