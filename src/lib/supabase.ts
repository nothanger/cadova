import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const supabaseUrl = `https://${projectId}.supabase.co`;

// Client Supabase singleton — gère l'auth et les sessions
export const supabase = createClient(supabaseUrl, publicAnonKey);

// URL de base de l'API serveur
export const API_URL = `${supabaseUrl}/functions/v1/make-server-0a5eb56b`;

// Helper pour les appels API authentifiés
// Utilise automatiquement le token JWT de la session Supabase
export async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Récupérer le token de la session active
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Si l'utilisateur est connecté → token JWT sécurisé
  // Sinon → clé publique anon (accès limité)
  headers.Authorization = `Bearer ${accessToken || publicAnonKey}`;

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Log les erreurs pour le debug
  if (!response.ok) {
    const errorText = await response.clone().text();
    console.error(`❌ API Error [${response.status}] ${endpoint}:`, errorText);
  }

  return response;
}
