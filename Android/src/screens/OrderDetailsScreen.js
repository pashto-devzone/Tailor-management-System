/**
 * Order details.
 *
 * Backend contract (unchanged from desktop):
 *   GET  /api/orders/detail/:id         -> order (+ customer_name/phone/address)
 *   PUT  /api/orders/:id                -> update (dress_type, price, advance,
 *                                           delivery_date, status required)
 *   POST /api/orders/:id/payment        -> { payment_amount } or { action: 'full' }
 *   DELETE /api/orders/:id              -> soft delete
 *   GET  /api/measurements/:customer_id -> measurement records for the customer
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
  OptionGroup,
} from '../components/UIComponents';
import {
  getOrderById,
  updateOrder,
  updateOrderPayment,
  deleteOrder,
  getMeasurements,
  getFriendlyError,
} from '../services/api';
import {
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  ORDER_STATUSES,
  DRESS_TYPES,
} from '../constants/orderStatus';
import { formatDate, toInputDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { buildOrderSummary, shareText } from '../utils/exporter';
import MeasurementDetail from '../components/MeasurementDetail';

const STATUS_OPTIONS = [
  ORDER_STATUSES.PENDING,
  ORDER_STATUSES.READY,
  ORDER_STATUSES.DELIVERED,
];

export default function OrderDetailsScreen({ navigation, route }) {
  const orderId = route?.params?.orderId;
  const [order, setOrder] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    dress_type: '',
    price: '',
    advance: '',
    delivery_date: '',
    status: ORDER_STATUSES.PENDING,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMeasurement, setShowMeasurement] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!orderId) {
        setError('Order not found.');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await getOrderById(orderId);
        const data = res.data || null;
        setOrder(data);
        if (data?.customer_id) {
          const mRes = await getMeasurements(data.customer_id).catch(() => ({ data: [] }));
          setMeasurements(Array.isArray(mRes.data) ? mRes.data : []);
        }
      } catch (err) {
        setError(getFriendlyError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const total = Number(order?.total_amount ?? order?.price ?? 0);
  const paid = Number(order?.paid_amount ?? order?.advance ?? 0);
  const remaining = Math.max(total - paid, 0);

  const openEdit = () => {
    setForm({
      dress_type: order?.dress_type || '',
      price: String(order?.total_amount ?? order?.price ?? ''),
      advance: String(order?.paid_amount ?? order?.advance ?? ''),
      delivery_date: toInputDate(order?.delivery_date),
      status: order?.status || ORDER_STATUSES.PENDING,
    });
    setFormError('');
    setEditOpen(true);
  };

  const handleSave = async () => {
    const price = Number(form.price);
    const advance = form.advance === '' ? 0 : Number(form.advance);
    if (!form.dress_type.trim()) {
      setFormError('Dress type is required.');
      return;
    }
    if (form.price === '' || !Number.isFinite(price) || price < 0) {
      setFormError('Price must be a valid number.');
      return;
    }
    if (!Number.isFinite(advance) || advance < 0 || advance > price) {
      setFormError('Advance must be a valid number between 0 and the price.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.delivery_date.trim())) {
      setFormError('Delivery date must be in YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await updateOrder(orderId, {
        dress_type: form.dress_type.trim(),
        price,
        advance,
        delivery_date: form.delivery_date.trim(),
        status: form.status,
      });
      setEditOpen(false);
      setBanner('Order updated.');
      load(true);
    } catch (err) {
      setFormError(getFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (nextStatus) => {
    if (!order || order.status === nextStatus) return;
    setBusy(true);
    setBanner('');
    try {
      await updateOrder(orderId, {
        dress_type: order.dress_type,
        price: total,
        advance: paid,
        delivery_date: toInputDate(order.delivery_date),
        status: nextStatus,
      });
      setBanner(`Status changed to ${nextStatus}.`);
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePayment = async (mode) => {
    setPayError('');
    setBanner('');
    setBusy(true);
    try {
      if (mode === 'full') {
        await updateOrderPayment(orderId, { action: 'full' });
        setBanner('Order marked as fully paid.');
        setPayOpen(false);
      } else {
        const amount = Number(payAmount);
        if (!payAmount || !Number.isFinite(amount) || amount <= 0) {
          setPayError('Enter a valid payment amount.');
          setBusy(false);
          return;
        }
        await updateOrderPayment(orderId, { payment_amount: amount });
        setBanner('Payment recorded.');
        setPayOpen(false);
        setPayAmount('');
      }
      load(true);
    } catch (err) {
      const message = getFriendlyError(err);
      if (mode === 'full') setError(message);
      else setPayError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteOrder(orderId);
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      setError(getFriendlyError(err));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    await shareText(`Order #${order?.order_number || order?.id}`, buildOrderSummary(order));
  };

  const statusCfg = ORDER_STATUS_CONFIG[order?.status] || null;
  const payCfg = PAYMENT_STATUS_CONFIG[order?.payment_status] || null;
  const latestMeasurement = measurements.length > 0 ? measurements[0] : null;

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView message="Loading order..." />
      </View>
    );
  }

  if (error && !order) {
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
        {error ? <Text style={styles.bannerError}>{error}</Text> : null}
        {banner ? <Text style={styles.bannerOk}>{banner}</Text> : null}

        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.orderNo}>
              #{order?.order_number || order?.id || '-'}
            </Text>
            {statusCfg ? (
              <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                <Text style={[styles.badgeText, { color: statusCfg.color }]}>
                  {statusCfg.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.dressType}>{order?.dress_type || '-'}</Text>
          {payCfg ? (
            <View style={[styles.badge, styles.payBadge, { backgroundColor: payCfg.bg }]}>
              <Text style={[styles.badgeText, { color: payCfg.color }]}>{payCfg.label}</Text>
            </View>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <CardSectionTitle>Payment Summary</CardSectionTitle>
          <DetailRow label="Total Amount" value={formatCurrency(total)} />
          <DetailRow label="Paid" value={formatCurrency(paid)} />
          <DetailRow
            label="Remaining"
            value={formatCurrency(remaining)}
            valueStyle={{
              color: remaining > 0 ? theme.colors.error : theme.colors.success,
              fontWeight: '800',
            }}
            last
          />
        </Card>

        <Card style={styles.card}>
          <CardSectionTitle>Order Information</CardSectionTitle>
          <DetailRow label="Customer" value={order?.customer_name || '-'} />
          <DetailRow label="Phone" value={order?.customer_phone || '-'} />
          <DetailRow label="Address" value={order?.customer_address || '-'} />
          <DetailRow label="Delivery Date" value={formatDate(order?.delivery_date)} />
          <DetailRow label="Created" value={formatDate(order?.created_at)} last />
        </Card>

        <Card style={styles.card}>
          <CardSectionTitle>Update Status</CardSectionTitle>
          <OptionGroup
            options={STATUS_OPTIONS}
            value={order?.status}
            onChange={setStatus}
            columns={1}
            compact
          />
          {busy ? <Text style={styles.muted}>Updating...</Text> : null}
        </Card>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.action, styles.actionAccent]}
            activeOpacity={0.8}
            disabled={busy}
            onPress={() => {
              setPayAmount('');
              setPayError('');
              setPayOpen(true);
            }}
          >
            <Text style={styles.actionAccentText}>Add Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, styles.actionAlt]}
            activeOpacity={0.8}
            disabled={busy}
            onPress={openEdit}
          >
            <Text style={styles.actionAltText}>Edit Order</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.action, styles.actionPrimary]}
            activeOpacity={0.8}
            disabled={busy}
            onPress={() => {
              const parent = navigation.getParent();
              if (parent && order?.customer_id) {
                parent.navigate('Customers', {
                  screen: 'CustomerDetails',
                  params: { customerId: order.customer_id },
                });
              }
            }}
          >
            <Text style={styles.actionPrimaryText}>View Customer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, styles.actionDanger]}
            activeOpacity={0.8}
            onPress={() => setConfirmDelete(true)}
          >
            <Text style={styles.actionDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.action, styles.actionShare]}
          activeOpacity={0.8}
          onPress={handleShare}
        >
          <Text style={styles.actionShareText}>Share / Export Summary</Text>
        </TouchableOpacity>

        <Card style={styles.card}>
          <CardSectionTitle>Measurements</CardSectionTitle>
          {latestMeasurement ? (
            <>
              <DetailRow
                label="Saved"
                value={formatDate(latestMeasurement.created_at)}
              />
              <TouchableOpacity
                style={styles.measurementToggle}
                activeOpacity={0.75}
                onPress={() => setShowMeasurement((v) => !v)}
              >
                <Text style={styles.measurementToggleText}>
                  {showMeasurement ? 'Hide ناپ تفصیلات' : 'Show ناپ تفصیلات'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.muted}>
              No measurement record saved for this customer yet.
            </Text>
          )}
        </Card>

        {showMeasurement && latestMeasurement ? (
          <MeasurementDetail record={latestMeasurement} />
        ) : null}
      </ScrollView>

      <Modal
        visible={editOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setEditOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Edit Order</Text>
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

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
                keyboardType="numeric"
                disabled={saving}
              />
              <InputField
                label="Paid Amount"
                value={form.advance}
                onChangeText={(v) => setForm((f) => ({ ...f, advance: v }))}
                keyboardType="numeric"
                disabled={saving}
              />
              <InputField
                label="Delivery Date (YYYY-MM-DD)"
                value={form.delivery_date}
                onChangeText={(v) => setForm((f) => ({ ...f, delivery_date: v }))}
                keyboardType="numbers-and-punctuation"
                disabled={saving}
              />
              <OptionGroup
                label="Status"
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v }))}
                columns={1}
                compact
              />

              <View style={styles.modalActions}>
                <SecondaryButton
                  title="Cancel"
                  onPress={() => setEditOpen(false)}
                  disabled={saving}
                  style={styles.modalBtn}
                />
                <PrimaryButton
                  title="Save Changes"
                  onPress={handleSave}
                  loading={saving}
                  style={styles.modalBtnPrimary}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={payOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPayOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Payment</Text>
            <Text style={styles.muted}>
              Remaining balance: {formatCurrency(remaining)}
            </Text>
            {payError ? <Text style={styles.formError}>{payError}</Text> : null}

            <InputField
              label="Payment Amount"
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="0"
              keyboardType="numeric"
              disabled={busy}
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setPayOpen(false)}
                disabled={busy}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Record Payment"
                onPress={() => handlePayment('partial')}
                loading={busy}
                style={styles.modalBtnPrimary}
              />
            </View>

            <PrimaryButton
              title="Mark Fully Paid"
              onPress={() => handlePayment('full')}
              disabled={busy}
              style={styles.fullPayBtn}
            />
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete order?"
        message={`Order #${order?.order_number || order?.id || ''} will be moved to the recycle bin.`}
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
  card: { marginBottom: theme.spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  orderNo: { fontSize: theme.fontSize.xl, fontWeight: '800', color: theme.colors.primary },
  dressType: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  badge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  payBadge: { marginTop: theme.spacing.sm },
  badgeText: { fontSize: theme.fontSize.xs, fontWeight: '700' },
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
  actionDangerText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  actionShare: {
    backgroundColor: theme.colors.cardAlt,
    marginHorizontal: 4,
    paddingVertical: 11,
    marginBottom: theme.spacing.sm,
  },
  actionShareText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  muted: { fontSize: theme.fontSize.sm, color: theme.colors.textTertiary },
  bannerError: {
    backgroundColor: theme.colors.errorBg,
    color: theme.colors.error,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  bannerOk: {
    backgroundColor: theme.colors.successBg,
    color: theme.colors.success,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  measurementToggle: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.infoBg,
    borderRadius: theme.radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  measurementToggleText: {
    color: theme.colors.accentDark,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
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
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
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
  fullPayBtn: { marginTop: theme.spacing.md, backgroundColor: theme.colors.success },
});