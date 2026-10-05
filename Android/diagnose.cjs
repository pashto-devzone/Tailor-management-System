const fs = require('fs');
const path = require('path');

const base = __dirname;

// Check what files exist
console.log('=== FILE EXISTENCE CHECK ===\n');
const files = [
  'App.js',
  'src/components/UIComponents.js',
  'src/screens/MoreScreen.js',
  'src/screens/DashboardScreen.js',
  'src/screens/CustomersScreen.js',
  'src/screens/OrdersScreen.js',
  'src/screens/MeasurementsScreen.js',
  'src/screens/EmployeesScreen.js',
  'src/screens/FinanceScreen.js',
  'src/screens/SettingsScreen.js',
  'src/screens/RecycleBinScreen.js',
  'src/screens/LoginScreen.js',
  'src/screens/RegisterScreen.js',
  'src/screens/CustomerDetailsScreen.js',
  'src/screens/OrderDetailsScreen.js',
  'src/screens/EmployeeDetailsScreen.js',
  'src/screens/SplashScreen.js',
  'src/context/AuthContext.js',
  'src/services/api.js',
  'src/utils/exporter.js',
  'src/utils/measurementUtils.js',
  'src/utils/clipboard.js',
  'src/utils/currency.js',
  'src/utils/date.js',
  'src/utils/validation.js',
];

files.forEach(f => {
  const p = path.join(base, f);
  const exists = fs.existsSync(p);
  const size = exists ? fs.statSync(p).size : 0;
  console.log((exists ? '✓' : '✗ MISSING') + ' ' + f + ' (' + size + ' bytes)');
});

// Check what UIComponents exports
console.log('\n=== UICOMPONENTS EXPORTS ===\n');
const uiPath = path.join(base, 'src', 'components', 'UIComponents.js');
if (fs.existsSync(uiPath)) {
  const ui = fs.readFileSync(uiPath, 'utf8');
  const exportMatches = ui.match(/export\s+(const|function|default|var|let)\s+(\w+)/g) || [];
  exportMatches.forEach(e => console.log('  ' + e));
  
  // Check for ScreenContainer and Card specifically
  console.log('\n  ScreenContainer exported:', /export\s+(const|function)\s+ScreenContainer/.test(ui) ? 'YES' : 'NO');
  console.log('  Card exported:', /export\s+(const|function)\s+Card/.test(ui) ? 'YES' : 'NO');
  
  // Find all exported names
  const allExports = ui.match(/export\s+(?:const|function|default|var|let)\s+(\w+)/g) || [];
  console.log('\n  All exported identifiers:');
  allExports.forEach(e => console.log('    ' + e.replace('export ', '').replace('default ', '')));
} else {
  console.log('  UIComponents.js NOT FOUND');
}

// Check assets
console.log('\n=== ASSETS ===\n');
const assetDir = path.join(base, 'assets');
if (fs.existsSync(assetDir)) {
  fs.readdirSync(assetDir).forEach(f => {
    const stats = fs.statSync(path.join(assetDir, f));
    console.log('  ' + f + ' (' + stats.size + ' bytes)');
  });
} else {
  console.log('  assets/ directory NOT FOUND');
}

// Check app.json configuration
console.log('\n=== APP.JSON ===\n');
const appJsonPath = path.join(base, 'app.json');
if (fs.existsSync(appJsonPath)) {
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  console.log('  name:', appJson.expo.name);
  console.log('  version:', appJson.expo.version);
  console.log('  icon:', appJson.expo.icon);
  console.log('  splash.image:', appJson.expo.splash.image);
  console.log('  android.package:', appJson.expo.android.package);
  console.log('  android.versionCode:', appJson.expo.android.versionCode);
  console.log('  android.adaptiveIcon:', appJson.expo.android.adaptiveIcon ? 'CONFIGURED' : 'NOT SET');
  console.log('  updates.enabled:', appJson.expo.updates.enabled);
  console.log('  updates.updateUrl:', appJson.expo.updates.updateUrl);
} else {
  console.log('  app.json NOT FOUND');
}

// Check package.json
console.log('\n=== PACKAGE.JSON ===\n');
const pkgPath = path.join(base, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  console.log('  name:', pkg.name);
  console.log('  version:', pkg.version);
  console.log('  main:', pkg.main);
  console.log('  dependencies:', Object.keys(pkg.dependencies).join(', '));
} else {
  console.log('  package.json NOT FOUND');
}

// Check eas.json
console.log('\n=== EAS.JSON ===\n');
const easPath = path.join(base, 'eas.json');
if (fs.existsSync(easPath)) {
  const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));
  console.log('  build profiles:', Object.keys(eas.build || {}).join(', '));
} else {
  console.log('  eas.json NOT FOUND');
}

// Check .env.example
console.log('\n=== ENV EXAMPLE ===\n');
const envPath = path.join(base, '.env.example');
if (fs.existsSync(envPath)) {
  console.log(fs.readFileSync(envPath, 'utf8').trim());
} else {
  console.log('  .env.example NOT FOUND');
}
