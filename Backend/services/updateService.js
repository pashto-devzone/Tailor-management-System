const fs = require("fs");
const path = require("path");

const getVersionInfo = () => {
  const versionPath = path.join(__dirname, "..", "..", "version.json");
  if (!fs.existsSync(versionPath)) {
    return { current: "0.0.0", latest: "0.0.0" };
  }
  const raw = fs.readFileSync(versionPath, "utf-8");
  return JSON.parse(raw);
};

const isUpdateAvailable = (current, latest) => {
  const c = String(current || "").split(".").map(Number);
  const l = String(latest || "").split(".").map(Number);
  const len = Math.max(c.length, l.length);
  for (let i = 0; i < len; i++) {
    const ci = c[i] || 0;
    const li = l[i] || 0;
    if (li > ci) return true;
    if (li < ci) return false;
  }
  return false;
};

exports.checkForUpdates = async () => {
  const info = getVersionInfo();
  const current = info.current || "0.0.0";
  const latest = info.latest || "0.0.0";
  return {
    currentVersion: current,
    latestVersion: latest,
    status: isUpdateAvailable(current, latest) ? "Update Available" : "Up to date",
  };
};

exports.downloadUpdate = async () => {
  // Mock: return not implemented
  return { ok: false, message: "Update download is mocked (Electron will implement later)." };
};

exports.installUpdate = async () => {
  // Mock: return not implemented
  return { ok: false, message: "Update install is mocked (Electron will implement later)." };
};

