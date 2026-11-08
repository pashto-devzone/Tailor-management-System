"use strict";

module.exports = function createPersonalCustomerModel(client) {
  async function getNextSerialNumber(storeId) {
    try {
      const { data } = await client.from("customers").select("serial_number").eq("store_id", storeId);
      const nums = (data || []).map((r) => parseInt(r.serial_number, 10)).filter((n) => !Number.isNaN(n));
      return String((nums.length ? Math.max(...nums) : 0) + 1);
    } catch (_) {
      return String(Date.now());
    }
  }

  return {
    async createCustomer({ name, phone, address, serial_number = null, storeId = 1, userId = null }) {
      const serial = serial_number ? String(serial_number) : await getNextSerialNumber(storeId);
      const { data, error } = await client
        .from("customers")
        .insert({
          store_id: storeId,
          serial_number: serial,
          name,
          phone,
          address,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw toPersonalDbError(error, "save the customer");
      return { lastInsertRowid: Number(data.id), changes: 1 };
    },

    async getCustomers(storeId = 1) {
      const { data, error } = await client
        .from("customers")
        .select("*")
        .eq("is_deleted", false)
        .eq("store_id", storeId)
        .order("id", { ascending: false });
      if (error) throw toPersonalDbError(error, "read customers");
      return data || [];
    },

    async getCustomerById(id, storeId = 1) {
      const { data, error } = await client
        .from("customers")
        .select("*")
        .eq("id", id)
        .eq("is_deleted", false)
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw toPersonalDbError(error, "read the customer");
      return data || null;
    },

    async updateCustomer({ id, name, phone, address, serial_number, storeId = 1, userId = null }) {
      const patch = { name, phone, address, updated_by: userId, updated_at: new Date().toISOString() };
      if (serial_number != null) patch.serial_number = String(serial_number);
      const { data, error } = await client
        .from("customers")
        .update(patch)
        .eq("id", id)
        .eq("store_id", storeId)
        .select();
      if (error) throw toPersonalDbError(error, "update the customer");
      return { changes: data?.length || 0 };
    },

    async deleteCustomer(id, storeId = 1) {
      const { error } = await client.from("customers").delete().eq("id", id).eq("store_id", storeId);
      if (error) throw toPersonalDbError(error, "delete the customer");
    },

    async softDeleteCustomer(id, deletedBy = null, storeId = 1) {
      const { error } = await client
        .from("customers")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
        })
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw toPersonalDbError(error, "delete the customer");
    },

    async restoreCustomer(id, storeId = 1) {
      const { error } = await client
        .from("customers")
        .update({ is_deleted: false, deleted_at: null, deleted_by: null })
        .eq("id", id)
        .eq("store_id", storeId);
      if (error) throw toPersonalDbError(error, "restore the customer");
    },

    async getDeletedCustomersForRecycleBin(storeId = 1) {
      const { data, error } = await client
        .from("customers")
        .select("id, name, phone, deleted_at, deleted_by, is_deleted")
        .eq("is_deleted", true)
        .eq("store_id", storeId)
        .order("deleted_at", { ascending: false });
      if (error) throw toPersonalDbError(error, "read the recycle bin");
      return data || [];
    },

    async deleteCustomerForever(id, storeId = 1) {
      const { error } = await client.from("customers").delete().eq("id", id).eq("store_id", storeId);
      if (error) throw toPersonalDbError(error, "delete the customer");
    },
  };
};
