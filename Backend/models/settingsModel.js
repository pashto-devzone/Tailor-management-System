const db = require("../config/db");

const defaults = {
  shopName: "", ownerName: "", phone: "", address: "", currency: "PKR", receiptFooter: "", logo: "",
};

// The printsettings column may not exist yet on a PostgreSQL database that
// has not applied migrations/003_print_settings.sql. Probe it lazily; if it
// is missing, create it automatically (idempotent) so Print Settings persist
// without requiring manual SQL. Reads and non-print settings keep working
// even when creation is denied by database permissions.
let printSettingsColumnState = null;

async function canPersistPrintSettings() {
  if (printSettingsColumnState !== null) return printSettingsColumnState;
  try {
    await db.prepare("SELECT printsettings FROM settings LIMIT 1").get();
    printSettingsColumnState = true;
    return printSettingsColumnState;
  } catch {
    // Column missing (the only common cause): self-heal. PostgreSQL supports
    // IF NOT EXISTS; SQLite does not, so fall back to the plain form.
    try {
      await db.prepare("ALTER TABLE settings ADD COLUMN IF NOT EXISTS printsettings TEXT").run();
    } catch (_) {
      try {
        await db.prepare("ALTER TABLE settings ADD COLUMN printsettings TEXT").run();
      } catch (error) {
        console.warn(
          "[settings] could not create settings.printsettings automatically; " +
            "apply migrations/003_print_settings.sql manually:",
          error.message,
        );
      }
    }
    try {
      await db.prepare("SELECT printsettings FROM settings LIMIT 1").get();
      printSettingsColumnState = true;
      console.warn("[settings] created missing settings.printsettings column automatically");
    } catch (error) {
      printSettingsColumnState = false;
      console.warn(
        "[settings] printsettings column still unavailable; apply migrations/003_print_settings.sql then restart:",
        error.message,
      );
    }
  }
  return printSettingsColumnState;
}
exports.canPersistPrintSettings = canPersistPrintSettings;

function parsePrintSettings(raw) {
  if (raw == null || raw === "") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

exports.getSettings = async (storeId = 1) => {
  const row = await db.prepare("SELECT * FROM settings WHERE store_id = ? LIMIT 1").get(storeId);
  if (!row) return { ...defaults, storeId, printSettings: null };
  return {
    ...defaults,
    storeId,
    shopName: row.shopname ?? "",
    ownerName: row.ownername ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    currency: row.currency ?? "PKR",
    receiptFooter: row.receiptfooter ?? "",
    logo: row.logo ?? "",
    whatsappNumber: row.whatsappnumber ?? "",
    customerSerialStart: row.customerserialstart ?? "",
    orderNumberStartingPoint: row.ordernumberstartingpoint || row.ordernumberstart || "",
    orderNumberStart: row.ordernumberstart || "",
    applySerialNumberChangesToExistingCustomers: Boolean(row.applyserialnumberchangestoexistingcustomers),
    printSettings: parsePrintSettings(row.printsettings),
  };
};

exports.saveSettings = async (values) => {
  const {
    storeId = 1, shopName, ownerName, phone, address, currency, logo, whatsappNumber,
    receiptFooter, customerSerialStart, orderNumberStartingPoint, orderNumberStart,
    applySerialNumberChangesToExistingCustomers, printSettings,
  } = values;

  // undefined = "leave the stored print settings untouched", so callers that
  // do not manage them (e.g. the Android settings screen) can never wipe
  // them. An explicit value (including null) is persisted as JSON.
  const persistPrintSettings = printSettings !== undefined && (await canPersistPrintSettings());
  const baseParams = [
    shopName ?? "", ownerName ?? "", phone ?? "", address ?? "", currency ?? "PKR",
    receiptFooter ?? "", logo ?? "", whatsappNumber ?? "", customerSerialStart ?? "",
    orderNumberStartingPoint ?? "", orderNumberStart ?? orderNumberStartingPoint ?? "",
    Boolean(applySerialNumberChangesToExistingCustomers),
  ];

  const updateSql = persistPrintSettings
    ? `UPDATE settings SET shopname = ?, ownername = ?, phone = ?, address = ?,
        currency = COALESCE(?, currency), receiptfooter = ?, logo = ?, whatsappnumber = ?,
        customerserialstart = ?, ordernumberstartingpoint = ?, ordernumberstart = ?,
        applyserialnumberchangestoexistingcustomers = ?, printsettings = ? WHERE store_id = ?`
    : `UPDATE settings SET shopname = ?, ownername = ?, phone = ?, address = ?,
        currency = COALESCE(?, currency), receiptfooter = ?, logo = ?, whatsappnumber = ?,
        customerserialstart = ?, ordernumberstartingpoint = ?, ordernumberstart = ?,
        applyserialnumberchangestoexistingcustomers = ? WHERE store_id = ?`;
  const updateParams = persistPrintSettings
    ? [...baseParams, JSON.stringify(printSettings ?? null), storeId]
    : [...baseParams, storeId];

  const result = await db.prepare(updateSql).run(...updateParams);

  if (!result.changes) {
    const insertSql = persistPrintSettings
      ? `INSERT INTO settings (store_id, shopname, ownername, phone, address, currency, receiptfooter,
         logo, whatsappnumber, customerserialstart, ordernumberstartingpoint, ordernumberstart,
         applyserialnumberchangestoexistingcustomers, printsettings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      : `INSERT INTO settings (store_id, shopname, ownername, phone, address, currency, receiptfooter,
         logo, whatsappnumber, customerserialstart, ordernumberstartingpoint, ordernumberstart,
         applyserialnumberchangestoexistingcustomers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const insertParams = persistPrintSettings
      ? [storeId, ...baseParams, JSON.stringify(printSettings ?? null)]
      : [storeId, ...baseParams];
    await db.prepare(insertSql).run(...insertParams);
  }
  return exports.getSettings(storeId);
};
