const measurementModel = require("../models/measurementModel");
const customerModel = require("../models/customerModel");

exports.addMeasurement = async (req, res) => {
  const { customer_id, measurements, comments } = req.body;
  const storeId = req.storeId;
  const userId = req.user?.id || null;

  if (!customer_id || !measurements) {
    return res.status(400).json({ message: "Customer ID aur measurements required hain" });
  }

  const customer = await customerModel.getCustomerById(customer_id, storeId);
  if (!customer) {
    return res.status(404).json({ message: "Grahak nahi mila" });
  }

  const result = await measurementModel.createMeasurement({
    customer_id,
    measurements,
    comments: typeof comments === "string" ? comments : "",
    storeId,
    userId,
  });

  res.json({
    message: "Naap save ho gaya",
    measurement: {
      id: result.lastInsertRowid,
      customer_id,
      measurements,
      comments: typeof comments === "string" ? comments : "",
    },
  });
};

exports.getMeasurementsByCustomerId = async (req, res) => {
  const { customer_id } = req.params;
  const storeId = req.storeId;
  const customer = await customerModel.getCustomerById(customer_id, storeId);
  if (!customer) {
    return res.status(404).json({ message: "Grahak nahi mila" });
  }

  const measurements = await measurementModel.getMeasurementsByCustomerId(customer_id, storeId);
  res.json(measurements);
};

exports.updateMeasurement = async (req, res) => {
  const { id } = req.params;
  const { measurements, comments } = req.body;
  const storeId = req.storeId;
  const userId = req.user?.id || null;

  if (!measurements) {
    return res.status(400).json({ message: "Measurements ka data required hai" });
  }

  const existing = await measurementModel.getMeasurementById(id, storeId);
  if (!existing) {
    return res.status(404).json({ message: "Measurement record nahi mila" });
  }

  await measurementModel.updateMeasurement({
    id,
    measurements,
    comments: typeof comments === "string" ? comments : undefined,
    storeId,
    userId,
  });
  res.json({ message: "Naap update ho gaya" });
};

exports.deleteMeasurement = async (req, res) => {
  const { id } = req.params;
  const storeId = req.storeId;
  const existing = await measurementModel.getMeasurementById(id, storeId);
  if (!existing) {
    return res.status(404).json({ message: "Measurement record nahi mila" });
  }

  await measurementModel.softDeleteMeasurement(id, req.user?.id || null, storeId);
  res.json({ message: "Measurement delete ho gaya" });
};
