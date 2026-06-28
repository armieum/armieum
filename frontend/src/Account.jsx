import { useState } from "react";
import { apiFetch } from "./api";
import Logo from "./Logo";

function Account({ token, profile, onUpdated, onBack }) {
  const [fields, setFields] = useState({
    fullName: profile?.fullName || "",
    phoneNumber: profile?.phoneNumber || "",
    addressLine1: profile?.addressLine1 || "",
    addressLine2: profile?.addressLine2 || "",
    city: profile?.city || "",
    state: profile?.state || "",
    postalCode: profile?.postalCode || "",
    country: profile?.country || "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function updateField(field, value) {
    setFields((prev) => ({ ...prev, [field]: value }));
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);

    try {
      const data = await apiFetch("/api/account", {
        token,
        method: "PATCH",
        body: JSON.stringify(fields),
      });
      setSuccess("Account details saved.");
      onUpdated(data.user);
    } catch (err) {
      setError(err.message || "Could not save account details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="control-center">
      <section className="hero card reveal-up auth-card setup-card">
        <div className="brand-block">
          <div className="logo-row">
            <Logo size={40} />
          </div>
          <h1>Your account</h1>
          <p className="hero-copy">{profile?.email}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Full name
              <input
                type="text"
                value={fields.fullName}
                onChange={(event) => updateField("fullName", event.target.value)}
                required
              />
            </label>
            <label>
              Phone number
              <input
                type="tel"
                value={fields.phoneNumber}
                onChange={(event) => updateField("phoneNumber", event.target.value)}
                required
              />
            </label>

            <div className="address-fields">
              <label>
                Address line 1
                <input
                  type="text"
                  value={fields.addressLine1}
                  onChange={(event) => updateField("addressLine1", event.target.value)}
                />
              </label>
              <label>
                Address line 2
                <input
                  type="text"
                  value={fields.addressLine2}
                  onChange={(event) => updateField("addressLine2", event.target.value)}
                />
              </label>
              <label>
                City
                <input
                  type="text"
                  value={fields.city}
                  onChange={(event) => updateField("city", event.target.value)}
                />
              </label>
              <label>
                State
                <input
                  type="text"
                  value={fields.state}
                  onChange={(event) => updateField("state", event.target.value)}
                />
              </label>
              <label>
                Postal code
                <input
                  type="text"
                  value={fields.postalCode}
                  onChange={(event) => updateField("postalCode", event.target.value)}
                />
              </label>
              <label>
                Country
                <input
                  type="text"
                  value={fields.country}
                  onChange={(event) => updateField("country", event.target.value)}
                />
              </label>
            </div>

            {error ? <p className="banner error">{error}</p> : null}
            {success ? <p className="banner hint">{success}</p> : null}

            <div className="action-row">
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save changes"}
              </button>
              <button type="button" className="btn ghost" onClick={onBack} disabled={busy}>
                Back to dashboard
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default Account;
