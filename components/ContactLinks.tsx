import { profile } from "@/lib/profile";

/** Email plus the profile links. `label` replaces the address as the email link text. */
export default function ContactLinks({ label }: { label?: string }) {
  return (
    <>
      <a href={`mailto:${profile.email}`}>{label ?? profile.email}</a>
      {profile.links.map((l) => (
        <span key={l.label}>
          {" "}
          <a href={l.href} target="_blank" rel="noreferrer">
            {l.label}
          </a>
        </span>
      ))}
    </>
  );
}
