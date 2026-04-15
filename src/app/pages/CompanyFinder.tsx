import { AppLayout } from "../components/AppLayout";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSEO } from "../hooks/useSEO";
import {
  MapPin,
  Building2,
  Users,
  GraduationCap,
  Briefcase,
  Star,
  ExternalLink,
  Filter,
  Search,
  Navigation,
  ChevronDown,
  X,
  Globe,
  Phone,
  Mail,
} from "lucide-react";
import L from "leaflet";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { saveApplication } from "@/lib/localStorage";

// ── Types ──────────────────────────────────────────────────────────

type CompanyType = "stage" | "emploi" | "both";
type Sector =
  | "tech"
  | "marketing"
  | "finance"
  | "sante"
  | "commerce"
  | "industrie"
  | "education"
  | "design";

interface Company {
  id: string;
  name: string;
  type: CompanyType;
  sector: Sector;
  address: string;
  city: string;
  lat: number;
  lng: number;
  rating: number;
  stageCount?: number;
  emploiCount?: number;
  description: string;
  logo: string;
  website: string;
  phone: string;
  email: string;
  tags: string[];
}

// ── Mock Data ──────────────────────────────────────────────────────

const SECTORS_LABELS: Record<Sector, string> = {
  tech: "Tech & IT",
  marketing: "Marketing",
  finance: "Finance",
  sante: "Sante",
  commerce: "Commerce",
  industrie: "Industrie",
  education: "Education",
  design: "Design & Creatif",
};

const SECTOR_COLORS: Record<Sector, string> = {
  tech: "bg-blue-100 text-blue-700",
  marketing: "bg-pink-100 text-pink-700",
  finance: "bg-emerald-100 text-emerald-700",
  sante: "bg-red-100 text-red-700",
  commerce: "bg-amber-100 text-amber-700",
  industrie: "bg-slate-100 text-slate-700",
  education: "bg-violet-100 text-violet-700",
  design: "bg-orange-100 text-orange-700",
};

const MOCK_COMPANIES: Company[] = [
  // ── PONT-À-MOUSSON & ENVIRONS ──────────────────────────────────
  {
    id: "pam1",
    name: "Saint-Gobain PAM",
    type: "both",
    sector: "industrie",
    address: "2 Rue Auguste Chouet",
    city: "Pont-à-Mousson",
    lat: 48.9043,
    lng: 6.0555,
    rating: 4.4,
    stageCount: 30,
    emploiCount: 15,
    description: "Leader mondial de la fonte ductile. Nombreux stages en ingénierie industrielle, logistique et qualité.",
    logo: "SG",
    website: "saint-gobain-pam.com",
    phone: "03 83 81 40 00",
    email: "rh@saint-gobain-pam.com",
    tags: ["Industrie", "Ingénierie", "Qualité", "Alternance", "Stage PFE"],
  },
  {
    id: "pam2",
    name: "Veolia Eau Lorraine",
    type: "both",
    sector: "industrie",
    address: "15 Rue de la Moselle",
    city: "Pont-à-Mousson",
    lat: 48.9061,
    lng: 6.0541,
    rating: 4.1,
    stageCount: 12,
    emploiCount: 8,
    description: "Gestion de l'eau et services environnementaux. Recrutements en maintenance et gestion.",
    logo: "VE",
    website: "veolia.fr",
    phone: "03 83 81 22 00",
    email: "recrutement-lorraine@veolia.com",
    tags: ["Environnement", "Maintenance", "Gestion", "CDI"],
  },
  {
    id: "pam3",
    name: "Hôpital de Pont-à-Mousson",
    type: "stage",
    sector: "sante",
    address: "1 Avenue du Dr Schweitzer",
    city: "Pont-à-Mousson",
    lat: 48.9015,
    lng: 6.0602,
    rating: 3.9,
    stageCount: 20,
    description: "Centre hospitalier accueillant des stagiaires en soins infirmiers, administration et imagerie médicale.",
    logo: "HM",
    website: "chic-unisante.fr",
    phone: "03 83 81 60 00",
    email: "stages@ch-pam.fr",
    tags: ["Médical", "Infirmier", "Administration", "Stage 3e"],
  },
  {
    id: "pam4",
    name: "CCI Grand Nancy – Antenne PAM",
    type: "both",
    sector: "commerce",
    address: "8 Place Duroc",
    city: "Pont-à-Mousson",
    lat: 48.9032,
    lng: 6.0568,
    rating: 4.0,
    stageCount: 8,
    emploiCount: 5,
    description: "Chambre de commerce accompagnant les entreprises locales. Stages en développement économique.",
    logo: "CCI",
    website: "cci-grandnancy.fr",
    phone: "03 83 81 20 00",
    email: "stages@cci-gn.fr",
    tags: ["Commerce", "Développement économique", "Stage"],
  },
  {
    id: "pam5",
    name: "Mairie de Pont-à-Mousson",
    type: "stage",
    sector: "education",
    address: "Hôtel de Ville, Place Duroc",
    city: "Pont-à-Mousson",
    lat: 48.9048,
    lng: 6.0512,
    rating: 3.8,
    stageCount: 10,
    description: "Administration communale. Stages en communication, urbanisme et services aux citoyens.",
    logo: "MP",
    website: "ville-pont-a-mousson.fr",
    phone: "03 83 81 02 15",
    email: "stages@mairie-pam.fr",
    tags: ["Administration", "Communication", "Urbanisme", "Stage 3e"],
  },
  {
    id: "pam6",
    name: "Lesaffre – Site PAM",
    type: "both",
    sector: "industrie",
    address: "Route de Norroy-lès-Pont-à-Mousson",
    city: "Pont-à-Mousson",
    lat: 48.9098,
    lng: 6.0489,
    rating: 4.2,
    stageCount: 10,
    emploiCount: 6,
    description: "Groupe agroalimentaire spécialisé en levures et fermentation. Stages en biologie, chimie, production.",
    logo: "LS",
    website: "lesaffre.com",
    phone: "03 83 81 55 00",
    email: "rh-pam@lesaffre.fr",
    tags: ["Agroalimentaire", "Biologie", "Production", "Alternance"],
  },
  {
    id: "pam7",
    name: "Crédit Agricole – Agence PAM",
    type: "both",
    sector: "finance",
    address: "12 Place Duroc",
    city: "Pont-à-Mousson",
    lat: 48.9038,
    lng: 6.0537,
    rating: 4.0,
    stageCount: 6,
    emploiCount: 4,
    description: "Banque régionale de référence en Lorraine. Stages et emplois en conseil financier.",
    logo: "CA",
    website: "ca-lorraine.fr",
    phone: "03 83 81 10 00",
    email: "recrutement@ca-lorraine.fr",
    tags: ["Banque", "Finance", "Conseil", "Alternance"],
  },
  {
    id: "pam8",
    name: "Moselle Digital Agency",
    type: "both",
    sector: "tech",
    address: "5 Rue de la République",
    city: "Pont-à-Mousson",
    lat: 48.9055,
    lng: 6.0590,
    rating: 4.3,
    stageCount: 8,
    emploiCount: 3,
    description: "Agence web et marketing digital locale. Stages en développement, SEO et design.",
    logo: "MD",
    website: "moselle-digital.fr",
    phone: "03 83 80 14 20",
    email: "stages@moselle-digital.fr",
    tags: ["Développement web", "SEO", "Design", "Stage"],
  },
  {
    id: "pam9",
    name: "Norroy Logistique Services",
    type: "emploi",
    sector: "commerce",
    address: "Zone d'activité de Norroy-lès-PAM",
    city: "Norroy-lès-Pont-à-Mousson",
    lat: 48.9195,
    lng: 6.0341,
    rating: 3.8,
    emploiCount: 12,
    description: "Entreprise logistique locale. Recrutements en chauffeur-livreur, manutention et gestion de stock.",
    logo: "NL",
    website: "norroy-logistique.fr",
    phone: "03 83 81 77 00",
    email: "rh@norroy-logistique.fr",
    tags: ["Logistique", "Manutention", "Gestion stock", "CDI"],
  },
  {
    id: "pam10",
    name: "Réseau GRT Gaz PAM",
    type: "both",
    sector: "industrie",
    address: "Route Nationale, Dieulouard",
    city: "Dieulouard",
    lat: 48.8379,
    lng: 6.0676,
    rating: 4.2,
    stageCount: 8,
    emploiCount: 5,
    description: "Gestionnaire du réseau de transport de gaz. Stages et emplois en maintenance industrielle.",
    logo: "GRT",
    website: "grtgaz.com",
    phone: "03 83 81 93 00",
    email: "recrutement@grtgaz.com",
    tags: ["Énergie", "Maintenance", "Industrie", "CDI"],
  },
  {
    id: "pam11",
    name: "Euralux PAM Commerce",
    type: "both",
    sector: "commerce",
    address: "Zone commerciale Sud",
    city: "Pont-à-Mousson",
    lat: 48.8971,
    lng: 6.0613,
    rating: 3.9,
    stageCount: 6,
    emploiCount: 8,
    description: "Centre commercial régional. Stages et emplois en vente, caisse, merchandising et management.",
    logo: "EU",
    website: "euralux.fr",
    phone: "03 83 82 11 00",
    email: "rh@euralux-pam.fr",
    tags: ["Commerce", "Vente", "Merchandising", "CDD"],
  },
  {
    id: "pam12",
    name: "EDF – Centrale de Pompey",
    type: "both",
    sector: "industrie",
    address: "Rue du Barrage",
    city: "Pompey",
    lat: 48.7763,
    lng: 6.1256,
    rating: 4.3,
    stageCount: 15,
    emploiCount: 8,
    description: "Site EDF en bord de Moselle. Stages et emplois en électrotechnique et maintenance industrielle.",
    logo: "EDF",
    website: "edf.fr",
    phone: "03 83 49 80 00",
    email: "recrutement-pompey@edf.fr",
    tags: ["Énergie", "Électrotechnique", "Maintenance", "Alternance"],
  },
  {
    id: "pam13",
    name: "Cabinet Notarial Maître Leroux",
    type: "stage",
    sector: "finance",
    address: "3 Rue Gambetta",
    city: "Pont-à-Mousson",
    lat: 48.9025,
    lng: 6.0549,
    rating: 4.0,
    stageCount: 3,
    description: "Cabinet notarial en centre-ville. Stages en droit immobilier, droit des successions et secrétariat juridique.",
    logo: "NR",
    website: "notaire-pam.fr",
    phone: "03 83 81 05 12",
    email: "contact@notaire-pam.fr",
    tags: ["Droit", "Notariat", "Secrétariat juridique", "Stage"],
  },
  // ── NANCY ──────────────────────────────────────────────────────
  {
    id: "nan1",
    name: "Université de Lorraine",
    type: "stage",
    sector: "education",
    address: "34 Cours Léopold",
    city: "Nancy",
    lat: 48.6921,
    lng: 6.1844,
    rating: 4.3,
    stageCount: 50,
    description: "Grande université lorraine. Stages en recherche, administration et pédagogie.",
    logo: "UL",
    website: "univ-lorraine.fr",
    phone: "03 72 74 00 00",
    email: "stages@univ-lorraine.fr",
    tags: ["Recherche", "Pédagogie", "Administration", "Stage"],
  },
  {
    id: "nan2",
    name: "Altran Lorraine (Capgemini)",
    type: "emploi",
    sector: "tech",
    address: "22 Rue Baron Louis",
    city: "Nancy",
    lat: 48.6898,
    lng: 6.1785,
    rating: 4.2,
    emploiCount: 25,
    description: "Conseil en ingénierie et technologie. Recrute des jeunes ingénieurs.",
    logo: "AL",
    website: "capgemini.com",
    phone: "03 83 95 67 00",
    email: "recrutement-nancy@capgemini.com",
    tags: ["Ingénierie", "Conseil IT", "CDI", "Premier emploi"],
  },
  {
    id: "nan3",
    name: "CHRU de Nancy",
    type: "both",
    sector: "sante",
    address: "29 Avenue du Maréchal de Lattre",
    city: "Nancy",
    lat: 48.6834,
    lng: 6.2012,
    rating: 4.4,
    stageCount: 60,
    emploiCount: 30,
    description: "Centre hospitalier universitaire régional. Nombreuses opportunités en médecine et gestion hospitalière.",
    logo: "CHU",
    website: "chu-nancy.fr",
    phone: "03 83 85 85 85",
    email: "recrutement@chru-nancy.fr",
    tags: ["Médecine", "Soins infirmiers", "Gestion hospitalière", "Alternance"],
  },
  {
    id: "nan4",
    name: "Enedis Nancy",
    type: "both",
    sector: "industrie",
    address: "9 Rue des États",
    city: "Nancy",
    lat: 48.6941,
    lng: 6.1901,
    rating: 4.1,
    stageCount: 20,
    emploiCount: 12,
    description: "Gestionnaire du réseau électrique. Stages et emplois en électrotechnique, maintenance et travaux.",
    logo: "EN",
    website: "enedis.fr",
    phone: "09 72 67 50 54",
    email: "recrutement-nancy@enedis.fr",
    tags: ["Électrotechnique", "Maintenance", "Travaux", "Alternance"],
  },
  {
    id: "nan5",
    name: "Accenture Nancy",
    type: "emploi",
    sector: "tech",
    address: "5 Rue des Carmelites",
    city: "Nancy",
    lat: 48.6872,
    lng: 6.1798,
    rating: 4.5,
    emploiCount: 18,
    description: "Cabinet de conseil en technologie. Recrute des profils tech et business pour le site lorrain.",
    logo: "ACC",
    website: "accenture.com",
    phone: "03 83 44 55 66",
    email: "recrutement-nancy@accenture.com",
    tags: ["Consulting", "Digital", "CDI", "Premier emploi", "Tech"],
  },
  {
    id: "nan6",
    name: "LeroyMerlin Nancy",
    type: "both",
    sector: "commerce",
    address: "2 Rue du Faubourg Stanislas",
    city: "Nancy",
    lat: 48.6812,
    lng: 6.1744,
    rating: 4.0,
    stageCount: 15,
    emploiCount: 20,
    description: "Enseigne de bricolage et décoration. Opportunités pour jeunes en commerce, logistique et vente.",
    logo: "LM",
    website: "leroymerlin.fr",
    phone: "03 83 28 40 00",
    email: "rh-nancy@leroymerlin.fr",
    tags: ["Commerce", "Vente", "Logistique", "Alternance", "CDD"],
  },
  {
    id: "nan7",
    name: "BNP Paribas Nancy",
    type: "both",
    sector: "finance",
    address: "12 Place Stanislas",
    city: "Nancy",
    lat: 48.6937,
    lng: 6.1817,
    rating: 4.1,
    stageCount: 10,
    emploiCount: 8,
    description: "Agence bancaire principale de Nancy. Stages et emplois en finance et gestion de patrimoine.",
    logo: "BNP",
    website: "bnpparibas.com",
    phone: "03 83 17 45 00",
    email: "recrutement-nancy@bnpparibas.com",
    tags: ["Banque", "Finance", "Patrimoine", "Alternance"],
  },
  {
    id: "nan8",
    name: "Idéo Technologies",
    type: "both",
    sector: "tech",
    address: "6 Allée de la Forêt de la Reine",
    city: "Nancy",
    lat: 48.6789,
    lng: 6.1623,
    rating: 4.4,
    stageCount: 12,
    emploiCount: 7,
    description: "Startup locale spécialisée en développement logiciel et applications mobiles. Ambiance startup, équipe jeune.",
    logo: "IT",
    website: "ideo-technologies.fr",
    phone: "03 54 50 30 10",
    email: "jobs@ideo-technologies.fr",
    tags: ["Développement", "Mobile", "Startup", "Stage", "CDI"],
  },
  {
    id: "nan9",
    name: "Visteon Électronique Nancy",
    type: "both",
    sector: "industrie",
    address: "30 Avenue du Général Leclerc",
    city: "Nancy",
    lat: 48.6745,
    lng: 6.1905,
    rating: 4.2,
    stageCount: 18,
    emploiCount: 10,
    description: "Équipementier automobile en électronique embarquée. Stages en ingénierie et production.",
    logo: "VS",
    website: "visteon.com",
    phone: "03 83 57 90 00",
    email: "stages-nancy@visteon.com",
    tags: ["Automobile", "Électronique", "Ingénierie", "Alternance"],
  },
  {
    id: "nan10",
    name: "LORIA – Laboratoire Lorrain IA",
    type: "stage",
    sector: "tech",
    address: "Campus CNRS, Vandœuvre-lès-Nancy",
    city: "Vandœuvre-lès-Nancy",
    lat: 48.6641,
    lng: 6.1547,
    rating: 4.7,
    stageCount: 20,
    description: "Laboratoire de recherche en IA et informatique. Stages en machine learning, data et robotique.",
    logo: "LO",
    website: "loria.fr",
    phone: "03 54 95 86 86",
    email: "stages@loria.fr",
    tags: ["IA", "Recherche", "Machine Learning", "Robotique", "Stage PFE"],
  },
  // ── METZ ───────────────────────────────────────────────────────
  {
    id: "mtz1",
    name: "ArcelorMittal Metz",
    type: "both",
    sector: "industrie",
    address: "Boulevard de la Défense",
    city: "Metz",
    lat: 49.1193,
    lng: 6.1727,
    rating: 4.3,
    stageCount: 40,
    emploiCount: 20,
    description: "Géant mondial de l'acier. Stages en ingénierie, production, maintenance et R&D.",
    logo: "AM",
    website: "arcelormittal.com",
    phone: "03 87 74 00 00",
    email: "recrutement-metz@arcelormittal.com",
    tags: ["Sidérurgie", "Ingénierie", "Maintenance", "Alternance", "Stage PFE"],
  },
  {
    id: "mtz2",
    name: "Technopole de Metz",
    type: "both",
    sector: "tech",
    address: "Parc d'Innovation, Rue Marconi",
    city: "Metz",
    lat: 49.1050,
    lng: 6.2010,
    rating: 4.5,
    stageCount: 35,
    emploiCount: 25,
    description: "Parc d'entreprises tech et innovation. Startups et PME recrutant dans le numérique.",
    logo: "TM",
    website: "technopole-metz.fr",
    phone: "03 87 74 70 70",
    email: "info@technopole-metz.fr",
    tags: ["Tech", "Startup", "Innovation", "Développement", "CDI"],
  },
  {
    id: "mtz3",
    name: "CHR Metz-Thionville",
    type: "both",
    sector: "sante",
    address: "1 Allée du Château",
    city: "Metz",
    lat: 49.1123,
    lng: 6.1604,
    rating: 4.2,
    stageCount: 45,
    emploiCount: 25,
    description: "Centre hospitalier régional. Recrutements en soins, gestion et informatique médicale.",
    logo: "CHR",
    website: "chr-metz-thionville.fr",
    phone: "03 87 55 31 31",
    email: "recrutement@chr-metz-thionville.fr",
    tags: ["Soins", "Médecine", "Informatique médicale", "Alternance"],
  },
  {
    id: "mtz4",
    name: "Cora Distribution Metz",
    type: "both",
    sector: "commerce",
    address: "Route de Woippy",
    city: "Metz",
    lat: 49.1280,
    lng: 6.1552,
    rating: 3.9,
    stageCount: 20,
    emploiCount: 15,
    description: "Enseigne de grande distribution. Stages et emplois en gestion, logistique et commerce.",
    logo: "CO",
    website: "cora.fr",
    phone: "03 87 78 50 00",
    email: "rh-metz@cora.fr",
    tags: ["Grande distribution", "Commerce", "Logistique", "Alternance"],
  },
  {
    id: "mtz5",
    name: "Crédit Mutuel Centre Est",
    type: "both",
    sector: "finance",
    address: "8 Rue Gambetta",
    city: "Metz",
    lat: 49.1195,
    lng: 6.1776,
    rating: 4.1,
    stageCount: 15,
    emploiCount: 10,
    description: "Groupe bancaire coopératif. Recrutements en finance, gestion et relation client.",
    logo: "CM",
    website: "creditmutuel.fr",
    phone: "03 87 14 30 00",
    email: "recrutement@cm-cee.fr",
    tags: ["Banque", "Finance", "Relation client", "Alternance"],
  },
  // ── THIONVILLE ─────────────────────────────────────────────────
  {
    id: "thi1",
    name: "Paul Wurth Thionville",
    type: "both",
    sector: "industrie",
    address: "Zone Industrielle, Rue des Alliés",
    city: "Thionville",
    lat: 49.3597,
    lng: 6.1667,
    rating: 4.4,
    stageCount: 25,
    emploiCount: 15,
    description: "Ingénierie sidérurgique de pointe. Stages et postes d'ingénieurs juniors en process industriel.",
    logo: "PW",
    website: "paulwurth.com",
    phone: "03 82 57 00 00",
    email: "careers@paulwurth.com",
    tags: ["Sidérurgie", "Ingénierie process", "R&D", "Stage PFE"],
  },
  {
    id: "thi2",
    name: "Hôpital Bel-Air Thionville",
    type: "stage",
    sector: "sante",
    address: "1 Rue du Friscaty",
    city: "Thionville",
    lat: 49.3511,
    lng: 6.1720,
    rating: 4.0,
    stageCount: 25,
    description: "Hôpital du nord de la Moselle. Stages en soins, kiné, diététique et administration.",
    logo: "HB",
    website: "chr-metz-thionville.fr",
    phone: "03 82 55 80 80",
    email: "stages@chr-mt.fr",
    tags: ["Soins", "Kiné", "Diététique", "Stage"],
  },
  {
    id: "thi3",
    name: "Amazon Logistics Thionville",
    type: "emploi",
    sector: "commerce",
    address: "2 Rue de l'Industrie, Illange",
    city: "Thionville",
    lat: 49.3720,
    lng: 6.1405,
    rating: 3.8,
    emploiCount: 50,
    description: "Centre logistique Amazon. Recrutements en logistique, management et opérations.",
    logo: "AZ",
    website: "amazon.fr/jobs",
    phone: "03 82 55 20 00",
    email: "jobs-thionville@amazon.com",
    tags: ["Logistique", "Management", "CDD", "CDI", "Opérations"],
  },
  // ── VERDUN ─────────────────────────────────────────────────────
  {
    id: "ver1",
    name: "Bragard Hôtellerie Verdun",
    type: "both",
    sector: "commerce",
    address: "8 Rue de la Vieille Prison",
    city: "Verdun",
    lat: 49.1597,
    lng: 5.3838,
    rating: 4.1,
    stageCount: 10,
    emploiCount: 6,
    description: "Leader mondial des vêtements professionnels de restauration. Stages en commerce, logistique et marketing.",
    logo: "BR",
    website: "bragard.com",
    phone: "03 29 83 22 00",
    email: "stages@bragard.com",
    tags: ["Commerce", "Marketing", "Logistique", "Alternance"],
  },
  // ── STRASBOURG ─────────────────────────────────────────────────
  {
    id: "str1",
    name: "Alsace Tech Hub",
    type: "both",
    sector: "tech",
    address: "4 Rue Blaise Pascal",
    city: "Strasbourg",
    lat: 48.5734,
    lng: 7.7521,
    rating: 4.6,
    stageCount: 20,
    emploiCount: 15,
    description: "Hub technologique alsacien. Startups et scale-ups recrutant en développement, data et product.",
    logo: "AT",
    website: "alsacetech.fr",
    phone: "03 88 24 95 00",
    email: "jobs@alsacetech.fr",
    tags: ["Tech", "Startup", "Data", "Product", "CDI"],
  },
  {
    id: "str2",
    name: "Parlement Européen",
    type: "stage",
    sector: "education",
    address: "1 Avenue du Président Robert Schuman",
    city: "Strasbourg",
    lat: 48.5975,
    lng: 7.7681,
    rating: 4.8,
    stageCount: 80,
    description: "Stage au Parlement Européen. Expérience unique en droit européen, communication et politiques publiques.",
    logo: "PE",
    website: "europarl.europa.eu",
    phone: "03 88 17 40 01",
    email: "stages@europarl.europa.eu",
    tags: ["Droit européen", "Communication", "Politique", "Stage rémunéré"],
  },
  {
    id: "str3",
    name: "bioMérieux Strasbourg",
    type: "both",
    sector: "sante",
    address: "5 Rue des Bouchers",
    city: "Strasbourg",
    lat: 48.5821,
    lng: 7.7415,
    rating: 4.5,
    stageCount: 25,
    emploiCount: 12,
    description: "Diagnostic in vitro. Stages et emplois en biotechnologies, R&D et affaires médicales.",
    logo: "BM",
    website: "biomerieux.fr",
    phone: "04 78 87 20 00",
    email: "stages-sbg@biomerieux.fr",
    tags: ["Biotechnologie", "R&D", "Médical", "Alternance"],
  },
  // ── LILLE ──────────────────────────────────────────────────────
  {
    id: "lil1",
    name: "Decathlon Campus",
    type: "both",
    sector: "commerce",
    address: "4 Boulevard de Mons",
    city: "Villeneuve-d'Ascq",
    lat: 50.6128,
    lng: 3.1463,
    rating: 4.6,
    stageCount: 80,
    emploiCount: 45,
    description: "Leader du sport. Stages et emplois dans le commerce, la logistique et le digital.",
    logo: "DC",
    website: "decathlon.fr",
    phone: "03 20 33 55 00",
    email: "recrutement@decathlon.com",
    tags: ["Commerce", "Sport", "Logistique", "Alternance", "CDD"],
  },
  {
    id: "lil2",
    name: "OVHcloud Roubaix",
    type: "emploi",
    sector: "tech",
    address: "2 Rue Kellermann",
    city: "Roubaix",
    lat: 50.6892,
    lng: 3.1746,
    rating: 4.3,
    emploiCount: 30,
    description: "Leader européen du cloud. Recrute des jeunes talents en infrastructure, sécurité et DevOps.",
    logo: "OVH",
    website: "ovhcloud.com",
    phone: "09 72 10 10 07",
    email: "jobs@ovhcloud.com",
    tags: ["Cloud", "Infrastructure", "Sécurité", "DevOps", "CDI"],
  },
  {
    id: "lil3",
    name: "Auchan Digital",
    type: "both",
    sector: "tech",
    address: "40 Avenue de Flandres",
    city: "Croix",
    lat: 50.6750,
    lng: 3.1545,
    rating: 4.4,
    stageCount: 30,
    emploiCount: 20,
    description: "Division digitale Auchan. Développement e-commerce, data, UX et product management.",
    logo: "AD",
    website: "auchan.fr",
    phone: "03 20 67 55 00",
    email: "recrutement-digital@auchan.fr",
    tags: ["E-commerce", "Data", "UX", "Product", "CDI"],
  },
  // ── PARIS ──────────────────────────────────────────────────────
  {
    id: "par1",
    name: "TechVision France",
    type: "both",
    sector: "tech",
    address: "45 Rue de Rivoli",
    city: "Paris",
    lat: 48.8606,
    lng: 2.3488,
    rating: 4.7,
    stageCount: 35,
    emploiCount: 12,
    description: "Startup spécialisée en IA et machine learning. Accueille régulièrement des stagiaires.",
    logo: "TV",
    website: "techvision.fr",
    phone: "01 42 33 44 55",
    email: "rh@techvision.fr",
    tags: ["Développement", "IA", "Data Science", "Alternance"],
  },
  {
    id: "par2",
    name: "BNP Paribas Siège",
    type: "both",
    sector: "finance",
    address: "16 Boulevard des Italiens",
    city: "Paris",
    lat: 48.8713,
    lng: 2.3389,
    rating: 4.2,
    stageCount: 50,
    emploiCount: 25,
    description: "Grande banque internationale avec un programme de stages structuré pour jeunes diplômés.",
    logo: "BNP",
    website: "bnpparibas.com",
    phone: "01 40 14 45 46",
    email: "recrutement@bnpparibas.com",
    tags: ["Finance", "Banque", "Alternance", "CDI Junior"],
  },
  {
    id: "par3",
    name: "Capgemini Engineering Paris",
    type: "emploi",
    sector: "tech",
    address: "76 Avenue Kléber",
    city: "Paris",
    lat: 48.8712,
    lng: 2.2885,
    rating: 4.3,
    emploiCount: 60,
    description: "Cabinet de conseil et d'ingénierie IT. Recrute des jeunes diplômés en informatique.",
    logo: "CG",
    website: "capgemini.com",
    phone: "01 49 67 30 00",
    email: "careers@capgemini.com",
    tags: ["Consulting", "IT", "Ingénierie", "CDI", "Premier emploi"],
  },
  {
    id: "par4",
    name: "Hôpital Saint-Louis AP-HP",
    type: "stage",
    sector: "sante",
    address: "1 Avenue Claude Vellefaux",
    city: "Paris",
    lat: 48.8748,
    lng: 2.3697,
    rating: 4.0,
    stageCount: 40,
    description: "Centre hospitalier parisien AP-HP. Stages en médecine, paramédical et gestion hospitalière.",
    logo: "HSL",
    website: "aphp.fr",
    phone: "01 42 49 49 49",
    email: "stages@saintlouis.aphp.fr",
    tags: ["Médical", "Infirmier", "Stage", "Stage 3e"],
  },
  {
    id: "par5",
    name: "L'Oréal Research Aulnay",
    type: "both",
    sector: "industrie",
    address: "1 Avenue Eugène Schueller",
    city: "Aulnay-sous-Bois",
    lat: 48.9442,
    lng: 2.4975,
    rating: 4.5,
    stageCount: 45,
    emploiCount: 20,
    description: "Centre de R&D L'Oréal. Stages en chimie, biologie, formulation et marketing produit.",
    logo: "LO",
    website: "loreal.com",
    phone: "01 48 68 91 00",
    email: "stages.research@loreal.com",
    tags: ["Chimie", "Recherche", "Marketing", "Cosmétique", "Alternance"],
  },
  {
    id: "par6",
    name: "OpenClassrooms Paris",
    type: "stage",
    sector: "education",
    address: "7 Cité Paradis",
    city: "Paris",
    lat: 48.8764,
    lng: 2.3498,
    rating: 4.4,
    stageCount: 15,
    description: "Plateforme d'éducation en ligne. Stages en pédagogie, tech et marketing.",
    logo: "OC",
    website: "openclassrooms.com",
    phone: "01 80 88 80 30",
    email: "jobs@openclassrooms.com",
    tags: ["EdTech", "Pédagogie", "Développement", "Stage"],
  },
  {
    id: "par7",
    name: "Agence Créativ Paris",
    type: "stage",
    sector: "marketing",
    address: "12 Boulevard Haussmann",
    city: "Paris",
    lat: 48.8738,
    lng: 2.3312,
    rating: 4.5,
    stageCount: 20,
    description: "Agence de communication digitale. Formation en marketing, réseaux sociaux et création de contenu.",
    logo: "AC",
    website: "agencecreativ.fr",
    phone: "01 55 66 77 88",
    email: "stages@agencecreativ.fr",
    tags: ["Community Management", "SEO", "Design", "Stage 3e"],
  },
  // ── LYON ───────────────────────────────────────────────────────
  {
    id: "lyo1",
    name: "Ubisoft Villeurbanne",
    type: "both",
    sector: "tech",
    address: "4 Quai des Bateliers",
    city: "Villeurbanne",
    lat: 45.7714,
    lng: 4.8721,
    rating: 4.6,
    stageCount: 25,
    emploiCount: 15,
    description: "Studio de jeux vidéo. Stages et emplois en game design, programmation et art.",
    logo: "UB",
    website: "ubisoft.com",
    phone: "04 37 28 65 00",
    email: "recrutement-lyon@ubisoft.com",
    tags: ["Game Design", "Programmation", "Art 3D", "Stage", "CDI"],
  },
  {
    id: "lyo2",
    name: "bioMérieux Marcy-l'Étoile",
    type: "both",
    sector: "sante",
    address: "376 Chemin de l'Orme",
    city: "Marcy-l'Étoile",
    lat: 45.7827,
    lng: 4.7263,
    rating: 4.5,
    stageCount: 40,
    emploiCount: 25,
    description: "Leader mondial du diagnostic in vitro. Stages en R&D, biologie, qualité.",
    logo: "BX",
    website: "biomerieux.fr",
    phone: "04 78 87 20 00",
    email: "stages@biomerieux.fr",
    tags: ["Biologie", "R&D", "Qualité", "Alternance", "Stage PFE"],
  },
  {
    id: "lyo3",
    name: "GL Events Lyon",
    type: "both",
    sector: "marketing",
    address: "59 Quai Rambaud",
    city: "Lyon",
    lat: 45.7397,
    lng: 4.8172,
    rating: 4.2,
    stageCount: 20,
    emploiCount: 10,
    description: "Groupe événementiel international. Stages et emplois en organisation d'événements et communication.",
    logo: "GL",
    website: "gl-events.com",
    phone: "04 72 60 65 00",
    email: "recrutement@gl-events.com",
    tags: ["Événementiel", "Communication", "Marketing", "Stage"],
  },
  // ── TOULOUSE ───────────────────────────────────────────────────
  {
    id: "tou1",
    name: "Airbus Defence & Space",
    type: "both",
    sector: "industrie",
    address: "31 Rue des Cosmonautes",
    city: "Toulouse",
    lat: 43.5553,
    lng: 1.4758,
    rating: 4.8,
    stageCount: 100,
    emploiCount: 35,
    description: "Géant de l'aéronautique. Stages et emplois en ingénierie, production et recherche.",
    logo: "AB",
    website: "airbus.com",
    phone: "05 61 93 33 33",
    email: "stages@airbus.com",
    tags: ["Aéronautique", "Ingénierie", "R&D", "Stage PFE", "Alternance"],
  },
  {
    id: "tou2",
    name: "CNES Toulouse",
    type: "both",
    sector: "industrie",
    address: "18 Avenue Édouard Belin",
    city: "Toulouse",
    lat: 43.5660,
    lng: 1.4810,
    rating: 4.9,
    stageCount: 50,
    emploiCount: 20,
    description: "Centre National d'Études Spatiales. Stages et emplois en espace et informatique embarquée.",
    logo: "CN",
    website: "cnes.fr",
    phone: "05 61 27 31 31",
    email: "stages@cnes.fr",
    tags: ["Spatial", "Informatique embarquée", "Ingénierie", "Stage PFE"],
  },
  // ── BORDEAUX ───────────────────────────────────────────────────
  {
    id: "brd1",
    name: "Dassault Aviation Bordeaux",
    type: "both",
    sector: "industrie",
    address: "10 Avenue Marcel Dassault",
    city: "Bordeaux",
    lat: 44.8378,
    lng: -0.5792,
    rating: 4.7,
    stageCount: 45,
    emploiCount: 20,
    description: "Constructeur d'avions d'affaires Falcon. Stages et emplois en ingénierie aéronautique.",
    logo: "DA",
    website: "dassault-aviation.com",
    phone: "05 57 11 40 00",
    email: "stages-bx@dassault-aviation.com",
    tags: ["Aéronautique", "Avionique", "Ingénierie", "Stage PFE"],
  },
  // ── NANTES ─────────────────────────────────────────────────────
  {
    id: "nat1",
    name: "Airbus Nantes",
    type: "both",
    sector: "industrie",
    address: "1 Rue Louis Bréguet",
    city: "Bouguenais",
    lat: 47.1534,
    lng: -1.6103,
    rating: 4.7,
    stageCount: 60,
    emploiCount: 30,
    description: "Site Airbus dédié aux ailes d'avions. Stages et emplois en ingénierie, production et qualité.",
    logo: "AN",
    website: "airbus.com",
    phone: "02 40 84 50 00",
    email: "stages-nantes@airbus.com",
    tags: ["Aéronautique", "Ingénierie", "Production", "Alternance"],
  },
  {
    id: "nat2",
    name: "Atlanpole Nantes",
    type: "both",
    sector: "tech",
    address: "2 Rue de la Houssinière",
    city: "Nantes",
    lat: 47.2579,
    lng: -1.5451,
    rating: 4.4,
    stageCount: 30,
    emploiCount: 25,
    description: "Pôle d'innovation nantais. Startups tech et biotech recrutant activement.",
    logo: "AP",
    website: "atlanpole.fr",
    phone: "02 28 20 80 20",
    email: "contact@atlanpole.fr",
    tags: ["Tech", "Biotech", "Startup", "Innovation", "CDI"],
  },
  // ── MARSEILLE ──────────────────────────────────────────────────
  {
    id: "mar1",
    name: "CMA CGM Marseille",
    type: "both",
    sector: "commerce",
    address: "Tour CMA CGM, 4 Quai d'Arenc",
    city: "Marseille",
    lat: 43.3082,
    lng: 5.3675,
    rating: 4.5,
    stageCount: 40,
    emploiCount: 25,
    description: "3e armateur mondial. Stages et emplois en logistique maritime, commerce et finance.",
    logo: "CMA",
    website: "cmacgm.com",
    phone: "04 88 91 90 00",
    email: "recrutement@cma-cgm.com",
    tags: ["Maritime", "Logistique", "Commerce international", "Alternance"],
  },
  {
    id: "mar2",
    name: "Airbus Helicopters Marignane",
    type: "both",
    sector: "industrie",
    address: "Aérodrome de Marseille-Provence",
    city: "Marignane",
    lat: 43.4363,
    lng: 5.2145,
    rating: 4.6,
    stageCount: 50,
    emploiCount: 25,
    description: "Leader mondial des hélicoptères civils. Stages et emplois en ingénierie, test et production.",
    logo: "AH",
    website: "airbus.com",
    phone: "04 42 85 85 85",
    email: "stages-helicopters@airbus.com",
    tags: ["Aéronautique", "Ingénierie", "Test", "Stage PFE", "Alternance"],
  },
  // ── GRENOBLE ───────────────────────────────────────────────────
  {
    id: "gre1",
    name: "STMicroelectronics Crolles",
    type: "both",
    sector: "tech",
    address: "850 Rue Jean Monnet",
    city: "Crolles",
    lat: 45.2895,
    lng: 5.8788,
    rating: 4.5,
    stageCount: 60,
    emploiCount: 40,
    description: "Géant des semi-conducteurs. Stages et emplois en électronique, physique et ingénierie.",
    logo: "ST",
    website: "st.com",
    phone: "04 76 92 80 00",
    email: "careers-grenoble@st.com",
    tags: ["Semi-conducteurs", "Électronique", "Physique", "Stage PFE", "CDI"],
  },
  {
    id: "gre2",
    name: "Schneider Electric Grenoble",
    type: "both",
    sector: "industrie",
    address: "35 Rue Joseph Monier",
    city: "Grenoble",
    lat: 45.1885,
    lng: 5.7245,
    rating: 4.4,
    stageCount: 35,
    emploiCount: 20,
    description: "Leader en gestion de l'énergie. Stages et emplois en électrotechnique, IoT et développement.",
    logo: "SE",
    website: "se.com",
    phone: "04 76 57 60 60",
    email: "stages-grenoble@se.com",
    tags: ["Énergie", "IoT", "Électrotechnique", "Développement", "Alternance"],
  },
  // ── RENNES ─────────────────────────────────────────────────────
  {
    id: "ren1",
    name: "Orange Labs Rennes",
    type: "both",
    sector: "tech",
    address: "4 Rue du Clos Courtel",
    city: "Cesson-Sévigné",
    lat: 48.1218,
    lng: -1.6052,
    rating: 4.4,
    stageCount: 30,
    emploiCount: 20,
    description: "Centre de R&D d'Orange. Stages et emplois en réseaux, IA et cybersécurité.",
    logo: "OL",
    website: "orange.com",
    phone: "02 99 12 40 00",
    email: "recrutement-rennes@orange.com",
    tags: ["Réseaux", "IA", "Cybersécurité", "R&D", "Alternance"],
  },
  // ── MONTPELLIER ────────────────────────────────────────────────
  {
    id: "mtp1",
    name: "Ubisoft Montpellier",
    type: "both",
    sector: "tech",
    address: "180 Place Ernest Granier",
    city: "Montpellier",
    lat: 43.6045,
    lng: 3.8932,
    rating: 4.6,
    stageCount: 25,
    emploiCount: 15,
    description: "Studio de jeux vidéo. Stages et emplois en game design, programmation et art.",
    logo: "UM",
    website: "ubisoft.com",
    phone: "04 99 52 48 00",
    email: "recrutement-montpellier@ubisoft.com",
    tags: ["Game Design", "Programmation", "Art 3D", "Stage", "CDI"],
  },
  {
    id: "mtp2",
    name: "Sanofi Montpellier",
    type: "both",
    sector: "sante",
    address: "195 Route d'Espagne",
    city: "Montpellier",
    lat: 43.5920,
    lng: 3.8430,
    rating: 4.5,
    stageCount: 35,
    emploiCount: 20,
    description: "Groupe pharmaceutique mondial. Stages et emplois en pharmacie, biologie et marketing médical.",
    logo: "SA",
    website: "sanofi.com",
    phone: "04 67 04 70 00",
    email: "stages-mtp@sanofi.com",
    tags: ["Pharmaceutique", "Biologie", "Marketing médical", "Alternance"],
  },
  // ── NICE / SOPHIA ANTIPOLIS ────────────────────────────────────
  {
    id: "nic1",
    name: "Amadeus Sophia Antipolis",
    type: "both",
    sector: "tech",
    address: "485 Route du Pin Montard",
    city: "Sophia Antipolis",
    lat: 43.6155,
    lng: 7.0579,
    rating: 4.6,
    stageCount: 40,
    emploiCount: 30,
    description: "Leader des solutions IT pour le voyage. Stages et emplois en développement, data et tech.",
    logo: "AM",
    website: "amadeus.com",
    phone: "04 92 94 30 00",
    email: "careers@amadeus.com",
    tags: ["Travel Tech", "Développement", "Data", "CDI", "Stage PFE"],
  },
  // ── CLERMONT-FERRAND ───────────────────────────────────────────
  {
    id: "clf1",
    name: "Michelin Clermont-Ferrand",
    type: "both",
    sector: "industrie",
    address: "23 Place des Carmes",
    city: "Clermont-Ferrand",
    lat: 45.7772,
    lng: 3.0870,
    rating: 4.6,
    stageCount: 70,
    emploiCount: 35,
    description: "Leader mondial du pneumatique. Stages et emplois en ingénierie, chimie, data et marketing.",
    logo: "MI",
    website: "michelin.com",
    phone: "04 73 32 20 00",
    email: "stages@michelin.com",
    tags: ["Pneumatique", "Ingénierie", "Chimie", "Data", "Alternance"],
  },
  // ── DIJON ──────────────────────────────────────────────────────
  {
    id: "dij1",
    name: "Urgo Group Dijon",
    type: "both",
    sector: "sante",
    address: "42 Rue de Longvic",
    city: "Chenôve",
    lat: 47.2830,
    lng: 5.0196,
    rating: 4.3,
    stageCount: 20,
    emploiCount: 12,
    description: "Groupe pharmaceutique et cosmétique. Stages en marketing, R&D et affaires médicales.",
    logo: "UR",
    website: "urgo-group.com",
    phone: "03 80 44 74 00",
    email: "stages@urgo-group.com",
    tags: ["Pharmaceutique", "Marketing", "R&D", "Alternance"],
  },
  // ── REIMS ──────────────────────────────────────────────────────
  {
    id: "rei1",
    name: "LVMH Champagne Pommery",
    type: "stage",
    sector: "commerce",
    address: "5 Place du Général Gouraud",
    city: "Reims",
    lat: 49.2604,
    lng: 4.0317,
    rating: 4.7,
    stageCount: 15,
    description: "Maison de champagne du groupe LVMH. Stages uniques en œnologie, marketing du luxe et événementiel.",
    logo: "PM",
    website: "pommery.com",
    phone: "03 26 61 62 63",
    email: "stages@pommery.com",
    tags: ["Luxe", "Œnologie", "Marketing", "Événementiel", "Stage"],
  },
  // ── ROUEN ──────────────────────────────────────────────────────
  {
    id: "rou1",
    name: "Renault Cléon Normandie",
    type: "both",
    sector: "industrie",
    address: "Avenue de l'Europe",
    city: "Grand-Couronne",
    lat: 49.3483,
    lng: 1.0239,
    rating: 4.2,
    stageCount: 35,
    emploiCount: 20,
    description: "Usine moteurs Renault-Nissan. Stages et emplois en mécanique, production et méthodes.",
    logo: "RN",
    website: "renaultgroup.com",
    phone: "02 35 67 30 00",
    email: "stages-cleon@renault.com",
    tags: ["Automobile", "Mécanique", "Production", "Alternance", "Stage PFE"],
  },
  // ── CAEN ───────────────────────────────────────────────────────
  {
    id: "cae1",
    name: "Philips DA Caen",
    type: "both",
    sector: "tech",
    address: "2 Allée de Longueau",
    city: "Caen",
    lat: 49.1869,
    lng: -0.3579,
    rating: 4.3,
    stageCount: 20,
    emploiCount: 10,
    description: "Centre R&D Philips en électronique grand public. Stages et emplois en électronique et logiciel embarqué.",
    logo: "PH",
    website: "philips.fr",
    phone: "02 31 45 89 00",
    email: "stages-caen@philips.com",
    tags: ["Électronique", "Logiciel embarqué", "R&D", "Stage PFE"],
  },
  // ── ÉPINAL ─────────────────────────────────────────────────────
  {
    id: "epi1",
    name: "Images & Art Épinal",
    type: "stage",
    sector: "design",
    address: "42 Quai de Dogneville",
    city: "Épinal",
    lat: 48.1741,
    lng: 6.4494,
    rating: 4.3,
    stageCount: 8,
    description: "Musée et manufacture d'images. Stages en design éditorial, communication culturelle et impression.",
    logo: "IA",
    website: "imagesdepinal.fr",
    phone: "03 29 31 66 20",
    email: "stages@imagesdepinal.fr",
    tags: ["Design", "Communication culturelle", "Impression", "Stage"],
  },
  // ─ FIN_MARQUEUR
  {
    id: "2",
    name: "AgenceCreativ",
    type: "stage",
    sector: "marketing",
    address: "12 Boulevard Haussmann",
    city: "Paris",
    lat: 48.8738,
    lng: 2.3312,
    rating: 4.5,
    stageCount: 20,
    description:
      "Agence de communication digitale qui forme les jeunes talents en marketing, reseaux sociaux et creation de contenu.",
    logo: "AC",
    website: "agencecreativ.fr",
    phone: "01 55 66 77 88",
    email: "stages@agencecreativ.fr",
    tags: ["Community Management", "SEO", "Design", "Stage 3e"],
  },
  {
    id: "3",
    name: "BNP Paribas - Agence Centrale",
    type: "both",
    sector: "finance",
    address: "16 Boulevard des Italiens",
    city: "Paris",
    lat: 48.8713,
    lng: 2.3389,
    rating: 4.2,
    stageCount: 50,
    emploiCount: 25,
    description:
      "Grande banque internationale avec un programme de stages structure et des opportunites d'emploi pour les jeunes diplomes.",
    logo: "BNP",
    website: "bnpparibas.com",
    phone: "01 40 14 45 46",
    email: "recrutement@bnpparibas.com",
    tags: ["Finance", "Banque", "Alternance", "CDI Junior"],
  },
  {
    id: "4",
    name: "Hopital Saint-Louis",
    type: "stage",
    sector: "sante",
    address: "1 Avenue Claude Vellefaux",
    city: "Paris",
    lat: 48.8748,
    lng: 2.3697,
    rating: 4.0,
    stageCount: 40,
    description:
      "Centre hospitalier accueillant des stagiaires dans les domaines medicaux, paramedicaux et administratifs.",
    logo: "HSL",
    website: "aphp.fr",
    phone: "01 42 49 49 49",
    email: "stages@saintlouis.aphp.fr",
    tags: ["Medical", "Infirmier", "Stage observation", "Stage 3e"],
  },
  {
    id: "5",
    name: "Decathlon Campus",
    type: "both",
    sector: "commerce",
    address: "4 Boulevard de Mons",
    city: "Villeneuve-d'Ascq",
    lat: 50.6128,
    lng: 3.1463,
    rating: 4.6,
    stageCount: 80,
    emploiCount: 45,
    description:
      "Leader du sport qui offre de nombreuses opportunites de stages et d'emplois dans le commerce, la logistique et le digital.",
    logo: "DC",
    website: "decathlon.fr",
    phone: "03 20 33 55 00",
    email: "recrutement@decathlon.com",
    tags: ["Commerce", "Sport", "Logistique", "Alternance", "CDD"],
  },
  {
    id: "6",
    name: "Capgemini Engineering",
    type: "emploi",
    sector: "tech",
    address: "76 Avenue Kleber",
    city: "Paris",
    lat: 48.8712,
    lng: 2.2885,
    rating: 4.3,
    emploiCount: 60,
    description:
      "Cabinet de conseil et d'ingenierie IT recrute activement des jeunes diplomes en informatique et ingenierie.",
    logo: "CG",
    website: "capgemini.com",
    phone: "01 49 67 30 00",
    email: "careers@capgemini.com",
    tags: ["Consulting", "IT", "Ingenierie", "CDI", "Premier emploi"],
  },
  {
    id: "7",
    name: "Airbus Defence & Space",
    type: "both",
    sector: "industrie",
    address: "31 Rue des Cosmonautes",
    city: "Toulouse",
    lat: 43.5553,
    lng: 1.4758,
    rating: 4.8,
    stageCount: 100,
    emploiCount: 35,
    description:
      "Geant de l'aeronautique offrant des stages et emplois dans l'ingenierie, la production et la recherche.",
    logo: "AB",
    website: "airbus.com",
    phone: "05 61 93 33 33",
    email: "stages@airbus.com",
    tags: ["Aeronautique", "Ingenierie", "R&D", "Stage PFE", "Alternance"],
  },
  {
    id: "8",
    name: "OpenClassrooms",
    type: "stage",
    sector: "education",
    address: "7 Cite Paradis",
    city: "Paris",
    lat: 48.8764,
    lng: 2.3498,
    rating: 4.4,
    stageCount: 15,
    description:
      "Plateforme d'education en ligne qui accueille des stagiaires en pedagogie, tech et marketing.",
    logo: "OC",
    website: "openclassrooms.com",
    phone: "01 80 88 80 30",
    email: "jobs@openclassrooms.com",
    tags: ["EdTech", "Pedagogie", "Developpement", "Stage"],
  },
  {
    id: "9",
    name: "Studio Harcourt",
    type: "stage",
    sector: "design",
    address: "6 Rue de Lota",
    city: "Paris",
    lat: 48.8656,
    lng: 2.2793,
    rating: 4.1,
    stageCount: 8,
    description:
      "Studio photographique legendaire formant des stagiaires en photographie, retouche et direction artistique.",
    logo: "SH",
    website: "studio-harcourt.eu",
    phone: "01 42 56 67 67",
    email: "contact@studio-harcourt.eu",
    tags: ["Photographie", "Direction artistique", "Design", "Stage"],
  },
  {
    id: "10",
    name: "L'Oreal Research",
    type: "both",
    sector: "industrie",
    address: "1 Avenue Eugene Schueller",
    city: "Aulnay-sous-Bois",
    lat: 48.9442,
    lng: 2.4975,
    rating: 4.5,
    stageCount: 45,
    emploiCount: 20,
    description:
      "Centre de recherche L'Oreal offrant des stages en chimie, biologie, formulation et marketing produit.",
    logo: "LO",
    website: "loreal.com",
    phone: "01 48 68 91 00",
    email: "stages.research@loreal.com",
    tags: ["Chimie", "Recherche", "Marketing", "Cosmetique", "Alternance"],
  },
];

// ── Helpers ────────────────────────────────────────────────────────

function getMarkerColor(type: CompanyType) {
  return type === "stage" ? "#6366f1" : type === "emploi" ? "#10b981" : "#6b55f7";
}

function createIcon(type: CompanyType) {
  const color = getMarkerColor(type);
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

// ── Vanilla Leaflet Map Component ──────────────────────────────────

function LeafletMap({
  center,
  zoom,
  companies,
  userLocation,
  onSelectCompany,
}: {
  center: [number, number];
  zoom: number;
  companies: Company[];
  userLocation: [number, number] | null;
  onSelectCompany: (company: Company) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center/zoom
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, zoom, { animate: true });
    }
  }, [center, zoom]);

  // Update markers
  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    companies.forEach((company) => {
      const marker = L.marker([company.lat, company.lng], {
        icon: createIcon(company.type),
      });

      const stageHtml =
        company.type === "stage" || company.type === "both"
          ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#eef2ff;color:#4f46e5;">${company.stageCount} stages</span>`
          : "";
      const emploiHtml =
        company.type === "emploi" || company.type === "both"
          ? `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#ecfdf5;color:#059669;">${company.emploiCount} emplois</span>`
          : "";

      marker.bindPopup(
        `<div style="min-width:180px;padding:4px;">
          <p style="font-size:14px;margin:0 0 2px;">${company.name}</p>
          <p style="font-size:11px;color:#64748b;margin:0 0 6px;">${company.address}, ${company.city}</p>
          <div style="display:flex;gap:4px;">${stageHtml}${emploiHtml}</div>
        </div>`
      );

      marker.on("click", () => onSelectCompany(company));
      marker.addTo(markersRef.current!);
    });
  }, [companies, onSelectCompany]);

  // User location marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation) {
      userMarkerRef.current = L.marker(userLocation, {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 3px rgba(59,130,246,0.3);"></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      })
        .bindPopup("Vous etes ici")
        .addTo(mapRef.current);
    }
  }, [userLocation]);

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", minHeight: 400, width: "100%" }}
    />
  );
}

// ── Company Card ──���────────────────────────────────────────────────

function CompanyCard({
  company,
  isSelected,
  onClick,
}: {
  company: Company;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${
        isSelected
          ? "border-indigo-300 bg-indigo-50/50 shadow-md ring-1 ring-indigo-200"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`size-11 rounded-xl flex items-center justify-center text-sm shrink-0 ${
            company.type === "stage"
              ? "bg-indigo-100 text-indigo-700"
              : company.type === "emploi"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-violet-100 text-violet-700"
          }`}
        >
          {company.logo}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 justify-between">
            <h3 className="text-sm truncate">{company.name}</h3>
            <div className="flex items-center gap-1 shrink-0">
              <Star className="size-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs text-slate-600">{company.rating}</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">
              {company.address}, {company.city}
            </span>
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${SECTOR_COLORS[company.sector]}`}
            >
              {SECTORS_LABELS[company.sector]}
            </span>
            {company.type === "stage" || company.type === "both" ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex items-center gap-1">
                <GraduationCap className="size-3" />
                {company.stageCount} stages
              </span>
            ) : null}
            {company.type === "emploi" || company.type === "both" ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 flex items-center gap-1">
                <Briefcase className="size-3" />
                {company.emploiCount} emplois
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Company Detail Panel ───────────────────────────────────────────

function CompanyDetail({
  company,
  onClose,
  onTrack,
}: {
  company: Company;
  onClose: () => void;
  onTrack: (company: Company) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
      <div
        className={`p-5 ${
          company.type === "stage"
            ? "bg-gradient-to-r from-indigo-500 to-indigo-600"
            : company.type === "emploi"
            ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
            : "bg-gradient-to-r from-violet-500 to-violet-600"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-white text-sm">
              {company.logo}
            </div>
            <div>
              <h3 className="text-white text-base">{company.name}</h3>
              <p className="text-white/80 text-xs flex items-center gap-1 mt-0.5">
                <MapPin className="size-3" />
                {company.city}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-1 bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
            <Star className="size-3.5 text-amber-300 fill-amber-300" />
            <span className="text-white text-xs">{company.rating}/5</span>
          </div>
          {company.stageCount ? (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
              <GraduationCap className="size-3.5 text-white" />
              <span className="text-white text-xs">
                {company.stageCount} stages/an
              </span>
            </div>
          ) : null}
          {company.emploiCount ? (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur rounded-lg px-3 py-1.5">
              <Briefcase className="size-3.5 text-white" />
              <span className="text-white text-xs">
                {company.emploiCount} emplois
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-sm text-slate-600">{company.description}</p>

        <div className="space-y-2">
          <h4 className="text-xs text-slate-400 uppercase tracking-wide">
            Contact
          </h4>
          <div className="space-y-1.5">
            <a
              href={`https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <Globe className="size-4" />
              {company.website}
            </a>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="size-4 text-slate-400" />
              {company.phone}
            </p>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="size-4 text-slate-400" />
              {company.email}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs text-slate-400 uppercase tracking-wide">
            Domaines de recrutement
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {company.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <a
            href={`https://${company.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm hover:opacity-90 transition-opacity"
          >
            <ExternalLink className="size-4" />
            Voir le site
          </a>
          <button
            onClick={() => onTrack(company)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm hover:bg-slate-50 transition-colors"
          >
            <Mail className="size-4" />
            Suivre
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────���────────────────────────────────────

export function CompanyFinder() {
  useSEO({ title: "Carte entreprises TrackIA — Cadova", noindex: true });
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "stage" | "emploi">(
    "all"
  );
  const [sectorFilter, setSectorFilter] = useState<"all" | Sector>("all");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    46.603354, 1.888334,
  ]);
  const [mapZoom, setMapZoom] = useState(6);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(
    null
  );

  const handleLocateMe = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: [number, number] = [
            pos.coords.latitude,
            pos.coords.longitude,
          ];
          setUserLocation(loc);
          setMapCenter(loc);
          setMapZoom(12);
        },
        () => {
          setMapCenter([48.8566, 2.3522]);
          setMapZoom(12);
        }
      );
    }
  };

  const filteredCompanies = useMemo(() => {
    return MOCK_COMPANIES.filter((c) => {
      const matchesSearch =
        searchQuery === "" ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchesType =
        typeFilter === "all" ||
        c.type === typeFilter ||
        (typeFilter === "stage" && c.type === "both") ||
        (typeFilter === "emploi" && c.type === "both");

      const matchesSector =
        sectorFilter === "all" || c.sector === sectorFilter;

      return matchesSearch && matchesType && matchesSector;
    });
  }, [searchQuery, typeFilter, sectorFilter]);

  const handleSelectCompany = useCallback((company: Company) => {
    setSelectedCompany(company);
    setMapCenter([company.lat, company.lng]);
    setMapZoom(14);
  }, []);

  const handleTrackCompany = useCallback(
    (company: Company) => {
      if (!user?.id) {
        toast.error("Connecte-toi pour enregistrer cette candidature.");
        return;
      }

      saveApplication({
        userId: user.id,
        company: company.name,
        position: company.type === "stage" ? "Stage" : company.type === "emploi" ? "Emploi" : "Stage / Emploi",
        status: "sent",
        appliedAt: new Date().toISOString(),
        notes: `Ajoute depuis la carte entreprises (${company.city})`,
      });
      toast.success("Entreprise ajoutee a ton suivi.");
    },
    [user?.id]
  );

  const stageCount = MOCK_COMPANIES.filter(
    (c) => c.type === "stage" || c.type === "both"
  ).length;
  const emploiCount = MOCK_COMPANIES.filter(
    (c) => c.type === "emploi" || c.type === "both"
  ).length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <MapPin className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Carte des Entreprises
              </h1>
              <p className="text-sm text-slate-500">
                Trouve les entreprises qui recrutent pres de chez toi
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Building2 className="size-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-xl text-slate-800">
                {MOCK_COMPANIES.length}
              </p>
              <p className="text-xs text-slate-500">Entreprises</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <GraduationCap className="size-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xl text-slate-800">{stageCount}</p>
              <p className="text-xs text-slate-500">Offrent des stages</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className="size-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Briefcase className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl text-slate-800">{emploiCount}</p>
              <p className="text-xs text-slate-500">Recrutent</p>
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher une entreprise, ville, domaine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleLocateMe}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm hover:opacity-90 transition-opacity"
              >
                <Navigation className="size-4" />
                <span className="hidden sm:inline">Me localiser</span>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                  showFilters
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Filter className="size-4" />
                Filtres
                <ChevronDown
                  className={`size-3.5 transition-transform ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-2">
                  Type d'opportunite
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all" as const, label: "Tous", icon: Users },
                    {
                      value: "stage" as const,
                      label: "Stages",
                      icon: GraduationCap,
                    },
                    {
                      value: "emploi" as const,
                      label: "Emplois",
                      icon: Briefcase,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTypeFilter(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        typeFilter === opt.value
                          ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <opt.icon className="size-3.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">
                  Secteur d'activite
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSectorFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      sectorFilter === "all"
                        ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                        : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Tous
                  </button>
                  {(Object.keys(SECTORS_LABELS) as Sector[]).map((sector) => (
                    <button
                      key={sector}
                      onClick={() => setSectorFilter(sector)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        sectorFilter === sector
                          ? `${SECTOR_COLORS[sector]} border border-current/20`
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {SECTORS_LABELS[sector]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map + List Layout */}
        <div
          className="grid grid-cols-1 lg:grid-cols-5 gap-4"
          style={{ minHeight: 520 }}
        >
          {/* Map */}
          <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative">
            <LeafletMap
              center={mapCenter}
              zoom={mapZoom}
              companies={filteredCompanies}
              userLocation={userLocation}
              onSelectCompany={handleSelectCompany}
            />

            {/* Legend overlay */}
            <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg px-3 py-2 shadow-md z-[1000] flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-indigo-500" />
                <span className="text-[10px] text-slate-600">Stages</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-600">Emplois</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-violet-500" />
                <span className="text-[10px] text-slate-600">Les deux</span>
              </div>
            </div>
          </div>

          {/* Company list / detail */}
          <div className="lg:col-span-2 space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {selectedCompany ? (
              <>
                <CompanyDetail
                  company={selectedCompany}
                  onClose={() => setSelectedCompany(null)}
                  onTrack={handleTrackCompany}
                />
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="w-full text-sm text-slate-500 hover:text-slate-700 py-2 flex items-center justify-center gap-1"
                >
                  <ChevronDown className="size-4 rotate-90" />
                  Retour a la liste
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    {filteredCompanies.length} resultat
                    {filteredCompanies.length > 1 ? "s" : ""}
                  </p>
                </div>
                {filteredCompanies.length === 0 ? (
                  <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                    <Search className="size-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">
                      Aucune entreprise trouvee pour ces criteres
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setTypeFilter("all");
                        setSectorFilter("all");
                      }}
                      className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      Reinitialiser les filtres
                    </button>
                  </div>
                ) : (
                  filteredCompanies.map((company) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      isSelected={selectedCompany?.id === company.id}
                      onClick={() => handleSelectCompany(company)}
                    />
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
