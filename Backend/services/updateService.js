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

exports.checkForUpdates = async () => {
  const info = getVersionInfo();
  return {
    currentVersion: info.current || "0.0.0",
    latestVersion: info.latest || info.current || "0.0.0",
    releaseNotes: info.notes || "",
    informationalOnly: true,
  };
};

