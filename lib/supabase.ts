import { createClient } from "@supabase/supabase-js";

// One client for the whole app. The anon key is safe in the browser:
// what each user can read or change is decided by RLS rules in the database.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Role = "generator" | "collector" | "recycler" | "plantx";
export type Plastic = "PET" | "HDPE" | "PP" | "LDPE" | "UNCLEAR";

export type Profile = {
  id: string;
  role: Role;
  name: string;
  area: string;
  lat: number;
  lng: number;
  accepted_types: Plastic[];
  capacity_kg: number;
  language: string;
  age: number | null;
  gender: string | null;
  phone: string | null;
};

export type Address = { id: string; label: string; line: string; area: string; lat: number; lng: number };

export const STATUSES = ["requested", "matched", "scheduled", "on_the_way", "picked_up", "delivered", "recycled"] as const;
export type Status = (typeof STATUSES)[number];


export type Batch = {
  id: string;
  generator_id: string;
  area: string;
  lat: number;
  lng: number;
  ai_type: Plastic | null;
  ai_confidence: number | null;
  final_type: Plastic;
  verify_at_pickup: boolean;
  declared_kg: number;
  collector_id: string | null;
  recycler_id: string | null;
  scheduled_at: string | null;
  actual_kg: number | null;
  actual_type: Plastic | null;
  quality_grade: "A" | "B" | "C" | null;
  weight_flag: boolean | null;
  status: Status;
  created_at: string;
  batch_addresses: { address: string; phone: string | null } | null; // null when RLS hides it
  collector?: { name: string } | null;
  batch_items?: { position: number; name: string | null; count: number; type: Plastic }[];
};

// the different plastics in a listing (older listings have no items, just the one type)
export const typesOf = (b: Batch) => (b.batch_items?.length ? [...new Set(b.batch_items.map((i) => i.type))] : [b.final_type]);

// The database calls households and businesses "generator"; on screen they are "User" (role.generator in lib/i18n.ts)

// where each role lands after logging in
export const homeFor = (role: Role) => ({ generator: "/user", collector: "/collector", recycler: "/recycler", plantx: "/dashboard" })[role];

// Every status change goes through here. The database trigger checks the step is
// allowed for this role and writes it to the event log together with the note.
export async function advance(id: string, status: Status, fields: object = {}, note: string | null = null) {
  const { error } = await supabase.from("batches").update({ ...fields, status, last_note: note }).eq("id", id);
  if (error) alert(error.message);
  return !error;
}
