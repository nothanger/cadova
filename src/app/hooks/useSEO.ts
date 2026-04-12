/**
 * useSEO — Hook pour mettre à jour les meta tags dynamiquement par page.
 *
 * Usage dans un composant page :
 *   useSEO({
 *     title: "Connexion — Cadova",
 *     description: "Connecte-toi à Cadova pour accéder à tes outils IA.",
 *     noindex: false, // true pour les pages privées
 *   });
 */

import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  /** true = page privée, hors index Google */
  noindex?: boolean;
}

const BASE_URL = "https://cadova.fr";
const DEFAULT_TITLE = "Cadova — L'écosystème IA pour l'emploi des jeunes";
const DEFAULT_DESC =
  "Cadova t'aide à trouver un emploi ou un stage grâce à l'IA : génère ton CV et ta lettre de motivation, analyse ATS, simule des entretiens et suis tes candidatures.";
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO({
  title,
  description,
  canonical,
  ogImage,
  noindex = false,
}: SEOProps = {}) {
  useEffect(() => {
    const resolvedTitle = title || DEFAULT_TITLE;
    const resolvedDesc = description || DEFAULT_DESC;
    const resolvedImage = ogImage || DEFAULT_IMAGE;
    const resolvedCanonical = canonical || `${BASE_URL}${window.location.pathname}`;

    // <title>
    document.title = resolvedTitle;

    // meta description
    setMeta("description", resolvedDesc);

    // robots — noindex pour les pages privées
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large");

    // Canonical
    setLink("canonical", resolvedCanonical);

    // Open Graph
    setMeta("og:title", resolvedTitle, "property");
    setMeta("og:description", resolvedDesc, "property");
    setMeta("og:url", resolvedCanonical, "property");
    setMeta("og:image", resolvedImage, "property");

    // Twitter
    setMeta("twitter:title", resolvedTitle);
    setMeta("twitter:description", resolvedDesc);
    setMeta("twitter:image", resolvedImage);
  }, [title, description, canonical, ogImage, noindex]);
}
