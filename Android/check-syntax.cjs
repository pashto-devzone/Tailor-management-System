var fs = require('fs');
var parser = require('@babel/parser');
var files = ['App.js', 'index.js', 'src/screens/MoreScreen.js', 'src/components/UIComponents.js'];

files.forEach(function(f) {
  try {
    var s = fs.readFileSync(f, 'utf8');
    // @babel/parser understands JSX + modern syntax — acorn without jsx gave false errors.
    parser.parse(s, { sourceType: 'module', plugins: ['jsx'] });
    console.log(f + ': SYNTAX OK');
  } catch (e) {
    console.log(f + ': ERROR - ' + e.message);
  }
});

// Also check UIComponents has styles defined
try {
  var ui = fs.readFileSync('src/components/UIComponents.js', 'utf8');
  var hasStyles = /const styles\s*=\s*StyleSheet\.create/.test(ui);
  console.log('\nUIComponents has styles StyleSheet:', hasStyles ? 'YES' : 'NO');
  
  // Check App.js doesn't have the old contentStyle issue in tab screens
  var app = fs.readFileSync('App.js', 'utf8');
  var hasContentStyleInTabs = /Tab\.Screen[^}]*contentStyle/.test(app);
  console.log('App.js has contentStyle in Tab.Screen:', hasContentStyleInTabs ? 'YES (BUG!)' : 'NO (OK)');
  
  // Check MoreScreen imports
  var more = fs.readFileSync('src/screens/MoreScreen.js', 'utf8');
  console.log('MoreScreen imports Card:', /Card/.test(more) ? 'YES' : 'NO');
  console.log('MoreScreen imports ScreenContainer:', /ScreenContainer/.test(more) ? 'YES' : 'NO');
} catch (e) {
  console.log('Check error: ' + e.message);
}
