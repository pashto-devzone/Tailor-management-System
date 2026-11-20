import { useEffect, useState } from "react";

export default function UpdateNotification() {
  const [status, setStatus] = useState("idle");
  const [currentVersion, setCurrentVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI?.update;
    if (!api) return;
    const unsubs = [
      api.onAvailable((data) => {
        setCurrentVersion(data?.currentVersion || "");
        setLatestVersion(data?.latestVersion || "");
        setStatus("downloading");
        setProgress(0);
        setError("");
        setDismissed(false);
      }),
      api.onNotAvailable(() => { setStatus("idle"); setError(""); }),
      api.onDownloadProgress((data) => {
        setProgress(Math.max(0, Math.min(100, Number(data?.percent) || 0)));
        setStatus("downloading");
      }),
      api.onDownloaded((data) => {
        setCurrentVersion(data?.currentVersion || "");
        setLatestVersion(data?.latestVersion || "");
        setStatus("downloaded");
        setProgress(100);
        setError("");
        setDismissed(false);
      }),
      api.onError((data) => {
        setError(data?.message || "Could not check for updates. Please check your internet connection.");
        setStatus("error");
        setDismissed(false);
      }),
    ];
    return () => unsubs.forEach((unsubscribe) => { try { unsubscribe(); } catch (_) {} });
  }, []);

  const handleInstall = async () => {
    const result = await window.electronAPI?.update?.install?.();
    if (result?.ok === false) {
      setError(result.message || "Unable to install the update. Please restart the app and try again.");
      setStatus("error");
    }
  };
  if (dismissed || status === "idle") return null;

  const shell = { position: "fixed", bottom: 16, right: 16, zIndex: 99999, background: "#fff", border: "1px solid #e8eaf0", borderRadius: 12, padding: 14, boxShadow: "0 10px 30px rgba(15,23,42,0.16)", width: "min(380px, calc(100vw - 32px))", color: "#111827" };
  return (
    <div className="update-notification" role="status" style={shell}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{status === "downloaded" ? "Update ready" : status === "error" ? "Update check" : `Downloading update ${latestVersion}`}</div>
      {status === "error" ? <div style={{ fontSize: 13, color: "#667085" }}>{error}</div> : (
        <>
          <div style={{ fontSize: 13, color: "#667085", marginBottom: 8 }}>Current {currentVersion} · New {latestVersion}</div>
          {status === "downloaded" ? <div style={{ display: "flex", gap: 8 }}>
            <button className="button primary small" onClick={handleInstall}>Restart now</button>
            <button className="button secondary small" onClick={() => setDismissed(true)}>Later</button>
          </div> : <>
            <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "#5B4DF0", transition: "width .2s" }} /></div>
            <div style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>Downloading update {latestVersion}… {progress}%</div>
          </>}
        </>
      )}
    </div>
  );
}
