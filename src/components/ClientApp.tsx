"use client";
import dynamic from "next/dynamic";

// The whole app runs in the browser: audio, analysis and storage are all on-device.
const App = dynamic(() => import("./App").then((m) => m.App), { ssr: false });

export function ClientApp() {
  return <App />;
}
