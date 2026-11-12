"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { AddressFields, PersonalFields } from "@/components/ProfileFields";
import { addressFrom, detailsFrom } from "@/lib/areas";
import LanguageSwitch from "@/components/LanguageSwitch";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";

// New households, societies and shops sign up here. Collectors and recyclers are added by the team.
export default function SignUp() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { t } = useLang();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const address = addressFrom(form);
    const fail = (message: string) => {
      setError(message);
      setBusy(false);
    };

    // 1. the login itself
    const { data, error } = await supabase.auth.signUp({ email: String(form.get("email")), password: String(form.get("password")) });
    if (error || !data.user) return fail(error?.message ?? t("signup.failed"));
    // 2. the profile, placed at the first address's area for now
    const profile = await supabase.from("profiles").insert({
      id: data.user.id, role: "generator", ...detailsFrom(form), area: address.area, lat: address.lat, lng: address.lng,
    });
    if (profile.error) return fail(profile.error.message);
    // 3. the first saved address
    const saved = await supabase.from("addresses").insert(address);
    if (saved.error) return fail(saved.error.message);
    router.replace("/user");
    setBusy(false); // this page stays alive in the background
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4"><Logo /><LanguageSwitch /></div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("signup.title")}</h1>
        <p className="mt-1 text-slate-600">{t("signup.sub")}</p>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <section className="card space-y-4">
            <h2 className="font-semibold">{t("signup.about")}</h2>
            <PersonalFields />
          </section>
          <section className="card space-y-4">
            <h2 className="font-semibold">{t("signup.address")}</h2>
            <p className="text-sm text-slate-600">{t("signup.later")}</p>
            <AddressFields />
          </section>
          <section className="card grid gap-4 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">{t("signup.signin")}</h2>
            <label className="label">
              {t("login.email")}
              <input name="email" type="email" required className="input" autoComplete="email" />
            </label>
            <label className="label">
              {t("login.password")} <span className="font-normal text-slate-500">{t("signup.min")}</span>
              <input name="password" type="password" required minLength={6} className="input" autoComplete="new-password" />
            </label>
          </section>
          <p className="text-xs text-slate-500">
            {t("signup.privacy")}
          </p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="btn-primary w-full">{busy ? t("signup.busy") : t("signup.button")}</button>
          <p className="text-center text-sm text-slate-600">
            {t("signup.have")} <Link href="/" className="font-semibold text-emerald-700">{t("login.title")}</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
