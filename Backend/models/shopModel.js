const db = require("../config/db");

exports.getShop = async (storeId = 1) =>
  db.prepare("SELECT * FROM shop WHERE store_id = ? LIMIT 1").get(storeId);

exports.saveShop = async ({ name, owner_name, phone, address, storeId = 1 }) => {
  const result = await db.prepare(
    "UPDATE shop SET name = ?, owner_name = ?, phone = ?, address = ? WHERE store_id = ?",
  ).run(name, owner_name, phone, address, storeId);
  if (result.changes === 0) {
    await db.prepare(
      "INSERT INTO shop (store_id, name, owner_name, phone, address) VALUES (?, ?, ?, ?, ?)",
    ).run(storeId, name, owner_name, phone, address);
  }
};
