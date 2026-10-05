const customerModel = require("../models/customerModel");

function requireRole(req, res, next, allowedRoles) {
  if (!req.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Not authorized" });
  }
  next();
}

exports.addCustomer = async (req, res) => {
  const { name, phone, address, serial_number } = req.body;
  const storeId = req.storeId;
  const userId = req.user?.id || null;

  if (!name || !phone || !address) {
    return res.status(400).json({ message: "Naam, phone aur address required hain" });
  }

  const result = await customerModel.createCustomer({
    name,
    phone,
    address,
    serial_number: serial_number ?? null,
    storeId,
    userId,
  });

  const customer = await customerModel.getCustomerById(result.lastInsertRowid, storeId);

  res.json({
    message: "Grahak successfully add ho gaya",
    customer,
  });
};

exports.getCustomers = async (req, res) => {
  const storeId = req.storeId;
  const customers = await customerModel.getCustomers(storeId);
  res.json(customers);
};

exports.getCustomerById = async (req, res) => {
  const { id } = req.params;
  const storeId = req.storeId;
  const customer = await customerModel.getCustomerById(id, storeId);

  if (!customer) {
    return res.status(404).json({ message: "Grahak nahi mila" });
  }

  res.json(customer);
};

exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, serial_number } = req.body;
  const storeId = req.storeId;
  const userId = req.user?.id || null;

  if (!name || !phone || !address) {
    return res.status(400).json({ message: "Naam, phone aur address required hain" });
  }

  const customer = await customerModel.getCustomerById(id, storeId);
  if (!customer) {
    return res.status(404).json({ message: "Grahak nahi mila" });
  }

  await customerModel.updateCustomer({ id, name, phone, address, serial_number, storeId, userId });
  const updated = await customerModel.getCustomerById(id, storeId);
  res.json({ message: "Grahak update ho gaya", customer: updated });
};

exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const storeId = req.storeId;
  const customer = await customerModel.getCustomerById(id, storeId);
  if (!customer) {
    return res.status(404).json({ message: "Grahak nahi mila" });
  }

  await customerModel.softDeleteCustomer(id, req.user?.id || null, storeId);
  res.json({ message: "Grahak delete ho gaya" });
};
