import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import esbuild from "esbuild";

const require = createRequire(import.meta.url);
const { buildMeasurementPrintHtml } = require("../../electron/measurementPrintHtml.cjs");
const frontendRoot = path.resolve("Frontend");
const tmpDir = path.join(frontendRoot, ".print-check-tmp");
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

try {
  for (const relativeFile of [
    "src/App.jsx", "src/components/Navbar.jsx", "src/components/MeasurementPreviewModal.jsx",
    "src/components/MeasurementPrint.jsx", "src/components/OrderCard.jsx", "src/components/OrderPrint.jsx", "src/components/PrintSettingsSection.jsx",
    "src/pages/Dashboard.jsx", "src/pages/Measurements.jsx", "src/pages/Orders.jsx", "src/pages/Settings.jsx",
  ]) {
    const source = fs.readFileSync(path.join(frontendRoot, relativeFile), "utf8");
    await esbuild.transform(source, { loader: "jsx", sourcefile: relativeFile });
  }
  console.log("PASS: modified JSX files parse successfully.");

  const bundled = path.join(tmpDir, "preview-check.mjs");
  await esbuild.build({
    entryPoints: [path.join(frontendRoot, "src/components/MeasurementPreviewModal.jsx")],
    outfile: bundled,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    define: { "import.meta.env": "{}" },
    external: ["react", "react-dom", "react-dom/server", "react/jsx-runtime", "axios"],
    logLevel: "silent",
  });
  const { default: MeasurementPreviewModal } = await import(`${pathToFileURL(bundled).href}?run=${Date.now()}`);
  const { cleanPrintMeasurementValue } = await import("../src/utils/measurementUtils.js");
  const printConfigBundle = path.join(tmpDir, "print-config-check.mjs");
  await esbuild.build({
    entryPoints: [path.join(frontendRoot, "src/utils/printConfig.js")],
    outfile: printConfigBundle,
    bundle: true,
    platform: "node",
    format: "esm",
    define: { "import.meta.env": "{}" },
    external: ["axios"],
    logLevel: "silent",
  });
  const { normalizePrintSettings, paperDimensionsMm, printSettingsCssVars } = await import(`${pathToFileURL(printConfigBundle).href}?run=${Date.now()}`);

  const textSamples = [
    "Ø¢Ø³ØªÛŒÙ† ØªÙ†Ú¯ Ø±Ú©Ú¾ÛŒÚº Û±Û²Û³",
    "Ú©Ù Ù…ÙˆÙ¹Ø§Ø¦ÛŒ Ú©Û’ ØªØ¨ØµØ±Û’",
    "Ú¯Ù„Ø§ Ú©Û’ ØªØ¨ØµØ±Û’",
    "Ø¯Ø§Ù…Ù† Ú©Û’ ØªØ¨ØµØ±Û’",
    "Ù¾Ù¹Ø§Ø¦ÛŒ Ú©Û’ ØªØ¨ØµØ±Û’",
    "Ø¨Ù¹Ù† ÚˆÛŒØ²Ø§Ø¦Ù† Ú©Û’ ØªØ¨ØµØ±Û’",
    "Ú©Ø§Ø¬ ÚˆÛŒØ²Ø§Ø¦Ù† Ú©Û’ ØªØ¨ØµØ±Û’",
    "Ø®ØµÙˆØµÛŒ ÛØ¯Ø§ÛŒØ§Øª",
    "Ú©Ø§Ø±ÛŒÚ¯Ø± Ø§Ø³Ù…",
    "Ù†ÙˆÙ¹Ø³ Û±Û²Û³",
  ];

  const selectedShalwar = {
    id: "sq-selected-17",
    dress_type: "shalwar kameez",
    created_at: "2026-11-18T12:00:00.000Z",
    comments: textSamples[9],
    measurements: {
      measurements: {
        lambai: "11", bazu: "22", taira: "33", collar: "44", seena: "55",
        half_seena: "66", kamar: "77", daaman: "88", shalwar: "99", pancha: "110",
        // Deliberate foreign garment keys prove the qameez order only reads its own keys.
        bazoo: "COAT_BAZOO", gala: "COAT_GALA", hips: "WAISTCOAT_HIPS",
      },
      baazoo: { design: "کف", cuff_type: "عام کف", cuff_motai_comment: textSamples[1], cuff_extra: textSamples[0] },
      additional_comments: { gala: textSamples[2], daman: textSamples[3], other: textSamples[7] },
      patai: { type: "پٹائی", design: "ڈیزائن", design_comment: textSamples[4] },
      button_design: { type: "بٹن", comment: textSamples[5] },
      kaaj_design: { type: "کاج", comment: textSamples[6] },
      kareegar: { name: textSamples[8] },
      notes: textSamples[9],
      coat_farmaish: { buttons: "3 Buttons", chaak: "Double Chaak" },
      waistcoat_farmaish: ["Boan Pocket"],
    },
  };
  const customer = { id: "customer-1", name: "Test User", phone: "03001234567", serial_number: "14205" };
  const order = { dress_type: "shalwar kameez", suit_quantity: 1, created_at: "2026-11-18", delivery_date: "2026-11-25" };
  const render = (measurement, customerRecordSet = [], printSettings = {}) => renderToStaticMarkup(
    React.createElement(MeasurementPreviewModal, {
      open: true, onCancel() {}, onEditMeasurement() {}, onPrintMeasurement() {},
      shop: { name: "Tailor Hub" }, settings: { printSettings }, customer: { ...customer, measurementRecords: customerRecordSet },
      measurement, order, title: "Measurement Preview",
    }),
  );
  const onlyQameezMarkup = render(selectedShalwar);
  const withOtherGarmentsMarkup = render(selectedShalwar, [
    { id: "coat-18", dress_type: "coat", measurements: { measurements: { bazoo: "COAT_ONLY_VALUE" } } },
    { id: "waistcoat-19", dress_type: "waistcoat", measurements: { measurements: { hips: "WAISTCOAT_ONLY_VALUE" } } },
  ]);
  assert.equal(withOtherGarmentsMarkup, onlyQameezMarkup, "other garment records do not affect a selected shalwar qameez print");
  for (const sample of textSamples) {
    assert.ok(onlyQameezMarkup.includes(sample), `free-text value survives exactly: ${sample}`);
    assert.ok(!onlyQameezMarkup.includes(`0${sample}`), "free-text values are not number-formatted");
    assert.equal(cleanPrintMeasurementValue(sample), sample, "free text bypasses the number/fraction formatter");
  }
  const expectedValues = ["11", "22", "33", "44", "55", "66", "77", "88", "99", "110"];
  const offsets = expectedValues.map((value) => onlyQameezMarkup.indexOf(`>${value}<`));
  assert.ok(offsets.every((offset) => offset >= 0), "all ten ordered shalwar qameez values are present");
  assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b), "qameez values appear in Lambai-to-Paancha order");
  assert.ok(!onlyQameezMarkup.includes("COAT_BAZOO"));
  assert.ok(!onlyQameezMarkup.includes("COAT_GALA"));
  assert.ok(!onlyQameezMarkup.includes("WAISTCOAT_HIPS"));
  assert.ok(onlyQameezMarkup.indexOf(textSamples[8]) < onlyQameezMarkup.indexOf(textSamples[9]), "Kareegar is first in the Urdu header before the notes body");
  console.log("PASS: actual preview component preserves all Urdu/free-text fixture strings verbatim.");
  console.log("PASS: shalwar qameez values print in the fixed 10-field order; foreign garment keys do not leak.");
  console.log("PASS: adding coat and waistcoat records does not alter the selected shalwar qameez HTML.");

  const defaults = normalizePrintSettings({}).settings;
  const defaultVars = printSettingsCssVars(defaults);
  assert.ok(defaultVars.includes("--ps-paper-w: 107.95mm"));
  assert.ok(defaultVars.includes("--ps-header-size: 11.3pt"));
  const defaultPreview = render(selectedShalwar, [], defaults);
  assert.ok(defaultPreview.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"));
  assert.ok(defaultPreview.includes("grid-template-rows: repeat(2, minmax(0, auto))"));

  const inchPaper = normalizePrintSettings({ paper: "custom", unit: "in", customWidthMm: 107.95, customHeightMm: 146.05 }).settings;
  assert.deepEqual(paperDimensionsMm(inchPaper), { widthMm: 107.95, heightMm: 146.05 });
  assert.ok(printSettingsCssVars(inchPaper).includes("--ps-paper-h: 146.05mm"));

  const larger = normalizePrintSettings({ baseFontSize: 20, headerFontSize: 18, marginTop: 12, marginLeft: 10 }).settings;
  const largerVars = printSettingsCssVars(larger);
  assert.ok(largerVars.includes("--ps-base-size: 20pt"));
  assert.ok(largerVars.includes("--ps-header-size: 18pt"));
  assert.ok(largerVars.includes("--ps-pad-top: 12.5mm"));
  assert.notEqual(largerVars, defaultVars, "font and margin settings change generated CSS variables");

  const extreme = normalizePrintSettings({ measurementLabelColumnWidth: 15, farmaishLabelColumnWidth: 70 }).settings;
  const extremeVars = printSettingsCssVars(extreme);
  assert.ok(extremeVars.includes("--ps-measure-label-fr: 15fr"));
  assert.ok(extremeVars.includes("--ps-measure-value-fr: 85fr"));
  assert.ok(extremeVars.includes("--ps-farmaish-label-fr: 70fr"));
  assert.ok(extremeVars.includes("--ps-farmaish-value-fr: 30fr"));

  const longUrduComment = "\u062e\u0635\u0648\u0635\u06cc \u06c1\u062f\u0627\u06cc\u0627\u062a \u0646\u067e\u0627\u0626\u06cc \u06a9\u06d2 \u0644\u06cc\u06d2 ".repeat(35);
  const longCommentsMeasurement = {
    ...selectedShalwar,
    comments: longUrduComment,
    measurements: {
      ...selectedShalwar.measurements,
      notes: longUrduComment,
      baazoo: { ...selectedShalwar.measurements.baazoo, cuff_motai_comment: longUrduComment, cuff_extra: longUrduComment },
      additional_comments: { gala: longUrduComment, daman: longUrduComment, other: longUrduComment },
      patai: { ...selectedShalwar.measurements.patai, design_comment: longUrduComment },
      button_design: { ...selectedShalwar.measurements.button_design, comment: longUrduComment },
      kaaj_design: { ...selectedShalwar.measurements.kaaj_design, comment: longUrduComment },
    },
  };
  const longCommentMarkup = render(longCommentsMeasurement, [], defaults);
  assert.ok(longCommentMarkup.includes(longUrduComment), "long Urdu comments survive the real preview renderer verbatim");
  assert.ok(longCommentMarkup.includes("--ps-table-gap: 1.5mm"));
  console.log("PASS: default, 4.25x5.75-inch, larger-font/margin, and min/max column settings update the shared preview CSS.");
  console.log("PASS: RTL header is a 3-column, 2-row grid; long Urdu comments remain intact in preview output.");

  const fontPath = path.resolve(frontendRoot, "public/fonts/NotoNastaliqUrdu.ttf");
  assert.ok(fs.existsSync(fontPath), "bundled Urdu font exists");
  const fontCss = `@font-face{font-family:"Noto Nastaliq Urdu";src:url("${pathToFileURL(fontPath).href}") format("truetype")}`;
  const electronHtml = buildMeasurementPrintHtml({ markup: defaultPreview, styles: "@font-face{font-family:'Noto Nastaliq Urdu'}" }, "", fontCss);
  assert.ok(electronHtml.includes('<meta charset="utf-8">'));
  assert.ok(electronHtml.includes("@font-face"));
  const htmlPath = path.join(os.tmpdir(), `tms-print-check-${process.pid}.html`);
  fs.writeFileSync(htmlPath, electronHtml, "utf8");
  const bytes = fs.readFileSync(htmlPath);
  const loadedHtml = bytes.toString("utf8");
  for (const sample of textSamples) assert.ok(loadedHtml.includes(sample), `UTF-8 temp-file path preserves ${sample}`);
  fs.rmSync(htmlPath, { force: true });
  console.log("PASS: Electron's shared HTML builder includes UTF-8 charset and local Urdu font; temp-file UTF-8 round-trip preserves text.");

  const root = path.resolve(frontendRoot, "src");
  const measurementsPage = fs.readFileSync(path.join(root, "pages/Measurements.jsx"), "utf8");
  const customersPage = fs.readFileSync(path.join(root, "pages/Customers.jsx"), "utf8");
  const ordersPage = fs.readFileSync(path.join(root, "pages/Orders.jsx"), "utf8");
  assert.match(measurementsPage, /setMeasurementPreviewMeasurement\(item\)/, "Measurements Print hands the clicked record to preview");
  assert.match(customersPage, /setPrintMeasurementForPreview\(match\)/, "Customers Print hands its chosen record to preview");
  assert.match(ordersPage, /records\.find\(\(item\) => String\(item\.dress_type/, "Orders Print Measurements selects the requested garment record");
  console.log("PASS: Measurements, Customers and Orders entry points pass the selected garment record into the shared preview.");
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
