import type { FurnitureCategory } from '../../Data/FurnitureCatalog';

interface CategoryIconProps {
  category: FurnitureCategory;
  size?: number;
}

// Simple line-art stand-ins for each catalog category — there are no product photos/thumbnails
// for catalog items, so these give each item button a recognizable glyph instead of bare text.
const GLYPHS: Record<FurnitureCategory, React.ReactNode> = {
  Seating: (
    <>
      <path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3" />
      <rect x="4" y="11" width="16" height="6" rx="1.5" />
      <path d="M5 17v2M19 17v2" />
    </>
  ),
  Tables: (
    <>
      <path d="M3 7h18" />
      <path d="M6 7v11M18 7v11" />
    </>
  ),
  Storage: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M4 10h16M4 17h16" />
    </>
  ),
  Bedroom: (
    <>
      <path d="M3 19v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6" />
      <path d="M3 19h18M3 13V7a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v4" />
      <path d="M3 19v2M21 19v2" />
    </>
  ),
  Lighting: (
    <>
      <circle cx="12" cy="10" r="5.5" />
      <path d="M10 19h4M10.5 15.5h3" />
      <path d="M12 4.5V3" />
    </>
  ),
  Decor: (
    <>
      <path d="M12 20V11" />
      <path d="M12 11C7 11 6 6 6 6s6-1 6 5Z" />
      <path d="M12 13c5 0 6-5 6-5s-6-1-6 5Z" />
    </>
  ),
};

export function CategoryIcon({ category, size = 22 }: CategoryIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[category]}
    </svg>
  );
}
