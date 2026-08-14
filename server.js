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
  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt, history, image } = req.body;
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

      const systemInstruction =
        "Tu es KA-Farm Agro-Advisor, un conseiller horticole et maraîcher expert d'Afrique de l'Ouest (Sénégal), chaleureux, pragmatique, direct et scientifique. Tu réponds en français. Tu es spécialisé exclusivement dans le maraîchage (cultures de légumes, fines herbes, fruits de jardin, pépinières, irrigation goutte-à-goutte ou aspersion, maladies horticoles comme la mineuse de la tomate Tuta absoluta, le mildiou, l'oïdium, les thrips, et l'usage de biopesticides locaux comme le neem ou le piment). Tu aides à diagnostiquer les ravageurs et maladies des légumes, planifier les pépinières maraîchères et le repiquage, optimiser l'arrosage et les amendements (compost organique, fumier) de manière écologique et agroécologique. Donne des réponses concises, claires, structurées et adaptées aux conditions locales ouest-africaines.";

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

      const modelName = "gemini-2.5-flash";
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

      const response = await ai.models.generateContent({
        model: modelName,
        contents:
          contents.length > 0 ? [...contents, { role: "user", parts: requestParts }] : requestParts,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const text = response.text;

      if (!text) {
        throw new Error("Impossible de générer une réponse de l'IA.");
      }

      return res.json({ text });
    } catch (error) {
      logger.error("Error calling Gemini API", { error: error.message });
      return res.status(500).json({ error: error.message || "Erreur interne de l'API" });
    }
  });

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
