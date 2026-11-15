import { avatarTone, cn, initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg", xl: "h-24 w-24 text-3xl" };

export function Avatar({ user, size = "md", className, ring = false }: { user: Pick<Profile, "id" | "fullName" | "avatarUrl">; size?: keyof typeof sizes; className?: string; ring?: boolean }) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white", sizes[size], ring && "ring-2 ring-cream", className)}
      style={{ background: avatarTone(user.id) }}
      title={user.fullName}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(user.fullName)
      )}
    </span>
  );
}

export function AvatarStack({ users, max = 3, size = "xs" }: { users: Pick<Profile, "id" | "fullName" | "avatarUrl">[]; max?: number; size?: keyof typeof sizes }) {
  const shown = users.slice(0, max);
  return (
    <span className="flex -space-x-1.5">
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
      {users.length > max && (
        <span className={cn("inline-grid place-items-center rounded-full bg-cream-200 font-semibold text-muted ring-2 ring-cream", sizes[size])}>+{users.length - max}</span>
      )}
    </span>
  );
}
