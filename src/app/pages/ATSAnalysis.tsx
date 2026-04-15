import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  FileText,
  Search,
  Target,
  XCircle,
} from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { LoadingScreen } from "../components/LoadingScreen";
import { useSEO } from "../hooks/useSEO";
import { ATSMode, ATS_MODES, ATSResult, runATSAnalysis } from "../lib/reussia-data";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Textarea } from "../components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { saveATSAnalysis } from "@/lib/localStorage";
import { toast } from "sonner";

function getScoreTone(score: number) {
  if (score >= 75) return { text: "text-green-600", bg: "from-green-500 to-emerald-500" };
  if (score >= 55) return { text: "text-amber-600", bg: "from-amber-500 to-orange-500" };
  return { text: "text-red-600", bg: "from-red-500 to-rose-500" };
}

export function ATSAnalysis() {
  useSEO({ title: "Analyse ATS - Cadova", noindex: false });
  const { user } = useAuth();
  const [cvText, setCvText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [mode, setMode] = useState<ATSMode>("stage");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ATSResult | null>(null);

  const selectedMode = useMemo(() => ATS_MODES.find((item) => item.value === mode)!, [mode]);
  const canAnalyze = cvText.trim().length > 40;

  const startAnalysis = () => {
    if (!canAnalyze) {
      toast.error("Ajoute un peu plus de contenu avant de lancer l'analyse.");
      return;
    }
    setAnalyzing(true);
  };

  const finishAnalysis = () => {
    const analysis = runATSAnalysis(cvText, jobDescription, mode);
    setResult(analysis);

    if (user?.id) {
      saveATSAnalysis({
        userId: user.id,
        score: analysis.score,
        strengths: analysis.matchedKeywords.slice(0, 10),
        weaknesses: analysis.sections.filter((section) => section.status !== "good").map((section) => section.feedback),
        missingKeywords: analysis.missingKeywords,
        matchedKeywords: analysis.matchedKeywords,
        suggestions: analysis.suggestions,
      });
    }

    setAnalyzing(false);
    toast.success("Analyse ATS enregistree dans ton dashboard.");
  };

  const tone = result ? getScoreTone(result.score) : null;

  return (
    <AppLayout>
      {analyzing ? (
        <LoadingScreen
          label="Analyse ATS"
          accent="#06b6d4"
          steps={[
            { label: "Lecture du CV", duration: 500 },
            { label: "Extraction des mots-cles", duration: 600 },
            { label: "Comparaison avec l'offre", duration: 700 },
            { label: "Calcul du score final", duration: 500 },
          ]}
          onComplete={finishAnalysis}
        />
      ) : null}

      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="size-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <Search className="size-5 text-white" />
            </span>
            Analyse ATS
          </h1>
          <p className="text-slate-600 mt-2">
            Compare ton CV a un poste cible et conserve le resultat dans ton espace.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="size-5 text-cyan-600" />
                    Type de candidature
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {ATS_MODES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setMode(item.value)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        item.value === mode ? "border-cyan-300 bg-cyan-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        <item.icon className="size-4 text-cyan-600" />
                        {item.label}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="size-5 text-cyan-600" />
                    Ton CV
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    rows={14}
                    value={cvText}
                    onChange={(event) => setCvText(event.target.value)}
                    placeholder="Colle ici le texte integral de ton CV."
                    className="resize-none"
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="size-5 text-cyan-600" />
                    Offre cible
                    <Badge variant="secondary">{selectedMode.value === "observation" ? "Optionnel" : "Recommande"}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    rows={10}
                    value={jobDescription}
                    onChange={(event) => setJobDescription(event.target.value)}
                    placeholder="Colle ici l'offre pour une comparaison plus precise."
                    className="resize-none"
                  />
                  <Button onClick={startAnalysis} disabled={!canAnalyze} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                    <Search className="size-4" />
                    Lancer l'analyse
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-[320px_1fr]">
                <Card>
                  <CardContent className="pt-8 text-center">
                    <div className={`size-32 mx-auto rounded-full bg-gradient-to-br ${tone?.bg} p-1`}>
                      <div className="size-full rounded-full bg-white flex flex-col items-center justify-center">
                        <div className={`text-4xl font-bold ${tone?.text}`}>{result.score}</div>
                        <div className="text-xs text-slate-400">/100</div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">
                      {result.hasJobDesc ? "Score structure + compatibilite" : "Score structure uniquement"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Analyse par critere</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {result.sections.map((section) => (
                      <div key={section.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{section.name}</span>
                          <span className="text-sm text-slate-500">{section.score}%</span>
                        </div>
                        <Progress value={section.score} className="h-2 mb-1" />
                        <p className="text-sm text-slate-500">{section.feedback}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="size-5 text-green-600" />
                      Mots-cles presents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {result.matchedKeywords.length ? (
                      result.matchedKeywords.map((word) => (
                        <Badge key={word} className="bg-green-50 text-green-700 border border-green-200">
                          {word}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Aucun mot-cle commun detecte pour l'instant.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <XCircle className="size-5 text-red-600" />
                      Mots-cles a integrer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {result.missingKeywords.length ? (
                      result.missingKeywords.map((word) => (
                        <Badge key={word} className="bg-red-50 text-red-700 border border-red-200">
                          {word}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Rien de bloquant detecte ici.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart2 className="size-5 text-cyan-600" />
                    Recommandations Cadova
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.suggestions.map((suggestion) => (
                    <div key={suggestion} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3">
                      <ArrowRight className="size-4 text-cyan-600 mt-0.5" />
                      <p className="text-sm text-slate-700">{suggestion}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {result.topJobKeywords.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Mots-cles dominants dans l'offre</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {result.topJobKeywords.map((item) => (
                      <Badge
                        key={item.word}
                        className={
                          item.found
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }
                      >
                        {item.word}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setResult(null)}>
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
                  <AlertTriangle className="size-4" />
                  Reinitialiser
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
