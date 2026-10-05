const fs = require("fs");
const path = require("path");
const os = require("os");
const db = require("../config/db");

const { getAllExportData } = require("../services/backupExportService");
const { restoreFromExportData } = require("../services/backupRestoreService");

/**
 * Where generated backup ZIPs are written.
 *
 * BACKUP_DIR overrides the default. Without it the desktop app keeps writing to
 * the user's Desktop on Windows, while a Linux host falls back to the system
 * temp directory (there is no Desktop folder, and creating one inside the
 * container is pointless).
 *
 * NOTE for hosting: this is ephemeral local disk. The file exists on the server,
 * not on the client's machine, and it is lost when the container is recycled.
 */
const backupDir = () => {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  if (process.platform === "win32") {
    return path.join(process.env.USERPROFILE || os.homedir(), "Desktop");
  }
  return path.join(os.tmpdir(), "tailorhub");
};

const ensureTmpDir = () => {
  const dir = backupDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const pad2 = (n) => String(n).padStart(2, "0");
const backupFilename = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `TailorHub_Backup_${yyyy}_${mm}_${dd}.zip`;
};

exports.createBackup = async (req, res) => {
  try {
    const storeId = req.storeId;
    const exportData = await getAllExportData(db, storeId);
    const JSZipLocal = require("jszip");
    const zip = new JSZipLocal();

    zip.file("TailorHub_export.json", JSON.stringify(exportData, null, 2));

    const tmpDir = ensureTmpDir();
    const zipPath = path.join(tmpDir, backupFilename());

    const content = await zip.generateAsync({ type: "nodebuffer" });
    fs.writeFileSync(zipPath, content);

    res.json({
      message: "Backup created successfully",
      filename: path.basename(zipPath),
    });
  } catch (err) {
    console.error("Backup create failed:", err);
    res.status(500).json({ message: "Backup create failed" });
  }
};

exports.restoreBackup = async (req, res) => {
  try {
    const storeId = req.storeId;
    if (!req.file?.buffer) {
      return res.status(400).json({ message: "No backup file uploaded" });
    }

    const zipBuffer = req.file.buffer;

    const JSZipLocal = require("jszip");
    const zip = await JSZipLocal.loadAsync(zipBuffer);

    const exportFile = zip.file("TailorHub_export.json");
    if (!exportFile) {
      return res.status(400).json({ message: "Invalid backup format" });
    }

    const exportText = await exportFile.async("string");
    const exportData = JSON.parse(exportText);

    await restoreFromExportData(db, exportData, storeId);

    res.json({ message: "Backup restored successfully" });
  } catch (err) {
    console.error("Backup restore failed:", err);
    res.status(500).json({ message: "Backup restore failed" });
  }
};
