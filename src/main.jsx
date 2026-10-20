
// Application entry point: load React, the main App component, and the global styles.
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "./styles/variables.css"
import "./styles/global.css"
import "./styles/responsive.css"

// Find the #root element from index.html and mount the React application inside it.
// StrictMode enables extra development checks; it does not add visible UI.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

