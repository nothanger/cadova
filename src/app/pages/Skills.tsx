import { AppLayout } from "../components/AppLayout";
import { useState } from "react";
import { useSEO } from "../hooks/useSEO";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { apiCall } from "@/lib/supabase";
import { toast } from "sonner";
import { Award, BookOpen, Briefcase, Handshake, Lightbulb, Loader2, Target, TrendingUp, Zap } from "lucide-react";

export function Skills() {
  useSEO({ title: "Compétences SkillIA — Cadova", noindex: true });
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);

  const handleGetSuggestions = async () => {
    if (!jobTitle.trim()) {
      toast.error("Veuillez entrer un titre de poste");
      return;
    }

    setLoading(true);

    try {
      const response = await apiCall("/skillia/skill-suggestions", {
        method: "POST",
        body: JSON.stringify({ jobTitle }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erreur lors de la récupération des suggestions");
        console.error("❌ Skill suggestions error:", data);
        return;
      }

      setSuggestions(data.suggestions);
      toast.success("Suggestions de compétences générées !");
    } catch (error: any) {
      console.error("❌ Error getting skill suggestions:", error);
      toast.error("Erreur inattendue");
    } finally {
      setLoading(false);
    }
  };

  const popularJobs = [
    "Développeur Full Stack",
    "Data Analyst",
    "Chef de projet",
    "Marketing Digital",
    "Designer UX/UI",
    "Commercial B2B",
  ];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-gradient-to-br from-amber-600 to-orange-600 flex items-center justify-center">
              <Lightbulb className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Suggestions de compétences</h1>
              <p className="text-slate-600">
                Module SkillIA - Découvrez les compétences clés pour votre
                métier
              </p>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Quel métier visez-vous ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Titre du poste
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Développeur Web, Data Scientist, Chef de projet..."
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleGetSuggestions();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleGetSuggestions}
                  disabled={loading || !jobTitle.trim()}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      <Target className="mr-2 h-4 w-4" />
                      Analyser
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Popular Jobs */}
            <div>
              <p className="text-sm text-slate-600 mb-2 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-gray-500" />
                Métiers populaires :
              </p>
              <div className="flex flex-wrap gap-2">
                {popularJobs.map((job) => (
                  <Button
                    key={job}
                    variant="outline"
                    size="sm"
                    onClick={() => setJobTitle(job)}
                    className="text-xs"
                  >
                    {job}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {suggestions && (
          <div className="space-y-6">
            {/* Essential Skills */}
            <Card className="border-2 border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-800">
                  <Zap className="size-5" />
                  Compétences essentielles
                </CardTitle>
                <p className="text-sm text-red-700">
                  Ces compétences sont indispensables pour le poste de{" "}
                  <strong>{jobTitle}</strong>
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {suggestions.essentialSkills.map(
                    (skill: string, idx: number) => (
                      <Badge
                        key={idx}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 text-sm"
                      >
                        <Zap className="size-3 mr-1.5" />
                        {skill}
                      </Badge>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recommended Skills */}
            <Card className="border-2 border-blue-200 bg-blue-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <TrendingUp className="size-5" />
                  Compétences recommandées
                </CardTitle>
                <p className="text-sm text-blue-700">
                  Ces compétences augmenteront significativement vos chances
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {suggestions.recommendedSkills.map(
                    (skill: string, idx: number) => (
                      <Badge
                        key={idx}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm"
                      >
                        <TrendingUp className="size-3 mr-1.5" />
                        {skill}
                      </Badge>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bonus Skills */}
            <Card className="border-2 border-green-200 bg-green-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Lightbulb className="size-5" />
                  Compétences bonus
                </CardTitle>
                <p className="text-sm text-green-700">
                  Ces compétences vous démarqueront des autres candidats
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {suggestions.bonusSkills.map((skill: string, idx: number) => (
                    <Badge
                      key={idx}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 text-sm"
                    >
                      <Lightbulb className="size-3 mr-1.5" />
                      {skill}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Action Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Comment développer ces compétences ?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <BookOpen className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold mb-1">Formations en ligne</h4>
                      <p className="text-slate-600">
                        Udemy, Coursera, OpenClassrooms, LinkedIn Learning
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <Briefcase className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold mb-1">Projets personnels</h4>
                      <p className="text-slate-600">
                        Créez un portfolio avec des projets concrets
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <Award className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold mb-1">Certifications</h4>
                      <p className="text-slate-600">
                        Obtenez des certifications reconnues dans votre domaine
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <Handshake className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold mb-1">Networking</h4>
                      <p className="text-slate-600">
                        Participez à des événements et rejoignez des communautés
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!suggestions && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="size-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Découvrez les compétences clés
              </h3>
              <p className="text-sm text-slate-500">
                Entrez un titre de poste ci-dessus pour obtenir des suggestions
                personnalisées.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
