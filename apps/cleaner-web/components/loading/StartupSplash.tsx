"use client";

import { useEffect, useState } from "react";

export function StartupSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 750);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-2xl">
          🏠
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-tight">
          Pilotys
        </h1>

        <p className="mt-2 text-sm font-semibold text-white/60">
          Chargement de l’espace…
        </p>

        <div className="mx-auto mt-8 h-2 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-20 animate-[pilotys-loading_1.15s_ease-in-out_infinite] rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}
