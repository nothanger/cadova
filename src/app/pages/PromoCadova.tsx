import { useCallback, useEffect, useMemo, useState } from "react";
import { PromoCadovaAnimation } from "@/app/components/promo/PromoCadovaAnimation";

const BG = "#0B1020";

export function PromoCadova() {
  const reducedMotionPreferred = usePrefersReducedMotion();
  /** Mode capture : Replay plus discret (réduit opacité + petit contrôle système préféré). */
  const [replayKey, bumpReplay] = useState(0);
  const hideControls = useMemo(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("capture") === "1" || params.get("controls") === "0";
  }, []);

  useEffect(() => {
    document.title = "Cadova — Clip promo";
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onReplay = useCallback(() => {
    bumpReplay((k) => k + 1);
  }, []);

  const replayButton = useMemo(() => {
    const base =
      "absolute bottom-[max(env(safe-area-inset-bottom),12px)] left-1/2 z-[20] -translate-x-1/2 " +
      "rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] " +
      "text-white/55 backdrop-blur-sm transition-colors duration-150 " +
      "hover:border-white/20 hover:bg-white/[0.04] hover:text-white/75 motion-reduce:opacity-95";

    if (import.meta.env.DEV) {
      return (
        <button type="button" className={`${base} opacity-90`} onClick={onReplay}>
          Replay
        </button>
      );
    }

    return (
      <button type="button" className={`${base} opacity-45`} onClick={onReplay}>
        Replay
      </button>
    );
  }, [onReplay]);

  return (
    <main
      className="promo-root fixed inset-0 flex items-center justify-center overflow-hidden overscroll-none"
      style={{
        backgroundColor: BG,
        fontFamily:
          '"Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
      }}
      aria-label="Animation promotionnelle Cadova"
    >
      <div className="relative h-[min(100dvh,100svh)] w-full max-w-none overflow-hidden [&::-webkit-scrollbar]:hidden">
        <div
          className="relative mx-auto grid h-[min(100dvh,100svh)] w-[min(100vw,calc(min(100dvh,100svh)*9/16))] overflow-hidden [&::-webkit-scrollbar]:hidden motion-reduce:transition-none"
          style={{
            aspectRatio: "9 / 16",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <PromoCadovaAnimation replayToken={replayKey} reducedMotion={reducedMotionPreferred} />
          {!hideControls && replayButton}
        </div>
      </div>
    </main>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return reduced;
}
