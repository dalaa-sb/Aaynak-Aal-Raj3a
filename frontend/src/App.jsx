import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import useDashboardData from "./hooks/useDashboardData";
import LoginScreen from "./components/auth/LoginScreen";
import SignupScreen from "./components/auth/SignupScreen";
import VerifyEmailScreen from "./components/auth/VerifyEmailScreen";
import ForgotPasswordScreen from "./components/auth/ForgotPasswordScreen";
import ConfirmResetScreen from "./components/auth/ConfirmResetScreen";
import AppLayout from "./components/shared/AppLayout";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import CamerasPage from "./pages/CamerasPage";
import AlertsPage from "./pages/AlertsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import ReportsPage from "./pages/ReportsPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";
import SystemHealthPage from "./pages/SystemHealthPage";
import AuditLogPage from "./pages/AuditLogPage";

function AuthedApp() {
  const data = useDashboardData();
  return (
    <Routes>
      <Route element={<AppLayout wsConnected={data.wsConnected} />}>
        <Route path="/dashboard" element={<ProtectedRoute roles={["admin","security"]}><DashboardPage data={data} /></ProtectedRoute>} />
        <Route path="/cameras" element={<ProtectedRoute roles={["admin","security"]}><CamerasPage data={data} /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute roles={["admin","security"]}><AlertsPage data={data} /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute roles={["admin"]}><AnalyticsPage data={data} /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute roles={["admin"]}><ReportsPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute roles={["admin"]}><UsersPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute roles={["admin","security"]}><SettingsPage /></ProtectedRoute>} />
        <Route path="/health" element={<ProtectedRoute roles={["admin"]}><SystemHealthPage /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute roles={["admin"]}><AuditLogPage /></ProtectedRoute>} />
        {/* /profile redirects to /settings — Profile and Settings are now one page */}
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginScreen />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <SignupScreen />} />
      <Route path="/verify-email" element={<VerifyEmailScreen />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/reset-password" element={<ConfirmResetScreen />} />
      <Route path="/*" element={user ? <AuthedApp /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
