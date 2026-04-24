import { cn } from "./ui/utils";

const AVATAR_GRADIENTS = [
  ["#5044F5", "#0EA5E9"],
  ["#5B5EF7", "#14B8A6"],
  ["#6D5DF6", "#38BDF8"],
  ["#4338CA", "#06B6D4"],
  ["#7C3AED", "#2563EB"],
  ["#4F46E5", "#22D3EE"],
] as const;

const sizeClasses = {
  sm: "size-9 rounded-[10px] text-xs",
  md: "size-12 rounded-[14px] text-sm",
  lg: "size-16 rounded-2xl text-xl",
} as const;

type UserAvatarProps = {
  name?: string | null;
  email?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
};

function normalizeIdentityValue(value?: string | null) {
  return (value || "").trim();
}

function initialFrom(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .charAt(0)
    .toUpperCase();
}

function hashIdentity(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getUserInitials(name?: string | null, email?: string | null) {
  const cleanName = normalizeIdentityValue(name);
  const cleanEmail = normalizeIdentityValue(email);

  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    const initials =
      parts.length > 1
        ? `${initialFrom(parts[0])}${initialFrom(parts[parts.length - 1])}`
        : initialFrom(parts[0]);

    return initials.slice(0, 2) || "U";
  }

  if (cleanEmail) {
    return initialFrom(cleanEmail.split("@")[0] || cleanEmail).slice(0, 1) || "U";
  }

  return "U";
}

export function getUserDisplayName(name?: string | null) {
  return normalizeIdentityValue(name) || "Utilisateur";
}

export function getUserDisplayEmail(email?: string | null) {
  return normalizeIdentityValue(email) || "Compte Cadova";
}

export function getStableAvatarGradient(name?: string | null, email?: string | null) {
  const key = `${normalizeIdentityValue(name) || normalizeIdentityValue(email) || "cadova"}`.toLowerCase();
  const [from, to] = AVATAR_GRADIENTS[hashIdentity(key) % AVATAR_GRADIENTS.length];

  return {
    background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
  };
}

export function UserAvatar({ name, email, size = "md", className }: UserAvatarProps) {
  const initials = getUserInitials(name, email);

  return (
    <div
      aria-label={`Avatar ${getUserDisplayName(name)}`}
      className={cn(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden border border-white/30 font-extrabold leading-none text-white shadow-[0_12px_28px_rgba(80,68,245,0.22)] ring-1 ring-black/5",
        "after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(145deg,rgba(255,255,255,0.26),transparent_45%,rgba(0,0,0,0.12))]",
        sizeClasses[size],
        className,
      )}
      style={getStableAvatarGradient(name, email)}
    >
      <span className="relative z-10 tracking-normal">{initials}</span>
    </div>
  );
}
