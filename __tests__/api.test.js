// Polyfill TextEncoder pour l'environnement de test jsdom
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Simuler @google/genai pour éviter les problèmes d'analyse ESM dans Jest
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: jest.fn().mockResolvedValue({ text: "Mocked AI response" }),
    },
  })),
}));

// Simuler les modules Firebase
jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

// Simuler les sous-modules firebase-admin
jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(() => ({ name: "[DEFAULT]" })),
  cert: jest.fn(() => ({ projectId: "ka-farm-test" })),
}));

// Simulation de la structure multitenant : adminDb.collection("app_data").doc(enterpriseId).collection(collection).doc("data")
jest.mock("firebase-admin/firestore", () => {
  const mockCollection = () => ({
    doc: jest.fn(() => ({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ exists: false })),
          set: jest.fn(() => Promise.resolve()),
        })),
      })),
    })),
  });

  return {
    getFirestore: jest.fn(() => ({
      collection: jest.fn(mockCollection),
    })),
  };
});

// Simuler jsonwebtoken pour contourner l'authentification dans les tests utilisant le compte admin restant
jest.mock("jsonwebtoken", () => ({
  ...jest.requireActual("jsonwebtoken"),
  verify: jest.fn(() => ({
    userId: "USR-001",
    email: "amadou@ka-farm.sn",
    role: "admin",
    enterpriseId: "ka_farm",
  })),
}));

// Simuler fetch pour le test de l'API météo
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        current: {
          temperature_2m: 32,
          relative_humidity_2m: 65,
          precipitation: 0,
          weather_code: 0,
          wind_speed_10m: 15,
        },
      }),
  })
);

process.env.GEMINI_API_KEY = "test-api-key-for-mocking";
process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  project_id: "ka-farm-test",
  client_email: "test@ka-farm-test.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\\nMOCK\\n-----END PRIVATE KEY-----\\n",
});

const request = require("supertest");
const app = require("../api/index.js").default;

const authHeaders = { Authorization: "Bearer test-token" };

describe("API Endpoints", () => {
  describe("GET /api/crops", () => {
    test("returns crops data", async () => {
      const response = await request(app).get("/api/crops").set(authHeaders);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("POST /api/crops", () => {
    test("creates a new crop with valid data", async () => {
      const newCrop = {
        id: "TEST-001",
        name: "Tomate Test",
        field: "Parcelle Test",
        status: "Croissance",
      };

      const response = await request(app).post("/api/crops").set(authHeaders).send(newCrop);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.crop.name).toBe("Tomate Test");
    });

    test("rejects crop with missing required fields", async () => {
      const invalidCrop = {
        name: "Tomate Sans ID",
      };

      const response = await request(app).post("/api/crops").set(authHeaders).send(invalidCrop);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test("rejects crop with empty name", async () => {
      const invalidCrop = {
        id: "TEST-002",
        name: "",
      };

      const response = await request(app).post("/api/crops").set(authHeaders).send(invalidCrop);

      expect(response.status).toBe(400);
    });
  });

  describe("PUT /api/crops/:id", () => {
    test("updates an existing crop", async () => {
      const updateData = {
        name: "Tomate Mongal F1 Updated",
        status: "Floraison",
      };

      const response = await request(app).put("/api/crops/C-101").set(authHeaders).send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.crop.name).toBe("Tomate Mongal F1 Updated");
    });

    test("returns 404 for non-existent crop", async () => {
      const response = await request(app)
        .put("/api/crops/NON-EXISTENT")
        .set(authHeaders)
        .send({ name: "Test" });

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/crops/:id", () => {
    test("deletes an existing crop", async () => {
      const response = await request(app).delete("/api/crops/TEST-001").set(authHeaders);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test("returns 200 even for non-existent crop", async () => {
      const response = await request(app).delete("/api/crops/NON-EXISTENT").set(authHeaders);
      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/parcelles", () => {
    test("returns parcelles data", async () => {
      const response = await request(app).get("/api/parcelles").set(authHeaders);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("POST /api/parcelles", () => {
    test("creates a new parcelle with valid data", async () => {
      const newParcelle = {
        id: "P-TEST-001",
        name: "Parcelle Test",
        surface: 200,
        lat: 14.793,
        lng: -17.265,
      };

      const response = await request(app).post("/api/parcelles").set(authHeaders).send(newParcelle);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.parcelle.name).toBe("Parcelle Test");
    });

    test("rejects parcelle with missing required fields", async () => {
      const invalidParcelle = {
        id: "P-TEST-002",
      };

      const response = await request(app)
        .post("/api/parcelles")
        .set(authHeaders)
        .send(invalidParcelle);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/employees", () => {
    test("returns employees data", async () => {
      const response = await request(app).get("/api/employees").set(authHeaders);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("POST /api/employees", () => {
    test("creates a new employee with valid data", async () => {
      const newEmployee = {
        id: "E-TEST-001",
        name: "Ouvrier Test",
        phone: "77 123 45 67",
        role: "Maraîcher",
        dailyRate: 4000,
        status: "Actif",
      };

      const response = await request(app).post("/api/employees").set(authHeaders).send(newEmployee);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.employee.name).toBe("Ouvrier Test");
    });

    test("rejects employee with missing required fields", async () => {
      const invalidEmployee = {
        id: "E-TEST-002",
      };

      const response = await request(app)
        .post("/api/employees")
        .set(authHeaders)
        .send(invalidEmployee);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/finances", () => {
    test("returns finances data", async () => {
      const response = await request(app).get("/api/finances").set(authHeaders);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe("POST /api/finances", () => {
    test("creates a new finance entry with valid data", async () => {
      const newFinance = {
        id: "F-TEST-001",
        description: "Test vente légumes",
        type: "Revenu",
        category: "Vente",
        amount: 50000,
        date: "2026-06-26",
      };

      const response = await request(app).post("/api/finances").set(authHeaders).send(newFinance);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.finance.amount).toBe(50000);
    });

    test("rejects finance with negative amount", async () => {
      const invalidFinance = {
        id: "F-TEST-002",
        description: "Test",
        type: "Revenu",
        amount: -1000,
      };

      const response = await request(app)
        .post("/api/finances")
        .set(authHeaders)
        .send(invalidFinance);

      expect(response.status).toBe(400);
    });

    test("rejects finance with invalid type", async () => {
      const invalidFinance = {
        id: "F-TEST-003",
        description: "Test",
        type: "InvalidType",
        amount: 1000,
      };

      const response = await request(app)
        .post("/api/finances")
        .set(authHeaders)
        .send(invalidFinance);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/weather", () => {
    test("returns weather data for valid coordinates", async () => {
      const response = await request(app)
        .get("/api/weather")
        .set(authHeaders)
        .query({ lat: 14.793, lon: -17.265 });

      expect(response.status).toBe(200);
      expect(response.body.temp).toBeDefined();
      expect(response.body.humidity).toBeDefined();
    });

    test("returns 400 for missing coordinates", async () => {
      const response = await request(app)
        .get("/api/weather")
        .set(authHeaders)
        .query({ lat: 14.793 });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/gemini", () => {
    test("returns text response for text-only prompt", async () => {
      const response = await request(app)
        .post("/api/gemini")
        .set(authHeaders)
        .send({ prompt: "Comment traiter le mildiou?" });

      expect(response.status).toBe(200);
      expect(response.body.text).toBeDefined();
      expect(response.body.text).toContain("Mocked AI response");
    });

    test("returns text response for image analysis", async () => {
      const mockImage = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQABAF";
      const response = await request(app).post("/api/gemini").set(authHeaders).send({
        prompt: "Diagnostique cette image.",
        image: mockImage,
      });

      expect(response.status).toBe(200);
      expect(response.body.text).toBeDefined();
      expect(response.body.text).toContain("Mocked AI response");
    });

    test("rejects request without prompt", async () => {
      const mockImage = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQABAF";
      const response = await request(app)
        .post("/api/gemini")
        .set(authHeaders)
        .send({ image: mockImage });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Prompt requis");
    });
  });

  describe("Rate Limiting", () => {
    test("allows requests within limit", async () => {
      const response = await request(app).get("/api/crops").set(authHeaders);
      expect(response.status).toBe(200);
    });
  });
});
