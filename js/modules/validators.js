/**
 * Module de validation pour KA Farm
 * Utilise Zod pour la validation de schémas robuste et type-safe
 * @module validators
 * @description Fournit des schémas Zod et des fonctions de validation pour tous les entités KA Farm
 */

import { z } from "zod";
import { USER_ROLES, ALL_USER_ROLES } from "../constants/roles.js";

// ==================== SCHÉMAS DE VALIDATION ====================

/**
 * Schéma de validation pour les utilisateurs
 * Vérifie: ID UUID, email valide, nom, rôle, entreprise
 * @type {z.ZodObject}
 */
export const UserSchema = z.object({
  id: z.string().uuid("ID utilisateur invalide"),
  email: z.string().email("Email invalide"),
  name: z.string().min(2, "Nom trop court").max(255, "Nom trop long"),
  role: z.enum(ALL_USER_ROLES, { message: "Rôle invalide" }),
  enterprise_id: z.string().default("ka_farm"),
  enterprise_name: z.string().default("KA Farm"),
  enterprise_code: z.string().default("KA-FARM"),
});

/**
 * Schéma de validation pour les parcelles agricoles
 * Vérifie: nom, surface, coordonnées GPS, type de sol, statut
 * @type {z.ZodObject}
 */
export const ParcelleSchema = z.object({
  id: z.string().uuid("ID parcelle invalide"),
  enterprise_id: z.string().default("ka_farm"),
  name: z.string().min(1, "Nom requis").max(255, "Nom trop long"),
  surface: z.number().positive("Surface doit être positive").optional(),
  lat: z.number().min(-90, "Latitude invalide").max(90, "Latitude invalide").optional(),
  lng: z.number().min(-180, "Longitude invalide").max(180, "Longitude invalide").optional(),
  status: z
    .enum(["Cultivée", "En jachère", "En pépinière", "Libre"], {
      message: "Statut de parcelle invalide",
    })
    .default("Cultivée"),
  type_sol: z
    .enum(["sableux", "argileux", "limoneux", "latéritique"], {
      message: "Type de sol invalide",
    })
    .default("sableux"),
  current_crop: z.string().optional(),
  water_status: z
    .enum(["Irrigé", "Non irrigué", "En attente"], { message: "Statut d'irrigation invalide" })
    .default("Irrigué"),
});

/**
 * Schéma de validation pour les cultures
 * Vérifie: nom, dates de semis/récolte, statut, eau, engrais
 * @type {z.ZodObject}
 */
export const CropSchema = z.object({
  id: z.string().uuid("ID culture invalide"),
  enterprise_id: z.string().default("ka_farm"),
  name: z.string().min(1, "Nom de culture requis").max(255, "Nom trop long"),
  field: z.string().optional(),
  sowing_date: z.string().date("Date invalide").optional(),
  harvest_date: z.string().date("Date invalide").optional(),
  status: z
    .enum(["Croissance", "Récolte", "Terminé", "En pépinière"], {
      message: "Statut de culture invalide",
    })
    .default("Croissance"),
  water_status: z
    .enum(["Optimal", "Sous-arrosé", "Sur-arrosé"], { message: "Statut d'irrigation invalide" })
    .default("Optimal"),
  fertilizer_status: z
    .enum(["OK", "À appliquer", "En cours"], { message: "Statut d'engrais invalide" })
    .default("OK"),
  parcel_id: z.string().uuid("ID parcelle invalide").optional(),
});

/**
 * Schéma de validation pour les traitements phytosanitaires
 * Gère le suivi des délais de carence (DAR - Délai Avant Récolte)
 * Vérifie: produit, date, DAR, cible, notes
 * @type {z.ZodObject}
 */
export const TreatmentSchema = z.object({
  id: z.string().uuid("ID traitement invalide"),
  enterprise_id: z.string().default("ka_farm"),
  parcel_id: z.string().uuid("ID parcelle invalide").optional(),
  crop_id: z.string().uuid("ID culture invalide").optional(),
  crop_name: z.string().min(1, "Nom de culture requis").max(255),
  parcel_name: z.string().min(1, "Nom de parcelle requis").max(255),
  product_name: z.string().min(1, "Nom du produit requis").max(255),
  category: z.string().min(1, "Catégorie requise").max(100),
  date_applied: z.string().date("Date invalide"),
  dar_days: z.number().int("DAR doit être un entier").min(0, "DAR doit être positif").default(7),
  target: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  harvest_ready: z.boolean().default(false),
});

/**
 * Schéma de validation pour les finances
 * Gère revenus et dépenses avec catégories
 * Vérifie: description, montant positif, type (Revenu/Dépense), date
 * @type {z.ZodObject}
 */
export const FinanceSchema = z.object({
  id: z.string().uuid("ID finance invalide"),
  enterprise_id: z.string().default("ka_farm"),
  description: z.string().min(1, "Description requise").max(255),
  category: z.string().min(1, "Catégorie requise").max(100),
  type: z.enum(["Revenu", "Dépense"], { message: "Type de finance invalide" }),
  amount: z.number().positive("Montant doit être positif"),
  date: z.string().date("Date invalide"),
  parcel_id: z.string().uuid("ID parcelle invalide").optional(),
  crop_name: z.string().max(255).optional(),
});

/**
 * Schéma de validation pour les employés
 * Vérifie: nom, téléphone sénégalais, rôle, taux journalier, statut
 * @type {z.ZodObject}
 */
export const EmployeeSchema = z.object({
  id: z.string().uuid("ID employé invalide"),
  enterprise_id: z.string().default("ka_farm"),
  name: z.string().min(2, "Nom trop court").max(255),
  phone: z
    .string()
    .regex(/^(\+221|221)?[0-9]{9}$/, "Numéro sénégalais invalide")
    .optional(),
  role: z.string().default("Ouvrier agricole").max(100),
  daily_rate: z
    .number()
    .int("Taux journalier doit être un entier")
    .min(0, "Taux journalier doit être positif")
    .default(0),
  status: z
    .enum(["Actif", "Inactif", "En congé"], { message: "Statut invalide" })
    .default("Actif"),
});

/**
 * Schéma de validation pour les stocks
 * Gère seuils d'alerte et quantités disponibles
 * Vérifie: nom, catégorie, quantité, unité de mesure
 * @type {z.ZodObject}
 */
export const StockSchema = z.object({
  id: z.string().uuid("ID stock invalide"),
  enterprise_id: z.string().default("ka_farm"),
  name: z.string().min(1, "Nom requis").max(255),
  category: z.enum(["semence", "engrais", "traitement", "outillage"], {
    message: "Catégorie invalide",
  }),
  quantity: z.number().min(0, "Quantité ne peut être négative").default(0),
  max_quantity: z.number().min(0, "Capacité maximale doit être positive").default(0),
  unit: z.enum(["kg", "sac", "litre", "sachet", "unité"], { message: "Unité invalide" }),
  alert_threshold: z.number().min(0, "Seuil d'alerte invalide").default(0),
});

/**
 * Schéma de validation pour les récoltes
 * Vérifie: poids, qualité (Choix A/B/C), date, prix
 * @type {z.ZodObject}
 */
export const HarvestSchema = z.object({
  id: z.string().uuid("ID récolte invalide"),
  enterprise_id: z.string().default("ka_farm"),
  parcel_id: z.string().uuid("ID parcelle invalide").optional(),
  crop_id: z.string().uuid("ID culture invalide").optional(),
  crop_name: z.string().min(1, "Nom de culture requis").max(255),
  parcel_name: z.string().min(1, "Nom de parcelle requis").max(255),
  weight_kg: z.number().positive("Poids doit être positif").default(0),
  quality: z
    .enum(["Choix A", "Choix B", "Choix C"], { message: "Qualité invalide" })
    .default("Choix A"),
  harvest_date: z.string().date("Date invalide"),
  selling_price_per_kg: z.number().min(0, "Prix invalide").default(0),
  total_revenue: z.number().min(0, "Revenu invalide").default(0),
});

/**
 * Schéma de validation pour les ventes
 * Gère marchés, intermédiaires, paiements partiels
 * Vérifie: quantité, prix, destination, statut de paiement
 * @type {z.ZodObject}
 */
export const SaleSchema = z.object({
  id: z.string().uuid("ID vente invalide"),
  enterprise_id: z.string().default("ka_farm"),
  harvest_id: z.string().uuid("ID récolte invalide").optional(),
  crop_name: z.string().min(1, "Nom de culture requis").max(255),
  market_destination: z.string().min(1, "Destination requise").max(255),
  quantity_kg: z.number().positive("Quantité doit être positive"),
  unit_price_fcfa: z.number().positive("Prix unitaire doit être positif"),
  total_amount_fcfa: z.number().min(0, "Montant invalide"),
  intermediary_name: z.string().max(255).optional(),
  intermediary_phone: z.string().max(20).optional(),
  payment_status: z
    .enum(["Payé", "Partiel", "Non payé"], { message: "Statut de paiement invalide" })
    .default("Non payé"),
  deposit_fcfa: z.number().min(0, "Acompte invalide").default(0),
  balance_fcfa: z.number().min(0, "Solde invalide").default(0),
  sale_date: z.string().date("Date invalide"),
});

/**
 * Schéma de validation pour les tâches
 * Vérifie: titre, catégorie, priorité, assigné, statut complété
 * @type {z.ZodObject}
 */
export const TaskSchema = z.object({
  id: z.string().uuid("ID tâche invalide"),
  enterprise_id: z.string().default("ka_farm"),
  title: z.string().min(1, "Titre requis").max(255),
  category: z
    .enum(["Entretien", "Irrigation", "Récolte", "Traitement", "Plantation", "Autre"], {
      message: "Catégorie invalide",
    })
    .default("Entretien"),
  due_date: z.string().date("Date invalide").optional(),
  assignee: z.string().max(255).optional(),
  priority: z
    .enum(["Basse", "Moyenne", "Haute", "Urgente"], { message: "Priorité invalide" })
    .default("Moyenne"),
  completed: z.boolean().default(false),
});

// ==================== FONCTIONS DE VALIDATION ====================

/**
 * Valide des données contre un schéma Zod donné
 * Gère les erreurs et retourne les messages formatés
 * @param {z.ZodSchema} schema - Schéma Zod à utiliser pour la validation
 * @param {*} data - Données à valider
 * @returns {Object} Objet {success: boolean, data: any, errors: Array<{field, message}>}
 */
export function validateData(schema, data) {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated, errors: null };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        data: null,
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      };
    }
    return {
      success: false,
      data: null,
      errors: [{ field: "unknown", message: "Erreur de validation inconnue" }],
    };
  }
}

/**
 * Valide un numéro de téléphone sénégalais
 * Formats acceptés: 771234567, +221771234567, 221771234567
 * @param {string} phone - Numéro à valider
 * @returns {Object} Résultat de validation
 * @example
 * validatePhoneNumber("771234567") // { success: true, data: "771234567", errors: null }
 */
export function validatePhoneNumber(phone) {
  const phoneSchema = z
    .string()
    .regex(
      /^(\+221|221)?[0-9]{9}$/,
      "Numéro de téléphone sénégalais invalide (ex: 771234567 ou +221771234567)"
    );
  return validateData(phoneSchema, phone);
}

/**
 * Valide une adresse email
 * @param {string} email - Email à valider
 * @returns {Object} Résultat de validation
 */
export function validateEmail(email) {
  const emailSchema = z.string().email("Email invalide");
  return validateData(emailSchema, email);
}

/**
 * Valide des coordonnées GPS (latitude/longitude)
 * Vérifie: -90 ≤ lat ≤ 90, -180 ≤ lng ≤ 180
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} Résultat de validation
 */
export function validateCoordinates(lat, lng) {
  const schema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  });
  return validateData(schema, { lat, lng });
}

/**
 * Valide qu'une valeur est un nombre positif
 * @param {number} value - Valeur à valider
 * @param {string} fieldName - Nom du champ (pour le message d'erreur)
 * @returns {Object} Résultat de validation
 */
export function validatePositiveNumber(value, fieldName = "Valeur") {
  const schema = z.number().positive(`${fieldName} doit être positif`);
  return validateData(schema, value);
}

/**
 * Valide une date ISO 8601
 * @param {string} dateString - Date à valider (format ISO 8601)
 * @returns {Object} Résultat de validation
 */
export function validateDate(dateString) {
  const schema = z.string().datetime("Date invalide");
  return validateData(schema, dateString);
}

/**
 * Valide un tableau de données contre un même schéma
 * Utile pour les imports en masse
 * @param {z.ZodSchema} schema - Schéma à utiliser
 * @param {Array} dataArray - Tableau de données à valider
 * @returns {Array<Object>} Tableau de résultats de validation
 */
export function validateMultiple(schema, dataArray) {
  return dataArray.map((data) => validateData(schema, data));
}

// ==================== SCHÉMAS D'AUTH ====================

/**
 * Schéma de validation pour la connexion
 * Vérifie: email valide, mot de passe non vide
 * @type {z.ZodObject}
 */
export const LoginSchema = z.object({
  email: z.string().trim().min(1, "Email requis").email("Email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  remember: z.boolean().optional(),
});

/**
 * Schéma de validation pour l'inscription
 * Vérifie: nom, email, rôle, entreprise, mot de passe (6+ chars), confirmation
 * @type {z.ZodObject}
 */
export const SignupSchema = z
  .object({
    name: z.string().trim().min(2, "Nom complet requis (au moins 2 caractères)").max(255),
    email: z.string().trim().min(1, "Email requis").email("Email invalide"),
    role: z.enum(ALL_USER_ROLES, { message: "Rôle invalide" }),
    enterpriseName: z.string().trim().min(1, "Nom de l'exploitation requis"),
    password: z.string().min(6, "Mot de passe trop court (minimum 6 caractères)"),
    confirmPassword: z.string().min(1, "Confirmation du mot de passe requise"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

/**
 * Valide les données de connexion contre LoginSchema
 * @param {Object} data - Données de connexion
 * @returns {Object} Résultat de validation
 */
export function validateLogin(data) {
  return validateData(LoginSchema, data);
}

/**
 * Valide les données d'inscription contre SignupSchema
 * @param {Object} data - Données d'inscription
 * @returns {Object} Résultat de validation
 */
export function validateSignup(data) {
  return validateData(SignupSchema, data);
}
