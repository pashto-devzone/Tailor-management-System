function buildMeasurementPrintHtml(preview, printCss, fontCss = "") {
  return `<!doctype html><html lang="ur" dir="rtl"><head><meta charset="utf-8"><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${preview.styles || ""}</style><style>${fontCss}</style><style>${printCss || ""}</style></head><body><div class="measurement-preview-backdrop"><div class="measurement-preview-dialog"><div><div class="measurement-preview-content"><div class="measurement-print-sheet">${preview.markup || ""}</div></div></div></div></div></body></html>`;
}
module.exports = { buildMeasurementPrintHtml };
