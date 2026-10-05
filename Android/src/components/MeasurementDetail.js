/**
 * Read-only presentation of a saved measurement record.
 *
 * Uses the same canonical structures as the desktop measurement preview:
 * basic ناپ rows + "Farmaish" (گلہ / بازو / پٹائی / پاکٹ / بٹن / کاج / سلائی /
 * شلوار / دامن) rows, plus special notes and the ثبت شدہ comment.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import { DetailRow, CardSectionTitle } from './UIComponents';
import { normalizeMeasurementData, getFarmaishRows } from '../utils/measurementUtils';
import { measurementRows } from '../constants/measurementFields';

export default function MeasurementDetail({ record }) {
  const details = normalizeMeasurementData(record?.measurements || record);
  const farmaish = getFarmaishRows(details);
  const notes = record?.comments || details.notes || '';
  const basicRows = measurementRows
    .map((row) => ({ ...row, value: details.measurements?.[row.key] }))
    .filter((row) => row.value !== undefined && row.value !== null && String(row.value).trim() !== '');

  return (
    <View>
      <View style={styles.card}>
        <CardSectionTitle>ناپ</CardSectionTitle>
        {basicRows.length === 0 ? (
          <Text style={styles.muted}>کوئی ناپ محفوظ نہیں</Text>
        ) : (
          basicRows.map((row, index) => (
            <DetailRow
              key={row.key}
              label={row.label}
              value={row.value}
              last={index === basicRows.length - 1}
            />
          ))
        )}
      </View>

      <View style={styles.card}>
        <CardSectionTitle>فرمائش / تفصیلات</CardSectionTitle>
        {farmaish.length === 0 ? (
          <Text style={styles.muted}>کوئی فرمائش محفوظ نہیں</Text>
        ) : (
          farmaish.map((row, index) => (
            <DetailRow
              key={`${row.label}-${index}`}
              label={row.label}
              value={row.value}
              last={index === farmaish.length - 1}
            />
          ))
        )}
      </View>

      {details.cloth_type ? (
        <View style={styles.card}>
          <CardSectionTitle>کپڑے کی قسم</CardSectionTitle>
          <Text style={styles.value}>{details.cloth_type}</Text>
        </View>
      ) : null}

      {notes ? (
        <View style={styles.card}>
          <CardSectionTitle>خصوصی نوٹس</CardSectionTitle>
          <Text style={styles.notes}>{notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.elevation.sm,
  },
  muted: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
  },
  value: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '600',
  },
  notes: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    lineHeight: 22,
  },
});
