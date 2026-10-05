const customerModel = require("../models/customerModel");
const measurementModel = require("../models/measurementModel");
const orderModel = require("../models/orderModel");

const daysBetween = (fromIso, toIso) => {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.floor((to - from) / (24 * 60 * 60 * 1000));
};

const toISO = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
};

const MAX_DAYS = 30;

const computeDaysRemaining = (deletedAtIso) => {
  if (!deletedAtIso) return null;
  const nowIso = new Date().toISOString();
  const deletedDays = daysBetween(deletedAtIso, nowIso);
  if (deletedDays == null) return null;
  return Math.max(0, MAX_DAYS - deletedDays);
};

const mapRecycleCustomer = (c) => {
  const deletedAt = c.deleted_at || c.deletedAt || c.delete_date;
  return {
    id: c.id,
    type: "Customer",
    name: c.name,
    phone: c.phone,
    deleted_at: deletedAt,
    days_remaining: computeDaysRemaining(deletedAt),
  };
};

const mapRecycleMeasurement = (m) => {
  const deletedAt = m.deleted_at || m.deletedAt || m.delete_date;
  return {
    id: m.id,
    type: "Measurement",
    name: m.customer_name || m.customerName || "-",
    phone: m.customer_phone || m.customerPhone || "",
    deleted_at: deletedAt,
    days_remaining: computeDaysRemaining(deletedAt),
    measurements: m.measurements,
  };
};

const mapRecycleOrder = (o) => {
  const deletedAt = o.deleted_at || o.deletedAt || o.delete_date;
  return {
    id: o.id,
    type: "Order",
    name: o.customer_name || o.customerName || "-",
    phone: o.customer_phone || o.customerPhone || "",
    order_number: o.order_number,
    deleted_at: deletedAt,
    days_remaining: computeDaysRemaining(deletedAt),
  };
};

exports.listRecycleBin = async (req, res) => {
  const storeId = req.storeId;
  const { type = "all", q = "", filter = "all" } = req.query || {};

  const targetType = String(type || filter || "all").toLowerCase();
  const search = String(q || "").trim().toLowerCase();

  try {
    const now = new Date().toISOString();
    const cutoff = new Date(Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000).toISOString();
    void now;
    void cutoff;
    if (orderModel.cleanupExpiredRecycleBin) {
      await orderModel.cleanupExpiredRecycleBin(storeId);
    }
  } catch (_) {
    // ignore
  }

  const result = [];

  const pushIf = (arr, mapper) => {
    if (!Array.isArray(arr)) return;
    for (const x of arr) {
      const mapped = mapper(x);
      if (!mapped) continue;
      if (search) {
        const hay = `${mapped.name || ""} ${mapped.phone || ""} ${mapped.order_number || ""}`.toLowerCase();
        if (!hay.includes(search)) continue;
      }
      result.push(mapped);
    }
  };

  if (targetType === "all" || targetType === "customers" || targetType === "customer") {
    pushIf(await customerModel.getDeletedCustomersForRecycleBin(storeId) || [], mapRecycleCustomer);
  }

  if (targetType === "all" || targetType === "measurements" || targetType === "measurement") {
    pushIf(
      await measurementModel.getDeletedMeasurementsForRecycleBin(storeId) || [],
      mapRecycleMeasurement
    );
  }

  if (targetType === "all" || targetType === "orders" || targetType === "order") {
    pushIf(await orderModel.getDeletedOrdersForRecycleBin(storeId) || [], mapRecycleOrder);
  }

  res.json(result);
};

exports.restoreRecycleBinItem = async (req, res) => {
  const { type, id } = req.params;
  const storeId = req.storeId;

  const targetType = String(type || "").toLowerCase();
  const itemId = Number(id);
  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  if (targetType === "customers") {
    await customerModel.restoreCustomer(itemId, storeId);
    return res.json({ message: "Customer restored" });
  }

  if (targetType === "measurements") {
    await measurementModel.restoreMeasurement(itemId, storeId);
    return res.json({ message: "Measurement restored" });
  }

  if (targetType === "orders") {
    await orderModel.restoreOrder(itemId, storeId);
    return res.json({ message: "Order restored" });
  }

  return res.status(400).json({ message: "Invalid type" });
};

exports.deleteForeverRecycleBinItem = async (req, res) => {
  const { type, id } = req.params;
  const storeId = req.storeId;
  const targetType = String(type || "").toLowerCase();
  const itemId = Number(id);

  if (!Number.isFinite(itemId)) {
    return res.status(400).json({ message: "Invalid id" });
  }

  if (targetType === "customers") {
    if (!customerModel.deleteCustomerForever) {
      return res.status(400).json({ message: "Permanent delete not supported yet" });
    }
    await customerModel.deleteCustomerForever(itemId, storeId);
    return res.json({ message: "Customer deleted forever" });
  }

  if (targetType === "measurements") {
    if (!measurementModel.deleteMeasurementForever) {
      return res.status(400).json({ message: "Permanent delete not supported yet" });
    }
    await measurementModel.deleteMeasurementForever(itemId, storeId);
    return res.json({ message: "Measurement deleted forever" });
  }

  if (targetType === "orders") {
    if (!orderModel.deleteOrderForever) {
      return res.status(400).json({ message: "Permanent delete not supported yet" });
    }
    await orderModel.deleteOrderForever(itemId, storeId);
    return res.json({ message: "Order deleted forever" });
  }

  return res.status(400).json({ message: "Invalid type" });
};

exports.cleanupRecycleBin = async (req, res) => {
  const storeId = req.storeId;
  try {
    if (orderModel.cleanupExpiredRecycleBin) {
      await orderModel.cleanupExpiredRecycleBin(storeId);
    }
  } catch (_) {
    // ignore
  }
  res.json({ message: "Cleanup completed" });
};
