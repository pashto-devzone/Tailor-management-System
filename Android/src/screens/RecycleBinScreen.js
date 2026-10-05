/**
 * Recycle bin — soft-deleted customers, orders and measurements.
 *
 * Same backend contract as the desktop RecycleBinSection:
 *   GET    /api/recycle-bin?type=all&q=      -> list with days_remaining
 *   POST   /api/recycle-bin/:type/:id/restore
 *   DELETE /api/recycle-bin/:type/:id        -> permanent delete
 *   POST   /api/recycle-bin/cleanup          -> purge items older than 30 days
 *
 * The server keeps items for 30 days and purges them automatically.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { theme } from '../constants/theme';
import {
  SearchBar,
  SegmentedTabs,
  LoadingView,
  EmptyState,
  ErrorState,
  ConfirmDialog,
  ChipButton,
} from '../components/UIComponents';
import {
  getRecycleBin,
  restoreRecycleBinItem,
  deleteRecycleBinItemForever,
  cleanupRecycleBin,
  getFriendlyError,
} from '../services/api';
import { formatDate } from '../utils/date';

// Backend list `type` values -> plural lowercase form used by restore/delete.
const TYPE_MAP = {
  Customer: 'customers',
  Order: 'orders',
  Measurement: 'measurements',
};

const TYPE_LABELS = {
  Customer: 'Customer',
  Order: 'Order',
  Measurement: 'Measurement',
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'customers', label: 'Customers' },
  { key: 'orders', label: 'Orders' },
  { key: 'measurements', label: 'Measurements' },
];

export default function RecycleBinScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState('');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await getRecycleBin({ type: typeFilter, q: search.trim() || undefined });
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        setError(getFriendlyError(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [typeFilter, search]
  );

  // Debounced search: the backend accepts `q`.
  useEffect(() => {
    const timer = setTimeout(() => {
      load(true);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const counts = useMemo(
    () => ({
      total: items.length,
      customers: items.filter((i) => i.type === 'Customer').length,
      orders: items.filter((i) => i.type === 'Order').length,
      measurements: items.filter((i) => i.type === 'Measurement').length,
    }),
    [items]
  );

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      const plural = TYPE_MAP[restoreTarget.type] || restoreTarget.type;
      await restoreRecycleBinItem(plural, restoreTarget.id);
      setBanner(`${restoreTarget.type} restored successfully.`);
      setRestoreTarget(null);
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
      setRestoreTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteForever = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const plural = TYPE_MAP[deleteTarget.type] || deleteTarget.type;
      await deleteRecycleBinItemForever(plural, deleteTarget.id);
      setBanner(`${deleteTarget.type} permanently deleted.`);
      setDeleteTarget(null);
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCleanup = async () => {
    setBusy(true);
    try {
      await cleanupRecycleBin();
      setBanner('Cleanup completed — expired items removed.');
      load(true);
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const renderItem = ({ item }) => {
    const title =
      item.type === 'Order' && item.order_number
        ? `#${item.order_number} · ${item.name}`
        : item.name || '-';
    const days = item.days_remaining;
    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.typeBadge, styles[`badge_${item.type}`]]}>
            <Text style={styles.typeBadgeText}>{TYPE_LABELS[item.type] || item.type}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.phone || 'No phone'} · Deleted {formatDate(item.deleted_at)}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.daysLine,
            {
              color:
                days == null
                  ? theme.colors.textTertiary
                  : days <= 5
                    ? theme.colors.error
                    : theme.colors.textSecondary,
            },
          ]}
        >
          {days == null
            ? 'Purges automatically'
            : days === 0
              ? 'Purges today'
              : `${days} day${days === 1 ? '' : 's'} left before permanent deletion`}
        </Text>

        <View style={styles.cardActions}>
          <ChipButton
            title={busy ? '...' : 'Restore'}
            tone="success"
            onPress={() => setRestoreTarget(item)}
            disabled={busy}
          />
          <ChipButton
            title="Delete Forever"
            tone="danger"
            onPress={() => setDeleteTarget(item)}
            disabled={busy}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      <View style={styles.searchRow}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search recycle bin..." />
        <TouchableOpacity
          style={[styles.cleanButton, busy && styles.buttonDisabled]}
          onPress={handleCleanup}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={styles.cleanButtonText}>Clean</Text>
        </TouchableOpacity>
      </View>

      <SegmentedTabs
        tabs={FILTERS.map((f) => ({ key: f.key, label: f.label }))}
        active={typeFilter}
        onChange={setTypeFilter}
      />

      <Text style={styles.summaryLine}>
        {counts.total} item{counts.total === 1 ? '' : 's'} · {counts.customers} customers ·{' '}
        {counts.orders} orders · {counts.measurements} measurements
      </Text>

      {banner ? <Text style={styles.bannerOk}>{banner}</Text> : null}
      {error ? <Text style={styles.bannerError}>{error}</Text> : null}

      {loading ? (
        <LoadingView message="Loading recycle bin..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="trash-can"
          title={search ? 'Nothing matches' : 'Recycle bin is empty'}
          message={
            search
              ? 'Try a different search.'
              : 'Deleted customers, orders and measurements stay here for 30 days.'
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.type}-${item.id}`}
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

      <ConfirmDialog
        visible={!!restoreTarget}
        title="Restore item?"
        message={
          restoreTarget
            ? `This ${restoreTarget.type.toLowerCase()} will be returned to your shop data.`
            : ''
        }
        confirmLabel={busy ? 'Restoring...' : 'Restore'}
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete forever?"
        message={
          deleteTarget
            ? `This ${deleteTarget.type.toLowerCase()} will be permanently deleted. This cannot be undone.`
            : ''
        }
        confirmLabel={busy ? 'Deleting...' : 'Delete Forever'}
        destructive
        onConfirm={handleDeleteForever}
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
  cleanButton: {
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.colors.cardAlt,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanButtonText: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: theme.fontSize.sm,
  },
  buttonDisabled: { opacity: 0.55 },
  summaryLine: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  bannerOk: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.successBg,
    color: theme.colors.success,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  bannerError: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.errorBg,
    color: theme.colors.error,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
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
  typeBadge: {
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginRight: theme.spacing.sm,
  },
  badge_Customer: { backgroundColor: theme.colors.infoBg },
  badge_Order: { backgroundColor: theme.colors.pendingBg },
  badge_Measurement: { backgroundColor: theme.colors.deliveredBg },
  typeBadgeText: { fontSize: theme.fontSize.xs, fontWeight: '700', color: theme.colors.text },
  cardInfo: { flex: 1 },
  cardName: { fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text },
  cardMeta: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary, marginTop: 2 },
  daysLine: { fontSize: theme.fontSize.xs, fontWeight: '600', marginTop: theme.spacing.sm },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});