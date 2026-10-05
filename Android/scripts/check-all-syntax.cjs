/**
 * Parses every Android source file with @babel/parser (JSX + modern syntax).
 * Catches syntax errors that Metro would report only when a screen loads.
 *
 * Usage: node scripts/check-all-syntax.cjs
 */
var fs = require('fs');
var path = require('path');
var parser = require('@babel/parser');

var ROOT = path.resolve(__dirname, '..');

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(function (e) {
    var p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

var files = [path.join(ROOT, 'App.js'), path.join(ROOT, 'index.js')]
  .concat(walk(path.join(ROOT, 'src')))
  .filter(function (f) { return /\.js$/.test(f); });

var failed = 0;
files.forEach(function (f) {
  var rel = path.relative(ROOT, f);
  try {
    parser.parse(fs.readFileSync(f, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx', 'classProperties', 'objectRestSpread', 'optionalChaining', 'nullishCoalescingOperator'],
    });
    console.log('OK   ' + rel);
  } catch (e) {
    failed++;
    console.log('FAIL ' + rel + ' -> ' + e.message);
  }
});

console.log('');
console.log((files.length - failed) + '/' + files.length + ' files parsed successfully');
process.exitCode = failed ? 1 : 0;
