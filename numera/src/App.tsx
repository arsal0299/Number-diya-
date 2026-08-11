import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { SettingsProvider } from "./context/SettingsContext";
import { Background } from "./components/Background";

import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/app/Dashboard";
import { TopUp } from "./pages/app/TopUp";
import { TempMail } from "./pages/app/TempMail";
import { History } from "./pages/app/History";

import { AdminLayout } from "./components/layout/AdminLayout";
import { AdminDashboard } from "./pages/admin/AdminDashboard";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { AdminUserDetail } from "./pages/admin/AdminUserDetail";
import { AdminPayments } from "./pages/admin/AdminPayments";
import { AdminSettings } from "./pages/admin/AdminSettings";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SettingsProvider>
          <AuthProvider>
            <ToastProvider>
              <Background />
              <Routes>
                {/* Public */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* User app */}
                <Route
                  path="/dashboard"
                  element={
                    <AppLayout>
                      <Dashboard />
                    </AppLayout>
                  }
                />
                <Route
                  path="/topup"
                  element={
                    <AppLayout>
                      <TopUp />
                    </AppLayout>
                  }
                />
                <Route
                  path="/mail"
                  element={
                    <AppLayout>
                      <TempMail />
                    </AppLayout>
                  }
                />
                <Route
                  path="/history"
                  element={
                    <AppLayout>
                      <History />
                    </AppLayout>
                  }
                />

                {/* Admin */}
                <Route
                  path="/admin"
                  element={
                    <AdminLayout>
                      <AdminDashboard />
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/users"
                  element={
                    <AdminLayout>
                      <AdminUsers />
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/users/:id"
                  element={
                    <AdminLayout>
                      <AdminUserDetail />
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/payments"
                  element={
                    <AdminLayout>
                      <AdminPayments />
                    </AdminLayout>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <AdminLayout>
                      <AdminSettings />
                    </AdminLayout>
                  }
                />

                <Route path="*" element={<Home />} />
              </Routes>
            </ToastProvider>
          </AuthProvider>
        </SettingsProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
