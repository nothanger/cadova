import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
      { phase: "main", at: 1.05 * 1000 },
      { phase: "expand", at: 8.75 * 1000 },
      { phase: "outro", at: 10.45 * 1000 },
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

function OrbitDots({
  orbitPx,
  active,
  reducedMotion,
}: {
  orbitPx: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const rotationDuration = reducedMotion ? 0 : 14;
  const points = useMemo(() => [0, 120, 240], []);

  return (
    <motion.div
      className="pointer-events-none absolute"
      style={{
        left: "var(--cadova-mark-cx)",
        top: "var(--cadova-mark-cy)",
        width: orbitPx * 2,
        height: orbitPx * 2,
        marginLeft: -orbitPx,
        marginTop: -orbitPx,
      }}
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <motion.div
        className="absolute inset-0"
        animate={
          reducedMotion ? { rotate: 0 } : active ? { rotate: 360 } : { rotate: 0 }
        }
        transition={
          reducedMotion || !active
            ? { duration: 0 }
            : {
                rotate: {
                  duration: rotationDuration,
                  repeat: Infinity,
                  ease: "linear",
                },
              }
        }
      >
        {points.map((deg) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2 rounded-full bg-white/95"
            style={{
              width: 6,
              height: 6,
              marginLeft: -3,
              marginTop: -3,
              boxShadow:
                `0 0 10px 2px color-mix(in srgb, ${VIOLET} 72%, transparent), ` +
                `0 0 22px 4px color-mix(in srgb, ${VIOLET} 38%, transparent)`,
              transform: `rotate(${deg}deg) translateY(-${orbitPx}px)`,
              opacity: reducedMotion ? 0.72 : 0.96,
            }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

/** Anneaux fins autour du rond violet. */
function OrbitalRings({
  purplePx,
  show,
}: {
  purplePx: number;
  show: boolean;
}) {
  const scales = [1.52, 1.98, 2.42];
  return (
    <div
      className="pointer-events-none absolute rounded-full border border-white/[0.12]"
      style={{
        left: "var(--cadova-mark-cx)",
        top: "var(--cadova-mark-cy)",
        width: purplePx,
        height: purplePx,
        marginLeft: -purplePx / 2,
        marginTop: -purplePx / 2,
      }}
      aria-hidden
    >
      {scales.map((s, i) => (
        <motion.div
          key={s}
          className="absolute left-1/2 top-1/2 rounded-full border border-white/[0.16]"
          style={{
            width: purplePx * s,
            height: purplePx * s,
            translateX: "-50%",
            translateY: "-50%",
            borderColor:
              i === 1 ? "color-mix(in srgb, #7B7DFF 35%, transparent)" : "rgba(255,255,255,0.11)",
          }}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={
            show
              ? { opacity: i === 0 ? 1 : i === 1 ? 0.65 : 0.45, scale: 1 }
              : { opacity: 0, scale: 0.94 }
          }
          transition={{ duration: 0.95, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </div>
  );
}

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
  const showRingsOrb = phase === "main";
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
                {({ purplePx }) => (
                  <>
                    <OrbitalRings purplePx={purplePx} show={showRingsOrb && !reducedMotion} />

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

                    <CadovaMarkC className="relative z-[1] h-full w-full" cFill={C_FILL} />

                    <OrbitDots
                      orbitPx={purplePx * 1.18}
                      active={showRingsOrb}
                      reducedMotion={reducedMotion}
                    />
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
