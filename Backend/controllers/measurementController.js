const measurementModel = require("../models/measurementModel");
const customerModel = require("../models/customerModel");

exports.addMeasurement = async (req, res) => {
  const { customer_id, dress_type = "shalwar kameez", measurements, comments } = req.body;
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
    dress_type,
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
      dress_type,
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

  const dressType = req.query?.dress_type || null;
  const measurements = await measurementModel.getMeasurementsByCustomerId(customer_id, storeId, dressType);
  res.json(measurements);
};

exports.updateMeasurement = async (req, res) => {
  const { id } = req.params;
  const { dress_type, measurements, comments } = req.body;
  const storeId = req.storeId;
  const userId = req.user?.id || null;

  if (!measurements) {
    return res.status(400).json({ message: "Measurements ka data required hai" });
  }

  const existing = await measurementModel.getMeasurementById(id, storeId);
  if (!existing) {
    return res.status(404).json({ message: "Measurement record nahi mila" });
  }

  // A measurement row belongs to one customer and one garment. Do not let an
  // update retag that row, which can make another garment appear to disappear.
  const normalizeGarment = (value) => String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (dress_type && normalizeGarment(dress_type) !== normalizeGarment(existing.dress_type)) {
    return res.status(409).json({ message: "This measurement belongs to a different garment. Reload the selected garment and try again." });
  }

  await measurementModel.updateMeasurement({
    id,
    dress_type: existing.dress_type,
    customer_id: existing.customer_id,
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
