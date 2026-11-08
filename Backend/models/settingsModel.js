const db = require("../config/operationalDb");

const defaults = {
  shopName: "", ownerName: "", phone: "", address: "", currency: "PKR", receiptFooter: "", logo: "",
};

// The `settings.printsettings` column stores Print Settings JSON. Shop Information
// and Print Settings are stored here. Supabase personal-project configuration
// (project_url, anon_key_masked, has_personal_db) and connection details live in
// the `user_supabase_configs` table and must never be written through here.
// The `canPersistPrintSettings` probe below lazily ensures the `settings.printsettings`
// column exists on a PostgreSQL database that did not get migrations/003
// applied; it creates the column automatically (idempotently) so Print Settings
// persist without requiring manual SQL. Reads and non-print settings keep
// working even when creation is denied by database permissions.
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

  // Shop Information and Print Settings belong in the `settings` table.
  // Supabase project configuration (project_url, anon_key_masked,
  // has_personal_db) lives in the `user_supabase_configs` table and must
  // never be touched by a Shop Information or Print Settings save.
  //
  // persistPrintSettings is true only when printSettings is a real value
  // (object). `undefined` and `null` mean "leave the stored print settings
  // untouched", so the Shop Information card (which can carry a null
  // printSettings copied from the merged form) can never wipe Print Settings.
  const persistPrintSettings =
    printSettings !== undefined && printSettings !== null && (await canPersistPrintSettings());
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
        applyserialnumberchangestoexistingcustomers = ?,
        printsettings = ? WHERE store_id = ?`
    : `UPDATE settings SET shopname = ?, ownername = ?, phone = ?, address = ?,
        currency = COALESCE(?, currency), receiptfooter = ?, logo = ?, whatsappnumber = ?,
        customerserialstart = ?, ordernumberstartingpoint = ?, ordernumberstart = ?,
        applyserialnumberchangestoexistingcustomers = ? WHERE store_id = ?`;
  const updateParams = persistPrintSettings
    ? [...baseParams, JSON.stringify(printSettings), storeId]
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
      ? [storeId, ...baseParams, JSON.stringify(printSettings)]
      : [storeId, ...baseParams];
    await db.prepare(insertSql).run(...insertParams);
  }
  return exports.getSettings(storeId);
};

