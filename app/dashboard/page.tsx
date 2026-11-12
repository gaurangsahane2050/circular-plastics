"use client";
import { useEffect, useState } from "react";
import { Leaf, PackageCheck, RotateCcw, Target } from "lucide-react";
import Shell from "@/components/Shell";
import { AreaChart, TYPE_COLOR, WeeklyChart } from "@/components/Charts";
import { useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";
import { PLASTICS } from "@/lib/plastics";
import { useLang } from "@/lib/i18n";

type Impact = { week: string; area: string; plastic: string; kg: number; co2e_kg: number };
type Factor = { plastic: string; kg_co2e_per_kg: number; source: string };
type Quality = { area: string; checked: number; match_pct: number };
type Leader = { id: string; name: string; area: string; coins: number };
type Data = { impact: Impact[]; factors: Factor[]; quality: Quality[]; leaders: Leader[]; corrections: number; asOf: number };

const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
const indian = (n: number) => Math.round(n).toLocaleString("en-IN"); // 1,74,50,776 style grouping

// Straight line through the weekly totals (least squares), carried 4 weeks ahead.
function nextFourWeeks(weekly: number[]) {
  const n = weekly.length;
  const meanX = (n - 1) / 2;
  const meanY = sum(weekly) / n;
  const slope = sum(weekly.map((y, x) => (x - meanX) * (y - meanY))) / sum(weekly.map((_, x) => (x - meanX) ** 2));
  return sum([n, n + 1, n + 2, n + 3].map((x) => Math.max(0, meanY + slope * (x - meanX))));
}

export default function ImpactDashboard() {
  const profile = useProfile();
  const { t, locale } = useLang();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (!profile) return;
    Promise.all([
      supabase.from("impact_weekly").select("*").order("week"),
      supabase.from("emission_factors").select("*"),
      supabase.from("sorting_quality").select("*").order("match_pct"),
      supabase.from("leaderboard").select("id, name, area, coins").order("coins", { ascending: false }).limit(5),
      supabase.from("model_corrections").select("id", { count: "exact", head: true }),
    ]).then(([i, f, q, l, c]) => setData({
      impact: i.data ?? [], factors: f.data ?? [], quality: q.data ?? [], leaders: l.data ?? [], corrections: c.count ?? 0,
      asOf: Date.now(), // shown as "As on 12-11-2026"
    }));
  }, [profile]);

  async function resetDemo() {
    if (!confirm(t("dash.resetConfirm"))) return;
    const { error } = await supabase.rpc("reset_demo");
    if (error) alert(error.message);
    else location.reload();
  }

  if (!data) return <Shell profile={profile} title={t("nav.impact")}>{null}</Shell>;

  const { impact, factors, quality, leaders } = data;
  const weeks = [...new Set(impact.map((r) => r.week))];
  const areas = [...new Set(impact.map((r) => r.area))];
  const kgOf = (filter: (r: Impact) => boolean) => sum(impact.filter(filter).map((r) => Number(r.kg)));

  const totalKg = kgOf(() => true);
  const totalCo2 = sum(impact.map((r) => Number(r.co2e_kg)));
  // "per day" is the daily average over the last 4 finished weeks (the current week is still filling up)
  const lastFourWeeks = (r: Impact) => weeks.slice(-5, -1).includes(r.week);
  const kgPerDay = kgOf(lastFourWeeks) / 28;
  const co2PerDay = sum(impact.filter(lastFourWeeks).map((r) => Number(r.co2e_kg))) / 28;
  const checked = sum(quality.map((q) => q.checked));
  const matchPct = sum(quality.map((q) => q.match_pct * q.checked)) / checked;
  const weekly = weeks.map((w) => ({
    week: new Date(w).toLocaleDateString(locale, { day: "numeric", month: "short" }),
    ...Object.fromEntries(PLASTICS.map((p) => [p, kgOf((r) => r.week === w && r.plastic === p)])),
  }));
  // forecast uses the last 8 finished weeks (the current week is still filling up)
  const forecast = (p: string) => nextFourWeeks(weeks.slice(-9, -1).map((w) => kgOf((r) => r.week === w && r.plastic === p)));

  return (
    <Shell profile={profile} title={t("nav.impact")} subtitle={t("dash.sub")}>
      {/* headline counters, laid out like government impact dashboards (e.g. PM E-DRIVE's "CO2 Reduction per day") */}
      <section className="overflow-hidden rounded-2xl bg-emerald-900 text-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
          <h2 className="flex items-center gap-2 font-semibold"><Leaf size={18} /> {t("dash.env")}</h2>
          <p className="text-sm text-emerald-200">{t("dash.asOn", { date: new Date(data.asOf).toLocaleDateString("en-IN").replaceAll("/", "-") })}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-px bg-emerald-800 lg:grid-cols-4">
          {[
            [t("dash.co2Day"), co2PerDay],
            [t("dash.co2Total"), totalCo2],
            [t("dash.kgDay"), kgPerDay],
            [t("dash.kgTotal"), totalKg],
          ].map(([label, value]) => (
            <div key={label} className="bg-emerald-900 px-5 py-4">
              <p className="text-sm text-emerald-200">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums lg:text-3xl">{indian(Number(value))}</p>
            </div>
          ))}
        </div>
        <p className="px-5 py-3 text-xs text-emerald-200">
          {t("dash.footnote")}
        </p>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:gap-4">
        {([
          [t("dash.checked"), checked, PackageCheck],
          [t("dash.sorted"), `${Math.round(matchPct)}%`, Target],
        ] as const).map(([label, value, Icon]) => (
          <div key={label} className="card flex items-center gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Icon size={20} /></span>
            <span>
              <span className="block text-sm text-slate-600">{label}</span>
              <span className="text-2xl font-bold tracking-tight">{value}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card lg:col-span-2">
          <h2 className="font-semibold">{t("dash.weekly")}</h2>
          <WeeklyChart data={weekly} unit={t("kg")} />
          <p className="text-xs text-slate-500">{t("dash.lastBar")}</p>
        </section>

        <section className="card">
          <h2 className="font-semibold">{t("dash.co2How")}</h2>
          <p className="mt-3 rounded-lg bg-slate-100 p-3 font-mono text-sm">{t("dash.formula")}</p>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="pb-2 font-medium">{t("dash.type")}</th><th className="pb-2 text-right font-medium">{t("kg")}</th><th className="pb-2 text-right font-medium">{t("dash.factor")}</th><th className="pb-2 text-right font-medium">{t("dash.co2kg")}</th></tr>
            </thead>
            <tbody>
              {PLASTICS.map((p) => {
                const kg = kgOf((r) => r.plastic === p);
                const factor = Number(factors.find((f) => f.plastic === p)?.kg_co2e_per_kg ?? 0);
                return (
                  <tr key={p} className="border-t border-slate-100">
                    <td className="py-2"><span className="mr-2 inline-block h-3 w-3 rounded-sm" style={{ background: TYPE_COLOR[p as keyof typeof TYPE_COLOR] }} />{p}</td>
                    <td className="text-right">{Math.round(kg)}</td><td className="text-right">{factor}</td><td className="text-right font-medium">{Math.round(kg * factor)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>{t("dash.b1")}</li>
            <li>{t("dash.b2", { source: factors[0]?.source ?? "" })}</li>
            <li>{t("dash.b3")}</li>
          </ul>
        </section>

        <section className="card">
          <h2 className="font-semibold">{t("dash.byArea")}</h2>
          <AreaChart unit={` ${t("kg")}`} data={areas.map((a) => ({ area: a, value: kgOf((r) => r.area === a) })).sort((x, y) => y.value - x.value)} />
        </section>

        <section className="card">
          <h2 className="font-semibold">{t("dash.quality")}</h2>
          <p className="text-sm text-slate-600">{t("dash.qualityHelp")}</p>
          <AreaChart unit="%" max={100} data={quality.map((q) => ({ area: q.area, value: Number(q.match_pct) }))} />
        </section>

        <section className="card">
          <h2 className="font-semibold">{t("dash.forecast")}</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3">
            {PLASTICS.map((p) => (
              <li key={p} className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-600">{p}</p>
                <p className="text-xl font-bold">~{indian(forecast(p))} {t("kg")}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">{t("dash.forecastHelp")}</p>
        </section>

        <section className="card">
          <h2 className="font-semibold">{t("dash.top")}</h2>
          <p className="text-sm text-slate-600">{t("dash.topHelp")}</p>
          <ol className="mt-3 divide-y divide-slate-100 text-sm">
            {leaders.map((l, i) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span><span className="mr-2 font-semibold text-slate-400">{i + 1}</span>{l.name} <span className="text-slate-500">· {l.area}</span></span>
                <b className="text-amber-600">{l.coins}</b>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h2 className="font-semibold">{t("dash.ai")}</h2>
          <p className="mt-2 text-sm text-slate-700">
            <b className="text-2xl">{data.corrections}</b> {t("dash.aiText")}
          </p>
        </section>
      </div>

      <div className="mt-8 flex justify-end">
        <button onClick={resetDemo} className="btn-secondary text-sm"><RotateCcw size={16} /> {t("dash.reset")}</button>
      </div>
    </Shell>
  );
}
