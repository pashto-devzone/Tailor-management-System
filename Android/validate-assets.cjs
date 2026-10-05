/**
 * Validates that every asset referenced by app.json exists and is a real PNG.
 * Run: node validate-assets.cjs
 */

const fs = require('fs');
const path = require('path');

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));
const expo = appJson.expo;

const refs = [expo.icon, expo.splash && expo.splash.image, expo.ios && expo.ios.icon, expo.ios && expo.ios.splash && expo.ios.splash.image, expo.android && expo.android.splash && expo.android.splash.image, expo.android && expo.android.adaptiveIcon && expo.android.adaptiveIcon.foregroundImage, expo.android && expo.android.adaptiveIcon && expo.android.adaptiveIcon.backgroundImage].filter(Boolean);

let failed = 0;
const seen = new Set();
for (const ref of refs) {
  if (seen.has(ref)) continue;
  seen.add(ref);
  const abs = path.join(__dirname, ref);
  if (!fs.existsSync(abs)) {
    console.log('MISSING  ' + ref);
    failed++;
    continue;
  }
  const head = Buffer.alloc(8);
  const fd = fs.openSync(abs, 'r');
  fs.readSync(fd, head, 0, 8, 0);
  fs.closeSync(fd);
  if (!head.equals(PNG_SIG)) {
    console.log('NOT-PNG  ' + ref);
    failed++;
  } else {
    console.log('OK       ' + ref + ' (' + fs.statSync(abs).size + ' bytes)');
  }
}

if (failed) {
  console.log('\n' + failed + ' asset problem(s). Run: node scripts/generate-assets.cjs');
  process.exit(1);
}
console.log('\nAll ' + seen.size + ' referenced assets are valid PNGs.');
