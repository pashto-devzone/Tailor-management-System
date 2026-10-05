const shopModel = require("../models/shopModel");

exports.getShop = async (req, res) => {
  const storeId = req.storeId;
  const shop = await shopModel.getShop(storeId);
  if (!shop) {
    return res.status(404).json({ message: "Shop setup abhi nahi hua" });
  }
  res.json(shop);
};

exports.saveShop = async (req, res) => {
  const { name, owner_name, phone, address } = req.body;
  const storeId = req.storeId;

  if (!name || !phone || !address) {
    return res.status(400).json({ message: "Shop name, phone aur address required hain" });
  }

  await shopModel.saveShop({ name, owner_name, phone, address, storeId });
  const shop = await shopModel.getShop(storeId);

  res.json(shop);
};
