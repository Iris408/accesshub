import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import AuthProvider from "./auth/AuthProvider";
import AppShell from "./components/layout/AppShell";
import I18nProvider from "./i18n/I18nProvider";
import { PLANNED_NAV } from "./components/layout/navigation";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import AdminPage from "./pages/AdminPage";
import HelpPage from "./pages/HelpPage";
import NotFoundPage from "./pages/NotFoundPage";
import UnavailablePage from "./pages/UnavailablePage";

function App() {

  return (

    <BrowserRouter>

      <I18nProvider>

      <Routes>

        <Route path="/" element={<LoginPage />} />

        <Route
          element={
            <AuthProvider>
              <AppShell />
            </AuthProvider>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/admin" element={<AdminPage />} />

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
