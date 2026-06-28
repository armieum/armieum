import Logo from "./Logo";

const CONTENT = {
  pricing: {
    title: "Pricing",
    body: "[Insert your pricing tiers here — e.g. hardware cost, subscription fee, installation charges.]",
  },
  terms: {
    title: "Terms of Service",
    body: "[Insert your Terms of Service here before launch. This should be drafted or reviewed by a qualified professional for your jurisdiction.]",
  },
  privacy: {
    title: "Privacy Policy",
    body: "[Insert your Privacy Policy here, covering what data Armieum collects (account info, Wi-Fi credentials in transit, device usage) and how it is stored and protected.]",
  },
  contact: {
    title: "Contact Us",
    body: "[Insert your real business contact details here — support email, phone number, registered address.]",
  },
  "reset-password": {
    title: "Reset your password",
    body: "Self-service password reset isn't available yet in this preview. Please contact support to have your password reset manually for now.",
    isPlaceholder: false,
  },
};

function PlaceholderPage({ page, onBack }) {
  const content = CONTENT[page] || CONTENT.contact;
  const isPlaceholder = content.isPlaceholder !== false;

  return (
    <main className="control-center">
      <section className="hero card reveal-up placeholder-page">
        <div className="brand-block">
          <div className="logo-row">
            <Logo size={40} />
          </div>
          <h1>{content.title}</h1>
          <p className="placeholder-note">
            {isPlaceholder ? "This is placeholder content. " : ""}
            {content.body}
          </p>
          <button className="btn ghost link-btn" type="button" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    </main>
  );
}

export default PlaceholderPage;
