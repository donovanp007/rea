type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconHome = ({ size = 20 }: P) => <svg {...base(size)}><path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" /></svg>;
export const IconCalendar = ({ size = 20 }: P) => <svg {...base(size)}><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /><circle cx="8.5" cy="14.5" r="1" fill="currentColor" /><circle cx="12" cy="14.5" r="1" fill="currentColor" /></svg>;
export const IconPractice = ({ size = 20 }: P) => <svg {...base(size)}><path d="M3 12h1.5M7 8v8M11 4.5v15M15 8.5v7M19 10.5v3M21 12h0" /></svg>;
export const IconSets = ({ size = 20 }: P) => <svg {...base(size)}><rect x="4" y="4.5" width="16" height="16" rx="3" /><path d="M8 2.5v4M16 2.5v4M8 11h8M8 15h5" /></svg>;
export const IconSongs = ({ size = 20 }: P) => <svg {...base(size)}><circle cx="7" cy="17.5" r="2.5" /><circle cx="18" cy="15.5" r="2.5" /><path d="M9.5 17.5V5.5l11-2v12" /></svg>;
export const IconQueue = ({ size = 20 }: P) => <svg {...base(size)}><path d="M4 6h12M4 11h12M4 16h7" /><path d="M16 14.5v6l5-3z" fill="currentColor" /></svg>;
export const IconLoop = ({ size = 20 }: P) => <svg {...base(size)}><path d="M17 3l3 3-3 3" /><path d="M4 11V9.5A3.5 3.5 0 0 1 7.5 6H20" /><path d="M7 21l-3-3 3-3" /><path d="M20 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4" /></svg>;
export const IconPrev = ({ size = 20 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M6 5h2v14H6zM19 5.5v13L9.5 12z" /></svg>;
export const IconNext = ({ size = 20 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16 5h2v14h-2zM5 5.5v13L14.5 12z" /></svg>;
export const IconPlay = ({ size = 22 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7z" /></svg>;
export const IconPause = ({ size = 22 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>;
export const IconZoomIn = ({ size = 17 }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M8.5 11h5M11 8.5v5" /></svg>;
export const IconZoomOut = ({ size = 17 }: P) => <svg {...base(size)}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M8.5 11h5" /></svg>;
export const IconFit = ({ size = 16 }: P) => <svg {...base(size)}><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /></svg>;
export const IconFlag = ({ size = 15 }: P) => <svg {...base(size)}><path d="M6 21V4M6 4h11l-2.5 4L17 12H6" /></svg>;
export const IconSave = ({ size = 15 }: P) => <svg {...base(size)}><path d="M6 3.5h12v17l-6-4-6 4z" /></svg>;
export const IconX = ({ size = 16 }: P) => <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconFollow = ({ size = 15 }: P) => <svg {...base(size)}><path d="M12 3v18M5 9l-3 3 3 3M19 9l3 3-3 3" /></svg>;
export const IconPlus = ({ size = 16 }: P) => <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconTrash = ({ size = 15 }: P) => <svg {...base(size)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const Logo = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
    <rect width="30" height="30" rx="8" fill="#1b212d" />
    <rect x="6" y="11" width="3" height="8" rx="1.5" fill="var(--sec-verse)" />
    <rect x="11" y="7" width="3" height="16" rx="1.5" fill="var(--sec-chorus)" />
    <rect x="16" y="12" width="3" height="6" rx="1.5" fill="var(--sec-bridge)" />
    <rect x="21" y="9" width="3" height="12" rx="1.5" fill="var(--cycle)" />
  </svg>
);
