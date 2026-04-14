import { useState, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useSEO } from "../hooks/useSEO";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import {
  Briefcase,
  ClipboardList,
  FileText,
  Plus,
  Trash2,
  Download,
  Eye,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Linkedin,
  Lightbulb,
  Check,
  CheckCircle,
  RefreshCw,
  Globe,
  GraduationCap,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  SECTORS,
  BULLETS,
  SKILLS_BY_SECTOR,
  SOFT_SKILLS,
  LANGUAGES,
  buildSummary,
  SectorId,
  ExperienceLevel,
  CandidatureType,
} from "../lib/reussia-data";

/* ──────────────────────────────────────────────────────── types */
interface Experience {
  id: string;
  title: string;
  company: string;
  period: string;
  description: string;
}

interface Education {
  id: string;
  degree: string;
  school: string;
  period: string;
  description: string;
}

interface LanguageEntry {
  lang: string;
  level: string;
}

interface Project {
  id: string;
  name: string;
  context: string;
  description: string;
}
/* ──────────────────────────────────────────────────────── constantes */
const STEPS = ["Contexte", "Identite", "Formation", "Experience", "Projets", "Competences", "Apercu"];

const LEVEL_OPTIONS: { value: ExperienceLevel; label: string; desc: string }[] = [
  { value: "lyceen",       label: "Lyceen(ne)",      desc: "Bac en cours, premiere experience" },
  { value: "etudiant",     label: "Etudiant(e)",     desc: "En BTS, licence, master..." },
  { value: "junior",       label: "Junior",          desc: "Jeune diplome(e), 1-2 ans" },
  { value: "intermediaire",label: "Experience",      desc: "3 ans et plus" },
];

const TYPE_OPTIONS = [
  { value: "stage",      label: "Stage",      icon: GraduationCap },
  { value: "alternance", label: "Alternance", icon: RefreshCw },
  { value: "emploi",     label: "Emploi",     icon: Briefcase },
  { value: "parcoursup", label: "Parcoursup", icon: ClipboardList },
];

/* ──���──────────────────────────────────────────────────── composant */
export function CVGenerator() {
 useSEO({ title: "Générateur de CV — Cadova", noindex: false });
  // Navigation
  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Étape 0 — Contexte
  const [sector, setSector] = useState<SectorId>("marketing");
  const [level, setLevel] = useState<ExperienceLevel>("etudiant");
  const [candidatureType, setCandidatureType] = useState<CandidatureType>("stage");

  // Étape 1 — Identité
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  // Étape 2 — Formation
  const [education, setEducation] = useState<Education[]>([
    { id: "1", degree: "", school: "", period: "", description: "" },
  ]);

  // Étape 3 — Expérience
  const [noExperience, setNoExperience] = useState(false);
  const [experiences, setExperiences] = useState<Experience[]>([
    { id: "1", title: "", company: "", period: "", description: "" },
  ]);
  const [activeBulletExp, setActiveBulletExp] = useState("1");

  // Étape 4 — Projets
  const [projects, setProjects] = useState<Project[]>([
    { id: "1", name: "", context: "", description: "" },
  ]);
  const [activeBulletProj, setActiveBulletProj] = useState("1");

  // Étape 5 — Compétences
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedSoftSkills, setSelectedSoftSkills] = useState<string[]>([]);
  const [languageEntries, setLanguageEntries] = useState<LanguageEntry[]>([
    { lang: "Anglais", level: "Scolaire (B1)" },
  ]);

  // Étape 6 — Aperçu
  const [summaryVariantIdx, setSummaryVariantIdx] = useState(0);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);

  /* ── navigation ── */
  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const goPrev = () => setStep((s) => Math.max(s - 1, 0));

  /* ── résumé auto ── */
  const autoSummary = useMemo(() => {
    return buildSummary({
      firstName,
      sector,
      level,
      formation: education[0]?.degree || education[0]?.school || "",
      type: candidatureType,
      company: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryVariantIdx, firstName, sector, level, candidatureType, education]);

  const summary = editedSummary ?? autoSummary;
    /* ── helpers formation ── */
  const addEducation = () => {
    setEducation((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        degree: "",
        school: "",
        period: "",
        description: "",
      },
    ]);
  };

  const removeEducation = (id: string) => {
    setEducation((prev) => prev.filter((item) => item.id !== id));
  };

  const updateEducation = (
    id: string,
    field: keyof Education,
    value: string
  ) => {
    setEducation((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  /* ── helpers expérience ── */
  const addExperience = () => {
    const newId = crypto.randomUUID();
    setExperiences((prev) => [
      ...prev,
      {
        id: newId,
        title: "",
        company: "",
        period: "",
        description: "",
      },
    ]);
    setActiveBulletExp(newId);
  };

  const removeExperience = (id: string) => {
    setExperiences((prev) => prev.filter((item) => item.id !== id));

    setActiveBulletExp((prev) => {
      if (prev !== id) return prev;
      const remaining = experiences.filter((item) => item.id !== id);
      return remaining[0]?.id ?? "";
    });
  };

  const updateExperience = (
    id: string,
    field: keyof Experience,
    value: string
  ) => {
    setExperiences((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const appendBullet = (id: string, bullet: string) => {
    setExperiences((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const current = item.description?.trim() ?? "";
        const nextDescription = current
          ? `${current}\n• ${bullet}`
          : `• ${bullet}`;

        return {
          ...item,
          description: nextDescription,
        };
      })
    );
  };

  /* ── helpers projets ── */
  const addProject = () => {
    const newId = crypto.randomUUID();
    setProjects((prev) => [
      ...prev,
      {
        id: newId,
        name: "",
        context: "",
        description: "",
      },
    ]);
    setActiveBulletProj(newId);
  };

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((item) => item.id !== id));

    setActiveBulletProj((prev) => {
      if (prev !== id) return prev;
      const remaining = projects.filter((item) => item.id !== id);
      return remaining[0]?.id ?? "";
    });
  };

  const updateProject = (
    id: string,
    field: keyof Project,
    value: string
  ) => {
    setProjects((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  /* ── helpers compétences ── */
  const toggleSkill = (
    skill: string,
    list: string[],
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((prev) =>
      prev.includes(skill)
        ? prev.filter((s) => s !== skill)
        : [...prev, skill]
    );
  };

  /* ── helpers langues ── */
  const updateLanguage = (
    index: number,
    field: keyof LanguageEntry,
    value: string
  ) => {
    setLanguageEntries((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry
      )
    );
  };

  const addLanguage = () => {
    setLanguageEntries((prev) => [...prev, { lang: "", level: "" }]);
  };

  const removeLanguage = (index: number) => {
    setLanguageEntries((prev) => prev.filter((_, i) => i !== index));
  };

  /* ── Avancer vers l'aperçu avec loading screen ── */
  const handleGoToPreview = () => {
    if (step === STEPS.length - 2) {
      // Passage vers Apercu → déclenche le loading
      setIsGenerating(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  /* ── export PDF ── */
  const handlePrint = () => {
    const fullName = `${firstName} ${lastName}`.trim();
    const allSkills = [...selectedSkills, ...selectedSoftSkills];
    const langStr = languageEntries
      .filter((l) => l.lang)
      .map((l) => `${l.lang}${l.level ? ` (${l.level})` : ""}`)
      .join(" • ");

    const expHtml = noExperience
      ? ""
      : experiences
          .filter((e) => e.title)
          .map(
            (e) => `<div style="margin-bottom:16px">
              <div style="display:flex;justify-content:space-between">
                <div><strong>${e.title}</strong><br/><span style="color:#64748b">${e.company}</span></div>
                <span style="color:#94a3b8;font-size:12px">${e.period}</span>
              </div>
              <p style="font-size:13px;color:#475569;margin-top:4px;white-space:pre-line">${e.description}</p>
            </div>`
          )
          .join("");

    const eduHtml = education
      .filter((e) => e.degree)
      .map(
        (e) => `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between">
            <div><strong>${e.degree}</strong><br/><span style="color:#64748b">${e.school}</span></div>
            <span style="color:#94a3b8;font-size:12px">${e.period}</span>
          </div>
          ${e.description ? `<p style="font-size:13px;color:#475569;margin-top:4px">${e.description}</p>` : ""}
        </div>`
      )
      .join("");

    const projHtml = projects
      .filter((e) => e.name)
      .map(
        (e) => `<div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between">
            <div><strong>${e.name}</strong><br/><span style="color:#64748b">${e.context}</span></div>
          </div>
          ${e.description ? `<p style="font-size:13px;color:#475569;margin-top:4px">${e.description}</p>` : ""}
        </div>`
      )
      .join("");

    const skillsHtml = allSkills.length
      ? allSkills.map((s) => `<span style="background:#ede9fe;color:#5b21b6;padding:3px 10px;border-radius:20px;font-size:12px;margin:3px;display:inline-block">${s}</span>`).join("")
      : "";

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>CV — ${fullName}</title>
      <style>
        body{font-family:Arial,sans-serif;max-width:720px;margin:40px auto;color:#1e293b;font-size:14px;line-height:1.6}
        h1{font-size:26px;margin:0}h2{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#4f46e5;border-bottom:1px solid #e0e7ff;padding-bottom:4px;margin:20px 0 12px}
        .header{border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:20px}
        .contact{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:#64748b}
        @media print{body{margin:20px}}
      </style>
    </head><body>
      <div class="header">
        <h1>${fullName}</h1>
        <p style="color:#4f46e5;font-size:16px;margin:4px 0">${jobTitle}</p>
        <div class="contact">
          ${email ? `<span>${email}</span>` : ""}
          ${phone ? `<span>${phone}</span>` : ""}
          ${city ? `<span>${city}</span>` : ""}
          ${linkedin ? `<span>${linkedin}</span>` : ""}
        </div>
      </div>
      ${summary ? `<h2>Profil</h2><p style="font-size:13px;color:#475569">${summary}</p>` : ""}
      ${expHtml ? `<h2>Experience professionnelle</h2>${expHtml}` : ""}
      ${eduHtml ? `<h2>Formation</h2>${eduHtml}` : ""}
      ${projHtml ? `<h2>Projets</h2>${projHtml}` : ""}
      ${skillsHtml ? `<h2>Competences</h2><div>${skillsHtml}</div>` : ""}
      ${langStr ? `<h2>Langues</h2><p style="font-size:13px">${langStr}</p>` : ""}
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  /* ─────────────────────────────────────────────── render */
  return (
    <AppLayout>
      {isGenerating && (
        <LoadingScreen
          label="Génération du CV"
          accent="#5548F5"
          steps={[
            { label: "Analyse du profil et du secteur", duration: 700 },
            { label: "Sélection du template optimal", duration: 600 },
            { label: "Rédaction de l'accroche personnalisée", duration: 900 },
            { label: "Structuration des expériences et formations", duration: 700 },
            { label: "Optimisation ATS des mots-clés", duration: 800 },
            { label: "Mise en page et vérification finale", duration: 600 },
          ]}
          onComplete={() => {
            setIsGenerating(false);
            setStep(STEPS.length - 1);
          }}
        />
      )}
      <div className="max-w-6xl mx-auto">
        {/* Header + progress */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
              <FileText className="size-5 text-white" />
            </div>
            Generateur de CV
          </h1>
          <p className="text-slate-600 mt-1">Etape {step + 1} sur {STEPS.length} — {STEPS[step]}</p>
        </motion.div>

        {/* Wizard steps indicator */}
        <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
          {STEPS.map((name, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => i < step && setStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  i === step
                    ? "bg-indigo-600 text-white shadow-md"
                    : i < step
                    ? "bg-indigo-100 text-indigo-700 cursor-pointer hover:bg-indigo-200"
                    : "bg-slate-100 text-slate-400 cursor-default"
                }`}
              >
                {i < step ? (
                  <Check className="size-3" />
                ) : (
                  <span className="size-4 flex items-center justify-center rounded-full bg-current/20 text-[10px]">
                    {i + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{name}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-px w-4 ${i < step ? "bg-indigo-300" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── ÉTAPE 0 : CONTEXTE ── */}
            {step === 0 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quel est ton secteur vise ?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {SECTORS.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSector(s.id)}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${
                            sector === s.id
                              ? "border-indigo-500 bg-indigo-50 text-indigo-700 font-medium"
                              : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                          }`}
                        >
                          <s.icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                          <span className="text-xs leading-tight">{s.label}</span>
                          {sector === s.id && <Check className="size-3 ml-auto text-indigo-600 flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Ton niveau de profil</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {LEVEL_OPTIONS.map((l) => (
                          <button
                            key={l.value}
                            onClick={() => setLevel(l.value)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                              level === l.value
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-slate-200 hover:border-indigo-200"
                            }`}
                          >
                            <div>
                              <p className={`text-sm font-medium ${level === l.value ? "text-indigo-700" : ""}`}>{l.label}</p>
                              <p className="text-xs text-slate-500">{l.desc}</p>
                            </div>
                            {level === l.value && <Check className="size-4 text-indigo-600" />}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Type de candidature</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {TYPE_OPTIONS.map((t) => (
                          <button
                            key={t.value}
                            onClick={() => setCandidatureType(t.value)}
                            className={`flex flex-col items-center gap-1 p-4 rounded-xl border transition-all ${
                              candidatureType === t.value
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-slate-200 hover:border-indigo-200"
                            }`}
                          >
                            <t.icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                            <span className="text-sm font-medium">{t.label}</span>
                            {candidatureType === t.value && <Check className="size-3 text-indigo-600" />}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ── ÉTAPE 1 : IDENTITÉ ── */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tes informations personnelles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Prenom</Label>
                      <Input placeholder="Marie" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nom</Label>
                      <Input placeholder="Dupont" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Titre professionnel</Label>
                    <Input
                      placeholder={`Ex: Etudiante en Marketing — Candidature ${candidatureType === "stage" ? "Stage" : candidatureType}`}
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                    <p className="text-xs text-slate-500">C'est la ligne qui apparait sous ton nom sur le CV.</p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <Mail className="size-3.5" /> Email
                      </Label>
                      <Input type="email" placeholder="marie@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <Phone className="size-3.5" /> Telephone
                      </Label>
                      <Input placeholder="06 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> Ville
                      </Label>
                      <Input placeholder="Paris" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Linkedin className="size-3.5" /> LinkedIn (optionnel)
                    </Label>
                    <Input placeholder="linkedin.com/in/marie-dupont" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── ÉTAPE 2 : FORMATION ── */}
            {step === 2 && (
              <div className="space-y-4">
                {education.map((edu, i) => (
                  <Card key={edu.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Formation {i + 1}</CardTitle>
                        {education.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeEducation(edu.id)}>
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Diplome / Niveau</Label>
                          <Input
                            placeholder="BTS Communication, Licence Marketing, Bac S..."
                            value={edu.degree}
                            onChange={(e) => updateEducation(edu.id, "degree", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Etablissement</Label>
                          <Input
                            placeholder="IUT Paris, Lycee Victor Hugo..."
                            value={edu.school}
                            onChange={(e) => updateEducation(edu.id, "school", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Periode</Label>
                          <Input
                            placeholder="2023 – 2025"
                            value={edu.period}
                            onChange={(e) => updateEducation(edu.id, "period", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Mention / Detail (optionnel)</Label>
                          <Input
                            placeholder="Mention Bien, option Marketing Digital..."
                            value={edu.description}
                            onChange={(e) => updateEducation(edu.id, "description", e.target.value)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addEducation} className="w-full gap-2">
                  <Plus className="size-4" /> Ajouter une formation
                </Button>
              </div>
            )}

            {/* ── ÉTAPE 3 : EXPÉRIENCE ── */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Toggle no experience */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <button
                    onClick={() => setNoExperience(!noExperience)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${noExperience ? "bg-indigo-600" : "bg-slate-300"}`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${noExperience ? "translate-x-5" : "translate-x-1"}`}
                    />
                  </button>
                  <div>
                    <p className="text-sm font-medium">Je n'ai pas encore d'experience professionnelle</p>
                    <p className="text-xs text-slate-500">Le CV sera adapte pour mettre en avant ta formation et tes projets.</p>
                  </div>
                </div>

                {!noExperience && (
                  <>
                    <div className="grid lg:grid-cols-3 gap-6">
                      {/* Formulaires */}
                      <div className="lg:col-span-2 space-y-4">
                        {experiences.map((exp, i) => (
                          <Card key={exp.id} className={activeBulletExp === exp.id ? "border-indigo-300" : ""}>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => setActiveBulletExp(exp.id)}
                                  className="flex items-center gap-2"
                                >
                                  <CardTitle className="text-base">Experience {i + 1}</CardTitle>
                                  {activeBulletExp === exp.id && (
                                    <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">
                                      Suggestions actives
                                    </Badge>
                                  )}
                                </button>
                                {experiences.length > 1 && (
                                  <Button variant="ghost" size="sm" onClick={() => removeExperience(exp.id)}>
                                    <Trash2 className="size-4 text-red-500" />
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label>Poste</Label>
                                  <Input
                                    placeholder="Stagiaire communication..."
                                    value={exp.title}
                                    onChange={(e) => updateExperience(exp.id, "title", e.target.value)}
                                    onFocus={() => setActiveBulletExp(exp.id)}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Entreprise / Structure</Label>
                                  <Input
                                    placeholder="Decathlon, Association..."
                                    value={exp.company}
                                    onChange={(e) => updateExperience(exp.id, "company", e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Periode</Label>
                                <Input
                                  placeholder="Juin – Aout 2024"
                                  value={exp.period}
                                  onChange={(e) => updateExperience(exp.id, "period", e.target.value)}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Missions (clique sur une suggestion pour l'ajouter)</Label>
                                <Textarea
                                  placeholder="Decris tes missions, tes realisations..."
                                  value={exp.description}
                                  onChange={(e) => updateExperience(exp.id, "description", e.target.value)}
                                  onFocus={() => setActiveBulletExp(exp.id)}
                                  rows={4}
                                  className="resize-none text-sm"
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        <Button variant="outline" onClick={addExperience} className="w-full gap-2">
                          <Plus className="size-4" /> Ajouter une experience
                        </Button>
                      </div>

                      {/* Suggestions de bullets */}
                      <div className="lg:col-span-1">
                        <Card className="sticky top-6">
                          <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Lightbulb className="size-4 text-amber-500" />
                              Suggestions de missions
                            </CardTitle>
                            <p className="text-xs text-slate-500">
                              Clique pour ajouter a l'experience selectionnee
                            </p>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {BULLETS[sector].map((bullet, i) => (
                                <button
                                  key={i}
                                  onClick={() => appendBullet(activeBulletExp, bullet)}
                                  className="w-full text-left text-xs p-2.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all leading-relaxed group"
                                >
                                  <span className="text-indigo-400 group-hover:text-indigo-600 mr-1">+</span>
                                  {bullet}
                                </button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </>
                )}

                {noExperience && (
                  <Card className="bg-indigo-50 border-indigo-100">
                    <CardContent className="p-6">
                      <p className="text-sm text-indigo-800 font-medium mb-2">Conseils pour profil sans experience :</p>
                      <ul className="text-sm text-indigo-700 space-y-1.5">
                        <li>• Mets en avant tes projets scolaires ou personnels</li>
                        <li>• Ajoute les stages d'observation (3eme, lycee...)</li>
                        <li>• Mentionne les activites associatives ou benevoles</li>
                        <li>• Valorise tes formations extra-scolaires (BAFA, secourisme...)</li>
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ── ÉTAPE 4 : PROJETS ── */}
            {step === 4 && (
              <div className="space-y-4">
                {projects.map((proj, i) => (
                  <Card key={proj.id} className={activeBulletProj === proj.id ? "border-indigo-300" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setActiveBulletProj(proj.id)}
                          className="flex items-center gap-2"
                        >
                          <CardTitle className="text-base">Projet {i + 1}</CardTitle>
                          {activeBulletProj === proj.id && (
                            <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">
                              Suggestions actives
                            </Badge>
                          )}
                        </button>
                        {projects.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeProject(proj.id)}>
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Nom du projet</Label>
                          <Input
                            placeholder="Projet de fin d'année, Hackathon..."
                            value={proj.name}
                            onChange={(e) => updateProject(proj.id, "name", e.target.value)}
                            onFocus={() => setActiveBulletProj(proj.id)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Contexte</Label>
                          <Input
                            placeholder="Ecole, Association, Stage..."
                            value={proj.context}
                            onChange={(e) => updateProject(proj.id, "context", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Description (clique sur une suggestion pour l'ajouter)</Label>
                        <Textarea
                          placeholder="Decris tes missions, tes realisations..."
                          value={proj.description}
                          onChange={(e) => updateProject(proj.id, "description", e.target.value)}
                          onFocus={() => setActiveBulletProj(proj.id)}
                          rows={4}
                          className="resize-none text-sm"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button variant="outline" onClick={addProject} className="w-full gap-2">
                  <Plus className="size-4" /> Ajouter un projet
                </Button>
              </div>
            )}

            {/* ── ÉTAPE 5 : COMPÉTENCES ── */}
            {step === 5 && (
              <div className="space-y-6">
                {/* Compétences secteur */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Competences metier
                      <span className="text-xs font-normal text-slate-500">— {SECTORS.find(s => s.id === sector)?.label}</span>
                    </CardTitle>
                    <p className="text-xs text-slate-500">Selectionne les competences que tu maitises.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {SKILLS_BY_SECTOR[sector].map((skill) => (
                        <button
                          key={skill}
                          onClick={() => toggleSkill(skill, selectedSkills, setSelectedSkills)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            selectedSkills.includes(skill)
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300"
                          }`}
                        >
                          {selectedSkills.includes(skill) && <Check className="size-3 inline mr-1" />}
                          {skill}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Soft skills */}
                <Card>
                  <CardHeader>
                    <CardTitle>Soft skills & qualites</CardTitle>
                    <p className="text-xs text-slate-500">Choisis 4 a 6 qualites qui te correspondent vraiment.</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {SOFT_SKILLS.map((skill) => (
                        <button
                          key={skill}
                          onClick={() => toggleSkill(skill, selectedSoftSkills, setSelectedSoftSkills)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            selectedSoftSkills.includes(skill)
                              ? "bg-violet-600 text-white border-violet-600"
                              : "bg-white text-slate-700 border-slate-200 hover:border-violet-300"
                          }`}
                        >
                          {selectedSoftSkills.includes(skill) && <Check className="size-3 inline mr-1" />}
                          {skill}
                        </button>
                      ))}
                    </div>
                    {selectedSoftSkills.length > 6 && (
                      <p className="text-xs text-amber-600 mt-3">
                        Conseil : ne depasse pas 6 soft skills. Les recruteurs privilegient la pertinence a la quantite.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Langues */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="size-4" /> Langues
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {languageEntries.map((entry, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <select
                          value={entry.lang}
                          onChange={(e) => updateLanguage(i, "lang", e.target.value)}
                          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors flex-1"
                        >
                          <option value="">Langue...</option>
                          {LANGUAGES.map((l) => (
                            <option key={l.lang} value={l.lang}>{l.lang}</option>
                          ))}
                        </select>
                        <select
                          value={entry.level}
                          onChange={(e) => updateLanguage(i, "level", e.target.value)}
                          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors flex-1"
                        >
                          <option value="">Niveau...</option>
                          {(LANGUAGES.find((l) => l.lang === entry.lang)?.levels ?? [
                            "Notions (A2)", "Scolaire (B1)", "Courant (B2)", "Bilingue (C1)", "Langue maternelle",
                          ]).map((lv) => (
                            <option key={lv} value={lv}>{lv}</option>
                          ))}
                        </select>
                        {languageEntries.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeLanguage(i)}>
                            <Trash2 className="size-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addLanguage} className="gap-1.5">
                      <Plus className="size-3.5" /> Ajouter une langue
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── ÉTAPE 6 : APERÇU ── */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-end gap-3">
                  <Button variant="outline" onClick={handlePrint} className="gap-2">
                    <Download className="size-4" />
                    Telecharger PDF
                  </Button>
                </div>

                {/* CV Preview */}
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="bg-white p-8 md:p-12 max-w-[800px] mx-auto print:p-6">
                      {/* En-tête CV */}
                      <div className="border-b-2 border-indigo-600 pb-6 mb-6">
                        <h1 className="text-3xl font-bold text-slate-900">
                          {firstName || lastName ? `${firstName} ${lastName}`.trim() : "Ton Nom"}
                        </h1>
                        <p className="text-lg text-indigo-600 font-medium mt-1">
                          {jobTitle || "Titre professionnel"}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
                          {email && (
                            <span className="flex items-center gap-1">
                              <Mail className="size-3.5" /> {email}
                            </span>
                          )}
                          {phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="size-3.5" /> {phone}
                            </span>
                          )}
                          {city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3.5" /> {city}
                            </span>
                          )}
                          {linkedin && (
                            <span className="flex items-center gap-1">
                              <Linkedin className="size-3.5" /> {linkedin}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Profil / Accroche */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
                            Profil
                          </h2>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs gap-1 text-slate-500 hover:text-indigo-600"
                              onClick={() => {
                                setSummaryVariantIdx((v) => v + 1);
                                setEditedSummary(null);
                              }}
                            >
                              <RefreshCw className="size-3" /> Variante
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-slate-400"
                              onClick={() => setEditedSummary(null)}
                            >
                              Reset
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={summary}
                          onChange={(e) => setEditedSummary(e.target.value)}
                          rows={4}
                          className="text-sm text-slate-700 leading-relaxed resize-none border-dashed border-slate-200 bg-transparent hover:border-indigo-200 focus:border-indigo-400 p-2 rounded"
                        />
                      </div>

                      {/* Experience */}
                      {!noExperience && experiences.some((e) => e.title) && (
                        <div className="mb-6">
                          <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                            Experience professionnelle
                          </h2>
                          <div className="space-y-4">
                            {experiences.filter((e) => e.title).map((exp) => (
                              <div key={exp.id}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-sm">{exp.title}</p>
                                    <p className="text-sm text-slate-600">{exp.company}</p>
                                  </div>
                                  <p className="text-xs text-slate-500 whitespace-nowrap ml-4">{exp.period}</p>
                                </div>
                                <p className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                                  {exp.description}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Formation */}
                      {education.some((e) => e.degree) && (
                        <div className="mb-6">
                          <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                            Formation
                          </h2>
                          <div className="space-y-3">
                            {education.filter((e) => e.degree).map((edu) => (
                              <div key={edu.id}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-sm">{edu.degree}</p>
                                    <p className="text-sm text-slate-600">{edu.school}</p>
                                  </div>
                                  <p className="text-xs text-slate-500 whitespace-nowrap ml-4">{edu.period}</p>
                                </div>
                                {edu.description && (
                                  <p className="text-sm text-slate-600 mt-1">{edu.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Projets */}
                      {projects.some((e) => e.name) && (
                        <div className="mb-6">
                          <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">
                            Projets
                          </h2>
                          <div className="space-y-3">
                            {projects.filter((e) => e.name).map((proj) => (
                              <div key={proj.id}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-semibold text-sm">{proj.name}</p>
                                    <p className="text-sm text-slate-600">{proj.context}</p>
                                  </div>
                                </div>
                                {proj.description && (
                                  <p className="text-sm text-slate-600 mt-1">{proj.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Compétences */}
                      {(selectedSkills.length > 0 || selectedSoftSkills.length > 0) && (
                        <div className="mb-6">
                          <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                            Competences
                          </h2>
                          <div className="flex flex-wrap gap-2">
                            {[...selectedSkills, ...selectedSoftSkills].map((skill, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Langues */}
                      {languageEntries.some((l) => l.lang) && (
                        <div>
                          <h2 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                            Langues
                          </h2>
                          <p className="text-sm text-slate-700">
                            {languageEntries
                              .filter((l) => l.lang)
                              .map((l) => `${l.lang}${l.level ? ` (${l.level})` : ""}`)
                              .join(" • ")}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Conseils ATS */}
                <Card className="bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-indigo-900 mb-2 flex items-center gap-2">
                      <Eye className="size-4" /> Checklist ATS rapide
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[
                        { ok: !!email && !!phone, label: "Coordonnees completes" },
                        { ok: education.some((e) => e.degree), label: "Formation renseignee" },
                        { ok: !noExperience && experiences.some((e) => e.title), label: "Experience ajoutee" },
                        { ok: selectedSkills.length >= 3, label: "3+ competences metier" },
                        { ok: !!jobTitle, label: "Titre professionnel present" },
                        { ok: !!linkedin, label: "LinkedIn mentionne" },
                      ].map((item, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs ${item.ok ? "text-green-700" : "text-slate-500"}`}>
                          {item.ok ? <CheckCircle className="size-3.5 text-green-600" /> : <div className="size-3.5 rounded-full border border-slate-300" />}
                          {item.label}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={step === 0}
            className="gap-2"
          >
            <ChevronLeft className="size-4" />
            Precedent
          </Button>

          <span className="text-xs text-slate-400">
            {step + 1} / {STEPS.length}
          </span>

          {step < STEPS.length - 1 ? (
            <Button onClick={handleGoToPreview} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={handlePrint} className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600">
              <Download className="size-4" />
              Exporter en PDF
            </Button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
