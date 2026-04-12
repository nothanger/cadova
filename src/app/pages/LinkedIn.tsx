import { AppLayout } from "../components/AppLayout";
import { useState } from "react";
import { useSEO } from "../hooks/useSEO";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { apiCall } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Linkedin,
  Loader2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export function LinkedIn() {
  useSEO({ title: "Optimisation LinkedIn SkillIA — Cadova", noindex: true });
  const [profileText, setProfileText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!profileText.trim()) {
      toast.error("Veuillez coller le texte de votre profil LinkedIn");
      return;
    }

    setLoading(true);

    try {
      const response = await apiCall("/skillia/analyze-linkedin", {
        method: "POST",
        body: JSON.stringify({ profileText }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erreur lors de l'analyse");
        console.error("❌ LinkedIn analysis error:", data);
        return;
      }

      setAnalysis(data.analysis);
      toast.success("Analyse LinkedIn terminée !");
    } catch (error: any) {
      console.error("❌ Error analyzing LinkedIn profile:", error);
      toast.error("Erreur inattendue lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
              <Linkedin className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Analyse LinkedIn</h1>
              <p className="text-slate-600">
                Module SkillIA - Optimisez votre profil LinkedIn
              </p>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Votre profil LinkedIn</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Copiez-collez le texte de votre profil LinkedIn
              </label>
              <Textarea
                placeholder="Exemple: Développeur Full Stack passionné avec 3 ans d'expérience..."
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-slate-500 mt-2">
                💡 Astuce : Allez sur votre profil LinkedIn, copiez tout le
                texte (résumé, expériences, formations) et collez-le ici.
              </p>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={loading || !profileText.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Analyser mon profil
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Section */}
        {analysis && (
          <div className="space-y-6">
            {/* Score */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center size-24 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 text-white text-3xl font-bold mb-4">
                    {analysis.score}
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    Score de votre profil LinkedIn
                  </h3>
                  <p className="text-slate-600">
                    {analysis.score >= 85
                      ? "Excellent ! Votre profil est très bien optimisé."
                      : analysis.score >= 70
                      ? "Bon profil, mais quelques améliorations possibles."
                      : "Des améliorations significatives sont recommandées."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Strengths & Improvements */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="size-5" />
                    Points forts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.strengths.map((strength: string, idx: number) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <span className="text-green-600 mt-0.5">✓</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-700">
                    <AlertCircle className="size-5" />
                    À améliorer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {analysis.improvements.map(
                      (improvement: string, idx: number) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-slate-700"
                        >
                          <span className="text-orange-600 mt-0.5">!</span>
                          {improvement}
                        </li>
                      )
                    )}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Suggested Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Résumé suggéré</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <p className="text-sm text-slate-700 italic">
                    {analysis.suggestedSummary}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Suggested Skills */}
            <Card>
              <CardHeader>
                <CardTitle>Compétences suggérées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {analysis.suggestedSkills.map((skill: string, idx: number) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Roadmap */}
            <Card>
              <CardHeader>
                <CardTitle>Roadmap d'amélioration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analysis.roadmap.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-4 pb-4 border-b last:border-0"
                    >
                      <div className="flex-shrink-0 size-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                        {step.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900">
                            {step.title}
                          </h4>
                          <Badge
                            variant={
                              step.priority === "high"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {step.priority === "high"
                              ? "Priorité haute"
                              : "Priorité moyenne"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">
                          {step.description}
                        </p>
                      </div>
                      <ArrowRight className="size-5 text-slate-400 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!analysis && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Linkedin className="size-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Prêt à optimiser votre LinkedIn ?
              </h3>
              <p className="text-sm text-slate-500">
                Collez le texte de votre profil ci-dessus pour obtenir une
                analyse détaillée.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}