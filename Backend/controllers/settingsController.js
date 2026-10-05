const settingsModel = require("../models/settingsModel");

const defaultSettings = {
  shopName: "",
  ownerName: "",
  phone: "",
  address: "",
  currency: "PKR",
  receiptFooter: "",
  logo: "",
};

exports.getSettings = async (req, res) => {
  const storeId = req.storeId;
  const settings = await settingsModel.getSettings(storeId);

  res.json({
    ...defaultSettings,
    ...settings,
  });
};

exports.saveSettings = async (req, res) => {
  const payload = req.body || {};
  const storeId = req.storeId;

  await settingsModel.saveSettings({
    storeId,
    shopName: payload.shopName,
    ownerName: payload.ownerName,
    phone: payload.phone,
    address: payload.address,
    currency: payload.currency,
    logo: payload.logo,
    whatsappNumber: payload.whatsappNumber,
    receiptFooter: payload.receiptFooter,
    customerSerialStart: payload.customerSerialStart,
    orderNumberStartingPoint: payload.orderNumberStartingPoint,
    orderNumberStart: payload.orderNumberStart,
    applySerialNumberChangesToExistingCustomers:
      payload.applySerialNumberChangesToExistingCustomers,
  });

  const settings = await settingsModel.getSettings(storeId);

  const applyToExisting = Boolean(
    settings?.applySerialNumberChangesToExistingCustomers,
  );
  if (applyToExisting) {
    const customerSerialStartRaw = settings?.customerSerialStart;
    const startNum = Number(String(customerSerialStartRaw || "").trim());

    if (!Number.isFinite(startNum)) {
      return res.json(settings || defaultSettings);
    }

    if (Number.isFinite(startNum)) {
      const customerModel = require("../models/customerModel");
      const customers = await customerModel.getCustomers(storeId);

      let current = startNum;

      for (const c of customers) {
        await customerModel.updateCustomer({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          serial_number: String(current),
          storeId,
        });
        current += 1;
      }
    }
  }

  res.json(settings || defaultSettings);
};
