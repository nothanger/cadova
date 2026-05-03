import { createClient } from "@supabase/supabase-js";

const envSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const envSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const envApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

export const isSupabaseConfigured = Boolean(envSupabaseUrl && envSupabaseAnonKey);
export const supabaseConfigError = isSupabaseConfigured
  ? null
  : "Missing required VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.";

if (!isSupabaseConfigured) {
  console.error(supabaseConfigError);
}

const supabaseUrl = envSupabaseUrl || "https://invalid.supabase.co";
const supabaseAnonKey = envSupabaseAnonKey || "invalid-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const API_URL = envApiUrl || (isSupabaseConfigured ? `${supabaseUrl}/functions/v1/make-server-0a5eb56b` : "");

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!isSupabaseConfigured || !API_URL) {
    throw new Error(supabaseConfigError || "Supabase configuration is missing.");
  }

  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=UTF-8",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.clone().text();
    console.error(`❌ API Error [${response.status}] ${endpoint}:`, errorText);
  }

  return response;
}
