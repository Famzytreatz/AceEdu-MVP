import { useEffect, useState } from "react"
import { X } from "lucide-react"
import Brand from "../common/Brand"
import Button from "../ui/Button"
import "./Header.css"

const links = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#contact", label: "Contact" },
]

export default function Header({ onOpenModal }) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const closeOnDesktop = () => window.innerWidth > 768 && setMenuOpen(false)
    window.addEventListener("resize", closeOnDesktop)
    return () => window.removeEventListener("resize", closeOnDesktop)
  }, [])

  const closeMenu = () => setMenuOpen(false)

  return (
    <header className="site-header" id="top">
      <Brand />
      <nav
        className={`site-nav ${menuOpen ? "site-nav--open" : ""}`}
        id="mobile-navigation"
        aria-label="Main navigation"
      >
        <div className="site-nav__mobile-head">
          <Brand />
          <button type="button" onClick={closeMenu} aria-label="Close menu">
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {links.map((link) => (
          <a key={link.href} href={link.href} onClick={closeMenu}>
            {link.label}
          </a>
        ))}
        <Button
          variant="secondary"
          className="button--compact site-nav__login"
          onClick={() => {
            closeMenu()
            onOpenModal("login")
          }}
        >
          Login
        </Button>
        <Button
          className="button--compact"
          onClick={() => {
            closeMenu()
            onOpenModal("started")
          }}
        >
          Get Started
        </Button>
      </nav>
      {menuOpen && (
        <button
          className="nav-scrim"
          type="button"
          onClick={closeMenu}
          aria-label="Close menu"
        />
      )}
      <div className="mobile-access">
        <button type="button" onClick={() => onOpenModal("login")}>
          Login
        </button>
        <button
          className="mobile-menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          <img src="/assets/b3376.svg" alt="" aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
