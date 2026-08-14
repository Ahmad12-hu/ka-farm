// KA Farm - User Manager
// Gère les rôles, les permissions et les règles d'autorisation

import { KAStorage } from "./storage.js";
import { USER_ROLES, ALL_USER_ROLES, ROLE_PERMISSIONS, isAdminRole } from "./constants/roles.js";

export const UserManager = {
  getRoles() {
    return {
      TERRAIN: USER_ROLES.TERRAIN,
      BUREAU: USER_ROLES.BUREAU,
    };
  },

  getCurrentUser() {
    return KAStorage.getCurrentUser();
  },

  isLoggedIn() {
    return KAStorage.getCurrentUser() !== null;
  },

  // Vérifier si l'utilisateur courant a le rôle Terrain (opérateur de terrain)
  isTerrain() {
    const user = this.getCurrentUser();
    return user && user.role === "Terrain";
  },

  // Vérifier si l'utilisateur courant a le rôle Bureau (superviseur de bureau)
  isBureau() {
    const user = this.getCurrentUser();
    return user && user.role === "Bureau";
  },

  // Vérifier si l'utilisateur courant est administrateur
  isAdmin() {
    const user = this.getCurrentUser();
    return user && isAdminRole(user.role);
  },

  // Vérification des permissions selon le rôle
  canEditCrops() {
    const user = this.getCurrentUser();
    return !!(user && ALL_USER_ROLES.includes(user.role));
  },

  canEditFinances() {
    const user = this.getCurrentUser();
    return !!(user && (user.role === USER_ROLES.BUREAU || isAdminRole(user.role)));
  },

  canEnterSales() {
    const user = this.getCurrentUser();
    return !!(user && ALL_USER_ROLES.includes(user.role));
  },

  canManageTasks() {
    const user = this.getCurrentUser();
    return !!(user && ALL_USER_ROLES.includes(user.role));
  },

  canManageEmployees() {
    const user = this.getCurrentUser();
    return !!(user && (user.role === USER_ROLES.BUREAU || isAdminRole(user.role)));
  },

  canManageStocks() {
    const user = this.getCurrentUser();
    return !!(user && (user.role === USER_ROLES.BUREAU || isAdminRole(user.role)));
  },

  // Permissions en lecture seule pour les pages partagées
  canViewFinances() {
    const user = this.getCurrentUser();
    return !!(user && ALL_USER_ROLES.includes(user.role));
  },

  canViewEmployees() {
    const user = this.getCurrentUser();
    return !!(user && ALL_USER_ROLES.includes(user.role));
  },

  canManageHarvests() {
    const user = this.getCurrentUser();
    return !!(user && ALL_USER_ROLES.includes(user.role));
  },

  // Aide pour exiger une connexion. Rediriger vers la page de connexion si l'utilisateur n'est pas authentifié
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.assign("/pages/auth/login.html");
      return false;
    }
    return true;
  },

  // Rediriger si l'utilisateur est déjà connecté (par exemple, de la page de connexion vers le tableau de bord)
  redirectIfAuth() {
    if (this.isLoggedIn()) {
      window.location.assign("/pages/shared/dashboard.html");
    }
  },
};
