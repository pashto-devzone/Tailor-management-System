/**
 * Employees list.
 *
 * Backend contract (unchanged from desktop):
 *   GET    /api/budget/employees      -> [{ id, name, role, salary, salaryStatus }]
 *   POST   /api/budget/employees      -> { message }
 *   PUT    /api/budget/employees/:id  -> { salaryStatus: 'Paid' | 'Remaining' }
 *   DELETE /api/budget/employees/:id  -> { message }
 *
 * LIMITATION (existing backend, not redesigned here): the employee update
 * endpoint only accepts `salaryStatus`. It cannot update name / role / salary,
 * which is why this screen offers "Add" + "Salary status" + "Delete" and the
 * detail screen manages salary payments through /budget/salaries.
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
  ScrollView,
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
  OptionGroup,
  ChipButton,
} from '../components/UIComponents';
import {
  getEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  getFriendlyError,
} from '../services/api';
import { formatCurrency } from '../utils/currency';

const ROLE_OPTIONS = ['Master', 'Karigar', 'Helper', 'Cutter', 'Press', 'Other'];

export default function EmployeesScreen({ navigation }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', salary: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await getEmployees();
      setEmployees(Array.isArray(res.data) ? res.data : []);
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

  const filtered = employees.filter((e) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(e.name || '').toLowerCase().includes(q) ||
      String(e.role || '').toLowerCase().includes(q)
    );
  });

  const totalPayroll = employees.reduce((sum, e) => sum + Number(e.salary ?? 0), 0);
  const paidCount = employees.filter((e) => e.salaryStatus === 'Paid').length;
  const remainingCount = employees.length - paidCount;

  const openAdd = () => {
    setForm({ name: '', role: '', salary: '' });
    setFormError('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (
      !form.name.trim() ||
      !form.role.trim() ||
      form.salary === '' ||
      !Number.isFinite(Number(form.salary)) ||
      Number(form.salary) < 0
    ) {
      setFormError('Name, role and a valid salary are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await addEmployee({
        name: form.name.trim(),
        role: form.role.trim(),
        salary: Number(form.salary),
      });
      setModalVisible(false);
      load(true);
    } catch (err) {
      setFormError(getFriendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (employee) => {
    const next = employee.salaryStatus === 'Paid' ? 'Remaining' : 'Paid';
    setBusyId(employee.id);
    try {
      await updateEmployee(employee.id, { salaryStatus: next });
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteEmployee(deleteTarget.id);
      setDeleteTarget(null);
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const renderEmployee = ({ item }) => {
    const isPaid = item.salaryStatus === 'Paid';
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() =>
          navigation.navigate('EmployeeDetails', {
            employeeId: item.id,
            employeeName: item.name,
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
              {item.role || '-'}
            </Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={styles.salary}>{formatCurrency(item.salary)}</Text>
            <Text
              style={[
                styles.status,
                { color: isPaid ? theme.colors.success : theme.colors.warning },
              ]}
            >
              {isPaid ? 'Paid' : 'Remaining'}
            </Text>
          </View>
        </View>

        <View style={styles.cardActions}>
          <ChipButton
            title={isPaid ? 'Mark Remaining' : 'Mark Paid'}
            tone={isPaid ? 'accent' : 'success'}
            onPress={() => toggleStatus(item)}
            disabled={busyId === item.id}
          />
          <ChipButton title="Delete" tone="danger" onPress={() => setDeleteTarget(item)} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search employees..." />
        <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{employees.length}</Text>
          <Text style={styles.summaryLabel}>Employees</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.colors.success }]}>
            {paidCount}
          </Text>
          <Text style={styles.summaryLabel}>Paid</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: theme.colors.warning }]}>
            {remainingCount}
          </Text>
          <Text style={styles.summaryLabel}>Remaining</Text>
        </View>
      </View>
      <Text style={styles.payrollLine}>Total payroll: {formatCurrency(totalPayroll)}</Text>

      {loading ? (
        <LoadingView message="Loading employees..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="account-tie"
          title={search ? 'No matching employees' : 'No employees yet'}
          message={
            search ? 'Try a different name or role.' : 'Add your first employee to track salaries.'
          }
          actionLabel={search ? undefined : 'Add Employee'}
          onAction={search ? undefined : openAdd}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEmployee}
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
              <Text style={styles.modalTitle}>New Employee</Text>
              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <InputField
                label="Name"
                value={form.name}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Employee name"
                disabled={saving}
              />
              <InputField
                label="Role / Designation"
                value={form.role}
                onChangeText={(v) => setForm((f) => ({ ...f, role: v }))}
                placeholder="e.g. Master, Karigar"
                disabled={saving}
              />
              <OptionGroup
                label="Common Roles"
                options={ROLE_OPTIONS}
                value={form.role}
                onChange={(v) => setForm((f) => ({ ...f, role: v }))}
                compact
              />
              <InputField
                label="Monthly Salary"
                value={form.salary}
                onChangeText={(v) => setForm((f) => ({ ...f, salary: v }))}
                placeholder="0"
                keyboardType="numeric"
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
                  title="Add Employee"
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
        title="Delete employee?"
        message={deleteTarget ? `"${deleteTarget.name}" will be removed permanently.` : ''}
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
  summaryCard: {
    flexDirection: 'row',
    margin: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
    ...theme.elevation.sm,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: theme.fontSize.lg, fontWeight: '800', color: theme.colors.primary },
  summaryLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  payrollLine: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  list: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xxl,
  },
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
  cardMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  salary: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  status: { fontSize: theme.fontSize.xs, fontWeight: '700', marginTop: 2 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
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