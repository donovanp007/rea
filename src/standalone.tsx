/**
 * Entry for the single-file build (scripts/build-standalone.mjs): the same app as the
 * Next.js site, rendered straight into #root so it can run from one HTML page.
 */
import { createRoot } from "react-dom/client";
import { App } from "./components/App";

createRoot(document.getElementById("root")!).render(<App />);
