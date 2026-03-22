"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const EDGE_ZONE = 30; // px from left edge to start swipe
const MIN_SWIPE_DISTANCE = 80; // px to trigger navigation
const MAX_INDICATOR = 120; // max visual indicator width (must be >= MIN_SWIPE_DISTANCE)

// Pages that are "root" level — swipe-back should not go beyond these
const ROOT_PAGES = new Set(["/", "/today", "/add", "/achievements", "/settings", "/manage", "/groups"]);

export default function SwipeBack() {
  const router = useRouter();
  const pathname = usePathname();
  const navHistoryRef = useRef<string[]>([]);
  const touchRef = useRef<{ startX: number; startY: number; started: boolean }>({
    startX: 0,
    startY: 0,
    started: false,
  });
  const [swipeProgress, setSwipeProgress] = useState(0);

  // Track navigation history ourselves since browser history API is limited
  useEffect(() => {
    const history = navHistoryRef.current;
    // Avoid duplicates when pathname hasn't changed (re-renders)
    if (history[history.length - 1] !== pathname) {
      history.push(pathname);
      // Keep history bounded
      if (history.length > 50) history.shift();
    }
  }, [pathname]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientX <= EDGE_ZONE) {
      touchRef.current = { startX: touch.clientX, startY: touch.clientY, started: true };
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchRef.current.started) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchRef.current.startX;
    const dy = Math.abs(touch.clientY - touchRef.current.startY);
    // Cancel if vertical movement dominates (user is scrolling)
    if (dy > dx * 1.5) {
      touchRef.current.started = false;
      setSwipeProgress(0);
      return;
    }
    if (dx > 0) {
      setSwipeProgress(Math.min(dx, MAX_INDICATOR));
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current.started) return;
    if (swipeProgress >= MIN_SWIPE_DISTANCE) {
      // Don't navigate back from root pages — would exit the app
      if (ROOT_PAGES.has(pathname)) {
        // Already on a root page, nowhere to go back
      } else if (navHistoryRef.current.length > 1) {
        // Pop current page from our history
        navHistoryRef.current.pop();
        router.back();
      } else {
        // No history (e.g. deep link) — go home instead of exiting the app
        router.push("/");
      }
    }
    touchRef.current.started = false;
    setSwipeProgress(0);
  }, [swipeProgress, router, pathname]);

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (swipeProgress <= 0) return null;

  const opacity = Math.min(swipeProgress / MIN_SWIPE_DISTANCE, 1);
  const scale = 0.5 + opacity * 0.5;

  return (
    <div
      className="fixed left-0 top-1/2 z-[100] -translate-y-1/2 pointer-events-none"
      style={{ opacity, transform: `translateY(-50%) translateX(${swipeProgress * 0.3}px)` }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-900/20 backdrop-blur-sm"
        style={{ transform: `scale(${scale})` }}
      >
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </div>
    </div>
  );
}
