import { useEffect, useState } from "react";

export default function UpdateNotification() {
  const [status, setStatus] = useState("idle");
  const [currentVersion, setCurrentVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const api = window.electronAPI?.update;
    if (!api) return;

    const unsubs = [
      api.onAvailable((data) => {
        setCurrentVersion(data?.currentVersion || "");
        setLatestVersion(data?.latestVersion || "");
        setStatus("available");
        setProgress(0);
        setError("");
      }),
      api.onNotAvailable((data) => {
        setCurrentVersion(data?.currentVersion || "");
        setLatestVersion(data?.latestVersion || "");
        setStatus("not-available");
        setProgress(0);
        setError("");
      }),
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
      }),
      api.onError((data) => {
        setError(data?.message || "Update failed");
        setStatus("error");
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => {
        try { unsub(); } catch (_) {}
      });
    };
  }, []);

  const handleCheck = async () => {
    setStatus("checking");
    setError("");
    setProgress(0);
    try {
      await window.electronAPI?.update?.check();
    } catch (e) {
      setError(e?.message || "Check failed");
      setStatus("error");
    }
  };

  const handleDownload = async () => {
    setStatus("downloading");
    setError("");
    try {
      await window.electronAPI?.update?.download();
    } catch (e) {
      setError(e?.message || "Download failed");
      setStatus("error");
    }
  };

  const handleInstall = async () => {
    try {
      await window.electronAPI?.update?.install();
    } catch (e) {
      setError(e?.message || "Install failed");
    }
  };

  if (status === "idle" || status === "not-available" || status === "checking") {
    return null;
  }

  if (status === "error") {
    return (
      <div className="update-notification" style={{ position: "fixed", bottom: 16, right: 16, zIndex: 9999, background: "#fff", border: "1px solid #ddd", borderRadius: 12, padding: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", maxWidth: 360 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Update Error</div>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{error || "Something went wrong."}</div>
        <button className="button secondary small" onClick={handleCheck}>Retry</button>
      </div>
    );
  }

  return (
    <div className="update-notification" style={{ position: "fixed", bottom: 16, right: 16, zIndex: 9999, background: "#fff", border: "1px solid #ddd", borderRadius: 12, padding: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", maxWidth: 360 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Update Available</div>
      <div style={{ fontSize: 13, color: "#444", marginBottom: 4 }}>
        Current: <strong>{currentVersion}</strong> → New: <strong>{latestVersion}</strong>
      </div>

      {status === "downloading" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#1E3A8A", transition: "width 0.2s" }} />
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{progress}%</div>
        </div>
      )}

      {status === "downloaded" && (
        <div style={{ fontSize: 13, color: "#166534", marginBottom: 8 }}>Update ready to install.</div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {status === "available" && (
          <button className="button primary small" onClick={handleDownload}>Download Update</button>
        )}
        {status === "downloading" && (
          <button className="button secondary small" disabled style={{ opacity: 0.7 }}>Downloading...</button>
        )}
        {status === "downloaded" && (
          <button className="button primary small" onClick={handleInstall}>Restart & Install</button>
        )}
      </div>
    </div>
  );
}
