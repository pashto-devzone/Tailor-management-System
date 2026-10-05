/**
 * Measurements.
 *
 * Uses the SAME model as the desktop app (see MeasurementForm):
 *   GET    /api/customers              -> customer picker
 *   GET    /api/measurements/:customer -> records for the selected customer
 *   POST   /api/measurements           -> { customer_id, measurements, comments }
 *   PUT    /api/measurements/:id       -> { measurements, comments }
 *   DELETE /api/measurements/:id       -> soft delete
 *
 * The `measurements` payload is the full JSONB structure
 * (ناپ · گلہ/کالر/بین · دامن · پاکٹ · بٹن/کاج ڈیزائن · بازو/کف · پٹائی ·
 *  سلائی · شلوار · نوٹس) — nothing is simplified.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
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
} from '../components/UIComponents';
import MeasurementForm from '../components/MeasurementForm';
import MeasurementDetail from '../components/MeasurementDetail';
import {
  getCustomers,
  getMeasurements,
  addMeasurement,
  updateMeasurement,
  deleteMeasurement,
  getFriendlyError,
} from '../services/api';
import { defaultMeasurementDetails } from '../constants/measurementFields';
import { normalizeMeasurementData } from '../utils/measurementUtils';
import { buildMeasurementSummary, shareText } from '../utils/exporter';
import { formatDate } from '../utils/date';

export default function MeasurementsScreen({ route }) {
  const paramCustomerId = route?.params?.customerId ? String(route.params.customerId) : '';

  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(paramCustomerId);
  const [customerQuery, setCustomerQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [screenError, setScreenError] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [details, setDetails] = useState(() => ({ ...defaultMeasurementDetails }));
  const [comments, setComments] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const selectedCustomer =
    customers.find((c) => String(c.id) === String(selectedId)) || null;

  const loadCustomers = useCallback(async (silent = false) => {
    try {
      const res = await getCustomers();
      const list = Array.isArray(res.data) ? res.data : [];
      setCustomers(list);
      setScreenError('');
      return list;
    } catch (err) {
      if (!silent) setScreenError(getFriendlyError(err));
      return [];
    }
  }, []);

  const loadRecords = useCallback(async (customerId, silent = false) => {
    if (!customerId) {
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await getMeasurements(customerId);
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setError(getFriendlyError(err));
      setRecords([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const list = await loadCustomers();
      if (!paramCustomerId && list.length > 0) {
        setSelectedId(String(list[0].id));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to a customerId pushed from another screen (Customer details).
  useEffect(() => {
    if (paramCustomerId) setSelectedId(paramCustomerId);
  }, [paramCustomerId]);

  useEffect(() => {
    loadRecords(selectedId);
  }, [selectedId, loadRecords]);

  const openAdd = () => {
    if (!selectedId) {
      setScreenError('Select a customer first.');
      return;
    }
    setEditingRecord(null);
    setDetails({ ...defaultMeasurementDetails });
    setComments('');
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    const normalized = normalizeMeasurementData(record?.measurements || record);
    setDetails(normalized);
    setComments(record?.comments || normalized.notes || '');
    setFormError('');
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!selectedId) {
      setFormError('Select a customer first.');
      return;
    }
    const hasAnyBasic = Object.values(details.measurements || {}).some(
      (v) => String(v ?? '').trim() !== ''
    );
    const hasAnyFarmaish = Boolean(
      details.gala?.type ||
        details.daaman?.type ||
        details.baazoo?.design ||
        details.patai?.type ||
        details.silai?.type ||
        details.shalwar?.style ||
        details.button_design?.type ||
        details.kaaj_design?.type ||
        details.pocket?.front ||
        details.pocket?.side
    );
    if (!hasAnyBasic && !hasAnyFarmaish && !String(comments).trim()) {
      setFormError('Enter at least one measurement, option or note.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const payload = { ...details, notes: comments };
      if (editingRecord?.id) {
        await updateMeasurement(editingRecord.id, { measurements: payload, comments });
      } else {
        await addMeasurement({
          customer_id: Number(selectedId),
          measurements: payload,
          comments,
        });
      }
      setEditorOpen(false);
      loadRecords(selectedId, true);
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
      await deleteMeasurement(deleteTarget.id);
      setDeleteTarget(null);
      loadRecords(selectedId, true);
    } catch (err) {
      setError(getFriendlyError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (!customerQuery.trim()) return true;
    const q = customerQuery.trim().toLowerCase();
    return (
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.phone || '').toLowerCase().includes(q) ||
      String(c.serial_number || '').toLowerCase().includes(q)
    );
  });

  const renderRecord = ({ item }) => {
    const expanded = String(expandedId) === String(item.id);
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.cardTop}
          activeOpacity={0.75}
          onPress={() => setExpandedId(expanded ? null : item.id)}
        >
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{selectedCustomer?.name || 'Customer'}</Text>
            <Text style={styles.cardDate}>Saved {formatDate(item.created_at)}</Text>
          </View>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={theme.colors.textSecondary}
          />
        </TouchableOpacity>

        {expanded ? (
          <View style={styles.detailWrap}>
            <MeasurementDetail record={item} />
          </View>
        ) : null}

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.chipBtn, styles.chipNeutral]}
            onPress={() =>
              shareText('Measurement', buildMeasurementSummary(item, selectedCustomer?.name))
            }
            activeOpacity={0.7}
          >
            <Text style={styles.chipNeutralText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chipBtn, styles.chipAccent]}
            onPress={() => openEdit(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipAccentText}>Update</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.chipBtn, styles.chipDanger]}
            onPress={() => setDeleteTarget(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.chipDangerText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.customerBar}>
        <TouchableOpacity
          style={styles.customerSelect}
          activeOpacity={0.75}
          onPress={() => {
            setCustomerQuery('');
            setPickerOpen(true);
          }}
        >
          <View style={styles.flex}>
            <Text style={styles.customerLabel}>Customer</Text>
            <Text style={styles.customerValue} numberOfLines={1}>
              {selectedCustomer
                ? `${selectedCustomer.name}${
                    selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''
                  }`
                : 'Select a customer'}
            </Text>
          </View>
          <Text style={styles.customerChevron}>{'\u25BE'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {screenError ? <Text style={styles.screenError}>{screenError}</Text> : null}

      {loading ? (
        <LoadingView message="Loading measurements..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => loadRecords(selectedId)} />
      ) : !selectedId ? (
        <EmptyState
          icon="ruler"
          title="No customer selected"
          message="Choose a customer to view or add their ناپ."
          actionLabel="Select Customer"
          onAction={() => setPickerOpen(true)}
        />
      ) : records.length === 0 ? (
        <EmptyState
          icon="ruler"
          title="No measurements yet"
          message={`Add the first ناپ record for ${selectedCustomer?.name || 'this customer'}.`}
          actionLabel="Add Measurement"
          onAction={openAdd}
        />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderRecord}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadRecords(selectedId, true);
              }}
              colors={[theme.colors.accent]}
              tintColor={theme.colors.accent}
            />
          }
        />
      )}

      {/* Customer picker */}
      <Modal
        visible={pickerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <SearchBar
              value={customerQuery}
              onChangeText={setCustomerQuery}
              placeholder="Search name, phone or serial..."
            />
            <FlatList
              style={styles.pickerList}
              data={filteredCustomers}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.muted}>
                  No customers found. Add customers from the Customers tab.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pickerRow,
                    String(item.id) === String(selectedId) && styles.pickerRowActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedId(String(item.id));
                    setPickerOpen(false);
                  }}
                >
                  <View style={styles.flex}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerMeta}>
                      {item.phone || '-'}
                      {item.serial_number ? ` · #${item.serial_number}` : ''}
                    </Text>
                  </View>
                  {String(item.id) === String(selectedId) ? (
                    <MaterialCommunityIcons
                      name="check"
                      size={18}
                      color={theme.colors.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              )}
            />
            <SecondaryButton
              title="Cancel"
              onPress={() => setPickerOpen(false)}
              style={styles.pickerCancel}
            />
          </View>
        </View>
      </Modal>

      {/* Measurement editor (full desktop model) */}
      <Modal
        visible={editorOpen}
        animationType="slide"
        onRequestClose={() => setEditorOpen(false)}
      >
        <View style={styles.editorScreen}>
          <View style={styles.editorHeader}>
            <View style={styles.flex}>
              <Text style={styles.editorTitle}>
                {editingRecord ? 'Update Measurement' : 'Add Measurement'}
              </Text>
              <Text style={styles.editorSubtitle} numberOfLines={1}>
                {selectedCustomer?.name || 'Customer'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.editorClose}
              onPress={() => setEditorOpen(false)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close" size={22} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.editorBody}
            contentContainerStyle={styles.editorBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <MeasurementForm
              key={editingRecord?.id ? `edit-${editingRecord.id}` : 'new'}
              details={details}
              onChange={setDetails}
            />

            <View style={styles.notesCard}>
              <Text style={styles.notesLabel}>نوٹس / کمنٹس (record comment)</Text>
              <TextInput
                style={styles.notesInput}
                value={comments}
                onChangeText={setComments}
                placeholder="کوئی خاص ہدایت..."
                placeholderTextColor={theme.colors.textTertiary}
                multiline
              />
            </View>
          </ScrollView>

          <View style={styles.editorFooter}>
            <SecondaryButton
              title="Cancel"
              onPress={() => setEditorOpen(false)}
              disabled={saving}
              style={styles.footerBtn}
            />
            <PrimaryButton
              title={editingRecord ? 'Save Changes' : 'Save Measurement'}
              onPress={handleSave}
              loading={saving}
              style={styles.footerBtnPrimary}
            />
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete measurement?"
        message="This ناپ record will be moved to the recycle bin."
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
  customerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  customerSelect: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  customerLabel: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary },
  customerValue: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 1,
  },
  customerChevron: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
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
  screenError: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
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
  cardInfo: { flex: 1 },
  cardName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  cardDate: { fontSize: theme.fontSize.xs, color: theme.colors.textTertiary, marginTop: 2 },
  expandIcon: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '700' },
  detailWrap: { marginTop: theme.spacing.sm },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  chipBtn: {
    borderRadius: theme.radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginLeft: theme.spacing.sm,
  },
  chipAccent: { backgroundColor: theme.colors.infoBg },
  chipNeutral: { backgroundColor: theme.colors.cardAlt, marginLeft: 0, marginRight: theme.spacing.sm },
  chipNeutralText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
  },
  chipAccentText: {
    color: theme.colors.accentDark,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
  },
  chipDanger: { backgroundColor: theme.colors.errorBg },
  chipDangerText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
  },
  muted: { fontSize: theme.fontSize.sm, color: theme.colors.textTertiary },
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
    maxHeight: '80%',
    ...theme.elevation.lg,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  pickerList: { marginTop: theme.spacing.sm, maxHeight: 320 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerRowActive: { backgroundColor: theme.colors.infoBg },
  pickerName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  pickerMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textSecondary, marginTop: 2 },
  pickerCheck: { color: theme.colors.accent, fontSize: 16, fontWeight: '800' },
  pickerCancel: { marginTop: theme.spacing.md },
  editorScreen: { flex: 1, backgroundColor: theme.colors.background },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  editorTitle: { color: '#fff', fontSize: theme.fontSize.lg, fontWeight: '700' },
  editorSubtitle: { color: '#cbd5e1', fontSize: theme.fontSize.sm, marginTop: 2 },
  editorClose: { paddingHorizontal: theme.spacing.sm, paddingVertical: 4 },
  editorCloseText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  editorBody: { flex: 1 },
  editorBodyContent: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  notesCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  notesLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  notesInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  formError: {
    backgroundColor: theme.colors.errorBg,
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  editorFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  footerBtn: { flex: 1, marginRight: theme.spacing.sm },
  footerBtnPrimary: { flex: 1.4 },
});