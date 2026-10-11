"use client";
import { useEffect } from "react";
import { clearStatus } from "@/lib/actions";
import { useApp } from "@/lib/store/appStore";
import { IconX } from "./icons";

/** Status messages float at the top so they're seen on any screen and any scroll position. */
export function Toast() {
  const status = useApp((s) => s.status);
  useEffect(() => {
    if (!status || status.busy) return;
    const t = setTimeout(clearStatus, 6500);
    return () => clearTimeout(t);
  }, [status]);
  if (!status) return null;
  return (
    <div className="toast" role="status">
      {status.busy && <i className="spin" aria-hidden />}
      <span>{status.text}</span>
      {!status.busy && <button type="button" className="x" aria-label="Dismiss" onClick={clearStatus}><IconX size={14} /></button>}
    </div>
  );
}
