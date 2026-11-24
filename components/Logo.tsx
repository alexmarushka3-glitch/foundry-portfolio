// The Foundry mark: an octagon (eight sides, eight agents) cut in two like a mould, with the cast piece
// (the finished app) sitting in the middle. The octagon is never moved: the halves are told apart by tone
// and by a thin seam on the diagonal. Greys only for now; the accent colours come with the site redesign.
// `app/icon.svg` is the same drawing, for the browser tab.

export const LOGO_COLORS = {
  iron: "#1e252b",
  paper: "#e6ebee",
  mist: "#9aa6b0",
  amber: "#f0a23a",
} as const;

// Flat-topped regular octagon, radius 13.2 around (16, 16). The seam runs on the diagonal x + y = 32,
// so it meets the middle of two opposite sides.
const UPPER_HALF = "24.62,7.38 21.05,3.8 10.95,3.8 3.8,10.95 3.8,21.05 7.38,24.62";
const LOWER_HALF = "7.38,24.62 10.95,28.2 21.05,28.2 28.2,21.05 28.2,10.95 24.62,7.38";

type Props = { size?: number; className?: string };

/** Decorative: the word "Foundry" always sits next to it, so it is hidden from screen readers. */
export default function Logo({ size = 32, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill={LOGO_COLORS.iron} />
      <polygon points={UPPER_HALF} fill={LOGO_COLORS.paper} />
      <polygon points={LOWER_HALF} fill={LOGO_COLORS.mist} />
      <path d="M3 29 L29 3" stroke={LOGO_COLORS.iron} strokeWidth="0.9" />
      <rect x="9.5" y="9.5" width="13" height="13" rx="3.4" fill={LOGO_COLORS.iron} />
      <rect x="11.4" y="11.4" width="9.2" height="9.2" rx="2.3" fill={LOGO_COLORS.paper} />
    </svg>
  );
}
