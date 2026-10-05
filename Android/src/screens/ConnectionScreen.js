/**
 * Server address editor + connection diagnostics.
 *
 * WHY THIS SCREEN EXISTS
 * The backend runs on the shop PC, whose address is handed out by DHCP and
 * changes without warning. serverConfig.js hides that by probing candidates and
 * switching silently, but the moment every candidate fails the user has exactly
 * one useful action: correct the address. That action needs a screen — so this
 * is it, reachable from the login screen (before signing in) and from
 * More ▸ Connection (afterwards).
 *
 * It deliberately reports what was actually tried and why it failed, instead of
 * the bare "Network error" the raw transport exception used to produce.
 *
 * SECURITY: only a base URL is entered and stored. No token, password or
 * server-side secret is ever typed here or read back out.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import {
  ScreenContainer,
  Card,
  InputField,
  PrimaryButton,
  SecondaryButton,
  Banner,
  CardSectionTitle,
} from '../components/UIComponents';
import {
  useServerConnection,
  getServerUrl,
  setManualServerUrl,
  clearManualServerUrl,
  retryServer,
} from '../services/serverConfig';

const STATUS = {
  idle: { label: 'Not checked yet', icon: 'help-circle-outline', color: theme.colors.textSecondary },
  checking: { label: 'Checking…', icon: 'sync', color: theme.colors.info },
  online: { label: 'Connected', icon: 'check-circle', color: theme.colors.success },
  offline: { label: 'Cannot reach the server', icon: 'close-circle', color: theme.colors.error },
};

const timeOf = (ts) =>
  ts
    ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

export default function ConnectionScreen({ navigation }) {
  const connection = useServerConnection();
  const [address, setAddress] = useState(getServerUrl());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone, text }

  const status = STATUS[connection.status] || STATUS.idle;
  const liveUrl = connection.url || getServerUrl();

  const connect = useCallback(
    async (force) => {
      setBusy(true);
      setMessage(null);
      const result = await setManualServerUrl(address, { force });
      setBusy(false);
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error });
        return;
      }
      setAddress(result.url);
      setMessage(
        result.connected
          ? { tone: 'success', text: `Connected to ${result.url} (${result.detail})` }
          : {
              tone: 'warning',
              text: `Saved ${result.url}, but it is not answering yet (${result.detail}). It will be retried automatically.`,
            }
      );
    },
    [address]
  );

  const retry = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const result = await retryServer();
    setBusy(false);
    setMessage(
      result.status === 'online'
        ? { tone: 'success', text: `Connected to ${result.url} (${result.source})` }
        : { tone: 'error', text: 'Still no answer. Check the steps below, then try again.' }
    );
  }, []);

  const reset = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const result = await clearManualServerUrl();
    setBusy(false);
    setAddress(result.url || getServerUrl());
    setMessage(
      result.status === 'online'
        ? { tone: 'success', text: `Saved address cleared. Now using ${result.url}.` }
        : { tone: 'warning', text: 'Saved address cleared, but nothing is answering yet.' }
    );
  }, []);

  return (
    <ScreenContainer>
      <Card style={styles.statusCard}>
        <MaterialCommunityIcons
          name={status.icon}
          size={26}
          color={status.color}
          style={styles.statusIcon}
        />
        <View style={styles.statusText}>
          <Text style={styles.statusLabel}>{status.label}</Text>
          <Text style={styles.statusUrl} selectable>
            {liveUrl}
          </Text>
          <Text style={styles.statusSource}>
            {connection.source ? `Using: ${connection.source}` : 'Address not confirmed yet'}
            {connection.checkedAt ? ` · checked ${timeOf(connection.checkedAt)}` : ''}
          </Text>
        </View>
      </Card>

      {message ? (
        <Banner message={message.text} tone={message.tone} onDismiss={() => setMessage(null)} />
      ) : null}

      <Card>
        <CardSectionTitle>Server address</CardSectionTitle>
        <InputField
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="192.168.1.20:5000"
          keyboardType="url"
          autoCapitalize="none"
          editable={!busy}
          hint="The PC's IP and the backend port. http:// is added automatically."
        />
        <PrimaryButton title="Connect" onPress={() => connect(false)} disabled={busy} loading={busy} />
        <SecondaryButton
          title="Save even if it does not answer"
          onPress={() => connect(true)}
          disabled={busy}
          style={styles.secondaryButton}
        />
        <View style={styles.buttonRow}>
          <SecondaryButton
            title="Retry now"
            onPress={retry}
            disabled={busy}
            style={styles.rowButton}
          />
          <SecondaryButton
            title="Reset to default"
            onPress={reset}
            disabled={busy || !connection.manualUrl}
            style={[styles.rowButton, styles.rowButtonLast]}
          />
        </View>
      </Card>

      {connection.attempts?.length ? (
        <Card>
          <CardSectionTitle>What was tried</CardSectionTitle>
          {connection.attempts.map((attempt) => (
            <View key={attempt.url} style={styles.attemptRow}>
              <MaterialCommunityIcons
                name={attempt.ok ? 'check-circle' : 'close-circle'}
                size={18}
                color={attempt.ok ? theme.colors.success : theme.colors.textTertiary}
              />
              <View style={styles.attemptBody}>
                <Text style={styles.attemptUrl} selectable>
                  {attempt.url}
                </Text>
                <Text style={styles.attemptDetail}>
                  {attempt.source ? `${attempt.source} — ` : ''}
                  {attempt.detail}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <CardSectionTitle>If it still does not connect</CardSectionTitle>
        {[
          'Start the backend on the PC: cd Backend, then npm start',
          'Find the PC address on the same network: cd Backend, then npm run lan',
          'Allow the port through Windows Firewall (PowerShell as Administrator): npm run firewall',
          'Over USB with no Wi-Fi: adb reverse tcp:5000 tcp:5000, then use localhost:5000',
          'The phone and the PC must be on the same Wi-Fi network',
        ].map((step) => (
          <View key={step} style={styles.stepRow}>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.accent} />
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        {navigation?.canGoBack?.() ? (
          <PrimaryButton
            title="Back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          />
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statusCard: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  statusIcon: { marginRight: theme.spacing.md },
  statusText: { flex: 1 },
  statusLabel: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.textHeading },
  statusUrl: { fontSize: theme.fontSize.sm, color: theme.colors.primary, marginTop: 2 },
  statusSource: { fontSize: theme.fontSize.xs, color: theme.colors.textTertiary, marginTop: 2 },
  secondaryButton: { marginTop: theme.spacing.sm },
  buttonRow: { flexDirection: 'row', marginTop: theme.spacing.sm },
  rowButton: { flex: 1, marginRight: theme.spacing.sm },
  rowButtonLast: { marginRight: 0 },
  attemptRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: theme.spacing.sm },
  attemptBody: { flex: 1, marginLeft: theme.spacing.sm },
  attemptUrl: { fontSize: theme.fontSize.sm, color: theme.colors.text, fontWeight: '600' },
  attemptDetail: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: theme.spacing.xs },
  stepText: {
    flex: 1,
    marginLeft: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  backButton: { marginTop: theme.spacing.md },
});
