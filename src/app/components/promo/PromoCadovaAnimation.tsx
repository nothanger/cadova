import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, type Transition } from "motion/react";
import { CadovaMarkC, markPurpleCenterFrac, MARK_VIEWBOX_W } from "./CadovaMark";

const BG = "#0B1020";
const VIOLET = "#5A5CFF";
const C_FILL = "#E8EAFF";

/** Durée narration « normale », en secondes. */
const TOTAL_S = 12;

type Phase = "intro" | "main" | "expand" | "outro";

type Props = {
  replayToken: number;
  reducedMotion: boolean;
};

function usePhaseTimeline(replayToken: number, reducedMotion: boolean) {
  const [phase, setPhase] = useState<Phase>(() => (reducedMotion ? "outro" : "intro"));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => {
    clearTimers();
    if (reducedMotion) {
      setPhase("outro");
      return;
    }

    setPhase("intro");
    const t: { phase: Phase; at: number }[] = [
      { phase: "main", at: 1.45 * 1000 },
      { phase: "expand", at: 8.05 * 1000 },
      { phase: "outro", at: 9.55 * 1000 },
    ];

    timers.current.push(
      setTimeout(() => setPhase(t[0].phase), t[0].at),
      setTimeout(() => setPhase(t[1].phase), t[1].at),
      setTimeout(() => setPhase(t[2].phase), t[2].at),
    );
    return clearTimers;
  }, [replayToken, reducedMotion, clearTimers]);

  return phase;
}

const easingSoft: Transition = {
  duration: 0.9,
  ease: [0.22, 1, 0.36, 1],
};

export function PromoCadovaAnimation({ replayToken, reducedMotion }: Props) {
  const phase = usePhaseTimeline(replayToken, reducedMotion);
  const { fx, fy } = markPurpleCenterFrac();
  const storyRef = useRef<HTMLDivElement>(null);
  const purpleAnchorRef = useRef<HTMLDivElement>(null);
  const [expanderPct, setExpanderPct] = useState<{ x: number; y: number } | null>(null);

  /** Taille relative du sceau principal (pourcent du plus petit côté du viewport 9:16). */
  const markSizeFrac = 0.36;
  const purpleFracOfMark = (2 * 41.5612 * 0.88) / MARK_VIEWBOX_W;

  const showLogoLayer = phase === "intro" || phase === "main" || phase === "expand";
  const showExpander = phase === "expand" || phase === "outro";

  useLayoutEffect(() => {
    function syncPurpleCenter() {
      const story = storyRef.current;
      const dot = purpleAnchorRef.current;
      if (!story || !dot) return;
      const s = story.getBoundingClientRect();
      const d = dot.getBoundingClientRect();
      setExpanderPct({
        x: ((d.left + d.width / 2 - s.left) / Math.max(s.width, 1)) * 100,
        y: ((d.top + d.height / 2 - s.top) / Math.max(s.height, 1)) * 100,
      });
    }

    syncPurpleCenter();

    const story = storyRef.current;
    const dot = purpleAnchorRef.current;
    if (!story) return undefined;

    const ro = new ResizeObserver(syncPurpleCenter);
    ro.observe(story);
    if (dot) ro.observe(dot);

    window.addEventListener("resize", syncPurpleCenter);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncPurpleCenter);
    };
  }, [replayToken, showLogoLayer, phase]);

  const cxExp = expanderPct?.x ?? fx * 100;
  const cyExp = expanderPct?.y ?? fy * 100;

  const storyCssVars = useMemo(
    () =>
      ({
        "--cadova-promo-mark-frac": `${markSizeFrac * 100}%`,
        "--cadova-purple-frac": String(purpleFracOfMark),
      }) as CSSProperties,
    [markSizeFrac, purpleFracOfMark],
  );

  return (
    <div
      ref={storyRef}
      className="promo-story relative flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden"
      style={{
        ...storyCssVars,
        backgroundColor: BG,
      }}
      data-phase={phase}
    >
      <div
        className="promo-brand-vignette pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(closest-side at 50% 42%, rgba(90,92,255,0.09) 0%, transparent 55%), radial-gradient(closest-side at 50% 100%, rgba(90,92,255,0.05) 0%, transparent 40%)",
        }}
      />

      <AnimatePresence>
        {showLogoLayer && (
          <motion.div
            key="mark-layer"
            className="relative flex w-[var(--cadova-promo-mark-frac)] max-w-[min(68vw,240px)] items-center justify-center"
            initial={reducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.93 }}
            animate={
              phase === "expand" && !reducedMotion
                ? { opacity: 0.08, scale: 0.95, transition: { duration: 0.55 } }
                : { opacity: 1, scale: 1 }
            }
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={reducedMotion ? { duration: 0 } : easingSoft}
          >
            <div className="relative aspect-square w-full">
              {/* Centre du sceau mesuré en px pour cercles orbitaux */}
              <MarkMeasure purpleFrac={purpleFracOfMark} fx={fx} fy={fy}>
                {() => (
                  <>
                    {/* Rond violet (CSS), toujours rond */}
                    {/* Conteneur de taille stable pour l’alignement du volet violet (évite les sauts lors du pulse) */}
                    <div
                      ref={purpleAnchorRef}
                      className="promo-purple-core absolute rounded-full"
                      style={{
                        left: `${fx * 100}%`,
                        top: `${fy * 100}%`,
                        transform: "translate(-50%, -50%)",
                        width: `${purpleFracOfMark * 100}%`,
                        height: `${purpleFracOfMark * 100}%`,
                      }}
                    >
                      <motion.div
                        className="relative h-full w-full rounded-[inherit]"
                        style={{
                          backgroundColor: VIOLET,
                          boxShadow: `0 0 40px 6px color-mix(in srgb, ${VIOLET} 40%, transparent)`,
                        }}
                        animate={
                          reducedMotion
                            ? { scale: 1 }
                            : phase === "expand" || phase === "outro"
                              ? { scale: 1 }
                              : {
                                  scale: [1, 1.048, 1],
                                }
                        }
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : {
                                repeat:
                                  phase === "expand" || phase === "outro" ? 0 : Infinity,
                                duration: 2.6,
                                ease: [0.45, 0, 0.55, 1],
                                delay: phase === "intro" ? 0.35 : 0,
                              }
                        }
                      />
                    </div>

                    <motion.div
                      className="absolute inset-0 z-[1]"
                      style={{
                        transformOrigin: `${fx * 100}% ${fy * 100}%`,
                        backfaceVisibility: "hidden",
                        willChange: reducedMotion ? undefined : "transform",
                      }}
                      initial={
                        reducedMotion
                          ? { opacity: 1, rotate: 0, scale: 1 }
                          : { opacity: 0, rotate: -96, scale: 0.9 }
                      }
                      animate={
                        reducedMotion
                          ? { opacity: 1, rotate: 0, scale: 1 }
                          : phase === "main"
                            ? { opacity: 1, rotate: 1960, scale: 1 }
                            : phase === "expand"
                              ? { opacity: 0.16, rotate: 2440, scale: 0.94 }
                              : { opacity: 1, rotate: 0, scale: 1 }
                      }
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : phase === "main"
                            ? {
                                rotate: { duration: 6.6, ease: [0.58, 0, 1, 1] },
                                opacity: { duration: 0.55, ease: "easeOut" },
                                scale: { duration: 0.55, ease: "easeOut" },
                              }
                            : phase === "expand"
                              ? { duration: 1.15, ease: "linear" }
                              : { duration: 1.15, ease: [0.22, 1, 0.36, 1] }
                      }
                    >
                      <CadovaMarkC className="h-full w-full" cFill={C_FILL} />
                    </motion.div>
                  </>
                )}
              </MarkMeasure>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transition plein écran violet depuis le même centre que le rond */}
      <AnimatePresence>
        {showExpander && (
          <motion.div
            key={`exp-${replayToken}`}
            className="pointer-events-none absolute z-[5] rounded-full bg-[#5A5CFF]"
            style={{
              left: `${cxExp}%`,
              top: `${cyExp}%`,
              translateX: "-50%",
              translateY: "-50%",
              width: "min(30vw, 16.5vmin)",
              maxWidth: "120px",
              aspectRatio: "1",
              willChange: reducedMotion ? undefined : "transform",
            }}
            initial={{ scale: reducedMotion ? 24 : 0.52 }}
            animate={{ scale: 34 }}
            transition={
              reducedMotion
                ? { duration: 0.35, ease: "easeOut" }
                : {
                    duration: 1.5,
                    ease: [0.32, 0.92, 0.27, 1],
                  }
            }
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "outro" && (
          <motion.div
            key="outro"
            role="presentation"
            className="pointer-events-none absolute inset-0 z-[6] flex flex-col items-center justify-center px-[6%] text-center font-[family-name:var(--font-sora)] tracking-[-0.02em]"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.12 }}
            style={{
              fontFamily:
                '"Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              background:
                "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.03) 34%, transparent 68%)",
            }}
          >
            <p
              className="mx-auto max-w-[18ch] text-[clamp(1.15rem,4.9vw,1.85rem)] font-semibold leading-snug text-[#0B1020]"
              style={{
                opacity: reducedMotion ? 1 : undefined,
              }}
            >
              CV. Lettre. Candidatures.
            </p>
            <p
              className="mx-auto mt-3 max-w-[22ch] text-[clamp(0.95rem,3.75vw,1.35rem)] font-medium leading-snug text-[#0B1020]/80"
            >
              Tout est organisé avec Cadova.
            </p>
            <p className="mt-5 text-[clamp(1rem,3.9vw,1.2rem)] font-semibold text-[#0B1020]/90">
              cadova.fr
            </p>
            <motion.div
              className="mt-auto mb-[8%]"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reducedMotion ? 0 : 0.5,
                delay: reducedMotion ? 0 : 0.35,
              }}
            >
              <img
                src="/logo-dark.svg"
                alt="Cadova"
                className="h-[clamp(36px,9vw,48px)] w-auto max-w-[min(72vw,280px)] object-contain object-bottom"
                draggable={false}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "outro" && (
          <motion.div
            key="outro-ad"
            role="presentation"
            className="pointer-events-none absolute inset-0 z-[7] flex flex-col items-center justify-center px-[7%] text-center"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.45, delay: reducedMotion ? 0 : 0.08 }}
            style={{
              background:
                "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 36%, transparent 67%), linear-gradient(155deg, #5A5CFF 0%, #5457F5 52%, #475DFF 100%)",
              fontFamily:
                '"Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            }}
          >
            <motion.h1
              className="mb-8 text-[clamp(3rem,15vw,5.6rem)] font-extrabold leading-none text-white"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0.86, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.1 }}
              style={{ textShadow: "0 0 34px rgba(255,255,255,0.28)" }}
            >
              Cadova
            </motion.h1>

            {[
              {
                text: "Besoin d'un stage ?",
                className:
                  "max-w-[15ch] text-[clamp(1.55rem,7vw,2.55rem)] font-extrabold leading-[1.05] text-white",
              },
              {
                text: "CV. Lettre. Candidatures.",
                className:
                  "mt-4 max-w-[19ch] text-[clamp(1.02rem,4.4vw,1.48rem)] font-semibold leading-snug text-white/92",
              },
              {
                text: "Tout est prêt avec Cadova.",
                className:
                  "mt-3 max-w-[20ch] text-[clamp(0.92rem,3.65vw,1.22rem)] font-medium leading-snug text-white/82",
              },
            ].map((line, index) => (
              <motion.p
                key={line.text}
                className={`mx-auto ${line.className}`}
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0.88, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: reducedMotion ? 0 : 0.55,
                  delay: reducedMotion ? 0 : 0.24 + index * 0.14,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {line.text}
              </motion.p>
            ))}

            <motion.p
              className="relative mt-7 rounded-full px-4 py-2 text-[clamp(1rem,4vw,1.24rem)] font-bold text-white"
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0.9, y: 5, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: reducedMotion ? 0 : 0.55,
                delay: reducedMotion ? 0 : 0.76,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{
                textShadow: "0 0 20px rgba(255,255,255,0.48)",
                boxShadow: "0 0 34px rgba(255,255,255,0.16)",
              }}
            >
              cadova.fr
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {!reducedMotion && (
        <span className="sr-only">
          Séquence Cadova environ {TOTAL_S} secondes : apparition du logo, anneaux, points orbitaux puis
          message final.
        </span>
      )}
    </div>
  );
}

function MarkMeasure({
  children,
  purpleFrac,
  fx,
  fy,
}: {
  purpleFrac: number;
  fx: number;
  fy: number;
  children: (args: { purplePx: number }) => ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(160);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure() {
      const w = el.getBoundingClientRect().width;
      setSide(w);
    }
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const purplePx = side * purpleFrac;

  const centerVars = useMemo(
    () =>
      ({
        ["--cadova-mark-cx" as string]: `${fx * 100}%`,
        ["--cadova-mark-cy" as string]: `${fy * 100}%`,
      }) as CSSProperties,
    [fx, fy],
  );

  return (
    <div ref={ref} className="relative h-full w-full" style={centerVars}>
      {children({ purplePx })}
    </div>
  );
}
