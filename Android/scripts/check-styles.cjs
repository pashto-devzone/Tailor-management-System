/**
 * Verifies that every `styles.foo` referenced in a file is actually defined in
 * that file's StyleSheet.create({...}) block (and that no style key is used
 * before it exists). Catches the same class of bug as an unimported component:
 * "undefined is not an object (evaluating 'styles.x')".
 *
 * Usage: node scripts/check-styles.cjs
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');

function walk(d) {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(function (e) {
    var p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

var files = [path.join(ROOT, 'App.js')]
  .concat(walk(path.join(ROOT, 'src')))
  .filter(function (f) { return /\.js$/.test(f); });

var problems = [];

files.forEach(function (f) {
  var rel = path.relative(ROOT, f);
  var src = fs.readFileSync(f, 'utf8');

  // Collect style keys from every StyleSheet.create({ ... }) block.
  var keys = Object.create(null);
  var re = /StyleSheet\.create\(\{/g;
  var m;
  while ((m = re.exec(src))) {
    var i = m.index + m[0].length - 1; // position of '{'
    var depth = 0;
    var end = -1;
    for (var j = i; j < src.length; j++) {
      var ch = src[j];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) continue;
    var body = src.slice(i + 1, end);
    // top-level keys only (depth 0 inside the object)
    var d = 0;
    var lineStart = 0;
    var lines = body.split(/\n/);
    lines.forEach(function (line) {
      var trimmed = line.trim();
      var nameMatch = /^([A-Za-z_$][\w$]*)\s*:/.exec(trimmed);
      if (nameMatch && d === 0) keys[nameMatch[1]] = true;
      for (var k = 0; k < line.length; k++) {
        if (line[k] === '{' || line[k] === '[') d++;
        else if (line[k] === '}' || line[k] === ']') d--;
      }
    });
  }

  // Collect every styles.foo usage.
  var used = Object.create(null);
  var u = /styles\.([A-Za-z_$][\w$]*)/g;
  var um;
  while ((um = u.exec(src))) used[um[1]] = true;

  Object.keys(used).forEach(function (name) {
    if (!keys[name]) problems.push(rel + ' -> styles.' + name + ' is not defined');
  });
});

if (problems.length) {
  console.log('STYLE PROBLEMS (' + problems.length + '):');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exitCode = 1;
} else {
  console.log('All styles.* references resolve across ' + files.length + ' files');
}
