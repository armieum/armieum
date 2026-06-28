import { useState } from "react";
import { apiFetch } from "./api";
import Logo from "./Logo";

const FEATURES = [
  {
    title: "Smart switchboards, not smart appliances",
    body: "Armieum upgrades the wall switchboards already in your home, so every light, fan, and socket becomes controllable — no need to replace a single appliance.",
  },
  {
    title: "Manual switches always work",
    body: "If your Wi-Fi, the internet, or the dashboard itself goes down, the physical wall switch still operates the relay directly. Automation is an addition, never a dependency.",
  },
  {
    title: "One account, one hub, no exceptions",
    body: "Every account is permanently bound to exactly one master hub during setup. No other account can ever claim or control it — there's no shared access by accident.",
  },
  {
    title: "Real-time confirmation, not guesswork",
    body: "Every command you send is acknowledged back from the hardware itself over a live connection, so the dashboard always reflects the true state of your home.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Create your account",
    body: "Sign up with your email — this account will be the only one able to control your hub.",
  },
  {
    step: "2",
    title: "Claim your master hub",
    body: "Enter the hub ID and claim code from your hardware to link it to your account permanently.",
  },
  {
    step: "3",
    title: "Connect it to Wi-Fi and map your rooms",
    body: "Send your Wi-Fi details once, then name your rooms and ports however makes sense to you.",
  },
];

const FAQS = [
  {
    q: "Do I need to replace my existing switches or appliances?",
    a: "No. Armieum's hardware installs behind your existing switchboard and works alongside the physical switches you already have.",
  },
  {
    q: "What happens if the internet goes down?",
    a: "Manual switches keep working locally regardless of network status. Remote/dashboard control resumes automatically once connectivity is restored.",
  },
  {
    q: "Can someone else access my hub?",
    a: "No. Each master hub can only ever be claimed by one account, and that binding is permanent and enforced at the database level.",
  },
  {
    q: "Can I rename my rooms and switches later?",
    a: "Yes. Names are purely for display — renaming a room or port never affects how it's addressed internally, so nothing breaks when you rename things.",
  },
];

const EMPTY_SIGNUP_FIELDS = {
  fullName: "",
  phoneNumber: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
};

function Login({ onAuthenticated, onForgotPassword }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupFields, setSignupFields] = useState(EMPTY_SIGNUP_FIELDS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateSignupField(field, value) {
    setSignupFields((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login" ? { email, password } : { email, password, ...signupFields };
      const data = await apiFetch(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onAuthenticated(data.token);
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="control-center landing-page">
      <section className="hero card reveal-up landing-hero">
        <div className="brand-block landing-copy">
          <div className="logo-row">
            <Logo size={48} />
          </div>
          <h1>Make every switchboard smart.</h1>
          <p className="hero-copy">
            Armieum turns the wall switchboards already in your home into a unified, reliable
            control system — without replacing a single appliance, and without losing manual
            control if the network ever goes down.
          </p>
          <ul className="landing-highlights">
            <li>Works with your existing lights, fans, and sockets</li>
            <li>Manual wall switches always function, network or not</li>
            <li>One account, one hub — permanently and exclusively bound</li>
          </ul>
        </div>

        <div className="landing-auth-box">
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to control your home from one secure dashboard."
              : "Set up your account, then connect it to your master hub in a few steps."}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>

            {mode === "signup" ? (
              <>
                <label>
                  Full name
                  <input
                    type="text"
                    value={signupFields.fullName}
                    onChange={(event) => updateSignupField("fullName", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Phone number
                  <input
                    type="tel"
                    value={signupFields.phoneNumber}
                    onChange={(event) => updateSignupField("phoneNumber", event.target.value)}
                    required
                  />
                </label>

                <details>
                  <summary>Installation address (optional, can add later)</summary>
                  <div className="address-fields">
                    <label>
                      Address line 1
                      <input
                        type="text"
                        value={signupFields.addressLine1}
                        onChange={(event) => updateSignupField("addressLine1", event.target.value)}
                      />
                    </label>
                    <label>
                      Address line 2
                      <input
                        type="text"
                        value={signupFields.addressLine2}
                        onChange={(event) => updateSignupField("addressLine2", event.target.value)}
                      />
                    </label>
                    <label>
                      City
                      <input
                        type="text"
                        value={signupFields.city}
                        onChange={(event) => updateSignupField("city", event.target.value)}
                      />
                    </label>
                    <label>
                      State
                      <input
                        type="text"
                        value={signupFields.state}
                        onChange={(event) => updateSignupField("state", event.target.value)}
                      />
                    </label>
                    <label>
                      Postal code
                      <input
                        type="text"
                        value={signupFields.postalCode}
                        onChange={(event) => updateSignupField("postalCode", event.target.value)}
                      />
                    </label>
                    <label>
                      Country
                      <input
                        type="text"
                        value={signupFields.country}
                        onChange={(event) => updateSignupField("country", event.target.value)}
                      />
                    </label>
                  </div>
                </details>
              </>
            ) : null}

            {error ? <p className="banner error">{error}</p> : null}

            <button className="btn primary" type="submit" disabled={busy}>
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
            </button>
          </form>

          {mode === "login" ? (
            <button className="btn ghost link-btn" type="button" onClick={onForgotPassword}>
              Forgot password?
            </button>
          ) : null}

          <button
            className="btn ghost link-btn"
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>

      <section className="feature-grid reveal-up">
        {FEATURES.map((feature) => (
          <article className="feature-card card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className="card section-card reveal-up">
        <div className="section-head">
          <h3>How it works</h3>
          <span className="muted">From sign-up to a controllable home in three steps</span>
        </div>
        <div className="steps-row">
          {STEPS.map((item) => (
            <div className="step-card" key={item.step}>
              <span className="step-number">{item.step}</span>
              <h4>{item.title}</h4>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card section-card reveal-up">
        <div className="section-head">
          <h3>Frequently asked questions</h3>
        </div>
        <div className="faq-list">
          {FAQS.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Login;
