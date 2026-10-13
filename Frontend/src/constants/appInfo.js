import versionJson from "../../../version.json";

export const appInfo = {
  applicationName: "Tailor Management System",
  // Central version source. Update version.json -> UI updates everywhere.
  version:
    versionJson?.current ??
    versionJson?.version ??
    versionJson?.latest ??
    "1.5.4",
  developer: versionJson?.developer || "",
  lastUpdated: versionJson?.lastUpdated || "",
};

