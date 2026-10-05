import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { theme } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { useServerConnection } from '../services/serverConfig';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const connection = useServerConnection();

  const { login } = useAuth();

  const validate = useCallback(() => {
    if (!email.trim()) return 'Email is required.';
    if (!password) return 'Password is required.';
    return null;
  }, [email, password]);

  const handleLogin = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(
        err?.friendlyMessage ||
          err?.response?.data?.message ||
          'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, login, validate]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.logoBadge, theme.elevation.md]}>
            <MaterialCommunityIcons name="content-cut" size={34} color="#ffffff" />
          </View>
          <Text style={styles.appName}>Tailor Management System</Text>
          <Text style={styles.tagline}>Sign in to continue</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email / Username</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor={theme.colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.textTertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              activeOpacity={0.7}
              disabled={loading}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={[styles.checkbox, rememberMe && styles.checkboxChecked]}
              onPress={() => setRememberMe((v) => !v)}
              activeOpacity={0.7}
              disabled={loading}
            >
              {rememberMe ? (
                <MaterialCommunityIcons name="check" size={14} color="#ffffff" />
              ) : null}
            </TouchableOpacity>
            <Text style={styles.checkboxLabel}>Remember me</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (loading || password.length === 0) && styles.primaryButtonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading || password.length === 0}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.75}
          >
            <Text style={styles.linkText}>Don't have an account? </Text>
            <Text style={styles.linkTextBold}>Register</Text>
          </TouchableOpacity>

          {/* A wrong server address is the most common reason Sign In cannot
              even send a request, so the fix must be reachable from here. */}
          <TouchableOpacity
            style={styles.serverRow}
            onPress={() => navigation.navigate('Connection')}
            activeOpacity={0.75}
            disabled={loading}
          >
            <MaterialCommunityIcons
              name={connection.status === 'online' ? 'server-network' : 'server-network-off'}
              size={16}
              color={connection.status === 'online' ? theme.colors.success : theme.colors.textTertiary}
            />
            <Text style={styles.serverText}>
              {connection.status === 'online' ? connection.url : 'Having trouble connecting?'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  logoBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  appName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 4,
    textAlign: 'center',
  },
  tagline: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  form: { width: '100%' },
  errorBanner: {
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: { flex: 1 },
  eyeButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
  },
  eyeText: { fontSize: 18 },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: -2 },
  checkboxLabel: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: '700',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  linkText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  linkTextBold: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '700',
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  serverText: {
    marginLeft: 6,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
  },
});

