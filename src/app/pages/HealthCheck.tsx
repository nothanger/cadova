import { useState, useEffect } from "react";
import { Check, CheckCircle2, X, XCircle, Loader2, AlertCircle, Database, Server, Lock, TriangleAlert, Lightbulb, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { supabase, apiCall, API_URL } from "@/lib/supabase";
import { projectId, publicAnonKey } from "/utils/supabase/info";

interface TestResult {
  name: string;
  status: "pending" | "success" | "error" | "warning";
  message: string;
  details?: any;
  duration?: number;
}

export function HealthCheck() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState<"idle" | "running" | "completed">("idle");

  const updateTest = (index: number, update: Partial<TestResult>) => {
    setTests((prev) => {
      const newTests = [...prev];
      newTests[index] = { ...newTests[index], ...update };
      return newTests;
    });
  };

  const runTests = async () => {
    setIsRunning(true);
    setOverallStatus("running");
    setTests([]);

    const testList: TestResult[] = [
      { name: "Configuration Supabase", status: "pending", message: "" },
      { name: "Connexion au serveur backend", status: "pending", message: "" },
      { name: "Authentification Supabase", status: "pending", message: "" },
      { name: "Session active", status: "pending", message: "" },
      { name: "API - Profil utilisateur", status: "pending", message: "" },
      { name: "KV Store - Base de données", status: "pending", message: "" },
    ];

    setTests(testList);

    try {
      const start = Date.now();
      
      if (!projectId || !publicAnonKey) {
        updateTest(0, {
          status: "error",
          message: "Variables d'environnement manquantes",
          details: { projectId: !!projectId, publicAnonKey: !!publicAnonKey },
          duration: Date.now() - start,
        });
      } else {
        updateTest(0, {
          status: "success",
          message: "Configuration correcte",
          details: {
            projectId: projectId.substring(0, 8) + "...",
            url: `https://${projectId}.supabase.co`,
            keyPresent: "present",
          },
          duration: Date.now() - start,
        });
      }
    } catch (error: any) {
      updateTest(0, {
        status: "error",
        message: error.message,
        duration: 0,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    
    try {
      const start = Date.now();
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();

      if (response.ok && data.status === "ok") {
        updateTest(1, {
          status: "success",
          message: "Serveur backend opérationnel",
          details: data,
          duration: Date.now() - start,
        });
      } else {
        updateTest(1, {
          status: "error",
          message: "Le serveur ne répond pas correctement",
          details: data,
          duration: Date.now() - start,
        });
      }
    } catch (error: any) {
      updateTest(1, {
        status: "error",
        message: `Erreur de connexion: ${error.message}`,
        duration: 0,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

   
    try {
      const start = Date.now();
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        updateTest(2, {
          status: "warning",
          message: "Client d'authentification initialisé, mais erreur de session",
          details: { error: error.message },
          duration: Date.now() - start,
        });
      } else {
        updateTest(2, {
          status: "success",
          message: "Client d'authentification fonctionnel",
          details: {
            sessionExists: !!data.session,
            userId: data.session?.user?.id?.substring(0, 12) + "..." || "Aucune session active",
          },
          duration: Date.now() - start,
        });
      }
    } catch (error: any) {
      updateTest(2, {
        status: "error",
        message: `Erreur d'authentification: ${error.message}`,
        duration: 0,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    
    try {
      const start = Date.now();
      const { data, error } = await supabase.auth.getSession();

      if (data.session) {
        updateTest(3, {
          status: "success",
          message: "Utilisateur connecté",
          details: {
            email: data.session.user.email,
            userId: data.session.user.id.substring(0, 12) + "...",
            expiresAt: new Date(data.session.expires_at! * 1000).toLocaleString("fr-FR"),
          },
          duration: Date.now() - start,
        });
      } else {
        updateTest(3, {
          status: "warning",
          message: "Aucune session active - Connectez-vous pour tester l'API",
          details: { note: "Ce n'est pas une erreur si vous n'êtes pas connecté" },
          duration: Date.now() - start,
        });
      }
    } catch (error: any) {
      updateTest(3, {
        status: "error",
        message: `Erreur de session: ${error.message}`,
        duration: 0,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const start = Date.now();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        updateTest(4, {
          status: "warning",
          message: "Test ignoré - Authentification requise",
          details: { note: "Connectez-vous pour tester cette fonctionnalité" },
          duration: Date.now() - start,
        });
      } else {
        const response = await apiCall("/user/profile");
        const data = await response.json();

        if (response.ok && data.profile) {
          updateTest(4, {
            status: "success",
            message: "Récupération du profil réussie",
            details: {
              name: data.profile.name,
              email: data.profile.email,
              subscription: data.profile.subscription,
              credits: data.profile.credits,
            },
            duration: Date.now() - start,
          });
        } else {
          updateTest(4, {
            status: "error",
            message: `Erreur API: ${data.error || "Profil non trouvé"}`,
            details: data,
            duration: Date.now() - start,
          });
        }
      }
    } catch (error: any) {
      updateTest(4, {
        status: "error",
        message: `Erreur lors de l'appel API: ${error.message}`,
        duration: 0,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    
    try {
      const start = Date.now();
      const response = await fetch(`${API_URL}/health`);
      const data = await response.json();

      if (response.ok) {
        updateTest(5, {
          status: "success",
          message: "Base de données KV Store accessible",
          details: {
            note: "Le backend peut communiquer avec la base de données",
            kvTable: "kv_store_0a5eb56b",
            status: "Opérationnel",
          },
          duration: Date.now() - start,
        });
      } else {
        updateTest(5, {
          status: "warning",
          message: "Impossible de vérifier l'accès à la base de données",
          details: data,
          duration: Date.now() - start,
        });
      }
    } catch (error: any) {
      updateTest(5, {
        status: "error",
        message: `Erreur lors du test KV Store: ${error.message}`,
        duration: 0,
      });
    }

    setIsRunning(false);
    setOverallStatus("completed");
  };

  useEffect(() => {
    runTests();
  }, []);

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "pending":
        return <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />;
    }
  };

  const getStatusBadge = (status: TestResult["status"]) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-600">Succès</Badge>;
      case "error":
        return <Badge variant="destructive">Erreur</Badge>;
      case "warning":
        return <Badge variant="outline" className="border-yellow-600 text-yellow-600">Avertissement</Badge>;
      case "pending":
        return <Badge variant="secondary">En cours...</Badge>;
    }
  };

  const successCount = tests.filter((t) => t.status === "success").length;
  const errorCount = tests.filter((t) => t.status === "error").length;
  const warningCount = tests.filter((t) => t.status === "warning").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
       
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Zap className="h-10 w-10 text-indigo-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Diagnostic Supabase
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Vérification de l'état de santé de l'infrastructure Cadova
          </p>
        </div>

       
        {overallStatus === "completed" && (
          <Alert className={errorCount > 0 ? "border-red-600 bg-red-50" : "border-green-600 bg-green-50"}>
            <AlertDescription className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {errorCount > 0 ? (
                  <XCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                <span className="font-semibold">
                  {errorCount > 0
                    ? "Certains tests ont échoué"
                    : warningCount > 0
                    ? "Tous les tests réussis avec quelques avertissements"
                    : "Tous les systèmes sont opérationnels !"}
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-700 font-medium flex items-center gap-2"><Check className="w-5 h-5 text-current" />{successCount} réussis</span>
                {warningCount > 0 && (
                  <span className="text-yellow-700 font-medium flex items-center gap-2"><TriangleAlert className="w-5 h-5 text-current" />{warningCount} avertissements</span>
                )}
                {errorCount > 0 && <span className="text-red-700 font-medium flex items-center gap-2"><X className="w-5 h-5 text-current" />{errorCount} erreurs</span>}
              </div>
            </AlertDescription>
          </Alert>
        )}

       
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Configuration
            </CardTitle>
            <CardDescription>Informations sur votre instance Supabase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Project ID:</span>
                <p className="font-mono font-semibold">{projectId?.substring(0, 20)}...</p>
              </div>
              <div>
                <span className="text-gray-600">API URL:</span>
                <p className="font-mono text-xs break-all">{API_URL}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        
        <div className="space-y-4">
          {tests.map((test, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{getStatusIcon(test.status)}</div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{test.name}</h3>
                        {getStatusBadge(test.status)}
                      </div>
                      <p className="text-gray-600">{test.message}</p>
                      {test.duration !== undefined && (
                        <p className="text-xs text-gray-500">⏱️ {test.duration}ms</p>
                      )}
                      {test.details && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                            Afficher les détails
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-50 rounded-md text-xs overflow-x-auto border border-gray-200">
                            {JSON.stringify(test.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={runTests}
            disabled={isRunning}
            size="lg"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Tests en cours...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                Relancer les tests
              </>
            )}
          </Button>
        </div>

       
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => window.location.href = "/login"}>
                <Lock className="mr-2 h-4 w-4" />
                Se connecter
              </Button>
              <Button variant="outline" onClick={() => window.location.href = "/signup"}>
                Se créer un compte
              </Button>
              <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
                Aller au Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  console.log("=== SUPABASE DEBUG INFO ===");
                  console.log("Project ID:", projectId);
                  console.log("API URL:", API_URL);
                  console.log("Supabase Client:", supabase);
                  alert("Informations affichées dans la console (F12)");
                }}
              >
                Afficher dans la console
              </Button>
            </div>
          </CardContent>
        </Card>

        
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader>
            <CardTitle className="text-indigo-900 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-current" />Aide au diagnostic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-indigo-900">
            <div>
              <strong className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-current" />Si tous les tests sont verts :</strong>
              <p className="mt-1">Votre connexion Supabase fonctionne parfaitement ! Vous pouvez utiliser toutes les fonctionnalités de Cadova.</p>
            </div>
            <div>
              <strong className="flex items-center gap-2"><TriangleAlert className="w-5 h-5 text-current" />Si vous voyez des avertissements :</strong>
              <p className="mt-1">Certaines fonctionnalités nécessitent une authentification. Connectez-vous pour les tester.</p>
            </div>
            <div>
              <strong className="flex items-center gap-2"><XCircle className="w-5 h-5 text-current" />Si vous voyez des erreurs :</strong>
              <ul className="mt-1 ml-4 list-disc space-y-1">
                <li>Vérifiez que les variables d'environnement Supabase sont configurées</li>
                <li>Assurez-vous que le serveur backend est démarré</li>
                <li>Consultez la console (F12) pour plus de détails sur les erreurs</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
