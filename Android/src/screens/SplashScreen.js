import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { appInfo } from '../constants/appInfo';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoBadge}>
          <MaterialCommunityIcons name="content-cut" size={40} color="#ffffff" />
        </View>
        <Text style={styles.title}>{appInfo.applicationName}</Text>
        <Text style={styles.subtitle}>Tailor Management System</Text>
        <Text style={styles.version}>Version {appInfo.version}</Text>
        <ActivityIndicator
          style={styles.loader}
          size="small"
          color={'#ffffff'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
    textAlign: 'center',
  },
  version: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 32,
  },
  loader: {
    marginTop: 8,
  },
});
