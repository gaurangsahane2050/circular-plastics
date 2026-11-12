"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Factory, House, MapPin, QrCode, ScanLine, Truck } from "lucide-react";
import Logo from "@/components/Logo";
import Monster from "@/components/Monster";
import LanguageSwitch from "@/components/LanguageSwitch";
import { supabase, homeFor } from "@/lib/supabase";
import { useLang, type Key } from "@/lib/i18n";

// one tap per role for the live demo (fictional accounts from supabase/seed.sql)
const DEMO_LOGINS = [
  { email: "user@demo.test", label: "role.generator", hint: "Sagar Heights CHS", Icon: House },
  { email: "collector@demo.test", label: "role.collector", hint: "Asha Scrap Collectors", Icon: Truck },
  { email: "recycler@demo.test", label: "role.recycler", hint: "Circle Polymers", Icon: Factory },
  { email: "plantx@demo.test", label: "role.plantx", hint: null, Icon: BarChart3 },
];

const FEATURES = [
  { Icon: ScanLine, text: "login.f1" },
  { Icon: MapPin, text: "login.f2" },
  { Icon: QrCode, text: "login.f3" },
];

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useLang();

  async function login(mail: string, pass: string) {
    setBusy(true);
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: pass });
    if (error) {
      setError(error.message === "Invalid login credentials" ? t("login.wrong") : error.message);
      setBusy(false);
      return;
    }
    const { data: me } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    router.replace(homeFor(me?.role));
    // Next keeps this page alive in the background, so get it ready for the next sign-in (after log out)
    setBusy(false);
    setPassword("");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <section className="bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-700 px-6 py-8 text-white lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="flex items-center justify-between gap-3">
          <Logo light />
          <LanguageSwitch light />
        </div>
        <div className="mt-10 max-w-xl lg:mt-0">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">{t("login.headline")}</h1>
          <p className="mt-4 text-emerald-100 lg:text-lg">
            {t("login.sub")}
          </p>
          <ul className="mt-8 hidden space-y-4 sm:block">
            {FEATURES.map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><Icon size={20} /></span>
                {t(text as Key)}
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden items-end justify-between lg:flex">
          <p className="text-sm text-emerald-200">{t("login.footer")}</p>
          <Monster mood="happy" message={t("m.hello")} size={140} />
        </div>
      </section>

      <section className="flex justify-center px-4 py-8 sm:py-12 lg:items-center">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold tracking-tight">{t("login.title")}</h2>
          <p className="mt-1 text-slate-600">{t("login.pick")}</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {DEMO_LOGINS.map(({ email, label, hint, Icon }) => (
              <button key={email} disabled={busy} onClick={() => login(email, "demo1234")}
                className="option flex flex-col gap-2 disabled:opacity-50">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icon size={20} /></span>
                <span>
                  <span className="block font-semibold">{t(label as Key)}</span>
                  <span className="text-sm text-slate-500">{hint ?? t("login.plantxHint")}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-sm text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> {t("login.or")} <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); login(email, password); }} className="space-y-4">
            <label className="label">
              {t("login.email")}
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" autoComplete="email" />
            </label>
            <label className="label">
              {t("login.password")}
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="current-password" />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="btn-primary w-full">{busy ? t("login.busy") : t("login.title")}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-600">
            {t("login.new")} <Link href="/signup" className="font-semibold text-emerald-700">{t("login.create")}</Link>
          </p>
          <p className="mt-6 text-center text-xs text-slate-500 lg:hidden">{t("login.footer")}</p>
        </div>
      </section>
    </div>
  );
}
