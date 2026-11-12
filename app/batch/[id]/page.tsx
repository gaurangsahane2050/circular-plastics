"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import Logo from "@/components/Logo";
import LanguageSwitch from "@/components/LanguageSwitch";
import { supabase, type Plastic, type Role, type Status } from "@/lib/supabase";
import { useLang } from "@/lib/i18n";

type Step = { plastic: Plastic; area: string; kg: number; grade: string | null; status: Status; by_role: Role | null; at: string };

// The batch id is only known when someone opens the link, so Next needs a Suspense boundary here
export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-slate-500">…</p>}>
      <BatchHistory />
    </Suspense>
  );
}

// Public page the QR label opens. No login. Shows the chain of custody without any names.
function BatchHistory() {
  const { id } = useParams<{ id: string }>();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const { t, locale } = useLang();

  useEffect(() => {
    supabase.rpc("batch_history", { batch: id }).then(({ data }) => setSteps(data ?? []));
  }, [id]);

  if (!steps) return <p className="p-10 text-center text-slate-500">{t("loading")}</p>;
  if (!steps.length) return <p className="p-10 text-center">{t("pub.notFound")}</p>;
  const last = steps.at(-1)!;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4"><Logo /><LanguageSwitch /></div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="card">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-700"><ShieldCheck size={18} /> {t("pub.verified")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{last.plastic} · {last.kg} {t("kg")}</h1>
          <p className="text-slate-600">
            {last.area}{last.grade && ` · ${t("pub.grade", { g: last.grade })}`} · {t("pub.batch", { id: id.slice(0, 8) })}
          </p>

          <ol className="mt-6 border-l-2 border-emerald-600 pl-6">
            {steps.map((s, i) => (
              <li key={i} className="relative mb-5 last:mb-0">
                <span className="absolute top-1 -left-[31px] h-4 w-4 rounded-full border-2 border-white bg-emerald-600 ring-2 ring-emerald-600" />
                <p className="font-semibold">{t(`status.${s.status}`)}</p>
                <p className="text-sm text-slate-600">
                  {t("pub.by", { role: s.by_role ? t(`role.${s.by_role}`) : t("pub.system") })} ·{" "}
                  {new Date(s.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">{t("pub.footer")}</p>
      </main>
    </div>
  );
}
