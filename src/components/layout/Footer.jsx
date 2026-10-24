
import Brand from "../common/Brand"
import "./Footer.css"

// Footer contains the brand, in-page navigation links, contact link, and legal links.
export default function Footer() {
  return (
    <footer className="site-footer" id="contact">
      <div className="site-footer__top">
        <div className="site-footer__brand">
          <Brand footer />
          <p>The all-in-one school management platform for Nigerian schools.</p>
        </div>
        <div className="site-footer__links">
          <div>
            <h3>Product</h3>
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div>
            <h3>Company</h3>
            <a href="#top">About Us</a>
            <a href="#contact">Contact</a>
          </div>
        </div>
      </div>
      <div className="site-footer__legal">
        <p>© 2026 AceEdu. All rights reserved.</p>
        <div>
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
        </div>
      </div>
    </footer>
  )
}

