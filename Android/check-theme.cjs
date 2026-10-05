/**
 * Validates that every theme.<group>.<key> reference in the Android app
 * exists in src/constants/theme.js. A missing key yields `undefined`, which
 * silently breaks StyleSheet values at runtime (e.g. backgroundColor).
 *
 * Usage: node check-theme.cjs
 */
var fs = require('fs');
var path = require('path');

var themeSrc = fs.readFileSync('src/constants/theme.js', 'utf8');
// theme.js is an ES module; plain require() cannot load it. Strip the export
// keywords and evaluate the object inside a sandboxed function instead.
var theme;
try {
  var transformed = themeSrc
    .replace(/export\s+const\s+/g, 'const ')
    .replace(/export\s+default\s+\w+\s*;?/g, '');
  theme = new Function(transformed + '\nreturn theme;')();
} catch (e) {
  console.error('Failed to evaluate theme.js: ' + e.message);
  process.exit(1);
}

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(function (e) {
    return e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)];
  });
}

var groups = Object.keys(theme);
var files = ['App.js'].concat(walk('src').filter(function (f) { return /\.js$/.test(f); }));
var issues = [];

files.forEach(function (f) {
  var src = fs.readFileSync(f, 'utf8');
  var re = /theme\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)/g;
  var m;
  while ((m = re.exec(src))) {
    var group = m[1];
    var key = m[2];
    if (groups.indexOf(group) === -1) {
      issues.push(f + ': theme.' + group + ' (group missing)');
      continue;
    }
    if (!(key in theme[group])) {
      var line = src.slice(0, m.index).split('\n').length;
      issues.push(f + ':' + line + ': theme.' + group + '.' + key + ' does not exist');
    }
  }
});

if (issues.length) {
  console.log('THEME ISSUES (' + issues.length + '):');
  issues.forEach(function (i) { console.log('  ' + i); });
  process.exitCode = 1;
} else {
  console.log('All theme references valid across ' + files.length + ' files');
}
