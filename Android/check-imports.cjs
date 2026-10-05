/**
 * Static import/export validator for the Android app.
 *
 * Metro resolves module files but does NOT verify that a named import
 * actually exists in the target module. A missing named export compiles
 * fine and only crashes at runtime with "undefined is not an object" or
 * "Property 'x' does not exist". This script catches those ahead of time.
 *
 * Usage: node check-imports.cjs
 */
var fs = require('fs');
var path = require('path');

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(function (e) {
    return e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)];
  });
}

var files = ['App.js', 'index.js']
  .concat(walk('src').filter(function (f) { return /\.js$/.test(f); }))
  .filter(function (f) { return fs.existsSync(f); });

var issues = [];

files.forEach(function (f) {
  var src = fs.readFileSync(f, 'utf8');
  var re = /(?:import|export)\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  var m;
  while ((m = re.exec(src))) {
    var spec = m[3];
    if (spec.charAt(0) !== '.') continue;

    var base = path.resolve(path.dirname(f), spec);
    var target = null;
    [base, base + '.js', base + '.jsx', path.join(base, 'index.js')].forEach(function (c) {
      if (!target && fs.existsSync(c) && fs.statSync(c).isFile()) target = c;
    });

    if (!target) {
      issues.push(f + ': cannot resolve module ' + spec);
      continue;
    }

    var exp = fs.readFileSync(target, 'utf8');
    var names = m[2].split(',').map(function (s) {
      return s.trim().split(/\s+as\s+/)[0].trim();
    }).filter(Boolean);

    names.forEach(function (n) {
      // `async` and generator `function*` must be allowed between `export` and
      // the name, otherwise `export async function foo()` is reported as a
      // missing export (a false alarm that hides real ones).
      var declared =
        new RegExp('export\\s+(?:async\\s+)?(?:const|let|var|function\\*?|class)\\s+' + n + '\\b').test(exp) ||
        new RegExp('export\\s*\\{[^}]*\\b' + n + '\\b').test(exp) ||
        new RegExp('exports\\.' + n + '\\b').test(exp) ||
        /export\s+default/.test(exp) && n === 'default';
      if (!declared) issues.push(f + ': missing export "' + n + '" in ' + spec);
    });
  }
});

if (issues.length) {
  console.log('ISSUES (' + issues.length + '):');
  issues.forEach(function (i) { console.log('  ' + i); });
  process.exitCode = 1;
} else {
  console.log('All named imports resolve OK across ' + files.length + ' files');
}
