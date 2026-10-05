/**
 * Runtime sanity checks for the pure URL helpers in the API layer.
 *
 * These are the functions that decide WHICH server the phone talks to, so a
 * silent regression here means "works on my machine" for everyone else. They
 * are extracted from the source and evaluated because neither module can be
 * imported outside React Native (axios + AsyncStorage + expo-constants).
 *
 * Usage: node scripts/test-url-logic.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Pull `const NAME = <expr>;` out of a source file and return it as a function. */
function extract(file, name) {
  const src = read(file);
  const re = new RegExp(`const ${name} =([\\s\\S]*?);\\r?\\n`);
  const m = re.exec(src);
  if (!m) throw new Error(`could not find "const ${name} =" in ${file}`);
  // eslint-disable-next-line no-new-func
  return new Function('getServerUrl', `return (${m[1].trim()});`)(() => 'http://fallback:5000');
}

let failed = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label} -> ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
};

const serverRootOf = extract('src/services/api.js', 'serverRootOf');
console.log('serverRootOf (must strip the interceptor\'s /api and /api/v1 suffixes):');
check('.../api', serverRootOf('http://192.168.1.5:5000/api'), 'http://192.168.1.5:5000');
check('.../api/v1', serverRootOf('http://192.168.1.5:5000/api/v1'), 'http://192.168.1.5:5000');
check('.../api/ (trailing)', serverRootOf('http://192.168.1.5:5000/api/'), 'http://192.168.1.5:5000');
check('already a root', serverRootOf('http://192.168.1.5:5000'), 'http://192.168.1.5:5000');
check('https origin', serverRootOf('https://api.example.com/api/v1'), 'https://api.example.com');
check('empty falls back', serverRootOf(''), 'http://fallback:5000');
// The failover comparator in serverConfig matches against bare origins, so a
// suffixed value surviving here would mean the DHCP switch never fires.
check('never returns a suffixed root', /\/api(\/v1)?$/.test(serverRootOf('http://h:1/api')), false);

console.log('');
console.log(failed ? `${failed} check(s) FAILED` : 'All URL logic checks passed');
process.exitCode = failed ? 1 : 0;
