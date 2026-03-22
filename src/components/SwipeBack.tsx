"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const EDGE_ZONE = 30; // px from left edge to start swipe
const MIN_SWIPE_DISTANCE = 80; // px to trigger navigation
const MAX_INDICATOR = 120; // max visual indicator width (must be >= MIN_SWIPE_DISTANCE)

// Pages that are "root" level — swipe-back should not navigate away from these
const ROOT_PAGES = new Set(["/", "/today", "/add", "/achievements", "/settings", "/manage", "/groups"]);

export default function SwipeBack() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const navHistoryRef = useRef<string[]>([]);
  const touchRef = useRef<{ startX: number; startY: number; started: boolean }>({
    startX: 0,
    startY: 0,
    started: false,
  });
  const swipeProgressRef = useRef(0);
  const [swipeProgress, setSwipeProgress] = useState(0);

  // Keep pathname ref in sync (avoids stale closures in touch handlers)
  useEffect(() => {
    pathnameRef.current = pathname;
    const history = navHistoryRef.current;
    if (history[history.length - 1] !== pathname) {
      history.push(pathname);
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
    if (dy > dx * 1.5) {
      touchRef.current.started = false;
      swipeProgressRef.current = 0;
      setSwipeProgress(0);
      return;
    }
    if (dx > 0) {
      const clamped = Math.min(dx, MAX_INDICATOR);
      swipeProgressRef.current = clamped;
      setSwipeProgress(clamped);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchRef.current.started) return;
    const progress = swipeProgressRef.current;
    const currentPath = pathnameRef.current;

    if (progress >= MIN_SWIPE_DISTANCE) {
      if (ROOT_PAGES.has(currentPath)) {
        // On a root page — don't navigate (would exit the app)
      } else {
        const history = navHistoryRef.current;
        // Pop current page
        if (history.length > 1) {
          history.pop();
          const previousPage = history[history.length - 1];
          // Use router.push instead of router.back to avoid exiting Capacitor WebView
          router.push(previousPage);
        } else {
          // No history — go home
          router.push("/");
        }
      }
    }

    touchRef.current.started = false;
    swipeProgressRef.current = 0;
    setSwipeProgress(0);
  }, [router]);

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
