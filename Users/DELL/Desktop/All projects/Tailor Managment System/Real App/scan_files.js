const fs = require('fs');
const path = require('path');

function checkFile(p) {
  const data = fs.readFileSync(p);
  let utf8Ok = true;
  try { data.toString('utf8'); } catch (e) { utf8Ok = false; }
  return { utf8Ok, bytes: data.length };
}

function scan(root) {
  const results = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...scan(full));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.js','.jsx','.css','.sql','.json','.md','.yaml','.yml','.html','.svg'].includes(ext)) {
        try { results.push([full, checkFile(full)]); } catch (e) {}
      }
    }
  }
  return results;
}

const root = process.argv[2] || '.';
for (const [p, r] of scan(root)) {
  console.log(p + ' | utf8_ok=' + r.utf8Ok + ' | bytes=' + r.bytes);
}
