import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const isProdBuild = import.meta.env.PROD;

if (isProdBuild && (!envSupabaseUrl || !envSupabaseAnonKey)) {
  throw new Error("Missing required VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY for production build.");
}

const supabaseUrl = envSupabaseUrl || `https://${projectId}.supabase.co`;
const supabaseAnonKey = envSupabaseAnonKey || publicAnonKey;
const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;


export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const API_URL = envApiUrl || `${supabaseUrl}/functions/v1/make-server-0a5eb56b`;

export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {

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
