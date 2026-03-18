import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#12121c",
            border: "1px solid #2a2a3e",
            color: "#f0f0f5",
            fontFamily: "Inter, system-ui, sans-serif",
          },
        }}
      />
    </BrowserRouter>
  </StrictMode>,
);
