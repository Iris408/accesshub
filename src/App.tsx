import { lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import AuthProvider from "./auth/AuthProvider";
import AppShell from "./components/layout/AppShell";
import I18nProvider from "./i18n/I18nProvider";
import OrganisationProvider from "./organisation/OrganisationProvider";
import { PLANNED_NAV } from "./components/layout/navigation";
import LoginPage from "./pages/LoginPage";

// Signed-in pages are split into their own chunks and loaded when first
// visited; AppShell shows a loading state meanwhile. The sign-in page stays in
// the main bundle so the first screen needs no extra request.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AccessRequestsPage = lazy(() => import("./pages/AccessRequestsPage"));
const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const HelpPage = lazy(() => import("./pages/HelpPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const UnavailablePage = lazy(() => import("./pages/UnavailablePage"));

function App() {

  return (

    <BrowserRouter>

      <I18nProvider>

      <Routes>

        <Route path="/" element={<LoginPage />} />

        <Route
          element={
            <AuthProvider>
              <OrganisationProvider>
                <AppShell />
              </OrganisationProvider>
            </AuthProvider>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/admin" element={<AdminPage />} />

          <Route path="/audit-log" element={<AuditLogPage />} />

          <Route path="/access-requests" element={<AccessRequestsPage />} />

          <Route path="/roles" element={<RolesPage />} />

          <Route path="/activity" element={<ActivityPage />} />

          <Route path="/settings" element={<SettingsPage />} />

          {PLANNED_NAV.map((item) => (
            <Route
              key={item.to}
              path={item.to}
              element={<UnavailablePage item={item} />}
            />
          ))}

          <Route path="/help" element={<HelpPage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

      </Routes>

      </I18nProvider>

    </BrowserRouter>

  );
}

export default App;
