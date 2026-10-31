import { HeartIcon, PinIcon, SearchIcon, UserIcon } from "./Icons";

const ITEMS = [
  { href: "/", label: "Discover", Icon: SearchIcon },
  { href: "/saved", label: "Saved", Icon: HeartIcon },
  { href: "/salons", label: "Salons", Icon: PinIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export function BottomNav({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map(({ href, label, Icon }) => (
        <a key={href} href={href} aria-current={current === href ? "page" : undefined}>
          <Icon />
          {label}
        </a>
      ))}
    </nav>
  );
}
