import { useState } from "react";
import { apiFetch } from "./api";
import Logo from "./Logo";

function ClaimHub({ token, onClaimed }) {
  const [hubId, setHubId] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      await apiFetch("/api/hubs/claim", {
        token,
        method: "POST",
        body: JSON.stringify({ hubId: hubId.trim(), secret: secret.trim() }),
      });
      onClaimed();
    } catch (err) {
      setError(err.message || "Could not claim hub");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="control-center">
      <section className="hero card reveal-up auth-card">
        <div className="brand-block">
          <div className="logo-row">
            <Logo size={40} />
          </div>
          <h1>Connect your master hub</h1>
          <p className="hero-copy">
            Enter the hub ID and claim code printed on your master hub's label (or provided by
            your installer). This links your account to that hub only — permanently and
            exclusively, so no one else can ever control it.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Hub ID
              <input
                type="text"
                placeholder="MH-XXXXXX"
                value={hubId}
                onChange={(event) => setHubId(event.target.value)}
                required
              />
            </label>
            <label>
              Claim secret
              <input
                type="text"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                required
              />
            </label>

            {error ? <p className="banner error">{error}</p> : null}

            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Claiming..." : "Claim hub"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default ClaimHub;
