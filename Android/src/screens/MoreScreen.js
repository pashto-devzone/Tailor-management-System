import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Card, ScreenContainer } from '../components/UIComponents';
import { useAuth } from '../context/AuthContext';
import { appInfo } from '../constants/appInfo';
import { useServerConnection, getServerUrl } from '../services/serverConfig';

const MENU = [
  {
    key: 'Connection',
    title: 'Connection',
    subtitle: 'Server address, connectivity check and diagnostics',
    icon: 'lan',
  },
  {
    key: 'Employees',
    title: 'Employees',
    subtitle: 'Staff records, salary status and payments',
    icon: 'account-group',
  },
  {
    key: 'Finance',
    title: 'Income & Expenses',
    subtitle: 'Income, expenses, salaries and net summary',
    icon: 'wallet',
  },
  {
    key: 'Settings',
    title: 'Settings',
    subtitle: 'Store profile, Orders API and app information',
    icon: 'cog',
  },
  {
    key: 'RecycleBin',
    title: 'Recycle Bin',
    subtitle: 'Restore deleted customers, orders, measurements',
    icon: 'trash-can',
  },
];

export default function MoreScreen({ navigation }) {
  const { user } = useAuth();
  // The live connection state, not the import-time snapshot: the server address
  // is resolved (and can silently change) while the app is running.
  const connection = useServerConnection();
  if (!user) return null;

  return (
    <ScreenContainer>
      <Card style={styles.accountCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {String(user?.name || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName}>{user?.name || 'Owner'}</Text>
          <Text style={styles.accountEmail}>{user?.email || '-'}</Text>
          <Text style={styles.accountRole}>Role: {user?.role || 'owner'}</Text>
        </View>
      </Card>

      {MENU.map((item) => (
        <TouchableOpacity
          key={item.key}
          activeOpacity={0.7}
          onPress={() => navigation.navigate(item.key)}
        >
          <Card style={styles.menuCard}>
            <View style={styles.menuIconWrap}>
              <MaterialCommunityIcons name={item.icon} size={20} color={theme.colors.primary} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.menuTitle}>{item.title}</Text>
              <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={theme.colors.textTertiary}
            />
          </Card>
        </TouchableOpacity>
      ))}

      <Card style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>{appInfo.applicationName}</Text>
        <Text style={styles.aboutLine}>Version {appInfo.version}</Text>
        <Text style={styles.aboutLine}>Server: {connection.url || getServerUrl()}</Text>
        <Text style={styles.aboutLine}>
          Status:{' '}
          {connection.status === 'online'
            ? 'connected'
            : connection.status === 'checking'
              ? 'checking…'
              : 'not connected — open Connection to fix'}
        </Text>
        <Text style={styles.aboutLine}>
          Signed in as {user?.name || 'Owner'}
          {user?.role ? ` (${user.role})` : ''}
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    color: theme.colors.textInverse,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  accountInfo: { flex: 1 },
  accountName: {
    fontSize: theme.fontSize.base,
    fontWeight: '700',
    color: theme.colors.text,
  },
  accountEmail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  accountRole: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  menuIconWrap: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  menuText: { flex: 1 },
  menuTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.textHeading,
  },
  menuSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: theme.colors.textTertiary,
    marginLeft: theme.spacing.sm,
  },
  aboutCard: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  aboutLine: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
});
