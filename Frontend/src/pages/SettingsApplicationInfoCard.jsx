import { appInfo } from "../constants/appInfo";

export default function SettingsApplicationInfoCard() {
  return (
    <div className="card form-card application-info-card">
      <div className="settings-right-section">
        <h3>Application Information</h3>
        <div className="section-divider" />

        <div className="app-info">
          <div className="app-info-row">
            <span className="app-info-label">Application Name</span>
            <span className="app-info-value">{appInfo.applicationName}</span>
          </div>
          <div className="app-info-row">
            <span className="app-info-label">Current Version</span>
            <span className="app-info-value">v{appInfo.version}</span>
          </div>

          {appInfo.developer ? (
            <div className="app-info-row">
              <span className="app-info-label">Developer</span>
              <span className="app-info-value">{appInfo.developer}</span>
            </div>
          ) : null}

          {appInfo.lastUpdated ? (
            <div className="app-info-row">
              <span className="app-info-label">Last Updated</span>
              <span className="app-info-value">{appInfo.lastUpdated}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

