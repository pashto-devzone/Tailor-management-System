"use strict";

/**
 * Shop settings stored in the user's own Supabase project.
 *
 * Mirrors the shape returned by `models/settingsModel.getSettings` so the
 * settings controller can render either backend identically.
 */

const { run, toPersonalDbError } = require("../../services/personalDb");

const defaults = {
  shopName: "",
  ownerName: "",
  phone: "",
  address: "",
  currency: "PKR",
  receiptFooter: "",
  logo: "",
};

let printSettingsColumnState = null;

/**
 * The `print_settings` column is optional; probe it once per process so a
 * project created from an older setup script still works.
 */
async function canPersistPrintSettings(client) {
  if (printSettingsColumnState !== null) return printSettingsColumnState;
  try {
    const { error } = await client.from("settings").select("print_settings").limit(1);
    printSettingsColumnState = !error;
  } catch (_) {
    printSettingsColumnState = false;
  }
  return printSettingsColumnState;
}

function parsePrintSettings(raw) {
  if (raw == null || raw === "") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

module.exports = function createPersonalSettingsModel(client) {
  async function getSettings(storeId = 1) {
    const data = await run(
      client.from("settings").select("*").eq("store_id", storeId).limit(1),
      "read the shop settings",
    );
    const row = (data || [])[0];
    if (!row) return { ...defaults, storeId, printSettings: null };
    return {
      ...defaults,
      storeId,
      shopName: row.shop_name ?? "",
      ownerName: row.owner_name ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
      currency: row.currency ?? "PKR",
      receiptFooter: row.receipt_footer ?? "",
      logo: row.logo ?? "",
      whatsappNumber: row.whatsapp_number ?? "",
      customerSerialStart: row.customer_serial_start ?? "",
      orderNumberStartingPoint: row.order_number_starting_point ?? "",
      orderNumberStart: row.order_number_start ?? "",
      applySerialNumberChangesToExistingCustomers: Boolean(
        row.apply_serial_number_changes_to_existing_customers,
      ),
      printSettings: parsePrintSettings(row.print_settings),
    };
  }

  async function saveSettings(values) {
    const {
      storeId = 1, shopName, ownerName, phone, address, currency, logo, whatsappNumber,
      receiptFooter, customerSerialStart, orderNumberStartingPoint, orderNumberStart,
      applySerialNumberChangesToExistingCustomers, printSettings,
    } = values;

    const persistPrintSettings = printSettings !== undefined
      && (await canPersistPrintSettings(client));

    const row = {
      store_id: storeId,
      shop_name: shopName ?? "",
      owner_name: ownerName ?? "",
      phone: phone ?? "",
      address: address ?? "",
      currency: currency || "PKR",
      receipt_footer: receiptFooter ?? "",
      logo: logo ?? "",
      whatsapp_number: whatsappNumber ?? "",
      customer_serial_start: customerSerialStart ?? "",
      order_number_starting_point: orderNumberStartingPoint ?? "",
      order_number_start: orderNumberStart ?? orderNumberStartingPoint ?? "",
      apply_serial_number_changes_to_existing_customers: Boolean(
        applySerialNumberChangesToExistingCustomers,
      ),
    };
    if (persistPrintSettings) {
      row.print_settings = JSON.stringify(printSettings ?? null);
    }

    const existing = await run(
      client.from("settings").select("id").eq("store_id", storeId).limit(1),
      "read the shop settings",
    );

    if ((existing || []).length) {
      const { error } = await client
        .from("settings")
        .update(row)
        .eq("store_id", storeId);
      if (error) throw toPersonalDbError(error, "save the shop settings");
    } else {
      const { error } = await client.from("settings").insert(row);
      if (error) throw toPersonalDbError(error, "save the shop settings");
    }

    return getSettings(storeId);
  }

  return { getSettings, saveSettings, canPersistPrintSettings: () => canPersistPrintSettings(client) };
};
