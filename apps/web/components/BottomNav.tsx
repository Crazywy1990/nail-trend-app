import { HeartIcon, PinIcon, SearchIcon, SparkleIcon, UserIcon } from "./Icons";

const ITEMS = [
  { href: "/", label: "Discover", Icon: SearchIcon },
  { href: "/community", label: "Community", Icon: SparkleIcon },
  { href: "/saved", label: "Saved", Icon: HeartIcon },
  { href: "/salons", label: "Salons", Icon: PinIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export function BottomNav({ current }: { current: string }) {
  return (
    <nav className="nav" aria-label="Main">
      <a href="/" className="nav-brand" aria-label="AllTen home">AllTen</a>
      {ITEMS.map(({ href, label, Icon }) => (
        <a key={href} href={href} aria-current={current === href ? "page" : undefined}>
          <Icon />
          {label}
        </a>
      ))}
    </nav>
  );
}
