/**
 * Full measurement editor.
 *
 * This reproduces the desktop `MeasurementModal.jsx` field-by-field so the
 * Android app writes the SAME `measurements` JSONB structure the backend stores
 * and the desktop app reads:
 *
 *   ناپ (10 numeric fields) · گلہ (کالر/بین + types + sizes) · دامن · پاکٹ
 *   بٹن ڈیزائن · کاج ڈیزائن · بازو (کف: type/size/motai/extra/comment) ·
 *   پٹائی · سلائی (واٹس ایپ) · شلوار · نوٹس
 *
 * Nothing is simplified or dropped.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../constants/theme';
import {
  InputField,
  OptionGroup,
  OptionSummary,
  CheckRow,
  CardSectionTitle,
} from './UIComponents';
import {
  galaOptions,
  collarTypes,
  collarSizes,
  bainTypes,
  bainSizes,
  damanOptions,
  bazuDesigns,
  bazuSizes,
  cuffTypes,
  cuffSizes,
  cuffMotaiOptions,
  pataiOptions,
  silaiOptions,
  shalwarOptions,
  buttonDesignOptions,
  kaajDesignOptions,
  pocketSideCountOptions,
  shalwarPocketOptions,
  measurementRows,
} from '../constants/measurementFields';

const buildVisibility = (d) => ({
  gala: !d.gala?.type,
  collarType: !(d.gala?.type === 'کالر' && d.gala?.collar_type),
  collarSize: !(d.gala?.type === 'کالر' && d.gala?.collar_size),
  bainType: !(d.gala?.type === 'بین' && d.gala?.bain_type),
  bainSize: !(d.gala?.type === 'بین' && d.gala?.bain_size),
  daaman: !d.daaman?.type,
  pocket: !(
    d.pocket?.front ||
    d.pocket?.side ||
    d.pocket?.front_details ||
    d.pocket?.side_count ||
    d.pocket?.side_details
  ),
  pocketSideCount: !(d.pocket?.side && d.pocket?.side_count),
  baazoo: !d.baazoo?.design,
  baazooSize: !d.baazoo?.size,
  baazooCuffType: !d.baazoo?.cuff_type,
  baazooCuffSize: !d.baazoo?.cuff_size,
  baazooCuffMotai: !d.baazoo?.cuff_motai,
  patai: !d.patai?.type,
  silai: !d.silai?.type,
  shalwar: !d.shalwar?.style,
  shalwarAdditionalPocket: !d.shalwar?.additional_pocket,
  buttonDesign: !d.button_design?.type,
  kaajDesign: !d.kaaj_design?.type,
});

export default function MeasurementForm({ details, onChange }) {
  const d = details;
  // Option groups start expanded (desktop behaviour). The parent remounts this
  // component (via a `key`) whenever a different record is loaded, so this state
  // intentionally does not resync on every keystroke.
  const [show, setShow] = React.useState(() => buildVisibility(details));

  const reveal = (key, value = true) => setShow((prev) => ({ ...prev, [key]: value }));

  const setBasic = (key, value) =>
    onChange({ ...d, measurements: { ...d.measurements, [key]: value } });

  const setGroup = (group, key, value) =>
    onChange({ ...d, [group]: { ...(d[group] || {}), [key]: value } });

  const setFlat = (key, value) => onChange({ ...d, [key]: value });

  return (
    <View>
      {/* ================= ناپ ================= */}
      <View style={styles.section}>
        <CardSectionTitle>ناپ</CardSectionTitle>
        <View style={styles.grid}>
          {measurementRows.map((row) => (
            <View key={row.key} style={styles.half}>
              <InputField
                label={row.label}
                value={String(d.measurements?.[row.key] ?? '')}
                onChangeText={(v) => setBasic(row.key, v)}
                placeholder="انچ"
                keyboardType="numeric"
              />
            </View>
          ))}
        </View>
      </View>

      {/* ================= گلہ ================= */}
      <View style={styles.section}>
        <CardSectionTitle>گلہ</CardSectionTitle>
        {show.gala ? (
          <OptionGroup
            options={galaOptions}
            value={d.gala?.type}
            onChange={(v) => {
              setGroup('gala', 'type', v);
              setGroup('gala', 'collar_type', '');
              setGroup('gala', 'collar_size', '');
              setGroup('gala', 'bain_type', '');
              setGroup('gala', 'bain_size', '');
              reveal('gala', false);
              if (v === 'کالر') {
                reveal('collarType', true);
                reveal('collarSize', true);
              } else if (v === 'بین') {
                reveal('bainType', true);
                reveal('bainSize', true);
              }
            }}
          />
        ) : (
          <OptionSummary
            label="گلہ"
            value={d.gala?.type}
            onChange={() => reveal('gala')}
          />
        )}

        {d.gala?.type === 'کالر' ? (
          <View style={styles.sub}>
            {show.collarType ? (
              <OptionGroup
                label="کالر ٹائپ"
                options={collarTypes}
                value={d.gala?.collar_type}
                onChange={(v) => {
                  setGroup('gala', 'collar_type', v);
                  setGroup('gala', 'collar_size', v === 'چھوٹا کالر' ? '' : d.gala?.collar_size || '');
                  reveal('collarType', false);
                  if (v !== 'چھوٹا کالر') reveal('collarSize', true);
                }}
              />
            ) : (
              <OptionSummary
                label="کالر ٹائپ"
                value={d.gala?.collar_type}
                onChange={() => reveal('collarType')}
              />
            )}

            {d.gala?.collar_type && d.gala.collar_type !== 'چھوٹا کالر' ? (
              show.collarSize ? (
                <OptionGroup
                  label="کالر سائز"
                  options={collarSizes}
                  value={d.gala?.collar_size}
                  onChange={(v) => {
                    setGroup('gala', 'collar_size', v);
                    reveal('collarSize', false);
                  }}
                />
              ) : (
                <OptionSummary
                  label="کالر سائز"
                  value={d.gala?.collar_size}
                  onChange={() => reveal('collarSize')}
                />
              )
            ) : null}
          </View>
        ) : null}

        {d.gala?.type === 'بین' ? (
          <View style={styles.sub}>
            {show.bainType ? (
              <OptionGroup
                label="بین ٹائپ"
                options={bainTypes}
                value={d.gala?.bain_type}
                onChange={(v) => {
                  setGroup('gala', 'bain_type', v);
                  reveal('bainType', false);
                  reveal('bainSize', true);
                }}
              />
            ) : (
              <OptionSummary
                label="بین ٹائپ"
                value={d.gala?.bain_type}
                onChange={() => reveal('bainType')}
              />
            )}

            {show.bainSize ? (
              <OptionGroup
                label="بین سائز"
                options={bainSizes}
                value={d.gala?.bain_size}
                onChange={(v) => {
                  setGroup('gala', 'bain_size', v);
                  reveal('bainSize', false);
                }}
              />
            ) : (
              <OptionSummary
                label="بین سائز"
                value={d.gala?.bain_size}
                onChange={() => reveal('bainSize')}
              />
            )}
          </View>
        ) : null}
      </View>

      {/* ================= دامن ================= */}
      <View style={styles.section}>
        <CardSectionTitle>دامن</CardSectionTitle>
        {show.daaman ? (
          <OptionGroup
            options={damanOptions}
            value={d.daaman?.type}
            onChange={(v) => {
              setGroup('daaman', 'type', v);
              reveal('daaman', false);
            }}
          />
        ) : (
          <OptionSummary label="دامن" value={d.daaman?.type} onChange={() => reveal('daaman')} />
        )}
      </View>

      {/* ================= پاکٹ ================= */}
      <View style={styles.section}>
        <CardSectionTitle>پاکٹ</CardSectionTitle>
        {show.pocket ? (
          <>
            <CheckRow
              label="سامنے پاکٹ"
              checked={Boolean(d.pocket?.front)}
              onToggle={(next) => {
                setGroup('pocket', 'front', next);
                if (!next) setGroup('pocket', 'front_details', '');
                reveal('pocket', true);
              }}
            />
            {d.pocket?.front ? (
              <InputField
                label="سامنے پاکٹ تفصیل"
                value={d.pocket?.front_details || ''}
                onChangeText={(v) => setGroup('pocket', 'front_details', v)}
                placeholder="تفصیل لکھیں..."
              />
            ) : null}

            <CheckRow
              label="سائیڈ پاکٹ"
              checked={Boolean(d.pocket?.side)}
              onToggle={(next) => {
                setGroup('pocket', 'side', next);
                if (!next) {
                  setGroup('pocket', 'side_count', '');
                  setGroup('pocket', 'side_details', '');
                }
                reveal('pocket', true);
                reveal('pocketSideCount', true);
              }}
            />

            {d.pocket?.side ? (
              <>
                {show.pocketSideCount ? (
                  <OptionGroup
                    label="سائیڈ پاکٹ تعداد"
                    options={pocketSideCountOptions}
                    compact
                    value={
                      d.pocket?.side_count
                        ? `${d.pocket.side_count} سائیڈ پاکٹ`
                        : ''
                    }
                    onChange={(v) => {
                      setGroup('pocket', 'side_count', v.startsWith('1') ? '1' : '2');
                      reveal('pocketSideCount', false);
                      reveal('pocket', false);
                    }}
                  />
                ) : (
                  <OptionSummary
                    label="سائیڈ پاکٹ تعداد"
                    value={d.pocket?.side_count ? `${d.pocket.side_count} سائیڈ پاکٹ` : ''}
                    onChange={() => reveal('pocketSideCount')}
                  />
                )}
                <InputField
                  label="اضافی تفصیل"
                  value={d.pocket?.side_details || ''}
                  onChangeText={(v) => setGroup('pocket', 'side_details', v)}
                  placeholder="تفصیل لکھیں..."
                />
              </>
            ) : null}
          </>
        ) : (
          <OptionSummary
            label="پاکٹ"
            value={[
              d.pocket?.front ? 'سامنے پاکٹ' : '',
              d.pocket?.side
                ? d.pocket?.side_count
                  ? `${d.pocket.side_count} سائیڈ پاکٹ`
                  : 'سائیڈ پاکٹ'
                : '',
            ]
              .filter(Boolean)
              .join(' / ') || ''}
            onChange={() => reveal('pocket')}
          />
        )}
      </View>

      {/* ================= بٹن ڈیزائن ================= */}
      <View style={styles.section}>
        <CardSectionTitle>بٹن ڈیزائن</CardSectionTitle>
        {show.buttonDesign ? (
          <OptionGroup
            options={buttonDesignOptions}
            value={d.button_design?.type}
            onChange={(v) => {
              setGroup('button_design', 'type', v);
              reveal('buttonDesign', false);
            }}
          />
        ) : (
          <OptionSummary
            label="بٹن ڈیزائن"
            value={d.button_design?.type}
            onChange={() => reveal('buttonDesign')}
          />
        )}
        <InputField
          label="کمنٹس"
          value={d.button_design?.comment || ''}
          onChangeText={(v) => setGroup('button_design', 'comment', v)}
          placeholder="بٹن ڈیزائن کے لیے کمنٹس"
        />
      </View>

      {/* ================= کاج ڈیزائن ================= */}
      <View style={styles.section}>
        <CardSectionTitle>کاج ڈیزائن</CardSectionTitle>
        {show.kaajDesign ? (
          <OptionGroup
            options={kaajDesignOptions}
            value={d.kaaj_design?.type}
            onChange={(v) => {
              setGroup('kaaj_design', 'type', v);
              reveal('kaajDesign', false);
            }}
          />
        ) : (
          <OptionSummary
            label="کاج ڈیزائن"
            value={d.kaaj_design?.type}
            onChange={() => reveal('kaajDesign')}
          />
        )}
        <InputField
          label="کمنٹس"
          value={d.kaaj_design?.comment || ''}
          onChangeText={(v) => setGroup('kaaj_design', 'comment', v)}
          placeholder="کاج ڈیزائن کے لیے کمنٹس"
        />
      </View>

      {/* ================= بازو ================= */}
      <View style={styles.section}>
        <CardSectionTitle>بازو</CardSectionTitle>
        {show.baazoo ? (
          <OptionGroup
            options={bazuDesigns}
            value={d.baazoo?.design}
            onChange={(v) => {
              setGroup('baazoo', 'design', v);
              setGroup('baazoo', 'size', '');
              setGroup('baazoo', 'extra', '');
              setGroup('baazoo', 'cuff_type', '');
              setGroup('baazoo', 'cuff_size', '');
              setGroup('baazoo', 'cuff_extra', '');
              setGroup('baazoo', 'cuff_motai', '');
              setGroup('baazoo', 'cuff_motai_comment', '');
              reveal('baazoo', false);
              reveal('baazooSize', true);
              reveal('baazooCuffType', true);
              reveal('baazooCuffSize', true);
              reveal('baazooCuffMotai', true);
            }}
          />
        ) : (
          <OptionSummary
            label="بازو"
            value={d.baazoo?.design}
            onChange={() => reveal('baazoo')}
          />
        )}

        {d.baazoo?.design === 'کنی بازو' || d.baazoo?.design === 'گول بازو' ? (
          <View style={styles.sub}>
            {show.baazooSize ? (
              <OptionGroup
                label="سائز"
                options={bazuSizes}
                value={d.baazoo?.size}
                onChange={(v) => {
                  setGroup('baazoo', 'size', v);
                  reveal('baazooSize', false);
                }}
              />
            ) : (
              <OptionSummary
                label="سائز"
                value={d.baazoo?.size}
                onChange={() => reveal('baazooSize')}
              />
            )}
            <InputField
              label="اضافی سائز"
              value={d.baazoo?.extra || ''}
              onChangeText={(v) => setGroup('baazoo', 'extra', v)}
              placeholder="مزید تفصیل..."
            />
          </View>
        ) : null}

        {d.baazoo?.design === 'کف' ? (
          <View style={styles.sub}>
            {show.baazooCuffType ? (
              <OptionGroup
                label="کف ٹائپ"
                options={cuffTypes}
                value={d.baazoo?.cuff_type}
                onChange={(v) => {
                  setGroup('baazoo', 'cuff_type', v);
                  reveal('baazooCuffType', false);
                  reveal('baazooCuffSize', true);
                  reveal('baazooCuffMotai', true);
                }}
              />
            ) : (
              <OptionSummary
                label="کف ٹائپ"
                value={d.baazoo?.cuff_type}
                onChange={() => reveal('baazooCuffType')}
              />
            )}

            {show.baazooCuffSize ? (
              <OptionGroup
                label="کف سائز"
                options={cuffSizes}
                value={d.baazoo?.cuff_size}
                onChange={(v) => {
                  setGroup('baazoo', 'cuff_size', v);
                  reveal('baazooCuffSize', false);
                }}
              />
            ) : (
              <OptionSummary
                label="کف سائز"
                value={d.baazoo?.cuff_size}
                onChange={() => reveal('baazooCuffSize')}
              />
            )}

            <InputField
              label="اضافی کف سائز"
              value={d.baazoo?.cuff_extra || ''}
              onChangeText={(v) => setGroup('baazoo', 'cuff_extra', v)}
              placeholder="مزید تفصیل..."
            />

            {show.baazooCuffMotai ? (
              <OptionGroup
                label="Cuff Motai (موٹائی)"
                options={cuffMotaiOptions}
                value={d.baazoo?.cuff_motai}
                onChange={(v) => {
                  setGroup('baazoo', 'cuff_motai', v);
                  reveal('baazooCuffMotai', false);
                }}
              />
            ) : (
              <OptionSummary
                label="Cuff Motai (موٹائی)"
                value={d.baazoo?.cuff_motai}
                onChange={() => reveal('baazooCuffMotai')}
              />
            )}

            <InputField
              label="Cuff Motai کمنٹس"
              value={d.baazoo?.cuff_motai_comment || ''}
              onChangeText={(v) => setGroup('baazoo', 'cuff_motai_comment', v)}
              placeholder="Cuff Motai کے لیے کمنٹس"
            />
          </View>
        ) : null}
      </View>

      {/* ================= پٹائی ================= */}
      <View style={styles.section}>
        <CardSectionTitle>پٹائی</CardSectionTitle>
        {show.patai ? (
          <OptionGroup
            options={pataiOptions}
            value={d.patai?.type}
            onChange={(v) => {
              setGroup('patai', 'type', v);
              reveal('patai', false);
            }}
          />
        ) : (
          <OptionSummary
            label="پٹائی"
            value={d.patai?.type}
            onChange={() => reveal('patai')}
          />
        )}
        {d.patai?.type ? (
          <InputField
            label="پٹائی لمبائی"
            value={String(d.patai?.patai_lambai ?? '')}
            onChangeText={(v) => setGroup('patai', 'patai_lambai', v)}
            placeholder="انچ"
            keyboardType="numeric"
          />
        ) : null}
      </View>

      {/* ================= سلائی ================= */}
      <View style={styles.section}>
        <CardSectionTitle>سلائی</CardSectionTitle>
        {show.silai ? (
          <OptionGroup
            options={silaiOptions}
            value={d.silai?.type}
            onChange={(v) => {
              setGroup('silai', 'type', v);
              setGroup('silai', 'whatsapp_number', '');
              setGroup('silai', 'whatsapp_name', '');
              setGroup('silai', 'extra_style_design', '');
              reveal('silai', false);
            }}
          />
        ) : (
          <OptionSummary
            label="سلائی"
            value={d.silai?.type}
            onChange={() => reveal('silai')}
          />
        )}

        {d.silai?.type === 'واٹس ایپ' ? (
          <View style={styles.sub}>
            <InputField
              label="واٹس ایپ نمبر"
              value={d.silai?.whatsapp_number || ''}
              onChangeText={(v) => setGroup('silai', 'whatsapp_number', v)}
              placeholder="نمبر"
              keyboardType="phone-pad"
            />
            <InputField
              label="نام"
              value={d.silai?.whatsapp_name || ''}
              onChangeText={(v) => setGroup('silai', 'whatsapp_name', v)}
              placeholder="نام"
            />
            <InputField
              label="اضافی اسٹائل / ڈیزائن"
              value={d.silai?.extra_style_design || ''}
              onChangeText={(v) => setGroup('silai', 'extra_style_design', v)}
              placeholder="مزید ڈیزائن ہدایات..."
              multiline
            />
          </View>
        ) : null}
      </View>

      {/* ================= شلوار ================= */}
      <View style={styles.section}>
        <CardSectionTitle>شلوار</CardSectionTitle>
        {show.shalwar ? (
          <OptionGroup
            options={shalwarOptions}
            value={d.shalwar?.style}
            onChange={(v) => {
              setGroup('shalwar', 'style', v);
              reveal('shalwar', false);
            }}
          />
        ) : (
          <OptionSummary
            label="شلوار"
            value={d.shalwar?.style}
            onChange={() => reveal('shalwar')}
          />
        )}

        {show.shalwarAdditionalPocket ? (
          <OptionGroup
            label="شلوار جیب"
            options={shalwarPocketOptions}
            compact
            value={d.shalwar?.additional_pocket}
            onChange={(v) => {
              setGroup('shalwar', 'additional_pocket', v);
              reveal('shalwarAdditionalPocket', false);
            }}
          />
        ) : (
          <OptionSummary
            label="شلوار جیب"
            value={d.shalwar?.additional_pocket}
            onChange={() => reveal('shalwarAdditionalPocket')}
          />
        )}
      </View>

      {/* ================= نوٹس ================= */}
      <View style={styles.section}>
        <CardSectionTitle>خصوصی نوٹس</CardSectionTitle>
        <InputField
          label="نوٹس / کمنٹس"
          value={d.notes || ''}
          onChangeText={(v) => setFlat('notes', v)}
          placeholder="کوئی خاص ہدایت..."
          multiline
        />
        <InputField
          label="کپڑے کی قسم"
          value={d.cloth_type || ''}
          onChangeText={(v) => setFlat('cloth_type', v)}
          placeholder="شلوار قمیض"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sub: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  half: { width: '48.5%' },
});
