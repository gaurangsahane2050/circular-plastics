"use client";
import { Languages } from "lucide-react";
import { LANGS, setLang, useLang, type Lang } from "@/lib/i18n";

// EN · हिं · मरा — shown in the header of every page
const SHORT: Record<Lang, string> = { en: "EN", hi: "हिं", mr: "मरा" };

export default function LanguageSwitch({ light = false }: { light?: boolean }) {
  const { lang, t } = useLang();
  return (
    <div role="group" aria-label={t("language")} className={`flex items-center gap-1 rounded-full p-1 ${light ? "bg-white/15" : "bg-slate-100"}`}>
      <Languages size={16} className={`mx-1 hidden sm:block ${light ? "text-white" : "text-slate-500"}`} aria-hidden />
      {(Object.keys(LANGS) as Lang[]).map((l) => (
        <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} title={LANGS[l]} lang={l}
          className={`min-h-8 min-w-9 rounded-full px-2 text-sm font-semibold transition ${lang === l
            ? (light ? "bg-white text-emerald-900" : "bg-white text-slate-900 shadow-sm")
            : (light ? "text-emerald-100 hover:text-white" : "text-slate-500 hover:text-slate-900")}`}>
          {SHORT[l]}
        </button>
      ))}
    </div>
  );
}
