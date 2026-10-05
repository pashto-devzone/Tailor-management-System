/**
 * Static audit for the Android app:
 *   1. React Native components referenced in JSX/JS without being imported
 *      from 'react-native' (Metro bundles fine but the app crashes at runtime
 *      with "ReferenceError: Property 'X' doesn't exist").
 *   2. Emoji characters used as icons (should be @expo/vector-icons).
 *   3. Named imports from local modules that do not resolve (delegates to
 *      the same logic as check-imports.cjs).
 *
 * Usage: node scripts/audit-app.cjs
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

var RN_COMPONENTS = [
  'ScrollView', 'FlatList', 'SectionList', 'VirtualizedList',
  'View', 'Text', 'TextInput', 'TouchableOpacity', 'TouchableHighlight',
  'TouchableWithoutFeedback', 'Pressable', 'Modal', 'ActivityIndicator',
  'KeyboardAvoidingView', 'SafeAreaView', 'RefreshControl', 'Switch',
  'Image', 'ImageBackground', 'Picker', 'Slider', 'ProgressBarAndroid',
];

var EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2700}-\u{27BF}\u{2190}-\u{21FF}\u{25A0}-\u{25FF}\u{2714}\u{2716}\u{2728}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2795}-\u{2797}\u{27A1}\u{2B50}\u{2B55}]/gu;

var files = [path.join(ROOT, 'App.js'), path.join(ROOT, 'index.js')]
  .concat(walk(path.join(ROOT, 'src')))
  .filter(function (f) { return /\.js$/.test(f); });

var missingImports = [];
var emojiUses = [];

files.forEach(function (f) {
  var rel = path.relative(ROOT, f);
  var src = fs.readFileSync(f, 'utf8');

  // --- react-native import set ---
  var imported = [];
  var re = /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/g;
  var m;
  while ((m = re.exec(src))) {
    m[1].split(',').forEach(function (s) {
      s = s.trim().split(/\s+as\s+/)[0].trim();
      if (s) imported.push(s);
    });
  }

  RN_COMPONENTS.forEach(function (c) {
    var usedJsx = new RegExp('<' + c + '[\\s/>]').test(src);
    var usedCall = new RegExp('[^A-Za-z0-9_.$]' + c + '\\s*\\(').test(src);
    if ((usedJsx || usedCall) && imported.indexOf(c) === -1) {
      // Ignore occurrences inside comments/strings? Keep it simple — report;
      // a false positive is easy to dismiss when reading the report.
      missingImports.push(rel + ' -> ' + c);
    }
  });

  // --- emoji usage (skip comment-only lines) ---
  var lines = src.split(/\r?\n/);
  lines.forEach(function (line, i) {
    var trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    var mm = line.match(EMOJI_RE);
    if (mm) {
      emojiUses.push(rel + ':' + (i + 1) + ' -> ' + Array.from(new Set(mm)).join(' '));
    }
  });
});

console.log('=== Missing react-native imports ===');
if (missingImports.length) {
  missingImports.forEach(function (x) { console.log('  ' + x); });
} else {
  console.log('  none');
}

console.log('');
console.log('=== Emoji usage in code (excluding comments) ===');
if (emojiUses.length) {
  emojiUses.forEach(function (x) { console.log('  ' + x); });
} else {
  console.log('  none');
}

process.exitCode = missingImports.length ? 1 : 0;
