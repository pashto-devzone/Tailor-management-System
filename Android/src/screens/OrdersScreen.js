/**
 * Orders list.
 *
 * Backend contract (unchanged from desktop):
 *   GET    /api/orders?q=            -> array (server-side search on name/phone/order no)
 *   POST   /api/orders               -> { message, order }
 *   DELETE /api/orders/:id           -> { message }  (soft delete + recycle bin)
 *
 * Status filtering is client-side because the legacy /orders route has no
 * status query parameter (the desktop app filters in memory too).
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import {
  SearchBar,
  SegmentedTabs,
  LoadingView,
  EmptyState,
  ErrorState,
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  InputField,
  OptionGroup,
} from '../components/UIComponents';
import {
  getOrders,
  getCustomers,
  addOrder,
  deleteOrder,
  getFriendlyError,
} from '../services/api';
import { ORDER_STATUS_CONFIG, ORDER_STATUSES, DRESS_TYPES } from '../constants/orderStatus';
import { formatDate, toInputDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: ORDER_STATUSES.PENDING, label: 'Pending' },
  { key: ORDER_STATUSES.READY, label: 'Ready' },
  { key: ORDER_STATUSES.DELIVERED, label: 'Delivered' },
];

const emptyForm = () => ({
  customer_id: '',
  dress_type: '',
  price: '',
  advance: '',
  delivery_date: toInputDate(new Date()),
});

export default function OrdersScreen({ navigation, route }) {
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [customerQuery, setCustomerQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (q, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await getOrders(q);
      setOrders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadCustomers = useCallback(() => {
    getCustomers()
      .then((res) => setCustomers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    loadCustomers();
    load(undefined);
  }, [load, loadCustomers]);

  // Debounced server-side search (same `q` contract as the desktop app).
  useEffect(() => {
    const timer = setTimeout(() => {
      load(search.trim() || undefined, true);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Deep-link from Customer details / Dashboard: open the create modal.
  // - With customerId (Customer details): preselect that customer.
  // - Without customerId (Dashboard "New Order"): open a blank form.
  //   Requiring both made the Dashboard button a silent no-op.
  useEffect(() => {
    const params = route?.params;
    if (!params?.openNew) return;
    setForm(
      params.customerId
        ? { ...emptyForm(), customer_id: String(params.customerId) }
        : emptyForm()
    );
    setCustomerQuery('');
    setFormError('');
    setModalVisible(true);
    navigation.setParams({ openNew: undefined });
  }, [route?.params, navigation]);

  const filtered = useMemo(
    () =>
      statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter),
    [orders, statusFilter]
  );

  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((o) => o.status === ORDER_STATUSES.PENDING).length,
      ready: orders.filter((o) => o.status === ORDER_STATUSES.READY).length,
      delivered: orders.filter((o) => o.status === ORDER_STATUSES.DELIVERED).length,
    }),
    [orders]
  );

  const openAdd = () => {
    setForm(emptyForm());
    setCustomerQuery('');
    setFormError('');
    setModalVisible(true);
  };

  const customerOptions = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.phone || '').toLowerCase().includes(q) ||
        String(c.serial_number || '').toLowerCase().includes(q)
    );
  }, [customers, customerQuery]);

  const handleSave = async () => {
    const customerId = Number(form.customer_id);
    const price = Number(form.price);
    const advance = form.advance === '' ? 0 : Number(form.advance);

    if (!form.customer_id || !customers.some((c) => c.id === customerId)) {
      setFormError('Select a customer.');
      return;
    }
    if (!form.dress_type.trim()) {
      setFormError('Dress type is required.');
      return;
    }
    if (form.price === '' || !Number.isFinite(price) || price < 0) {
      setFormError('Price must be a valid number.');
      return;
    }
    if (!Number.isFinite(advance) || advance < 0) {
      setFormError('Advance must be a valid number.');
      return;
    }
    if (advance > price) {
      setFormError('Advance cannot be greater than the price.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.delivery_date.trim())) {
      setFormError('Delivery date must be in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      await addOrder({
        customer_id: customerId,
        dress_type: form.dress_type.trim(),
        price,
        advance,
        delivery_date: form.delivery_date.trim(),
        status: ORDER_STATUSES.PENDING,
      });
      setModalVisible(false);
      load(search.trim() || undefined, true);
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
      await deleteOrder(deleteTarget.id);
      setDeleteTarget(null);
      load(search.trim() || undefined, true);
    } catch (err) {
      setError(getFriendlyError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderOrder = ({ item }) => {
    const statusCfg = ORDER_STATUS_CONFIG[item.status] || null;
    const total = Number(item.total_amount ?? item.price ?? 0);
    const paid = Number(item.paid_amount ?? item.advance ?? 0);
    const remaining = Math.max(total - paid, 0);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() =>
          navigation.navigate('OrderDetails', {
            orderId: item.id,
            orderNumber: item.order_number,
          })
        }
      >
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              #{item.order_number || item.id} · {item.customer_name || 'Customer'}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.dress_type || '-'} · Due {formatDate(item.delivery_date)}
            </Text>
          </View>
          {statusCfg ? (
            <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
              <Text style={[styles.badgeText, { color: statusCfg.color }]}>
                {statusCfg.label}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.amountText}>Total: {formatCurrency(total)}</Text>
          <Text style={styles.amountText}>Paid: {formatCurrency(paid)}</Text>
          <Text
            style={[
              styles.amountText,
              {
                color: remaining > 0 ? theme.colors.error : theme.colors.success,
                fontWeight: '700',
              },
            ]}
          >
            Balance: {formatCurrency(remaining)}
          </Text>
        </View>

        <View style={styles.cardActions}>
          <View style={styles.spacer} />
          <TouchableOpacity
            style={[styles.chip, styles.chipDanger]}
            onPress={() => setDeleteTarget(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customer, phone, order no..."
        />
        <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <SegmentedTabs
        tabs={FILTERS.map((f) => ({
          key: f.key,
          label: `${f.label} (${counts[f.key] ?? 0})`,
        }))}
        active={statusFilter}
        onChange={setStatusFilter}
      />

      {loading ? (
        <LoadingView message="Loading orders..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(search.trim() || undefined)} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="package-variant"
          title={search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
          message={
            search || statusFilter !== 'all'
              ? 'Try another search or status filter.'
              : 'Create your first order to get started.'
          }
          actionLabel={search || statusFilter !== 'all' ? undefined : 'New Order'}
          onAction={search || statusFilter !== 'all' ? undefined : openAdd}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(search.trim() || undefined, true);
              }}
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
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.modalScroll}>
            <Text style={styles.modalTitle}>New Order</Text>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <InputField
              label="Find Customer"
              value={customerQuery}
              onChangeText={setCustomerQuery}
              placeholder="Type a name or phone..."
              autoCapitalize="none"
              disabled={saving}
            />

            <Text style={styles.fieldLabel}>Customer</Text>
            <View style={styles.customerBox}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={styles.customerScroll}
              >
                {customerOptions.length === 0 ? (
                  <Text style={styles.muted}>
                    No customer matches. Add the customer from the Customers tab first.
                  </Text>
                ) : (
                  <View style={styles.customerWrap}>
                    {customerOptions.map((customer) => {
                      const selected = String(form.customer_id) === String(customer.id);
                      return (
                        <TouchableOpacity
                          key={String(customer.id)}
                          style={[styles.customerChip, selected && styles.customerChipActive]}
                          onPress={() =>
                            setForm((f) => ({ ...f, customer_id: String(customer.id) }))
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.customerChipText,
                              selected && styles.customerChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {customer.name}
                          </Text>
                          <Text
                            style={[
                              styles.customerChipMeta,
                              selected && styles.customerChipTextActive,
                            ]}
                            numberOfLines={1}
                          >
                            {customer.phone || ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </View>

            <OptionGroup
              label="Dress Type"
              options={DRESS_TYPES.map((d) => d.value)}
              value={form.dress_type}
              onChange={(v) => setForm((f) => ({ ...f, dress_type: v }))}
            />

            <InputField
              label="Price (Total)"
              value={form.price}
              onChangeText={(v) => setForm((f) => ({ ...f, price: v }))}
              placeholder="0"
              keyboardType="numeric"
              disabled={saving}
            />
            <InputField
              label="Advance"
              value={form.advance}
              onChangeText={(v) => setForm((f) => ({ ...f, advance: v }))}
              placeholder="0"
              keyboardType="numeric"
              disabled={saving}
              hint="Leave empty for no advance."
            />
            <InputField
              label="Delivery Date (YYYY-MM-DD)"
              value={form.delivery_date}
              onChangeText={(v) => setForm((f) => ({ ...f, delivery_date: v }))}
              placeholder="2026-01-31"
              keyboardType="numbers-and-punctuation"
              disabled={saving}
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setModalVisible(false)}
                disabled={saving}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Create Order"
                onPress={handleSave}
                loading={saving}
                style={styles.modalBtnPrimary}
              />
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete order?"
        message={
          deleteTarget
            ? `Order #${deleteTarget.order_number || deleteTarget.id} will be moved to the recycle bin.`
            : ''
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
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardInfo: { flex: 1, paddingRight: theme.spacing.sm },
  cardName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  cardMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: theme.fontSize.xs, fontWeight: '700' },
  amountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  amountText: { fontSize: theme.fontSize.sm, color: theme.colors.text },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  spacer: { flex: 1 },
  chip: {
    borderRadius: theme.radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipDanger: { backgroundColor: theme.colors.errorBg },
  chipDangerText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
  },
  muted: { fontSize: theme.fontSize.sm, color: theme.colors.textTertiary },
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  customerBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  customerScroll: { maxHeight: 168 },
  customerWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  customerChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 6,
    marginBottom: 6,
    maxWidth: '100%',
  },
  customerChipActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.infoBg,
  },
  customerChipText: { fontSize: theme.fontSize.sm, color: theme.colors.text },
  customerChipMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary },
  customerChipTextActive: { color: theme.colors.accentDark, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    maxHeight: '90%',
    ...theme.elevation.lg,
  },
  modalScroll: { maxHeight: '100%' },
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