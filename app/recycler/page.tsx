"use client";
import Shell from "@/components/Shell";
import BatchCard from "@/components/BatchCard";
import { useBatches, useProfile } from "@/lib/useProfile";
import { advance, type Batch } from "@/lib/supabase";
import { PLASTICS, estimateValue } from "@/lib/plastics";
import { useLang } from "@/lib/i18n";

// Recycler weighs the batch, checks the real plastic type and grades it.
// The database works out the weight flag (more than 20% off the declared weight).
function ReceiptForm({ batch, onDone }: { batch: Batch; onDone: () => void }) {
  const { t } = useLang();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const kg = Number(form.get("kg"));
    const type = form.get("type");
    const grade = form.get("grade");
    const note = `Weighed ${kg} kg, ${type}, grade ${grade}`;
    if (await advance(batch.id, "recycled", { actual_kg: kg, actual_type: type, quality_grade: grade }, note)) onDone();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      <label className="label">
        {t("rec.actual")} <span className="font-normal text-slate-500">· {t("rec.declared", { kg: batch.declared_kg })}</span>
        <input name="kg" type="number" step="0.1" min="0.1" required inputMode="decimal" className="input" />
      </label>
      <label className="label">
        {t("rec.found")}
        <select name="type" defaultValue={batch.final_type} className="input">
          {PLASTICS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="label">{t("rec.grade")} <span className="font-normal text-slate-500">{t("rec.gradeHelp")}</span></legend>
        <div className="mt-1 flex gap-2">
          {["A", "B", "C"].map((g) => (
            <label key={g} className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-slate-200 font-semibold has-checked:border-emerald-700 has-checked:bg-emerald-50">
              <input type="radio" name="grade" value={g} required defaultChecked={g === "A"} /> {g}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="btn-primary w-full">{t("rec.confirm")}</button>
    </form>
  );
}

export default function RecyclerHome() {
  const profile = useProfile("recycler");
  const { t } = useLang();
  const [batches, reload] = useBatches(profile);
  const incoming = batches.filter((b) => b.status === "delivered");
  const done = batches.filter((b) => b.status === "recycled").slice(0, 5);

  return (
    <Shell profile={profile} title={t("rec.title")} subtitle={t("rec.sub", { name: profile?.name ?? "" })}>
      {incoming.length === 0 && <p className="card text-slate-500">{t("rec.none")}</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {incoming.map((b) => (
          <BatchCard key={b.id} batch={b}>
            <ReceiptForm batch={b} onDone={reload} />
          </BatchCard>
        ))}
      </div>

      <h2 className="section-title mt-10">{t("rec.recent")}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {done.map((b) => (
          <BatchCard key={b.id} batch={b}>
            <p className="mt-1 text-sm">{t("col.value")}: {estimateValue(b.actual_type ?? b.final_type, b.actual_kg ?? 0, b.quality_grade)}</p>
          </BatchCard>
        ))}
      </div>
    </Shell>
  );
}
