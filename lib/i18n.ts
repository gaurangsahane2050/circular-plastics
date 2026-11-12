"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { LOCALE, translate, type Key, type Lang } from "./strings";

export { LANGS, LOCALE, translate, type Key, type Lang } from "./strings";

// The chosen language lives in this browser (localStorage), so it survives reloads and log-outs.
// useSyncExternalStore lets every component on the page follow it without a context provider.
const listeners = new Set<() => void>();
let chosen: Lang | null = null; // used when the browser blocks storage (e.g. private mode)
function read(): Lang {
  if (chosen) return chosen;
  try {
    const saved = localStorage.getItem("lang");
    return saved === "hi" || saved === "mr" ? saved : "en";
  } catch {
    return "en";
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
export function setLang(lang: Lang) {
  chosen = lang;
  try {
    localStorage.setItem("lang", lang);
  } catch {
    // storage blocked: the switch still works until the page reloads
  }
  listeners.forEach((listener) => listener());
}

export function useLang() {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { lang, t, locale: LOCALE[lang] };
}
