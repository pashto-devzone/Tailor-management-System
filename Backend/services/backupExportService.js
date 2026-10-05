const getTableAll = async (db, table, storeId) => {
  try {
    return await db.prepare(`SELECT * FROM ${table} WHERE store_id = ?`).all(storeId);
  } catch (_) {
    return [];
  }
};

exports.getAllExportData = async (db, storeId = 1) => ({
  meta: { exportedAt: new Date().toISOString(), storeId },
  settings: await db.prepare("SELECT * FROM settings WHERE store_id = ? LIMIT 1").get(storeId),
  customers: await getTableAll(db, "customers", storeId),
  measurements: await getTableAll(db, "measurements", storeId),
  orders: await getTableAll(db, "orders", storeId),
  employees: await getTableAll(db, "employees", storeId),
  expenses: await getTableAll(db, "expenses", storeId),
  income: await getTableAll(db, "income", storeId),
  salaries: await getTableAll(db, "salaries", storeId),
});
