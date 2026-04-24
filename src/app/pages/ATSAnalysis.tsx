import { useState } from "react";
import { runATSAnalysis, ATSResult, ATSMode, ATS_MODES } from "../lib/reussia-data";
import { useSEO } from "../hooks/useSEO";
import { LoadingScreen } from "../components/LoadingScreen";
import { AppLayout } from "../components/AppLayout";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, FileText, Target, CheckCircle, XCircle,
  AlertTriangle, TrendingUp, Zap, ArrowRight, Info, BarChart2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { UpgradeModal } from "../components/UpgradeModal";
import { useFreemiumGate } from "../hooks/useFreemiumGate";

export function ATSAnalysis() {
  useSEO({ title: "Analyse ATS - Cadova", noindex: false });
  const { upgradeOpen, closeUpgrade, ensureGenerationAccess, consumeGeneration } = useFreemiumGate();
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [mode, setMode] = useState<ATSMode>("stage");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ATSResult | null>(null);

  const handleAnalyze = async () => {
    if (!cvText.trim()) return;
    if (!(await ensureGenerationAccess())) return;
    setAnalyzing(true);
  };

  const handleAnalyzeComplete = async () => {
    const res = runATSAnalysis(cvText, jobDescription, mode);
    setResult(res);
    setAnalyzing(false);
    await consumeGeneration("ats-analysis");
  };

  const getScoreColor = (score: number) => {
    if (score >= 72) return "text-green-600";
    if (score >= 48) return "text-amber-600";
    return "text-red-600";
  };

  const getScoreGradient = (score: number) => {
    if (score >= 72) return "from-green-500 to-emerald-500";
    if (score >= 48) return "from-amber-500 to-orange-500";
    return "from-red-500 to-rose-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 82) return "Excellent";
    if (score >= 68) return "Bon";
    if (score >= 50) return "Moyen";
    if (score >= 35) return "À améliorer";
    return "Insuffisant";
  };

  const getStatusIcon = (status: string) => {
    if (status === "good") return <CheckCircle className="size-4 text-green-600" />;
    if (status === "warning") return <AlertTriangle className="size-4 text-amber-600" />;
    return <XCircle className="size-4 text-red-600" />;
  };

  const cvWordCount = cvText.trim() ? cvText.trim().split(/\s+/).length : 0;
  const canAnalyze = cvText.trim().length > 30;
  const selectedMode = ATS_MODES.find((m) => m.value === mode)!;

  return (
    <AppLayout>
      <UpgradeModal open={upgradeOpen} onClose={closeUpgrade} />
      {analyzing && (
        <LoadingScreen
          label="Analyse ATS en cours"
          accent="#10B981"
          steps={[
            { label: "Lecture et tokenisation du CV", duration: 600 },
            { label: "Extraction des mots-clés critiques", duration: 700 },
            { label: "Comparaison avec l'offre d'emploi", duration: 800 },
            { label: "Calcul des scores par catégorie", duration: 700 },
            { label: "Génération des recommandations", duration: 600 },
            { label: "Compilation du rapport final", duration: 500 },
          ]}
          onComplete={handleAnalyzeComplete}
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
            <div className="size-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Search className="size-5 text-white" />
            </div>
            Analyse ATS
          </h1>
          <p className="text-slate-600 mt-1">
            Score instantané par règles logiques — adapté à ton profil.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Sélecteur de mode */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">
                  Quel type de dossier analyses-tu ?
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {ATS_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`flex flex-col gap-1.5 p-4 rounded-xl border-2 text-left transition-all ${
                        mode === m.value
                          ? "border-cyan-500 bg-cyan-50"
                          : "border-slate-200 hover:border-cyan-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <m.icon className="w-5 h-5 text-gray-500" />
                        <span className={`text-sm font-semibold ${mode === m.value ? "text-cyan-700" : "text-slate-800"}`}>
                          {m.label}
                        </span>
                        {mode === m.value && (
                          <CheckCircle className="size-4 text-cyan-600 ml-auto" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-snug">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Explication contextuelle */}
              <div className="flex items-start gap-3 p-4 bg-cyan-50 border border-cyan-100 rounded-xl">
                <Info className="size-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-cyan-800">
                    {mode === "observation" && (
                      <>Mode <strong>Stage d'observation</strong> — Le score évalue ton dossier sur la structure, la présentation et les motivations. Pas besoin de chiffres ni de LinkedIn. L'offre est optionnelle.</>
                    )}
                    {mode === "stage" && (
                      <>Mode <strong>Stage / Alternance</strong> — Le score combine la structure de ton CV (60%) et sa compatibilité avec l'offre (40% si tu en colles une).</>
                    )}
                    {mode === "pro" && (
                      <>Mode <strong>Emploi</strong> — Analyse exigeante : chiffres, LinkedIn, mots-clés de l'offre, impact de chaque mission. Colle l'offre d'emploi pour un score de compatibilité complet.</>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* CV */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <FileText className="size-5 text-cyan-600" />
                        {mode === "observation" ? "Ton dossier / CV" : "Ton CV"}
                      </span>
                      {cvWordCount > 0 && (
                        <span className="text-xs font-normal text-slate-500">
                          {cvWordCount} mots
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder={
                        mode === "observation"
                          ? "Copie-colle le texte de ton dossier...\n\nExemple :\nThomas Dupont — 06 12 34 56 78 — thomas@email.com\nÉlève en 3e B au Collège Victor Hugo, Paris\n\nMOTIVATION\nJe souhaite découvrir le secteur de la communication...\n\nCENTRES D'INTÉRÊT\nBasket, création de contenus YouTube, lecture..."
                          : mode === "stage"
                          ? "Copie-colle le texte de ton CV...\n\nExemple :\nMarie Dupont — marie@email.com — 06 12 34 56 78\nÉtudiante en BTS Communication, Paris\n\nFORMATION\nBTS Communication — IUT Paris-Nord (2023-2025)\n\nEXPÉRIENCE\nStage marketing — Agence XYZ (juin-août 2024)..."
                          : "Copie-colle le texte de ton CV...\n\nExemple :\nJean Dupont — jean@email.com — 06 12 34 56 78\nChargé de marketing digital\nlinkedin.com/in/jean-dupont\n\nEXPÉRIENCE\nChargé de communication — Agence XYZ (2022-2024)\n• Gestion de 4 réseaux sociaux, +35% d'engagement..."
                      }
                      value={cvText}
                      onChange={(e) => setCvText(e.target.value)}
                      rows={16}
                      className="resize-none text-sm"
                    />
                    {cvWordCount > 0 && cvWordCount < { observation: 60, stage: 120, pro: 200 }[mode] && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="size-3" />
                        Dossier court pour ce mode. Ajoute plus de contenu pour un score fiable.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Offre */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="size-5 text-cyan-600" />
                      Offre / Annonce cible
                      <Badge variant="secondary" className="text-xs font-normal">
                        {mode === "observation" ? "Optionnel" : "Recommandé"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder={
                        mode === "observation"
                          ? "Colle ici la description de l'entreprise ou la demande de stage...\n\nSans ce texte, on analyse uniquement la structure de ton dossier — ce qui est suffisant pour ce mode."
                          : "Colle ici la description du poste ou de l'offre d'alternance...\n\nAvec l'offre, on calcule ta compatibilité en mots-clés et on t'indique ce qu'il manque."
                      }
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      rows={16}
                      className="resize-none text-sm"
                    />
                  </CardContent>
                </Card>

                <div className="lg:col-span-2">
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzing || !canAnalyze}
                    className="w-full gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg shadow-cyan-500/25"
                    size="lg"
                  >
                    {analyzing ? (
                      <>
                        <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Analyse en cours...
                      </>
                    ) : (
                      <>
                        <Search className="size-5" />
                        <span className="flex items-center gap-2">
                          <span>Analyser mon {mode === "observation" ? "dossier" : "CV"}</span>
                          <selectedMode.icon className="w-5 h-5 text-current" />
                          <span>{selectedMode.label}</span>
                        </span>
                      </>
                    )}
                  </Button>
                  {!canAnalyze && cvText.length > 0 && (
                    <p className="text-xs text-slate-500 text-center mt-2">
                      Ajoute plus de contenu pour lancer l'analyse.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Badge mode */}
              <div className="flex items-center gap-2">
                <Badge className="bg-cyan-100 text-cyan-800 border-cyan-200 gap-1.5">
                  {(() => {
                    const currentMode = ATS_MODES.find((m) => m.value === result.mode);
                    if (!currentMode) return null;
                    const Icon = currentMode.icon;
                    return (
                      <>
                        <Icon className="w-5 h-5 text-current" />
                        {currentMode.label}
                      </>
                    );
                  })()}
                </Badge>
                {!result.hasJobDesc && (
                  <Badge variant="secondary" className="text-xs text-slate-500">
                    Score structure uniquement — sans offre
                  </Badge>
                )}
                {result.hasJobDesc && (
                  <Badge variant="secondary" className="text-xs text-green-700 bg-green-50 border-green-200">
                    Score avec compatibilité offre
                  </Badge>
                )}
              </div>

              {/* Score + Sections */}
              <div className="grid md:grid-cols-3 gap-6">
                <Card className="md:col-span-1">
                  <CardContent className="p-8 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                      className="relative inline-flex items-center justify-center mb-4"
                    >
                      <div
                        className={`size-32 rounded-full bg-gradient-to-br ${getScoreGradient(result.score)} p-1`}
                      >
                        <div className="size-full rounded-full bg-white flex flex-col items-center justify-center">
                          <span className={`text-4xl font-bold ${getScoreColor(result.score)}`}>
                            {result.score}
                          </span>
                          <span className="text-xs text-slate-500">/100</span>
                        </div>
                      </div>
                    </motion.div>
                    <h3 className="text-lg font-semibold">Score ATS</h3>
                    <p className={`text-sm font-medium mt-0.5 ${getScoreColor(result.score)}`}>
                      {getScoreLabel(result.score)}
                    </p>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {result.score >= 72
                        ? result.mode === "observation"
                          ? "Excellent dossier pour un stage d'observation !"
                          : "Ton CV est bien optimisé pour ce type de candidature."
                        : result.score >= 48
                        ? "Quelques ajustements vont nettement améliorer ton score."
                        : "Des points importants sont à corriger — consulte les recommandations."}
                    </p>

                    {/* Composition du score */}
                    <div className="mt-4 p-3 bg-slate-50 rounded-xl text-left space-y-1.5">
                      <p className="text-xs font-medium text-slate-600 mb-2">Composition du score :</p>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Structure du dossier</span>
                        <span className="font-medium">{result.hasJobDesc ? "40%" : "100%"}</span>
                      </div>
                      {result.hasJobDesc && (
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>Compatibilité offre</span>
                          <span className="font-medium">60%</span>
                        </div>
                      )}
                      {!result.hasJobDesc && result.mode !== "observation" && (
                        <p className="text-xs text-amber-600 mt-1 pt-1 border-t border-slate-200">
                          Colle une offre pour activer l'analyse de compatibilité.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="size-5 text-cyan-600" />
                      Analyse par critère
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {result.sections.map((section, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.07 }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(section.status)}
                              <span className="text-sm font-medium">{section.name}</span>
                            </div>
                            <span className={`text-sm font-bold ${getScoreColor(section.score)}`}>
                              {section.score}%
                            </span>
                          </div>
                          <Progress value={section.score} className="h-1.5 mb-1" />
                          <p className="text-xs text-slate-500">{section.feedback}</p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              
              {result.topJobKeywords.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart2 className="size-5 text-cyan-600" />
                      Mots-clés de l'offre ({result.topJobKeywords.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-slate-500 mb-3">
                      Vert = présent dans ton CV · Rouge = absent
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.topJobKeywords.map((kw, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <Badge
                            variant="secondary"
                            className={
                              kw.found
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-red-50 text-red-700 border-red-200"
                            }
                          >
                            {kw.found ? (
                              <CheckCircle className="size-3 mr-1" />
                            ) : (
                              <XCircle className="size-3 mr-1" />
                            )}
                            {kw.word}
                            {kw.freq > 1 && (
                              <span className="ml-1 opacity-60 text-[10px]">×{kw.freq}</span>
                            )}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

             
              {(result.matchedKeywords.length > 0 || result.missingKeywords.length > 0) && (
                <div className="grid md:grid-cols-2 gap-6">
                  {result.matchedKeywords.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle className="size-5 text-green-600" />
                          Mots-clés présents ({result.matchedKeywords.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {result.matchedKeywords.map((kw, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              <CheckCircle className="size-3 mr-1" />
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {result.missingKeywords.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <XCircle className="size-5 text-red-600" />
                          Mots-clés à intégrer ({result.missingKeywords.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {result.missingKeywords.map((kw, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="bg-red-50 text-red-700 border-red-200"
                            >
                              <XCircle className="size-3 mr-1" />
                              {kw}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-3">
                          Si tu possèdes ces compétences, intègre-les naturellement dans tes descriptions.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              
              <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-100">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="size-5 text-cyan-600" />
                    Recommandations Cadova
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.suggestions.map((suggestion, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                        className="flex items-start gap-3 p-3 bg-white/80 rounded-lg border border-cyan-100"
                      >
                        <ArrowRight className="size-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-700">{suggestion}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>

             
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={() => setResult(null)} className="gap-2">
                  <Search className="size-4" />
                  Nouvelle analyse
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCvText("");
                    setJobDescription("");
                    setResult(null);
                  }}
                  className="gap-2"
                >
                  Tout effacer
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
