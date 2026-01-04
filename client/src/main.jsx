import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Toaster } from "react-hot-toast";
import { BrowserRouter as Router } from "react-router-dom";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router>
      <App />
      <Toaster position="bottom-right" toastOptions={{ duration: 2000 }} />
    </Router>
  </StrictMode>
);
