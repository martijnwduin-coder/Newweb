import { Compass, Library, Map, User, Users } from "lucide-react";

export const NAV = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/map", label: "Map", icon: Map },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/collections", label: "Collections", icon: Library },
  { href: "/profile", label: "Profile", icon: User },
] as const;

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/profile") return pathname.startsWith("/profile") || pathname.startsWith("/settings");
  return pathname.startsWith(href);
}
