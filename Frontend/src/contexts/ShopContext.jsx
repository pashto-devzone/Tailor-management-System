import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { saveShopInfo as apiSaveShopInfo } from "../services/api";

const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(false);

  const clearShop = useCallback(() => {
    setShop(null);
  }, []);

  const saveShop = async (shopData) => {
    const data = {
      name: shopData.name,
      phone: shopData.phone,
      address: shopData.address,
    };

    await apiSaveShopInfo(data);
    setShop(prev => ({ ...prev, ...data }));
    return data;
  };

  return (
    <ShopContext.Provider value={{ shop, loading, saveShop, clearShop, setShop }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  return useContext(ShopContext);
}
