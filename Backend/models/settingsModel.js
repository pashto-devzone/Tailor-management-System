const db = require("../config/db");

const defaults = {
  shopName: "", ownerName: "", phone: "", address: "", currency: "PKR", receiptFooter: "", logo: "",
};

exports.getSettings = async (storeId = 1) => {
  const row = await db.prepare("SELECT * FROM settings WHERE store_id = ? LIMIT 1").get(storeId);
  if (!row) return { ...defaults, storeId };
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
  };
};

exports.saveSettings = async (values) => {
  const {
    storeId = 1, shopName, ownerName, phone, address, currency, logo, whatsappNumber,
    receiptFooter, customerSerialStart, orderNumberStartingPoint, orderNumberStart,
    applySerialNumberChangesToExistingCustomers,
  } = values;
  const result = await db.prepare(
    `UPDATE settings SET shopname = ?, ownername = ?, phone = ?, address = ?,
      currency = COALESCE(?, currency), receiptfooter = ?, logo = ?, whatsappnumber = ?,
      customerserialstart = ?, ordernumberstartingpoint = ?, ordernumberstart = ?,
      applyserialnumberchangestoexistingcustomers = ? WHERE store_id = ?`,
  ).run(
    shopName ?? "", ownerName ?? "", phone ?? "", address ?? "", currency ?? "PKR",
    receiptFooter ?? "", logo ?? "", whatsappNumber ?? "", customerSerialStart ?? "",
    orderNumberStartingPoint ?? "", orderNumberStart ?? orderNumberStartingPoint ?? "",
    Boolean(applySerialNumberChangesToExistingCustomers), storeId,
  );
  if (!result.changes) {
    await db.prepare(
      `INSERT INTO settings (store_id, shopname, ownername, phone, address, currency, receiptfooter,
       logo, whatsappnumber, customerserialstart, ordernumberstartingpoint, ordernumberstart,
       applyserialnumberchangestoexistingcustomers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      storeId, shopName ?? "", ownerName ?? "", phone ?? "", address ?? "", currency ?? "PKR",
      receiptFooter ?? "", logo ?? "", whatsappNumber ?? "", customerSerialStart ?? "",
      orderNumberStartingPoint ?? "", orderNumberStart ?? orderNumberStartingPoint ?? "",
      Boolean(applySerialNumberChangesToExistingCustomers),
    );
  }
  return exports.getSettings(storeId);
};
