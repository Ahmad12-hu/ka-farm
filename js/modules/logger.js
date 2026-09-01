// Browser-compatible Logger pour KA Farm
// Utilise console avec style + localStorage pour persistance

/**
 * Détecte si le code s'exécute dans un environnement navigateur
 * @type {boolean}
 */
const isBrowser = typeof window !== "undefined";

/**
 * Détecte si le code s'exécute dans un environnement de test Jest
 * @type {boolean}
 */
const isTestEnvironment =
  typeof process !== "undefined" && process.env && process.env.NODE_ENV === "test";

// Storage key for error logs
const STORAGE_KEY = "kafarm_error_logs";
const MAX_LOGS = 50;

/**
 * Ensemble de fonctions de log avec formatage stylisé
 * @type {Object}
 */
const logFunctions = {
  /**
   * Log informatif (vert)
   * @param {string} message - Message à afficher
   * @param {Object} meta - Métadonnées additionnelles
   */
  info: (message, meta = {}) => {
    if (!isBrowser) {
      console.log(`[INFO] ${message}`, meta);
    } else {
      console.log(`%c[INFO] ${message}`, "color: #10B981; font-weight: bold;", meta);
    }
  },

  /**
   * Log d'erreur (rouge) - avec stockage en localStorage
   * @param {string} message - Message d'erreur
   * @param {Object} meta - Métadonnées d'erreur
   */
  error: (message, meta = {}) => {
    const errorStr =
      typeof meta?.error === "string" ? meta.error : meta?.error?.message || JSON.stringify(meta);
    // Skip console output in test environment to avoid Jest issues
    if (!isTestEnvironment) {
      try {
        if (!isBrowser) {
          if (typeof console !== "undefined" && typeof console.error === "function") {
            console.error(`[ERROR] ${message}:`, meta);
          }
        } else {
          if (typeof console !== "undefined" && typeof console.error === "function") {
            console.error(
              `%c[ERROR] ${message}: ${errorStr}`,
              "color: #EF4444; font-weight: bold;",
              meta
            );
          }
        }
      } catch (e) {
        // Silently fail if console is not available
      }
    }

    // Store in localStorage for persistence
    if (isBrowser) {
      try {
        const logs = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        logs.unshift({
          timestamp: new Date().toISOString(),
          level: "error",
          message,
          error: errorStr,
        });
        // Keep only last 50 logs
        if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
      } catch (e) {
        console.warn("Unable to save error log to localStorage:", e);
      }
    }
  },

  /**
   * Log d'avertissement (orange)
   * @param {string} message - Message d'avertissement
   * @param {Object} meta - Métadonnées additionnelles
   */
  warn: (message, meta = {}) => {
    // Skip console output in test environment to avoid Jest issues
    if (!isTestEnvironment) {
      try {
        if (!isBrowser) {
          if (typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn(`[WARN] ${message}`, meta);
          }
        } else {
          if (typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn(`%c[WARN] ${message}`, "color: #F59E0B; font-weight: bold;`, meta);
          }
        }
      } catch (e) {
        // Silently fail if console is not available
      }
    }
  },

  /**
   * Log de débogage (bleu)
   * @param {string} message - Message de débogage
   * @param {Object} meta - Métadonnées additionnelles
   */
  debug: (message, meta = {}) => {
    if (!isBrowser) {
      console.debug(`[DEBUG] ${message}`, meta);
    } else {
      console.debug(`%c[DEBUG] ${message}`, "color: #3B82F6; font-weight: bold;`, meta);
    }
  },

  /**
   * Log HTTP (violet)
   * @param {string} message - Message HTTP
   * @param {Object} meta - Métadonnées additionnelles
   */
  http: (message, meta = {}) => {
    if (!isBrowser) {
      console.log(`[HTTP] ${message}`, meta);
    } else {
      console.log(`%c[HTTP] ${message}`, "color: #8B5CF6; font-weight: bold;`, meta);
    }
  },
};

/**
 * Objet logger exportable - pour les imports ES6
 * @type {Object}
 */
export const logger = {
  info: logFunctions.info,
  error: logFunctions.error,
  warn: logFunctions.warn,
  debug: logFunctions.debug,
  http: logFunctions.http,
};

/**
 * Export par défaut - pour les imports ESM classiques
 * @type {Object}
 */
export default {
  info: logFunctions.info,
  error: logFunctions.error,
  warn: logFunctions.warn,
  debug: logFunctions.debug,
  http: logFunctions.http,
};

/**
 * Récupère les logs stockés en localStorage
 * Utilisé pour les diagnostics et debug
 * @returns {Array<Object>} Liste des logs stockés
 */
export const getStoredLogs = () => {
  if (!isBrowser) return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (e) {
    return [];
  }
};

/**
 * Efface tous les logs stockés en localStorage
 * @returns {void}
 */
export const clearLogs = () => {
  if (!isBrowser) return;
  localStorage.removeItem(STORAGE_KEY);
};
