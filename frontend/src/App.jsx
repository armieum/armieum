import { useEffect, useState } from "react";
import "./App.css";
import { apiFetch } from "./api";
import Login from "./Login";
import ClaimHub from "./ClaimHub";
import ProvisionWifi from "./ProvisionWifi";
import SetupRooms from "./SetupRooms";
import Dashboard from "./Dashboard";
import Account from "./Account";
import Footer from "./Footer";
import PlaceholderPage from "./PlaceholderPage";

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("armieum_token") || "");
  const [hub, setHub] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [editingLayout, setEditingLayout] = useState(false);
  const [viewingAccount, setViewingAccount] = useState(false);
  const [staticPage, setStaticPage] = useState(null);

  async function refreshMe(activeToken) {
    if (!activeToken) {
      setHub(null);
      setProfile(null);
      setLoadingMe(false);
      return;
    }

    try {
      const data = await apiFetch("/api/auth/me", { token: activeToken });
      setHub(data.hub);
      setProfile(data.user);
    } catch {
      // Token is invalid/expired; force back to login.
      localStorage.removeItem("armieum_token");
      setToken("");
      setHub(null);
      setProfile(null);
    } finally {
      setLoadingMe(false);
    }
  }

  useEffect(() => {
    refreshMe(token);
  }, [token]);

  function handleAuthenticated(newToken) {
    localStorage.setItem("armieum_token", newToken);
    setLoadingMe(true);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem("armieum_token");
    setToken("");
    setHub(null);
    setProfile(null);
  }

  function renderScreen() {
    if (staticPage) {
      return <PlaceholderPage page={staticPage} onBack={() => setStaticPage(null)} />;
    }

    if (!token) {
      return (
        <Login
          onAuthenticated={handleAuthenticated}
          onForgotPassword={() => setStaticPage("reset-password")}
        />
      );
    }

    if (loadingMe) {
      return (
        <main className="control-center">
          <p className="banner hint">Loading your account...</p>
        </main>
      );
    }

    if (viewingAccount) {
      return (
        <Account
          token={token}
          profile={profile}
          onUpdated={(updatedUser) => setProfile(updatedUser)}
          onBack={() => setViewingAccount(false)}
        />
      );
    }

    if (!hub) {
      return <ClaimHub token={token} onClaimed={() => refreshMe(token)} />;
    }

    if (!hub.wifiConfigured) {
      return (
        <ProvisionWifi
          token={token}
          hubId={hub.hubId}
          onProvisioned={() => refreshMe(token)}
        />
      );
    }

    if (!hub.layoutConfigured || editingLayout) {
      return (
        <SetupRooms
          token={token}
          hubId={hub.hubId}
          initialLayout={hub.layout}
          onConfigured={() => {
            setEditingLayout(false);
            refreshMe(token);
          }}
          onCancel={hub.layoutConfigured ? () => setEditingLayout(false) : undefined}
        />
      );
    }

    return (
      <Dashboard
        token={token}
        hubId={hub.hubId}
        onLogout={handleLogout}
        onManageRooms={() => setEditingLayout(true)}
        onViewAccount={() => setViewingAccount(true)}
      />
    );
  }

  return (
    <>
      {renderScreen()}
      <Footer onNavigate={setStaticPage} />
    </>
  );
}

export default App;
