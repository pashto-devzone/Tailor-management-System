/**
 * Employee details + salary history.
 *
 * Backend contract (unchanged from desktop):
 *   GET  /api/budget/employees        -> employee list (no single-employee route)
 *   PUT  /api/budget/employees/:id    -> { salaryStatus }
 *   GET  /api/budget/salaries         -> salary records (joined with employee name)
 *   POST /api/budget/salaries         -> { employee_id, amount, month, status }
 *   PUT  /api/budget/salaries/:id     -> { status: 'paid' | 'unpaid' }
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
  PrimaryButton,
  SecondaryButton,
  InputField,
  OptionGroup,
  ChipButton,
} from '../components/UIComponents';
import {
  getEmployees,
  updateEmployee,
  getSalaries,
  addSalary,
  updateSalary,
  getFriendlyError,
} from '../services/api';
import { formatCurrency } from '../utils/currency';
import { toInputDate } from '../utils/date';

const currentMonth = () => toInputDate(new Date()).slice(0, 7);
const STATUS_TABS = ['All', 'Paid', 'Unpaid'];

export default function EmployeeDetailsScreen({ route }) {
  const employeeId = route?.params?.employeeId;
  const initialName = route?.params?.employeeName || '';

  const [employee, setEmployee] = useState(null);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ amount: '', month: currentMonth(), status: 'unpaid' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [banner, setBanner] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!employeeId) {
        setError('Employee not found.');
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError('');
      try {
        const [employeesRes, salariesRes] = await Promise.all([
          getEmployees(),
          getSalaries().catch(() => ({ data: [] })),
        ]);
        const list = Array.isArray(employeesRes.data) ? employeesRes.data : [];
        const found = list.find((e) => String(e.id) === String(employeeId)) || null;
        setEmployee(found);
        const allSalaries = Array.isArray(salariesRes.data) ? salariesRes.data : [];
        setSalaries(
          allSalaries.filter((s) => String(s.employee_id) === String(employeeId))
        );
      } catch (err) {
        setError(getFriendlyError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [employeeId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const toggleEmployeeStatus = async () => {
    if (!employee) return;
    const next = employee.salaryStatus === 'Paid' ? 'Remaining' : 'Paid';
    setBusyId('employee');
    try {
      await updateEmployee(employee.id, { salaryStatus: next });
      setBanner(`Base salary marked as ${next}.`);
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const openAdd = () => {
    setForm({
      amount: employee?.salary != null ? String(employee.salary) : '',
      month: currentMonth(),
      status: 'unpaid',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a valid amount.');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(form.month.trim())) {
      setFormError('Month must be in YYYY-MM format.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await addSalary({
        employee_id: Number(employeeId),
        amount,
        month: form.month.trim(),
        status: form.status,
      });
      setModalOpen(false);
      setBanner('Salary record saved.');
      load(true);
    } catch (err) {
      setFormError(getFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleSalaryStatus = async (record) => {
    const next = record.status === 'paid' ? 'unpaid' : 'paid';
    setBusyId(record.id);
    try {
      await updateSalary(record.id, { status: next });
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const totalPaid = salaries
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);
  const totalUnpaid = salaries
    .filter((s) => s.status !== 'paid')
    .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

  const visibleSalaries = salaries.filter((s) => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Paid') return s.status === 'paid';
    return s.status !== 'paid';
  });

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView message="Loading employee..." />
      </View>
    );
  }

  if (error && !employee) {
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
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {String(employee?.name || initialName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{employee?.name || initialName || 'Employee'}</Text>
              <Text style={styles.role}>{employee?.role || '-'}</Text>
            </View>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor:
                    employee?.salaryStatus === 'Paid'
                      ? theme.colors.successBg
                      : theme.colors.warningBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  {
                    color:
                      employee?.salaryStatus === 'Paid'
                        ? theme.colors.success
                        : theme.colors.warning,
                  },
                ]}
              >
                {employee?.salaryStatus === 'Paid' ? 'Paid' : 'Remaining'}
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.card}>
          <CardSectionTitle>Salary Summary</CardSectionTitle>
          <DetailRow label="Monthly Salary" value={formatCurrency(employee?.salary)} />
          <DetailRow
            label="Total Paid Records"
            value={formatCurrency(totalPaid)}
            valueStyle={{ color: theme.colors.success }}
          />
          <DetailRow
            label="Total Unpaid Records"
            value={formatCurrency(totalUnpaid)}
            valueStyle={{ color: theme.colors.warning }}
          />
          <DetailRow label="Salary Records" value={salaries.length} last />
        </Card>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.action, styles.actionAccent]}
            activeOpacity={0.8}
            onPress={openAdd}
          >
            <Text style={styles.actionAccentText}>Add Salary Record</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.action, styles.actionAlt]}
            activeOpacity={0.8}
            disabled={busyId === 'employee'}
            onPress={toggleEmployeeStatus}
          >
            <Text style={styles.actionAltText}>
              {employee?.salaryStatus === 'Paid' ? 'Mark Remaining' : 'Mark Paid'}
            </Text>
          </TouchableOpacity>
        </View>

        <OptionGroup
          label="Salary Records"
          options={STATUS_TABS}
          value={statusFilter}
          onChange={setStatusFilter}
          columns={3}
          compact
        />

        <Card style={styles.card}>
          {visibleSalaries.length === 0 ? (
            <Text style={styles.muted}>No salary records for this filter.</Text>
          ) : (
            visibleSalaries.map((record) => {
              const isPaid = record.status === 'paid';
              return (
                <View key={String(record.id)} style={styles.salaryRow}>
                  <View style={styles.salaryInfo}>
                    <Text style={styles.salaryMonth}>{record.month || '-'}</Text>
                    <Text style={styles.salaryMeta}>
                      {formatCurrency(record.amount)} · {isPaid ? 'Paid' : 'Unpaid'}
                    </Text>
                  </View>
                  <ChipButton
                    title={isPaid ? 'Mark Unpaid' : 'Mark Paid'}
                    tone={isPaid ? 'accent' : 'success'}
                    onPress={() => toggleSalaryStatus(record)}
                    disabled={busyId === record.id}
                  />
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={modalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Salary Record</Text>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <InputField
              label="Amount"
              value={form.amount}
              onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
              placeholder="0"
              keyboardType="numeric"
              disabled={saving}
            />
            <InputField
              label="Month (YYYY-MM)"
              value={form.month}
              onChangeText={(v) => setForm((f) => ({ ...f, month: v }))}
              placeholder="2026-01"
              disabled={saving}
            />
            <OptionGroup
              label="Status"
              options={['unpaid', 'paid']}
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              compact
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setModalOpen(false)}
                disabled={saving}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Save Record"
                onPress={handleSave}
                loading={saving}
                style={styles.modalBtnPrimary}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  card: { marginBottom: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  headerInfo: { flex: 1, marginLeft: theme.spacing.md },
  name: { fontSize: theme.fontSize.lg, fontWeight: '800', color: theme.colors.text },
  role: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  badge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
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
  actionAccent: { backgroundColor: theme.colors.accent },
  actionAccentText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.sm },
  actionAlt: { backgroundColor: theme.colors.cardAlt },
  actionAltText: { color: theme.colors.text, fontWeight: '700', fontSize: theme.fontSize.sm },
  muted: { fontSize: theme.fontSize.sm, color: theme.colors.textTertiary },
  salaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  salaryInfo: { flex: 1 },
  salaryMonth: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  salaryMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: theme.spacing.md,
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