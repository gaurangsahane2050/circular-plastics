import type { Plastic } from "./supabase";

export const PLASTICS: Plastic[] = ["PET", "HDPE", "PP", "LDPE"];

// The confidence rules from our plan, in one place
export function band(confidence: number) {
  if (confidence >= 0.85) return "auto";    // fill the type in
  if (confidence >= 0.6) return "confirm";  // suggest, user must confirm
  return "manual";                          // user picks, checked again at pickup
}

// When the AI can't identify an item, the name the user types gives a strong hint.
// Packaging varies, so this only suggests; the printed code always wins.
const NAME_HINTS: [RegExp, Plastic][] = [ // checked top to bottom, most specific first
  [/milk (pouch|packet|bag)|pouch|carry ?bag|polythene|cling|film|garbage bag|bin bag|zip ?lock|थैली|थैलियाँ|पिशवी|पिशव्या|पन्नी|पॉलिथीन/i, "LDPE"],
  [/milk can|shampoo|detergent|cleaner|phenyl|bleach|lotion|jerry ?can|शैम्पू|शॅम्पू|डिटर्जेंट|डिटर्जंट|फिनाइल|फिनाईल/i, "HDPE"],
  [/wrapper|chips|biscuit|cookie|namkeen|chocolate|toffee|candy|noodle|maggi|kurkure|snack|packet|रैपर|रॅपर|चिप्स|बिस्किट|बिस्कीट|नमकीन|चॉकलेट|पैकेट|पाकीट|कुरकुरे/i, "PP"],
  [/water|cold ?drink|soda|soft ?drink|juice|oil|\bpet\b|bottle|बोतल|बाटली|पानी|पाणी|तेल|जूस|ज्यूस/i, "PET"],
  [/tiffin|tub|container|box|lid|cap|bucket|mug|cup|straw|spoon|tray|टिफ़िन|टिफिन|डिब्बा|डबा|ढक्कन|झाकण|बाल्टी|बादली|कप|चम्मच|चमचा/i, "PP"],
];
// tips per type are in lib/i18n.ts as tip.PET.0 ... tip.LDPE.2
export const TIP_COUNT = 3;
export const hintFor = (name: string) => NAME_HINTS.find(([pattern]) => pattern.test(name))?.[1] ?? null;

// Rough price a recycler pays per kg. PLACEHOLDER numbers, not market data.
const PRICE_PER_KG: Record<Plastic, number> = { PET: 25, HDPE: 30, PP: 20, LDPE: 12, UNCLEAR: 0 };
const GRADE_FACTOR = { A: 1, B: 0.8, C: 0.6 };

// value range for collectors before grading (grade C to grade A), or the value once graded
export function estimateValue(type: Plastic, kg: number, grade?: "A" | "B" | "C" | null) {
  const full = PRICE_PER_KG[type] * kg;
  if (grade) return `₹${Math.round(full * GRADE_FACTOR[grade])}`;
  return `₹${Math.round(full * GRADE_FACTOR.C)}–${Math.round(full)}`;
}
