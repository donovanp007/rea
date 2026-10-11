const s = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export const IconPractice = () => <svg {...s}><path d="M3 12h2M7 7v10M11 4v16M15 8v8M19 10v4" /></svg>;
export const IconSets = () => <svg {...s}><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M8 2v4M16 2v4M8 11h8M8 15h5" /></svg>;
export const IconSongs = () => <svg {...s}><circle cx="7" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M10 18V5l11-2v13" /></svg>;
export const IconQueue = () => <svg {...s}><path d="M4 6h12M4 12h12M4 18h8M17 15l4 3-4 3z" /></svg>;
export const IconLoop = () => <svg {...s} width={20} height={20} strokeWidth={2.2}><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></svg>;
export const IconPlay = ({ size = 26 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4v16l13-8z" /></svg>;
export const IconPause = ({ size = 26 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>;
export const IconPrev = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6 5h2v14H6zM20 5v14L9 12z" /></svg>;
export const IconNext = () => <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16 5h2v14h-2zM4 5v14l11-7z" /></svg>;
export const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
    <rect x="2" y="9" width="5" height="12" rx="2" fill="var(--sec-verse)" />
    <rect x="9" y="4" width="5" height="22" rx="2" fill="var(--sec-chorus)" />
    <rect x="16" y="11" width="5" height="8" rx="2" fill="var(--sec-bridge)" />
    <rect x="23" y="7" width="5" height="16" rx="2" fill="var(--accent)" />
  </svg>
);
