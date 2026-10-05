const restoreTable = async (db, table, rows, storeId = 1) => {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const allowed = new Set(["customers", "measurements", "orders", "employees", "expenses", "income", "salaries"]);
  if (!allowed.has(table)) throw new Error("Unsupported backup table");
  const cols = Object.keys(rows[0]).filter((key) => key !== "id" && key !== "store_id");
  const sql = `INSERT INTO ${table} (store_id, ${cols.join(",")}) VALUES (?, ${cols.map(() => "?").join(",")})`;
  for (const row of rows) await db.prepare(sql).run(storeId, ...cols.map((column) => row[column]));
};

exports.restoreFromExportData = async (db, exportData, storeId = 1) => {
  if (!exportData) throw new Error("Invalid export data");
  if (exportData.settings) {
    await db.prepare("DELETE FROM settings WHERE store_id = ?").run(storeId);
    const settings = exportData.settings;
    const cols = Object.keys(settings).filter((key) => key !== "id" && key !== "store_id");
    await db.prepare(
      `INSERT INTO settings (store_id, ${cols.join(",")}) VALUES (?, ${cols.map(() => "?").join(",")})`,
    ).run(storeId, ...cols.map((column) => settings[column]));
  }
  for (const table of ["customers", "measurements", "orders", "employees", "expenses", "income", "salaries"]) {
    await restoreTable(db, table, exportData[table], storeId);
  }
};
