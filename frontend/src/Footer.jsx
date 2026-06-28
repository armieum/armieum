function Footer({ onNavigate }) {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <span>© {year} Armieum Intelligent Systems. All rights reserved.</span>
      <nav>
        <button type="button" className="link-inline" onClick={() => onNavigate("pricing")}>
          Pricing
        </button>
        <button type="button" className="link-inline" onClick={() => onNavigate("terms")}>
          Terms of Service
        </button>
        <button type="button" className="link-inline" onClick={() => onNavigate("privacy")}>
          Privacy Policy
        </button>
        <button type="button" className="link-inline" onClick={() => onNavigate("contact")}>
          Contact
        </button>
      </nav>
    </footer>
  );
}

export default Footer;
