import Link from "next/link";

// Same drawing as app/icon.svg
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#047857" />
      <g fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 33a13 13 0 0 1 22.2-9.2M42 15.5v9h-9" stroke="#fff" />
        <path d="M45 31a13 13 0 0 1-22.2 9.2M22 48.5v-9h9" stroke="#a7f3d0" />
      </g>
    </svg>
  );
}

export default function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2.5">
      <LogoMark />
      <span className={`leading-tight font-bold ${light ? "text-white" : "text-slate-900"}`}>
        Circular Plastics
        <span className={`block text-xs font-medium ${light ? "text-emerald-200" : "text-emerald-700"}`}>Exchange</span>
      </span>
    </Link>
  );
}
