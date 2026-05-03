/** Routes accessibles sans variables Vite Supabase/API (capture vidéo promo, OBS, etc.). */
export function isPromoStandaloneRoute(
  rawPath: string,
  viteBaseUrl: string = import.meta.env.BASE_URL,
): boolean {
  const pathname = rawPath.split("?")[0]?.split("#")[0] ?? "";
  const base = viteBaseUrl.replace(/\/+$/, "");
  let relative = pathname;
  if (base !== "" && pathname.startsWith(base)) {
    relative = pathname.slice(base.length) || "/";
  }
  const normalized = relative.replace(/\/+$/, "") || "/";
  return normalized === "/promo" || normalized === "/logo-animation";
}
