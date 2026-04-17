import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
}

const BASE_URL = "https://cadova.fr";
const DEFAULT_TITLE = "Cadova - Un coup de main pour tes candidatures";
const DEFAULT_DESC =
  "Cadova aide les lyceens, etudiants et jeunes diplomes a construire leurs candidatures, preparer leurs entretiens et garder le fil de leur recherche.";
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

    document.title = resolvedTitle;
    setMeta("description", resolvedDesc);
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow, max-snippet:-1, max-image-preview:large");
    setLink("canonical", resolvedCanonical);
    setMeta("og:title", resolvedTitle, "property");
    setMeta("og:description", resolvedDesc, "property");
    setMeta("og:url", resolvedCanonical, "property");
    setMeta("og:image", resolvedImage, "property");
    setMeta("twitter:title", resolvedTitle);
    setMeta("twitter:description", resolvedDesc);
    setMeta("twitter:image", resolvedImage);
  }, [title, description, canonical, ogImage, noindex]);
}
