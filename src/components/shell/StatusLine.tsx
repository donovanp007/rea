"use client";
import { useApp } from "@/lib/store/appStore";

export function StatusLine() {
  const status = useApp((s) => s.status);
  return (
    <div className="status" role="status">
      {status?.busy && <i className="spin" aria-hidden />}
      {status?.text}
    </div>
  );
}
