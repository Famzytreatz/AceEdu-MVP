import "./Brand.css"

export default function Brand({ footer = false }) {
  return (
    <a
      className={`brand ${footer ? "brand--footer" : ""}`}
      href="#top"
      aria-label="AceEdu home"
    >
      <span className="brand__mark">
        <picture>
          {footer && (
            <source media="(max-width: 768px)" srcSet="/assets/1578b.svg" />
          )}
          <img
            src={footer ? "/assets/23c0b.svg" : "/assets/76f42.svg"}
            alt=""
            aria-hidden="true"
          />
        </picture>
      </span>
      <span className="brand__name">
        Ace<span>Edu</span>
      </span>
    </a>
  )
}
