/**
 * Customers list.
 *
 * Backend contract (unchanged from desktop):
 *   GET    /api/customers        -> array of customers
 *   POST   /api/customers        -> { message, customer }
 *   PUT    /api/customers/:id    -> { message, customer }
 *   DELETE /api/customers/:id    -> { message }   (soft delete + recycle bin)
 *
 * Search is done client-side because the backend /customers route has no query
 * parameter (the desktop app filters in memory too).
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import {
  SearchBar,
  LoadingView,
  EmptyState,
  ErrorState,
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  InputField,
} from '../components/UIComponents';
import {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getFriendlyError,
} from '../services/api';

const EMPTY_FORM = { name: '', phone: '', address: '', serial_number: '' };

export default function CustomersScreen({ navigation }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await getCustomers();
      setCustomers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.phone || '').toLowerCase().includes(q) ||
      String(c.address || '').toLowerCase().includes(q) ||
      String(c.serial_number || '').toLowerCase().includes(q)
    );
  });

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      serial_number:
        customer.serial_number != null ? String(customer.serial_number) : '',
    });
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setFormError('Name, phone and address are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        serial_number: form.serial_number.trim() || null,
      };
      if (editing) {
        await updateCustomer(editing.id, payload);
      } else {
        await addCustomer(payload);
      }
      setModalVisible(false);
      load(true);
    } catch (err) {
      setFormError(getFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomer(deleteTarget.id);
      setDeleteTarget(null);
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderCustomer = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() =>
        navigation.navigate('CustomerDetails', {
          customerId: item.id,
          customerName: item.name,
        })
      }
    >
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {String(item.name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {item.phone || '-'}
          </Text>
        </View>
        {item.serial_number != null && item.serial_number !== '' ? (
          <View style={styles.serialBadge}>
            <Text style={styles.serialText}>#{item.serial_number}</Text>
          </View>
        ) : null}
      </View>
      {item.address ? (
        <Text style={styles.cardAddress} numberOfLines={2}>
          {item.address}
        </Text>
      ) : null}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => openEdit(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionEdit}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setDeleteTarget(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionDelete}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, serial..."
        />
        <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.countLine}>
        {loading
          ? 'Loading customers...'
          : `${filtered.length} of ${customers.length} customer${customers.length === 1 ? '' : 's'}`}
      </Text>

      {loading ? (
        <LoadingView message="Loading customers..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="account-group"
          title={search ? 'No matching customers' : 'No customers yet'}
          message={
            search
              ? 'Try a different name, phone or serial number.'
              : 'Add your first customer to get started.'
          }
          actionLabel={search ? undefined : 'Add Customer'}
          onAction={search ? undefined : openAdd}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCustomer}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.accent]}
              tintColor={theme.colors.accent}
            />
          }
        />
      )}

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit Customer' : 'New Customer'}
            </Text>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <InputField
              label="Name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              placeholder="Customer name"
              disabled={saving}
            />
            <InputField
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              placeholder="Phone number"
              keyboardType="phone-pad"
              disabled={saving}
            />
            <InputField
              label="Address"
              value={form.address}
              onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
              placeholder="Address"
              multiline
              disabled={saving}
            />
            <InputField
              label="Serial Number"
              value={form.serial_number}
              onChangeText={(v) => setForm((f) => ({ ...f, serial_number: v }))}
              placeholder="Optional"
              keyboardType="number-pad"
              disabled={saving}
              hint="Leave empty to let the server assign the next serial number."
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setModalVisible(false)}
                disabled={saving}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title={editing ? 'Update' : 'Add Customer'}
                onPress={handleSave}
                loading={saving}
                style={styles.modalBtnPrimary}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete customer?"
        message={
          deleteTarget ? `"${deleteTarget.name}" will be moved to the recycle bin.` : ''
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  addButton: {
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: { color: '#fff', fontSize: 26, fontWeight: '700', marginTop: -2 },
  countLine: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  list: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.elevation.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: theme.colors.primary },
  cardInfo: { flex: 1, marginLeft: theme.spacing.sm },
  cardName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  cardMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  serialBadge: {
    backgroundColor: theme.colors.cardAlt,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serialText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  cardAddress: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
  },
  actionBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: 6 },
  actionEdit: { color: theme.colors.accent, fontWeight: '700', fontSize: theme.fontSize.sm },
  actionDelete: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.elevation.lg,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  formError: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.sm,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  modalBtn: { paddingHorizontal: theme.spacing.lg, marginRight: theme.spacing.sm },
  modalBtnPrimary: { paddingHorizontal: theme.spacing.lg },
});