# Guide de Transformation Multi-Utilisateurs - KA Farm

**Objectif** : Transformer KA-Farm en application SaaS multi-utilisateurs où chaque personne peut créer son compte et gérer SA PROPRE ferme.

**Stack actuelle** : Node.js + Express + PostgreSQL (authentification JWT/Supabase)

**Durée estimée** : 3-4 étapes, 2-3 heures de travail

---

## 📋 PLAN GLOBAL

```
Étape 1 : Nettoyage des comptes fictifs (30 min)
Étape 2 : Inscription/Connexion publique (45 min)
Étape 3 : Multi-tenancy & RLS (1h)
Étape 4 : Onboarding automatique (30 min)
Étape 5 : Tests et déploiement (30 min)
```

---

## ÉTAPE 1 : NETTOYAGE DES COMPTES FICTIFS

### 1.1 Identifier les comptes fictifs dans Supabase

**Connexion à Supabase :**

1. Allez sur https://app.supabase.com
2. Sélectionnez votre projet KA-Farm
3. Cliquez sur **Authentication** > **Users**

**Critères d'identification des comptes fictifs :**

- Emails de test : `test@example.com`, `demo@kafarm.com`, `admin@test.com`
- Noms contenant "demo", "test", "fictif"
- Date de création récente mais aucune activité

**Action :** Notez les emails des comptes à supprimer.

### 1.2 Requêtes SQL pour identifier les données liées

Exécutez ces requêtes dans **Supabase > SQL Editor** pour trouver toutes les données associées :

```sql
-- 1. Lister tous les utilisateurs (remplacez 'demo' par votre recherche)
SELECT id, email, name, role, created_at
FROM users
WHERE email LIKE '%demo%'
   OR email LIKE '%test%'
   OR name LIKE '%demo%'
   OR name LIKE '%test%';

-- 2. Trouver les harvests liés à un utilisateur fictif
SELECT h.*, u.email as user_email
FROM harvests h
JOIN users u ON h.user_id = u.id
WHERE u.email LIKE '%demo%' OR u.email LIKE '%test%';

-- 3. Trouver les parcelles liées à des comptes fictifs
SELECT p.*, u.email as user_email
FROM parcelles p
JOIN users u ON p.user_id = u.id
WHERE u.email LIKE '%demo%' OR u.email LIKE '%test%';

-- 4. Trouver toutes les données d'un utilisateur spécifique
-- Remplacez 'USER_ID_HERE' par l'ID du compte à supprimer
SELECT
  'harvests' as table_name, COUNT(*) as count, user_id
FROM harvests WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT
  'parcelles' as table_name, COUNT(*) as count, user_id
FROM parcelles WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT
  'crops' as table_name, COUNT(*) as count, user_id
FROM crops WHERE user_id = 'USER_ID_HERE'
UNION ALL
SELECT
  'finances' as table_name, COUNT(*) as count, user_id
FROM finances WHERE user_id = 'USER_ID_HERE';
```

### 1.3 Suppression sécurisée des comptes fictifs

**SAUVEGARDE AVANT SUPPRESSION :**

```sql
-- 1. Exportez vos données importantes
SELECT * FROM harvests WHERE user_id = 'VOTRE_USER_ID_ADMIN';
SELECT * FROM parcelles WHERE user_id = 'VOTRE_USER_ID_ADMIN';
SELECT * FROM finances WHERE user_id = 'VOTRE_USER_ID_ADMIN';
```

**Procédure de suppression :**

```sql
-- ÉTAPE 1 : Supprimer les données associées à un utilisateur fictif
-- Remplacez 'USER_ID_FICTIF' par l'ID du compte à supprimer

-- Supprimer dans l'ordre (respecter les foreign keys)
DELETE FROM harvests WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM parcelles WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM crops WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM finances WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM employee_payments WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM daily_workers WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM stocks WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM tasks WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM employees WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM traitements_phytosanitaires WHERE user_id = 'USER_ID_FICTIF';
DELETE FROM messages WHERE user_id = 'USER_ID_FICTIF';

-- ÉTAPE 2 : Supprimer le compte utilisateur
DELETE FROM users WHERE id = 'USER_ID_FICTIF';

-- ÉTAPE 3 : Vérifier dans Supabase Auth
-- Allez dans Authentication > Users et supprimez manuellement l'utilisateur
```

### 1.4 Vérification du code pour les données seed

Recherchez dans votre code des fichiers qui créent des données de démo :

```bash
# Rechercher des références à "demo", "test", "seed"
grep -r "demo" --include="*.js" --include="*.ts" .
grep -r "seed" --include="*.js" --include="*.ts" .
grep -r "test@example.com" --include="*.js" --include="*.ts" .
```

**Fichiers à vérifier :**

- `server.js` - lignes 89-105 (serverMessages, serverStocks, etc.)
- `js/storage.js` - méthodes de peuplement par défaut
- `db/seed.sql` - fichier de données initiales (s'il existe)

**Action** : Supprimez ou commentez tout code qui crée automatiquement des données fictives.

---

## ÉTAPE 2 : INSCRIPTION / CONNECTION PUBLIQUE

### 2.1 Installer Supabase Auth (si pas déjà fait)

```bash
npm install @supabase/supabase-js
```

### 2.2 Configuration Supabase

**Fichier `.env` :**

```env
# Supabase
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=votre-anon-key
SUPABASE_SERVICE_ROLE_KEY=votre-service-role-key

# JWT (optionnel si vous utilisez Supabase Auth)
JWT_SECRET=votre-secret-jwt-super-long-et-complexe
```

**Récupérer les clés :**

1. Supabase > Settings > API
2. Copiez `URL` et `anon` key (public)
3. Copiez `service_role` key (SECRET - ne JAMAIS exposer)

### 2.3 Créer le module d'authentification

**`js/modules/auth.js`** (NOUVEAU FICHIER) :

```javascript
// Module d'authentification Supabase pour KA Farm
import { createClient } from "@supabase/supabase-js";

// Configuration Supabase
const supabaseUrl = import.meta.env.SUPABASE_URL || "http://localhost:54321";
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || "votre-anon-key";

// Client Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client admin (pour opérations serveur uniquement)
export const supabaseAdmin = createClient(
  supabaseUrl,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY || "votre-service-role-key"
);

// ==================== INSCRIPTION ====================

export async function signUp(email, password, userData) {
  try {
    // 1. Créer le compte Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          name: userData.name,
          phone: userData.phone || "",
          role: "user", // Rôle par défaut pour nouveaux utilisateurs
        },
      },
    });

    if (authError) {
      return { success: false, error: authError.message };
    }

    // 2. Créer l'entrée dans la table users
    const { data: user, error: dbError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id, // UUID de Supabase Auth
        email: email,
        name: userData.name,
        phone: userData.phone || "",
        role: "user",
        enterprise_id: generateEnterpriseId(email),
        enterprise_name: userData.farm_name || `Ferme de ${userData.name}`,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Erreur création profil utilisateur:", dbError);
      // Optionnel : supprimer le compte Auth si la création DB échoue
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { success: false, error: "Erreur lors de la création du profil" };
    }

    // 3. Créer les données par défaut pour la ferme (voir Étape 5)
    await createDefaultFarmData(authData.user.id);

    return {
      success: true,
      user: user,
      message: "Compte créé avec succès ! Vérifiez votre email.",
    };
  } catch (error) {
    console.error("Erreur signUp:", error);
    return { success: false, error: "Erreur serveur lors de l'inscription" };
  }
}

// ==================== CONNEXION ====================

export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Récupérer le profil utilisateur
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (userError) {
      return { success: false, error: "Profil utilisateur introuvable" };
    }

    return {
      success: true,
      user: user,
      session: data.session,
    };
  } catch (error) {
    console.error("Erreur signIn:", error);
    return { success: false, error: "Erreur serveur lors de la connexion" };
  }
}

// ==================== DÉCONNEXION ====================

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    return { success: !error, error: error?.message };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== UTILITAIRES ====================

export function generateEnterpriseId(email) {
  // Générer un ID unique pour la ferme de l'utilisateur
  return `farm_${email.split("@")[0].toLowerCase()}_${Date.now()}`;
}

export function isAdmin(user) {
  // Vérifier si l'utilisateur est admin (vous ou votre frère)
  return user.role === "admin" || user.role === "super_admin";
}

export function getUserFarms(userId) {
  // Récupérer toutes les fermes d'un utilisateur (pour futur multi-fermes)
  return supabaseAdmin.from("farms").select("*").eq("user_id", userId);
}

// ==================== MIDDLEWARE D'AUTHENTIFICATION ====================

export async function getCurrentUser(request) {
  // Pour Express.js - vérifier le JWT dans les headers
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  // Récupérer le profil complet
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export function requireAuth(request, response, next) {
  getCurrentUser(request)
    .then((user) => {
      if (!user) {
        return response.status(401).json({ error: "Non autorisé" });
      }
      request.user = user;
      next();
    })
    .catch((error) => {
      console.error("Erreur auth middleware:", error);
      return response.status(500).json({ error: "Erreur serveur" });
    });
}
```

### 2.4 Créer les pages d'authentification

**`pages/auth/signup.html`** (NOUVEAU) :

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Inscription - KA Farm</title>
    <link rel="stylesheet" href="/css/auth.css" />
  </head>
  <body
    class="bg-gradient-to-br from-emerald-900 to-green-800 min-h-screen flex items-center justify-center"
  >
    <div class="max-w-md w-full mx-4">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-black text-white mb-2">KA FARM</h1>
        <p class="text-emerald-300">Créez votre compte</p>
      </div>

      <!-- Formulaire d'inscription -->
      <div class="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
        <form id="signup-form" class="space-y-6">
          <!-- Nom complet -->
          <div>
            <label class="block text-sm font-medium text-white mb-2"> Nom complet * </label>
            <input
              type="text"
              id="name"
              required
              class="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Amadou Diallo"
            />
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-white mb-2"> Email * </label>
            <input
              type="email"
              id="email"
              required
              class="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="votre@email.com"
            />
          </div>

          <!-- Mot de passe -->
          <div>
            <label class="block text-sm font-medium text-white mb-2"> Mot de passe * </label>
            <input
              type="password"
              id="password"
              required
              minlength="6"
              class="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="••••••••"
            />
            <p class="text-xs text-emerald-300 mt-1">Minimum 6 caractères</p>
          </div>

          <!-- Confirmation mot de passe -->
          <div>
            <label class="block text-sm font-medium text-white mb-2">
              Confirmer le mot de passe *
            </label>
            <input
              type="password"
              id="confirm-password"
              required
              class="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="••••••••"
            />
          </div>

          <!-- Nom de la ferme (optionnel) -->
          <div>
            <label class="block text-sm font-medium text-white mb-2">
              Nom de votre ferme (optionnel)
            </label>
            <input
              type="text"
              id="farm-name"
              class="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Ferme du Soleil"
            />
          </div>

          <!-- Message d'erreur -->
          <div
            id="error-message"
            class="hidden bg-red-500/20 border border-red-400 text-red-100 px-4 py-3 rounded-lg text-sm"
          ></div>

          <!-- Bouton d'inscription -->
          <button
            type="submit"
            class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <span>Créer mon compte</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              ></path>
            </svg>
          </button>
        </form>

        <!-- Lien vers login -->
        <div class="mt-6 text-center">
          <p class="text-white/80 text-sm">
            Vous avez déjà un compte ?
            <a
              href="/pages/auth/login.html"
              class="text-emerald-300 hover:text-emerald-200 font-medium"
            >
              Se connecter
            </a>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center mt-6">
        <p class="text-emerald-300/80 text-xs">
          En vous inscrivant, vous acceptez nos conditions d'utilisation
        </p>
      </div>
    </div>

    <script type="module" src="/js/auth-client.js"></script>
  </body>
</html>
```

**`js/auth-client.js`** (NOUVEAU) :

```javascript
// Client-side Authentication pour KA Farm
import { signUp, signIn } from "../js/modules/auth.js";

// ==================== INSCRIPTION ====================

const signupForm = document.getElementById("signup-form");
const errorMessage = document.getElementById("error-message");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Récupérer les valeurs du formulaire
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const farmName = document.getElementById("farm-name").value;

    // Validation
    if (password !== confirmPassword) {
      showError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      showError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    // Masquer l'erreur
    hideError();

    // Appel à l'API
    try {
      const result = await signUp(email, password, {
        name: name,
        phone: "",
        farm_name: farmName,
      });

      if (result.success) {
        // Redirection vers le dashboard
        alert("Compte créé avec succès ! Vérifiez votre email pour confirmer.");
        window.location.href = "/pages/shared/dashboard.html";
      } else {
        showError(result.error || "Erreur lors de l'inscription");
      }
    } catch (error) {
      showError("Erreur serveur. Veuillez réessayer.");
      console.error("Signup error:", error);
    }
  });
}

// ==================== CONNEXION ====================

const loginForm = document.getElementById("login-form");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    hideError();

    try {
      const result = await signIn(email, password);

      if (result.success) {
        // Stocker le token dans localStorage
        localStorage.setItem("kafarm_token", result.session.access_token);
        localStorage.setItem("kafarm_user", JSON.stringify(result.user));

        // Redirection
        const redirectTo =
          localStorage.getItem("redirect_after_login") || "/pages/shared/dashboard.html";
        window.location.href = redirectTo;
      } else {
        showError(result.error || "Email ou mot de passe incorrect");
      }
    } catch (error) {
      showError("Erreur serveur. Veuillez réessayer.");
      console.error("Login error:", error);
    }
  });
}

// ==================== UTILITAIRES ====================

function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
  }
}

function hideError() {
  if (errorMessage) {
    errorMessage.classList.add("hidden");
  }
}

// Vérifier si l'utilisateur est connecté au chargement
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("kafarm_token");
  const user = localStorage.getItem("kafarm_user");

  if (!token || !user) {
    // Utilisateur non connecté - rediriger vers login si sur page protégée
    const protectedPages = ["/pages/shared/dashboard.html", "/pages/shared/harvest.html"];
    if (protectedPages.some((page) => window.location.pathname.includes(page))) {
      window.location.href = "/pages/auth/login.html";
    }
  }
});
```

> ### ⚠️ Note d'état : écart entre ce document et le code réel (2026-08-09)
>
> Le flux Supabase décrit ci-dessus (stockage de `kafarm_token` + `kafarm_user` au
> login) est l'**architecture cible**, mais **n'est PAS encore implémenté dans le
> frontend**.
>
> **État actuel du code** :
> - `js/auth.js` effectue une authentification **locale** (via `localStorage` +
>   `KAStorage`), et le frontend **n'envoie jamais** de token `Authorization:
>   Bearer ...` dans ses appels `fetch`.
> - En conséquence, **toutes les routes protégées par `requireAuth` du backend
>   de production** (`api/index.js`) — à commencer par l'IA (`/api/gemini`,
>   `/api/ai/*`) et `/api/stocks` — renvoient **401** lorsque le frontend les
>   appelle, car aucun token n'est fourni.
> - En **développement local** (`server.js`), les routes IA ne sont **pas**
>   protégées, donc l'IA fonctionne en local.
>
> **Résolution prévue** : migrer l'authentification frontend vers **Firebase
> Auth** (`signInWithEmailAndPassword`, `onAuthStateChanged`) afin que chaque
> requête envoie un **ID token Firebase** valide. Cette migration débloquera
> automatiquement **toutes** les routes `requireAuth` (IA + données), sans
> nécessiter de route JWT de session temporaire.
>
> **Ne pas faire** : construire un second mécanisme de session JWT juste pour
> l'IA — il serait jetable après la migration Firebase Auth.
>
> **Liste des routes concernées (bloquées en prod tant que la migration n'est
> pas faite)** :
> - IA : `/api/gemini`, `/api/ai/openai`, `/api/ai/claude`, `/api/ai/stream`,
>   `/api/ai/agents`, `/api/ai/translate`
> - Données : `/api/stocks` (et toutes les routes `requireAuth` de `/api/crops`,
>   `/api/parcelles`, etc. si jamais appelées par le frontend)
> - Non concernées (publiques) : `/api/weather`, `/api/health`, `/api/auth/login`

### 2.5 Page de login

**`pages/auth/login.html`** (NOUVEAU) :

```html
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Connexion - KA Farm</title>
    <link rel="stylesheet" href="/css/auth.css" />
  </head>
  <body
    class="bg-gradient-to-br from-emerald-900 to-green-800 min-h-screen flex items-center justify-center"
  >
    <div class="max-w-md w-full mx-4">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-black text-white mb-2">KA FARM</h1>
        <p class="text-emerald-300">Connectez-vous à votre espace</p>
      </div>

      <!-- Formulaire de connexion -->
      <div class="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
        <form id="login-form" class="space-y-6">
          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-white mb-2"> Email </label>
            <input
              type="email"
              id="email"
              required
              class="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="votre@email.com"
            />
          </div>

          <!-- Mot de passe -->
          <div>
            <label class="block text-sm font-medium text-white mb-2"> Mot de passe </label>
            <input
              type="password"
              id="password"
              required
              class="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="••••••••"
            />
          </div>

          <!-- Message d'erreur -->
          <div
            id="error-message"
            class="hidden bg-red-500/20 border border-red-400 text-red-100 px-4 py-3 rounded-lg text-sm"
          ></div>

          <!-- Bouton de connexion -->
          <button
            type="submit"
            class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <span>Se connecter</span>
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
              ></path>
            </svg>
          </button>
        </form>

        <!-- Lien vers signup -->
        <div class="mt-6 text-center">
          <p class="text-white/80 text-sm">
            Pas encore de compte ?
            <a
              href="/pages/auth/signup.html"
              class="text-emerald-300 hover:text-emerald-200 font-medium"
            >
              S'inscrire
            </a>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="text-center mt-6">
        <a href="/index.html" class="text-emerald-300/80 text-sm hover:text-emerald-200">
          ← Retour à l'accueil
        </a>
      </div>
    </div>

    <script type="module" src="/js/auth-client.js"></script>
  </body>
</html>
```

---

## ÉTAPE 3 : MULTI-TENANCY (ISOLATION DES DONNÉES)

### 3.1 Ajouter la colonne user_id dans les tables

**Migration SQL - `db/002_add_user_id_foreign_keys.sql`** :

```sql
BEGIN;

-- Ajouter user_id à toutes les tables principales
-- Note: Les colonnes sont déjà présentes dans le schéma initial si vous avez
-- exécuté le script schema.sql complet. Sinon, décommentez ci-dessous :

-- ALTER TABLE harvests ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE parcelles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE crops ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE stocks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE finances ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE traitements_phytosanitaires ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE daily_workers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
-- ALTER TABLE employee_payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Mettre à jour les lignes existantes avec votre user_id admin
-- Remplacez 'YOUR_ADMIN_USER_ID' par votre UUID d'admin
-- UPDATE parcelles SET user_id = 'YOUR_ADMIN_USER_ID' WHERE user_id IS NULL;
-- UPDATE crops SET user_id = 'YOUR_ADMIN_USER_ID' WHERE user_id IS NULL;
-- UPDATE harvests SET user_id = 'YOUR_ADMIN_USER_ID' WHERE user_id IS NULL;

COMMIT;
```

### 3.2 Row Level Security (RLS) Policies

**`db/policies_multi_tenant.sql`** (NOUVEAU) :

```sql
-- ============================================
-- ROW LEVEL SECURITY POLICIES - MULTI-TENANCY
-- ============================================

-- Activer RLS sur toutes les tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE harvests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE traitements_phytosanitaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICY : UTILISATEURS
-- ============================================

-- Les utilisateurs voient leur propre profil
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Les utilisateurs peuvent modifier leur propre profil
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- ============================================
-- POLICY : PARCELLES
-- ============================================

-- Les utilisateurs voient leurs propres parcelles
CREATE POLICY "Users can view own parcelles"
  ON parcelles FOR SELECT
  USING (user_id = auth.uid());

-- Les utilisateurs peuvent créer des parcelles
CREATE POLICY "Users can create parcelles"
  ON parcelles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Les utilisateurs peuvent modifier leurs parcelles
CREATE POLICY "Users can update own parcelles"
  ON parcelles FOR UPDATE
  USING (user_id = auth.uid());

-- Les utilisateurs peuvent supprimer leurs parcelles
CREATE POLICY "Users can delete own parcelles"
  ON parcelles FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : CROPS
-- ============================================

CREATE POLICY "Users can view own crops"
  ON crops FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create crops"
  ON crops FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own crops"
  ON crops FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own crops"
  ON crops FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : HARVESTS
-- ============================================

CREATE POLICY "Users can view own harvests"
  ON harvests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create harvests"
  ON harvests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own harvests"
  ON harvests FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own harvests"
  ON harvests FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : STOCKS
-- ============================================

CREATE POLICY "Users can view own stocks"
  ON stocks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own stocks"
  ON stocks FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : FINANCES
-- ============================================

CREATE POLICY "Users can view own finances"
  ON finances FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own finances"
  ON finances FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : EMPLOYEES
-- ============================================

CREATE POLICY "Users can view own employees"
  ON employees FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own employees"
  ON employees FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : TASKS
-- ============================================

CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own tasks"
  ON tasks FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : TRAITEMENTS PHYTOSANITAIRES
-- ============================================

CREATE POLICY "Users can view own treatments"
  ON traitements_phytosanitaires FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage own treatments"
  ON traitements_phytosanitaires FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- POLICY : MESSAGES (optionnel - pour futur chat)
-- ============================================

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create messages"
  ON messages FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- POLICY : ADMINS (vous et votre frère)
-- ============================================

-- Les admins voient toutes les données
CREATE POLICY "Admins can view all data"
  ON parcelles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

-- Répétez pour chaque table selon vos besoins admin

-- ============================================
-- INDEX POUR PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_parcelles_user_id ON parcelles(user_id);
CREATE INDEX IF NOT EXISTS idx_crops_user_id ON crops(user_id);
CREATE INDEX IF NOT EXISTS idx_harvests_user_id ON harvests(user_id);
CREATE INDEX IF NOT EXISTS idx_stocks_user_id ON stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_finances_user_id ON finances(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
```

### 3.3 Différence Admin Actuel vs Multi-utilisateurs

**Votre espace Admin ACTUEL (ce qui reste) :**

- Accès à TOUTES les données de VOTRE ferme
- Vous et votre frère uniquement
- Rôle : `admin` ou `super_admin`
- Données liées à `YOUR_ADMIN_USER_ID`

**Nouvel espace PUBLIC (ce qui arrive) :**

- Chaque utilisateur voit SEULEMENT ses propres données
- Accès isolé par `user_id`
- Rôle par défaut : `user`
- Politique RLS : `WHERE user_id = auth.uid()`

**Important :** Ces deux systèmes coexistent !

- Les admins peuvent toujours tout voir (avec la policy "Admins can view all data")
- Les utilisateurs normaux sont isolés

---

## ÉTAPE 4 : STRUCTURE DES PAGES

### 4.1 Organisation des routes

```
/
├── / (index.html) - Page d'accueil publique
├── /pages/auth/
│   ├── login.html - Connexion
│   └── signup.html - Inscription
├── /admin/ (votre espace privé - RESTE INTACT)
│   ├── /admin/dashboard.html
│   ├── /admin/settings.html
│   └── /admin/...
└── /app/ (nouvel espace utilisateurs)
    ├── /app/dashboard.html
    ├── /app/harvest.html
    ├── /app/parcelles.html
    └── /app/...
```

### 4.2 Middleware de protection des routes

**`js/middleware/auth.js`** (NOUVEAU) :

```javascript
// Middleware d'authentification et d'autorisation
import { getCurrentUser, isAdmin } from "../modules/auth.js";

export async function authMiddleware(request, response, next) {
  try {
    // 1. Récupérer l'utilisateur depuis le token JWT
    const user = await getCurrentUser(request);

    if (!user) {
      return response.status(401).json({
        error: "Non autorisé",
        message: "Vous devez être connecté",
      });
    }

    // 2. Attacher l'utilisateur à la requête
    request.user = user;

    // 3. Vérifier les permissions spécifiques si nécessaire
    if (request.path.startsWith("/admin") && !isAdmin(user)) {
      return response.status(403).json({
        error: "Accès interdit",
        message: "Cette zone est réservée aux administrateurs",
      });
    }

    // 4. Continuer vers le handler
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return response.status(500).json({ error: "Erreur serveur" });
  }
}

// Routes protégées
export const protectedRoutes = [
  "/api/harvests",
  "/api/parcelles",
  "/api/crops",
  "/api/stocks",
  "/api/finances",
  "/api/employees",
  "/api/tasks",
  "/api/treatments",
];

// Routes admin uniquement
export const adminRoutes = ["/admin/api/users", "/admin/api/settings"];
```

### 4.3 Intégrer le middleware dans server.js

Ajoutez ce code dans `server.js` après les middlewares existants :

```javascript
// Dans server.js - après app.use(express.json())

import { authMiddleware } from "./js/middleware/auth.js";

// Appliquer le middleware d'authentification aux routes API
app.use("/api/", authMiddleware);

// Routes admin avec protection renforcée
app.use("/admin/api/", requireAdmin);

function requireAdmin(request, response, next) {
  if (!isAdmin(request.user)) {
    return response.status(403).json({ error: "Accès admin requis" });
  }
  next();
}
```

---

## ÉTAPE 5 : ONBOARDING AUTOMATIQUE

### 5.1 Créer les données par défaut pour un nouvel utilisateur

Dans `js/modules/auth.js`, ajoutez :

```javascript
async function createDefaultFarmData(userId) {
  try {
    const enterpriseId = generateEnterpriseId(userId);

    // 1. Créer le profil de ferme par défaut
    await supabaseAdmin.from("farm_profiles").insert({
      user_id: userId,
      farm_name: "Ma Ferme",
      location: "Dakar",
      region: "Dakar",
      farm_size: 0,
      main_crops: [],
      created_at: new Date().toISOString(),
    });

    // 2. Créer une parcelle exemple (optionnel)
    await supabaseAdmin.from("parcelles").insert({
      user_id: userId,
      name: "Parcelle 1",
      surface: 100,
      status: "Libre",
      type_sol: "sableux",
      water_status: "Irrigué",
    });

    // 3. Créer des stocks par défaut (vide)
    const defaultStocks = [
      { name: "Engrais NPK", category: "engrais", quantity: 0, unit: "sac" },
      {
        name: "Semences Tomate",
        category: "semence",
        quantity: 0,
        unit: "sachet",
      },
      {
        name: "Neem (Biopesticide)",
        category: "traitement",
        quantity: 0,
        unit: "litre",
      },
    ];

    for (const stock of defaultStocks) {
      await supabaseAdmin.from("stocks").insert({
        user_id: userId,
        ...stock,
        alert_threshold: 5,
      });
    }

    // 4. Créer des tâches par défaut (guide débutant)
    const defaultTasks = [
      {
        title: "🌱 Créer ma première parcelle",
        category: "Plantation",
        priority: "Haute",
      },
      {
        title: "💧 Planifier l'irrigation",
        category: "Irrigation",
        priority: "Moyenne",
      },
      {
        title: "📊 Enregistrer ma première récolte",
        category: "Récolte",
        priority: "Basse",
      },
    ];

    for (const task of defaultTasks) {
      await supabaseAdmin.from("tasks").insert({
        user_id: userId,
        ...task,
        completed: false,
      });
    }

    console.log(`Données par défaut créées pour l'utilisateur ${userId}`);
    return true;
  } catch (error) {
    console.error("Erreur création données par défaut:", error);
    return false;
  }
}
```

---

## 🚀 DÉMARRAGE ET TESTS

### 1. Appliquer les migrations

```bash
npm run migrate:up
```

### 2. Tester l'inscription

```bash
# Démarrer le serveur
npm run dev

# Aller sur http://localhost:3000/pages/auth/signup.html
# Créer un compte test
```

### 3. Vérifier l'isolation des données

```sql
-- Dans Supabase SQL Editor
-- Vérifier que les nouvelles données ont bien user_id
SELECT id, name, user_id FROM parcelles;
SELECT id, name, user_id FROM harvests;
```

### 4. Tester la connexion

```bash
# Aller sur http://localhost:3000/pages/auth/login.html
# Se connecter avec le compte créé
# Vérifier que seul ses données sont visibles
```

---

## ⚠️ POINTS D'ATTENTION CRITIQUES

### 1. NE PAS TOUCHER à vos données admin

```sql
-- VÉRIFIEZ AVANT DE MODIFIER
SELECT id, email, role FROM users WHERE role IN ('admin', 'super_admin');

-- Ces utilisateurs DOIVENT rester intacts
```

### 2. Backup avant modifications

```bash
# Export de sécurité
pg_dump -U postgres kafarm > backup_before_multitenancy.sql
```

### 3. Tester sur environnement de développement d'abord

```bash
# Ne pas appliquer les migrations en production sans tests complets
```

### 4. Variables d'environnement

```env
# .env - À NE JAMAIS COMMIT
SUPABASE_SERVICE_ROLE_KEY=sk_xxxx  # SECRET
JWT_SECRET=super-secret-key        # SECRET
```

---

## 📋 CHECKLIST D'IMPLÉMENTATION

### Étape 1 : Nettoyage

- [ ] Identifier les comptes fictifs dans Supabase Auth
- [ ] Exécuter les requêtes SQL pour trouver les données liées
- [ ] Sauvegarder les données importantes
- [ ] Supprimer les comptes fictifs et leurs données
- [ ] Vérifier qu'il ne reste pas de code "seed"

### Étape 2 : Authentification

- [ ] Installer @supabase/supabase-js
- [ ] Configurer les variables d'environnement
- [ ] Créer js/modules/auth.js
- [ ] Créer pages/auth/signup.html
- [ ] Créer pages/auth/login.html
- [ ] Créer js/auth-client.js
- [ ] Tester l'inscription
- [ ] Tester la connexion/déconnexion

### Étape 3 : Multi-tenancy

- [ ] Vérifier que les colonnes user_id existent
- [ ] Créer db/policies_multi_tenant.sql
- [ ] Exécuter les policies RLS
- [ ] Tester l'isolation des données
- [ ] Vérifier que l'admin voit toujours tout
- [ ] Tester avec 2 comptes utilisateurs différents

### Étape 4 : Structure

- [ ] Organiser les routes /admin et /app
- [ ] Créer js/middleware/auth.js
- [ ] Intégrer le middleware dans server.js
- [ ] Protéger toutes les routes API

### Étape 5 : Onboarding

- [ ] Créer createDefaultFarmData()
- [ ] Tester la création automatique de données
- [ ] Vérifier le parcours utilisateur complet

### Tests finaux

- [ ] Créer un compte test
- [ ] Ajouter des données (harvests, parcelles)
- [ ] Se déconnecter
- [ ] Créer un 2ème compte
- [ ] Vérifier l'isolation (ne voit pas les données du 1er compte)
- [ ] Se connecter en admin
- [ ] Vérifier que l'admin voit toutes les données

---

## 🎯 RÉSULTAT ATTENDU

Après toutes ces étapes :

✅ N'importe qui peut s'inscrire et créer un compte
✅ Chaque utilisateur gère SA PROPRE ferme
✅ Isolation totale des données (RLS)
✅ Votre espace admin reste intact et fonctionnel
+3000 utilisateurs peuvent utiliser l'app simultanément sans se mélanger

**Prochaine étape :** Commencer par l'Étape 1 - Nettoyage des comptes fictifs.
