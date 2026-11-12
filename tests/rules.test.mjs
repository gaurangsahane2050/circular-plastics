// Checks the database rules by logging in as each demo user through the real API.
// Needs the local database running:  npx supabase start
// Run:  node --env-file=.env.local --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function login(who) {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: `${who}@demo.test`, password: "demo1234" });
  assert.ifError(error);
  return { db, id: data.user.id };
}

test("generator only sees their own batches and no other generators", async () => {
  const { db, id } = await login("user");
  const { data: batches } = await db.from("batches").select("generator_id");
  assert.ok(batches.length > 0);
  assert.ok(batches.every((b) => b.generator_id === id));
  const { data: people } = await db.from("profiles").select("role, id");
  assert.ok(people.every((p) => p.role !== "generator" || p.id === id));
});

test("collector can turn down a requested slot", async () => {
  const { db } = await login("collector");
  const { data: [batch] } = await db.from("batches").select("id").eq("status", "matched").limit(1);
  assert.ifError((await db.from("batches").update({ status: "requested", scheduled_at: null }).eq("id", batch.id)).error);
});

test("collector gets the address only after confirming", async () => {
  const { db } = await login("collector");
  const { data: batches } = await db.from("batches").select("id, status, batch_addresses(address)");
  const matched = batches.filter((b) => b.status === "matched");
  const scheduled = batches.filter((b) => b.status === "scheduled");
  assert.ok(matched.length > 0 && scheduled.length > 0);
  assert.ok(matched.every((b) => b.batch_addresses === null));
  assert.ok(scheduled.every((b) => b.batch_addresses?.address));
});

test("plant X and the public see no batches, only totals", async () => {
  const { db } = await login("plantx");
  assert.equal((await db.from("batches").select("id")).data.length, 0);
  assert.ok((await db.from("impact_weekly").select("*")).data.length > 0);
  const anon = createClient(url, key, { auth: { persistSession: false } });
  assert.equal((await anon.from("batches").select("id")).data.length, 0);
  assert.equal((await anon.from("impact_weekly").select("*")).data, null);
});

test("status changes follow the role rules and are logged", async () => {
  const { db } = await login("collector");
  const { data: [batch] } = await db.from("batches").select("id").eq("status", "matched").limit(1);

  // a collector cannot jump straight to recycled
  const skip = await db.from("batches").update({ status: "recycled" }).eq("id", batch.id);
  assert.match(skip.error.message, /cannot move/);

  const ok = await db.from("batches")
    .update({ status: "scheduled", scheduled_at: new Date().toISOString(), last_note: "test pickup" })
    .eq("id", batch.id);
  assert.ifError(ok.error);
  const { data: events } = await db.from("status_events").select("to_status, actor_role, note").eq("batch_id", batch.id).order("id");
  assert.deepEqual(events.at(-1), { to_status: "scheduled", actor_role: "collector", note: "test pickup" });

  // then on the way and picked up, which gives the user coins
  assert.ifError((await db.from("batches").update({ status: "on_the_way", last_note: null }).eq("id", batch.id)).error);
  assert.ifError((await db.from("batches").update({ status: "picked_up", last_note: null }).eq("id", batch.id)).error);

  // the log is append-only: deletes silently affect nothing
  const count = async () => (await db.from("status_events").select("id").eq("batch_id", batch.id)).data.length;
  const before = await count();
  assert.equal(before, events.length + 2);
  await db.from("status_events").delete().eq("batch_id", batch.id);
  assert.equal(await count(), before);
});

test("public QR history has no names", async () => {
  const { db } = await login("user");
  const { data: [batch] } = await db.from("batches").select("id").eq("status", "recycled").limit(1);
  const anon = createClient(url, key, { auth: { persistSession: false } });
  const { data: history } = await anon.rpc("batch_history", { batch: batch.id });
  assert.equal(history.at(-1).status, "recycled");
  assert.deepEqual(Object.keys(history[0]).sort(), ["area", "at", "by_role", "grade", "kg", "plastic", "status"]);
});

test("addresses are private to their owner", async () => {
  const user = await login("user");
  assert.equal((await user.db.from("addresses").select("id")).data.length, 2);
  const collector = await login("collector");
  assert.equal((await collector.db.from("addresses").select("id")).data.length, 0);
});

test("sign-up makes a user profile, never a collector", async () => {
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.auth.signUp({ email: `new${Date.now()}@demo.test`, password: "test1234" });
  const row = { id: data.user.id, name: "Test Flat", area: "Palm Vihar", lat: 19.07, lng: 72.88 };
  assert.ok((await db.from("profiles").insert({ ...row, role: "collector" })).error);
  assert.ifError((await db.from("profiles").insert({ ...row, role: "generator", phone: "9000000000", age: 30 })).error);
  assert.ifError((await db.from("addresses").insert({ label: "Home", line: "Flat 1", area: "Palm Vihar", lat: 19.07, lng: 72.88 })).error);
});

test("a photo fingerprint is found again in any listing", async () => {
  const { db } = await login("user");
  const { data: [batch] } = await db.from("batches").select("id").limit(1);
  await db.from("batches").update({ photo_hashes: ["aaaa", "bbbb"] }).eq("id", batch.id);
  assert.equal((await db.rpc("photo_used", { hash: "bbbb" })).data, true);
  assert.equal((await db.rpc("photo_used", { hash: "cccc" })).data, false);
});

test("items of a listing follow the listing's privacy", async () => {
  const user = await login("user");
  const { data: [mine] } = await user.db.from("batches").select("id").eq("generator_id", user.id).limit(1);
  assert.ifError((await user.db.from("batch_items").insert({ batch_id: mine.id, position: 1, name: "biscuit wrapper", type: "PP" })).error);
  const collector = await login("collector");
  const { data: [theirs] } = await collector.db.from("batches").select("id").limit(1);
  // a collector can't add items to someone's listing, and nobody else sees this user's items
  assert.ok((await collector.db.from("batch_items").insert({ batch_id: theirs.id, position: 9, type: "PET" })).error);
  assert.equal((await collector.db.from("batch_items").select("id").eq("batch_id", mine.id)).data.length, 0);
});

test("demo reset puts the demo data back", async () => {
  const { db } = await login("user");
  assert.ifError((await db.rpc("reset_demo")).error);
});
