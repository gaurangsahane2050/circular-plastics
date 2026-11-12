"use client";
import Link from "next/link";
import { ItemsLine } from "./BatchCard";
import { STATUSES, typesOf, type Batch, type Status } from "@/lib/supabase";
import { slotLabel } from "@/lib/slots";
import { useLang } from "@/lib/i18n";

export type StepEvent = { batch_id: string; to_status: Status; created_at: string };

// Order-tracking view (like a parcel): every step of the pickup, when it happened, and what's next.
export default function Tracker({ batch, events, children }: { batch: Batch; events: StepEvent[]; children?: React.ReactNode }) {
  const { t, lang, locale } = useLang();
  const time = (iso: string) => new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const coins = Math.floor(batch.declared_kg * 10);
  // the line under the current step
  const vars = {
    who: batch.collector?.name ?? t("tr.theCollector"),
    slot: batch.scheduled_at ? slotLabel(new Date(batch.scheduled_at), lang) : "",
    coins,
    kg: batch.actual_kg ?? "",
  };
  const current = STATUSES.indexOf(batch.status);
  const when = (s: Status) => events.findLast((e) => e.batch_id === batch.id && e.to_status === s)?.created_at;
  const declined = batch.status === "requested" && events.some((e) => e.batch_id === batch.id && e.to_status === "matched");

  return (
    <article className="card">
      <div className="flex items-baseline justify-between">
        <p className="text-lg font-semibold">{typesOf(batch).join(" + ")} · {batch.declared_kg} {t("kg")}</p>
        <Link href={`/batch/${batch.id}`} className="text-sm font-medium text-emerald-700">{t("qrHistory")}</Link>
      </div>
      <ItemsLine batch={batch} />
      {batch.status === "picked_up" && (
        <p className="coin-pop mt-3 rounded-xl bg-amber-100 p-3 text-center font-semibold text-amber-900 ring-1 ring-amber-200">
          {t("tr.complete", { coins })}
        </p>
      )}
      {declined && <p className="mt-2 text-sm text-amber-800">{t("tr.declined")}</p>}

      <ol className="mt-3">
        {STATUSES.map((s, i) => (
          <li key={s} className="relative flex gap-3 pb-4 last:pb-0">
            {i < STATUSES.length - 1 && (
              <span className={`absolute top-5 left-[9px] h-full w-0.5 ${i < current ? "bg-emerald-600" : "bg-slate-200"}`} />
            )}
            <span className={`relative mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 ${i <= current ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"} ${i === current ? "ring-4 ring-emerald-100" : ""}`} />
            <div>
              <p className={i <= current ? "font-semibold" : "text-slate-400"}>{t(`tr.${s}`)}</p>
              {i === current && <p className="text-sm text-slate-700">{t(`tr.${s}D`, vars)}</p>}
              {i <= current && when(s) && <p className="text-xs text-slate-500">{time(when(s)!)}</p>}
            </div>
          </li>
        ))}
      </ol>
      {children}
    </article>
  );
}
