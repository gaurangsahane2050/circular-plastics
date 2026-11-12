"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera as CameraIcon, Check, ImagePlus, MessageCircle, X } from "lucide-react";
import Shell from "@/components/Shell";
import Camera from "@/components/Camera";
import Monster, { type Mood } from "@/components/Monster";
import BookPickup from "@/components/BookPickup";
import AskBasellion, { type Suggested } from "@/components/AskBasellion";
import { useProfile } from "@/lib/useProfile";
import { supabase, type Address, type Batch, type Plastic } from "@/lib/supabase";
import { classify, type Guess } from "@/lib/classify";
import { cropCanvas, photoHash } from "@/lib/image";
import { findItems, type Box } from "@/lib/objects";
import { findObjects } from "@/lib/detect";
import { band, hintFor, PLASTICS, TIP_COUNT } from "@/lib/plastics";
import { useLang, type Key } from "@/lib/i18n";

const MAX_PHOTOS = 3;
type Photo = { src: string; boxes: Box[] | null; hash?: string; reused?: boolean; inHand?: boolean }; // boxes: null while looking, [] = one item
// An item comes from a photo (guess = our image model) or from the chat (suggested by the language model).
type Item = {
  key: string; src: string; crop: string; name: string; type: Plastic | ""; count: number; naming?: boolean;
  guess?: Guess; suggested?: Plastic; sure?: boolean; grams?: number;
};
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const unsure = (it: Item) => !!it.guess && band(it.guess.confidence) === "manual";
const aiType = (it: Item) => it.guess?.type ?? it.suggested; // what the AI said, from either model
const fromChat = (it: Item) => it.src === "chat";

export default function FeedBasellion() {
  const profile = useProfile("generator");
  const router = useRouter();
  const { t } = useLang();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [camera, setCamera] = useState(false);
  const [kg, setKg] = useState("");
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [eating, setEating] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase.from("addresses").select("*").order("created_at").then(({ data }) => {
      setAddresses(data ?? []);
      setAddressId(data?.[0]?.id ?? "");
    });
  }, [profile]);

  const update = (key: string, change: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...change } : it)));

  // Add a photo: find the items in it (ignoring people, tables, walls...), then let our model
  // look at each item on its own. All of this runs on the phone.
  async function addPhoto(src: string) {
    setPhotos((list) => (list.length >= MAX_PHOTOS ? list : [...list, { src, boxes: null }]));
    const img = new Image();
    img.src = src;
    await img.decode();
    // 1. items laid out on a plain surface are found by comparing with the background,
    // 2. on a busy background the detector finds objects and drops people, tables, walls...,
    // 3. otherwise the whole photo is one item
    let boxes = findItems(img);
    let inHand = false;
    if (!boxes.length) {
      const found = await findObjects(img);
      boxes = found.boxes;
      inHand = found.person && !boxes.length; // only a person/hand found: the item is probably being held
    }
    const hash = photoHash(img);
    const { data: reused } = await supabase.rpc("photo_used", { hash });
    setPhotos((list) => list.map((p) => (p.src === src ? { ...p, boxes, hash, reused: !!reused, inHand } : p)));

    const parts = boxes.length ? boxes.map((box) => cropCanvas(img, box)) : [img];
    setItems((list) => [...list, ...parts.map((part, i) => ({
      key: `${src}#${i}`, src, name: "", type: "" as const, count: 1,
      crop: part instanceof HTMLCanvasElement ? part.toDataURL("image/jpeg", 0.8) : src,
    }))]);
    for (const [i, part] of parts.entries()) {
      const guess = await classify(part);
      // a fairly sure answer is filled in (the user can change it); an unsure one the user names and picks
      update(`${src}#${i}`, { guess, type: band(guess.confidence) === "manual" ? "" : guess.type });
    }
  }

  // Items suggested by "Ask Basellion" join the list like photo items, with their count
  function addFromChat(suggested: Suggested[]) {
    const stamp = Date.now();
    setItems((list) => [...list, ...suggested.map((s, i) => {
      const plastic: Plastic = s.plastic === "NOT_RECYCLABLE" ? "UNCLEAR" : s.plastic;
      return { key: `chat#${stamp}#${i}`, src: "chat", crop: "", name: s.name, count: Math.max(1, s.count), type: plastic, suggested: plastic, sure: s.sure, grams: s.grams_each };
    })]);
  }

  function removePhoto(src: string) {
    setPhotos((list) => list.filter((p) => p.src !== src));
    setItems((list) => list.filter((it) => it.src !== src));
  }

  // items in photo order, numbered 1, 2, 3 ... (left to right inside each photo)
  const ordered = [...photos.flatMap((p) => items.filter((it) => it.src === p.src)), ...items.filter(fromChat)];
  const number = (key: string) => ordered.findIndex((it) => it.key === key) + 1;
  const checking = photos.some((p) => !p.boxes) || items.some((it) => !fromChat(it) && !it.guess);
  const recyclable = ordered.filter((it) => it.type && it.type !== "UNCLEAR");
  const missing = ordered.filter((it) => (it.guess || fromChat(it)) && (!it.type || (unsure(it) && !it.name.trim())));
  const types = [...new Set(recyclable.map((it) => it.type as Plastic))];
  const howMany = (t: Plastic) => recyclable.filter((it) => it.type === t).reduce((sum, it) => sum + it.count, 0);
  const main = [...types].sort((a, b) => howMany(b) - howMany(a))[0]; // the listing's headline type
  const estimatedGrams = recyclable.reduce((sum, it) => sum + (it.grams ?? 0) * it.count, 0); // from the chat only
  const allNotPlastic = !checking && ordered.length > 0 && ordered.every((it) => it.type === "UNCLEAR");
  const lastItem = ordered.at(-1);
  const reused = photos.some((p) => p.reused);
  const ready = !checking && recyclable.length > 0 && missing.length === 0;
  const address = addresses.find((a) => a.id === addressId);
  const canSend = ready && Number(kg) > 0 && !!address && !eating;

  // what is still needed before sending, shown under the button
  let todo = "";
  if (!ordered.length) todo = t("todo.start");
  else if (checking) todo = t("todo.checking");
  else if (!recyclable.length && !missing.length) todo = t("todo.plastic");
  else if (missing.length) {
    const it = missing[0];
    todo = t(unsure(it) && !it.name.trim() ? "todo.name" : "todo.category", { n: number(it.key) });
  } else if (!(Number(kg) > 0)) todo = t("todo.weight");
  else if (!address) todo = t("todo.address");

  // save the listing while Basellion eats it (the animation takes about 1.5 s anyway)
  async function send() {
    if (!profile || !canSend || !address) return;
    setEating(true);
    window.scrollTo({ top: 0, behavior: "smooth" }); // so the user sees Basellion eat it
    const aiTypes = recyclable.map(aiType);
    const aiMain = aiTypes.sort((a, b) => aiTypes.filter((t) => t === b).length - aiTypes.filter((t) => t === a).length)[0];
    const scored = recyclable.filter((it) => it.guess); // the image model gives a confidence, the chat doesn't
    const [{ data, error }] = await Promise.all([
      supabase.from("batches").insert({
        area: address.area,
        lat: Math.round(address.lat * 1000) / 1000, // ~100 m, the exact spot is in the address
        lng: Math.round(address.lng * 1000) / 1000,
        ai_type: aiMain,
        ai_confidence: scored.length ? Math.round((scored.reduce((sum, it) => sum + it.guess!.confidence, 0) / scored.length) * 100) / 100 : null,
        final_type: main,
        user_confirmed: recyclable.some((it) => it.type !== aiType(it) || (it.guess ? band(it.guess.confidence) !== "auto" : !it.sure)),
        verify_at_pickup: recyclable.some((it) => unsure(it) || (fromChat(it) && !it.sure)) || reused,
        photo_hashes: photos.map((p) => p.hash),
        declared_kg: Number(kg),
        last_note: `${types.map((p) => `${howMany(p)} ${p}`).join(", ")}${reused ? ", a photo was used before" : ""}`, // the log stays in English
      }).select("*").single(),
      wait(1600),
    ]);
    if (error) {
      alert(error.message);
      setEating(false);
      return;
    }
    const rows = recyclable.map((it) => ({
      batch_id: data.id, position: number(it.key), name: it.name.trim() || null, count: it.count,
      ai_type: aiType(it), ai_confidence: it.guess ? Math.round(it.guess.confidence * 100) / 100 : null, type: it.type as Plastic,
    }));
    await supabase.from("batch_items").insert(rows);
    await supabase.from("batch_addresses").insert({
      batch_id: data.id, address: `${address.label}: ${address.line}, ${address.area}`, phone: profile.phone,
    });
    setBatch({ ...data, batch_items: rows });
    setEating(false);
  }

  // Booked: show it under "My waste", and clear this page, which Next keeps alive for the next time Feed is opened
  function finish() {
    router.push("/user/waste");
    setPhotos([]);
    setItems([]);
    setKg("");
    setBatch(null);
  }

  // what Basellion does and says at each step
  let mood: Mood = "hungry";
  let message: string | undefined = t("m.happy");
  let item = recyclable.find((it) => it.crop)?.crop || photos[0]?.src;
  if (batch) [mood, message] = ["happy", t("m.done")];
  else if (eating) [mood, message] = ["eating", undefined];
  else if (checking) [mood, message] = ["thinking", undefined];
  else if (allNotPlastic) [mood, message, item] = ["spitting", t("m.allNot"), lastItem!.crop];
  else if (missing.length) [mood, message] = ["thinking", t("m.missing", { n: number(missing[0].key) })];
  else if (lastItem?.type === "UNCLEAR") [mood, message, item] = ["spitting", t("m.skip", { n: number(lastItem.key) }), lastItem.crop];
  else if (ready) [mood, message] = ["happy", t("m.ready", { what: types.map((p) => `${howMany(p)} ${p}`).join(` ${t("and")} `) })];

  const step = (n: number, title: string) => (
    <h2 className="flex items-center gap-2 font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-700 text-sm text-white">{n}</span> {title}
    </h2>
  );
  const badge = (n: number) => (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white shadow ring-2 ring-white">{n}</span>
  );
  const full = photos.length >= MAX_PHOTOS;

  return (
    <Shell profile={profile} title={t("home.feed")} subtitle={t("feed.sub")}>
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3 lg:sticky lg:top-24">
          <section className="rounded-3xl bg-gradient-to-b from-emerald-50 to-emerald-100 p-5 ring-1 ring-emerald-100">
            <Monster mood={mood} message={message} item={item} size={170} />
          </section>
          {!batch && (
            <>
              <button onClick={send} disabled={!canSend} className="btn-primary min-h-14 w-full text-lg">
                {eating ? t("feed.eating") : t("feed.send")}
              </button>
              {todo && <p className="text-center text-sm text-slate-500">{todo}</p>}
            </>
          )}
        </div>

        <div className="space-y-4">
          {!batch && (
            <section className="card">
              {step(1, t("feed.step1"))}
              <p className="mt-1 text-sm text-slate-600">{t("feed.step1Help", { max: MAX_PHOTOS })}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setCamera(true)} disabled={full} className="btn-primary">
                  <CameraIcon size={20} /> {t("feed.camera")}
                </button>
                <label className={`btn-secondary cursor-pointer ${full ? "pointer-events-none opacity-40" : ""}`}>
                  <ImagePlus size={20} /> {t("feed.device")}
                  <input type="file" accept="image/*" multiple className="sr-only" disabled={full}
                    onChange={(e) => {
                      Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - photos.length).forEach((f) => addPhoto(URL.createObjectURL(f)));
                      e.target.value = ""; // so the same file can be picked again
                    }} />
                </label>
              </div>
              {photos.some((p) => p.inHand) && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t("feed.hand")}</p>
              )}
              {photos.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-4">
                  {photos.map((p) => (
                    <li key={p.src} className="relative w-fit">
                      {/* eslint-disable-next-line @next/next/no-img-element -- local photo preview */}
                      <img src={p.src} alt={t("feed.yourPhoto")} className="block max-h-56 w-auto max-w-full rounded-xl ring-1 ring-slate-200" />
                      {/* a numbered box around every item found */}
                      {p.boxes?.map((b, i) => (
                        <span key={i} className="absolute rounded-lg border-2 border-emerald-400"
                          style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}>
                          <span className="absolute -top-3 -left-3">{badge(number(`${p.src}#${i}`))}</span>
                        </span>
                      ))}
                      {p.boxes?.length === 0 && <span className="absolute top-2 left-2">{badge(number(`${p.src}#0`))}</span>}
                      {!p.boxes && <span className="absolute inset-x-0 bottom-0 rounded-b-xl bg-black/50 py-1 text-center text-xs text-white">{t("feed.finding")}</span>}
                      <button onClick={() => removePhoto(p.src)} aria-label={t("feed.removePhoto")}
                        className="absolute -top-2 -right-2 grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-white">
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {!batch && <AskBasellion onAdd={addFromChat} />}

          {ordered.length > 0 && !batch && (
            <section className="card">
              {step(2, t("feed.step2", { n: ordered.length }))}
              <p className="mt-1 text-sm text-slate-600">{t("feed.step2Help")}</p>
              <ol className="mt-4 space-y-3">
                {ordered.map((it) => {
                  const n = number(it.key);
                  const g = it.guess;
                  const hint = it.name.trim() ? hintFor(it.name) : null;
                  const askName = unsure(it) || it.naming || fromChat(it); // unknown items always, the rest on request
                  return (
                    <li key={it.key} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                      {badge(n)}
                      {fromChat(it) ? (
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><MessageCircle size={22} /></span>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- local photo crop
                        <img src={it.crop} alt={t("feed.item", { n })} className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
                      )}
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm">
                          {fromChat(it) && (
                            <>{t("feed.fromChat")} <b>{it.suggested === "UNCLEAR" ? t("feed.notRecyclable") : it.suggested}</b>{!it.sure && ` · ${t("feed.typical")}`}</>
                          )}
                          {!g && !fromChat(it) && t("feed.checking")}
                          {g && unsure(it) && <span className="font-medium text-amber-800">{t("feed.cant")}</span>}
                          {g && !unsure(it) && g.type === "UNCLEAR" && `AI: ${t("feed.notPlastic")} · ${pct(g.confidence)}`}
                          {g && !unsure(it) && g.type !== "UNCLEAR" && (
                            <>AI: <b>{g.type}</b> · {pct(g.confidence)}{band(g.confidence) === "confirm" && ` · ${t("feed.check")}`}</>
                          )}
                        </p>
                        {(g || fromChat(it)) && (
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            {t("feed.howMany")}
                            <input type="number" min="1" value={it.count} onChange={(e) => update(it.key, { count: Math.max(1, Number(e.target.value) || 1) })}
                              className="input mt-0 w-20 py-1.5" />
                          </label>
                        )}
                        {g && !askName && (
                          <button onClick={() => update(it.key, { naming: true })} className="text-sm font-medium text-emerald-700 underline">
                            {t("feed.notRight")}
                          </button>
                        )}
                        {askName && (
                          <input value={it.name} onChange={(e) => update(it.key, { name: e.target.value })} aria-label={t("feed.whatIs", { n })}
                            placeholder={t("feed.whatPh")} className="input mt-0 py-2" />
                        )}
                        {hint && hint !== it.type && (
                          <p className="text-sm">
                            {t("feed.usually", { name: it.name.trim(), type: hint })}{" "}
                            <button onClick={() => update(it.key, { type: hint })} className="font-semibold text-emerald-700 underline">{t("feed.use", { type: hint })}</button>
                          </p>
                        )}
                        {(g || fromChat(it)) && (
                          <select value={it.type} onChange={(e) => update(it.key, { type: e.target.value as Plastic | "" })}
                            aria-label={t("feed.categoryOf", { n })} className="input mt-0 py-2">
                            <option value="">{t("feed.choose")}</option>
                            {PLASTICS.map((p) => <option key={p} value={p}>{p}: {t(`desc.${p}`).split(" · ")[1]}</option>)}
                            <option value="UNCLEAR">{t("feed.leaveOut")}</option>
                          </select>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <details open={ordered.some(unsure)} className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                <summary className="cursor-pointer font-semibold">{t("feed.howToTell")}</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                  {[0, 1, 2, 3].map((i) => <li key={i}>{t(`tell.${i}` as Key)}</li>)}
                </ul>
              </details>
              {reused && (
                <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{t("feed.reused")}</p>
              )}
              {ready && (
                <ul className="mt-4 space-y-1 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
                  {types.flatMap((p) => Array.from({ length: TIP_COUNT }, (_, i) => (
                    <li key={p + i} className="flex items-start gap-2">
                      <Check size={16} className="mt-0.5 shrink-0" /> {types.length > 1 && <b>{p}:</b>} {t(`tip.${p}.${i}` as Key)}
                    </li>
                  )))}
                </ul>
              )}
            </section>
          )}

          {allNotPlastic && !batch && (
            <section className="card border-amber-200 bg-amber-50/60 text-sm text-slate-700">
              <h2 className="font-semibold">{t("feed.notRecTitle")}</h2>
              <p className="mt-1">{t("feed.notRecText")}</p>
            </section>
          )}

          {ready && !batch && (
            <section className="card space-y-4">
              {step(3, t("feed.step3"))}
              <label className="label">
                {t("feed.weight")}
                <input type="number" min="0.1" step="0.1" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className="input" />
              </label>
              {estimatedGrams > 0 && (
                <p className="text-sm text-slate-600">
                  {t("feed.estimate", { g: Math.round(estimatedGrams) })}{" "}
                  <button onClick={() => setKg(String(Math.max(0.1, Math.round(estimatedGrams / 100) / 10)))} className="font-semibold text-emerald-700 underline">
                    {t("feed.useIt")}
                  </button>
                </p>
              )}
              <fieldset>
                <legend className="label">{t("signup.address")} <span className="font-normal text-slate-500">{t("feed.addressNote")}</span></legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {addresses.map((a) => (
                    <button key={a.id} type="button" onClick={() => setAddressId(a.id)} aria-pressed={a.id === addressId} className="option text-sm">
                      <b>{a.label}</b>
                      <span className="block text-slate-600">{a.line}, {a.area}</span>
                    </button>
                  ))}
                </div>
                <Link href="/user/profile" className="mt-2 inline-block text-sm font-medium text-emerald-700">
                  {addresses.length ? t("feed.editAddresses") : t("feed.addFirst")}
                </Link>
              </fieldset>
              <p className="text-sm text-slate-500">{t("feed.thenTap")}</p>
            </section>
          )}

          {batch && (
            <section className="card">
              {step(4, t("feed.step4"))}
              <p className="mt-1 text-sm text-slate-600">{types.join(" + ")} · {batch.declared_kg} {t("kg")} · {t("feed.from", { label: address?.label ?? "" })}</p>
              <BookPickup batch={batch} onBooked={finish} />
            </section>
          )}
        </div>
      </div>

      {camera && (
        <Camera taken={photos.length} max={MAX_PHOTOS} onClose={() => setCamera(false)}
          onPhoto={(src) => {
            addPhoto(src);
            if (photos.length + 1 >= MAX_PHOTOS) setCamera(false);
          }} />
      )}
    </Shell>
  );
}
