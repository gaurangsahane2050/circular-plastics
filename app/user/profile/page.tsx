"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import Shell from "@/components/Shell";
import { AddressFields, PersonalFields } from "@/components/ProfileFields";
import { useProfile } from "@/lib/useProfile";
import { addressFrom, detailsFrom } from "@/lib/areas";
import { supabase, type Address, type Profile } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";

export default function ProfilePage() {
  const loaded = useProfile("generator");
  const { t } = useLang();
  const [edited, setEdited] = useState<Profile | null>(null); // shows the new name right after saving
  const profile = edited ?? loaded;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadAddresses = useCallback(() => {
    supabase.from("addresses").select("*").order("created_at").then(({ data }) => setAddresses(data ?? []));
  }, []);
  useEffect(() => {
    if (loaded) loadAddresses();
  }, [loaded, loadAddresses]);

  async function saveDetails(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const details = detailsFrom(new FormData(e.currentTarget));
    const { error } = await supabase.from("profiles").update(details).eq("id", profile!.id);
    if (error) return alert(error.message);
    setEdited({ ...profile!, ...details });
    setSaved(true);
  }

  async function addAddress(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { error } = await supabase.from("addresses").insert(addressFrom(new FormData(e.currentTarget)));
    if (error) return alert(error.message);
    setAdding(false);
    loadAddresses();
  }

  async function removeAddress(id: string) {
    await supabase.from("addresses").delete().eq("id", id);
    loadAddresses();
  }

  return (
    <Shell profile={profile} title={t("nav.profile")} subtitle={t("prof.sub")}>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <form onSubmit={saveDetails} onChange={() => setSaved(false)} className="card space-y-4">
          <h2 className="font-semibold">{t("prof.details")}</h2>
          {profile && <PersonalFields profile={profile} />}
          <p className="text-xs text-slate-500">{t("prof.privacy")}</p>
          <div className="flex items-center gap-3">
            <button className="btn-primary">{t("prof.save")}</button>
            {saved && <span role="status" className="text-sm font-medium text-emerald-700">{t("prof.saved")}</span>}
          </div>
        </form>

        <section className="card">
          <h2 className="font-semibold">{t("prof.addresses")}</h2>
          <p className="text-sm text-slate-600">{t("prof.addressesHelp")}</p>
          <ul className="mt-4 space-y-2">
            {addresses.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                <MapPin size={18} className="mt-0.5 shrink-0 text-emerald-700" />
                <span className="flex-1 text-sm">
                  <b>{a.label}</b>
                  <span className="block text-slate-600">{a.line}, {a.area}</span>
                </span>
                <button onClick={() => removeAddress(a.id)} disabled={addresses.length === 1} aria-label={t("prof.delete", { label: a.label })}
                  title={addresses.length === 1 ? t("prof.keepOne") : t("prof.delete", { label: a.label })}
                  className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <form onSubmit={addAddress} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
              <AddressFields />
              <div className="flex gap-3">
                <button className="btn-primary">{t("prof.saveAddress")}</button>
                <button type="button" onClick={() => setAdding(false)} className="btn-secondary">{t("prof.cancel")}</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setAdding(true)} className="btn-secondary mt-4 w-full"><Plus size={18} /> {t("prof.add")}</button>
          )}
        </section>
      </div>
    </Shell>
  );
}
