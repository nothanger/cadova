import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Mail,
  Send,
} from "lucide-react";
import { motion, type Transition } from "motion/react";
import { CadovaMarkC, markPurpleCenterFrac, MARK_VIEWBOX_W } from "./CadovaMark";

const BG = "#0B1020";
const VIOLET = "#5A5CFF";
const C_FILL = "#F2F3FF";
const TOTAL_S = 24;

const PROMO_ASSETS = {
  fullLogo: "/logo-dark.svg",
  cMark: null as string | null,
  userDot: null as string | null,
  wordmark: null as string | null,
};

type Props = {
  replayToken: number;
  reducedMotion: boolean;
};

type Feature = {
  label: string;
  angle: number;
  icon: typeof FileText;
  tone: string;
  detail: string;
};

const features: Feature[] = [
  {
    label: "CV",
    angle: -92,
    icon: FileText,
    tone: "#BFC1FF",
    detail: "Structure claire",
  },
  {
    label: "Lettre",
    angle: 25,
    icon: Mail,
    tone: "#D8DBFF",
    detail: "Texte adapte",
  },
  {
    label: "Candidatures",
    angle: 145,
    icon: BriefcaseBusiness,
    tone: "#AEB5FF",
    detail: "Suivi organise",
  },
];

const chaosFragments = [
  { x: "-34%", y: "-39%", w: 86, r: -9, d: 0, text: "relance ?" },
  { x: "27%", y: "-43%", w: 74, r: 8, d: 0.16, text: "CV v3" },
  { x: "-39%", y: "-16%", w: 64, r: 13, d: 0.32, text: "deadline" },
  { x: "34%", y: "-14%", w: 94, r: -12, d: 0.48, text: "lettre" },
  { x: "-28%", y: "18%", w: 72, r: -17, d: 0.64, text: "mail" },
  { x: "23%", y: "23%", w: 84, r: 11, d: 0.8, text: "stage" },
  { x: "-6%", y: "42%", w: 100, r: 4, d: 0.96, text: "a suivre" },
];

const easeOut: Transition["ease"] = [0.22, 1, 0.36, 1];
const easeInOut: Transition["ease"] = [0.65, 0, 0.35, 1];

export function PromoCadovaAnimation({ replayToken, reducedMotion }: Props) {
  const { fx, fy } = markPurpleCenterFrac();
  const purpleFracOfMark = (2 * 41.5612 * 0.88) / MARK_VIEWBOX_W;

  const storyCssVars = useMemo(
    () =>
      ({
        "--cadova-mark-cx": `${fx * 100}%`,
        "--cadova-mark-cy": `${fy * 100}%`,
        "--cadova-purple-frac": String(purpleFracOfMark),
      }) as CSSProperties,
    [fx, fy, purpleFracOfMark],
  );

  useEffect(() => {
    if (reducedMotion) return;
    const root = document.documentElement;
    root.style.setProperty("--cadova-promo-duration", `${TOTAL_S}s`);
    return () => root.style.removeProperty("--cadova-promo-duration");
  }, [reducedMotion]);

  if (reducedMotion) {
    return <ReducedMotionFrame />;
  }

  return (
    <div
      key={replayToken}
      className="promo-story relative h-full w-full overflow-hidden"
      style={{
        ...storyCssVars,
        background:
          "radial-gradient(circle at 50% 15%, rgba(90,92,255,0.16), transparent 38%), linear-gradient(180deg, #0B1020 0%, #10162A 54%, #080C18 100%)",
        color: "white",
      }}
    >
      <PromoStyle />
      <PremiumBackground />
      <ChaosIntro />
      <CentralUser fx={fx} fy={fy} purpleFrac={purpleFracOfMark} />
      <Ecosystem />
      <ProductReveal />
      <CinematicTransition />
      <FinalOutro />
      <span className="sr-only">
        Publicite Cadova de {TOTAL_S} secondes : chaos, organisation, produit, marque et appel a
        l'action.
      </span>
    </div>
  );
}

function PremiumBackground() {
  return (
    <>
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(circle at 50% 46%, black 0%, transparent 72%)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.34, 0.22, 0] }}
        transition={{ duration: 18, times: [0, 0.22, 0.72, 1], ease: "linear" }}
      />
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(90,92,255,0.24), transparent 29%), radial-gradient(circle at 10% 83%, rgba(255,255,255,0.07), transparent 28%), radial-gradient(circle at 90% 7%, rgba(190,194,255,0.08), transparent 24%)",
        }}
        initial={{ opacity: 0.55, scale: 1.04 }}
        animate={{ opacity: [0.55, 0.8, 0.55], scale: [1.04, 1, 1.08] }}
        transition={{ duration: 16, ease: "easeInOut" }}
      />
    </>
  );
}

function ChaosIntro() {
  return (
    <motion.div
      className="absolute inset-0 z-[1] flex items-center justify-center"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: 6.3, times: [0, 0.55, 1], ease: "easeOut" }}
    >
      <motion.div
        className="absolute top-[13%] w-full px-[9%] text-left"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: [0, 0.72, 0], y: [10, 0, -8] }}
        transition={{ duration: 4.1, times: [0, 0.3, 1], delay: 0.25, ease: easeOut }}
      >
        <p className="text-[clamp(0.76rem,3.4vw,1rem)] font-semibold uppercase tracking-[0.24em] text-white/44">
          Recherche de stage
        </p>
        <p className="mt-2 max-w-[17ch] text-[clamp(1.55rem,7vw,2.45rem)] font-extrabold leading-[0.98] text-white/86">
          Trop de pieces a garder en tete.
        </p>
      </motion.div>

      {chaosFragments.map((fragment) => (
        <motion.div
          key={fragment.text}
          className="promo-chaos-card absolute left-1/2 top-1/2"
          style={{
            width: fragment.w,
            x: fragment.x,
            y: fragment.y,
            rotate: fragment.r,
          }}
          initial={{ opacity: 0, scale: 0.88, filter: "blur(8px)" }}
          animate={{
            opacity: [0, 0.78, 0.54, 0],
            scale: [0.88, 1, 0.98, 0.72],
            filter: ["blur(8px)", "blur(0px)", "blur(0px)", "blur(10px)"],
            x: [fragment.x, `calc(${fragment.x} + ${fragment.r * -0.8}px)`, "0%"],
            y: [fragment.y, `calc(${fragment.y} + ${fragment.r * 0.5}px)`, "0%"],
          }}
          transition={{
            duration: 5.4,
            times: [0, 0.23, 0.62, 1],
            delay: fragment.d,
            ease: easeInOut,
          }}
        >
          <span>{fragment.text}</span>
          <i />
        </motion.div>
      ))}
    </motion.div>
  );
}

function CentralUser({ fx, fy, purpleFrac }: { fx: number; fy: number; purpleFrac: number }) {
  return (
    <motion.div
      className="absolute left-1/2 top-[43%] z-[3] aspect-square w-[70%] max-w-[360px] -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0, scale: 0.78, y: 22 }}
      animate={{
        opacity: [0, 1, 1, 1, 0],
        scale: [0.78, 1, 1.04, 0.92, 1.14],
        y: [22, 0, -8, -130, -210],
      }}
      transition={{
        duration: 17.2,
        times: [0, 0.21, 0.55, 0.82, 1],
        delay: 2.55,
        ease: easeOut,
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: `${fx * 100}% ${fy * 100}%` }}
        initial={{ opacity: 0, rotate: -42 }}
        animate={{ opacity: [0, 0, 1, 1, 0.42], rotate: [-42, -42, 0, 9, 19] }}
        transition={{ duration: 9.4, times: [0, 0.34, 0.52, 0.8, 1], delay: 2.2, ease: easeOut }}
      >
        {PROMO_ASSETS.cMark ? (
          <img src={PROMO_ASSETS.cMark} alt="" className="h-full w-full object-contain" />
        ) : (
          <CadovaMarkC className="h-full w-full" cFill={C_FILL} />
        )}
      </motion.div>

      <motion.div
        className="absolute rounded-full"
        style={{
          left: `${fx * 100}%`,
          top: `${fy * 100}%`,
          width: `${purpleFrac * 100}%`,
          height: `${purpleFrac * 100}%`,
          translateX: "-50%",
          translateY: "-50%",
        }}
        initial={{ opacity: 0, scale: 0.38 }}
        animate={{
          opacity: [0, 1, 1, 1, 0.94],
          scale: [0.38, 1, 1.06, 1.02, 1.18],
        }}
        transition={{ duration: 13.6, times: [0, 0.16, 0.36, 0.74, 1], delay: 2.95, ease: easeOut }}
      >
        {PROMO_ASSETS.userDot ? (
          <img src={PROMO_ASSETS.userDot} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="promo-user-dot h-full w-full rounded-full" />
        )}
      </motion.div>

      <motion.div
        className="promo-focus-ring absolute rounded-full"
        style={{
          left: `${fx * 100}%`,
          top: `${fy * 100}%`,
          width: "52%",
          height: "52%",
          translateX: "-50%",
          translateY: "-50%",
        }}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 0.55, 0.2, 0], scale: [0.5, 1.08, 1.34, 1.7] }}
        transition={{ duration: 4.2, delay: 3.25, ease: easeOut }}
      />
    </motion.div>
  );
}

function Ecosystem() {
  return (
    <motion.div
      className="absolute left-1/2 top-[43%] z-[4] aspect-square w-[78%] max-w-[400px] -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.88, 1, 1.02, 0.9] }}
      transition={{ duration: 8.4, times: [0, 0.16, 0.72, 1], delay: 6.1, ease: easeOut }}
    >
      <motion.div
        className="promo-orbit absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={{ opacity: 0, rotate: -14 }}
        animate={{ opacity: [0, 0.8, 0.7], rotate: [-14, 0, 22] }}
        transition={{ duration: 7.5, delay: 0.1, ease: "easeInOut" }}
      />
      <motion.div
        className="promo-orbit promo-orbit-soft absolute left-1/2 top-1/2 h-[66%] w-[66%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={{ opacity: 0, rotate: 18 }}
        animate={{ opacity: [0, 0.65, 0.5], rotate: [18, 0, -30] }}
        transition={{ duration: 7.2, delay: 0.55, ease: "easeInOut" }}
      />

      {features.map((feature, index) => (
        <OrbitFeature key={feature.label} feature={feature} index={index} />
      ))}

      <motion.p
        className="absolute bottom-[3%] left-1/2 w-[72%] -translate-x-1/2 text-center text-[clamp(0.78rem,3.4vw,1rem)] font-semibold leading-tight text-white/58"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: [0, 1, 1, 0], y: [8, 0, 0, -8] }}
        transition={{ duration: 5.4, times: [0, 0.22, 0.78, 1], delay: 1.2, ease: easeOut }}
      >
        Cadova organise tout autour de toi.
      </motion.p>
    </motion.div>
  );
}

function OrbitFeature({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{ rotate: feature.angle, transformOrigin: "0 0" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 5.9, times: [0, 0.18, 0.78, 1], delay: 0.5 + index * 0.34 }}
    >
      <motion.div
        className="promo-orbit-badge"
        style={{ rotate: -feature.angle, x: "-50%", y: "-145px" }}
        initial={{ scale: 0.7, y: "-112px", filter: "blur(6px)" }}
        animate={{ scale: [0.7, 1, 1], y: ["-112px", "-145px", "-145px"], filter: "blur(0px)" }}
        transition={{ duration: 1.4, delay: 0.5 + index * 0.34, ease: easeOut }}
      >
        <span className="promo-feature-icon" style={{ color: feature.tone }}>
          <Icon size={17} strokeWidth={2.2} />
        </span>
        <span>
          <strong>{feature.label}</strong>
          <small>{feature.detail}</small>
        </span>
      </motion.div>
    </motion.div>
  );
}

function ProductReveal() {
  return (
    <motion.div
      className="absolute inset-0 z-[5] flex flex-col justify-end px-[7%] pb-[13%] pt-[12%]"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: [0, 1, 1, 0], y: [26, 0, 0, -16] }}
      transition={{ duration: 7.4, times: [0, 0.18, 0.76, 1], delay: 10.8, ease: easeOut }}
    >
      <motion.div
        className="mb-auto mt-[5%]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: [0, 1, 1], y: [16, 0, 0] }}
        transition={{ duration: 2, delay: 0.55, ease: easeOut }}
      >
        <p className="text-[clamp(0.72rem,3vw,0.92rem)] font-bold uppercase tracking-[0.23em] text-[#BFC1FF]">
          Tableau de bord
        </p>
        <h2 className="mt-2 max-w-[12ch] text-[clamp(2rem,9.3vw,3.4rem)] font-extrabold leading-[0.95] text-white">
          Chaque etape devient claire.
        </h2>
      </motion.div>

      <div className="grid gap-3">
        <ProductCard
          delay={0.55}
          icon={<FileText size={20} />}
          title="CV premium"
          meta="Pret a envoyer"
          progress={84}
        />
        <ProductCard
          delay={0.82}
          icon={<Mail size={20} />}
          title="Lettre de motivation"
          meta="Personnalisee"
          progress={72}
        />
        <ProductCard
          delay={1.09}
          icon={<LayoutDashboard size={20} />}
          title="Suivi des candidatures"
          meta="Relances et statuts"
          progress={63}
        />
      </div>

      <motion.div
        className="promo-dashboard mt-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: [0, 1, 1], y: [12, 0, 0] }}
        transition={{ duration: 1.4, delay: 1.38, ease: easeOut }}
      >
        <div>
          <span>Stage marketing</span>
          <strong>Entretien</strong>
        </div>
        <div>
          <span>Alternance junior</span>
          <strong>Relance jeudi</strong>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProductCard({
  delay,
  icon,
  title,
  meta,
  progress,
}: {
  delay: number;
  icon: ReactNode;
  title: string;
  meta: string;
  progress: number;
}) {
  return (
    <motion.div
      className="promo-product-card"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: [0, 1, 1], y: [24, 0, 0], scale: [0.96, 1, 1] }}
      transition={{ duration: 1.2, delay, ease: easeOut }}
    >
      <div className="promo-product-icon">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <strong>{title}</strong>
          <CheckCircle2 className="shrink-0 text-[#9EA6FF]" size={17} />
        </div>
        <p>{meta}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
          <motion.span
            className="block h-full rounded-full bg-[#BFC1FF]"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.3, delay: delay + 0.3, ease: easeOut }}
          />
        </div>
      </div>
    </motion.div>
  );
}

function CinematicTransition() {
  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-[42%] z-[8] aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#5A5CFF]"
      initial={{ opacity: 0, scale: 0.05 }}
      animate={{
        opacity: [0, 0, 1, 1],
        scale: [0.05, 0.05, 1, 13.8],
      }}
      transition={{
        duration: 3.7,
        times: [0, 0.34, 0.54, 1],
        delay: 15.65,
        ease: [0.32, 0.92, 0.27, 1],
      }}
      style={{
        boxShadow: "0 0 90px rgba(90,92,255,0.72)",
      }}
    />
  );
}

function FinalOutro() {
  const lines = [
    { text: "Besoin d'un stage ?", className: "text-[clamp(2.7rem,13.5vw,5.25rem)] font-extrabold leading-[0.94]" },
    { text: "CV. Lettre. Candidatures.", className: "text-[clamp(1.02rem,4.7vw,1.55rem)] font-bold leading-snug text-white/92" },
    { text: "Tout est prêt avec Cadova.", className: "text-[clamp(0.94rem,4vw,1.26rem)] font-semibold leading-snug text-white/80" },
  ];

  return (
    <motion.div
      className="absolute inset-0 z-[9] flex flex-col items-center justify-center px-[7%] text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0, 1] }}
      transition={{ duration: 1, times: [0, 0.2, 1], delay: 18.6, ease: "easeOut" }}
      style={{
        background:
          "radial-gradient(circle at 50% 56%, rgba(255,255,255,0.2), transparent 30%), linear-gradient(160deg, #5A5CFF 0%, #5658F7 48%, #4258E9 100%)",
      }}
    >
      <motion.div
        className="mb-[9%]"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 19.05, ease: easeOut }}
      >
        {PROMO_ASSETS.wordmark ? (
          <img src={PROMO_ASSETS.wordmark} alt="Cadova" className="h-[44px] w-auto object-contain" />
        ) : (
          <img
            src={PROMO_ASSETS.fullLogo}
            alt="Cadova"
            className="h-[clamp(36px,9.4vw,52px)] w-auto max-w-[min(72vw,290px)] object-contain"
            draggable={false}
          />
        )}
      </motion.div>

      <div className="grid gap-4">
        {lines.map((line, index) => (
          <motion.p
            key={line.text}
            className={`mx-auto max-w-[18ch] text-white ${line.className}`}
            initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.72, delay: 19.45 + index * 0.28, ease: easeOut }}
          >
            {line.text}
          </motion.p>
        ))}
      </div>

      <motion.p
        className="promo-url-glow relative mt-[9%] rounded-full px-5 py-2.5 text-[clamp(1.1rem,4.7vw,1.42rem)] font-extrabold text-white"
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.75, delay: 20.42, ease: easeOut }}
      >
        cadova.fr
      </motion.p>

      <motion.div
        className="absolute bottom-[8%] flex items-center gap-2 text-[clamp(0.7rem,2.8vw,0.88rem)] font-semibold uppercase tracking-[0.18em] text-white/58"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 21.1, ease: easeOut }}
      >
        <Send size={14} />
        <span>Postule plus sereinement</span>
      </motion.div>
    </motion.div>
  );
}

function ReducedMotionFrame() {
  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-[7%] text-center text-white"
      style={{
        background:
          "radial-gradient(circle at 50% 35%, rgba(90,92,255,0.33), transparent 38%), linear-gradient(180deg, #0B1020, #11172C)",
      }}
    >
      <PromoStyle />
      <div className="mb-10 flex w-[46%] max-w-[190px] items-center justify-center">
        <div className="relative aspect-square w-full">
          <CadovaMarkC className="h-full w-full" cFill={C_FILL} />
          <div
            className="absolute rounded-full bg-[#5A5CFF]"
            style={{
              left: "52.2%",
              top: "53.3%",
              width: "18.3%",
              height: "18.3%",
              translateX: "-50%",
              translateY: "-50%",
              boxShadow: "0 0 44px rgba(90,92,255,0.5)",
            }}
          />
        </div>
      </div>
      <h1 className="max-w-[10ch] text-[clamp(2.8rem,13vw,5.1rem)] font-extrabold leading-[0.94]">
        Besoin d'un stage ?
      </h1>
      <p className="mt-5 text-[clamp(1rem,4.5vw,1.45rem)] font-bold text-white/92">
        CV. Lettre. Candidatures.
      </p>
      <p className="mt-3 text-[clamp(0.95rem,4vw,1.2rem)] font-semibold text-white/76">
        Tout est prêt avec Cadova.
      </p>
      <p className="promo-url-glow mt-8 rounded-full px-5 py-2.5 text-[clamp(1.08rem,4.6vw,1.38rem)] font-extrabold">
        cadova.fr
      </p>
    </div>
  );
}

function PromoStyle() {
  return (
    <style>{`
      .promo-story {
        font-family: "Sora", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      .promo-chaos-card {
        display: grid;
        gap: 8px;
        padding: 10px 11px;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        background: rgba(255,255,255,0.055);
        color: rgba(255,255,255,0.64);
        box-shadow: 0 22px 55px rgba(0,0,0,0.25);
        backdrop-filter: blur(14px);
        text-transform: uppercase;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.13em;
      }

      .promo-chaos-card i {
        display: block;
        height: 3px;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(255,255,255,0.35), transparent);
      }

      .promo-user-dot {
        background: radial-gradient(circle at 34% 28%, #8A8CFF 0%, #5A5CFF 42%, #4648E8 100%);
        box-shadow: 0 0 34px rgba(90,92,255,0.7), 0 0 110px rgba(90,92,255,0.34);
      }

      .promo-focus-ring {
        border: 1px solid rgba(190,193,255,0.46);
        box-shadow: inset 0 0 22px rgba(90,92,255,0.18), 0 0 54px rgba(90,92,255,0.28);
      }

      .promo-orbit {
        border: 1px solid rgba(222,224,255,0.32);
        box-shadow: inset 0 0 48px rgba(90,92,255,0.08);
      }

      .promo-orbit-soft {
        border-style: dashed;
        border-color: rgba(222,224,255,0.22);
      }

      .promo-orbit-badge {
        display: inline-flex;
        min-width: 132px;
        align-items: center;
        gap: 9px;
        padding: 10px 11px;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        background: rgba(14,20,38,0.72);
        box-shadow: 0 24px 70px rgba(0,0,0,0.34), 0 0 34px rgba(90,92,255,0.12);
        backdrop-filter: blur(18px);
      }

      .promo-feature-icon,
      .promo-product-icon {
        display: grid;
        width: 32px;
        height: 32px;
        flex: 0 0 auto;
        place-items: center;
        border-radius: 8px;
        background: rgba(90,92,255,0.13);
      }

      .promo-orbit-badge strong,
      .promo-orbit-badge small {
        display: block;
        text-align: left;
      }

      .promo-orbit-badge strong {
        font-size: 13px;
        line-height: 1.05;
      }

      .promo-orbit-badge small {
        margin-top: 3px;
        color: rgba(255,255,255,0.48);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .promo-product-card,
      .promo-dashboard {
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        background: linear-gradient(180deg, rgba(255,255,255,0.105), rgba(255,255,255,0.055));
        box-shadow: 0 22px 70px rgba(0,0,0,0.28);
        backdrop-filter: blur(20px);
      }

      .promo-product-card {
        display: flex;
        align-items: center;
        gap: 13px;
        min-height: 88px;
        padding: 14px;
      }

      .promo-product-icon {
        width: 42px;
        height: 42px;
        color: #D8DBFF;
      }

      .promo-product-card strong {
        overflow: hidden;
        color: white;
        font-size: clamp(0.9rem,3.7vw,1.08rem);
        line-height: 1.1;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .promo-product-card p {
        margin-top: 4px;
        color: rgba(255,255,255,0.55);
        font-size: clamp(0.74rem,3vw,0.9rem);
        font-weight: 650;
        line-height: 1.2;
      }

      .promo-dashboard {
        display: grid;
        gap: 0;
        overflow: hidden;
      }

      .promo-dashboard div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        min-height: 44px;
        padding: 0 14px;
      }

      .promo-dashboard div + div {
        border-top: 1px solid rgba(255,255,255,0.09);
      }

      .promo-dashboard span,
      .promo-dashboard strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .promo-dashboard span {
        color: rgba(255,255,255,0.62);
        font-size: 12px;
        font-weight: 700;
      }

      .promo-dashboard strong {
        color: #D8DBFF;
        font-size: 12px;
        font-weight: 850;
      }

      .promo-url-glow {
        background: rgba(255,255,255,0.13);
        box-shadow: 0 0 38px rgba(255,255,255,0.18), 0 0 90px rgba(255,255,255,0.12);
        text-shadow: 0 0 26px rgba(255,255,255,0.5);
        backdrop-filter: blur(12px);
      }
    `}</style>
  );
}
