import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { configureAdminAuthFromStorage } from "@/lib/admin-auth";

configureAdminAuthFromStorage();

createRoot(document.getElementById("root")!).render(<App />);
