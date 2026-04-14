import { useState, useMemo } from "react";
import { useSEO } from "../hooks/useSEO";
import { LoadingScreen } from "../components/LoadingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  PenTool,
  Download,
  Copy,
  CheckCircle,
  RefreshCw,
  Wand2,
  Info,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  buildCoverLetter,
  SECTORS,
  SectorId,
  CandidatureType,
  LetterTone,
} from "../lib/reussia-data";

const TONE_LABELS: Record<LetterTone, string> = {
  professionnel: "Professionnel",
  dynamique: "Dynamique",
  formel: "Formel",
  creatif: "Creatif",
};

const TYPE_LABELS: Record<CandidatureType, string> = {
  stage: "Stage",
  alternance: "Alternance",
  emploi: "Emploi",
  parcoursup: "Parcoursup / Formation",
};

export function CoverLetter() {
useSEO({ title: "Lettre de motivation — Cadova", noindex: false });
  const [generated, setGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [variant, setVariant] = useState(0); // pour forcer une regénération visuelle

  // Identité
  const [firstName, setFirstName] = useState("");
  const [city, setCity] = useState("");

  // Candidature
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [sector, setSector] = useState<SectorId>("marketing");
  const [type, setType] = useState<CandidatureType>("stage");
  const [tone, setTone] = useState<LetterTone>("professionnel");
  const [formation, setFormation] = useState("");

  // Personnalisation
  const [strengths, setStrengths] = useState("");
  const [motivation, setMotivation] = useState("");

  // Contenu éditable
  const [editedContent, setEditedContent] = useState<string | null>(null);

  const canGenerate = companyName.trim().length > 0 && jobTitle.trim().length > 0;

  // La lettre assemblée automatiquement
  const assembledLetter = useMemo(() => {
    if (!canGenerate) return "";
    return buildCoverLetter({
      firstName,
      companyName,
      jobTitle,
      sector,
      formation,
      type,
      tone,
      strengths,
      motivation,
      city,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, type, tone, sector]);

  const letterContent = editedContent ?? assembledLetter;

  const handleGenerate = () => {
    setIsGenerating(true);
  };

  const handleGenerateComplete = () => {
    const letter = buildCoverLetter({
      firstName,
      companyName,
      jobTitle,
      sector,
      formation,
      type,
      tone,
      strengths,
      motivation,
      city,
    });
    setEditedContent(letter);
    setIsGenerating(false);
    setGenerated(true);
  };

  const handleRegenerate = () => {
    const letter = buildCoverLetter({
      firstName,
      companyName,
      jobTitle,
      sector,
      formation,
      type,
      tone,
      strengths,
      motivation,
      city,
    });
    setEditedContent(letter);
    setVariant((v) => v + 1);
  };

  const handleCopy = () => {
    if (!letterContent) return;
    navigator.clipboard.writeText(letterContent).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = letterContent;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Lettre de motivation — ${firstName || "Candidat"}</title>
      <style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 60px auto; line-height: 1.8; color: #1e293b; font-size: 14px; }
        pre { white-space: pre-wrap; font-family: Georgia, serif; }
      </style>
    </head><body><pre>${letterContent}</pre></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const charCount = letterContent?.length ?? 0;
  const charLabel =
    charCount < 800
      ? "Trop courte"
      : charCount < 1200
      ? "Bonne longueur"
      : charCount < 1800
      ? "Un peu longue"
      : "Trop longue";
  const charColor =
    charCount < 800
      ? "text-red-500"
      : charCount < 1800
      ? "text-green-600"
      : "text-amber-600";

  return (
    <AppLayout>
      {isGenerating && (
        <LoadingScreen
          label="Génération de la lettre"
          accent="#8B5CF6"
          steps={[
            { label: "Analyse du profil et du secteur", duration: 600 },
            { label: "Sélection du ton et du style", duration: 500 },
            { label: "Rédaction de l'introduction", duration: 700 },
            { label: "Construction de l'argumentaire", duration: 800 },
            { label: "Personnalisation pour l'entreprise", duration: 700 },
            { label: "Relecture et mise en forme finale", duration: 500 },
          ]}
          onComplete={handleGenerateComplete}
        />
      )}
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <PenTool className="size-5 text-white" />
            </div>
            Lettre de Motivation
          </h1>
          <p className="text-slate-600 mt-1">
            Assemblee automatiquement depuis des blocs optimises — modifiable a volonte.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Formulaire */}
          <div className="space-y-4">
            {/* Identite */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ton identite</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Prenom</Label>
                    <Input
                      placeholder="Marie"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ville</Label>
                    <Input
                      placeholder="Paris"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Ta formation actuelle</Label>
                  <Input
                    placeholder="BTS Communication, Licence Marketing..."
                    value={formation}
                    onChange={(e) => setFormation(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Candidature */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">La candidature</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v) => setType(v as CandidatureType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ton</Label>
                    <Select value={tone} onValueChange={(v) => setTone(v as LetterTone)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TONE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Secteur</Label>
                  <Select value={sector} onValueChange={(v) => setSector(v as SectorId)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SECTORS.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex items-center gap-2">
                            <s.icon className="w-5 h-5 text-gray-500" />
                            <span>{s.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Entreprise / Etablissement{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Decathlon, Universite Paris..."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Poste / Formation visee <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Charge de communication, Licence Droit..."
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Personnalisation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Personnalisation
                  <span className="text-xs font-normal text-slate-500">(facultatif mais recommande)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Tes points forts</Label>
                  <Input
                    placeholder="Ex: gestion de projet, bilingue, sens du contact..."
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pourquoi cette entreprise ?</Label>
                  <Textarea
                    placeholder="Ce qui t'attire dans cette entreprise ou formation..."
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
              size="lg"
            >
              <Wand2 className="size-4" />
              {generated ? "Regenerer la lettre" : "Generer ma lettre"}
            </Button>
            {!canGenerate && (
              <p className="text-xs text-slate-500 text-center">
                Remplis l'entreprise et le poste pour generer ta lettre.
              </p>
            )}
          </div>

          {/* Apercu */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <AnimatePresence mode="wait">
              {generated ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle className="size-5 text-green-600" />
                          Lettre generee
                        </CardTitle>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRegenerate}
                            className="gap-1"
                          >
                            <RefreshCw className="size-3.5" />
                            Variante
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopy}
                            className="gap-1"
                          >
                            {copied ? (
                              <>
                                <CheckCircle className="size-3.5 text-green-600" />
                                Copie !
                              </>
                            ) : (
                              <>
                                <Copy className="size-3.5" />
                                Copier
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePrint}
                            className="gap-1"
                          >
                            <Download className="size-3.5" />
                            PDF
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={letterContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        rows={24}
                        className="text-sm leading-relaxed resize-none bg-slate-50 border-slate-200 font-serif"
                      />
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-xs text-slate-500">
                          Tu peux modifier le texte directement ci-dessus.
                        </p>
                        <span className={`text-xs font-medium ${charColor}`}>
                          {charCount} car. — {charLabel}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <Card className="h-full">
                    <CardContent className="p-12 text-center flex flex-col items-center justify-center min-h-[500px]">
                      <div className="size-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                        <PenTool className="size-8 text-violet-600" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Ta lettre apparaitra ici</h3>
                      <p className="text-slate-600 text-sm max-w-sm mb-6">
                        Remplis les details a gauche — entreprise et poste sont requis.
                        La lettre est assemblee depuis des blocs optimises par profil.
                      </p>
                      <div className="flex items-start gap-2 p-3 bg-violet-50 rounded-xl text-left max-w-sm">
                        <Info className="size-4 text-violet-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-violet-700">
                          Chaque combinaison Type + Ton + Secteur donne un bloc
                          d'introduction different. Tu peux egalement modifier le texte
                          genere directement dans l'editeur.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
