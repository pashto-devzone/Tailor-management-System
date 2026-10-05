/**
 * Income & Expenses (Finance).
 *
 * Backend contract (unchanged from desktop):
 *   GET    /api/budget/income     -> [{ id, source, amount, date, payment_type, ... }]
 *   POST   /api/budget/income     -> { source, amount, date }
 *   DELETE /api/budget/income/:id
 *   GET    /api/budget/expenses   -> [{ id, title, amount, date }]
 *   POST   /api/budget/expenses   -> { title, amount, date }
 *   DELETE /api/budget/expenses/:id
 *   GET    /api/budget/salaries   -> salary records (shown as a third view)
 *   PUT    /api/budget/salaries/:id -> { status }
 *
 * LIMITATION (existing backend, not redesigned here): income and expense
 * records have no update/delete-and-edit endpoint — only create + delete.
 * Salary records do support a status update.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import {
  SegmentedTabs,
  LoadingView,
  EmptyState,
  ErrorState,
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  InputField,
} from '../components/UIComponents';
import {
  getIncome,
  getExpenses,
  getSalaries,
  addIncome,
  addExpense,
  deleteIncome,
  deleteExpense,
  getFriendlyError,
} from '../services/api';
import { formatDate, toInputDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';

const VIEWS = [
  { key: 'income', label: 'Income' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'salaries', label: 'Salaries' },
];

export default function FinanceScreen() {
  const [view, setView] = useState('income');
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ title: '', amount: '', date: toInputDate(new Date()) });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const [incomeRes, expensesRes, salariesRes] = await Promise.all([
        getIncome(),
        getExpenses(),
        getSalaries().catch(() => ({ data: [] })),
      ]);
      setIncome(Array.isArray(incomeRes.data) ? incomeRes.data : []);
      setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : []);
      setSalaries(Array.isArray(salariesRes.data) ? salariesRes.data : []);
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

  const totalIncome = useMemo(
    () => income.reduce((s, i) => s + Number(i.amount ?? 0), 0),
    [income]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0),
    [expenses]
  );
  const totalSalaryPaid = useMemo(
    () =>
      salaries
        .filter((s) => s.status === 'paid')
        .reduce((sum, s) => sum + Number(s.amount ?? 0), 0),
    [salaries]
  );
  const totalSalaryUnpaid = useMemo(
    () =>
      salaries
        .filter((s) => s.status !== 'paid')
        .reduce((sum, s) => sum + Number(s.amount ?? 0), 0),
    [salaries]
  );
  const net = totalIncome - totalExpenses - totalSalaryPaid;

  const openAdd = () => {
    setForm({ title: '', amount: '', date: toInputDate(new Date()) });
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!form.title.trim() || form.amount === '' || !Number.isFinite(amount) || amount <= 0) {
      setFormError('Title, a valid amount and date are required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date.trim())) {
      setFormError('Date must be in YYYY-MM-DD format.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (view === 'income') {
        await addIncome({
          source: form.title.trim(),
          amount,
          date: form.date.trim(),
        });
      } else {
        await addExpense({
          title: form.title.trim(),
          amount,
          date: form.date.trim(),
        });
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
      if (deleteTarget.kind === 'income') await deleteIncome(deleteTarget.id);
      else await deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const items = view === 'income' ? income : view === 'expenses' ? expenses : salaries;

  const renderItem = ({ item }) => {
    if (view === 'salaries') {
      const isPaid = item.status === 'paid';
      return (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{item.employee_name || 'Employee'}</Text>
              <Text style={styles.cardMeta}>
                {item.month || '-'} · {item.employee_role || ''}
              </Text>
            </View>
            <Text
              style={[
                styles.amount,
                { color: isPaid ? theme.colors.success : theme.colors.warning },
              ]}
            >
              {formatCurrency(item.amount)}
            </Text>
          </View>
          <Text
            style={[
              styles.statusLine,
              { color: isPaid ? theme.colors.success : theme.colors.warning },
            ]}
          >
            {isPaid ? 'Paid' : 'Unpaid'}
          </Text>
        </View>
      );
    }
    const isIncome = view === 'income';
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{isIncome ? item.source : item.title}</Text>
            <Text style={styles.cardMeta}>{formatDate(item.date)}</Text>
          </View>
          <Text
            style={[
              styles.amount,
              { color: isIncome ? theme.colors.success : theme.colors.error },
            ]}
          >
            {isIncome ? '+' : '-'}
            {formatCurrency(item.amount)}
          </Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.chipBtn, styles.chipDanger]}
            onPress={() =>
              setDeleteTarget({ ...item, kind: isIncome ? 'income' : 'expense' })
            }
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
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconWrap, { backgroundColor: theme.colors.successBg }]}>
            <MaterialCommunityIcons
              name="trending-up"
              size={16}
              color={theme.colors.success}
            />
          </View>
          <Text style={styles.summaryValue}>{formatCurrency(totalIncome)}</Text>
          <Text style={styles.summaryLabel}>Income</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconWrap, { backgroundColor: theme.colors.errorBg }]}>
            <MaterialCommunityIcons
              name="trending-down"
              size={16}
              color={theme.colors.error}
            />
          </View>
          <Text style={styles.summaryValue}>{formatCurrency(totalExpenses)}</Text>
          <Text style={styles.summaryLabel}>Expenses</Text>
        </View>
      </View>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconWrap, { backgroundColor: theme.colors.primaryLight }]}>
            <MaterialCommunityIcons name="cash-multiple" size={16} color={theme.colors.primary} />
          </View>
          <Text style={styles.summaryValue}>{formatCurrency(totalSalaryPaid)}</Text>
          <Text style={styles.summaryLabel}>Salary Paid</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconWrap, { backgroundColor: theme.colors.warningBg }]}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color={theme.colors.warning}
            />
          </View>
          <Text style={styles.summaryValue}>{formatCurrency(totalSalaryUnpaid)}</Text>
          <Text style={styles.summaryLabel}>Salary Unpaid</Text>
        </View>
      </View>

      <View style={styles.netRow}>
        <Text style={styles.netLabel}>Net (Income − Expenses − Salaries Paid)</Text>
        <Text
          style={[
            styles.netValue,
            { color: net >= 0 ? theme.colors.success : theme.colors.error },
          ]}
        >
          {formatCurrency(net)}
        </Text>
      </View>

      <View style={styles.tabsRow}>
        <SegmentedTabs tabs={VIEWS} active={view} onChange={setView} />
      </View>

      {view !== 'salaries' ? (
        <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
          <Text style={styles.addButtonText}>
            {view === 'income' ? '+ Add Income' : '+ Add Expense'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <LoadingView message="Loading finance data..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="wallet"
          title={
            view === 'income'
              ? 'No income records'
              : view === 'expenses'
                ? 'No expense records'
                : 'No salary records'
          }
          message={
            view === 'salaries'
              ? 'Salary records are created from the Employees detail screen.'
              : 'Add a record to start tracking your budget.'
          }
          actionLabel={view === 'income' ? 'Add Income' : view === 'expenses' ? 'Add Expense' : undefined}
          onAction={view === 'salaries' ? undefined : openAdd}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${view}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
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
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {view === 'income' ? 'Add Income' : 'Add Expense'}
              </Text>
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <InputField
                label={view === 'income' ? 'Income Source' : 'Expense Title'}
                value={form.title}
                onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
                placeholder={view === 'income' ? 'e.g. Order payment' : 'e.g. Cloth purchase'}
                disabled={saving}
              />
              <InputField
                label="Amount"
                value={form.amount}
                onChangeText={(v) => setForm((f) => ({ ...f, amount: v }))}
                placeholder="0"
                keyboardType="numeric"
                disabled={saving}
              />
              <InputField
                label="Date (YYYY-MM-DD)"
                value={form.date}
                onChangeText={(v) => setForm((f) => ({ ...f, date: v }))}
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
                  title="Save"
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
        title={`Delete ${deleteTarget?.kind === 'income' ? 'income' : 'expense'} record?`}
        message="This will be removed permanently."
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
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    minHeight: 104,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginHorizontal: 4,
    marginBottom: theme.spacing.sm,
    ...theme.elevation.sm,
  },
  summaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  summaryValue: {
    fontSize: theme.fontSize.base,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  summaryLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.elevation.sm,
  },
  netLabel: { flex: 1, fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  netValue: { fontSize: theme.fontSize.lg, fontWeight: '800' },
  tabsRow: { marginTop: theme.spacing.sm },
  addButton: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.sm },
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
  cardInfo: { flex: 1, paddingRight: theme.spacing.sm },
  cardName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  cardMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  amount: { fontSize: theme.fontSize.md, fontWeight: '800' },
  statusLine: { fontSize: theme.fontSize.xs, fontWeight: '700', marginTop: 4 },
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
  },
  chipDanger: { backgroundColor: theme.colors.errorBg },
  chipDangerText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
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