export type NavHref = "/" | "/incidents" | "/services" | "/settings";

export type NavItem = {
  href: NavHref;
  label: string;
  match: "exact" | "prefix";
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Overview", match: "exact" },
  { href: "/incidents", label: "Incidents", match: "prefix" },
  { href: "/services", label: "Services", match: "prefix" },
  { href: "/settings", label: "Settings", match: "exact" },
] as const;

export function isNavItemActive(
  pathname: string,
  href: NavHref,
  match: NavItem["match"],
): boolean {
  switch (match) {
    case "exact":
      return pathname === href;
    case "prefix":
      return pathname === href || pathname.startsWith(`${href}/`);
    default: {
      const _exhaustive: never = match;
      return _exhaustive;
    }
  }
}
