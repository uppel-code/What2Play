"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const DETAIL_ROUTES = ["/game", "/player", "/leaderboard"];

const TAB_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/today", label: "Spielen", icon: "play" },
  { href: "/add", label: "Hinzufügen", icon: "plus" },
  { href: "/achievements", label: "Profil", icon: "trophy" },
  { href: "/settings", label: "Mehr", icon: "menu" },
] as const;

export default function BottomTabBar() {
  const pathname = usePathname();

  const isDetailPage = DETAIL_ROUTES.some((route) => pathname.startsWith(route));
  if (isDetailPage) return null;

  return (
    <nav
      data-testid="bottom-tab-bar"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-warm-200/40 bg-surface/85 backdrop-blur-xl dark:border-warm-700/30 dark:bg-warm-900/90"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-2">
        {TAB_ITEMS.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const isFab = item.icon === "plus";

          if (isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group -mt-4 flex flex-col items-center gap-0.5 pb-2 pt-0"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 ${
                    isActive
                      ? "bg-forest text-white shadow-forest/30 scale-105"
                      : "bg-forest/90 text-white shadow-forest/20 group-hover:bg-forest group-hover:scale-105"
                  }`}
                >
                  <TabIcon type={item.icon} className="h-6 w-6" />
                </span>
                <span
                  className={`text-[10px] font-semibold transition-colors duration-200 ${
                    isActive ? "text-forest" : "text-warm-500"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 transition-colors duration-200 ${
                isActive ? "text-forest" : "text-warm-400 hover:text-warm-600"
              }`}
            >
              <TabIcon
                type={item.icon}
                className={`h-5 w-5 transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
                filled={isActive}
              />
              <span
                className={`text-[10px] font-medium ${isActive ? "font-semibold" : ""}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TabIcon({
  type,
  className,
  filled,
}: {
  type: string;
  className?: string;
  filled?: boolean;
}) {
  const stroke = filled ? 2.2 : 1.8;

  switch (type) {
    case "home":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1m-2 0h2" />
        </svg>
      );
    case "play":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "plus":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      );
    case "trophy":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14l-1.5 6.5a5.5 5.5 0 01-11 0L5 3zM12 15v4m-4 2h8M8 3H5a2 2 0 00-2 2v1a4 4 0 004 4m10-7h3a2 2 0 012 2v1a4 4 0 01-4 4" />
        </svg>
      );
    case "menu":
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={stroke}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
    default:
      return null;
  }
}
