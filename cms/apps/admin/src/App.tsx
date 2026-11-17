import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import Login from "./pages/Login";
import SitesList from "./pages/SiteList";
import SiteLayout from "./pages/SiteLayout";
import SiteDashboard from "./pages/SiteDashboard";
import MediaPage from "./pages/MediaPage";
import SubmissionsPage from "./pages/SubmissionsPage";
import SettingsPage from "./pages/SettingsPage";
import PageEditor from "./pages/PageEditor";

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div style={{ padding: 40, textAlign: "center" }}>Checking auth...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/"
        element={
          <Protected>
            <SitesList />
          </Protected>
        }
      />
      
      <Route
        path="/sites/:siteId"
        element={
          <Protected>
            <SiteLayout />
          </Protected>
        }
      >
        <Route index element={<SiteDashboard />} />
        <Route path="pages/new" element={<PageEditor />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="submissions" element={<SubmissionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}