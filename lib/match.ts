import type { Plastic, Profile } from "./supabase";

type Point = { lat: number; lng: number };

// Straight-line distance on the earth's surface (haversine formula).
// Formula from https://en.wikipedia.org/wiki/Haversine_formula
export function distanceKm(a: Point, b: Point) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// Plain rules, no AI: must accept every plastic in the listing, must have room for the weight,
// must be within maxKm, nearest first.
export function topMatches(people: Profile[], types: Plastic[], kg: number, from: Point, maxKm = Infinity) {
  return people
    .filter((p) => types.every((t) => p.accepted_types.includes(t)) && p.capacity_kg >= kg)
    .map((p) => ({ ...p, km: distanceKm(from, p) }))
    .filter((p) => p.km <= maxKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, 3);
}
