/**
 * Dashboard — real backend data only.
 *
 *   GET /api/customers        -> customers count
 *   GET /api/orders           -> orders count, pending/ready/delivered, recent orders
 *   GET /api/budget/income    -> income total
 *   GET /api/budget/expenses  -> expense total
 *
 * Every figure is computed from data the backend already returns — no invented
 * numbers and no client-side database.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { LoadingView, ErrorState, EmptyState } from '../components/UIComponents';
import {
  getCustomers,
  getOrders,
  getIncome,
  getExpenses,
  getFriendlyError,
} from '../services/api';
import { ORDER_STATUS_CONFIG } from '../constants/orderStatus';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard statistic card — white surface, subtle border/shadow, blue icon,
 * dark-blue number and gray label. Colour is used only on the icon, never as
 * a full-card background, so the dashboard reads as one calm design system.
 */
const StatCard = ({ icon, label, value }) => (
  <View style={[styles.statCard, theme.elevation.sm]}>
    <View style={styles.statIconWrap}>
      <MaterialCommunityIcons name={icon} size={16} color={theme.colors.primary} />
    </View>
    <Text style={styles.statValue} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statLabel} numberOfLines={1}>
      {label}
    </Text>
  </View>
);

/** Financial summary card (same visual language as StatCard). */
const MoneyCard = ({ icon, label, value, tone = 'primary' }) => {
  const tint = {
    primary: { bg: theme.colors.primaryLight, color: theme.colors.primary },
    success: { bg: theme.colors.successBg, color: theme.colors.success },
    danger: { bg: theme.colors.errorBg, color: theme.colors.error },
  }[tone] || { bg: theme.colors.primaryLight, color: theme.colors.primary };
  return (
    <View style={[styles.moneyCard, theme.elevation.sm]}>
      <View style={[styles.statIconWrap, { backgroundColor: tint.bg }]}>
        <MaterialCommunityIcons name={icon} size={16} color={tint.color} />
      </View>
      <Text style={styles.moneyValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.moneyLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [partialError, setPartialError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    setPartialError('');
    let incomeFailed = false;
    let expenseFailed = false;
    try {
      const [customersRes, ordersRes, incomeRes, expensesRes] = await Promise.all([
        getCustomers(),
        getOrders(),
        getIncome().catch(() => {
          incomeFailed = true;
          return { data: [] };
        }),
        getExpenses().catch(() => {
          expenseFailed = true;
          return { data: [] };
        }),
      ]);
      setCustomers(Array.isArray(customersRes.data) ? customersRes.data : []);
      setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
      setIncome(Array.isArray(incomeRes.data) ? incomeRes.data : []);
      setExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : []);
      if (incomeFailed || expenseFailed) {
        setPartialError('Some financial figures could not be loaded.');
      }
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

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'pending').length;
    const ready = orders.filter((o) => o.status === 'ready').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    const billed = orders.reduce((sum, o) => sum + Number(o.total_amount ?? o.price ?? 0), 0);
    const collected = orders.reduce(
      (sum, o) => sum + Number(o.paid_amount ?? o.advance ?? 0),
      0
    );
    const outstanding = Math.max(billed - collected, 0);
    const totalIncome = income.reduce((sum, i) => sum + Number(i.amount ?? 0), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
    return {
      pending,
      ready,
      delivered,
      billed,
      collected,
      outstanding,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
    };
  }, [orders, income, expenses]);

  const recentOrders = orders.slice(0, 5);

  // DashboardScreen is a DIRECT screen of the Tab navigator, so `navigation`
  // already belongs to the Tab navigator and can reach every tab by name.
  // Calling getParent() here would return the ROOT stack (which only knows
  // "Main"/"Auth"), so every quick action would fail with
  // "The action 'NAVIGATE' ... was not handled by any navigator".
  const goToTab = (tabName, params) => {
    navigation.navigate(tabName, params);
  };

  const openNewOrder = () =>
    goToTab('Orders', { screen: 'OrdersList', params: { openNew: Date.now() } });
  const openOrder = (id) =>
    goToTab('Orders', { screen: 'OrderDetails', params: { orderId: id } });

  if (loading) {
    return (
      <View style={styles.flex}>
        <LoadingView message="Loading dashboard..." />
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
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
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
      <View style={styles.greeting}>
        <Text style={styles.greetingHello}>Assalam-o-Alaikum</Text>
        <Text style={styles.greetingName}>{user?.name || 'Owner'}</Text>
        {user?.shopName ? <Text style={styles.shopName}>{user.shopName}</Text> : null}
      </View>

      {partialError ? <Text style={styles.partialError}>{partialError}</Text> : null}

      <View style={styles.statsGrid}>
        <StatCard icon="account-group" label="Customers" value={String(customers.length)} />
        <StatCard icon="clipboard-text" label="Total Orders" value={String(orders.length)} />
        <StatCard icon="clock-outline" label="Pending" value={String(stats.pending)} />
        <StatCard icon="check-circle-outline" label="Ready" value={String(stats.ready)} />
        <StatCard icon="truck-check" label="Delivered" value={String(stats.delivered)} />
        <StatCard
          icon="cash-check"
          label="Outstanding"
          value={formatCurrency(stats.outstanding)}
        />
      </View>

      <Text style={styles.sectionTitle}>Financial Summary</Text>
      <View style={styles.moneyRow}>
        <MoneyCard
          icon="trending-up"
          label="Income"
          value={formatCurrency(stats.totalIncome)}
          tone="success"
        />
        <MoneyCard
          icon="trending-down"
          label="Expenses"
          value={formatCurrency(stats.totalExpenses)}
          tone="danger"
        />
      </View>
      <View style={styles.moneyRow}>
        <MoneyCard
          icon="cash-multiple"
          label="Collected on Orders"
          value={formatCurrency(stats.collected)}
        />
        <MoneyCard
          icon="chart-line"
          label="Net (Income − Expenses)"
          value={formatCurrency(stats.net)}
          tone={stats.net >= 0 ? 'primary' : 'danger'}
        />
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnPrimary, theme.elevation.sm]}
          activeOpacity={0.85}
          onPress={openNewOrder}
        >
          <MaterialCommunityIcons name="plus-circle" size={22} color="#fff" />
          <Text style={[styles.quickBtnText, styles.quickBtnTextOnPrimary]}>New Order</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnLight, theme.elevation.sm]}
          activeOpacity={0.85}
          onPress={() => goToTab('Customers', { screen: 'CustomersList' })}
        >
          <MaterialCommunityIcons
            name="account-group"
            size={22}
            color={theme.colors.primary}
          />
          <Text style={styles.quickBtnText}>Customers</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnLight, theme.elevation.sm]}
          activeOpacity={0.85}
          onPress={() => goToTab('Measurements')}
        >
          <MaterialCommunityIcons name="ruler" size={22} color={theme.colors.primary} />
          <Text style={styles.quickBtnText}>Measurements</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnLight, theme.elevation.sm]}
          activeOpacity={0.85}
          onPress={() => goToTab('More', { screen: 'Finance' })}
        >
          <MaterialCommunityIcons name="wallet" size={22} color={theme.colors.primary} />
          <Text style={styles.quickBtnText}>Income & Expenses</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Recent Orders</Text>
      {recentOrders.length === 0 ? (
        <EmptyState
          icon="package-variant"
          title="No orders yet"
          message="Create your first order to see it here."
          actionLabel="New Order"
          onAction={openNewOrder}
        />
      ) : (
        recentOrders.map((order) => {
          const cfg = ORDER_STATUS_CONFIG[order.status] || null;
          const total = Number(order.total_amount ?? order.price ?? 0);
          const paid = Number(order.paid_amount ?? order.advance ?? 0);
          const remaining = Math.max(total - paid, 0);
          return (
            <TouchableOpacity
              key={String(order.id)}
              style={styles.orderCard}
              activeOpacity={0.75}
              onPress={() => openOrder(order.id)}
            >
              <View style={styles.orderTop}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderName} numberOfLines={1}>
                    #{order.order_number || order.id} · {order.customer_name || 'Customer'}
                  </Text>
                  <Text style={styles.orderMeta} numberOfLines={1}>
                    {order.dress_type || '-'} · Due {formatDate(order.delivery_date)}
                  </Text>
                </View>
                {cfg ? (
                  <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.badgeText, { color: cfg.color }]}>
                      {cfg.label}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.orderBalance}>
                Balance:{' '}
                <Text
                  style={{
                    color: remaining > 0 ? theme.colors.error : theme.colors.success,
                    fontWeight: '700',
                  }}
                >
                  {formatCurrency(remaining)}
                </Text>
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  greeting: { marginBottom: theme.spacing.md },
  greetingHello: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  greetingName: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    color: theme.colors.textHeading,
    marginTop: 2,
  },
  shopName: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  partialError: {
    backgroundColor: theme.colors.warningBg,
    color: theme.colors.warning,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48.5%',
    minHeight: 104,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moneyCard: {
    flex: 1,
    minHeight: 104,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginHorizontal: 4,
    marginBottom: theme.spacing.sm,
  },
  moneyValue: {
    fontSize: theme.fontSize.base,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  moneyLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  quickBtn: {
    flex: 1,
    minHeight: 76,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    marginHorizontal: 4,
  },
  quickBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  quickBtnLight: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickBtnText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.textHeading,
    marginTop: 6,
    textAlign: 'center',
  },
  quickBtnTextOnPrimary: { color: '#ffffff' },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.textHeading,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  orderCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.elevation.sm,
  },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start' },
  orderInfo: { flex: 1, paddingRight: theme.spacing.sm },
  orderName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  orderMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  badge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: theme.fontSize.xs, fontWeight: '700' },
  orderBalance: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 6 },
});