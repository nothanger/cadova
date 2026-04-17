import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, Copy, Download, PenTool, RefreshCw, Save, Wand2 } from "lucide-react";
import { AppLayout } from "../components/AppLayout";
import { LoadingScreen } from "../components/LoadingScreen";
import { useSEO } from "../hooks/useSEO";
import { buildCoverLetter, CandidatureType, LetterTone, SectorId, SECTORS } from "../lib/reussia-data";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
import { useAuth } from "@/contexts/AuthContext";
import { saveCoverLetter } from "@/lib/localStorage";
import { toast } from "sonner";
import { coverLetterTemplates, getCoverLetterTemplate } from "../lib/document-templates";

const tones: Array<{ value: LetterTone; label: string }> = [
  { value: "professionnel", label: "Professionnel" },
  { value: "dynamique", label: "Dynamique" },
  { value: "formel", label: "Formel" },
  { value: "creatif", label: "Creatif" },
];

const types: Array<{ value: CandidatureType; label: string }> = [
  { value: "stage", label: "Stage" },
  { value: "alternance", label: "Alternance" },
  { value: "emploi", label: "Emploi" },
  { value: "parcoursup", label: "Formation" },
];

export function CoverLetter() {
  useSEO({ title: "Lettre de motivation - Cadova", noindex: false });
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [city, setCity] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [formation, setFormation] = useState("");
  const [strengths, setStrengths] = useState("");
  const [motivation, setMotivation] = useState("");
  const [sector, setSector] = useState<SectorId>("marketing");
  const [type, setType] = useState<CandidatureType>("stage");
  const [tone, setTone] = useState<LetterTone>("professionnel");
  const [content, setContent] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("formal");
  const selectedTemplate = getCoverLetterTemplate(selectedTemplateId);

  const canGenerate = companyName.trim().length > 1 && jobTitle.trim().length > 1;

  const draft = useMemo(
    () =>
      buildCoverLetter({
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
      }),
    [city, companyName, firstName, formation, jobTitle, motivation, sector, strengths, tone, type]
  );

  const saveCurrentLetter = () => {
    if (!user?.id || !content.trim()) return;

    saveCoverLetter({
      userId: user.id,
      title: `${companyName || "Lettre"} - ${jobTitle || "Candidature"}`,
      company: companyName,
      position: jobTitle,
      content,
      templateId: selectedTemplateId,
    });
    toast.success("Lettre enregistree dans ton dashboard.");
  };

  const handleGenerate = () => {
    if (!canGenerate) {
      toast.error("Ajoute au moins une entreprise et un poste cible.");
      return;
    }
    setIsGenerating(true);
  };

  const handleGenerateComplete = () => {
    setContent(draft);
    setGenerated(true);
    setIsGenerating(false);
    if (user?.id) {
      saveCoverLetter({
        userId: user.id,
        title: `${companyName} - ${jobTitle}`,
        company: companyName,
        position: jobTitle,
        content: draft,
        templateId: selectedTemplateId,
      });
    }
    toast.success("Lettre generee et sauvegardee.");
  };

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    toast.success("Lettre copiee.");
  };

  const handlePrint = () => {
    if (!content) return;
    const template = selectedTemplate;
    const fontFamily = template.layoutVariant === "student" ? "Trebuchet MS, Arial" : template.layoutVariant === "modern" ? "Inter, Arial" : "Georgia";
    const headerHtml = template.layoutVariant === "formal"
      ? ""
      : `<div style="border-bottom:2px solid ${template.accentColor};padding-bottom:18px;margin-bottom:26px"><strong style="font-size:22px;color:#111827">${firstName || "Candidat"}</strong><div style="margin-top:4px;color:${template.accentColor};font-weight:700">${jobTitle || "Candidature"}</div></div>`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Lettre</title><style>body{font-family:${fontFamily},serif;max-width:760px;margin:48px auto;line-height:1.8;color:#1f2937;padding:0 24px;background:#fff}pre{white-space:pre-wrap;font-family:${fontFamily},serif;font-size:14px}.page{border:${template.layoutVariant === "student" ? "1px solid #ede9fe" : "0"};padding:${template.layoutVariant === "student" ? "28px" : "0"};border-radius:18px}</style></head><body><main class="page">${headerHtml}<pre>${content}</pre></main></body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <AppLayout>
      {isGenerating ? (
        <LoadingScreen
          label="Lettre de motivation"
          accent="#6b55f7"
          steps={[
            { label: "Analyse du contexte", duration: 450 },
            { label: "Choix du ton", duration: 350 },
            { label: "Redaction des paragraphes", duration: 700 },
            { label: "Mise en forme", duration: 400 },
          ]}
          onComplete={handleGenerateComplete}
        />
      ) : null}

      <div className="max-w-6xl mx-auto grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="size-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
                <PenTool className="size-5 text-white" />
              </span>
              Lettre de motivation
            </h1>
            <p className="text-slate-600 mt-2">Genere, modifie et sauvegarde une lettre a partir de ton contexte.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Choisis un modèle de lettre</CardTitle>
              <p className="text-sm text-slate-500">Le style choisi sera utilisé dans l'aperçu et dans le PDF.</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {coverLetterTemplates.map((template) => {
                  const selected = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`rounded-2xl border bg-white p-3 text-left transition-all ${
                        selected ? "border-violet-500 shadow-lg shadow-violet-100" : "border-slate-200 hover:border-violet-200 hover:shadow-md"
                      }`}
                    >
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="h-2 w-20 rounded-full" style={{ background: template.accentColor }} />
                        <div className="mt-4 space-y-2">
                          <div className="h-1.5 w-full rounded-full bg-slate-300" />
                          <div className="h-1.5 w-10/12 rounded-full bg-slate-200" />
                          <div className="h-1.5 w-8/12 rounded-full bg-slate-200" />
                        </div>
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-950">{template.name}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{template.description}</p>
                        </div>
                        {selected ? <CheckCircle className="size-4 shrink-0 text-violet-600" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informations de base</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prenom</Label>
                  <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Marie" />
                </div>
                <div className="space-y-2">
                  <Label>Ville</Label>
                  <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Paris" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Entreprise</Label>
                <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Entreprise ou ecole ciblee" />
              </div>

              <div className="space-y-2">
                <Label>Poste ou formation</Label>
                <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Alternance marketing, Bachelor design..." />
              </div>

              <div className="space-y-2">
                <Label>Formation actuelle</Label>
                <Input value={formation} onChange={(event) => setFormation(event.target.value)} placeholder="Licence, BTS, Master..." />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(value) => setType(value as CandidatureType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Secteur</Label>
                  <Select value={sector} onValueChange={(value) => setSector(value as SectorId)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ton</Label>
                  <Select value={tone} onValueChange={(value) => setTone(value as LetterTone)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tones.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Points forts</Label>
                <Input value={strengths} onChange={(event) => setStrengths(event.target.value)} placeholder="Organisation, relation client, rigueur..." />
              </div>

              <div className="space-y-2">
                <Label>Pourquoi cette structure ?</Label>
                <Textarea value={motivation} onChange={(event) => setMotivation(event.target.value)} rows={4} placeholder="Ce qui t'attire dans cette entreprise ou cette ecole." />
              </div>

              <Button onClick={handleGenerate} className="gap-2 bg-violet-600 hover:bg-violet-700">
                <Wand2 className="size-4" />
                Generer la lettre
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <AnimatePresence mode="wait">
            {generated ? (
              <motion.div key="preview" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle>Version editable</CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => setContent(draft)} className="gap-1">
                          <RefreshCw className="size-3.5" />
                          Regenerer
                        </Button>
                        <Button variant="outline" size="sm" onClick={saveCurrentLetter} className="gap-1">
                          <Save className="size-3.5" />
                          Sauvegarder
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1">
                          <Copy className="size-3.5" />
                          Copier
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1">
                          <Download className="size-3.5" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea value={content} onChange={(event) => setContent(event.target.value)} rows={28} className="resize-none" />
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-950">Aperçu : {selectedTemplate.name}</p>
                          <p className="text-xs text-slate-500">{selectedTemplate.description}</p>
                        </div>
                        <span className="h-2 w-16 rounded-full" style={{ background: selectedTemplate.accentColor }} />
                      </div>
                      <div className="rounded-xl bg-white p-5 text-sm leading-7 text-slate-700 shadow-sm">
                        {selectedTemplate.layoutVariant !== "formal" ? (
                          <div className="mb-4 border-b pb-3" style={{ borderColor: `${selectedTemplate.accentColor}44` }}>
                            <strong className="text-base text-slate-950">{firstName || "Candidat"}</strong>
                            <p className="mt-1 font-semibold" style={{ color: selectedTemplate.accentColor }}>
                              {jobTitle || "Candidature"}
                            </p>
                          </div>
                        ) : null}
                        <div className="whitespace-pre-wrap">{content}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card>
                  <CardContent className="py-16 text-center">
                    <PenTool className="size-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">La lettre apparaitra ici</h3>
                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                      Une fois generee, elle sera editable et automatiquement visible dans ton dashboard apres sauvegarde.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AppLayout>
  );
}
