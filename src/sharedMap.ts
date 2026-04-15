import { createClient } from "@supabase/supabase-js";
import type { MapState } from "./cityData";

export type SharedMapRecord = {
  id: string;
  title: string;
  data: MapState;
  updated_at?: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function requireClient() {
  if (!supabase) {
    throw new Error("Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.");
  }

  return supabase;
}

export async function createSharedMap(title: string, data: MapState) {
  const client = requireClient();
  const { data: row, error } = await client
    .from("maps")
    .insert({ title, data })
    .select("id,title,data,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return row as SharedMapRecord;
}

export async function getSharedMap(mapId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from("maps")
    .select("id,title,data,updated_at")
    .eq("id", mapId)
    .single();

  if (error) {
    throw error;
  }

  return data as SharedMapRecord;
}

export async function updateSharedMap(mapId: string, title: string, data: MapState) {
  const client = requireClient();
  const { data: row, error } = await client
    .from("maps")
    .update({
      title,
      data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", mapId)
    .select("id,title,data,updated_at")
    .single();

  if (error) {
    throw error;
  }

  return row as SharedMapRecord;
}
