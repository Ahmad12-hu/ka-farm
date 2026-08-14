// Polyfill TextEncoder pour l'environnement de test jsdom
if (typeof global.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Tests unitaires pour KA Farm
import { KAStorage } from "../js/storage.js";
import { UserManager } from "../js/user-manager.js";

describe("KAStorage", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  test("devrait initialiser le storage", () => {
    KAStorage.init();
    expect(KAStorage).toBeDefined();
  });

  test("devrait stocker et récupérer des données", () => {
    KAStorage.init();
    const testData = { name: "Test Farm", location: "Dakar" };
    KAStorage.set("test_farm_key", testData);
    const retrieved = KAStorage.get("test_farm_key");
    expect(retrieved).toEqual(testData);
  });

  test("devrait retourner une valeur par défaut si la clé n'existe pas", () => {
    KAStorage.init();
    const defaultValue = "default_value";
    const retrieved = KAStorage.get("non_existent_key", defaultValue);
    expect(retrieved).toBe(defaultValue);
  });

  test("devrait supprimer une clé", () => {
    KAStorage.init();
    const testKey = "ka_farm_test_remove_key";
    KAStorage.set(testKey, "test_value");
    expect(KAStorage.get(testKey)).toBe("test_value");
    KAStorage.remove(testKey);
    const retrieved = KAStorage.get(testKey);
    expect(retrieved).toBeUndefined();
  });
});

describe("UserManager", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  test("devrait retourner les rôles disponibles", () => {
    const roles = UserManager.getRoles();
    expect(roles).toBeDefined();
    expect(roles.TERRAIN).toBe("Terrain");
    expect(roles.BUREAU).toBe("Bureau");
  });

  test("devrait vérifier si l'utilisateur est connecté", () => {
    const isAuth = UserManager.isLoggedIn();
    expect(typeof isAuth).toBe("boolean");
  });

  test("devrait récupérer l'utilisateur courant", () => {
    const user = UserManager.getCurrentUser();
    expect(user === null || typeof user === "object").toBe(true);
  });
});

describe("Validators", () => {
  test("devrait valider un email", () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRegex.test("test@example.com")).toBe(true);
    expect(emailRegex.test("invalid-email")).toBe(false);
  });

  test("devrait valider un numéro de téléphone sénégalais", () => {
    const phoneRegex = /^(\+221|221)?[0-9]{9}$/;
    expect(phoneRegex.test("771234567")).toBe(true);
    expect(phoneRegex.test("+221771234567")).toBe(true);
    expect(phoneRegex.test("123")).toBe(false);
  });
});
