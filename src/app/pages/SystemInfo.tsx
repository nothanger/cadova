import { CheckCircle2, Info, Database, Cloud, ShieldCheck, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";

export function SystemInfo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
<div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Info className="h-10 w-10 text-indigo-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Architecture Système
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Comment Cadova protège vos données
          </p>
        </div>
<Alert className="border-green-600 bg-green-50">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <AlertTitle className="text-green-900">Authentification Sécurisée Active</AlertTitle>
          <AlertDescription className="text-green-800">
            Cadova utilise <strong>Supabase Auth</strong> pour sécuriser votre compte. Vos mots de passe sont chiffrés et vos sessions protégées par des tokens JWT.
          </AlertDescription>
        </Alert>
<div className="grid md:grid-cols-2 gap-6">
<Card className="border-2 border-green-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-600" />
                  Authentification
                </CardTitle>
                <Badge className="bg-green-600">Supabase Auth</Badge>
              </div>
              <CardDescription>Sécurité de niveau professionnel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-green-900">Ce qui est sécurisé</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• Mots de passe <strong>hashés</strong> (jamais stockés en clair)</li>
                  <li>• Sessions protégées par <strong>tokens JWT</strong></li>
                  <li>• Tokens avec <strong>expiration automatique</strong></li>
                  <li>• Rafraîchissement de session sécurisé</li>
                  <li>• Protection contre les attaques brute-force</li>
                </ul>
              </div>
            </CardContent>
          </Card>
<Card className="border-2 border-indigo-600">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-indigo-600" />
                  Données
                </CardTitle>
                <Badge className="bg-indigo-600">Serveur Cloud</Badge>
              </div>
              <CardDescription>Stockées sur un serveur sécurisé</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-indigo-900">Avantages</h4>
                <ul className="text-sm space-y-1 text-gray-700">
                  <li>• Données <strong>persistantes</strong> (jamais perdues)</li>
                  <li>• Accessibles depuis <strong>n'importe quel appareil</strong></li>
                  <li>• Backup automatique</li>
                  <li>• Isolation par utilisateur</li>
                  <li>• Accès protégé par authentification</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
<Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Comment ça fonctionne ?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Inscription sécurisée</h4>
                  <p className="text-gray-600">
                    Quand vous créez un compte, votre mot de passe est <strong>hashé</strong> (transformé en code illisible) avant d'être stocké. Personne ne peut le lire, même nous.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Connexion avec token JWT</h4>
                  <p className="text-gray-600">
                    Quand vous vous connectez, le serveur vérifie votre mot de passe et vous donne un <strong>badge temporaire</strong> (token JWT). Ce badge prouve votre identité sans renvoyer votre mot de passe.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Accès aux données</h4>
                  <p className="text-gray-600">
                    Chaque requête à l'API envoie votre token. Le serveur vérifie qu'il est valide avant de donner accès à <strong>vos données uniquement</strong>.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
<Alert className="border-blue-600 bg-blue-50">
          <Cloud className="h-5 w-5 text-blue-600" />
          <AlertTitle className="text-blue-900">Infrastructure Cloud</AlertTitle>
          <AlertDescription className="text-blue-800">
            Cadova utilise <strong>Supabase</strong> (basé sur PostgreSQL) pour l'authentification et le stockage des données. 
            C'est la même technologie utilisée par des milliers d'applications professionnelles.
          </AlertDescription>
        </Alert>
<Card>
          <CardHeader>
            <CardTitle>Données Stockées</CardTitle>
            <CardDescription>Voici ce qui est enregistré de manière sécurisée</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-indigo-50 rounded-lg">
                <div className="font-semibold text-indigo-900">Profil</div>
                <div className="text-gray-600 text-xs">Nom, email, abonnement</div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <div className="font-semibold text-indigo-900">CVs</div>
                <div className="text-gray-600 text-xs">Vos CV générés</div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <div className="font-semibold text-indigo-900">Lettres</div>
                <div className="text-gray-600 text-xs">Lettres de motivation</div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <div className="font-semibold text-indigo-900">Analyses ATS</div>
                <div className="text-gray-600 text-xs">Résultats d'analyses</div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <div className="font-semibold text-indigo-900">Candidatures</div>
                <div className="text-gray-600 text-xs">Suivi des applications</div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg">
                <div className="font-semibold text-indigo-900">LinkedIn</div>
                <div className="text-gray-600 text-xs">Analyses de profil</div>
              </div>
            </div>
          </CardContent>
        </Card>
<Card>
          <CardHeader>
            <CardTitle>Questions Fréquentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900">Mon mot de passe est-il sécurisé ?</h4>
              <p className="text-gray-600">
                Oui ! Il est hashé avec bcrypt avant d'être stocké. Même en cas de fuite de données, personne ne peut retrouver votre mot de passe.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Puis-je accéder à mon compte depuis un autre appareil ?</h4>
              <p className="text-gray-600">
                Oui ! Vos données sont sur le cloud. Connectez-vous avec le même email et mot de passe depuis n'importe quel navigateur.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Que se passe-t-il si ma session expire ?</h4>
              <p className="text-gray-600">
                Votre session est automatiquement rafraîchie. Si elle expire complètement, il vous suffit de vous reconnecter.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">Comment supprimer mon compte ?</h4>
              <p className="text-gray-600">
                Contactez-nous pour demander la suppression de votre compte et de toutes vos données.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
