import { useState } from "react";
import { apiFetch } from "./api";
import Logo from "./Logo";

function ProvisionWifi({ token, hubId, onProvisioned }) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setStatus("joining");

    try {
      await apiFetch("/api/hubs/provision-wifi", {
        token,
        method: "POST",
        body: JSON.stringify({ ssid, password }),
      });
      setStatus("joined");
      setTimeout(onProvisioned, 1800);
    } catch (err) {
      setStatus("idle");
      setError(err.message || "Could not reach the hub");
    }
  }

  return (
    <main className="control-center">
      <section className="hero card reveal-up auth-card">
        <div className="brand-block">
          <div className="logo-row">
            <Logo size={40} />
          </div>
          <h1>Connect {hubId} to your Wi-Fi</h1>
          <p className="hero-copy">
            Enter your home network's name and password. They're sent directly and securely to
            your master hub so it can join your network — Armieum never stores your Wi-Fi
            password after the hub has connected.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Wi-Fi network name (SSID)
              <input
                type="text"
                value={ssid}
                onChange={(event) => setSsid(event.target.value)}
                required
              />
            </label>
            <label>
              Wi-Fi password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? <p className="banner error">{error}</p> : null}
            {status === "joining" ? (
              <p className="banner hint">Sending credentials to hub and waiting for it to join...</p>
            ) : null}
            {status === "joined" ? (
              <p className="banner hint">Hub joined Wi-Fi. Opening dashboard...</p>
            ) : null}

            <button className="btn primary" type="submit" disabled={status !== "idle"}>
              {status === "idle" ? "Connect" : "Connecting..."}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default ProvisionWifi;
