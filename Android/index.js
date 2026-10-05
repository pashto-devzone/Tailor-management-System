/**
 * Expo / Expo Go entry point for the Tailor Management System Android app.
 *
 * IMPORTANT (fixes: "Invariant Violation: 'main' has not been registered")
 * ---------------------------------------------------------------------
 * Expo Go loads the JS bundle produced by Metro and then calls
 * `AppRegistry.runApplication('main', ...)`. That requires the bundle to
 * register a root component under the key "main", which is exactly what
 * `registerRootComponent` does:
 *
 *     AppRegistry.registerComponent('main', () => App);
 *
 * Previously package.json pointed `"main"` straight at `App.js`. `App.js`
 * only *exports* a component and never registered one, so Expo Go failed with
 * the "main has not been registered" invariant at startup (the JS bundle
 * itself built fine, which is why Metro reported no error).
 *
 * `react-native-gesture-handler` must be imported before anything else on
 * Android (React Navigation requirement).
 */
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
