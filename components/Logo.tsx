// The Foundry mark: an F built from a stem and two arms, like the stages of a pipeline, with one amber node
// where the output leaves (the pull request draft). Iron and amber are the site's own two colours.
// `app/icon.svg` is the same drawing, for the browser tab.

export const LOGO_COLORS = { iron: "#1e252b", paper: "#e6ebee", amber: "#f0a23a" } as const;

type Props = { size?: number; className?: string };

/** Decorative: the word "Foundry" always sits next to it, so it is hidden from screen readers. */
export default function Logo({ size = 32, className }: Props) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill={LOGO_COLORS.iron} />
      <rect x="9" y="7" width="4.2" height="18" rx="2.1" fill={LOGO_COLORS.paper} />
      <rect x="9" y="7" width="13" height="4.2" rx="2.1" fill={LOGO_COLORS.paper} />
      <rect x="9" y="14" width="8.5" height="4.2" rx="2.1" fill={LOGO_COLORS.paper} />
      <circle cx="25.4" cy="9.1" r="2.3" fill={LOGO_COLORS.amber} />
    </svg>
  );
}
