/**
 * Settings.
 *
 * Backend contract (unchanged from desktop):
 *   GET  /api/settings    -> shop + receipt settings for this store
 *   PUT  /api/settings    -> save (owner role, enforced by the backend)
 *   GET  /api/v1/api-keys -> { success, data: [keys] }
 *   POST /api/v1/api-keys -> { success, data: { id, apiKey, name, scopes } }
 *   PUT  /api/v1/api-keys/:id/revoke
 *
 * SECURITY: only the user's OWN generated Orders API key and the public v1
 * endpoint are ever displayed. No server secrets (DB credentials, Supabase keys,
 * JWT signing secrets) exist in this client.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../constants/theme';
import {
  SectionCard,
  InputField,
  PrimaryButton,
  LoadingView,
  ErrorState,
  ConfirmDialog,
} from '../components/UIComponents';
import {
  getSettings,
  saveSettings,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  getFriendlyError,
  API_BASE_URL,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { appInfo } from '../constants/appInfo';
import { copyToClipboard } from '../utils/clipboard';

const STORE_FIELDS = [
  { key: 'shopName', label: 'Shop Name', placeholder: 'Your shop name' },
  { key: 'ownerName', label: 'Owner Name', placeholder: 'Owner full name' },
  { key: 'phone', label: 'Phone', placeholder: '03xx-xxxxxxx', keyboard: 'phone-pad' },
  { key: 'address', label: 'Address', placeholder: 'Shop address', multiline: true },
  { key: 'currency', label: 'Currency', placeholder: 'PKR' },
  {
    key: 'whatsappNumber',
    label: 'WhatsApp Number',
    placeholder: '03xx-xxxxxxx',
    keyboard: 'phone-pad',
  },
  { key: 'receiptFooter', label: 'Receipt Footer', placeholder: 'Thank you message' },
  {
    key: 'customerSerialStart',
    label: 'Customer Serial Start',
    placeholder: 'e.g. 1',
    keyboard: 'number-pad',
  },
  {
    key: 'orderNumberStartingPoint',
    label: 'Order Number Start',
    placeholder: 'e.g. 5000',
    keyboard: 'number-pad',
  },
];

const ORDERS_API_ENDPOINT = `${API_BASE_URL}/api/v1/orders/{orderId}`;
const ORDERS_API_HEADER = 'X-API-Key';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const storeId = user?.store_id || user?.storeId || 'current';
  const apiKeyStorageKey = `tms_orders_api_key_${storeId}`;

  const [form, setForm] = useState(() =>
    Object.fromEntries(STORE_FIELDS.map((f) => [f.key, '']))
  );
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  const [keys, setKeys] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMessage, setApiKeyMessage] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const [confirmLogout, setConfirmLogout] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getSettings();
      const data = res.data && typeof res.data === 'object' ? res.data : {};
      setSettings(data);
      setForm(
        Object.fromEntries(
          STORE_FIELDS.map((f) => [f.key, data[f.key] != null ? String(data[f.key]) : ''])
        )
      );
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadApiKeys = useCallback(async () => {
    try {
      const res = await listApiKeys();
      const list = res.data?.data;
      setKeys(Array.isArray(list) ? list : []);
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    load();
    loadApiKeys();
    AsyncStorage.getItem(apiKeyStorageKey)
      .then((stored) => {
        if (stored) setApiKey(stored);
      })
      .catch(() => {});
  }, [load, loadApiKeys, apiKeyStorageKey]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    setSaveError('');
    try {
      const payload = { ...settings };
      STORE_FIELDS.forEach((f) => {
        payload[f.key] = form[f.key] != null ? String(form[f.key]).trim() : '';
      });
      await saveSettings(payload);
      setSaveMessage('Settings saved successfully.');
      load();
    } catch (err) {
      setSaveError(getFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value, label) => {
    setApiKeyError('');
    const ok = await copyToClipboard(value);
    if (ok) setApiKeyMessage(`${label} copied to clipboard.`);
    else setApiKeyError(`Could not copy ${label.toLowerCase()} on this device.`);
  };

  const generateKey = async () => {
    setGenerating(true);
    setApiKeyError('');
    setApiKeyMessage('');
    try {
      const res = await createApiKey('External Orders', ['orders:read', 'orders:write']);
      const key = res.data?.data?.apiKey;
      if (!key) throw new Error('The server did not return an API key.');
      await AsyncStorage.setItem(apiKeyStorageKey, key).catch(() => {});
      setApiKey(key);
      setApiKeyMessage('Orders API key generated. Copy it now — it is shown only once.');
      loadApiKeys();
    } catch (err) {
      setApiKeyError(getFriendlyError(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeApiKey(revokeTarget.id);
      setRevokeTarget(null);
      setApiKeyMessage('API key revoked.');
      loadApiKeys();
    } catch (err) {
      setApiKeyError(getFriendlyError(err));
      setRevokeTarget(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView message="Loading settings..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.flex}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <SectionCard title="Account Information">
          <View style={styles.accountRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {String(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{user?.name || 'Owner'}</Text>
              <Text style={styles.accountLine}>{user?.email || '-'}</Text>
              <Text style={styles.accountLine}>Role: {user?.role || 'owner'}</Text>
            </View>
          </View>
          <Text style={styles.note}>
            Your session is secured with a bearer token from the backend. The server
            remains the authority for which store data you can access.
          </Text>
        </SectionCard>

        {/* Store information */}
        <SectionCard title="Store Information">
          {STORE_FIELDS.map((field) => (
            <InputField
              key={field.key}
              label={field.label}
              value={form[field.key] ?? ''}
              onChangeText={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
              placeholder={field.placeholder}
              keyboardType={field.keyboard}
              multiline={field.multiline}
              disabled={saving}
            />
          ))}

          {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
          {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

          <PrimaryButton
            title="Save Settings"
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </SectionCard>

        {/* Orders API */}
        <SectionCard title="Orders API">
          <Text style={styles.label}>API Endpoint</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText} selectable>
              {ORDERS_API_ENDPOINT}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.copyBtn}
            activeOpacity={0.75}
            onPress={() => copy(ORDERS_API_ENDPOINT, 'Endpoint')}
          >
            <Text style={styles.copyBtnText}>Copy Endpoint</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Authentication Method</Text>
          <Text style={styles.note}>
            Custom API key sent in the {ORDERS_API_HEADER} request header. The key is
            scoped to your own store on the server — it can never read another store's
            orders. Scope: orders:read, orders:write.
          </Text>

          <Text style={styles.label}>Orders API Key</Text>
          {apiKey ? (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeText} selectable numberOfLines={2}>
                  {apiKey}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyBtn}
                activeOpacity={0.75}
                onPress={() => copy(apiKey, 'API key')}
              >
                <Text style={styles.copyBtnText}>Copy API Key</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.note}>
              No key stored on this device. Generate one below — it is displayed only
              once.
            </Text>
          )}

          <PrimaryButton
            title={apiKey ? 'Generate New API Key' : 'Generate Orders API Key'}
            onPress={generateKey}
            loading={generating}
            style={styles.saveBtn}
          />

          {apiKeyError ? <Text style={styles.errorText}>{apiKeyError}</Text> : null}
          {apiKeyMessage ? <Text style={styles.successText}>{apiKeyMessage}</Text> : null}

          <Text style={styles.label}>Active Keys ({keys.length})</Text>
          {keys.length === 0 ? (
            <Text style={styles.note}>No API keys registered for this store yet.</Text>
          ) : (
            keys.map((key) => (
              <View key={String(key.id)} style={styles.keyRow}>
                <View style={styles.keyInfo}>
                  <Text style={styles.keyName}>{key.name || 'API key'}</Text>
                  <Text style={styles.keyMeta}>
                    {key.isActive === false || key.revoked_at ? 'Revoked' : 'Active'}
                    {key.created_at ? ` · ${String(key.created_at).slice(0, 10)}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.revokeBtn}
                  activeOpacity={0.75}
                  onPress={() => setRevokeTarget(key)}
                >
                  <Text style={styles.revokeBtnText}>Revoke</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
          <Text style={styles.note}>
            Server secrets (database credentials, signing keys) are never exposed to this
            app.
          </Text>
</SectionCard>

        {/* App information */}
        <SectionCard title="App Information">
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Application</Text>
            <Text style={styles.infoValue}>{appInfo.applicationName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{appInfo.version}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>
              {Platform.OS} {String(Platform.Version)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Backend</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {API_BASE_URL}
            </Text>
          </View>
        </SectionCard>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => setConfirmLogout(true)}
          activeOpacity={0.8}
        >
          <View style={styles.logoutInner}>
            <MaterialCommunityIcons name="logout" size={20} color={theme.colors.error} />
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmDialog
        visible={confirmLogout}
        title="Log out?"
        message="You will need to sign in again to access your shop."
        confirmLabel="Log Out"
        destructive
        onConfirm={async () => {
          setConfirmLogout(false);
          await logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />

      <ConfirmDialog
        visible={!!revokeTarget}
        title="Revoke API key?"
        message={
          revokeTarget
            ? `"${revokeTarget.name || 'This key'}" will stop working immediately.`
            : ''
        }
        confirmLabel="Revoke"
        destructive
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  accountRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: theme.colors.primary },
  accountInfo: { flex: 1, marginLeft: theme.spacing.md },
  accountName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  accountLine: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: 6,
  },
  note: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  codeBox: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
  },
  codeText: { color: '#e2e8f0', fontSize: theme.fontSize.sm },
  copyBtn: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  copyBtnText: {
    color: theme.colors.accentDark,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  saveBtn: { marginTop: theme.spacing.md },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  keyInfo: { flex: 1 },
  keyName: { fontSize: theme.fontSize.sm, fontWeight: '700', color: theme.colors.text },
  keyMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  revokeBtn: {
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  revokeBtnText: { color: theme.colors.error, fontWeight: '700', fontSize: theme.fontSize.xs },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  infoValue: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'right',
    paddingLeft: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginTop: theme.spacing.sm,
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginTop: theme.spacing.sm,
  },
  logoutButton: {
    backgroundColor: theme.colors.errorBg,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  logoutInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: theme.fontSize.base,
    marginLeft: 8,
  },
});