/**
 * Serveur local de développement uniquement - ne pas déployer en production
 * La production sur Vercel utilise api/index.js à la place
 */
import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cors from "cors";
import { logger } from "./js/modules/logger.js";
import {
  validateData,
  UserSchema,
  ParcelleSchema,
  CropSchema,
  TreatmentSchema,
  FinanceSchema,
  EmployeeSchema,
  StockSchema,
  HarvestSchema,
  SaleSchema,
  TaskSchema,
} from "./js/modules/validators.js";
import { z } from "zod";

dotenv.config();

// Middleware de sécurité
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, veuillez réessayer dans 15 minutes." },
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes for API writes
  max: 30, // stricter limit for mutations
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de modifications, veuillez réessayer dans 5 minutes." },
});

// Remarque : le code PostgreSQL/Supabase a été retiré du serveur de développement selon le cahier des charges.

async function startServer() {
  const app = express();

  // En-têtes de sécurité
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          connectSrc: [
            "'self'",
            "https://api.open-meteo.com",
            "https://generativelanguage.googleapis.com",
          ],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // Configuration CORS
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",") || [
        "http://localhost:3000",
        "http://localhost:5173",
      ],
      credentials: true,
      optionsSuccessStatus: 204,
    })
  );

  // Limitation de débit
  app.use("/api/", limiter);
  app.use("/api/", apiLimiter);

  app.use(express.json({ limit: "12mb" }));

  // Stockages de repli en mémoire (utilisés lorsque PostgreSQL n'est pas disponible)
  let serverMessages = [];
  let serverStocks = [];
  let serverCrops = [];
  let serverParcelles = [];
  let serverTasks = [];
  let serverFinances = [];
  let serverEmployees = [];
  let serverCheptel = [];
  let serverElevageProduction = [];
  let serverElevageHealth = [];
  let serverTreatments = [];
  let serverCropProfits = [];

  // ==================== MESSAGES ====================
  app.get("/api/messages", async (req, res) => {
    res.json(serverMessages);
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const { id, senderEmail, senderName, text, timestamp, isPrivate } = req.body;
      if (!text || !senderEmail) {
        return res.status(400).json({ error: "Email et texte requis" });
      }

      const newMsg = {
        id: id || "msg-" + Date.now(),
        senderEmail,
        senderName: senderName || senderEmail,
        text,
        timestamp: timestamp || new Date().toISOString(),
        isPrivate: !!isPrivate,
      };

      serverMessages.push(newMsg);
      res.json({ success: true, message: newMsg });
    } catch (err) {
      logger.error("Error saving message", { error: err.message });
      res.status(400).json({ error: err.message || "Erreur de validation" });
    }
  });

  // ==================== TRAITEMENTS PHYTOSANITAIRES ====================
  app.get("/api/treatments", async (req, res) => {
    res.json(serverTreatments);
  });

  app.post("/api/treatments", async (req, res) => {
    const treatment = req.body;

    // Validation avec Zod
    const validation = validateData(TreatmentSchema, treatment);
    if (!validation.success) {
      logger.warn("Treatment validation failed", { errors: validation.errors });
      return res.status(400).json({ error: "Données invalides", details: validation.errors });
    }

    if (!treatment || !treatment.id || !treatment.product_name) {
      return res.status(400).json({ error: "ID et nom du produit requis" });
    }

    const existing = serverTreatments.find((t) => t.id === treatment.id);
    if (existing) {
      const idx = serverTreatments.findIndex((t) => t.id === treatment.id);
      serverTreatments[idx] = { ...existing, ...treatment };
    } else {
      serverTreatments.push(treatment);
    }
    logger.info("Treatment saved to memory", { treatmentId: treatment.id });
    res.json({ success: true, treatment });
  });

  app.post("/api/treatments/sync", async (req, res) => {
    const { treatments } = req.body;
    if (treatments && Array.isArray(treatments)) {
      serverTreatments = treatments;
      res.json({ success: true, message: "Traitements synchronisés en mémoire", treatments });
    } else {
      res.status(400).json({ error: "Données de traitements invalides" });
    }
  });

  // ==================== CROP PROFITABILITY ====================
  app.get("/api/crop-profits", async (req, res) => {
    res.json(serverCropProfits);
  });

  app.post("/api/crop-profits", async (req, res) => {
    const profit = req.body;
    if (!profit || !profit.id || !profit.crop_name) {
      return res.status(400).json({ error: "ID et nom de la culture requis" });
    }

    const existing = serverCropProfits.find((p) => p.id === profit.id);
    if (existing) {
      const idx = serverCropProfits.findIndex((p) => p.id === profit.id);
      serverCropProfits[idx] = { ...existing, ...profit };
    } else {
      serverCropProfits.push(profit);
    }
    res.json({ success: true, profit });
  });

  app.post("/api/crop-profits/sync", async (req, res) => {
    const { cropProfits } = req.body;
    if (cropProfits && Array.isArray(cropProfits)) {
      serverCropProfits = cropProfits;
      res.json({
        success: true,
        message: "Analyses de rentabilité synchronisées en mémoire",
        cropProfits,
      });
    } else {
      res.status(400).json({ error: "Données de rentabilité invalides" });
    }
  });

  // ==================== STOCKS ====================
  app.get("/api/stocks", async (req, res) => {
    res.json(serverStocks);
  });

  app.post("/api/stocks", async (req, res) => {
    const { stocks } = req.body;
    if (stocks && Array.isArray(stocks)) {
      serverStocks = stocks;
      res.json({ success: true, message: "Stocks synchronisés en mémoire", stocks });
    } else {
      res.status(400).json({ error: "Données de stock invalides" });
    }
  });

  // ==================== CROPS ====================
  app.get("/api/crops", async (req, res) => {
    res.json(serverCrops);
  });

  app.post("/api/crops", async (req, res) => {
    const crop = req.body;
    if (!crop || !crop.id || !crop.name) {
      return res.status(400).json({ error: "ID et nom requis" });
    }

    const existing = serverCrops.find((c) => c.id === crop.id);
    if (existing) {
      const idx = serverCrops.findIndex((c) => c.id === crop.id);
      serverCrops[idx] = { ...existing, ...crop };
    } else {
      serverCrops.push(crop);
    }
    res.json({ success: true, crop });
  });

  // ==================== PARCELLES ====================
  app.get("/api/parcelles", async (req, res) => {
    res.json(serverParcelles);
  });

  app.post("/api/parcelles", async (req, res) => {
    const parcelle = req.body;

    // Validation with Zod
    const validation = validateData(ParcelleSchema, parcelle);
    if (!validation.success) {
      logger.warn("Parcelle validation failed", { errors: validation.errors });
      return res.status(400).json({ error: "Données invalides", details: validation.errors });
    }

    if (!parcelle || !parcelle.id || !parcelle.name) {
      return res.status(400).json({ error: "ID et nom requis" });
    }

    const existing = serverParcelles.find((p) => p.id === parcelle.id);
    if (existing) {
      const idx = serverParcelles.findIndex((p) => p.id === parcelle.id);
      serverParcelles[idx] = { ...existing, ...parcelle };
    } else {
      serverParcelles.push(parcelle);
    }
    logger.info("Parcelle saved to memory", { parcelleId: parcelle.id });
    res.json({ success: true, parcelle });
  });

  // ==================== TASKS ====================
  app.get("/api/tasks", async (req, res) => {
    res.json(serverTasks);
  });

  app.post("/api/tasks", async (req, res) => {
    const task = req.body;
    if (!task || !task.id || !task.title) {
      return res.status(400).json({ error: "ID et titre requis" });
    }

    const existing = serverTasks.find((t) => t.id === task.id);
    if (existing) {
      const idx = serverTasks.findIndex((t) => t.id === task.id);
      serverTasks[idx] = { ...existing, ...task };
    } else {
      serverTasks.push(task);
    }
    res.json({ success: true, task });
  });

  // ==================== FINANCES ====================
  app.get("/api/finances", async (req, res) => {
    res.json(serverFinances);
  });

  app.post("/api/finances", async (req, res) => {
    const finance = req.body;
    if (!finance || !finance.id || !finance.description) {
      return res.status(400).json({ error: "ID et description requis" });
    }

    const existing = serverFinances.find((f) => f.id === finance.id);
    if (existing) {
      const idx = serverFinances.findIndex((f) => f.id === finance.id);
      serverFinances[idx] = { ...existing, ...finance };
    } else {
      serverFinances.push(finance);
    }
    res.json({ success: true, finance });
  });

  // ==================== EMPLOYEES ====================
  app.get("/api/employees", async (req, res) => {
    res.json(serverEmployees);
  });

  app.post("/api/employees", async (req, res) => {
    const employee = req.body;
    if (!employee || !employee.id || !employee.name) {
      return res.status(400).json({ error: "ID et nom requis" });
    }

    const existing = serverEmployees.find((e) => e.id === employee.id);
    if (existing) {
      const idx = serverEmployees.findIndex((e) => e.id === employee.id);
      serverEmployees[idx] = { ...existing, ...employee };
    } else {
      serverEmployees.push(employee);
    }
    res.json({ success: true, employee });
  });

  // ==================== ELEVAGE / CHEPTEL ====================
  app.get("/api/cheptel", async (req, res) => {
    res.json(serverCheptel);
  });

  app.post("/api/cheptel", async (req, res) => {
    const group = req.body;
    if (!group || !group.id || !group.name) {
      return res.status(400).json({ error: "ID et nom requis" });
    }

    const existing = serverCheptel.find((c) => c.id === group.id);
    if (existing) {
      const idx = serverCheptel.findIndex((c) => c.id === group.id);
      serverCheptel[idx] = { ...existing, ...group };
    } else {
      serverCheptel.push(group);
    }
    res.json({ success: true, group });
  });

  // ==================== ELEVAGE PRODUCTION ====================
  app.get("/api/elevage/production", async (req, res) => {
    const sorted = serverElevageProduction.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  });

  app.post("/api/elevage/production", async (req, res) => {
    const log = req.body;
    if (!log || !log.id || !log.type) {
      return res.status(400).json({ error: "ID et type requis" });
    }

    serverElevageProduction.push(log);
    res.json({ success: true, log });
  });

  // ==================== ELEVAGE HEALTH ====================
  app.get("/api/elevage/health", async (req, res) => {
    const sorted = serverElevageHealth.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  });

  app.post("/api/elevage/health", async (req, res) => {
    const log = req.body;
    if (!log || !log.id || !log.intervention) {
      return res.status(400).json({ error: "ID et intervention requis" });
    }

    serverElevageHealth.push(log);
    res.json({ success: true, log });
  });

  // ==================== GEMINI AI ====================
  // Prompts système spécialisés par agent
  const AI_SYSTEM_PROMPTS = {
    advisor: `Tu es KA-Farm Agro-Advisor, un conseiller horticole et maraîcher expert d'Afrique de l'Ouest (Sénégal), chaleureux, pragmatique, direct et scientifique. Tu réponds en français. Tu es spécialisé exclusivement dans le maraîchage (cultures de légumes, fines herbes, fruits de jardin, pépinières, irrigation goutte-à-goutte ou aspersion, maladies horticoles comme la mineuse de la tomate Tuta absoluta, le mildiou, l'oïdium, les thrips, et l'usage de biopesticides locaux comme le neem ou le piment). Tu aides à diagnostiquer les ravageurs et maladies des légumes, planifier les pépinières maraîchères et le repiquage, optimiser l'arrosage et les amendements (compost organique, fumier) de manière écologique et agroécologique. Donne des réponses concises, claires, structurées et adaptées aux conditions locales ouest-africaines.`,

    plantDoctor: `Tu es KA-Farm Doctor Plante, un expert phytosanitaire horticole spécialisé dans le diagnostic visuel des maladies et carences des légumes en Afrique de l'Ouest (Sénégal). Analyse cette photo de culture et fournis un diagnostic structuré en français avec : 1) Nom probable de la maladie/carence (si identifiable), 2) Niveau de gravité (Faible/Moyen/Élevé/Critique), 3) Action de traitement recommandée (produit bio ou chimique, dosage, fréquence), 4) Prévention. Sois direct, scientifique et adapté aux conditions locales. Si l'image n'est pas claire ou ne montre pas de problème visible, indique-le honnêtement.`,

    livestock: `Tu es KA-Farm Conseiller Élevage, expert en production animale en Afrique de l'Ouest. Spécialisé dans : bovins, ovins, caprins, volailles au Sénégal. Conseils sur : alimentation, santé animale, reproduction, logement, prophylaxie. Réponds en français avec des solutions locales et abordables.`,

    finance: `Tu es KA-Farm Analyste Financier Agricole, expert en gestion financière des exploitations agricoles. Aide à : analyser la rentabilité des cultures, optimiser les dépenses, prévoir les revenus, conseiller sur les prix du marché (marchés sénégalais), suggestions de diversification. Réponds en français avec des chiffres concrets adaptés au contexte sénégalais.`,

    irrigation: `Tu es KA-Farm Expert Irrigation & Météo, spécialisé en gestion de l'eau pour l'agriculture sahélienne. Conseils sur : irrigation goutte-à-goutte, aspersion, calendrier d'arrosage selon les saisons, gestion de la sécheresse, optimisation de l'eau, drainage. Réponds en français avec des solutions adaptées au climat sénégalais.`,

    soil: `Tu es KA-Farm Expert Sol & Compost, spécialisé en agroécologie et fertilité des sols au Sénégal. Conseils sur : fabrication de compost, fumier, amendements organiques, rotation des cultures, analyse du sol (sableux, limoneux, argileux), couverture végétale. Réponds en français avec des techniques locales et écologiques.`,

    personal: `Tu es KA-Farm Assistant Personnel Agricole. Tu aides l'agriculteur à organiser son travail quotidien : planification des tâches, rappels, suivi des cultures, gestion du temps. Sois amical, motivateur et pratique. Réponds en français.`,

    wolofAdvisor: `Ña ng ci KA-Farm Agro-Advisor, jàngoro bu am solo ci mbey mi ci Sénégal. Maa ngiy faj ay jàngoro yu mel ni: mbey, garab, àndi ndox, ay jàkka, ay garab yu bon. Maa ngiy wax ci Wolof ak Français. Na nga may ay mbir yu am solo ci sa mbey mi.`,
  };

  // Helper pour construire le contexte RAG de l'exploitation
  function buildFarmContext(agentType) {
    try {
      const context = [];
      if (["advisor", "plantDoctor", "finance"].includes(agentType) && serverCrops.length) {
        context.push(`Cultures actuelles: ${serverCrops.slice(0, 5).map(c => `${c.name} (${c.field || '?'}) - ${c.status || '?'}`).join(', ')}`);
      }
      if (["livestock"].includes(agentType) && serverCheptel.length) {
        context.push(`Cheptel: ${serverCheptel.map(c => `${c.name}: ${c.quantity} ${c.unit || 'têtes'} (${c.status || '?'})`).join(', ')}`);
      }
      if (["finance"].includes(agentType) && serverFinances.length) {
        const revenus = serverFinances.filter(f => f.type === 'Revenu').reduce((a, b) => a + (b.amount || 0), 0);
        const depenses = serverFinances.filter(f => f.type === 'Dépense').reduce((a, b) => a + (b.amount || 0), 0);
        context.push(`Finances: Revenus ${revenus}F, Dépenses ${depenses}F`);
      }
      if (["irrigation"].includes(agentType) && serverParcelles.length) {
        context.push(`Parcelles: ${serverParcelles.map(p => `${p.name} (${p.surface}m², ${p.type_sol || '?'})`).join(', ')}`);
      }
      return context.length ? `\n\n--- CONTEXTE DE VOTRE EXPLOITATION ---\n${context.join('\n')}` : "";
    } catch (e) {
      return "";
    }
  }

  // Helper pour appeler Gemini avec retry
  async function callGeminiWithRetry(ai, model, contents, systemInstruction) {
    const modelsToTry = [model, "gemini-3.6-flash", "gemini-3.5-flash-lite"];
    let response = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      for (const m of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: m,
            contents,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });
          if (response && response.text) {
            return response;
          }
        } catch (err) {
          lastError = err;
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        }
      }
    }
    throw lastError || new Error("Impossible de générer une réponse de l'IA après plusieurs tentatives");
  }

  // Route principale Gemini améliorée avec agents spécialisés + RAG
  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt, history, image, systemPrompt, model, agentType = "advisor" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt requis" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé GEMINI_API_KEY non configurée" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let systemInstruction = systemPrompt || AI_SYSTEM_PROMPTS[agentType] || AI_SYSTEM_PROMPTS.advisor;

      if (image && !systemPrompt && agentType === "advisor") {
        systemInstruction = AI_SYSTEM_PROMPTS.plantDoctor;
      }

      const ragContext = buildFarmContext(agentType);
      const enhancedPrompt = ragContext ? `${prompt}${ragContext}` : prompt;

      const contents = [];
      if (history && Array.isArray(history) && history.length > 0) {
        history.forEach((m) => {
          if (!m?.text) return;
          contents.push({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
          });
        });
      }

      const requestParts = [{ text: enhancedPrompt }];
      if (image) {
        const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (!mimeMatch) {
          return res.status(400).json({ error: "Format d'image invalide" });
        }
        requestParts.push({
          inlineData: {
            mimeType: mimeMatch[1],
            data: image.split(",")[1],
          },
        });
      }

      const finalContents = contents.length > 0
        ? [...contents, { role: "user", parts: requestParts }]
        : requestParts;

      const response = await callGeminiWithRetry(ai, model || "gemini-3.6-flash", finalContents, systemInstruction);

      return res.json({ text: response.text });
    } catch (error) {
      // Logger l'erreur exacte renvoyée par l'API Gemini (clé invalide, quota dépassé, mauvais nom de modèle, etc.)
      logger.error("Error calling Gemini API", {
        message: error.message,
        status: error.status,
        code: error.code,
        errorDetails: error.errorDetails,
        stack: error.stack,
      });
      return res.status(500).json({ error: error.message || "Erreur interne de l'API" });
    }
  });

  // ==================== OPENAI FALLBACK ====================
  app.post("/api/ai/openai", async (req, res) => {
    try {
      const { prompt, systemPrompt, history, image, model = "gpt-4o-mini" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt requis" });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé OPENAI_API_KEY non configurée" });
      }

      const messages = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      if (history && Array.isArray(history)) {
        history.forEach((m) => {
          if (!m?.text) return;
          messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
        });
      }

      const content = [];
      content.push({ type: "text", text: prompt });
      if (image) {
        const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (!mimeMatch) {
          return res.status(400).json({ error: "Format d'image invalide" });
        }
        content.push({
          type: "image_url",
          image_url: { url: image },
        });
      }
      messages.push({ role: "user", content });

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("Aucune réponse générée par OpenAI");
      }

      return res.json({ text, provider: "openai" });
    } catch (error) {
      logger.error("Error calling OpenAI API", { error: error.message });
      return res.status(500).json({ error: error.message || "Erreur interne de l'API" });
    }
  });

  // ==================== CLAUDE FALLBACK ====================
  app.post("/api/ai/claude", async (req, res) => {
    try {
      const { prompt, systemPrompt, history, image, model = "claude-3-5-haiku-latest" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt requis" });
      }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé ANTHROPIC_API_KEY non configurée" });
      }

      const messages = [];
      if (history && Array.isArray(history)) {
        history.forEach((m) => {
          if (!m?.text) return;
          messages.push({ role: m.role === "user" ? "user" : "assistant", content: m.text });
        });
      }

      let content = prompt;
      if (image) {
        const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (!mimeMatch) {
          return res.status(400).json({ error: "Format d'image invalide" });
        }
        content = [
          { type: "text", text: prompt },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeMatch[1],
              data: image.split(",")[1],
            },
          },
        ];
      }
      messages.push({ role: "user", content });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          system: systemPrompt || "Tu es KA-Farm Agro-Advisor, un conseiller agricole expert du Sénégal.",
          messages,
          max_tokens: 2048,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Claude API error: ${response.status}`);
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) {
        throw new Error("Aucune réponse générée par Claude");
      }

      return res.json({ text, provider: "claude" });
    } catch (error) {
      logger.error("Error calling Claude API", { error: error.message });
      return res.status(500).json({ error: error.message || "Erreur interne de l'API" });
    }
  });

  // ==================== STREAMING SSE ====================
  app.post("/api/ai/stream", async (req, res) => {
    try {
      const { prompt, systemPrompt, history, image, language = "fr", agentType = "advisor" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt requis" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé GEMINI_API_KEY non configurée" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let systemInstruction = systemPrompt || AI_SYSTEM_PROMPTS[agentType] || AI_SYSTEM_PROMPTS.advisor;
      if (language === "wo") {
        systemInstruction = AI_SYSTEM_PROMPTS.wolofAdvisor;
      }

      const contents = [];
      if (history && Array.isArray(history) && history.length > 0) {
        history.forEach((m) => {
          if (!m?.text) return;
          contents.push({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.text }],
          });
        });
      }

      const requestParts = [{ text: prompt }];
      if (image) {
        const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
        if (!mimeMatch) {
          return res.status(400).json({ error: "Format d'image invalide" });
        }
        requestParts.push({
          inlineData: {
            mimeType: mimeMatch[1],
            data: image.split(",")[1],
          },
        });
      }

      const finalContents = contents.length > 0
        ? [...contents, { role: "user", parts: requestParts }]
        : requestParts;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const stream = await ai.models.generateContentStream({
          model: "gemini-3.6-flash",
          contents: finalContents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (streamError) {
        res.write(`data: ${JSON.stringify({ error: streamError.message })}\n\n`);
        res.end();
      }
    } catch (error) {
      logger.error("Error in AI streaming", { error: error.message });
      res.status(500).json({ error: error.message || "Erreur interne de l'API" });
    }
  });

  // ==================== AGENTS IA ====================
  app.get("/api/ai/agents", (req, res) => {
    const agents = Object.keys(AI_SYSTEM_PROMPTS).map((key) => ({
      id: key,
      name: getAgentDisplayName(key),
      description: getAgentDescription(key),
    }));
    res.json(agents);
  });

  // ==================== TRADUCTION ====================
  app.post("/api/ai/translate", async (req, res) => {
    try {
      const { text, fromLang = "fr", toLang = "wo" } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Texte requis" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Clé GEMINI_API_KEY non configurée" });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Traduis ce texte du ${fromLang} au ${toLang} : "${text}". Réponds UNIQUEMENT avec la traduction, sans explications.`,
              },
            ],
          },
        ],
        config: {
          systemInstruction: "Tu es un traducteur expert. Traduis fidèlement le texte fourni.",
          temperature: 0.3,
        },
      });

      return res.json({ text: response.text });
    } catch (error) {
      logger.error("Error translating", { error: error.message });
      return res.status(500).json({ error: error.message || "Erreur de traduction" });
    }
  });

  // Helpers pour les noms d'agents
  function getAgentDisplayName(id) {
    const names = {
      advisor: "Conseiller Horticole IA",
      plantDoctor: "Docteur Plante IA",
      livestock: "Conseiller Élevage IA",
      finance: "Analyste Financier IA",
      irrigation: "Expert Irrigation IA",
      soil: "Expert Sol & Compost IA",
      personal: "Assistant Personnel IA",
      wolofAdvisor: "Conseiller en Wolof",
    };
    return names[id] || `Agent ${id}`;
  }

  function getAgentDescription(id) {
    const descs = {
      advisor: "Conseils maraîchage, maladies, traitements bio",
      plantDoctor: "Diagnostic visuel des maladies des plantes",
      livestock: "Soins, alimentation et reproduction animale",
      finance: "Rentabilité, budget et analyse financière",
      irrigation: "Gestion de l'eau et calendrier d'arrosage",
      soil: "Compost, amendements et fertilité des sols",
      personal: "Organisation des tâches et suivi quotidien",
      wolofAdvisor: "Nga wax ci Wolof, mbey mi ci Sénégal",
    };
    return descs[id] || "";
  }

  // ==================== WEATHER ====================
  app.get("/api/weather", async (req, res) => {
    try {
      const { lat, lon } = req.query;
      if (!lat || !lon) {
        return res.status(400).json({ error: "Coordonnées lat et lon requises" });
      }

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo API returned status ${response.status}`);
      }
      const data = await response.json();
      return res.json({
        temp: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        precipitation: data.current.precipitation,
        weather_code: data.current.weather_code,
        wind_speed: data.current.wind_speed_10m,
      });
    } catch (error) {
      logger.error("Error fetching weather", { error: error.message });
      return res.status(500).json({ error: "Erreur lors de la récupération des données météo" });
    }
  });

  const isProd = process.env.NODE_ENV === "production";

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "mpa",
    });
    app.use(vite.middlewares);
  } else {
    // Servir les fichiers statiques depuis le dossier pages/ (pour les pages HTML partagées)
    app.use("/pages", express.static(path.resolve("pages"), { extensions: ["html"] }));

    // Servir les fichiers statiques du build Vite (dist/)
    app.use(express.static(path.resolve("dist"), { extensions: ["html"] }));

    // Servir les assets (images, CSS, JS) depuis la racine
    app.use("/assets", express.static(path.resolve("assets")));
    app.use("/css", express.static(path.resolve("css")));
    app.use("/js", express.static(path.resolve("js")));

    // Route par défaut pour les requêtes non correspondantes
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${port}`);
    console.log(`Mode: localStorage + Firebase sync`);
    console.log(`Security: Rate limiting + Helmet + CORS enabled`);
  });
}

startServer().catch((err) => {
  logger.error("Failed to start server", { error: err.message });
});
