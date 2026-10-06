import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { closeDataFolder } from "./services/dataFolder";
import "./index.css";

// Close the database cleanly before the window goes away, so the synced .db file is consistent.
void getCurrentWindow().onCloseRequested(async () => {
  await closeDataFolder();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
