// One-off glyph availability check (dev utility).
const fs = require('fs');
const path = require('path');
const dir = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'glyphmaps'
);
const ion = JSON.parse(fs.readFileSync(path.join(dir, 'Ionicons.json'), 'utf8'));
const mci = JSON.parse(fs.readFileSync(path.join(dir, 'MaterialCommunityIcons.json'), 'utf8'));

const ionWant = [
  'home', 'home-outline', 'people', 'people-outline', 'clipboard', 'clipboard-outline',
  'ruler', 'settings', 'settings-outline', 'log-out', 'log-out-outline',
  'search', 'close', 'close-circle', 'eye', 'eye-off', 'eye-outline', 'eye-off-outline',
  'alert-circle', 'alert-circle-outline', 'person', 'person-outline',
  'wallet', 'wallet-outline', 'cash', 'card', 'card-outline',
  'trending-up', 'trending-down', 'trash', 'trash-outline',
  'add', 'add-circle', 'chevron-forward', 'create', 'create-outline',
  'document-text', 'document-text-outline', 'bar-chart', 'bar-chart-outline',
  'briefcase', 'briefcase-outline', 'albums', 'albums-outline',
  'pricetag', 'pricetag-outline', 'information-circle', 'information-circle-outline',
  'checkmark-circle', 'checkmark', 'close-circle-outline',
  'calculator', 'calculator-outline', 'shirt', 'cut', 'scissors',
  'file-tray-full', 'help-circle', 'calendar', 'call', 'mail',
];
const mciWant = [
  // navigation / brand
  'home', 'account-group', 'clipboard-text', 'ruler', 'cog', 'content-cut',
  // generic
  'magnify', 'close', 'check', 'chevron-down', 'chevron-right', 'plus',
  'plus-circle', 'reload', 'filter', 'information-outline', 'inbox',
  // auth
  'eye', 'eye-off', 'account-plus', 'logout',
  // dashboard / stats
  'clock-outline', 'check-circle-outline', 'package-variant', 'wallet',
  'cash-multiple', 'trending-up', 'trending-down', 'chart-line',
  'clipboard-check', 'check-all', 'package-check', 'truck-check',
  'account-check', 'cash-check', 'file-check',
  // lists / empty states
  'trash-can', 'account-tie', 'hard-hat', 'briefcase', 'file-document',
  // detail / actions
  'phone', 'email', 'calendar', 'pencil', 'delete', 'restore',
  'alert-circle', 'clipboard', 'account', 'cash',
];

console.log('--- Ionicons ---');
ionWant.forEach((n) => console.log((n in ion ? 'YES ' : 'NO  ') + n));
console.log('--- MaterialCommunityIcons ---');
mciWant.forEach((n) => console.log((n in mci ? 'YES ' : 'NO  ') + n));
