"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Preferences } from "@capacitor/preferences";

const ONBOARDING_KEY = "onboarding_completed";

const steps = [
  {
    icon: "🎲",
    title: "Willkommen bei What2Play!",
    description:
      "Deine Brettspiel-Sammlung immer dabei — finde blitzschnell das perfekte Spiel für jede Runde.",
  },
  {
    icon: "📸",
    title: "Füge deine Spiele hinzu",
    description:
      "Scanne dein Regal per Foto oder importiere direkt aus BoardGameGeek.",
  },
  {
    icon: "🚀",
    title: "Los geht's!",
    description:
      "Nutze den Zufalls-Picker oder Filter, um sofort loszuspielen.",
  },
];

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const touchStart = useRef(0);
  const touchDelta = useRef(0);

  useEffect(() => {
    Preferences.get({ key: ONBOARDING_KEY }).then(({ value }) => {
      if (value !== "true") setVisible(true);
    });
  }, []);

  const dismiss = useCallback(async () => {
    setExiting(true);
    await Preferences.set({ key: ONBOARDING_KEY, value: "true" });
    setTimeout(() => setVisible(false), 300);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= steps.length) return;
      setDirection(next > current ? "left" : "right");
      setCurrent(next);
    },
    [current],
  );

  const next = useCallback(() => {
    if (current < steps.length - 1) goTo(current + 1);
    else dismiss();
  }, [current, goTo, dismiss]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
    touchDelta.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDelta.current = e.touches[0].clientX - touchStart.current;
  };

  const handleTouchEnd = () => {
    if (touchDelta.current < -50) goTo(current + 1);
    else if (touchDelta.current > 50) goTo(current - 1);
  };

  if (!visible) return null;

  const step = steps[current];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-cream transition-opacity duration-300 ${exiting ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className="flex w-full max-w-md flex-col items-center px-6 py-12"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Icon */}
        <div
          key={`icon-${current}-${direction}`}
          className="mb-8 animate-[onboarding-slide_0.3s_ease-out] text-7xl"
        >
          {step.icon}
        </div>

        {/* Title */}
        <h1
          key={`title-${current}-${direction}`}
          className="mb-3 animate-[onboarding-slide_0.3s_ease-out_50ms_both] text-center font-display text-2xl font-bold text-warm-900"
        >
          {step.title}
        </h1>

        {/* Description */}
        <p
          key={`desc-${current}-${direction}`}
          className="mb-12 max-w-xs animate-[onboarding-slide_0.3s_ease-out_100ms_both] text-center font-body text-warm-600"
        >
          {step.description}
        </p>

        {/* Dots */}
        <div className="mb-10 flex gap-2">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Schritt ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-forest"
                  : "w-2 bg-warm-300 hover:bg-warm-400"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <button
          onClick={next}
          className="mb-4 w-full max-w-xs rounded-xl bg-forest px-6 py-3.5 font-display font-semibold text-white transition-colors hover:bg-forest-dark"
        >
          {current === steps.length - 1 ? "Fertig" : "Weiter"}
        </button>

        <button
          onClick={dismiss}
          className="font-body text-sm text-warm-500 transition-colors hover:text-warm-700"
        >
          Überspringen
        </button>
      </div>
    </div>
  );
}
