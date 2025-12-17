import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Toaster } from "react-hot-toast";
import { UserContextProvider } from "../context/userContext.jsx";
import { BrowserRouter as Router } from "react-router-dom";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router>
      <UserContextProvider>
        <App />
        <Toaster position="bottom-right" toastOptions={{ duration: 2000 }} />
      </UserContextProvider>
    </Router>
  </StrictMode>
);
