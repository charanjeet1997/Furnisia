// src/Components/SEOHead.tsx
// Updates document title, meta description, canonical link, Open Graph tags,
// Twitter Card tags, and JSON-LD structured data on every route change.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSeoForPath } from "../Data/seoData";

const SITE_URL = "https://furnisia.singhgamedev.in";
const JSON_LD_ID = "seo-head-jsonld";

function setMetaTag(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(schema: object | undefined) {
  const existing = document.getElementById(JSON_LD_ID);
  if (existing) existing.remove();
  if (!schema) return;

  const script = document.createElement("script");
  script.id = JSON_LD_ID;
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

export function SEOHead() {
  const location = useLocation();

  useEffect(() => {
    const seo = getSeoForPath(location.pathname);
    const canonicalUrl = `${SITE_URL}${location.pathname}`;

    document.title = seo.title;

    setMetaTag("name", "description", seo.description);
    if (seo.keywords) setMetaTag("name", "keywords", seo.keywords);
    setCanonical(canonicalUrl);

    // Open Graph
    setMetaTag("property", "og:title", seo.title);
    setMetaTag("property", "og:description", seo.description);
    setMetaTag("property", "og:url", canonicalUrl);
    setMetaTag("property", "og:type", "website");
    if (seo.image) setMetaTag("property", "og:image", seo.image);

    // Twitter Card
    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", seo.title);
    setMetaTag("name", "twitter:description", seo.description);
    if (seo.image) setMetaTag("name", "twitter:image", seo.image);

    setJsonLd(seo.schema);
  }, [location.pathname]);

  return null;
}

export default SEOHead;
