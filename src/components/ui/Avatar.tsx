const TONES = ["blue", "violet", "teal", "amber", "rose", "slate"] as const;

function initialsFor(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return (name.slice(0, 2) || "?").toUpperCase();
}

function toneFor(name: string): (typeof TONES)[number] {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return TONES[hash % TONES.length];
}

type AvatarProps = {
  name?: string;
  size?: "sm" | "md";
};

/** Initials avatar; decorative because the name is always shown beside it. */
function Avatar({ name = "", size = "sm" }: AvatarProps) {
  return (
    <span
      className={`ah-avatar ah-avatar--${size} ah-avatar--${toneFor(name)}`}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  );
}

export default Avatar;
