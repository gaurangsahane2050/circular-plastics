"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Coins, Leaf } from "lucide-react";
import Shell from "@/components/Shell";
import Monster, { moodFor, type Mood } from "@/components/Monster";
import { useBatches, useProfile } from "@/lib/useProfile";
import { supabase } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";

const DAY = 86400000;
const PREVIEW: Mood[] = ["hungry", "sad", "happy"]; // tap Basellion to show each mood in a demo
const PREVIEW_HAPPINESS = [55, 10, 100];

// Home is just Basellion and the Feed button. Pickups and history are under "My waste".
export default function UserHome() {
  const profile = useProfile("generator");
  const [batches, , loaded] = useBatches(profile);
  const { t } = useLang();
  const [coins, setCoins] = useState(0);
  const [factors, setFactors] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState(-1);
  const [now, setNow] = useState(0); // time of the last refresh, used for Basellion's mood

  // my coins (10 per kg picked up) and the CO2 factors for my own impact line
  useEffect(() => {
    if (!profile) return;
    supabase.from("leaderboard").select("coins").eq("id", profile.id).maybeSingle().then(({ data }) => {
      setCoins(data?.coins ?? 0);
      setNow(Date.now());
    });
    supabase.from("emission_factors").select("plastic, kg_co2e_per_kg")
      .then(({ data }) => setFactors(Object.fromEntries((data ?? []).map((f) => [f.plastic, Number(f.kg_co2e_per_kg)]))));
  }, [profile]);

  // Basellion's mood comes from the last time something recyclable was listed (batches are newest first)
  const fed = batches.filter((b) => b.final_type !== "UNCLEAR");
  const daysSince = fed[0] ? Math.floor((now - new Date(fed[0].created_at).getTime()) / DAY) : null;
  const ready = loaded && now > 0;
  const mood = preview >= 0 ? PREVIEW[preview] : ready ? moodFor(daysSince) : "thinking";
  const happiness = preview >= 0 ? PREVIEW_HAPPINESS[preview] : daysSince === null ? 50 : Math.max(5, 100 - daysSince * 6);
  const monthKg = fed.filter((b) => now - new Date(b.created_at).getTime() < 30 * DAY).reduce((sum, b) => sum + Number(b.declared_kg), 0);

  // my share of the dashboard's CO2 figure: weighed kg × factor for the type the recycler found
  const myCo2 = batches.filter((b) => b.status === "recycled")
    .reduce((sum, b) => sum + Number(b.actual_kg) * (factors[b.actual_type ?? b.final_type] ?? 0), 0);

  return (
    <Shell profile={profile} title={t("home.hello", { name: profile?.name ?? "" })} subtitle={t("home.sub")}>
      <div className="mx-auto max-w-xl space-y-4">
        <section className="rounded-3xl bg-gradient-to-b from-emerald-50 to-emerald-100 p-5 ring-1 ring-emerald-100">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-emerald-900">{t("home.name")}</span>
            <span className="flex items-center gap-2 rounded-full bg-white px-3 py-1 font-semibold shadow-sm">
              <Coins size={16} className="text-amber-500" /> {t("coins", { n: coins })}
            </span>
          </div>
          <Monster mood={mood} size={210} onTap={() => setPreview((p) => (p + 1 < PREVIEW.length ? p + 1 : -1))} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3">
              <p className="text-sm text-slate-600">{t("home.fed")}</p>
              <p className="text-2xl font-bold">{ready ? `${Math.round(monthKg)} ${t("kg")}` : "…"}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-sm text-slate-600">{t("home.happiness")}</p>
              <p className="text-2xl font-bold">{ready ? `${happiness}%` : "…"}</p>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-white p-3 text-sm">
            <Leaf size={18} className="shrink-0 text-emerald-700" />
            <span>{t("home.co2", { kg: Math.round(myCo2).toLocaleString("en-IN") })}</span>
          </p>
        </section>
        <Link href="/user/new" className="btn-primary min-h-14 w-full text-lg">
          <Camera size={20} /> {t("home.feed")}
        </Link>
      </div>
    </Shell>
  );
}
