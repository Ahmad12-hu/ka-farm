import express from "express";
import jwt from "jsonwebtoken";
import { GoogleGenAI } from "@google/genai";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "../js/modules/logger.js";
import { z } from "zod";
import { Cache } from "../js/modules/cache.js";
import { verifyPassword } from "../js/modules/crypto.js";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Validation schemas for API inputs
const CropSchema = z.object({
  id: z.string().min(1, "ID requis"),
  name: z.string().min(1, "Nom requis"),
  field: z.string().optional(),
  sowingDate: z.string().optional(),
  harvestDate: z.string().optional(),
  status: z.string().optional(),
  waterStatus: z.string().optional(),
  fertilizerStatus: z.string().optional(),
});

const ParcelleSchema = z.object({
  id: z.string().min(1, "ID requis"),
  name: z.string().min(1, "Nom requis"),
  surface: z.number().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  status: z.string().optional(),
});

const EmployeeSchema = z.object({
  id: z.string().min(1, "ID requis"),
  name: z.string().min(1, "Nom requis"),
  phone: z.string().optional(),
  role: z.string().optional(),
  dailyRate: z.number().optional(),
  status: z.string().optional(),
});

const FinanceSchema = z.object({
  id: z.string().min(1, "ID requis"),
  description: z.string().min(1, "Description requise"),
  type: z.enum(["Revenu", "Dépense"]).optional(),
  category: z.string().optional(),
  amount: z.number().positive("Montant doit être positif").optional(),
  date: z.string().optional(),
});

const TaskSchema = z.object({
  id: z.string().min(1, "ID requis"),
  title: z.string().min(1, "Titre requis"),
  category: z.string().optional(),
  dueDate: z.string().optional(),
  assignee: z.string().optional(),
  priority: z.string().optional(),
  completed: z.boolean().optional(),
});

const CheptelSchema = z.object({
  id: z.string().min(1, "ID requis"),
  name: z.string().min(1, "Nom requis"),
  type: z.string().optional(),
  breed: z.string().optional(),
  quantity: z.number().int().positive("Quantité doit être positive").optional(),
  unit: z.string().optional(),
  status: z.string().optional(),
  purpose: z.string().optional(),
});

const ElevageProductionSchema = z.object({
  id: z.string().min(1, "ID requis"),
  date: z.string().min(1, "Date requise"),
  type: z.string().min(1, "Type requis"),
  quantity: z.number().positive("Quantité doit être positive").optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
});

const ElevageHealthSchema = z.object({
  id: z.string().min(1, "ID requis"),
  date: z.string().min(1, "Date requise"),
  target: z.string().min(1, "Cible requise"),
  intervention: z.string().min(1, "Intervention requise"),
  practitioner: z.string().optional(),
  cost: z.number().nonnegative("Coût doit être positif").optional(),
  notes: z.string().optional(),
});

const MessageSchema = z.object({
  id: z.string().optional(),
  senderEmail: z.string().email("Email invalide").min(1, "Email requis"),
  senderName: z.string().optional(),
  text: z.string().min(1, "Message requis"),
  timestamp: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

const TreatmentSchema = z.object({
  id: z.string().min(1, "ID requis"),
  product_name: z.string().min(1, "Nom du produit requis"),
  parcel_id: z.string().optional(),
  crop_id: z.string().optional(),
  crop_name: z.string().optional(),
  parcel_name: z.string().optional(),
  category: z.string().optional(),
  date_applied: z.string().optional(),
  dar_days: z.number().optional(),
  target: z.string().optional(),
  notes: z.string().optional(),
  harvest_ready: z.boolean().optional(),
});

const CropProfitSchema = z.object({
  id: z.string().min(1, "ID requis"),
  crop_name: z.string().min(1, "Nom de la culture requis"),
  parcel_id: z.string().optional(),
  parcel_name: z.string().optional(),
  yield_kg: z.number().optional(),
  price_per_kg: z.number().optional(),
  revenue: z.number().optional(),
  costs: z.number().optional(),
  total_cost: z.number().optional(),
  net_margin: z.number().optional(),
  profitability_percent: z.number().optional(),
  period: z.string().optional(),
  notes: z.string().optional(),
});

// Aide pour vérifier si nous sommes en mode production
function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

function getJwtSecret() {
  const configuredSecret = (process.env.JWT_SECRET || "").trim();
  if (configuredSecret) return configuredSecret;

  if (!isProduction()) {
    // Solution de repli pour le développement avec avertissement explicite
    console.warn(
      "[SECURITY WARNING] Using insecure JWT fallback for development. Set JWT_SECRET in production."
    );
    return "ka-farm-dev-only-secret-change-in-production";
  }

  // Production : échec immédiat avec message clair
  const errorMsg = "JWT_SECRET environment variable is required in production";
  console.error(`[FATAL] ${errorMsg}`);
  throw new Error(errorMsg);
}

// Initialiser le SDK Firebase Admin (pour les opérations backend sécurisées)
let adminDb = null;
let firebaseInitializationError = null;

try {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    firebaseInitializationError = new Error(
      isProduction()
        ? "Configuration Firebase Admin manquante ou invalide en production"
        : "Firebase Admin non configure. Definissez FIREBASE_SERVICE_ACCOUNT_KEY pour activer Firestore."
    );
  } else {
    const parsedServiceAccount = JSON.parse(serviceAccountKey);
    const serviceAccount = {
      projectId: parsedServiceAccount.projectId || parsedServiceAccount.project_id,
      clientEmail: parsedServiceAccount.clientEmail || parsedServiceAccount.client_email,
      privateKey: (
        parsedServiceAccount.privateKey ||
        parsedServiceAccount.private_key ||
        ""
      ).replace(/\\n/g, "\n"),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_KEY doit contenir project_id, client_email et private_key"
      );
    }

    const adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });

    adminDb = getFirestore(adminApp);
    logger.info("SDK Firebase Admin initialisé avec succès");
  }
} catch (e) {
  adminDb = null;
  firebaseInitializationError = new Error(
    isProduction()
      ? "Configuration Firebase Admin manquante ou invalide en production"
      : `Firebase Admin non configure ou invalide: ${e.message}`
  );
    logger.error("Échec de l'initialisation du SDK Firebase Admin", { error: e.message, stack: e.stack });
}

function getFirestoreUnavailableMessage() {
  if (firebaseInitializationError) {
    return firebaseInitializationError.message;
  }

  if (!adminDb) {
    return isProduction()
      ? "Service Firestore indisponible en production"
      : "Firebase Admin non configure. Definissez FIREBASE_SERVICE_ACCOUNT_KEY pour activer Firestore.";
  }

  return null;
}

function requireFirestoreReady(req, res, next) {
  const errorMessage = getFirestoreUnavailableMessage();
  if (errorMessage) {
    logger.error("Firestore indisponible pour la route API", {
      route: `${req.method} ${req.originalUrl}`,
      error: errorMessage,
    });
    return res.status(503).json({ error: errorMessage });
  }

  next();
}

const app = express();

// En-têtes de sécurité
app.use(helmet());

// Configuration CORS
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Trop de requêtes. Veuillez réessayer dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for sensitive write routes (finances, employees)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 write requests per windowMs
  message: { error: "Trop de requêtes d'écriture. Veuillez réessayer dans 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all API routes
app.use("/api", apiLimiter);

// Auth middleware: require valid JWT token
function requireAuth(req, res, next) {
  let jwtSecret;
  try {
    jwtSecret = getJwtSecret();
  } catch (error) {
    logger.error("JWT configuration error", { error: error.message });
    return res.status(503).json({ error: "Configuration JWT manquante ou invalide" });
  }
  if (!jwtSecret) {
    logger.error("JWT secret missing in production", {
      route: `${req.method} ${req.originalUrl}`,
    });
    return res.status(503).json({ error: "Configuration JWT manquante" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Missing auth token", { url: req.originalUrl });
    return res.status(401).json({ error: "Token d'authentification requis" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn("Invalid auth token", { error: err.message, url: req.originalUrl });
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

// Public routes (no auth required)
app.use(["/api/gemini", "/api/weather", "/api/auth/login"], requireFirestoreReady);

// Protected routes (auth + Firestore required)
app.use(
  [
    "/api/crops",
    "/api/parcelles",
    "/api/tasks",
    "/api/finances",
    "/api/employees",
    "/api/cheptel",
    "/api/elevage/production",
    "/api/elevage/health",
    "/api/treatments",
    "/api/crop-profits",
    "/api/messages",
    "/api/stocks",
  ],
  requireAuth,
  requireFirestoreReady
);

// ==================== AUTH ====================
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis" });
    }

    const jwtSecret = getJwtSecret();
    if (!jwtSecret) {
      return res.status(503).json({ error: "Configuration JWT manquante" });
    }

    // Read users from Firestore
    const users = await syncWithFirestore("ka_farm_users", []);
    const user = users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password, user.password_salt);
    if (!isValid) {
      return res.status(401).json({ error: "Identifiants incorrects" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, enterpriseId: user.enterpriseId },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        enterpriseId: user.enterpriseId,
      },
    });
  } catch (error) {
    logger.error("Auth error", { error: error.message });
    return res.status(500).json({ error: "Erreur lors de l'authentification" });
  }
});

// In-memory fallback stores
let serverMessages = [];

let serverStocks = [
  {
    id: "S-301",
    name: "Compost Organique Bio",
    category: "Amendements",
    quantity: 350,
    maxQuantity: 1000,
    unit: "kg",
  },
  {
    id: "S-302",
    name: "Semences Tomate Mongal F1",
    category: "Semences",
    quantity: 12,
    maxQuantity: 50,
    unit: "sachets",
  },
  {
    id: "S-303",
    name: "Purin de Neem (Insecticide)",
    category: "Traitements",
    quantity: 45,
    maxQuantity: 100,
    unit: "L",
  },
  {
    id: "S-304",
    name: "Fumier de Mouton séché",
    category: "Amendements",
    quantity: 150,
    maxQuantity: 800,
    unit: "kg",
  },
  {
    id: "S-305",
    name: "Aliments Concentrés Bovins",
    category: "Alimentation",
    quantity: 180,
    maxQuantity: 1000,
    unit: "kg",
  },
];

let serverCrops = [
  {
    id: "C-101",
    name: "Tomate Mongal F1",
    field: "Parcelle Nord - Planche 2",
    sowingDate: "2026-05-10",
    harvestDate: "2026-08-15",
    status: "Floraison",
    waterStatus: "Optimale",
    fertilizerStatus: "OK",
    photos: [],
  },
  {
    id: "C-102",
    name: "Oignon Rouge de Galmi",
    field: "Parcelle Est - Grand Champ",
    sowingDate: "2026-04-15",
    harvestDate: "2026-09-01",
    status: "Croissance",
    waterStatus: "Besoin d'eau",
    fertilizerStatus: "OK",
    photos: [],
  },
];

let serverParcelles = [
  {
    id: "P-001",
    name: "Parcelle Nord - Planche 2",
    surface: 120,
    lat: 14.7932,
    lng: -17.2654,
    status: "Cultivée",
    type_sol: "sableux",
    history: ["Tomate Mongal F1"],
    currentCrop: "Tomate Mongal F1",
    waterStatus: "Irrigué",
  },
  {
    id: "P-002",
    name: "Parcelle Est - Grand Champ",
    surface: 500,
    lat: 14.7938,
    lng: -17.2642,
    status: "Cultivée",
    type_sol: "limoneux",
    history: ["Oignon Rouge de Galmi"],
    currentCrop: "Oignon Rouge de Galmi",
    waterStatus: "Besoin d'eau",
  },
];

let serverTasks = [
  {
    id: "T-401",
    title: "Irrigation matin de l'oignon Galmi",
    category: "Irrigation",
    dueDate: "2026-06-26",
    assignee: "Responsable terrain",
    priority: "Haute",
    completed: false,
  },
  {
    id: "T-402",
    title: "Sarclage & Désherbage planche choux",
    category: "Entretien",
    dueDate: "2026-06-28",
    assignee: "Fatou",
    priority: "Moyenne",
    completed: false,
  },
];

let serverFinances = [
  {
    id: "F-501",
    description: "Vente de 8 caisses de Tomates Mongal",
    category: "Vente Légumes",
    type: "Revenu",
    amount: 120000,
    date: "2026-06-20",
  },
  {
    id: "F-502",
    description: "Achat de semences oignon Galmi",
    category: "Semences",
    type: "Dépense",
    amount: 35000,
    date: "2026-06-18",
  },
];

let serverEmployees = [
  {
    id: "E-001",
    name: "Samba Diouf",
    phone: "77 521 44 22",
    role: "Ouvrier agricole",
    dailyRate: 4000,
    status: "Actif",
  },
  {
    id: "E-002",
    name: "Awa Sow",
    phone: "76 432 11 00",
    role: "Chef d'équipe pépinière",
    dailyRate: 5000,
    status: "Actif",
  },
];

let serverCheptel = [
  {
    id: "CH-001",
    name: "Génisses Laitières Holstein",
    type: "Bovins",
    breed: "Holstein/Guzera",
    quantity: 12,
    unit: "têtes",
    status: "Sain",
    purpose: "Lait",
  },
  {
    id: "CH-002",
    name: "Moutons Ladoum d'Élevage",
    type: "Ovins",
    breed: "Ladoum Pur",
    quantity: 8,
    unit: "têtes",
    status: "Sain",
    purpose: "Reproduction",
  },
];

let serverElevageProduction = [
  {
    id: "PROD-001",
    date: "2026-06-25",
    type: "Lait",
    quantity: 145,
    unit: "L",
    notes: "Excellente traite matinale.",
  },
  {
    id: "PROD-002",
    date: "2026-06-25",
    type: "Œufs",
    quantity: 310,
    unit: "unités",
    notes: "10 plateaux collectés.",
  },
];

let serverElevageHealth = [
  {
    id: "HEA-001",
    date: "2026-06-10",
    target: "Moutons Ladoum",
    intervention: "Vaccination Pastorose",
    practitioner: "Dr. Diop",
    cost: 15000,
    notes: "Rappel annuel effectué.",
  },
];

let serverTreatments = [];
let serverCropProfits = [];

// Helper to read from Firestore using Admin SDK
// Multi-tenant: data is organized as app_data/{enterpriseId}/{collection}
async function syncWithFirestore(collection, fallbackData, enterpriseId = "ka_farm") {
  const errorMsg = getFirestoreUnavailableMessage();
  if (errorMsg) {
    logger.error(`Firestore read error for ${collection}`, { error: errorMsg });
    throw new Error(errorMsg);
  }

  try {
    const docSnap = await adminDb
      .collection("app_data")
      .doc(enterpriseId)
      .collection(collection)
      .doc("data")
      .get();
    if (docSnap.exists) {
      return docSnap.data().data || fallbackData;
    }
    return fallbackData;
  } catch (err) {
    logger.error(`Firestore read error for ${collection}`, { error: err.message });
    throw err;
  }
}

async function saveToFirestore(collection, data, enterpriseId = "ka_farm") {
  const errorMsg = getFirestoreUnavailableMessage();
  if (errorMsg) {
    logger.error(`Firestore write error for ${collection}`, { error: errorMsg });
    throw new Error(errorMsg);
  }

  try {
    await adminDb.collection("app_data").doc(enterpriseId).collection(collection).doc("data").set({
      data,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (err) {
    logger.error(`Firestore write error for ${collection}`, { error: err.message });
    throw err;
  }
}

// ==================== CROPS ====================
app.get("/api/crops", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await Cache.memo(
      "crops_list",
      async () => await syncWithFirestore("crops", serverCrops, enterpriseId),
      30000
    );
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/crops", async (req, res) => {
  try {
    const crop = CropSchema.parse(req.body);
    const existing = serverCrops.find((c) => c.id === crop.id);
    if (existing) {
      const idx = serverCrops.findIndex((c) => c.id === crop.id);
      serverCrops[idx] = { ...existing, ...crop };
    } else {
      serverCrops.push(crop);
    }
    await Cache.invalidate("crops_list");
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("crops", serverCrops, enterpriseId);
    res.json({ success: true, crop });
  } catch (error) {
    logger.error("Error saving crop", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.put("/api/crops/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = CropSchema.partial().parse(req.body);
    const idx = serverCrops.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Culture non trouvée" });
    serverCrops[idx] = { ...serverCrops[idx], ...patch };
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("crops", serverCrops, enterpriseId);
    res.json({ success: true, crop: serverCrops[idx] });
  } catch (error) {
    logger.error("Error updating crop", { error: error.message });
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/crops/:id", async (req, res) => {
  const { id } = req.params;
  serverCrops = serverCrops.filter((c) => c.id !== id);
  const enterpriseId = req.user?.enterpriseId || "ka_farm";
  await saveToFirestore("crops", serverCrops, enterpriseId);
  res.json({ success: true });
});

// ==================== PARCELLES ====================
app.get("/api/parcelles", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await Cache.memo(
      "parcelles_list",
      async () => await syncWithFirestore("parcelles", serverParcelles, enterpriseId),
      30000
    );
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/parcelles", async (req, res) => {
  try {
    const parcelle = ParcelleSchema.parse(req.body);
    const existing = serverParcelles.find((p) => p.id === parcelle.id);
    if (existing) {
      const idx = serverParcelles.findIndex((p) => p.id === parcelle.id);
      serverParcelles[idx] = { ...existing, ...parcelle };
    } else {
      serverParcelles.push(parcelle);
    }
    await Cache.invalidate("parcelles_list");
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("parcelles", serverParcelles, enterpriseId);
    res.json({ success: true, parcelle });
  } catch (error) {
    logger.error("Error saving parcelle", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.put("/api/parcelles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = ParcelleSchema.partial().parse(req.body);
    const idx = serverParcelles.findIndex((p) => p.id === id);
    if (idx === -1) return res.status(404).json({ error: "Parcelle non trouvée" });
    serverParcelles[idx] = { ...serverParcelles[idx], ...patch };
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("parcelles", serverParcelles, enterpriseId);
    res.json({ success: true, parcelle: serverParcelles[idx] });
  } catch (error) {
    logger.error("Error updating parcelle", { error: error.message });
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/parcelles/:id", async (req, res) => {
  const { id } = req.params;
  serverParcelles = serverParcelles.filter((p) => p.id !== id);
  const enterpriseId = req.user?.enterpriseId || "ka_farm";
  await saveToFirestore("parcelles", serverParcelles, enterpriseId);
  res.json({ success: true });
});

// ==================== TASKS ====================
app.get("/api/tasks", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await Cache.memo(
      "tasks_list",
      async () => await syncWithFirestore("tasks", serverTasks, enterpriseId),
      15000
    );
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const task = TaskSchema.parse(req.body);
    const existing = serverTasks.find((t) => t.id === task.id);
    if (existing) {
      const idx = serverTasks.findIndex((t) => t.id === task.id);
      serverTasks[idx] = { ...existing, ...task };
    } else {
      serverTasks.push(task);
    }
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("tasks", serverTasks, enterpriseId);
    res.json({ success: true, task });
  } catch (error) {
    logger.error("Error saving task", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = TaskSchema.partial().parse(req.body);
    const idx = serverTasks.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ error: "Tâche non trouvée" });
    serverTasks[idx] = { ...serverTasks[idx], ...patch };
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("tasks", serverTasks, enterpriseId);
    res.json({ success: true, task: serverTasks[idx] });
  } catch (error) {
    logger.error("Error updating task", { error: error.message });
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  serverTasks = serverTasks.filter((t) => t.id !== id);
  const enterpriseId = req.user?.enterpriseId || "ka_farm";
  await saveToFirestore("tasks", serverTasks, enterpriseId);
  res.json({ success: true });
});

// ==================== FINANCES ====================
app.get("/api/finances", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await Cache.memo(
      "finances_list",
      async () => await syncWithFirestore("finances", serverFinances, enterpriseId),
      30000
    );
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

// Apply write rate limiting to finances routes
app.use("/api/finances", writeLimiter);

app.post("/api/finances", async (req, res) => {
  try {
    const finance = FinanceSchema.parse(req.body);
    const existing = serverFinances.find((f) => f.id === finance.id);
    if (existing) {
      const idx = serverFinances.findIndex((f) => f.id === finance.id);
      serverFinances[idx] = { ...existing, ...finance };
    } else {
      serverFinances.push(finance);
    }
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("finances", serverFinances, enterpriseId);
    res.json({ success: true, finance });
  } catch (error) {
    logger.error("Error saving finance", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/finances/:id", async (req, res) => {
  try {
    const { id } = req.params;
    serverFinances = serverFinances.filter((f) => f.id !== id);
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("finances", serverFinances, enterpriseId);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error deleting finance", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ==================== EMPLOYEES ====================
app.get("/api/employees", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await Cache.memo(
      "employees_list",
      async () => await syncWithFirestore("employees", serverEmployees, enterpriseId),
      30000
    );
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

// Apply write rate limiting to employees routes
app.use("/api/employees", writeLimiter);

app.post("/api/employees", async (req, res) => {
  try {
    const employee = EmployeeSchema.parse(req.body);
    const existing = serverEmployees.find((e) => e.id === employee.id);
    if (existing) {
      const idx = serverEmployees.findIndex((e) => e.id === employee.id);
      serverEmployees[idx] = { ...existing, ...employee };
    } else {
      serverEmployees.push(employee);
    }
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("employees", serverEmployees, enterpriseId);
    res.json({ success: true, employee });
  } catch (error) {
    logger.error("Error saving employee", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.put("/api/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = EmployeeSchema.partial().parse(req.body);
    const idx = serverEmployees.findIndex((e) => e.id === id);
    if (idx === -1) return res.status(404).json({ error: "Employé non trouvé" });
    serverEmployees[idx] = { ...serverEmployees[idx], ...patch };
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("employees", serverEmployees, enterpriseId);
    res.json({ success: true, employee: serverEmployees[idx] });
  } catch (error) {
    logger.error("Error updating employee", { error: error.message });
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;
    serverEmployees = serverEmployees.filter((e) => e.id !== id);
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("employees", serverEmployees, enterpriseId);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error deleting employee", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ==================== ELEVAGE / CHEPTEL ====================
app.get("/api/cheptel", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await Cache.memo(
      "cheptel_list",
      async () => await syncWithFirestore("cheptel", serverCheptel, enterpriseId),
      30000
    );
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/cheptel", async (req, res) => {
  try {
    const group = CheptelSchema.parse(req.body);
    const existing = serverCheptel.find((c) => c.id === group.id);
    if (existing) {
      const idx = serverCheptel.findIndex((c) => c.id === group.id);
      serverCheptel[idx] = { ...existing, ...group };
    } else {
      serverCheptel.push(group);
    }
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("cheptel", serverCheptel, enterpriseId);
    res.json({ success: true, group });
  } catch (error) {
    logger.error("Error saving cheptel", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.put("/api/cheptel/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = CheptelSchema.partial().parse(req.body);
    const idx = serverCheptel.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Groupe d'élevage non trouvé" });
    serverCheptel[idx] = { ...serverCheptel[idx], ...patch };
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("cheptel", serverCheptel, enterpriseId);
    res.json({ success: true, group: serverCheptel[idx] });
  } catch (error) {
    logger.error("Error updating cheptel", { error: error.message });
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/cheptel/:id", async (req, res) => {
  const { id } = req.params;
  serverCheptel = serverCheptel.filter((c) => c.id !== id);
  const enterpriseId = req.user?.enterpriseId || "ka_farm";
  await saveToFirestore("cheptel", serverCheptel, enterpriseId);
  res.json({ success: true });
});

// ==================== ELEVAGE PRODUCTION ====================
app.get("/api/elevage/production", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await syncWithFirestore(
      "elevage_production",
      serverElevageProduction,
      enterpriseId
    );
    const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/elevage/production", async (req, res) => {
  try {
    const log = ElevageProductionSchema.parse(req.body);
    serverElevageProduction.push(log);
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("elevage_production", serverElevageProduction, enterpriseId);
    res.json({ success: true, log });
  } catch (error) {
    logger.error("Error saving elevage production", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/elevage/production/:id", async (req, res) => {
  try {
    const { id } = req.params;
    serverElevageProduction = serverElevageProduction.filter((l) => l.id !== id);
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("elevage_production", serverElevageProduction, enterpriseId);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error deleting elevage production", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ==================== ELEVAGE HEALTH ====================
app.get("/api/elevage/health", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await syncWithFirestore("elevage_health", serverElevageHealth, enterpriseId);
    const sorted = data.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sorted);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/elevage/health", async (req, res) => {
  try {
    const log = ElevageHealthSchema.parse(req.body);
    serverElevageHealth.push(log);
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("elevage_health", serverElevageHealth, enterpriseId);
    res.json({ success: true, log });
  } catch (error) {
    logger.error("Error saving elevage health", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.delete("/api/elevage/health/:id", async (req, res) => {
  try {
    const { id } = req.params;
    serverElevageHealth = serverElevageHealth.filter((l) => l.id !== id);
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("elevage_health", serverElevageHealth, enterpriseId);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error deleting elevage health", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: "Erreur lors de la suppression" });
  }
});

// ==================== TREATMENTS ====================
app.get("/api/treatments", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await syncWithFirestore("treatments", serverTreatments, enterpriseId);
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/treatments", async (req, res) => {
  try {
    const treatment = req.body;
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

    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("treatments", serverTreatments, enterpriseId);
    res.json({ success: true, treatment });
  } catch (error) {
    logger.error("Error saving treatment", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.post("/api/treatments/sync", async (req, res) => {
  try {
    const { treatments } = req.body;
    if (treatments && Array.isArray(treatments)) {
      serverTreatments = treatments;
      const enterpriseId = req.user?.enterpriseId || "ka_farm";
      await saveToFirestore("treatments", serverTreatments, enterpriseId);
      res.json({ success: true, message: "Traitements synchronisés en mémoire", treatments });
    } else {
      res.status(400).json({ error: "Données de traitements invalides" });
    }
  } catch (error) {
    logger.error("Error syncing treatments", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});

// ==================== CROP PROFITS ====================
app.get("/api/crop-profits", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await syncWithFirestore("crop_profits", serverCropProfits, enterpriseId);
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/crop-profits", async (req, res) => {
  try {
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

    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("crop_profits", serverCropProfits, enterpriseId);
    res.json({ success: true, profit });
  } catch (error) {
    logger.error("Error saving crop profit", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

app.post("/api/crop-profits/sync", async (req, res) => {
  try {
    const { cropProfits } = req.body;
    if (cropProfits && Array.isArray(cropProfits)) {
      serverCropProfits = cropProfits;
      const enterpriseId = req.user?.enterpriseId || "ka_farm";
      await saveToFirestore("crop_profits", serverCropProfits, enterpriseId);
      res.json({
        success: true,
        message: "Analyses de rentabilité synchronisées en mémoire",
        cropProfits,
      });
    } else {
      res.status(400).json({ error: "Données de rentabilité invalides" });
    }
  } catch (error) {
    logger.error("Error syncing crop profits", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: "Erreur lors de la synchronisation" });
  }
});

// ==================== MESSAGES ====================
app.get("/api/messages", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await syncWithFirestore("messages", serverMessages, enterpriseId);
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    const { id, senderEmail, senderName, text, timestamp, isPrivate } = MessageSchema.parse(
      req.body
    );
    const newMsg = {
      id: id || "msg-" + Date.now(),
      senderEmail,
      senderName: senderName || senderEmail,
      text,
      timestamp: timestamp || new Date().toISOString(),
      isPrivate: !!isPrivate,
    };
    serverMessages.push(newMsg);
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    await saveToFirestore("messages", serverMessages, enterpriseId);
    res.json({ success: true, message: newMsg });
  } catch (error) {
    logger.error("Error saving message", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(400).json({ error: error.message || "Erreur de validation" });
  }
});

// ==================== STOCKS ====================
app.get("/api/stocks", async (req, res) => {
  try {
    const enterpriseId = req.user?.enterpriseId || "ka_farm";
    const data = await syncWithFirestore("stocks", serverStocks, enterpriseId);
    res.json(data);
  } catch (error) {
    res.status(503).json({ error: error.message || "Service Firestore indisponible" });
  }
});

app.post("/api/stocks", async (req, res) => {
  try {
    const { stocks } = req.body;
    if (stocks && Array.isArray(stocks)) {
      serverStocks = stocks;
      const enterpriseId = req.user?.enterpriseId || "ka_farm";
      await saveToFirestore("stocks", serverStocks, enterpriseId);
      res.json({ success: true, message: "Stocks synchronisés", stocks });
    } else {
      res.status(400).json({ error: "Données de stock invalides" });
    }
  } catch (error) {
    logger.error("Error saving stocks", { error: error.message });
    if (error.message.includes("Firestore") || error.message.includes("Firebase Admin")) {
      return res.status(503).json({ error: error.message });
    }
    res.status(500).json({ error: "Erreur lors de la sauvegarde" });
  }
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
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    let systemInstruction =
      "Tu es KA-Farm Agro-Advisor, un conseiller horticole et maraîcher expert d'Afrique de l'Ouest (Sénégal), chaleureux, pragmatique, direct et scientifique. Tu réponds en français. Tu es spécialisé exclusivement dans le maraîchage (cultures de légumes, fines herbes, fruits de jardin, pépinières, irrigation goutte-à-goutte ou aspersion, maladies horticoles comme la mineuse de la tomate Tuta absoluta, le mildiou, l'oïdium, les thrips, et l'usage de biopesticides locaux comme le neem ou le piment). Tu aides à diagnostiquer les ravageurs et maladies des légumes, planifier les pépinières maraîchères et le repiquage, optimiser l'arrosage et les amendements (compost organique, fumier) de manière écologique et agroécologique. Donne des réponses concises, claires, structurées et adaptées aux conditions locales ouest-africaines.";

    if (image) {
      systemInstruction =
        "Tu es KA-Farm Doctor Plante, un expert phytosanitaire horticole spécialisé dans le diagnostic visuel des maladies et carences des légumes en Afrique de l'Ouest (Sénégal). Analyse cette photo de culture et fournis un diagnostic structuré en français avec : 1) Nom probable de la maladie/carence (si identifiable), 2) Niveau de gravité (Faible/Moyen/Élevé), 3) Action de traitement recommandée (produit bio ou chimique, dosage, fréquence), 4) Prévention. Sois direct, scientifique et adapté aux conditions locales. Si l'image n'est pas claire ou ne montre pas de problème visible, indique-le honnêtement.";
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

    const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    let response = null;
    let lastError = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      for (const model of modelsToTry) {
        try {
          response = await ai.models.generateContent({
            model: model,
            contents:
              contents.length > 0
                ? [...contents, { role: "user", parts: requestParts }]
                : requestParts,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });
          if (response && response.text) {
            break;
          }
        } catch (err) {
          lastError = err;
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        }
      }
      if (response && response.text) {
        break;
      }
    }

    if (!response || !response.text) {
      throw (
        lastError ||
        new Error("Impossible de générer une réponse de l'IA après plusieurs tentatives")
      );
    }

    return res.json({ text: response.text });
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

export default app;
