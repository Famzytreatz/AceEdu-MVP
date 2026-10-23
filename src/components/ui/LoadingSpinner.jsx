import "./LoadingSpinner.css"

export default function LoadingSpinner({ className = "" }) {
  return (
    <span
      className={`loading-spinner ${className}`.trim()}
      aria-hidden="true"
    />
  )
}
