
import "./Button.css"
import LoadingSpinner from "./LoadingSpinner"

// Reusable button: props control its content, visual variant, HTML type, extra class, and native button attributes.
export default function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  loading = false,
  loadingLabel,
  disabled = false,
  "aria-busy": ariaBusy,
  ...props
}) {
  // Forward remaining props (such as onClick) to the actual HTML button.
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      type={type}
      disabled={loading || disabled}
      aria-busy={loading || ariaBusy || undefined}
      {...props}
    >
      {loading && <LoadingSpinner className="button__spinner" />}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  )
}
