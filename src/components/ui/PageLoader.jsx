import "./PageLoader.css"

export default function PageLoader({
  message = "Loading your AceEdu workspace…",

  theme = "light",

  visible = true,
}) {
  return (
    <main
      className="page-loader"
      data-theme={theme}
      data-visible={visible}
      role="status"
      aria-live="polite"
      aria-busy={visible}
      aria-hidden={!visible}
    >
      <div className="page-loader__card">
        <span className="page-loader__emblem" aria-hidden="true">
          <img src="/assets/76f42.svg" alt="" />
        </span>
        <p className="page-loader__brand">
          Ace<span>Edu</span>
        </p>
        <span className="page-loader__progress" aria-hidden="true">
          <span />
        </span>
        <p className="page-loader__message">{message}</p>
      </div>
    </main>
  )
}
