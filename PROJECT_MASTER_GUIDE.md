# TMS Project Master Guide

> Audit basis: checked-in source in this workspace, reviewed 2026-10-13. This is a source audit, not a fresh end-to-end runtime test. “Implemented” means a source path and call chain exists; “verified” is reserved for checks explicitly recorded in `TMS_PROJECT_STATUS.md` or visible static checks. Recheck source before relying on this guide.

## 1. Project at a glance

The Tailor Management System is a tailoring shop operations product. Its desktop Electron client has a React/Vite renderer and calls an Express API. The Expo/React Native Android app is another client of that API. PostgreSQL/Supabase is the intended production store; the backend also contains a development SQLite (`sql.js`) path. A separate React/Vite Admin app exposes administrative views and calls `/api/admin`. `Website/` currently contains only a short README and no website implementation. No independent web marketing site, hosted frontend, or website deployment setup was found.

Target users evidenced by the features: shop owners/staff (customers, measurements, orders, finances, employees, settings) and system administrators (stores, users, activity). The intended shared data relationship is desktop/Android → Backend → database. Admin also reaches the backend admin routes. The implementation does not establish that a production website exists. The root `TMS_PROJECT_STATUS.md` is a dated (2026-09-14) project snapshot and may describe a prior state; current source and deployed environment must be checked.

### Evidence labels

| Label | Meaning |
|---|---|
| Implemented and verified | Code exists and a relevant verification is explicitly recorded in the repository status/tests. This is not a claim of comprehensive production acceptance. |
| Implemented but not verified | A source implementation/call chain exists; no corresponding successful live flow was established in this audit. |
| Partially implemented | Some of the workflow exists, with a known missing segment or limited platform coverage. |
| Not implemented | No implementation was found in the inspected repository. |
| Not applicable | The feature does not apply to that component. |

## 2. Repository inventory and tree

### Counting method and scope

Counts are filesystem entries at audit time, not Git tracked-file counts: **207 files and 44 nested folders**. Counted recursively from repository root, excluding `.git`, all `node_modules`, all `.expo`, all `dist` and `dist-android-check` directories (including nested matches); all remaining files including lockfiles, docs and `Backend/database/tailor.db` are included. The root itself is not counted. Recompute when the checkout changes:

```powershell
$skip = '\\(\.git|node_modules|\.expo|dist|dist-android-check)(\\|$)'
$files = Get-ChildItem -File -Recurse -Force | Where-Object FullName -NotMatch $skip
$dirs = Get-ChildItem -Directory -Recurse -Force | Where-Object FullName -NotMatch $skip
"files=$($files.Count) folders=$($dirs.Count)"
```

This excludes the root itself; each nested directory is counted once. The following tree is the functional source tree. Lockfiles and individual app files are grouped where repetitive; each module’s complete source file index is listed afterward. `dist`, `node_modules`, `.expo`, `dist-android-check`, logs, and database file are generated/dependency/cache/runtime artifacts, not source modules.

```text
.
├── package.json, package-lock.json, electron-builder.yml, version.json
├── .gitignore, TMS_PROJECT_STATUS.md
├── electron/                 main.js, assets/, favicon.ico
├── Frontend/                 Vite React desktop renderer
│   ├── index.html, package.json, package-lock.json, vite.config.js, todo.md
│   └── src/{App.jsx,main.jsx,style.css,assets,components,constants,contexts,pages,services,utils}
├── Backend/                  Express API and persistence
│   ├── server.js, package.json, package-lock.json, DEPLOYMENT.md, .env.example
│   ├── config/, controllers/, database/, helpers/, middlewares/, migrations/, models/, routes/, scripts/, services/
│   ├── routes/{admin,v1}/ plus core route files
│   ├── services/{apiKeyService,backupExportService,backupRestoreService,updateService}.js
│   ├── scripts/{lan-info,open-firewall,smokeTest,smokeTestAuth,testCloudDb}
│   └── database/tailor.db (development/runtime database artifact)
├── Android/                  Expo/React Native client
│   ├── App.js, index.js, app.json, babel.config.js, metro.config.js, eas.json
│   ├── package.json, package-lock.json, .env.example, scripts/, assets/, src/
│   └── check-*.cjs, diagnose.cjs, validate-assets.cjs, export/metro logs
├── Admin/                    separate Vite React admin dashboard
│   ├── index.html, package.json, package-lock.json, vite.config.js, README.md
│   └── src/{App.jsx,App.css,main.jsx,components,contexts,pages,services}
└── Website/                  README.md only; no application source found
```

### Important folder/file map

| Path | Purpose/dependencies | Kind/status |
|---|---|---|
| `package.json`, `package-lock.json` | Root Electron scripts/dependencies and package resolution. Root scripts launch Electron and package Windows installer. | Source configuration/lock |
| `electron/main.js` | Electron main process: window lifecycle, starts backend child process, waits for health, packaging/updater behavior. | Source |
| `electron-builder.yml` | Electron Builder packaging rules. | Configuration |
| `version.json` | Shared app version read by app/version UI. | Configuration |
| `Frontend/src/` | Desktop React UI, routes, API client, contexts and styles. Loaded by Electron and Vite. | Source |
| `Frontend/dist/` | Built renderer consumed by packaged Electron flow. Regenerate from Frontend build. | Generated output |
| `Backend/server.js` | Express setup, middleware, route mounts, health and listen/startup behavior. | Source |
| `Backend/config/db.js` | PostgreSQL pool and development SQLite adapter/migration initialization. Models depend on its query helpers. | Source |
| `Backend/migrations/` | SQL schema changes. `001_initial.sql`, `002_garment_measurements_and_suit_quantity.sql`. | Source/schema |
| `Backend/routes/`, `controllers/`, `models/` | HTTP route → handler/business validation → SQL data access. | Source |
| `Backend/middlewares/` | Auth, admin auth, roles, validation, rate limit, upload, response wrapping. | Source |
| `Backend/.env.example` | Names/documentation for environment configuration; never copy secret values into docs. | Example configuration |
| `Backend/database/tailor.db` | SQLite DB artifact present in workspace; its existence does not prove production uses it. | Data artifact |
| `Android/src/screens/` | Native app screens, navigation composed in `Android/App.js`. | Source |
| `Android/src/services/` | API, server candidate selection/probing, session persistence. | Source |
| `Android/src/constants/measurementFields.js` | Android measurement data defaults and Urdu option/label catalog, intended to parallel desktop. | Source |
| `Android/assets/` | App icons and splash assets. | Assets |
| `Android/dist/`, `dist-android-check/` | Export/check artifacts. | Generated |
| `Admin/src/` | Admin navigation, auth context, dashboard/store/user/activity pages, API wrapper and CSS. | Source |
| `Website/README.md` | Documentation stub only; no routes or build setup. | Documentation |
| `TMS_PROJECT_STATUS.md` | Dated engineering snapshot, useful context but not guaranteed current. | Documentation |
| `node_modules/`, `.expo/`, `.git/` | Installed dependencies, Expo state, version-control internals. | Excluded generated/metadata |

### Complete source file index

Desktop renderer: `Frontend/src/App.jsx`, `main.jsx`, `style.css`; components `BudgetModal.jsx`, `CustomerForm.jsx`, `MeasurementModal.jsx`, `MeasurementPreviewModal.jsx`, `MeasurementPrint.jsx`, `Navbar.jsx`, `NewCustomerModal.jsx`, `OrderCard.jsx`, `OrderCard.css`, `OrderPrint.jsx`, `PaymentModal.jsx`, `ProfessionalFooter.jsx`, `ProfessionalFooter.css`, `UpdateNotification.jsx`; constant `constants/appInfo.js`; contexts `contexts/AuthContext.jsx`, `ShopContext.jsx`; pages `Budget.jsx`, `Customers.jsx`, `Dashboard.jsx`, `Login.jsx`, `Measurements.jsx`, `Orders.jsx`, `RecycleBinSection.jsx`, `Register.jsx`, `ResetPassword.jsx`, `Settings.jsx`, `SettingsApplicationInfoCard.jsx`, `Setup.jsx`; service `services/api.js`; utility `utils/measurementUtils.js`; assets `hero.png`, `javascript.svg`, `vite.svg`.

Backend source: `server.js`; config `config/corsOptions.js`, `config/db.js`; controllers `authController.js`, `backupController.js`, `budgetController.js`, `customerController.js`, `measurementController.js`, `orderController.js`, `recycleBinController.js`, `settingsController.js`, `shopController.js`, `admin/activityController.js`, `admin/adminController.js`, `admin/dashboardController.js`, `admin/storeController.js`, `admin/userController.js`; helpers `helpers/response.js`; middleware `adminAuth.js`, `auth.js`, `rateLimit.js`, `uploadMiddleware.js`, `v1ResponseWrapper.js`, `validation.js`; models `budgetModel.js`, `customerModel.js`, `measurementModel.js`, `orderModel.js`, `orderNumberModel.js`, `settingsModel.js`, `shopModel.js`; core routes `authRoutes.js`, `backupRoutes.js`, `budgetRoutes.js`, `customerRoutes.js`, `measurementRoutes.js`, `orderRoutes.js`, `recycleBinRoutes.js`, `settingsRoutes.js`, `shopRoutes.js`, `updateRoutes.js`; nested `routes/admin/` and `routes/v1/`; services `apiKeyService.js`, `backupExportService.js`, `backupRestoreService.js`, `updateService.js`; scripts `lan-info.js`, `open-firewall.ps1`, `smokeTest.js`, `smokeTestAuth.js`, `testCloudDb.js`; migrations `001_initial.sql`, `002_garment_measurements_and_suit_quantity.sql`. `Backend/DEPLOYMENT.md` is deployment reference.

Android source: `App.js`, `index.js`; screens `ConnectionScreen.js`, `CustomerDetailsScreen.js`, `CustomersScreen.js`, `DashboardScreen.js`, `EmployeeDetailsScreen.js`, `EmployeesScreen.js`, `FinanceScreen.js`, `LoginScreen.js`, `MeasurementsScreen.js`, `MoreScreen.js`, `OrderDetailsScreen.js`, `OrdersScreen.js`, `RecycleBinScreen.js`, `RegisterScreen.js`, `SettingsScreen.js`, `SplashScreen.js`; components `MeasurementDetail.js`, `MeasurementForm.js`, `UIComponents.js`; constants `appInfo.js`, `measurementFields.js`, `orderStatus.js`, `theme.js`; context `AuthContext.js`; services `api.js`, `serverConfig.js`, `session.js`; utils `clipboard.js`, `currency.js`, `date.js`, `exporter.js`, `measurementUtils.js`, `validation.js`.

Admin source: `src/App.jsx`, `App.css`, `main.jsx`; components `Sidebar.jsx`, `TopBar.jsx`; context `AdminAuthContext.jsx`; pages `Activity.jsx`, `Dashboard.jsx`, `Login.jsx`, `StoreDetail.jsx`, `Stores.jsx`, `Users.jsx`; service `api.js`.

## 3. Technology, startup and system architecture

| Component | Stack and entry | Dependencies/data |
|---|---|---|
| Desktop | Electron 32, React/Vite renderer, JavaScript/JSX; Electron main `electron/main.js`. | Local Express child process; database reachable through Backend. `Frontend/src/services/api.js` supports `VITE_API_URL`. |
| Backend | Node.js, Express, `pg`, `sql.js`; `Backend/server.js`. | PostgreSQL via `DATABASE_URL` in production path; local SQLite fallback in development path. |
| Android | Expo SDK 57, React Native, React Navigation, Axios, AsyncStorage; `Android/App.js`. | Express API over configured/discovered LAN or URL. It stores session/config locally, not database credentials. |
| Admin | React/Vite, JavaScript; `Admin/src/main.jsx`. | Separate admin endpoints under `/api/admin`; exact auth environment/deployment values in Admin `.env` are intentionally not reproduced. |
| Website | No framework/source found. | Unknown/nonexistent in this repository checkout. |

Desktop flow: Electron starts the local backend, waits for `/health`, then renders the packaged `Frontend/dist` or development renderer. React requests go through Axios API helpers to Express. Android runs as a separate client, tries candidate server roots (saved device setting → `EXPO_PUBLIC_API_URL` → Expo host → localhost per status note), probes health, and can save a manually entered URL using `AsyncStorage`. Backend binds `0.0.0.0` by default (`HOST` override) for LAN access. There is no evidence of an offline mutation queue or data reconciliation. The root status note says production desktop requires PostgreSQL/Supabase; `config/db.js` source comments distinguish production PG from development SQLite fallback. Verify actual production env and startup mode before making deployment claims.

### API route groups

`Backend/server.js` mounts `/api/auth`, `/api/update`, `/api/v1`, `/api/admin/auth`, guarded `/api/admin`, and authenticated/store-scoped `/api/customers`, `/api/measurements`, `/api/orders`, `/api/shop`, `/api/settings`, `/api/backup`, `/api/budget`, `/api` recycle-bin handlers. `/` and `/health` are health/info endpoints. Core routes include:

| Route group | Operations evidenced in route files |
|---|---|
| Auth | register, login, forgot/reset password, change password, logout, current user |
| Customers | list, create, detail, update, delete |
| Measurements | create, list by customer (optional garment filter), update, delete |
| Orders | list/search, create, detail, customer orders, update, payment update, delete |
| Budget | employee CRUD subset, expenses, income, salary list/create/update |
| Shop/settings | read and owner-guarded save |
| Backup | create; restore guarded for owner and file upload |
| Recycle bin | list, restore, permanent delete, cleanup |
| Admin | separate admin login and dashboard/store/user/activity controllers |
| v1 | API key management and external order integration (documented in status snapshot); verify current `routes/v1` tree before changing |

## 4. Data model and business logic

The migration files are the schema authority. `001_initial.sql` declares core tables and constraints; `002_garment_measurements_and_suit_quantity.sql` adds garment-specific measurement support and suit quantity. The DB layer adapts query behavior between PG and SQLite, while models issue SQL. Tables/entities evidenced across models/routes include users/auth and shops/stores, customers, measurements, orders, employees, expenses, income, salaries, settings, API keys, and recycle bin/soft-delete data. Exact field-level schema should be taken directly from migrations before a schema change; this guide avoids guessing columns not confirmed in the migrations. `store_id` is the tenant boundary in authenticated operations per status note, applied in application SQL/route context rather than proven database row-level security. This is a security-sensitive limitation.

Relationships and flows: shop/store owns customers and operational records; customer is referenced by measurements and orders; garment measurement payload is structured JSON and belongs to a customer; orders track tailoring work and payments; budget models handle employees, expenses, income and salary payments. Order numbers are delegated to `orderNumberModel.js`. Budget amounts can arrive as numeric strings from PG; the status snapshot records normalization fixes in desktop rendering. Inspect models plus migrations and controller validation together before changing persistence.

### Measurement payload

Desktop shared defaults in `Frontend/src/utils/measurementUtils.js` and Android definitions in `Android/src/constants/measurementFields.js`. Basic ordered Urdu display rows are: `lambai` (length), `bazu` (sleeve), `taira`, `collar`, `seena`, `half_seena`, `kamar`, `daaman`, `shalwar`, `pancha`. Stored data is an object with `measurements` plus structured sections such as `gala`, `daaman`, `pocket`, `baazoo`/`baazoo`-related sleeve details, `patai`, desktop `bukram`, `munda`, `silai`, `shalwar`, `button_design`, `kaaj_design`, and `notes`; Android defaults omit some desktop-only objects (e.g. `bukram`, `munda` in the inspected definition), so do not assume exact parity. Garment type, suit quantity and other row metadata are managed by the measurement UI and migration. Urdu option catalogs cover collar/neck, cuff, patai, stitching, shalwar, button/kaaj and pocket choices. The source file has mojibake in this checkout’s terminal rendering; preserve original UTF-8 and verify rendered Urdu visually before editing labels.

Desktop measurement/print chain: `Measurements.jsx` → `MeasurementModal.jsx` form state and defaults → `services/api.js` add/update → `/api/measurements` → `measurementController.js` → `measurementModel.js` → DB. Preview/print components are `MeasurementPreviewModal.jsx` and `MeasurementPrint.jsx`; exact print CSS/layout should be reviewed in those files before changes. Orders use `OrderCard.jsx`, `OrderPrint.jsx`, `PaymentModal.jsx`, and backend order/payment endpoints. No runtime print output was checked during this audit.

## 5. Desktop application

### Navigation and shell

`Frontend/src/App.jsx` composes auth/shop contexts, network/cloud status handling, update notification, navbar and React Router routes. Protected shop pages are reached after login/setup. `Navbar.jsx` links the main work areas; `style.css` contains global layout and responsive styles. Major route/page components: Dashboard, Customers, Measurements, Orders, Budget, Settings, Setup, auth Login/Register/ResetPassword, plus recycle-bin/settings subcomponents. Exact route guards should be read in `App.jsx` before navigation changes.

| Screen/workflow | UI hierarchy, behavior and data path | State/verification |
|---|---|---|
| Login/register/reset | Auth page forms; `AuthContext.jsx` calls login/register/me/logout and password-reset API helpers. Session handling and backend bcrypt/JWT are in auth controller/middleware. | Code present; live email/reset delivery not verified. |
| Dashboard | `Dashboard.jsx` overview cards/summary and navigation actions, API-driven shop data. | Implemented; no fresh live DB check. |
| Customers | `Customers.jsx` list/search/actions and `NewCustomerModal.jsx`/`CustomerForm.jsx` create/edit. Customer row actions navigate to detail/workflows, update or soft-delete through API. | Implemented; inspect handler-level validation in controller/model. |
| Measurements | `Measurements.jsx` customer/garment list and add/edit/delete/detail actions; `MeasurementModal.jsx` groups basic dimensions and design selectors; preview/print modal components. | Structured payload and API chain present. Print result and every selector interaction not runtime verified. |
| Orders | `Orders.jsx` order list/search/filter/status actions and `OrderCard.jsx`; create/edit/detail/payment interactions call order endpoints. `PaymentModal.jsx` posts payment changes; `OrderPrint.jsx` formats printable order. | API/source present; payment arithmetic and print require runtime regression. |
| Budget/finance | `Budget.jsx` sections and `BudgetModal.jsx` forms for employee, expense, income, salary; totals/amounts displayed from budget API. | Backend routes exist; check exact modal validation/calculations when changing. |
| Settings/shop | `Settings.jsx`, `SettingsApplicationInfoCard.jsx`, shop/settings service calls, recycle bin section, backup controls and API-key/integration controls documented in status note. | Settings owner restrictions in backend; integration live check not made. |
| Recycle bin | `RecycleBinSection.jsx` list, restore, permanent delete and cleanup actions. | Backend endpoints present; destructive operations need care. |
| Setup | `Setup.jsx` initial shop configuration and shop info save. | Implemented; live onboarding not verified. |
| Updates/footer | `UpdateNotification.jsx`, `ProfessionalFooter.jsx`, app version constants. Backend update routes and Electron updater are distinct; verify packaging before release. | Not installer verified per status snapshot. |

The React UI is composed from semantic nested JSX containers and CSS classes, not a separate documented design system. For container-level changes, inspect the target page’s JSX tree and adjacent CSS in `style.css` / component CSS; avoid treating a visible control as proof its backend operation succeeds. The key container/component boundaries are page root → page header/actions → filters/search → list/table/cards → modal/confirmation → API call. Modal files listed above define their own form sections. A literal exhaustive inventory of every `div`/button is intentionally replaced by these component-level maps because UI markup changes frequently; inspect current JSX for exact classes before edits.

## 6. Android application

### Structure, navigation and behavior

Expo app entry is `Android/index.js` → `App.js`. App defines root auth/main navigation; bottom tabs are Dashboard, Customers, Orders, Measurements, More. Customers and Orders have nested list/detail stacks; More links employees/details, finance, settings, recycle bin and Connection. Splash/auth routing is coordinated with `AuthContext.js`. Theme and status constants are in `src/constants/`; reusable measurement and UI widgets are in `src/components/`.

Login/register use auth context and API. Customers list/detail screens create/update/delete or show customer data. Measurements screen and `MeasurementForm.js`/`MeasurementDetail.js` edit the measurement structure and call API. Orders and order detail support order workflow; employee and finance screens expose staff and budget-oriented routes; Settings/RecycleBin and More cover utility features. `ConnectionScreen.js` allows manual server base configuration and displays probe failures. API calls are in `src/services/api.js`; `serverConfig.js` selects/probes URL candidates and reacts to transport errors; `session.js` stores auth session. `AsyncStorage` is local configuration/session state, not offline business-data storage. Android exporter utilities exist, but their supported formats and success should be verified in `utils/exporter.js` before relying on them.

`app.json` / `eas.json` configure Expo/EAS packaging. Network access is required to reach backend; Android requires shop Wi-Fi/LAN or a reachable hosted API. `Android/.env.example` documents public URL configuration names; do not embed backend secrets in a client bundle. Native permissions are defined in Expo config; inspect `app.json` before adding capabilities. No independent Android database or background sync implementation was identified.

### Desktop vs Android feature status

| Feature | Android compared with desktop | Evidence |
|---|---|---|
| Login/register/session | Implemented but not verified | `AuthContext.js`, `LoginScreen.js`, `RegisterScreen.js`, `session.js`; backend auth routes. |
| Dashboard | Implemented but not verified | `DashboardScreen.js`; same API. |
| Customer CRUD/details | Implemented but not verified | `CustomersScreen.js`, `CustomerDetailsScreen.js`. |
| Garment measurement create/edit/detail | Partially implemented | `MeasurementsScreen.js`, `MeasurementForm.js`, `MeasurementDetail.js`; Android field defaults are not identical to desktop defaults. |
| Orders and payment | Partially implemented | `OrdersScreen.js`, `OrderDetailsScreen.js`; check parity of desktop print/payment edit operations. |
| Measurement print preview / desktop print layout | Not implemented (native equivalent not found) | Desktop `MeasurementPreviewModal.jsx`, `MeasurementPrint.jsx`; Android files do not show equivalent print component. |
| Order printing | Not implemented (native equivalent not found) | Desktop `OrderPrint.jsx`; no Android print module found. |
| Employees | Implemented but not verified | `EmployeesScreen.js`, `EmployeeDetailsScreen.js`. |
| Finance: income/expense/salary | Partially implemented | `FinanceScreen.js`; verify exact CRUD coverage against `Budget.jsx` and backend routes. |
| Shop settings | Partially implemented | `SettingsScreen.js`; not all desktop integration/settings affordances necessarily exist. |
| Recycle bin | Implemented but not verified | `RecycleBinScreen.js`. |
| Connection discovery/manual URL | Implemented and verified (static checks only) | Status snapshot records health/server URL checks and fixes; `ConnectionScreen.js`, `serverConfig.js`. |
| Backup/restore | Partially implemented or unverified on Android | Backend supports create/owner restore; Android screen/service export is not proof of equivalent cloud backup. |
| Offline CRUD/sync | Not implemented | No local business DB/write queue; status snapshot explicitly states online-only operations. |
| Admin panel | Not applicable | Separate web admin component. |

### Android roadmap (recommendations, not existing features)

1. **Parity for measurement/order preview and printing (high).** Useful at fittings without returning to desktop. Reuse field model and label semantics conceptually, but build native layouts and a printer/share flow. No backend schema required if using existing records; assess Expo native print/PDF dependencies, Bluetooth printer support and font/RTL risks. Offline preview can work only with loaded data; printing capability needs device tests.
2. **Complete desktop parity for finance and settings (high).** Compare `FinanceScreen.js` and `SettingsScreen.js` against `Budget.jsx`, `Settings.jsx`, and API exports, then add missing native forms/actions. Existing backend endpoints likely suffice if payloads match; avoid inventing endpoints until verified. Network required; no sync queue today. Risk: salary/financial calculations and owner-only permissions.
3. **Explicit order lifecycle/status editing parity (medium).** Add missing list filters/actions after mapping desktop handlers and `orderStatus.js`. Reuse backend order update API where possible; schema changes only if a status concept is genuinely absent. Requires online connection, careful optimistic-update/error handling.
4. **Safe offline read cache and later sync (lower, architecture project).** Useful in poor connectivity; requires local storage schema, conflict/merge policy, idempotent writes, queue visibility and backend revisions/constraints. Desktop currently has no shared sync engine, so this is not a direct port. High data-integrity risk; scope only after defining source of truth and conflict resolution.

## 7. Admin panel and website

### Admin

`Admin/src/App.jsx` selects auth and admin pages; `AdminAuthContext.jsx` manages session, `services/api.js` calls backend, `Sidebar.jsx`/`TopBar.jsx` provide shell. Pages: `Login.jsx`, `Dashboard.jsx`, `Stores.jsx`, `StoreDetail.jsx`, `Users.jsx`, `Activity.jsx`. Their intended roles are system administrators managing stores/accounts and reviewing activity. Backend handlers are under `Backend/controllers/admin/`; admin middleware `Backend/middlewares/adminAuth.js`; routes mount `/api/admin/auth` and guarded `/api/admin`. Admin is separate from the desktop shop UI. UI presence does not prove production hardening or that admin routes are deployed/reachable. No role matrix beyond route guards/context was exhaustively verified. `Admin/.env` exists; values are secret/config and intentionally omitted. `vite.config.js` and package scripts define development/build, but hosting target was not established.

| Admin capability | Status | Evidence/unknown |
|---|---|---|
| Login/auth context | Implemented but not verified | `Login.jsx`, `AdminAuthContext.jsx`, admin auth controller/middleware. |
| Dashboard | Implemented but not verified | `Dashboard.jsx`, `dashboardController.js`. |
| Store list/detail | Implemented but not verified | `Stores.jsx`, `StoreDetail.jsx`, `storeController.js`. |
| User management | Implemented but not verified | `Users.jsx`, `userController.js`. |
| Activity view | Implemented but not verified | `Activity.jsx`, `activityController.js`. |
| Deployment/access restrictions | Unverified | Vite config and backend CORS exist; no verified deployment target/production admin test. |

### Website

`Website/README.md` is the only file found. There are no website package manifest, source routes, UI, API calls, or deployment config in this checkout. A website is therefore **not implemented in this repository**; its intended scope, host, authentication and relationship to backend are unknown. Do not conflate the Admin SPA with a public website.

## 8. Security, identity, networking and integrations

Shop routes are protected by `authenticate` and `requireStore`; settings/restore also use role checks. The project status describes bcrypt/JWT and store scoping. `authController.js`, `auth.js`, `adminAuth.js`, and route-level `requireRole` usage are authoritative for current behavior. CORS logic is in `Backend/config/corsOptions.js`; production browser origins require `ALLOWED_ORIGINS`, while private origins are configurable. Android native clients do not require browser CORS.

The 2026-09-14 status document warns that distributing a desktop package containing a shared `DATABASE_URL`/JWT/API key secret would expose database credentials and bypass application-level tenant isolation. Treat as a critical deployment risk and confirm current packaging/env injection before shipping. Client environment variables are public configuration only. No source audit can establish safe secret handling in an actual installer. Status note describes API keys hashed with `API_KEY_SECRET`, scoped to store, with raw key shown once; verify the current versioned route files before modifying.

Potential external components: PostgreSQL/Supabase database; email/reset flow dependency is not established here; Electron updater; Expo/EAS build service; no third-party sync or payment provider was found. Do not infer integrations from dependency names alone.

## 9. Setup, development, tests and deployment

Commands below come from package scripts/config where available. Run from the named directory. These commands were not executed as part of this documentation task.

```powershell
# Desktop renderer
cd Frontend
npm install
npm run dev
npm run build

# Backend
cd Backend
npm install
npm start
npm run dev       # if present in current Backend/package.json; verify before use
npm run lan       # described by TMS_PROJECT_STATUS.md; confirm script exists
npm run firewall  # requires elevated Windows firewall change; only use intentionally

# Electron app, from repository root
npm install
npm run electron-dev
npm run build-electron

# Android
cd Android
npm install
npx expo start
npx expo run:android
# EAS build tasks depend on eas.json profile; inspect before release build.

# Admin
cd Admin
npm install
npm run dev
npm run build
```

Root scripts observed: `electron-dev`, `electron`, `build-electron`. Renderer and Admin use Vite scripts; Android uses Expo. Backend scripts present: `start`, `dev`, `db:check`, `smoke`, `lan`, `firewall`. Frontend/Admin use `dev`, `build`, `preview`; Android uses `start`, `android`, `ios`, `web`. Backend scripts can contact a configured service or change Windows Firewall; inspect them before execution. No dedicated test directory or broad automated suite was identified. Android includes `check-syntax.cjs`, `check-imports.cjs`, `check-theme.cjs`, `diagnose.cjs`, `validate-assets.cjs`; status records syntax/import/style/no-undef and URL utility checks, but those may refer to versions/scripts since changed.

Configuration names documented from `.env.example` / status: `DATABASE_URL` or component `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`; `JWT_SECRET`, `API_KEY_SECRET`, `ADMIN_JWT_SECRET`; `PORT`, `HOST`, `PGCONNECT_TIMEOUT_MS`; `ALLOWED_ORIGINS`, `ALLOW_PRIVATE_NETWORK_ORIGINS`; `TAILOR_DB_PATH`, `TAILOR_BACKUPS_DIR`; frontend `VITE_API_URL`, `VITE_PUBLIC_API_URL`; Android `EXPO_PUBLIC_API_URL`. Purpose and requirement depend on execution mode; inspect `Backend/.env.example`, `Android/.env.example`, `Backend/DEPLOYMENT.md`, and individual config readers. Never copy actual `.env` contents into documentation or source control.

Desktop development: renderer calls local backend (default `/api` base inferred by API config); Electron runner launches backend and waits for `/health`. Android must point to a reachable PC LAN IP or hosted API; use Connection screen for DHCP changes. Production deployment instructions are in `Backend/DEPLOYMENT.md`; no verified public web frontend deployment exists. Electron installer packaging is `electron-builder.yml` and root `build-electron`; project status says installer build was not performed at its snapshot date. Android release profiles require EAS/project credentials, not present in source audit.

## 10. Completion status by subsystem

| Subsystem | Status | Evidence and verification limits |
|---|---|---|
| Desktop | Implemented but not fully verified | Core CRUD/UI/API feature chain exists. Status note records frontend build; installer and end-to-end runtime flows not established here. |
| Android | Partially implemented | Native screens cover core shop workflows and connection; no print parity/offline data sync. Static checks are recorded in status note; no device session verified. |
| Backend/database | Implemented but not fully verified | Express route/controller/model/migration structure exists; live PostgreSQL CRUD and tenant-isolation tests remain unverified per status note. |
| Admin | Implemented but not verified | Pages and API/admin controllers exist; production access and deployed operation unverified. |
| Website | Not implemented | Only README found. |
| Shared services/integrations | Partially implemented | API/auth/database, backup, updater, API key and Android LAN discovery code exists; live provider behavior/deployment not verified. |

Known source-backed limitations and risks: status note (dated 2026-09-14) reports live two-account isolation and Supabase CRUD tests pending; installer not built at that snapshot; no offline CRUD or synchronization; shared DB credential/client packaging concern described above. Android and desktop measurement defaults differ. No comprehensive automated tests were identified. Website source is absent. A checked-in SQLite database file is not evidence of current production state. Current code has development/production DB branch behavior; reread `config/db.js` because the status note and source comments may represent a transition.

## 11. Instructions for Future AI Coding Agents

1. **Reinspect current code before trusting this guide.** It is an audit snapshot; routes, package scripts, env names and behavior can change.
2. **Authoritative data:** migrations define intended schema; `Backend/config/db.js` defines active adapter/startup; models define SQL; controllers/routes define API behavior. Frontend/Android state is not the authoritative database.
3. **Trace end to end:** find the screen/component and handler, follow `Frontend/src/services/api.js` or `Android/src/services/api.js`, then Express route → middleware → controller → model → migration. Confirm response updates/error handling back in the screen.
4. **Preserve tenancy and roles:** inspect every store-scoped query and auth/role middleware when changing data operations. Do not add an unscoped query. Test with two stores before claiming isolation.
5. **Preserve measurement compatibility:** retain existing JSON keys and legacy/default handling; compare `Frontend/src/utils/measurementUtils.js`, `MeasurementModal.jsx`, `Android/src/constants/measurementFields.js`, Android form/detail and migration 002. Do not normalize Urdu labels/values casually; validate UTF-8 and RTL output.
6. **Platform boundaries:** desktop and Android share backend concepts but not UI components, printer APIs, local storage or necessarily identical field coverage. Website is absent; Admin is separate.
7. **Before completion:** run applicable syntax/import checks and build scripts; exercise create/edit/delete/payment/restore flows and relevant error/empty states; test desktop and Android contract compatibility; test print preview/output for print changes; run live DB and two-tenant checks for backend/data changes. Tests must match the risk and be reported accurately.
8. **Protect data/config:** never expose `.env`, keys, customer data or production DB rows. Review backup restore, recycle-bin permanent deletion/cleanup and migrations for destructive effects. Back up databases and validate a migration on disposable data before production use.
9. **Generated artifacts:** do not hand-edit `node_modules`, `.expo`, `dist`, Android export outputs, lockfiles without dependency changes, or installer assets. Rebuild generated output from source.
10. **Security/deployment:** check whether desktop packages contain server secrets before distribution; do not put privileged DB credentials in Android or browser bundles. Verify CORS, TLS, auth and tenant isolation in actual deployment.

## 12. Feature-to-file index

| Task | Start here | Follow through |
|---|---|---|
| App routes/shell | `Frontend/src/App.jsx`, `Frontend/src/components/Navbar.jsx` | `Frontend/src/style.css`, pages |
| Auth/session desktop | `Frontend/src/contexts/AuthContext.jsx` | `Frontend/src/services/api.js`, `Backend/routes/authRoutes.js`, `Backend/controllers/authController.js`, `Backend/middlewares/auth.js` |
| Customers | `Frontend/src/pages/Customers.jsx`, `Frontend/src/components/CustomerForm.jsx` | API → `Backend/routes/customerRoutes.js` → customer controller/model |
| Measurements and Urdu fields | `Frontend/src/pages/Measurements.jsx`, `Frontend/src/components/MeasurementModal.jsx`, `Frontend/src/utils/measurementUtils.js` | preview/print components → Android constants/forms → measurement routes/controller/model → migrations |
| Measurement print | `Frontend/src/components/MeasurementPreviewModal.jsx`, `MeasurementPrint.jsx` | `Frontend/src/style.css`; test actual print dialog |
| Orders and payments | `Frontend/src/pages/Orders.jsx`, `OrderCard.jsx`, `PaymentModal.jsx` | `OrderPrint.jsx`, order API/routes/controller/model/order number model |
| Budget, salaries, employees | `Frontend/src/pages/Budget.jsx`, `BudgetModal.jsx` | budget API/routes/controller/model; Android Finance/Employees |
| Settings/backups/recycle | `Frontend/src/pages/Settings.jsx`, `RecycleBinSection.jsx` | settings/backup/recycle routes and controllers; owner auth |
| Electron startup/build | `electron/main.js`, root `package.json`, `electron-builder.yml` | Backend `/health`, Frontend dist build |
| Android navigation | `Android/App.js` | `Android/src/screens/`, `src/constants/theme.js` |
| Android server/session | `Android/src/services/serverConfig.js`, `api.js`, `session.js` | `ConnectionScreen.js`, `AuthContext.js`, backend health/CORS |
| Admin dashboard | `Admin/src/App.jsx`, `Admin/src/pages/` | `Admin/src/services/api.js`, admin controllers and middleware |
| Backend startup/database | `Backend/server.js`, `Backend/config/db.js` | `.env.example`, migrations, `DEPLOYMENT.md` |
| API/security/tenant rules | `Backend/routes/`, `middlewares/auth.js`, `middlewares/adminAuth.js` | controllers/models and tenant-isolation tests |
| Public website | No implementation found | `Website/README.md` only |

## 13. Audit limitations and final checks

The repository source was inspected structurally and through key entry points, route mounts, package manifests, migrations, measurement definitions, and existing project status notes. This guide was not validated against a running backend/database, Android device, Electron installer, printer, deployed Admin site, reset-email provider, or production environment. Exact SQL column detail, every individual control callback and CSS container, every responsive breakpoint, and all package scripts should be checked in their files immediately before feature work. No credentials or customer records are reproduced here.
