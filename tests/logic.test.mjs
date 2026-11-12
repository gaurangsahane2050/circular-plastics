// Plain logic checks, no database needed. Node runs the .ts files directly (type stripping).
import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm, topMatches } from "../lib/match.ts";
import { band, estimateValue, hintFor } from "../lib/plastics.ts";
import { openSlots, slotLabel } from "../lib/slots.ts";

test("haversine distance is about right", () => {
  const mumbai = { lat: 19.076, lng: 72.8777 };
  const pune = { lat: 18.5204, lng: 73.8567 };
  assert.ok(Math.abs(distanceKm(mumbai, pune) - 120) < 5); // straight line is ~120 km
});

test("matching filters by type and capacity, then sorts by distance", () => {
  const person = (name, lat, types, cap) => ({ id: name, name, lat, lng: 72.85, accepted_types: types, capacity_kg: cap });
  const people = [
    person("far", 19.3, ["PET"], 100),
    person("near", 19.11, ["PET"], 100),
    person("wrong type", 19.1, ["PP"], 100),
    person("too small", 19.1, ["PET"], 5),
    person("middle", 19.2, ["PET", "PP"], 100),
    person("fourth", 19.4, ["PET"], 100),
  ];
  const top = topMatches(people, ["PET"], 10, { lat: 19.1, lng: 72.85 });
  assert.deepEqual(top.map((p) => p.name), ["near", "middle", "far"]);
  assert.equal(top[0].km.toFixed(1), "1.1");
});

test("collectors further than the limit are left out", () => {
  const people = [{ id: "a", name: "near", lat: 19.11, lng: 72.85, accepted_types: ["PET"], capacity_kg: 50 },
    { id: "b", name: "far", lat: 19.3, lng: 72.85, accepted_types: ["PET"], capacity_kg: 50 }];
  assert.deepEqual(topMatches(people, ["PET"], 5, { lat: 19.1, lng: 72.85 }, 5).map((p) => p.name), ["near"]);
  // a listing with PET and PP needs a collector who takes both
  assert.deepEqual(topMatches(people, ["PET", "PP"], 5, { lat: 19.1, lng: 72.85 }).map((p) => p.name), []);
});

test("confidence bands follow the 85% / 60% rule", () => {
  assert.equal(band(0.85), "auto");
  assert.equal(band(0.84), "confirm");
  assert.equal(band(0.6), "confirm");
  assert.equal(band(0.59), "manual");
});

test("value estimate uses grade", () => {
  assert.equal(estimateValue("PET", 10), "₹150–250");
  assert.equal(estimateValue("PET", 10, "B"), "₹200");
});

test("slots: 2-hour windows, an hour's notice, full slots hidden", () => {
  const now = new Date(2026, 10, 12, 10, 30); // 12 Nov, 10:30
  const at = (d, h) => new Date(2026, 10, d, h).toISOString();
  const slots = openSlots([{ slot: at(12, 16), booked: 3 }, { slot: at(13, 9), booked: 1 }], now);
  // 12 PM today is open (1.5 h away), 4 PM today is full, 9 AM tomorrow has 2 left
  assert.deepEqual(slots.slice(0, 2).map((s) => [s.start.getDate(), s.start.getHours(), s.left]), [[12, 12, 3], [13, 9, 2]]);
  assert.match(slotLabel(new Date(2026, 10, 13, 16)), /, 4 PM–6 PM$/);
  assert.match(slotLabel(new Date(2026, 10, 13, 9), "hi"), /, सुबह 9–11 बजे$/);
  assert.match(slotLabel(new Date(2026, 10, 13, 16), "mr"), /, संध्याकाळी 4–6$/);
});

test("a typed name suggests the usual plastic", () => {
  assert.equal(hintFor("Dark Fantasy wrapper"), "PP");
  assert.equal(hintFor("black tiffin"), "PP");
  assert.equal(hintFor("Amul milk pouch"), "LDPE");
  assert.equal(hintFor("milk can"), "HDPE");
  assert.equal(hintFor("Bisleri water bottle"), "PET");
  assert.equal(hintFor("shampoo bottle"), "HDPE");
  assert.equal(hintFor("old newspaper"), null);
  assert.equal(hintFor("दूध की थैली"), "LDPE");
  assert.equal(hintFor("बिस्किटचे रॅपर"), "PP");
  assert.equal(hintFor("पाण्याची बाटली"), "PET");
});
