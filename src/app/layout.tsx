import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomTabBar from "@/components/BottomTabBar";
import Onboarding from "@/components/Onboarding";
import ThemeProvider from "@/components/ThemeProvider";
import SwipeBack from "@/components/SwipeBack";

export const metadata: Metadata = {
  title: "What2Play – Brettspiel-Sammlung",
  description: "Finde schnell das passende Brettspiel für deine Runde",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Onboarding />
          <SwipeBack />
          <BottomTabBar />
          <main className="mx-auto max-w-6xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-10 sm:pt-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
