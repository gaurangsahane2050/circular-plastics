"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import Tracker, { type StepEvent } from "@/components/Tracker";
import BookPickup from "@/components/BookPickup";
import { useBatches, useProfile } from "@/lib/useProfile";
import { supabase, typesOf } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";

// All of a user's recycling orders: the ones in progress with their tracker, then the history.
export default function MyWaste() {
  const profile = useProfile("generator");
  const { t, locale } = useLang();
  const [batches, reload, loaded] = useBatches(profile);
  const [events, setEvents] = useState<StepEvent[]>([]);

  // tracking steps of my batches (RLS only returns mine)
  useEffect(() => {
    if (!profile) return;
    supabase.from("status_events").select("batch_id, to_status, created_at").order("id").then(({ data }) => setEvents(data ?? []));
  }, [profile, batches]);

  // in progress until the collector hands it to the recycler
  const active = batches.filter((b) => b.status !== "delivered" && b.status !== "recycled");
  const done = batches.filter((b) => !active.includes(b));

  return (
    <Shell profile={profile} title={t("nav.waste")} subtitle={t("waste.sub")}>
      <h2 className="section-title">{t("waste.active")} <span className="text-slate-400">({active.length})</span></h2>
      {loaded && active.length === 0 && (
        <p className="card text-slate-500">
          {t("waste.nothing")} <Link href="/user/new" className="font-semibold text-emerald-700">{t("home.feed")}</Link>
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {active.map((b) => (
          <Tracker key={b.id} batch={b} events={events}>
            {b.status === "requested" && <BookPickup batch={b} onBooked={reload} />}
          </Tracker>
        ))}
      </div>

      <h2 className="section-title mt-10">{t("waste.history")} <span className="text-slate-400">({done.length})</span></h2>
      <ul className="card divide-y divide-slate-100 p-0 sm:p-0">
        {done.map((b) => (
          <li key={b.id}>
            <Link href={`/batch/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-slate-50">
              <span>
                <b>{typesOf(b).join(" + ")}</b> · {b.actual_kg ?? b.declared_kg} {t("kg")}
                <span className="text-slate-500"> · {new Date(b.created_at).toLocaleDateString(locale)}</span>
              </span>
              <span className="text-right text-slate-600">
                {t(`status.${b.status}`)} · <span className="font-medium text-amber-600">{t("plusCoins", { n: Math.floor(b.declared_kg * 10) })}</span>
              </span>
            </Link>
          </li>
        ))}
        {loaded && done.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">{t("waste.noneDone")}</li>}
      </ul>
    </Shell>
  );
}
