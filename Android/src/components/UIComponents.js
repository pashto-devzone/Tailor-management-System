/**
 * Shared UI component system for the Tailor Management System Android app.
 *
 * Reusable, consistent visual primitives. Kept lightweight (react-native
 * primitives only) so the dependency footprint stays minimal and the app
 * works in Expo Go across many Android screen sizes.
 *
 * NOTE: This module previously referenced `styles.*` without ever defining the
 * StyleSheet, which caused a fatal "styles is not defined" ReferenceError on
 * the very first render (ScreenContainer). The complete stylesheet is defined
 * at the bottom of this file.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

// ==============================
// Layout helpers
// ==============================

/**
 * Scrollable screen container with safe keyboard handling.
 *
 * Pass `scroll={false}` for screens that render a FlatList/SectionList so the
 * inner list is not nested inside a ScrollView (which breaks virtualisation).
 */
export const ScreenContainer = ({
  children,
  style,
  contentStyle,
  scroll = true,
  refreshing = false,
  onRefresh,
}) => {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.accent]}
            tintColor={theme.colors.accent}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, style]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      {body}
    </KeyboardAvoidingView>
  );
};

/** Simple card wrapper used by customer/order/measurement cards. */
export const Card = ({ children, style }) => (
  <View style={[styles.card, theme.elevation.sm, style]}>{children}</View>
);

/** Section card used in Settings and detail views (collapsible). */
export const SectionCard = ({ title, children, style, collapsible = true }) => {
  const [open, setOpen] = React.useState(true);
  return (
    <View style={[styles.sectionCard, style]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => collapsible && setOpen((v) => !v)}
        activeOpacity={collapsible ? 0.7 : 1}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        {collapsible ? (
          <MaterialCommunityIcons
            name="chevron-down"
            size={20}
            color={theme.colors.textSecondary}
            style={{ transform: [{ rotate: open ? '0deg' : '-90deg' }] }}
          />
        ) : null}
      </TouchableOpacity>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
};

// ==============================
// Buttons
// ==============================

/** Primary action button (blue). */
export const PrimaryButton = ({ title, onPress, disabled, loading, style, small }) => (
  <TouchableOpacity
    style={[
      styles.primaryButton,
      small && styles.primaryButtonSmall,
      disabled && styles.buttonDisabled,
      style,
    ]}
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.8}
  >
    {loading ? (
      <ActivityIndicator size="small" color="#fff" />
    ) : (
      <Text style={styles.primaryButtonText}>{title}</Text>
    )}
  </TouchableOpacity>
);

/** Secondary / cancel button (outlined). */
export const SecondaryButton = ({
  title,
  onPress,
  disabled,
  style,
  onLongPress,
}) => (
  <TouchableOpacity
    style={[styles.secondaryButton, disabled && styles.buttonDisabled, style]}
    onPress={onPress}
    onLongPress={onLongPress}
    disabled={disabled}
    activeOpacity={0.75}
  >
    <Text style={styles.secondaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

/** Small inline chip-style button (used for card row actions). */
export const ChipButton = ({ title, onPress, disabled, tone = 'accent', style }) => {
  const toneStyle = {
    accent: styles.chipAccent,
    success: styles.chipSuccess,
    danger: styles.chipDanger,
  }[tone];
  const toneTextStyle = {
    accent: styles.chipAccentText,
    success: styles.chipSuccessText,
    danger: styles.chipDangerText,
  }[tone];
  return (
    <TouchableOpacity
      style={[styles.chipButton, toneStyle, disabled && styles.buttonDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={toneTextStyle}>{title}</Text>
    </TouchableOpacity>
  );
};

// ==============================
// Inputs
// ==============================

/** Labeled text input with optional show/hide password toggle. */
export const InputField = ({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  showPassword,
  onTogglePasswordVisibility,
  keyboardType,
  error,
  disabled,
  style,
  autoCapitalize = 'sentences',
  textContentType,
  maxLength,
  multiline,
  hint,
}) => {
  const showErr = error && error !== '';
  return (
    <View style={[styles.inputGroup, style]}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={[styles.inputWrapper, showErr && styles.inputWrapperError]}>
        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
            showErr && styles.inputError,
            secure && styles.inputWithToggle,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          secureTextEntry={secure && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textContentType={textContentType}
          maxLength={maxLength}
          editable={!disabled}
          multiline={multiline}
          autoCorrect={false}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => onTogglePasswordVisibility?.()}
            style={styles.inputToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.inputToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {hint && !showErr ? <Text style={styles.inputHint}>{hint}</Text> : null}
      {showErr ? <Text style={styles.inputErrorText}>{error}</Text> : null}
    </View>
  );
};

/** Reusable search bar. */
export const SearchBar = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  style,
}) => (
  <View style={[styles.searchBar, style]}>
    <MaterialCommunityIcons
      name="magnify"
      size={20}
      color={theme.colors.textTertiary}
      style={styles.searchBarIcon}
    />
    <TextInput
      style={styles.searchBarInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textTertiary}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
    />
    {value ? (
      <TouchableOpacity
        onPress={() => onChangeText('')}
        style={styles.searchBarClear}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons name="close" size={18} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    ) : null}
  </View>
);

// ==============================
// Measurement / option selectors
// ==============================

/**
 * Radio-style option group rendered as touch-friendly pills.
 * Mirrors the desktop `.radio-group` / `.radio-option` behaviour.
 */
export const OptionGroup = ({
  label,
  options = [],
  value,
  onChange,
  columns = 2,
  style,
  compact,
}) => (
  <View style={[styles.optionGroupWrap, style]}>
    {label ? <Text style={styles.optionGroupLabel}>{label}</Text> : null}
    <View style={styles.optionGroupGrid}>
      {options.map((option) => {
        const selected = value === option;
        return (
          <TouchableOpacity
            key={String(option)}
            style={[
              styles.optionPill,
              { width: columns >= 2 ? '48.5%' : '100%' },
              compact && styles.optionPillCompact,
              selected && styles.optionPillSelected,
            ]}
            onPress={() => onChange?.(option)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.optionPillText, selected && styles.optionPillTextSelected]}
              numberOfLines={2}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

/** Collapsed summary of a picked option with a "change" affordance. */
export const OptionSummary = ({ label, value, onChange }) => (
  <View style={styles.optionSummary}>
    <View style={styles.optionSummaryTextWrap}>
      {label ? <Text style={styles.optionSummaryLabel}>{label}</Text> : null}
      <Text style={styles.optionSummaryValue}>{value || 'کوئی انتخاب نہیں'}</Text>
    </View>
    <TouchableOpacity onPress={onChange} activeOpacity={0.7} style={styles.optionSummaryBtn}>
      <Text style={styles.optionSummaryBtnText}>تبدیل کریں</Text>
    </TouchableOpacity>
  </View>
);

/** Checkbox-style row (used for pocket options). */
export const CheckRow = ({ checked, onToggle, label, style }) => (
  <TouchableOpacity
    style={[styles.checkRow, style]}
    onPress={() => onToggle?.(!checked)}
    activeOpacity={0.7}
  >
    <View style={[styles.checkBox, checked && styles.checkBoxChecked]}>
      {checked ? (
        <MaterialCommunityIcons name="check" size={14} color="#fff" />
      ) : null}
    </View>
    <Text style={styles.checkRowLabel}>{label}</Text>
  </TouchableOpacity>
);

/** Segmented tab bar (Income / Expenses, order status filters, ...). */
export const SegmentedTabs = ({ tabs = [], active, onChange, style }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={[styles.segmentedWrap, style]}
    keyboardShouldPersistTaps="handled"
  >
    {tabs.map((tab) => {
      const isActive = active === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          style={[styles.segment, isActive && styles.segmentActive]}
          onPress={() => onChange?.(tab.key)}
          activeOpacity={0.75}
        >
          <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

/** Label/value row used in detail screens. */
export const DetailRow = ({ label, value, valueStyle, last }) => (
  <View style={[styles.detailRow, last && styles.detailRowLast]}>
    <Text style={styles.detailRowLabel}>{label}</Text>
    <Text style={[styles.detailRowValue, valueStyle]} numberOfLines={3}>
      {value === undefined || value === null || value === '' ? '-' : String(value)}
    </Text>
  </View>
);

/** Card section title used inside detail cards. */
export const CardSectionTitle = ({ children, style }) => (
  <Text style={[styles.cardSectionTitle, style]}>{children}</Text>
);

// ==============================
// Status components
// ==============================

export const LoadingView = ({ message, fullScreen = false }) =>
  fullScreen ? (
    <View style={styles.fullScreenLoading}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      {message ? <Text style={styles.fullScreenLoadingMessage}>{message}</Text> : null}
    </View>
  ) : (
    <View style={styles.loadingGroup}>
      <ActivityIndicator size="small" color={theme.colors.accent} />
      {message ? <Text style={styles.loadingMessage}>{message}</Text> : null}
    </View>
  );

/**
 * Empty state with a professional icon (MaterialCommunityIcons glyph NAME,
 * e.g. "package-variant"), title, message and an optional action button.
 */
export const EmptyState = ({ icon, title, message, actionLabel, onAction }) => (
  <View style={styles.emptyState}>
    <View style={styles.emptyStateIconWrap}>
      <MaterialCommunityIcons
        name={icon || 'inbox'}
        size={34}
        color={theme.colors.primary}
      />
    </View>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    {message ? <Text style={styles.emptyStateMessage}>{message}</Text> : null}
    {actionLabel ? (
      <TouchableOpacity
        style={styles.emptyStateAction}
        onPress={onAction}
        activeOpacity={0.75}
      >
        <Text style={styles.emptyStateActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const ErrorState = ({ message, onRetry }) => (
  <View style={styles.errorState}>
    <View style={styles.errorStateIconWrap}>
      <MaterialCommunityIcons name="alert-circle" size={34} color={theme.colors.error} />
    </View>
    <Text style={styles.errorStateTitle}>Something went wrong</Text>
    <Text style={styles.errorStateMessage}>{message}</Text>
    {onRetry ? (
      <TouchableOpacity style={styles.errorStateRetry} onPress={onRetry} activeOpacity={0.75}>
        <Text style={styles.errorStateRetryText}>Try again</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

/** Inline dismissible message banner. */
export const Banner = ({ message, tone = 'error', onDismiss, style }) => {
  if (!message) return null;
  const tones = {
    error: { bg: theme.colors.errorBg, text: theme.colors.error },
    success: { bg: theme.colors.successBg, text: theme.colors.success },
    info: { bg: theme.colors.infoBg, text: theme.colors.accentDark },
    warning: { bg: theme.colors.warningBg, text: theme.colors.warning },
  };
  const palette = tones[tone] || tones.error;
  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: palette.bg }, style]}
      activeOpacity={onDismiss ? 0.8 : 1}
      onPress={onDismiss}
    >
      <Text style={[styles.bannerText, { color: palette.text }]}>{message}</Text>
    </TouchableOpacity>
  );
};

/** Confirm dialog shown above the screen content. */
export const ConfirmDialog = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
}) => {
  if (!visible) return null;
  return (
    <View style={styles.dialogOverlay}>
      <View style={styles.dialogCard}>
        <Text style={styles.dialogTitle}>{title}</Text>
        {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
        <View style={styles.dialogActions}>
          <TouchableOpacity
            style={styles.dialogCancelButton}
            onPress={onCancel}
            activeOpacity={0.75}
          >
            <Text style={styles.dialogCancelText}>{cancelLabel || 'Cancel'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              destructive ? styles.dialogConfirmButtonDestructive : styles.dialogConfirmButton,
            ]}
            onPress={onConfirm}
            activeOpacity={0.75}
          >
            <Text style={styles.dialogConfirmText}>{confirmLabel || 'Confirm'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

/** Simple app header used by select screens. */
export const AppHeader = ({ title, right }) => (
  <View style={styles.appHeader}>
    <Text style={styles.appHeaderTitle}>{title}</Text>
    {right}
  </View>
);

/** Bottom navigation bar used by the tab navigator. */
export const BottomBar = ({ state, navigation, tabs = [] }) => (
  <View style={styles.bottomBar}>
    {tabs.map((tab) => {
      const isFocused =
        state?.routes?.[state.index]?.name === tab.key;
      return (
        <TouchableOpacity
          key={tab.key}
          style={[styles.bottomTab, isFocused && styles.bottomTabActive]}
          onPress={() => navigation?.navigate(tab.key)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={tab.label}
        >
          <Text style={[styles.bottomTabIcon, isFocused && styles.bottomTabIconActive]}>
            {tab.icon}
          </Text>
          <Text style={[styles.bottomTabLabel, isFocused && styles.bottomTabLabelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

// ==============================
// Styles
// ==============================

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },

  // Card
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  // Collapsible section card
  sectionCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.cardAlt,
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  sectionChevron: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  sectionBody: {
    padding: theme.spacing.md,
  },

  // Buttons
  buttonDisabled: { opacity: 0.55 },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonSmall: { paddingVertical: 9, paddingHorizontal: theme.spacing.md },
  primaryButtonText: {
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.accentDark,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.accentDark,
    fontSize: theme.fontSize.base,
    fontWeight: '600',
  },
  chipButton: {
    borderRadius: theme.radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginLeft: theme.spacing.sm,
  },
  chipAccent: { backgroundColor: theme.colors.infoBg },
  chipAccentText: {
    color: theme.colors.accentDark,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
  },
  chipSuccess: { backgroundColor: theme.colors.successBg },
  chipSuccessText: {
    color: theme.colors.success,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
  },
  chipDanger: { backgroundColor: theme.colors.errorBg },
  chipDangerText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: theme.fontSize.xs,
  },

  // Inputs
  inputGroup: { marginBottom: theme.spacing.md },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  inputWrapperError: { borderColor: theme.colors.error },
  input: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 },
  inputError: { color: theme.colors.text },
  inputWithToggle: { paddingRight: 4 },
  inputToggle: { paddingHorizontal: theme.spacing.md, paddingVertical: 12 },
  inputToggleText: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  inputHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    marginTop: 4,
  },
  inputErrorText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.error,
    marginTop: 4,
    fontWeight: '600',
  },

  // Search bar
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    height: 44,
  },
  searchBarIcon: { fontSize: 15, marginRight: 6 },
  searchBarInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    paddingVertical: 8,
  },
  searchBarClear: { paddingHorizontal: 6 },
  searchBarClearText: { color: theme.colors.textTertiary, fontSize: 14 },

  // Option pills (measurement choices)
  optionGroupWrap: { marginBottom: theme.spacing.sm },
  optionGroupLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  optionGroupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionPill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  optionPillCompact: { minHeight: 34, paddingVertical: 6 },
  optionPillSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.infoBg,
  },
  optionPillText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    textAlign: 'center',
  },
  optionPillTextSelected: { color: theme.colors.accentDark, fontWeight: '700' },

  // Option summary
  optionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  optionSummaryTextWrap: { flex: 1 },
  optionSummaryLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  optionSummaryValue: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
  },
  optionSummaryBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  optionSummaryBtnText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.accent,
    fontWeight: '700',
  },

  // Checkbox row
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  checkBoxChecked: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  checkBoxMark: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  checkRowLabel: {
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '500',
  },

  // Segmented tabs
  segmentedWrap: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.cardAlt,
  },
  segmentActive: { backgroundColor: theme.colors.accent },
  segmentText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  segmentTextActive: { color: '#fff', fontWeight: '700' },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailRowLabel: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    paddingRight: theme.spacing.sm,
  },
  detailRowValue: {
    flex: 1.3,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
    textAlign: 'right',
  },
  cardSectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },

  // Loading
  fullScreenLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  fullScreenLoadingMessage: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  loadingGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingMessage: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyStateTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyStateAction: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 11,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateActionText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.sm },

  // Error
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  errorStateIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  errorStateTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  errorStateMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  errorStateRetry: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: 11,
    paddingHorizontal: theme.spacing.lg,
  },
  errorStateRetryText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.sm },

  // Banner
  banner: {
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  bannerText: { fontSize: theme.fontSize.sm, fontWeight: '600' },

  // Dialog
  dialogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  dialogCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  dialogTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
  },
  dialogMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.lg,
  },
  dialogCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginRight: theme.spacing.sm,
  },
  dialogCancelText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  dialogConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  dialogConfirmButtonDestructive: {
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error,
  },
  dialogConfirmText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.sm },

  // App header
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  appHeaderTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingVertical: 6,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  bottomTabActive: {},
  bottomTabIcon: { fontSize: 18 },
  bottomTabIconActive: {},
  bottomTabLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    marginTop: 2,
    fontWeight: '600',
  },
  bottomTabLabelActive: { color: theme.colors.accent },
});