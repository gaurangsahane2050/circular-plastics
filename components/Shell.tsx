"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Camera, Factory, House, LogOut, Package, Truck, UserRound, type LucideIcon } from "lucide-react";
import Logo, { LogoMark } from "./Logo";
import LanguageSwitch from "./LanguageSwitch";
import { supabase, homeFor, type Profile, type Role } from "@/lib/supabase";
import { useLang, type Key } from "@/lib/i18n";

// what each role can open: label, page, icon
const NAV: Record<Role, [Key, string, LucideIcon][]> = {
  generator: [
    ["nav.home", "/user", House], ["nav.feed", "/user/new", Camera], ["nav.waste", "/user/waste", Package],
    ["nav.impact", "/dashboard", BarChart3], ["nav.profile", "/user/profile", UserRound],
  ],
  collector: [["nav.pickups", "/collector", Truck], ["nav.impact", "/dashboard", BarChart3]],
  recycler: [["nav.incoming", "/recycler", Factory], ["nav.impact", "/dashboard", BarChart3]],
  plantx: [["nav.impact", "/dashboard", BarChart3]],
};

// Frame for every logged-in screen: top bar (desktop nav), page title, and a tab bar at the bottom on phones.
export default function Shell({ profile, title, subtitle, children }: {
  profile: Profile | null;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const { t } = useLang();

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="animate-pulse"><LogoMark size={56} /></div>
      </div>
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }
  const nav = NAV[profile.role];

  return (
    <div className="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:gap-8 md:px-8">
          <Logo href={homeFor(profile.role)} />
          <nav className="hidden gap-1 md:flex">
            {nav.map(([label, href, Icon]) => (
              <Link key={href} href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${path === href ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-100"}`}>
                <Icon size={18} /> {t(label)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitch />
            <div className="hidden text-right lg:block">
              <p className="text-sm font-semibold">{profile.name}</p>
              <p className="text-xs text-slate-500">{t(`role.${profile.role}`)} · {profile.area}</p>
            </div>
            <button onClick={logout} aria-label={t("logout")} title={t("logout")}
              className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        <p className="mt-1 mb-6 text-slate-600">{subtitle ?? `${profile.name} · ${profile.area}`}</p>
        {children}
      </main>

      {nav.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${nav.length}, 1fr)` }}>
            {nav.map(([label, href, Icon]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${path === href ? "text-emerald-700" : "text-slate-500"}`}>
                <Icon size={22} strokeWidth={path === href ? 2.4 : 1.8} /> {t(label)}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
