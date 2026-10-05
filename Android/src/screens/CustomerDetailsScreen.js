/**
 * Customer details.
 *
 * Real backend data only:
 *   GET /api/customers/:id             -> customer
 *   GET /api/orders/:customer_id       -> orders for that customer
 *   GET /api/measurements/:customer_id -> measurement records
 *   PUT /api/customers/:id             -> update
 *   DELETE /api/customers/:id          -> soft delete
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { theme } from '../constants/theme';
import {
  Card,
  CardSectionTitle,
  DetailRow,
  LoadingView,
  ErrorState,
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  InputField,
} from '../components/UIComponents';
import {
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getOrdersByCustomerId,
  getMeasurements,
  getFriendlyError,
} from '../services/api';
import { ORDER_STATUS_CONFIG } from '../constants/orderStatus';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { measurementRows } from '../constants/measurementFields';
import { normalizeMeasurementData } from '../utils/measurementUtils';

const measurementSummary = (record) => {
  const details = normalizeMeasurementData(record?.measurements || record);
  const filled = measurementRows.filter((row) => {
    const v = details.measurements?.[row.key];
    return v !== undefined && v !== null && String(v).trim() !== '';
  });
  if (filled.length === 0) return 'No ناپ values recorded';
  return filled.map((row) => `${row.label}: ${details.measurements[row.key]}`).join(' • ');
};

export default function CustomerDetailsScreen({ navigation, route }) {
  const customerId = route?.params?.customerId;
  const initial = route?.params?.customer || null;

  const [customer, setCustomer] = useState(initial);
  const [orders, setOrders] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', serial_number: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!customerId) {
        setError('Customer not found.');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const [customerRes, ordersRes, measurementsRes] = await Promise.all([
          getCustomerById(customerId),
          getOrdersByCustomerId(customerId).catch(() => ({ data: [] })),
          getMeasurements(customerId).catch(() => ({ data: [] })),
        ]);
        if (customerRes.data) setCustomer(customerRes.data);
        setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
        setMeasurements(Array.isArray(measurementsRes.data) ? measurementsRes.data : []);
      } catch (err) {
        setError(getFriendlyError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [customerId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = () => {
    setForm({
      name: customer?.name || '',
      phone: customer?.phone || '',
      address: customer?.address || '',
      serial_number:
        customer?.serial_number != null ? String(customer.serial_number) : '',
    });
    setFormError('');
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      setFormError('Name, phone and address are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await updateCustomer(customerId, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        serial_number: form.serial_number.trim() || null,
      });
      setEditOpen(false);
      load(true);
    } catch (err) {
      setFormError(getFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteCustomer(customerId);
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      setError(getFriendlyError(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const openTab = (tabName, params) => {
    const parent = navigation.getParent();
    if (parent) parent.navigate(tabName, params);
    else navigation.navigate(tabName, params);
  };

  const totalBilled = orders.reduce(
    (sum, o) => sum + Number(o.total_amount ?? o.price ?? 0),
    0
  );
  const totalPaid = orders.reduce(
    (sum, o) => sum + Number(o.paid_amount ?? o.advance ?? 0),
    0
  );
  const outstanding = Math.max(totalBilled - totalPaid, 0);

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView message="Loading customer..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.flex}>
        <ErrorState message={error} onRetry={() => load()} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        }
      >
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {String(customer?.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{customer?.name || 'Customer'}</Text>
              <Text style={styles.phone}>{customer?.phone || '-'}</Text>
            </View>
            {customer?.serial_number != null && customer.serial_number !== '' ? (
              <View style={styles.serialBadge}>
                <Text style={styles.serialText}>#{customer.serial_number}</Text>
              </View>
            ) : null}
          </View>
          {customer?.address ? <Text style={styles.address}>{customer.address}</Text> : null}
        </Card>

        <Card style={styles.card}>
          <CardSectionTitle>Overview</CardSectionTitle>
          <DetailRow label="Total Orders" value={orders.length} />
          <DetailRow label="Total Billed" value={formatCurrency(totalBilled)} />
          <DetailRow label="Total Paid" value={formatCurrency(totalPaid)} />
          <DetailRow
            label="Outstanding"
            value={formatCurrency(outstanding)}
            valueStyle={{
              color: outstanding > 0 ? theme.colors.error : theme.colors.success,
            }}
          />
          <DetailRow label="Measurement Records" value={measurements.length} last />
        </Card>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.action, styles.actionPrimary]}
            activeOpacity={0.8}
            onPress={() => openTab('Measurements', { customerId })}
          >
            <Text style={styles.actionPrimaryText}>Measurements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, styles.actionAccent]}
            activeOpacity={0.8}
            onPress={() =>
              openTab('Orders', {
                screen: 'OrdersList',
                params: { customerId, openNew: Date.now() },
              })
            }
          >
            <Text style={styles.actionAccentText}>New Order</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.action, styles.actionAlt]}
            activeOpacity={0.8}
            onPress={openEdit}
          >
            <Text style={styles.actionAltText}>Edit Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, styles.actionDanger]}
            activeOpacity={0.8}
            onPress={() => setConfirmDelete(true)}
          >
            <Text style={styles.actionDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.card}>
          <CardSectionTitle>Orders ({orders.length})</CardSectionTitle>
          {orders.length === 0 ? (
            <Text style={styles.muted}>No orders for this customer yet.</Text>
          ) : (
            orders.slice(0, 5).map((order) => {
              const cfg = ORDER_STATUS_CONFIG[order.status] || null;
              const total = Number(order.total_amount ?? order.price ?? 0);
              const paid = Number(order.paid_amount ?? order.advance ?? 0);
              return (
                <TouchableOpacity
                  key={String(order.id)}
                  style={styles.orderRow}
                  activeOpacity={0.75}
                  onPress={() =>
                    openTab('Orders', {
                      screen: 'OrderDetails',
                      params: { orderId: order.id, orderNumber: order.order_number },
                    })
                  }
                >
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTitle}>
                      #{order.order_number || order.id} · {order.dress_type || '-'}
                    </Text>
                    <Text style={styles.orderMeta}>
                      Due {formatDate(order.delivery_date)} · {formatCurrency(total)} · Paid{' '}
                      {formatCurrency(paid)}
                    </Text>
                  </View>
                  {cfg ? (
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
          {orders.length > 5 ? (
            <Text style={styles.muted}>+{orders.length - 5} more in the Orders tab.</Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <CardSectionTitle>Measurements ({measurements.length})</CardSectionTitle>
          {measurements.length === 0 ? (
            <Text style={styles.muted}>No measurement records yet.</Text>
          ) : (
            measurements.slice(0, 3).map((record) => (
              <TouchableOpacity
                key={String(record.id)}
                style={styles.measurementRow}
                activeOpacity={0.75}
                onPress={() => openTab('Measurements', { customerId })}
              >
                <Text style={styles.measurementDate}>
                  {formatDate(record.created_at) || 'Saved record'}
                </Text>
                <Text style={styles.measurementSummary} numberOfLines={2}>
                  {measurementSummary(record)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={editOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Customer</Text>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <InputField
              label="Name"
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              disabled={saving}
            />
            <InputField
              label="Phone"
              value={form.phone}
              onChangeText={(v) => setForm((f) => ({ ...f, phone: v }))}
              keyboardType="phone-pad"
              disabled={saving}
            />
            <InputField
              label="Address"
              value={form.address}
              onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
              multiline
              disabled={saving}
            />
            <InputField
              label="Serial Number"
              value={form.serial_number}
              onChangeText={(v) => setForm((f) => ({ ...f, serial_number: v }))}
              keyboardType="number-pad"
              disabled={saving}
            />
            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setEditOpen(false)}
                disabled={saving}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Update"
                onPress={handleSave}
                loading={saving}
                style={styles.modalBtnPrimary}
              />
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete customer?"
        message={`"${customer?.name || 'This customer'}" will be moved to the recycle bin.`}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  headerCard: { marginBottom: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerInfo: { flex: 1, marginLeft: theme.spacing.md },
  name: { fontSize: theme.fontSize.lg, fontWeight: '800', color: theme.colors.text },
  phone: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  serialBadge: {
    backgroundColor: theme.colors.cardAlt,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serialText: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, fontWeight: '700' },
  address: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  card: { marginBottom: theme.spacing.md },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  action: {
    flex: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionPrimary: { backgroundColor: theme.colors.primary },
  actionPrimaryText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.sm },
  actionAccent: { backgroundColor: theme.colors.accent },
  actionAccentText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.sm },
  actionAlt: { backgroundColor: theme.colors.cardAlt },
  actionAltText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.fontSize.sm },
  actionDanger: { backgroundColor: theme.colors.errorBg },
  actionDangerText: { color: theme.colors.error, fontWeight: '700', fontSize: theme.fontSize.sm },
  muted: { fontSize: theme.fontSize.sm, color: theme.colors.textTertiary },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  orderInfo: { flex: 1, paddingRight: theme.spacing.sm },
  orderTitle: { fontSize: theme.fontSize.sm, fontWeight: '700', color: theme.colors.text },
  orderMeta: {
    fontSize: theme.fontSize.xs,
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
  measurementRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  measurementDate: {
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  measurementSummary: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 19,
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