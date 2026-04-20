import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const supabaseUrl = `https://${projectId}.supabase.co`;


export const supabase = createClient(supabaseUrl, publicAnonKey);

export const API_URL = `${supabaseUrl}/functions/v1/make-server-0a5eb56b`;

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

  headers.Authorization = `Bearer ${accessToken || publicAnonKey}`;

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
