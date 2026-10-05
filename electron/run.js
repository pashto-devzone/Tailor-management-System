delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const path = require('path');

const electronCli = path.join(__dirname, '..', 'node_modules', 'electron', 'cli.js');
const child = spawn(process.execPath, [electronCli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
  windowsHide: false,
});

child.on('close', (code) => process.exit(code));
