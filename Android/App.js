/**
 * App root component.
 *
 * The actual Expo/Expo Go entry point is `index.js`, which calls
 * `registerRootComponent(App)` so that "main" is registered in AppRegistry.
 *
 * Navigation layout:
 *   RootStack
 *     Auth  -> AuthStack (Login, Register)
 *     Main  -> Tabs
 *   Tabs: Dashboard | Customers | Orders | Measurements | More
 *     Customers -> CustomersStack (list -> details)
 *     Orders    -> OrdersStack    (list -> details)
 *     More      -> MoreStack      (menu -> employees / employee details /
 *                                  finance / settings)
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CustomersScreen from './src/screens/CustomersScreen';
import CustomerDetailsScreen from './src/screens/CustomerDetailsScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import OrderDetailsScreen from './src/screens/OrderDetailsScreen';
import MeasurementsScreen from './src/screens/MeasurementsScreen';
import EmployeesScreen from './src/screens/EmployeesScreen';
import EmployeeDetailsScreen from './src/screens/EmployeeDetailsScreen';
import FinanceScreen from './src/screens/FinanceScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MoreScreen from './src/screens/MoreScreen';
import RecycleBinScreen from './src/screens/RecycleBinScreen';
import ConnectionScreen from './src/screens/ConnectionScreen';
import { useAuth, AuthProvider } from './src/context/AuthContext';
import { theme } from './src/constants/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const CustomersStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();
const MoreStack = createNativeStackNavigator();

/**
 * Header-only options.
 *
 * These are valid for BOTH @react-navigation/native-stack and
 * @react-navigation/bottom-tabs, so they are safe to spread into tab screens.
 */
const headerOptions = {
  headerStyle: { backgroundColor: theme.colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600', fontSize: 17 },
  headerShadowVisible: false,
};

/** Native-stack-only options. */
const stackScreenOptions = {
  headerStyle: { backgroundColor: theme.colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '600', fontSize: 17 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: theme.colors.background },
};

/**
 * Bottom-tab icon: MaterialCommunityIcons glyph inside a subtle pill.
 *
 * Inactive: gray icon, transparent pill.
 * Active:   blue icon, light-blue pill, very slightly larger — the selected
 *           tab is obvious without being oversized or colorful.
 */
const TabIcon = ({ icon, focused }) => (
  <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
    <MaterialCommunityIcons
      name={icon}
      size={focused ? 23 : 21}
      color={focused ? theme.colors.primary : theme.colors.textSecondary}
    />
  </View>
);

function CustomersTabScreen() {
  return (
    <CustomersStack.Navigator screenOptions={stackScreenOptions}>
      <CustomersStack.Screen
        name="CustomersList"
        component={CustomersScreen}
        options={{ title: 'Customers' }}
      />
      <CustomersStack.Screen
        name="CustomerDetails"
        component={CustomerDetailsScreen}
        options={({ route }) => ({
          title: route?.params?.customerName || 'Customer Details',
        })}
      />
    </CustomersStack.Navigator>
  );
}

function OrdersTabScreen() {
  return (
    <OrdersStack.Navigator screenOptions={stackScreenOptions}>
      <OrdersStack.Screen
        name="OrdersList"
        component={OrdersScreen}
        options={{ title: 'Orders' }}
      />
      <OrdersStack.Screen
        name="OrderDetails"
        component={OrderDetailsScreen}
        options={({ route }) => ({
          title: route?.params?.orderNumber
            ? `Order #${route.params.orderNumber}`
            : 'Order Details',
        })}
      />
    </OrdersStack.Navigator>
  );
}

function MoreTabScreen() {
  return (
    <MoreStack.Navigator screenOptions={stackScreenOptions}>
      <MoreStack.Screen name="MoreMenu" component={MoreScreen} options={{ title: 'More' }} />
      <MoreStack.Screen
        name="Employees"
        component={EmployeesScreen}
        options={{ title: 'Employees' }}
      />
      <MoreStack.Screen
        name="EmployeeDetails"
        component={EmployeeDetailsScreen}
        options={({ route }) => ({
          title: route?.params?.employeeName || 'Employee Details',
        })}
      />
      <MoreStack.Screen
        name="Finance"
        component={FinanceScreen}
        options={{ title: 'Income & Expenses' }}
      />
      <MoreStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <MoreStack.Screen
        name="RecycleBin"
        component={RecycleBinScreen}
        options={{ title: 'Recycle Bin' }}
      />
      {/* Reachable before AND after sign-in: the app's own network error
          messages point the user at "More ▸ Connection" to fix a wrong or
          DHCP-changed server address. */}
      <MoreStack.Screen
        name="Connection"
        component={ConnectionScreen}
        options={{ title: 'Connection' }}
      />
    </MoreStack.Navigator>
  );
}

function AuthenticatedApp() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
          // Subtle top shadow (kept very light so it stays flat/modern)
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Home',
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          tabBarIcon: ({ focused }) => <TabIcon icon="home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Customers"
        component={CustomersTabScreen}
        options={{
          title: 'Customers',
          tabBarIcon: ({ focused }) => <TabIcon icon="account-group" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersTabScreen}
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => <TabIcon icon="clipboard-text" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Measurements"
        component={MeasurementsScreen}
        options={{
          title: 'Measurements',
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          tabBarIcon: ({ focused }) => <TabIcon icon="ruler" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreTabScreen}
        options={{
          title: 'More',
          tabBarIcon: ({ focused }) => <TabIcon icon="cog" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      {/* Available before sign-in, because a wrong server address is the most
          common reason the login request cannot even be sent. */}
      <AuthStack.Screen
        name="Connection"
        component={ConnectionScreen}
        options={{
          title: 'Connection',
          headerShown: true,
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          headerBackTitle: 'Back',
        }}
      />
    </AuthStack.Navigator>
  );
}

function RootNavigator() {
  const { loading, user } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={AuthenticatedApp} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tabIconWrapActive: {
    backgroundColor: theme.colors.primaryLight,
  },
});