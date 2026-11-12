import { LOCALE, translate, type Lang } from "./strings.ts";

// Pickup slots: 2-hour windows starting 9 AM, 12 PM and 4 PM, today and the next 2 days.
// A collector does at most 3 pickups per slot.
const SLOT_HOURS = [9, 12, 16];
export const PER_SLOT = 3;

const h12 = (h: number) => h % 12 || 12;
const hour = (h: number) => `${h12(h)} ${h < 12 ? "AM" : "PM"}`;
// Hindi and Marathi say the part of the day instead of AM/PM
const PART: Record<"hi" | "mr", string[]> = { hi: ["सुबह", "दोपहर", "शाम"], mr: ["सकाळी", "दुपारी", "संध्याकाळी"] };

export function slotLabel(start: Date, lang: Lang = "en") {
  const days = Math.round((new Date(start).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const day = days === 0 ? translate(lang, "slot.today") : days === 1 ? translate(lang, "slot.tomorrow")
    : start.toLocaleDateString(LOCALE[lang], { weekday: "short", day: "numeric", month: "short" });
  const h = start.getHours();
  if (lang === "en") return `${day}, ${hour(h)}–${hour(h + 2)}`;
  const part = PART[lang][h < 12 ? 0 : h < 16 ? 1 : 2];
  return `${day}, ${part} ${h12(h)}–${h12(h + 2)}${lang === "hi" ? " बजे" : ""}`;
}

// booked = how many pickups the collector already has in each slot (from slot_bookings())
export function openSlots(booked: { slot: string; booked: number }[], now = new Date()) {
  const slots: { start: Date; left: number }[] = [];
  for (let day = 0; day < 3; day++) {
    for (const h of SLOT_HOURS) {
      const start = new Date(now);
      start.setDate(now.getDate() + day);
      start.setHours(h, 0, 0, 0);
      if (start.getTime() < now.getTime() + 3600000) continue; // need at least an hour's notice
      const taken = booked.find((b) => new Date(b.slot).getTime() === start.getTime())?.booked ?? 0;
      if (taken < PER_SLOT) slots.push({ start, left: PER_SLOT - taken });
    }
  }
  return slots.slice(0, 6);
}
