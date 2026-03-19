import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Onboarding from "@/components/Onboarding";
import ThemeProvider from "@/components/ThemeProvider";

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
          <Navigation />
          <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 sm:pb-10 sm:pt-8">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
