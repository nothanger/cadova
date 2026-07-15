import { useState, useEffect, useRef, type FormEvent } from "react";
import {
  Menu, X, ArrowRight, Globe, Search,
  CheckCircle, Mail, Phone, ExternalLink, Star, Zap,
} from "lucide-react";
import Vector from "@/imports/Vector";

// ── Brand ─────────────────────────────────────────────────────────────
const BG = "#0B1020";
const CARD = "#0F1729";
const BLUE = "#5A5CFF";
const BLUE_HOVER = "#7B7EFF";
const FG = "#E8E6F0";
const MUTED = "#8892B0";
const BORDER = "rgba(255,255,255,0.07)";
const BORDER_HOVER = "rgba(255,255,255,0.14)";
const DF = "'Outfit', system-ui, sans-serif";

// ── Logo (real Figma import) ──────────────────────────────────────────
// Vector viewBox: 577.544 × 155.75 → ratio ≈ 3.71
const LOGO_RATIO = 577.544 / 155.75;

function CadovaLogo({ height = 30 }: { height?: number }) {
  const width = Math.round(height * LOGO_RATIO);
  return (
    <div
      style={
        {
          width,
          height,
          flexShrink: 0,
          // Override --fill-0 so the cadova wordmark paths match the site foreground
          "--fill-0": FG,
        } as React.CSSProperties
      }
      aria-label="Cadova"
    >
      <Vector />
    </div>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────
function useScrolled(threshold = 40) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > threshold);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, [threshold]);
  return scrolled;
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

// ── Data ──────────────────────────────────────────────────────────────
const NAV = [
  { label: "Services", href: "#services" },
  { label: "Réalisations", href: "#portfolio" },
  { label: "À propos", href: "#about" },
  { label: "Contact", href: "#contact" },
];

const SERVICES = [
  {
    Icon: Globe,
    title: "Création de sites internet",
    hook: "Votre vitrine en ligne, pensée pour convertir",
    body: "Un site professionnel qui présente votre activité, inspire confiance et transforme vos visiteurs en clients. Responsive, rapide et visible sur tous les appareils.",
    points: [
      "Design sur mesure adapté à votre image",
      "Compatible mobile, tablette et ordinateur",
      "Chargement rapide, navigation fluide",
      "Optimisé pour être trouvé sur Google",
    ],
  },
  {
    Icon: Search,
    title: "SEO local",
    hook: "Soyez trouvé par vos clients à proximité",
    body: "Améliorez votre visibilité sur Google pour attirer des clients près de chez vous. Audit, optimisation technique, Google Business Profile et stratégie locale.",
    points: [
      "Audit complet de votre présence en ligne",
      "Optimisation de votre fiche Google Business",
      "Amélioration des performances techniques",
      "Stratégie SEO adaptée à votre secteur",
    ],
  },
];

const PROCESS = [
  {
    n: "01",
    title: "On échange",
    body: "Un appel ou un message pour comprendre votre activité et vos objectifs. Sans jargon, sans engagement.",
  },
  {
    n: "02",
    title: "On conçoit",
    body: "Design, développement, contenu : on s'occupe de tout. Vous suivez l'avancement à chaque étape.",
  },
  {
    n: "03",
    title: "On lance",
    body: "Mise en ligne, tests et suivi. Votre présence numérique commence à travailler pour vous.",
  },
];

type Project = {
  real: boolean;
  title: string;
  category: string;
  description: string;
  image: string;
  technologies: string[];
  objective: string;
  result: string;
};

const PROJECTS: Project[] = [
  {
    real: true,
    title: "AMC Auto Moto",
    category: "Création de site web",
    description:
      "Site vitrine pour un garage spécialisé dans la réparation et l'entretien de motos et véhicules légers. Conçu pour présenter les services, rassurer les clients et améliorer la visibilité locale.",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop&auto=format",
    technologies: ["Next.js", "Design responsive", "SEO technique", "Google Maps"],
    objective:
      "Améliorer la présence en ligne pour attirer de nouveaux clients locaux et renforcer la crédibilité de l'entreprise.",
    result:
      "Site professionnel, rapide et optimisé pour la recherche locale. Image modernisée et présentation claire des services.",
  },
  { real: false, title: "", category: "", description: "", image: "", technologies: [], objective: "", result: "" },
  { real: false, title: "", category: "", description: "", image: "", technologies: [], objective: "", result: "" },
];

const PAIN_POINTS = [
  { icon: Zap, label: "Plus de clients" },
  { icon: Search, label: "Visible sur Google" },
  { icon: Globe, label: "Image professionnelle" },
  { icon: CheckCircle, label: "Gagnez du temps" },
];

// ── Navbar ────────────────────────────────────────────────────────────
function Navbar() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{ borderColor: scrolled ? BORDER : "transparent" }}
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 border-b ${
        scrolled ? "backdrop-blur-xl" : ""
      }`}
      css-bg={scrolled ? `${BG}eb` : "transparent"}
      /* inline bg needed since Tailwind can't interpolate dynamic hex */
    >
      <div
        style={{ backgroundColor: scrolled ? `${BG}ee` : "transparent" }}
        className="transition-colors duration-500"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#">
            <CadovaLogo size={30} />
          </a>

          <nav className="hidden md:flex items-center gap-8">
            {NAV.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                style={{ color: MUTED }}
                className="text-sm hover:text-white transition-colors duration-200 tracking-wide"
              >
                {label}
              </a>
            ))}
            <a
              href="#contact"
              style={{ backgroundColor: BLUE, color: "#fff" }}
              className="text-sm px-5 py-2.5 font-semibold rounded-md hover:opacity-90 transition-opacity duration-200"
            >
              Prendre contact
            </a>
          </nav>

          <button
            onClick={() => setOpen(!open)}
            style={{ color: FG }}
            className="md:hidden p-1"
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          style={{ backgroundColor: BG, borderColor: BORDER }}
          className="md:hidden border-t px-6 py-6 flex flex-col gap-5"
        >
          {NAV.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{ color: FG }}
              className="text-base py-1"
            >
              {label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            style={{ backgroundColor: BLUE, color: "#fff" }}
            className="mt-1 text-sm py-3 font-semibold rounded-md text-center"
          >
            Prendre contact
          </a>
        </div>
      )}
    </header>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────
function Hero() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  return (
    <section style={{ backgroundColor: BG }} className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(90,92,255,0.25) 1px, transparent 1px)`,
          backgroundSize: "36px 36px",
          opacity: 0.18,
        }}
      />
      {/* Glow */}
      <div
        className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${BLUE}28 0%, transparent 65%)` }}
      />
      <div
        className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${BLUE}14 0%, transparent 65%)` }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-28 pb-20 md:pt-36 md:pb-28">
        <div className={`transition-all duration-1000 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <span
            style={{ color: BLUE, fontFamily: DF }}
            className="inline-block text-xs uppercase tracking-[0.22em] mb-10 font-bold"
          >
            Présence numérique professionnelle
          </span>

          <h1
            style={{ fontFamily: DF, color: FG }}
            className="text-5xl md:text-[4.5rem] lg:text-[5.5rem] font-semibold leading-[1.08] mb-8 max-w-3xl"
          >
            Plus de clients,{" "}
            <span style={{ color: BLUE }}>une présence</span>
            <br className="hidden md:block" /> qui vous ressemble<span style={{ color: BLUE }}>.</span>
          </h1>

          <p
            style={{ color: MUTED }}
            className={`text-lg md:text-xl max-w-lg leading-relaxed mb-12 transition-all duration-1000 delay-200 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            Cadova accompagne artisans, commerçants et petites entreprises dans
            leur développement numérique — site web professionnel, visibilité Google,
            image de marque.
          </p>

          <div
            className={`flex flex-col sm:flex-row gap-4 transition-all duration-1000 delay-300 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <a
              href="#contact"
              style={{ backgroundColor: BLUE, color: "#fff" }}
              className="inline-flex items-center gap-3 px-7 py-4 font-semibold rounded-md hover:opacity-90 transition-all duration-200 group text-sm"
            >
              Discutons de votre projet
              <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <a
              href="#portfolio"
              style={{ border: `1px solid ${BORDER_HOVER}`, color: FG }}
              className="inline-flex items-center gap-3 px-7 py-4 rounded-md hover:bg-white/[0.04] transition-all duration-200 text-sm"
            >
              Voir nos réalisations
            </a>
          </div>
        </div>

        {/* Pain points bar */}
        <div
          className={`mt-24 grid grid-cols-2 md:grid-cols-4 overflow-hidden rounded-lg transition-all duration-1000 delay-500 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
          style={{ border: `1px solid ${BORDER}` }}
        >
          {PAIN_POINTS.map(({ icon: Icon, label }, i) => (
            <div
              key={label}
              style={{
                backgroundColor: CARD,
                borderRight: i < PAIN_POINTS.length - 1 ? `1px solid ${BORDER}` : undefined,
              }}
              className="px-6 py-5 flex items-center gap-3"
            >
              <Icon size={15} style={{ color: BLUE }} className="shrink-0" />
              <span style={{ color: MUTED }} className="text-sm">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Services ──────────────────────────────────────────────────────────
function Services() {
  const { ref, inView } = useInView();

  return (
    <section id="services" style={{ backgroundColor: BG }} className="py-28 md:py-36">
      <div
        ref={ref}
        className={`max-w-6xl mx-auto px-6 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="mb-16">
          <span style={{ color: BLUE, fontFamily: DF }} className="text-xs uppercase tracking-[0.22em] font-bold">
            Nos services
          </span>
          <h2 style={{ fontFamily: DF, color: FG }} className="text-4xl md:text-5xl font-semibold mt-4 leading-[1.1]">
            Deux solutions,<br />un seul objectif.
          </h2>
        </div>

        <div
          className="grid md:grid-cols-2 rounded-xl overflow-hidden"
          style={{ border: `1px solid ${BORDER}` }}
        >
          {SERVICES.map(({ Icon, title, hook, body, points }, i) => (
            <div
              key={i}
              style={{
                backgroundColor: CARD,
                borderRight: i === 0 ? `1px solid ${BORDER}` : undefined,
              }}
              className="p-10 md:p-12 hover:bg-[#131E38] transition-colors duration-300 group"
            >
              <div
                style={{ border: `1px solid ${BLUE}40` }}
                className="w-11 h-11 rounded-lg flex items-center justify-center mb-8 group-hover:border-[#5A5CFF]/70 transition-colors duration-300"
              >
                <Icon size={18} style={{ color: BLUE }} />
              </div>
              <h3 style={{ fontFamily: DF, color: FG }} className="text-2xl font-semibold mb-2">
                {title}
              </h3>
              <p style={{ color: BLUE }} className="text-sm mb-5 font-medium">{hook}</p>
              <p style={{ color: MUTED }} className="leading-relaxed mb-8 text-[0.95rem]">{body}</p>
              <ul className="space-y-3 mb-10">
                {points.map((pt, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm" style={{ color: "#C8D0E8" }}>
                    <CheckCircle size={14} style={{ color: BLUE }} className="mt-0.5 shrink-0" />
                    {pt}
                  </li>
                ))}
              </ul>
              <a
                href="#contact"
                style={{ color: BLUE }}
                className="inline-flex items-center gap-2 text-sm hover:gap-3 transition-all duration-200 font-medium"
              >
                Demander un devis <ArrowRight size={13} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Process ───────────────────────────────────────────────────────────
function Process() {
  const { ref, inView } = useInView();

  return (
    <section style={{ backgroundColor: BG, borderTop: `1px solid ${BORDER}` }} className="py-24">
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div className="mb-16">
          <span style={{ color: BLUE, fontFamily: DF }} className="text-xs uppercase tracking-[0.22em] font-bold">
            Comment ça marche
          </span>
          <h2
            style={{ fontFamily: DF, color: FG }}
            className={`text-4xl md:text-5xl font-semibold mt-4 leading-[1.1] transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            Simple, clair,<br />sans surprise.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-12 md:gap-10">
          {PROCESS.map(({ n, title, body }, i) => (
            <div
              key={i}
              className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 130}ms` }}
            >
              <span
                style={{ fontFamily: DF, color: `${BLUE}25` }}
                className="text-[4rem] font-bold leading-none select-none"
              >
                {n}
              </span>
              <h3 style={{ color: FG }} className="text-xl font-semibold mt-3 mb-3">{title}</h3>
              <p style={{ color: MUTED }} className="leading-relaxed text-sm">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Portfolio ─────────────────────────────────────────────────────────
function ProjectCard({ project, onSelect }: { project: Project; onSelect: () => void }) {
  if (!project.real) {
    return (
      <div
        style={{ border: `1px dashed ${BORDER}`, color: "#2A3A60" }}
        className="aspect-[4/3] rounded-xl flex flex-col items-center justify-center gap-4"
      >
        <div
          style={{ border: `1px solid ${BORDER}` }}
          className="w-9 h-9 rounded-lg flex items-center justify-center"
        >
          <span className="text-xl leading-none font-light">+</span>
        </div>
        <span className="text-xs uppercase tracking-[0.2em]">Bientôt</span>
      </div>
    );
  }

  return (
    <div
      onClick={onSelect}
      style={{ border: `1px solid ${BORDER}` }}
      className="group cursor-pointer rounded-xl overflow-hidden hover:border-white/[0.14] transition-all duration-300"
    >
      <div className="aspect-[4/3] bg-[#0F1729] overflow-hidden relative">
        <img
          src={project.image}
          alt={project.title}
          className="w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-105 transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1020]/80 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <span style={{ color: BLUE }} className="text-xs uppercase tracking-wider font-medium">{project.category}</span>
          <h3 style={{ fontFamily: DF, color: FG }} className="text-xl font-semibold mt-1">{project.title}</h3>
        </div>
        <div
          style={{ backgroundColor: BLUE }}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <ExternalLink size={13} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(11,16,32,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
        className="rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video bg-[#0B1020] overflow-hidden rounded-t-xl">
          <img src={project.image} alt={project.title} className="w-full h-full object-cover opacity-80" />
        </div>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span style={{ color: BLUE }} className="text-xs uppercase tracking-wider font-medium">{project.category}</span>
              <h2 style={{ fontFamily: DF, color: FG }} className="text-2xl font-semibold mt-1">{project.title}</h2>
            </div>
            <button onClick={onClose} style={{ color: MUTED }} className="hover:text-white p-1 transition-colors">
              <X size={20} />
            </button>
          </div>
          <p style={{ color: MUTED }} className="leading-relaxed mb-8 text-sm">{project.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <div>
              <h4 style={{ color: BLUE }} className="text-xs uppercase tracking-wider mb-2 font-medium">Objectif client</h4>
              <p className="text-sm leading-relaxed" style={{ color: "#C8D0E8" }}>{project.objective}</p>
            </div>
            <div>
              <h4 style={{ color: BLUE }} className="text-xs uppercase tracking-wider mb-2 font-medium">Résultat</h4>
              <p className="text-sm leading-relaxed" style={{ color: "#C8D0E8" }}>{project.result}</p>
            </div>
          </div>
          <div>
            <h4 style={{ color: BLUE }} className="text-xs uppercase tracking-wider mb-3 font-medium">Technologies</h4>
            <div className="flex flex-wrap gap-2">
              {project.technologies.map((t, i) => (
                <span
                  key={i}
                  style={{ border: `1px solid ${BORDER}`, color: "#C8D0E8" }}
                  className="text-xs px-3 py-1 rounded-md bg-white/[0.04]"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Portfolio() {
  const { ref, inView } = useInView();
  const [selected, setSelected] = useState<Project | null>(null);

  return (
    <section
      id="portfolio"
      style={{ backgroundColor: BG, borderTop: `1px solid ${BORDER}` }}
      className="py-28 md:py-36"
    >
      <div
        ref={ref}
        className={`max-w-6xl mx-auto px-6 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <span style={{ color: BLUE, fontFamily: DF }} className="text-xs uppercase tracking-[0.22em] font-bold">
              Réalisations
            </span>
            <h2 style={{ fontFamily: DF, color: FG }} className="text-4xl md:text-5xl font-semibold mt-4 leading-[1.1]">
              Nos projets.
            </h2>
          </div>
          <p style={{ color: MUTED }} className="text-sm max-w-xs leading-relaxed">
            Chaque projet est une histoire de confiance entre Cadova et un professionnel qui souhaite grandir.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PROJECTS.map((project, i) => (
            <ProjectCard key={i} project={project} onSelect={() => project.real && setSelected(project)} />
          ))}
        </div>
      </div>

      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

// ── About ─────────────────────────────────────────────────────────────
function About() {
  const { ref, inView } = useInView();

  return (
    <section
      id="about"
      style={{ backgroundColor: BG, borderTop: `1px solid ${BORDER}` }}
      className="py-28 md:py-36"
    >
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div
          className={`grid md:grid-cols-2 gap-16 items-center transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div>
            <span style={{ color: BLUE, fontFamily: DF }} className="text-xs uppercase tracking-[0.22em] font-bold">
              À propos
            </span>
            <h2 style={{ fontFamily: DF, color: FG }} className="text-4xl md:text-5xl font-semibold mt-4 mb-8 leading-[1.1]">
              Qui est<br />Cadova ?
            </h2>
            <div style={{ color: MUTED }} className="space-y-4 leading-relaxed text-[0.95rem]">
              <p>
                Cadova est une entreprise spécialisée dans le développement de la présence numérique des professionnels et des petites entreprises.
              </p>
              <p>
                Notre mission est simple : vous aider à être visible en ligne, à inspirer confiance et à attirer de nouveaux clients — sans que vous ayez besoin de maîtriser la technologie.
              </p>
              <p>
                Nous travaillons avec des artisans, des commerçants, des restaurants et des PME qui veulent développer leur activité sans perdre de temps sur des sujets qu&apos;ils ne connaissent pas.
              </p>
            </div>
            <a
              href="#contact"
              style={{ backgroundColor: BLUE, color: "#fff" }}
              className="mt-10 inline-flex items-center gap-3 px-6 py-3.5 font-semibold rounded-md hover:opacity-90 transition-opacity duration-200 group text-sm"
            >
              Parlons de votre projet
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-200" />
            </a>
          </div>

          <div className="relative">
            <div
              style={{ border: `1px solid ${BORDER}` }}
              className="aspect-[4/3] bg-[#0F1729] rounded-xl overflow-hidden"
            >
              <img
                src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=700&h=530&fit=crop&auto=format"
                alt="Environnement de travail Cadova"
                className="w-full h-full object-cover opacity-55"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-transparent to-[#0B1020]/50" />
            </div>
            <div
              style={{ border: `1px solid ${BLUE}25` }}
              className="absolute -bottom-5 -left-5 w-20 h-20 rounded-lg pointer-events-none"
            />
            <div
              style={{ border: `1px solid ${BORDER}` }}
              className="absolute -top-5 -right-5 w-12 h-12 rounded-lg pointer-events-none"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────────────────────────────────────────────────────
function Testimonials() {
  const { ref, inView } = useInView();

  return (
    <section
      style={{ backgroundColor: BG, borderTop: `1px solid ${BORDER}` }}
      className="py-28"
    >
      <div ref={ref} className="max-w-6xl mx-auto px-6 text-center">
        <div className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <span style={{ color: BLUE, fontFamily: DF }} className="text-xs uppercase tracking-[0.22em] font-bold">
            Témoignages
          </span>
          <h2 style={{ fontFamily: DF, color: FG }} className="text-4xl md:text-5xl font-semibold mt-4 mb-5 leading-[1.1]">
            Ce que disent<br />nos clients.
          </h2>
          <p style={{ color: MUTED }} className="mb-14 max-w-md mx-auto leading-relaxed text-sm">
            Nous rassemblons actuellement les retours de nos premiers clients.
            Cette section sera enrichie au fil des projets réalisés.
          </p>

          <div
            style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}
            className="max-w-lg mx-auto rounded-xl px-10 py-12"
          >
            <div className="flex justify-center gap-1.5 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={15} style={{ color: BLUE }} fill={BLUE} />
              ))}
            </div>
            <p className="text-sm italic mb-6 leading-relaxed" style={{ color: "#4A5A80" }}>
              Les premiers retours clients arriveront ici très prochainement.
              <br />Nous préférons la transparence à la fabrication.
            </p>
            <div className="flex items-center justify-center gap-3">
              <div
                style={{ border: `1px solid ${BORDER}`, backgroundColor: "#1A2540" }}
                className="w-8 h-8 rounded-full flex items-center justify-center"
              >
                <span style={{ color: BLUE }} className="text-xs">·</span>
              </div>
              <span style={{ color: "#2A3A60" }} className="text-xs uppercase tracking-wider">En cours de constitution</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Contact ───────────────────────────────────────────────────────────
type FormState = { name: string; email: string; phone: string; need: string; message: string };

function Contact() {
  const { ref, inView } = useInView();
  const [form, setForm] = useState<FormState>({ name: "", email: "", phone: "", need: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const set = (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  const inputCls = "w-full text-sm rounded-lg px-4 py-3 focus:outline-none transition-colors duration-200 placeholder-[#2A3A60]";
  const inputStyle = {
    backgroundColor: CARD,
    border: `1px solid ${BORDER}`,
    color: FG,
  };
  const focusStyle = `focus:ring-1 focus:ring-[${BLUE}]`;

  return (
    <section
      id="contact"
      style={{ backgroundColor: BG, borderTop: `1px solid ${BORDER}` }}
      className="py-28 md:py-36"
    >
      <div ref={ref} className="max-w-6xl mx-auto px-6">
        <div
          className={`grid md:grid-cols-2 gap-16 transition-all duration-700 ${
            inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div>
            <span style={{ color: BLUE, fontFamily: DF }} className="text-xs uppercase tracking-[0.22em] font-bold">
              Contact
            </span>
            <h2 style={{ fontFamily: DF, color: FG }} className="text-4xl md:text-5xl font-semibold mt-4 mb-6 leading-[1.1]">
              Parlons de<br />votre projet.
            </h2>
            <p style={{ color: MUTED }} className="leading-relaxed mb-12 text-[0.95rem]">
              Un échange sans engagement pour comprendre vos besoins et voir comment
              Cadova peut vous aider à développer votre présence en ligne.
            </p>
            <div className="space-y-4">
              <a
                href="mailto:contact@cadova.fr"
                style={{ color: MUTED }}
                className="flex items-center gap-3 text-sm hover:text-white transition-colors duration-200"
              >
                <Mail size={15} style={{ color: BLUE }} />
                contact@cadova.fr
              </a>
              <div style={{ color: MUTED }} className="flex items-center gap-3 text-sm">
                <Phone size={15} style={{ color: BLUE }} />
                Disponible par mail ou formulaire
              </div>
            </div>
          </div>

          <div>
            {!submitted ? (
              <form onSubmit={submit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label style={{ color: MUTED }} className="text-[0.65rem] uppercase tracking-[0.15em] mb-2 block">Nom</label>
                    <input
                      required
                      value={form.name}
                      onChange={set("name")}
                      placeholder="Jean Dupont"
                      style={inputStyle}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label style={{ color: MUTED }} className="text-[0.65rem] uppercase tracking-[0.15em] mb-2 block">Email</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="jean@exemple.fr"
                      style={inputStyle}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ color: MUTED }} className="text-[0.65rem] uppercase tracking-[0.15em] mb-2 block">
                    Téléphone <span className="normal-case" style={{ color: "#2A3A60" }}>(facultatif)</span>
                  </label>
                  <input
                    value={form.phone}
                    onChange={set("phone")}
                    placeholder="06 00 00 00 00"
                    style={inputStyle}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label style={{ color: MUTED }} className="text-[0.65rem] uppercase tracking-[0.15em] mb-2 block">Votre besoin</label>
                  <select
                    value={form.need}
                    onChange={set("need")}
                    style={inputStyle}
                    className={inputCls + " appearance-none cursor-pointer"}
                  >
                    <option value="" style={{ backgroundColor: CARD }}>Choisissez un service</option>
                    <option value="site" style={{ backgroundColor: CARD }}>Création de site internet</option>
                    <option value="seo" style={{ backgroundColor: CARD }}>SEO local</option>
                    <option value="both" style={{ backgroundColor: CARD }}>Les deux</option>
                    <option value="other" style={{ backgroundColor: CARD }}>Autre demande</option>
                  </select>
                </div>
                <div>
                  <label style={{ color: MUTED }} className="text-[0.65rem] uppercase tracking-[0.15em] mb-2 block">Message</label>
                  <textarea
                    value={form.message}
                    onChange={set("message")}
                    placeholder="Décrivez votre activité et ce que vous souhaitez accomplir..."
                    rows={5}
                    style={inputStyle}
                    className={inputCls + " resize-none"}
                  />
                </div>
                <button
                  type="submit"
                  style={{ backgroundColor: BLUE, color: "#fff" }}
                  className="w-full flex items-center justify-center gap-3 px-7 py-4 font-semibold rounded-lg hover:opacity-90 transition-opacity duration-200 group text-sm"
                >
                  Envoyer ma demande
                  <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-200" />
                </button>
              </form>
            ) : (
              <div
                style={{ border: `1px solid ${BORDER}`, backgroundColor: CARD }}
                className="h-full flex flex-col justify-center py-16 text-center rounded-xl"
              >
                <CheckCircle size={44} style={{ color: BLUE }} className="mx-auto mb-6" />
                <h3 style={{ fontFamily: DF, color: FG }} className="text-2xl font-semibold mb-3">
                  Demande envoyée
                </h3>
                <p style={{ color: MUTED }} className="text-sm max-w-xs mx-auto leading-relaxed">
                  Merci pour votre message. Nous vous répondrons dans les meilleurs délais.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ backgroundColor: BG, borderTop: `1px solid ${BORDER}` }} className="py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <CadovaLogo size={28} />
            <p style={{ color: MUTED }} className="text-xs mt-2 tracking-wide">Présence numérique professionnelle</p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm" style={{ color: MUTED }}>
            {NAV.map(({ label, href }) => (
              <a key={href} href={href} className="hover:text-white transition-colors duration-200">
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div
          style={{ borderTop: `1px solid ${BORDER}`, color: "#2A3A60" }}
          className="mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs"
        >
          <span>© 2025 Cadova. Tous droits réservés.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#8892B0] transition-colors duration-200">Mentions légales</a>
            <a href="#" className="hover:text-[#8892B0] transition-colors duration-200">Politique de confidentialité</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{ backgroundColor: BG }} className="min-h-screen">
      <Navbar />
      <main>
        <Hero />
        <Services />
        <Process />
        <Portfolio />
        <About />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
