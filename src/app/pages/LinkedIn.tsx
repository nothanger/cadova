import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Linkedin,
  Loader2,
  Save,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "../components/AppLayout";
import { useSEO } from "../hooks/useSEO";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { apiCall } from "@/lib/supabase";
import { saveLinkedInAnalysis } from "@/lib/localStorage";
import { useAuth } from "@/contexts/AuthContext";

type LinkedInResult = {
  score: number;
  strengths: string[];
  improvements: string[];
  suggestedSummary: string;
  suggestedSkills: string[];
};

function buildLocalAnalysis(profileText: string): LinkedInResult {
  const lowered = profileText.toLowerCase();
  const words = profileText.trim().split(/\s+/).filter(Boolean);
  const hasHeadline = words.length > 12;
  const hasNumbers = /\d/.test(profileText);
  const hasKeywords = ["linkedin", "strategie", "gestion", "projet", "marketing", "developpement", "vente", "produit"].some((word) =>
    lowered.includes(word)
  );
  const hasCallToAction = /(contact|disponible|ouvert|a l'ecoute)/.test(lowered);

  let score = 45;
  if (hasHeadline) score += 15;
  if (hasNumbers) score += 15;
  if (hasKeywords) score += 15;
  if (hasCallToAction) score += 10;

  return {
    score: Math.min(score, 95),
    strengths: [
      hasHeadline ? "Le profil contient assez de matiere pour raconter ton parcours." : "Tu as deja une base de profil a retravailler.",
      hasNumbers ? "Des chiffres ou resultats mesurables apparaissent dans le texte." : "Il y a de la place pour ajouter des resultats concrets.",
      hasKeywords ? "Le profil mentionne deja plusieurs mots utiles pour les recruteurs." : "Le texte reste general et peut devenir plus cible.",
    ],
    improvements: [
      "Ajoute une accroche d'une ou deux lignes qui dit clairement qui tu es et ce que tu vises.",
      "Integre des resultats concrets: pourcentage, volume, delai, taille d'equipe ou projet.",
      "Termine ton resume par une ouverture claire: ce que tu recherches et comment te contacter.",
    ],
    suggestedSummary:
      "Je developpe un profil oriente resultat, avec une experience que je transforme en actions concretes, competences visibles et objectifs clairs pour mon prochain poste.",
    suggestedSkills: ["Communication", "Gestion de projet", "Analyse", "Organisation", "Relation client"],
  };
}

export function LinkedIn() {
  useSEO({ title: "Optimisation LinkedIn - Cadova", noindex: true });
  const { user } = useAuth();
  const [profileText, setProfileText] = useState("");
  const [analysis, setAnalysis] = useState<LinkedInResult | null>(null);
  const [loading, setLoading] = useState(false);

  const hint = useMemo(() => {
    const length = profileText.trim().length;
    if (length === 0) return "Colle le texte de ton profil pour commencer.";
    if (length < 240) return "Ajoute encore un peu de contenu pour une analyse plus utile.";
    return "La matiere est suffisante pour sortir des pistes concretes.";
  }, [profileText]);

  const saveResult = (result: LinkedInResult) => {
    if (!user?.id) return;
    saveLinkedInAnalysis({
      userId: user.id,
      score: result.score,
      strengths: result.strengths,
      improvements: result.improvements,
      suggestedSummary: result.suggestedSummary,
      suggestedSkills: result.suggestedSkills,
    });
  };

  const handleAnalyze = async () => {
    if (!profileText.trim()) {
      toast.error("Colle le texte de ton profil LinkedIn.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiCall("/skillia/analyze-linkedin", {
        method: "POST",
        body: JSON.stringify({ profileText }),
      });

      const data = await response.json();

      if (!response.ok || !data.analysis) {
        throw new Error(data.error || "Analyse distante indisponible");
      }

      const result = data.analysis as LinkedInResult;
      setAnalysis(result);
      saveResult(result);
      toast.success("Analyse LinkedIn enregistree.");
    } catch {
      const localResult = buildLocalAnalysis(profileText);
      setAnalysis(localResult);
      saveResult(localResult);
      toast.success("Analyse locale terminee et enregistree.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="size-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <Linkedin className="size-5 text-white" />
            </span>
            Optimisation LinkedIn
          </h1>
          <p className="text-slate-600 mt-2">Analyse ton profil, repere les manques et sauvegarde le resultat dans ton dashboard.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Texte du profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={10}
              value={profileText}
              onChange={(event) => setProfileText(event.target.value)}
              placeholder="Resume, experiences, competences, projets, objectifs..."
              className="resize-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">{hint}</p>
              <Button onClick={handleAnalyze} disabled={loading || !profileText.trim()} className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
                Analyser
              </Button>
            </div>
          </CardContent>
        </Card>

        {analysis ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center size-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 text-white text-3xl font-bold mb-4">
                    {analysis.score}
                  </div>
                  <p className="text-slate-600">Score global du profil</p>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={() => {
                      saveResult(analysis);
                      toast.success("Analyse sauvegardee a nouveau.");
                    }}
                  >
                    <Save className="size-4" />
                    Sauvegarder
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="size-5" />
                    Points forts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.strengths.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="size-4 mt-0.5 text-green-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="size-5" />
                    A renforcer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {analysis.improvements.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <AlertCircle className="size-4 mt-0.5 text-amber-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resume suggere</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 leading-7">{analysis.suggestedSummary}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Competences a mettre en avant</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {analysis.suggestedSkills.map((skill) => (
                  <Badge key={skill} className="bg-blue-50 text-blue-700 border border-blue-200">
                    {skill}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
