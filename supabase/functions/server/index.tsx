import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();


const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non configurée. Ajoutez votre clé API OpenAI.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("❌ OpenAI API error:", res.status, errBody);
    throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);


app.use("*", logger(console.log));


app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

app.get("/make-server-0a5eb56b/health", (c) => {
  return c.json({
    status: "ok",
    service: "Cadova API",
    timestamp: new Date().toISOString(),
  });
});



app.post("/make-server-0a5eb56b/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();

    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    console.log(`📝 Creating new user account: ${email}`);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
    
      email_confirm: true,
    });

    if (error) {
      console.error(`❌ Signup error for ${email}:`, error);
   
      if (error.code === "email_exists" || error.message?.toLowerCase().includes("already been registered") || error.message?.toLowerCase().includes("already registered")) {
        return c.json({ error: "Un compte existe déjà avec cette adresse email. Connecte-toi plutôt.", code: "email_exists" }, 422);
      }
      return c.json({ error: error.message }, 400);
    }

    console.log(`✅ User created successfully: ${data.user?.id}`);

    await kv.set(`user:${data.user?.id}`, {
      id: data.user?.id,
      email: data.user?.email,
      name,
      createdAt: new Date().toISOString(),
      subscription: "free",
      credits: {
        cv: 1,
        coverLetter: 0,
        atsAnalysis: 0,
        interview: 0,
      },
    });

    return c.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        name,
      },
    });
  } catch (error: any) {
    console.error("❌ Error during signup:", error);
    return c.json({ error: error.message }, 500);
  }
});



app.get("/make-server-0a5eb56b/user/profile", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      console.error("❌ Auth error while fetching user profile. Error:", error?.message, "| Token prefix:", accessToken?.substring(0, 20));
      return c.json({ error: `Unauthorized - ${error?.message || "Invalid token"}` }, 401);
    }

    console.log(`📖 Fetching profile for user: ${user.id} (${user.email})`);

    let profile = await kv.get(`user:${user.id}`);

    if (!profile) {
      console.log(`📝 Profile not found in KV, auto-creating for: ${user.id}`);
      profile = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "Utilisateur",
        createdAt: new Date().toISOString(),
        subscription: "free",
        credits: {
          cv: 1,
          coverLetter: 0,
          atsAnalysis: 0,
          interview: 0,
        },
      };
      await kv.set(`user:${user.id}`, profile);
    }

    return c.json({ profile });
  } catch (error: any) {
    console.error("❌ Error fetching user profile:", error);
    return c.json({ error: error.message }, 500);
  }
});


app.put("/make-server-0a5eb56b/user/profile", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      console.error("❌ Auth error while updating user profile:", error);
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const updates = await c.req.json();
    console.log(`✏️ Updating profile for user: ${user.id}`);

    const currentProfile = await kv.get(`user:${user.id}`);

    if (!currentProfile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    const updatedProfile = {
      ...currentProfile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`user:${user.id}`, updatedProfile);

    return c.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error("❌ Error updating user profile:", error);
    return c.json({ error: error.message }, 500);
  }
});


app.get("/make-server-0a5eb56b/reussia/cvs", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    console.log(`📄 Fetching CVs for user: ${user.id}`);

    const cvs = await kv.getByPrefix(`cv:${user.id}:`);

    return c.json({ cvs: cvs || [] });
  } catch (error: any) {
    console.error("❌ Error fetching CVs:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-0a5eb56b/reussia/cvs", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const cvData = await c.req.json();
    const cvId = crypto.randomUUID();

    console.log(`💾 Saving new CV for user: ${user.id}, cvId: ${cvId}`);

    const cv = {
      id: cvId,
      userId: user.id,
      ...cvData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`cv:${user.id}:${cvId}`, cv);

    return c.json({ success: true, cv });
  } catch (error: any) {
    console.error("❌ Error saving CV:", error);
    return c.json({ error: error.message }, 500);
  }
});



app.get("/make-server-0a5eb56b/reussia/cover-letters", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    console.log(`✉️ Fetching cover letters for user: ${user.id}`);

    const letters = await kv.getByPrefix(`cover_letter:${user.id}:`);

    return c.json({ letters: letters || [] });
  } catch (error: any) {
    console.error("❌ Error fetching cover letters:", error);
    return c.json({ error: error.message }, 500);
  }
});


app.post("/make-server-0a5eb56b/reussia/cover-letters", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const letterData = await c.req.json();
    const letterId = crypto.randomUUID();

    console.log(`💾 Saving new cover letter for user: ${user.id}, letterId: ${letterId}`);

    const letter = {
      id: letterId,
      userId: user.id,
      ...letterData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`cover_letter:${user.id}:${letterId}`, letter);

    return c.json({ success: true, letter });
  } catch (error: any) {
    console.error("❌ Error saving cover letter:", error);
    return c.json({ error: error.message }, 500);
  }
});
app.post("/make-server-0a5eb56b/reussia/ats-analyze", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const { cvText, jobDescription } = await c.req.json();

    console.log(`🔍 Running ATS analysis for user: ${user.id}`);

    const analysis = {
      score: Math.floor(Math.random() * 30) + 70, // 70-100
      strengths: [
        "Mots-clés sectoriels bien présents",
        "Format optimisé pour les ATS",
        "Expérience pertinente bien mise en avant",
      ],
      weaknesses: [
        "Manque de compétences techniques spécifiques",
        "Section formation à détailler",
      ],
      missingKeywords: ["React", "TypeScript", "Gestion de projet", "Agile"],
      matchedKeywords: ["JavaScript", "Communication", "Travail d'équipe"],
      suggestions: [
        "Ajoutez des certifications pertinentes",
        "Quantifiez vos réalisations avec des chiffres",
        "Incluez plus de compétences techniques",
      ],
      analyzedAt: new Date().toISOString(),
    };

  
    const analysisId = crypto.randomUUID();
    await kv.set(`ats_analysis:${user.id}:${analysisId}`, {
      id: analysisId,
      userId: user.id,
      cvText,
      jobDescription,
      ...analysis,
    });

    return c.json({ success: true, analysis });
  } catch (error: any) {
    console.error("❌ Error running ATS analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-0a5eb56b/reussia/ats-analyses", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "Unauthorized - No token provided" }, 401);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: "Unauthorized - Invalid token" }, 401);

    const analyses = await kv.getByPrefix(`ats_analysis:${user.id}:`);
    return c.json({ analyses: analyses || [] });
  } catch (error: any) {
    console.error("Error fetching ATS analyses:", error);
    return c.json({ error: error.message }, 500);
  }
});




app.post("/make-server-0a5eb56b/oralia/questions", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const { jobTitle, difficulty } = await c.req.json();

    console.log(`🎤 Generating interview questions for user: ${user.id}, job: ${jobTitle}`);

    const questions = [
      {
        id: 1,
        question: "Parlez-moi de vous et de votre parcours.",
        category: "Introduction",
        difficulty: "easy",
      },
      {
        id: 2,
        question: "Pourquoi souhaitez-vous rejoindre notre entreprise ?",
        category: "Motivation",
        difficulty: "medium",
      },
      {
        id: 3,
        question: "Décrivez une situation où vous avez dû résoudre un conflit en équipe.",
        category: "Comportemental",
        difficulty: "medium",
      },
      {
        id: 4,
        question: "Quelles sont vos principales forces et faiblesses ?",
        category: "Compétences",
        difficulty: "easy",
      },
      {
        id: 5,
        question: "Où vous voyez-vous dans 5 ans ?",
        category: "Projection",
        difficulty: "medium",
      },
    ];

    return c.json({ success: true, questions });
  } catch (error: any) {
    console.error("❌ Error generating interview questions:", error);
    return c.json({ error: error.message }, 500);
  }
});


app.post("/make-server-0a5eb56b/oralia/analyze-answer", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const { question, answer } = await c.req.json();

    console.log(`📊 Analyzing interview answer for user: ${user.id}`);

  
    const feedback = {
      score: Math.floor(Math.random() * 30) + 70, // 70-100
      strengths: [
        "Structure claire de la réponse",
        "Exemples concrets fournis",
      ],
      improvements: [
        "Développer davantage les résultats obtenus",
        "Ajouter des données chiffrées",
      ],
      optimizedAnswer: `Voici une version optimisée de votre réponse:\n\n${answer}\n\n[Cette section contiendrait une réponse améliorée générée par l'IA]`,
      analyzedAt: new Date().toISOString(),
    };

    return c.json({ success: true, feedback });
  } catch (error: any) {
    console.error("❌ Error analyzing interview answer:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-0a5eb56b/oralia/sessions", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "Unauthorized - No token provided" }, 401);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: "Unauthorized - Invalid token" }, 401);

    const sessions = await kv.getByPrefix(`interview:${user.id}:`);
    return c.json({ sessions: sessions || [] });
  } catch (error: any) {
    console.error("Error fetching interview sessions:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-0a5eb56b/oralia/sessions", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "Unauthorized - No token provided" }, 401);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: "Unauthorized - Invalid token" }, 401);

    const sessionData = await c.req.json();
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      userId: user.id,
      ...sessionData,
      completedAt: new Date().toISOString(),
    };
    await kv.set(`interview:${user.id}:${sessionId}`, session);
    return c.json({ success: true, session });
  } catch (error: any) {
    console.error("Error saving interview session:", error);
    return c.json({ error: error.message }, 500);
  }
});



app.get("/make-server-0a5eb56b/trackia/applications", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    console.log(`📊 Fetching applications for user: ${user.id}`);

    const applications = await kv.getByPrefix(`application:${user.id}:`);

    return c.json({ applications: applications || [] });
  } catch (error: any) {
    console.error("❌ Error fetching applications:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-0a5eb56b/trackia/applications", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const applicationData = await c.req.json();
    const applicationId = crypto.randomUUID();

    console.log(`💾 Creating new application for user: ${user.id}, applicationId: ${applicationId}`);

    const application = {
      id: applicationId,
      userId: user.id,
      ...applicationData,
      status: applicationData.status || "sent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`application:${user.id}:${applicationId}`, application);

    return c.json({ success: true, application });
  } catch (error: any) {
    console.error("❌ Error creating application:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-0a5eb56b/trackia/applications/:id", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const applicationId = c.req.param("id");
    const updates = await c.req.json();

    console.log(`✏️ Updating application: ${applicationId} for user: ${user.id}`);

    const currentApplication = await kv.get(`application:${user.id}:${applicationId}`);

    if (!currentApplication) {
      return c.json({ error: "Application not found" }, 404);
    }

    const updatedApplication = {
      ...currentApplication,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`application:${user.id}:${applicationId}`, updatedApplication);

    return c.json({ success: true, application: updatedApplication });
  } catch (error: any) {
    console.error("❌ Error updating application:", error);
    return c.json({ error: error.message }, 500);
  }
});


app.delete("/make-server-0a5eb56b/trackia/applications/:id", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const applicationId = c.req.param("id");

    console.log(`🗑️ Deleting application: ${applicationId} for user: ${user.id}`);

    await kv.del(`application:${user.id}:${applicationId}`);

    return c.json({ success: true });
  } catch (error: any) {
    console.error("❌ Error deleting application:", error);
    return c.json({ error: error.message }, 500);
  }
});




app.post("/make-server-0a5eb56b/skillia/analyze-linkedin", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const { profileText } = await c.req.json();

    console.log(`🧠 Analyzing LinkedIn profile for user: ${user.id}`);

  
    const analysis = {
      score: Math.floor(Math.random() * 30) + 70, // 70-100
      strengths: [
        "Photo professionnelle présente",
        "Expériences bien détaillées",
      ],
      improvements: [
        "Ajouter un résumé personnalisé",
        "Enrichir la section compétences",
        "Obtenir plus de recommandations",
      ],
      suggestedSummary: "Professionnel passionné avec [X] années d'expérience dans [domaine]...",
      suggestedSkills: ["Leadership", "Communication", "Gestion de projet", "Analyse de données"],
      roadmap: [
        {
          step: 1,
          title: "Optimiser votre résumé",
          description: "Rédigez un résumé percutant de 3-4 phrases",
          priority: "high",
        },
        {
          step: 2,
          title: "Compléter les compétences",
          description: "Ajoutez 10-15 compétences clés",
          priority: "medium",
        },
        {
          step: 3,
          title: "Demander des recommandations",
          description: "Contactez 5 anciens collègues",
          priority: "medium",
        },
      ],
      analyzedAt: new Date().toISOString(),
    };

    return c.json({ success: true, analysis });
  } catch (error: any) {
    console.error("❌ Error analyzing LinkedIn profile:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-0a5eb56b/skillia/skill-suggestions", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];

    if (!accessToken) {
      return c.json({ error: "Unauthorized - No token provided" }, 401);
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

    if (error || !user) {
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }

    const { jobTitle } = await c.req.json();

    console.log(`💡 Generating skill suggestions for user: ${user.id}, job: ${jobTitle}`);
    const suggestions = {
      essentialSkills: [
        "JavaScript",
        "React",
        "TypeScript",
        "Node.js",
      ],
      recommendedSkills: [
        "Git",
        "Agile/Scrum",
        "Testing (Jest)",
        "CI/CD",
      ],
      bonusSkills: [
        "Docker",
        "AWS",
        "GraphQL",
        "Kubernetes",
      ],
    };

    return c.json({ success: true, suggestions });
  } catch (error: any) {
    console.error("❌ Error generating skill suggestions:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-0a5eb56b/reussia/ai/generate-cv", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: "Unauthorized" }, 401);

    const { fullName, email, phone, city, title, summary, experiences, education, skills, languages, targetJob } = await c.req.json();

    console.log(`🤖 AI CV generation for user: ${user.id}, target: ${targetJob}`);

    const systemPrompt = `Tu es un expert en recrutement et rédaction de CV en France. Tu aides les jeunes (étudiants, jeunes diplômés) à créer des CV percutants et optimisés pour les ATS (Applicant Tracking Systems).

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "summary": "Résumé professionnel optimisé (3-4 phrases percutantes)",
  "experiences": [
    {
      "title": "Titre du poste",
      "company": "Entreprise",
      "period": "Période",
      "description": "Description avec verbes d'action et résultats chiffrés (3-4 bullet points séparés par des retours à la ligne)"
    }
  ],
  "education": [
    {
      "degree": "Diplôme",
      "school": "Établissement",
      "period": "Période",
      "description": "Description courte"
    }
  ],
  "skills": "Compétences séparées par des virgules, optimisées pour le poste visé",
  "languages": "Langues avec niveaux"
}

Règles :
- Utilise des verbes d'action (Développé, Géré, Créé, Optimisé, etc.)
- Ajoute des résultats chiffrés quand possible (%, nombre, délais)
- Adapte le vocabulaire au poste visé
- Si des infos sont vides, génère des suggestions réalistes pour un jeune français
- Écris en français`;

    const userPrompt = `Poste visé : ${targetJob || "Non spécifié"}

Infos actuelles du candidat :
- Nom : ${fullName || "Non renseigné"}
- Titre : ${title || "Non renseigné"}
- Résumé actuel : ${summary || "Aucun"}
- Expériences : ${JSON.stringify(experiences || [])}
- Formation : ${JSON.stringify(education || [])}
- Compétences : ${skills || "Non renseignées"}
- Langues : ${languages || "Non renseignées"}

Génère un CV optimisé et professionnel. Si certaines sections sont vides, propose du contenu réaliste et pertinent pour un jeune candidat français visant ce type de poste.`;

    const aiResponse = await callOpenAI(systemPrompt, userPrompt, 2500);

   
    let cvData;
    try {
      
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      cvData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("❌ Failed to parse AI response as JSON:", parseError);
      console.log("Raw AI response:", aiResponse);
      return c.json({ error: "L'IA a renvoyé un format invalide. Réessayez." }, 500);
    }

    return c.json({ success: true, cvData });
  } catch (error: any) {
    console.error("❌ Error in AI CV generation:", error);
    return c.json({ error: error.message }, 500);
  }
});


app.post("/make-server-0a5eb56b/reussia/ai/generate-cover-letter", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: "Unauthorized" }, 401);

    const { companyName, jobTitle, jobDescription, tone, type, strengths, motivation } = await c.req.json();

    console.log(`🤖 AI cover letter generation for user: ${user.id}, company: ${companyName}`);

    const toneInstructions: Record<string, string> = {
      professionnel: "Ton professionnel et sérieux, adapté au monde de l'entreprise",
      dynamique: "Ton dynamique et enthousiaste, montrant de l'énergie et de la motivation",
      formel: "Ton très formel et respectueux, avec formules de politesse classiques",
      creatif: "Ton créatif et original, se démarquant des candidatures classiques",
    };

    const typeInstructions: Record<string, string> = {
      stage: "C'est une candidature pour un STAGE. Le candidat est étudiant.",
      alternance: "C'est une candidature pour une ALTERNANCE. Le candidat est étudiant en formation.",
      emploi: "C'est une candidature pour un EMPLOI (CDI/CDD). Le candidat cherche son premier emploi ou est jeune diplômé.",
      parcoursup: "C'est une lettre de motivation pour PARCOURSUP (admission en formation). Le candidat est lycéen ou étudiant.",
    };

    const systemPrompt = `Tu es un expert en rédaction de lettres de motivation en France, spécialisé dans l'accompagnement des jeunes (étudiants, lycéens, jeunes diplômés).

${typeInstructions[type] || typeInstructions.stage}
${toneInstructions[tone] || toneInstructions.professionnel}

Règles :
- Écris une lettre complète et prête à envoyer
- Commence par "Objet : Candidature..." 
- Structure : Introduction accrocheur → Parcours/compétences → Pourquoi cette entreprise → Conclusion avec appel à l'action
- Adapte le vocabulaire au secteur d'activité
- Sois spécifique : mentionne l'entreprise et le poste par leur nom
- Termine par une formule de politesse appropriée
- Écris en français
- Ne mets PAS de crochets [] à remplir, la lettre doit être complète
- Génère directement le texte brut (pas de JSON, pas de markdown)`;

    const userPrompt = `Entreprise : ${companyName || "Non spécifiée"}
Poste/Formation : ${jobTitle || "Non spécifié"}
Description de l'offre : ${jobDescription || "Non fournie"}
Points forts du candidat : ${strengths || "Non spécifiés"}
Motivation pour cette entreprise : ${motivation || "Non spécifiée"}

Rédige une lettre de motivation complète, personnalisée et percutante.`;

    const letterContent = await callOpenAI(systemPrompt, userPrompt, 2000);

    return c.json({ success: true, letterContent });
  } catch (error: any) {
    console.error("❌ Error in AI cover letter generation:", error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-0a5eb56b/reussia/ai/ats-analyze", async (c) => {
  try {
    const accessToken = c.req.header("Authorization")?.split(" ")[1];
    if (!accessToken) return c.json({ error: "Unauthorized" }, 401);

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !user) return c.json({ error: "Unauthorized" }, 401);

    const { cvText, jobDescription } = await c.req.json();

    console.log(`🤖 AI ATS analysis for user: ${user.id}`);

    const systemPrompt = `Tu es un expert en recrutement et systèmes ATS (Applicant Tracking Systems). Tu analyses des CV par rapport à des offres d'emploi pour évaluer leur compatibilité.

Réponds UNIQUEMENT en JSON valide avec cette structure exacte :
{
  "score": 75,
  "matchedKeywords": ["mot1", "mot2"],
  "missingKeywords": ["mot3", "mot4"],
  "suggestions": [
    "Suggestion d'amélioration 1",
    "Suggestion d'amélioration 2"
  ],
  "sections": [
    {
      "name": "Nom de la section",
      "score": 85,
      "status": "good",
      "feedback": "Commentaire sur cette section"
    }
  ]
}

Règles pour le score :
- 90-100 : Excellent matching
- 75-89 : Bon matching avec des améliorations possibles
- 60-74 : Matching moyen, des ajustements nécessaires
- <60 : Faible matching, refonte nécessaire

Sections à évaluer :
1. "Format & Lisibilité" - Le CV est-il bien structuré pour un ATS ?
2. "Mots-clés techniques" - Les compétences techniques correspondent-elles ?
3. "Expérience" - L'expérience est-elle pertinente et bien décrite ?
4. "Formation" - La formation est-elle adaptée ?
5. "Compétences manquantes" - Quelles compétences clés manquent ?
6. "Personnalisation" - Le CV est-il adapté à cette offre spécifique ?

Le "status" est "good" si score >= 80, "warning" si 60-79, "bad" si < 60.
Sois précis et concret dans tes suggestions.`;

    const userPrompt = `CONTENU DU CV :
${cvText || "Aucun CV fourni"}

DESCRIPTION DE L'OFFRE D'EMPLOI :
${jobDescription || "Aucune offre fournie"}

Analyse ce CV par rapport à cette offre et donne un score ATS détaillé.`;

    const aiResponse = await callOpenAI(systemPrompt, userPrompt, 2500);

    let analysisData;
    try {
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || aiResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiResponse;
      analysisData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("❌ Failed to parse AI ATS response:", parseError);
      console.log("Raw AI response:", aiResponse);
      return c.json({ error: "L'IA a renvoyé un format invalide. Réessayez." }, 500);
    }
    const analysisId = crypto.randomUUID();
    await kv.set(`ats_analysis:${user.id}:${analysisId}`, {
      id: analysisId,
      userId: user.id,
      ...analysisData,
      analyzedAt: new Date().toISOString(),
    });

    return c.json({ success: true, analysis: analysisData });
  } catch (error: any) {
    console.error("❌ Error in AI ATS analysis:", error);
    return c.json({ error: error.message }, 500);
  }
});



Deno.serve(app.fetch);
