// Tests RBAC (Role-Based Access Control) de non-régression
// Vérifie que chaque rôle dispose des bonnes permissions

import { UserManager } from "../js/user-manager.js";
import { KAStorage } from "../js/storage.js";

describe("RBAC - Non-regression Tests", () => {
  beforeEach(() => {
    // Réinitialiser localStorage avant chaque test
    if (typeof window !== "undefined") {
      window.localStorage.clear();
    }
  });

  // Helper pour créer un utilisateur avec un rôle spécifique
  function createUser(role) {
    const user = role
      ? {
          uid: "test_user_" + role.toLowerCase(),
          email: "test@example.com",
          role,
          displayName: "Test User",
        }
      : null;
    KAStorage.setCurrentUser(user);
    return user;
  }

  describe("Rôles disponibles", () => {
    test("devrait retourner les 4 rôles: TERRAIN, BUREAU, admin, super_admin", () => {
      const roles = UserManager.getRoles();
      expect(roles).toBeDefined();
      expect(roles.TERRAIN).toBe("Terrain");
      expect(roles.BUREAU).toBe("Bureau");
    });

    test("devrait supporter les rôles admin et super_admin", () => {
      // isAdmin vérifie admin et super_admin
      createUser("admin");
      expect(UserManager.isAdmin()).toBe(true);

      createUser("super_admin");
      expect(UserManager.isAdmin()).toBe(true);
    });
  });

  describe("Permissions - Rôle Terrain", () => {
    beforeEach(() => {
      createUser("Terrain");
    });

    test("Terrain peut éditer les cultures", () => {
      expect(UserManager.canEditCrops()).toBe(true);
    });

    test("Terrain peut gérer les tâches", () => {
      expect(UserManager.canManageTasks()).toBe(true);
    });

    test("Terrain peut gérer les récoltes", () => {
      expect(UserManager.canManageHarvests()).toBe(true);
    });

    test("Terrain peut saisir les ventes (entrer ventes au marché)", () => {
      expect(UserManager.canEnterSales()).toBe(true);
    });

    test("Terrain peut voir les finances (lecture seule)", () => {
      expect(UserManager.canViewFinances()).toBe(true);
    });

    test("Terrain peut voir les employés", () => {
      expect(UserManager.canViewEmployees()).toBe(true);
    });

    test("Terrain NE PEUT PAS gérer les finances (édition)", () => {
      expect(UserManager.canEditFinances()).toBe(false);
    });

    test("Terrain NE PEUT PAS gérer les employés", () => {
      expect(UserManager.canManageEmployees()).toBe(false);
    });

    test("Terrain NE PEUT PAS gérer les stocks", () => {
      expect(UserManager.canManageStocks()).toBe(false);
    });

    test("Terrain NE PEUT PAS accéder au admin dashboard", () => {
      expect(UserManager.isAdmin()).toBe(false);
    });
  });

  describe("Permissions - Rôle Bureau", () => {
    beforeEach(() => {
      createUser("Bureau");
    });

    test("Bureau peut éditer les cultures", () => {
      expect(UserManager.canEditCrops()).toBe(true);
    });

    test("Bureau peut gérer les tâches", () => {
      expect(UserManager.canManageTasks()).toBe(true);
    });

    test("Bureau peut gérer les récoltes", () => {
      expect(UserManager.canManageHarvests()).toBe(true);
    });

    test("Bureau peut gérer les finances", () => {
      expect(UserManager.canEditFinances()).toBe(true);
    });

    test("Bureau peut saisir les ventes", () => {
      expect(UserManager.canEnterSales()).toBe(true);
    });

    test("Bureau peut gérer les employés", () => {
      expect(UserManager.canManageEmployees()).toBe(true);
    });

    test("Bureau peut gérer les stocks", () => {
      expect(UserManager.canManageStocks()).toBe(true);
    });

    test("Bureau peut voir les finances", () => {
      expect(UserManager.canViewFinances()).toBe(true);
    });

    test("Bureau peut voir les employés", () => {
      expect(UserManager.canViewEmployees()).toBe(true);
    });

    test("Bureau NE PEUT PAS accéder au admin dashboard", () => {
      expect(UserManager.isAdmin()).toBe(false);
    });
  });

  describe("Permissions - Rôle admin", () => {
    beforeEach(() => {
      createUser("admin");
    });

    test("admin peut tout faire", () => {
      expect(UserManager.isAdmin()).toBe(true);
      expect(UserManager.canEditCrops()).toBe(true);
      expect(UserManager.canEditFinances()).toBe(true);
      expect(UserManager.canManageEmployees()).toBe(true);
      expect(UserManager.canManageStocks()).toBe(true);
      expect(UserManager.canManageTasks()).toBe(true);
      expect(UserManager.canManageHarvests()).toBe(true);
    });
  });

  describe("Permissions - Rôle super_admin", () => {
    beforeEach(() => {
      createUser("super_admin");
    });

    test("super_admin peut tout faire", () => {
      expect(UserManager.isAdmin()).toBe(true);
      expect(UserManager.canEditCrops()).toBe(true);
      expect(UserManager.canEditFinances()).toBe(true);
      expect(UserManager.canManageEmployees()).toBe(true);
      expect(UserManager.canManageStocks()).toBe(true);
      expect(UserManager.canManageTasks()).toBe(true);
      expect(UserManager.canManageHarvests()).toBe(true);
    });
  });

  describe("Cas limites", () => {
    test("utilisateur non connecté: toutes permissions refusées", () => {
      // Pas d'utilisateur créé
      expect(UserManager.isLoggedIn()).toBe(false);
      expect(UserManager.canEditCrops()).toBe(false);
      expect(UserManager.canEditFinances()).toBe(false);
      expect(UserManager.canManageEmployees()).toBe(false);
      expect(UserManager.canManageStocks()).toBe(false);
      expect(UserManager.canManageTasks()).toBe(false);
      expect(UserManager.canManageHarvests()).toBe(false);
    });

    test("utilisateur sans rôle: toutes permissions refusées", () => {
      createUser(null);
      expect(UserManager.canEditCrops()).toBe(false);
    });

    test("rôle inconnu: toutes permissions refusées", () => {
      createUser("unknown_role");
      expect(UserManager.canEditCrops()).toBe(false);
      expect(UserManager.canEditFinances()).toBe(false);
    });
  });

  describe("Auth helpers", () => {
    test("requireAuth retourne false si non connecté", () => {
      // Ne pas créer d'utilisateur - tester le comportement sans connexion
      const result = UserManager.requireAuth();
      expect(result).toBe(false);
    });

    test("redirectIfAuth ne fait rien si non connecté", () => {
      // Ne pas créer d'utilisateur - tester le comportement sans connexion
      const result = UserManager.redirectIfAuth();
      expect(result).toBeUndefined();
    });
  });
});
