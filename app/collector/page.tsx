"use client";
import dynamic from "next/dynamic";
import Shell from "@/components/Shell";
import BatchCard from "@/components/BatchCard";
import MatchPicker from "@/components/MatchPicker";
import { useBatches, useProfile } from "@/lib/useProfile";
import { advance, type Batch } from "@/lib/supabase";
import { estimateValue } from "@/lib/plastics";
import { slotLabel } from "@/lib/slots";
import { LANGS, setLang, useLang, type Lang } from "@/lib/i18n";

const BatchMap = dynamic(() => import("@/components/BatchMap"), { ssr: false });

const bigButton = "btn-primary mt-4 min-h-14 w-full text-lg";

export default function CollectorHome() {
  const profile = useProfile("collector");
  const [batches, reload] = useBatches(profile);
  const { t, lang } = useLang();
  const step = async (b: Batch, status: Batch["status"], fields = {}, note: string | null = null) =>
    (await advance(b.id, status, fields, note)) && reload();

  const open = batches.filter((b) => ["matched", "scheduled", "on_the_way", "picked_up"].includes(b.status));
  const section = (title: string, list: Batch[], actions: (b: Batch) => React.ReactNode) => (
    <section>
      <h2 className="section-title">{title} <span className="text-slate-400">({list.length})</span></h2>
      {list.length === 0 && <p className="card text-slate-500">{t("col.none")}</p>}
      <div className="space-y-4">
        {list.map((b) => (
          <BatchCard key={b.id} batch={b}>
            {b.scheduled_at && b.status !== "picked_up" && (
              <p className="mt-2 font-semibold">{t("col.slot")}: {slotLabel(new Date(b.scheduled_at), lang)}</p>
            )}
            {b.batch_addresses && (
              <p className="mt-2 rounded-lg bg-slate-100 p-3 text-sm">
                {t("col.address")}: <b>{b.batch_addresses.address}</b>
                {b.batch_addresses.phone && <><br />{t("col.phone")}: <a href={`tel:${b.batch_addresses.phone}`} className="font-semibold text-emerald-700">{b.batch_addresses.phone}</a></>}
              </p>
            )}
            <p className="mt-2 text-sm">{t("col.value")}: {estimateValue(b.final_type, b.declared_kg)}</p>
            {b.verify_at_pickup && <p className="text-sm font-medium text-amber-800">{t("col.verify")}</p>}
            {actions(b)}
          </BatchCard>
        ))}
      </div>
    </section>
  );

  return (
    <Shell profile={profile} title={t("nav.pickups")}>
      <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-24">
          {/* big language buttons for the simple collector mode (the small switch is in the header too) */}
          <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1" role="group" aria-label={t("language")}>
            {(Object.keys(LANGS) as Lang[]).map((l) => (
              <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                className="min-h-11 flex-1 rounded-lg text-sm font-medium text-slate-600 aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:text-slate-900 aria-pressed:shadow-sm">
                {LANGS[l]}
              </button>
            ))}
          </div>
          {profile && (
            <div className="card p-2 sm:p-2">
              <BatchMap pins={[
                { lat: profile.lat, lng: profile.lng, label: t("you"), me: true },
                ...open.map((b) => ({ lat: b.lat, lng: b.lng, label: `${b.final_type} · ${b.declared_kg} ${t("kg")} · ${b.area}` })),
              ]} />
            </div>
          )}
        </aside>

        <div className="space-y-8">
          {section(t("col.requests"), open.filter((b) => b.status === "matched"), (b) => (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="btn-secondary min-h-14"
                onClick={() => step(b, "requested", { scheduled_at: null }, "Collector can't make this slot")}>
                {t("col.decline")}
              </button>
              <button className="btn-primary min-h-14"
                onClick={() => step(b, "scheduled", {}, `Confirmed ${slotLabel(new Date(b.scheduled_at!))}`)}>
                {t("col.confirm")}
              </button>
            </div>
          ))}

          {section(t("col.confirmed"), open.filter((b) => b.status === "scheduled"), (b) => (
            <button className={bigButton} onClick={() => step(b, "on_the_way")}>{t("col.leaving")}</button>
          ))}

          {section(t("col.onTheWay"), open.filter((b) => b.status === "on_the_way"), (b) => (
            <button className={bigButton} onClick={() => step(b, "picked_up", {}, `+${Math.floor(b.declared_kg * 10)} coins to the user`)}>
              {t("col.pickedUp")}
            </button>
          ))}

          {section(t("col.collected"), open.filter((b) => b.status === "picked_up"), (b) => (
            <MatchPicker batch={b} role="recycler" label={t("col.deliver")}
              onPick={(r) => step(b, "delivered", { recycler_id: r.id }, `Delivered to ${r.name}`)} />
          ))}
        </div>
      </div>
    </Shell>
  );
}
