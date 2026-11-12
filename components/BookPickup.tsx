"use client";
import { useState } from "react";
import MatchPicker from "./MatchPicker";
import { advance, supabase, type Batch, type Profile } from "@/lib/supabase";
import { PER_SLOT, openSlots, slotLabel } from "@/lib/slots";
import { useLang } from "@/lib/i18n";

// After listing: pick a collector within 5 km who takes this plastic, then one of their free slots.
// The collector still has to confirm the slot.
export default function BookPickup({ batch, onBooked }: { batch: Batch; onBooked: () => void }) {
  const [collector, setCollector] = useState<Profile | null>(null);
  const [slots, setSlots] = useState<{ start: Date; left: number }[] | null>(null);
  const { t, lang } = useLang();

  async function choose(c: Profile) {
    setCollector(c);
    setSlots(null);
    const { data } = await supabase.rpc("slot_bookings", { collector: c.id });
    setSlots(openSlots(data ?? []));
  }

  async function book(start: Date) {
    const note = `Asked ${collector!.name} for ${slotLabel(start)}`; // the log stays in English
    if (await advance(batch.id, "matched", { collector_id: collector!.id, scheduled_at: start.toISOString() }, note)) onBooked();
  }

  if (!collector) return <MatchPicker batch={batch} role="collector" maxKm={5} label={t("bp.near")} onPick={choose} />;

  return (
    <div className="mt-3">
      <p className="text-sm font-medium">
        {t("bp.pick", { name: collector.name })}
        <button onClick={() => setCollector(null)} className="ml-2 font-normal text-emerald-700 underline">{t("bp.change")}</button>
      </p>
      {!slots && <p className="mt-2 text-sm text-slate-500">{t("bp.loading")}</p>}
      {slots?.length === 0 && <p className="mt-2 text-sm text-red-700">{t("bp.none")}</p>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {slots?.map((s) => (
          <button key={s.start.toISOString()} onClick={() => book(s.start)} className="option text-sm">
            <b>{slotLabel(s.start, lang)}</b>
            <span className="block text-xs text-slate-600">{t("bp.free", { left: s.left, total: PER_SLOT })}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
