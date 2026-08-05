// src/Data/seoData.ts
// Centralized per-route SEO metadata for Furnisia.
// Used by <SEOHead /> to update title, description, canonical, Open Graph,
// Twitter Card, and JSON-LD schema on every route change.

export interface SeoSchema {
  "@context": "https://schema.org";
  "@type": string;
  [key: string]: unknown;
}

export interface RouteSeo {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  schema?: SeoSchema;
}

const SITE_URL = "https://furnisia.singhgamedev.in";
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

export const seoData: Record<string, RouteSeo> = {
  "/": {
    title: "Furnisia — Design Your Space in 3D, AR & VR",
    description:
      "Visualise, plan, and arrange 3D furniture in custom rooms built to your exact dimensions — in 3D and full-scale WebXR virtual reality.",
    keywords:
      "3D room planner, AR furniture visualizer, WebXR room designer, furniture visualization SaaS, virtual room builder",
    image: DEFAULT_IMAGE,
    schema: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Furnisia",
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "3D/AR/VR room planner and furniture visualizer for furniture retailers and shoppers.",
      featureList: [
        "Quick start 3D canvas",
        "Custom parametric room builder",
        "Smart 3D furniture snapping",
        "Room presets",
        "WebXR VR walkthrough",
        "Cloud save",
      ],
      author: {
        "@type": "Person",
        name: "Charanjeet Singh Jaswani",
        url: "https://singhgamedev.in",
      },
    },
  },
  "/about": {
    title: "About Furnisia — 3D & VR Room Visualization",
    description:
      "Learn how Furnisia helps furniture retailers embed 3D, AR, and VR room visualization directly into their e-commerce sites.",
    keywords: "about Furnisia, 3D furniture visualizer, embeddable room planner",
    image: DEFAULT_IMAGE,
    schema: {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      url: `${SITE_URL}/about`,
      name: "About Furnisia",
    },
  },
  "/planner": {
    title: "Room Planner — Furnisia",
    description:
      "Start planning your room in 3D. Choose a preset or build a custom room and arrange furniture to scale.",
    keywords: "3D room planner tool, furniture layout planner, room design app",
    image: DEFAULT_IMAGE,
    schema: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Furnisia Room Planner",
      url: `${SITE_URL}/planner`,
      applicationCategory: "DesignApplication",
    },
  },
  "/room-builder": {
    title: "Custom Room Builder — Furnisia",
    description:
      "Build a custom room with parametric walls, doors, windows, and ceiling height matched to your exact space.",
    keywords: "parametric room builder, custom 3D room design, wall builder tool",
    image: DEFAULT_IMAGE,
    schema: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Furnisia Room Builder",
      url: `${SITE_URL}/room-builder`,
      applicationCategory: "DesignApplication",
    },
  },
  "/vr-room": {
    title: "VR Room Walkthrough — Furnisia",
    description:
      "Step into your room design at full 1:1 scale using WebXR virtual reality — no app install required.",
    keywords: "WebXR VR room walkthrough, virtual reality furniture preview, browser VR",
    image: DEFAULT_IMAGE,
    schema: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Furnisia VR Walkthrough",
      url: `${SITE_URL}/vr-room`,
      applicationCategory: "DesignApplication",
    },
  },
};

export const defaultSeo: RouteSeo = seoData["/"];

export function getSeoForPath(pathname: string): RouteSeo {
  return seoData[pathname] ?? defaultSeo;
}
