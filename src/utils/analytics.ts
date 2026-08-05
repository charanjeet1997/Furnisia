// Google Analytics 4 (GA4) Utility Integration

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

let isInitialized = false;

/**
 * Initialize Google Analytics 4 dynamically
 */
export const initGA = () => {
  if (isInitialized) return;
  if (!GA_MEASUREMENT_ID) {
    console.warn('[Google Analytics] VITE_GA_MEASUREMENT_ID is not configured in .env');
    return;
  }

  // Inject GA Script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // Initialize dataLayer & gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false, // Page views managed manually via React Router
  });

  isInitialized = true;
  console.log(`[Google Analytics] Initialized with ID: ${GA_MEASUREMENT_ID}`);
};

/**
 * Track Page Views (called on React Router route change)
 */
export const trackPageView = (path: string, title?: string) => {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
    page_location: window.location.href,
  });
};

/**
 * Set logged-in User identity and properties in GA4
 */
export const setAnalyticsUser = (
  user: { uid: string; email?: string | null; displayName?: string | null } | null
) => {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;

  if (user) {
    window.gtag('set', 'user_properties', {
      user_id: user.uid,
      user_email: user.email || 'anonymous',
      user_name: user.displayName || 'User',
    });
    window.gtag('config', GA_MEASUREMENT_ID, {
      user_id: user.uid,
    });
  } else {
    window.gtag('set', 'user_properties', {
      user_id: null,
      user_email: null,
      user_name: null,
    });
  }
};

/**
 * Track User Login event with method and user email/ID
 */
export const trackLogin = (
  method: 'email' | 'google' | string,
  user: { uid: string; email?: string | null; displayName?: string | null }
) => {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;

  setAnalyticsUser(user);

  window.gtag('event', 'login', {
    method,
    user_id: user.uid,
    user_email: user.email || '',
    user_name: user.displayName || '',
  });
};

/**
 * Track User Registration/Sign Up event
 */
export const trackSignUp = (
  method: 'email' | 'google' | string,
  user: { uid: string; email?: string | null; displayName?: string | null }
) => {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;

  setAnalyticsUser(user);

  window.gtag('event', 'sign_up', {
    method,
    user_id: user.uid,
    user_email: user.email || '',
    user_name: user.displayName || '',
  });
};

/**
 * Track Feature Usage (3D view, catalog search, VR mode, export screenshot, etc.)
 */
export const trackFeatureUse = (
  featureName: string,
  params: Record<string, any> = {}
) => {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;

  window.gtag('event', 'feature_used', {
    feature_name: featureName,
    ...params,
  });
};

/**
 * Track Room Creation and Room Save events
 */
export const trackRoomCreated = (roomDetails: {
  roomId?: string;
  roomName?: string;
  shapeType?: string;
  width?: number;
  length?: number;
  height?: number;
  itemsCount?: number;
}) => {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;

  window.gtag('event', 'room_created', {
    room_id: roomDetails.roomId || 'new_room',
    room_name: roomDetails.roomName || 'Untitled Room',
    shape_type: roomDetails.shapeType || 'rectangular',
    dimensions: `${roomDetails.width || 0}x${roomDetails.length || 0}x${roomDetails.height || 0}m`,
    items_count: roomDetails.itemsCount || 0,
  });
};

/**
 * Track VR Session Start / VR Room Entry
 */
export const trackVREnter = (roomId?: string) => {
  trackFeatureUse('enter_vr_mode', {
    room_id: roomId || 'current_room',
  });
};

/**
 * Track Export Actions (Screenshot, GLTF 3D model, PDF report)
 */
export const trackExport = (format: 'screenshot' | 'gltf' | 'pdf' | string) => {
  trackFeatureUse('export_design', {
    export_format: format,
  });
};

/**
 * Track Catalog Search terms & Category Filter clicks
 */
export const trackCatalogSearch = (query: string, category?: string) => {
  trackFeatureUse('catalog_search', {
    search_term: query,
    category_filter: category || 'all',
  });
};

/**
 * Track Generic Custom Event
 */
export const trackEvent = (
  action: string,
  params: Record<string, any> = {}
) => {
  if (!GA_MEASUREMENT_ID || typeof window.gtag !== 'function') return;

  window.gtag('event', action, params);
};
