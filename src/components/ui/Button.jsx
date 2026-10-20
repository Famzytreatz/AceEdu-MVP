
import "./Button.css"

// Reusable button: props control its content, visual variant, HTML type, extra class, and native button attributes.
export default function Button({
  children,
  variant = "primary",
  className = "",
  type = "button",
  ...props
}) {
  // Forward remaining props (such as onClick) to the actual HTML button.
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}

