"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, homeFor, type Batch, type Profile, type Role } from "./supabase";

// Every batch this user may see (RLS decides which), newest first, a reload function, and whether it has loaded.
export function useBatches(profile: Profile | null) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => {
    supabase.from("batches").select("*, batch_addresses(address, phone), collector:collector_id(name), batch_items(position, name, count, type)").order("created_at", { ascending: false })
      .then(({ data }) => {
        setBatches(data ?? []);
        setLoaded(true);
      });
  }, []);
  useEffect(() => {
    if (profile) reload();
  }, [profile, reload]);
  return [batches, reload, loaded] as const;
}

// Loads the logged-in user's profile. Sends them to the login page if nobody is
// logged in, or to their own home if this page belongs to another role.
// This only decides navigation. The real protection is RLS in the database.
export function useProfile(only?: Role) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return router.replace("/");
      const { data: me } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      // a login whose account no longer exists (e.g. the demo database was reset): sign out cleanly
      if (!me) {
        await supabase.auth.signOut();
        return router.replace("/");
      }
      if (only && me.role !== only) return router.replace(homeFor(me.role));
      setProfile(me);
    });
  }, [only, router]);

  return profile;
}
