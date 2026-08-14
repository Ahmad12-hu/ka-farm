// KA Farm - Shared Core Application Layout Controller
import { KAStorage } from "./storage.js";
import { UserManager } from "./user-manager.js";
import { WolofAudio } from "./wolof-audio.js";
import { ErrorHandler } from "./modules/error-handler.js";
import { MarketPricesModule } from "./modules/market-prices.js";
import { FeedbackModule } from "./modules/feedback.js";
import { BackupModule } from "./modules/backup.js";

// Variables globales pour les autres scripts
window.KAStorage = KAStorage;
window.UserManager = UserManager;
window.WolofAudio = WolofAudio;
window.ErrorHandler = ErrorHandler;

// State
let currentUser = null;
let isDarkMode = true;

// Recommandations et préréglages météo prédéfinis pour le Sénégal
window.SENEGAL_WEATHER_PRESETS = {
  dakar: {
    name: "Dakar (Région de Dakar)",
    temp: 26,
    wind: 15,
    humidity: 82,
    sun: 8,
    condition: "Nuageux et brumeux",
    desc: "🌊 Climat maritime humide. Idéal pour cultures maraîchères côtières.",
    advice:
      "Humidité élevée sur la côte de Dakar. Limitez l'arrosage de fin de journée pour éviter le mildiou.",
    lat: 14.7167,
    lon: -17.4677,
    precipitation: 0.0,
  },
  diourbel: {
    name: "Diourbel (Bassin du Baol)",
    temp: 33,
    wind: 12,
    humidity: 58,
    sun: 10,
    condition: "Chaud et sec",
    desc: "🌾 Climat chaud et sec du Baol. Sols sableux exigeant un bon paillage.",
    advice: "Sols sableux. Appliquez un paillage organique épais pour retenir l'humidité.",
    lat: 14.65,
    lon: -16.2333,
    precipitation: 0.0,
  },
  fatick: {
    name: "Fatick (Sine-Saloum)",
    temp: 31,
    wind: 14,
    humidity: 72,
    sun: 9,
    condition: "Ensoleillé avec brise marine",
    desc: "🌊 Estuaires du Sine-Saloum. Vigilance sur la salinité des sols maraîchers.",
    advice: "Vigilance sur la salinité de l'eau (tannes). Idéal pour cultures tolérantes.",
    lat: 14.3333,
    lon: -16.4,
    precipitation: 0.0,
  },
  kaffrine: {
    name: "Kaffrine (Bassin Arachidier Est)",
    temp: 33,
    wind: 13,
    humidity: 60,
    sun: 10,
    condition: "Ensoleillé",
    desc: "☀️ Zone agricole ensoleillée. Vents desséchants d'Est (Harmattan léger).",
    advice: "Vents d'Est desséchants. Aménagez des brise-vents autour de vos planches.",
    lat: 14.1059,
    lon: -15.5508,
    precipitation: 0.0,
  },
  kaolack: {
    name: "Kaolack (Bassin Arachidier)",
    temp: 34,
    wind: 14,
    humidity: 55,
    sun: 10,
    condition: "Très chaud et ensoleillé",
    desc: "☀ Climat soudano-sahélien chaud. Sols secs nécessitant une gestion fine de l'arrosage.",
    advice: "Températures intenses. Priorisez l'arrosage avant 8h du matin et paillez les sols.",
    lat: 14.15,
    lon: -16.0833,
    precipitation: 0.0,
  },
  kedougou: {
    name: "Kédougou (Sud-Est)",
    temp: 32,
    wind: 9,
    humidity: 80,
    sun: 7,
    condition: "Orages isolés",
    desc: "⛰️ Climat soudanien humide. Forte pluviométrie, attention à l'engorgement des sols.",
    advice: "Précipitations d'hivernage importantes. Assurez des planches bien surélevées.",
    lat: 12.5578,
    lon: -12.1744,
    precipitation: 1.5,
  },
  kolda: {
    name: "Kolda (Haute Casamance)",
    temp: 32,
    wind: 10,
    humidity: 76,
    sun: 8,
    condition: "Chaud et humide",
    desc: "🌳 Zone forestière chaude et humide. Excellentes conditions de sol horticole.",
    advice: "Humidité propice au maraîchage. Surveillez les attaques fongiques sur le gombo.",
    lat: 12.8833,
    lon: -14.95,
    precipitation: 0.5,
  },
  louga: {
    name: "Louga (Zone Sylvo-Pastorale)",
    temp: 33,
    wind: 17,
    humidity: 50,
    sun: 10,
    condition: "Sec et poussiéreux",
    desc: "🏜️ Climat sahélien sec. Évaporations élevées, irrigation goutte-à-goutte prioritaire.",
    advice: "Climat sahélien strict. Favorisez l'irrigation au goutte-à-goutte sous ombrage.",
    lat: 15.6167,
    lon: -16.2167,
    precipitation: 0.0,
  },
  matam: {
    name: "Matam (Moyenne Vallée)",
    temp: 36,
    wind: 18,
    humidity: 45,
    sun: 11,
    condition: "Chaleur extrême",
    desc: "🔥 Chaleur extrême du Ferlo. Évapotranspiration critique de fin de journée.",
    advice: "Températures extrêmes. Arrosage biquotidien et paillage épais indispensables.",
    lat: 15.6553,
    lon: -13.2554,
    precipitation: 0.0,
  },
  "saint-louis": {
    name: "Saint-Louis (Delta du Fleuve)",
    temp: 29,
    wind: 22,
    humidity: 70,
    sun: 10,
    condition: "Ensoleillé et venteux",
    desc: "🌾 Alizés côtiers réguliers. Conditions optimales pour la culture maraîchère de contre-saison.",
    advice: "Vent sec présent (Harmattan léger). Surveillez l'évaporation des pépinières.",
    lat: 16.0167,
    lon: -16.5,
    precipitation: 0.0,
  },
  sedhiou: {
    name: "Sédhiou (Moyenne Casamance)",
    temp: 31,
    wind: 8,
    humidity: 82,
    sun: 8,
    condition: "Humide et orageux",
    desc: "🌱 Climat guinéen très favorable aux cultures diversifiées et vergers.",
    advice: "Climat très favorable. Traitez préventivement contre les champignons foliaires.",
    lat: 12.7081,
    lon: -15.5569,
    precipitation: 1.2,
  },
  tambacounda: {
    name: "Tambacounda (Sénégal Oriental)",
    temp: 35,
    wind: 11,
    humidity: 50,
    sun: 10,
    condition: "Ensoleillé et torride",
    desc: "☀️ Zone semi-aride continentale. Températures diurnes élevées exigeant un ombrage.",
    advice: "Chaleur intense. Utilisez de l'ombrage artificiel pour protéger les jeunes semis.",
    lat: 13.77,
    lon: -13.67,
    precipitation: 0.0,
  },
  thies: {
    name: "Thiès (Plateau / Mbour)",
    temp: 28,
    wind: 16,
    humidity: 75,
    sun: 9,
    condition: "Partiellement nuageux",
    desc: "🌅 Zone horticole majeure (Thiès & Petite Côte). Excellente rentabilité.",
    advice: "Climat idéal maraîcher. Excellente période pour repiquer les plants de piments.",
    lat: 14.7833,
    lon: -16.9167,
    precipitation: 0.0,
  },
  ziguinchor: {
    name: "Ziguinchor (Casamance horticole)",
    temp: 31,
    wind: 10,
    humidity: 78,
    sun: 8,
    condition: "Averses légères d'hivernage",
    desc: "🌴 Zone guinéenne humide. Évaporation modérée. Idéal pour l'arboriculture.",
    advice: "Hivernage précoce. Assurez un bon drainage des planches de piments.",
    lat: 12.5833,
    lon: -16.2667,
    precipitation: 2.0,
  },
};

window.WEATHER_RECOMMENDATIONS = {};
Object.entries(window.SENEGAL_WEATHER_PRESETS).forEach(([key, preset]) => {
  const displayKey =
    key === "saint-louis" ? "Saint-Louis" : key.charAt(0).toUpperCase() + key.slice(1);
  window.WEATHER_RECOMMENDATIONS[displayKey] = {
    city: preset.name,
    temp: `${preset.temp}°C`,
    humidity: `${preset.humidity}%`,
    precipitation: `${preset.precipitation.toFixed(1)} mm`,
    condition: preset.condition,
    advice: preset.advice,
    lat: preset.lat,
    lon: preset.lon,
  };
});

// Utilitaire d'animation numérique fluide à sortie cubique haute performance
window.animateValue = function (element, start, end, duration = 800) {
  if (!element) return;
  const startNum = Number(start) || 0;
  const endNum = Number(end) || 0;
  if (startNum === endNum) {
    if (
      element.id.includes("revenu") ||
      element.id.includes("depense") ||
      element.id.includes("solde") ||
      element.id.includes("cost") ||
      element.id.includes("profit")
    ) {
      element.textContent = endNum.toLocaleString("fr-FR") + " F";
    } else if (element.id.includes("percent")) {
      element.textContent = endNum + "%";
    } else {
      element.textContent = endNum.toLocaleString("fr-FR");
    }
    return;
  }

  let startTimestamp = null;
  const isCurrency =
    element.id.includes("revenu") ||
    element.id.includes("depense") ||
    element.id.includes("solde") ||
    element.id.includes("cost") ||
    element.id.includes("profit");
  const isPercent = element.id.includes("percent");

  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
    const value = Math.floor(easeProgress * (endNum - startNum) + startNum);

    if (isCurrency) {
      element.textContent = value.toLocaleString("fr-FR") + " F";
    } else if (isPercent) {
      element.textContent = value + "%";
    } else {
      element.textContent = value.toLocaleString("fr-FR");
    }

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      if (isCurrency) {
        element.textContent = endNum.toLocaleString("fr-FR") + " F";
      } else if (isPercent) {
        element.textContent = endNum + "%";
      } else {
        element.textContent = endNum.toLocaleString("fr-FR");
      }
    }
  };
  window.requestAnimationFrame(step);
};

export const App = {
  init() {
    console.info("[App] init started");
    // FORCER l'authentification en premier pour éviter une condition de concurrence avec router.js
    UserManager.requireAuth();
    currentUser = UserManager.getCurrentUser();

    // Enregistrer le Service Worker pour le mode hors ligne
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.error("SW registration failed:", err));
    }

    // Initialiser le stockage hors ligne
    if (window.offlineStorage) {
      window.offlineStorage.init();
    }

    // Initialiser le gestionnaire de synchronisation
    if (window.syncManager) {
      window.syncManager.init();
    }

    // S'assurer que le stockage est initialisé et que la synchronisation cloud par instantanés est active sur toutes les pages
    KAStorage.init();

    // Charger automatiquement les données de démonstration au premier lancement si aucune donnée n'existe
    const hasAnyData = () => {
      const keys = [
        "ka_farm_crops",
        "ka_farm_parcelles",
        "ka_farm_tasks",
        "ka_farm_finances",
        "ka_farm_employees",
        "ka_farm_cheptel",
        "ka_farm_seeds",
        "ka_farm_products",
      ];
      return keys.some((key) => localStorage.getItem(KAStorage.getScopedKey(key)));
    };

    if (!hasAnyData()) {
      import("/js/modules/demo-data.js")
        .then((m) => m.loadDemoData(KAStorage))
        .catch((e) => console.error("Demo data load failed", e));
    }

    // Détecter la préférence de thème du système (matchMedia)
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const systemPrefersDark = mediaQuery.matches;

    // Utiliser la préférence enregistrée si elle existe, sinon revenir à celle du système
    isDarkMode = KAStorage.get("ka_farm_dark_mode", systemPrefersDark);

    this.applyTheme(isDarkMode);

    // Changer automatiquement le thème lorsque les préférences du système évoluent
    const handleSystemThemeChange = (e) => {
      isDarkMode = e.matches;
      KAStorage.set("ka_farm_dark_mode", isDarkMode);
      this.applyTheme(isDarkMode);
    };

    try {
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    } catch (err) {
      // Solution de repli pour les navigateurs plus anciens ou les environnements sans interface
      mediaQuery.addListener(handleSystemThemeChange);
    }
    this.injectSidebar();
    this.injectMobileHeader();
    this.injectMobileBottomNav();
    this.injectFooter();
    this.setupGlobalListeners();
    this.updateBadges();

    // Initialiser MarketPricesModule si l'on se trouve sur la page market-prices
    if (window.location.pathname.includes("market-prices.html")) {
      MarketPricesModule.init();
    }

    // Initialiser FeedbackModule sur les pages partagées (hors authentification/admin)
    const pathname = window.location.pathname;
    console.log("Current pathname:", pathname);

    if (!pathname.includes("/pages/auth/") && !pathname.includes("/pages/admin/")) {
      console.log("Initializing FeedbackModule on shared page...");

      // Initialiser le module de retour utilisateur avec les identifiants Supabase depuis l'environnement Vite si disponibles
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || null;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || null;

      if (supabaseUrl && supabaseKey) {
        FeedbackModule.init(supabaseUrl, supabaseKey);
      } else {
        // Injecter quand même le bouton, mais il stockera localement
        FeedbackModule.init(null, null);
      }

      // Forcer l'injection du bouton directement s'il n'est pas présent après 3 secondes
      setTimeout(() => {
        console.log("Checking for feedback button...");
        if (!document.getElementById("feedback-fab")) {
          console.log("Feedback button NOT found, forcing injection...");
          FeedbackModule.injectFloatingButton();
        } else {
          console.log("Feedback button already exists");
        }
      }, 3000);
    } else {
      console.log("Skipping FeedbackModule on auth/admin page");
    }

    // Initialiser BackupModule sur toutes les pages
    BackupModule.init();
  },

  applyTheme(dark) {
    if (dark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }

    const circle = document.getElementById("dark-toggle-circle");
    const toggle = document.getElementById("dark-toggle-btn");
    if (circle && toggle) {
      if (dark) {
        toggle.classList.add("bg-emerald-600");
        toggle.classList.remove("bg-slate-300");
        circle.classList.add("translate-x-5");
      } else {
        toggle.classList.add("bg-slate-300");
        toggle.classList.remove("bg-emerald-600");
        circle.classList.remove("translate-x-5");
      }
    }

    const btnDesktop = document.getElementById("btn-theme-desktop");
    const btnMobile = document.getElementById("btn-theme-mobile");
    if (btnDesktop) {
      btnDesktop.innerHTML = `<i data-lucide="${dark ? "sun" : "moon"}" class="h-4 w-4"></i>`;
    }
    if (btnMobile) {
      btnMobile.innerHTML = `<i data-lucide="${dark ? "sun" : "moon"}" class="h-4.5 w-4.5"></i>`;
    }
    if (window.lucide) {
      window.lucide.createIcons();
    }

    if (typeof window.onThemeChanged === "function") {
      window.onThemeChanged(dark);
    }
  },

  toggleTheme() {
    isDarkMode = !isDarkMode;
    KAStorage.set("ka_farm_dark_mode", isDarkMode);

    // Activer la transition fluide temporaire pour le changement de thème
    document.documentElement.classList.add("theme-transition");

    // Animer les icônes du changement de thème (bureau + mobile)
    const btnDesktop = document.getElementById("btn-theme-desktop");
    const btnMobile = document.getElementById("btn-theme-mobile");

    if (btnDesktop) {
      const iconDesktop = btnDesktop.querySelector("[data-lucide]");
      if (iconDesktop) {
        iconDesktop.classList.remove("theme-icon-animate");
        void iconDesktop.offsetWidth;
        iconDesktop.classList.add("theme-icon-animate");
        setTimeout(() => iconDesktop.classList.remove("theme-icon-animate"), 450);
      }
    }

    if (btnMobile) {
      const iconMobile = btnMobile.querySelector("[data-lucide]");
      if (iconMobile) {
        iconMobile.classList.remove("theme-icon-animate");
        void iconMobile.offsetWidth;
        iconMobile.classList.add("theme-icon-animate");
        setTimeout(() => iconMobile.classList.remove("theme-icon-animate"), 450);
      }
    }

    this.applyTheme(isDarkMode);

    // Nettoyer après l'animation pour ne pas perturber les survols normaux
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 450);
  },

  injectSidebar() {
    const placeholder = document.getElementById("sidebar-placeholder");
    if (!placeholder) return;

    placeholder.className = "lg:w-64 lg:flex-shrink-0";

    const userInitials = currentUser
      ? currentUser.name
          .split(" ")
          .map((n) => n[0])
          .join("")
      : "KA";
    const userName = currentUser ? currentUser.name : "Utilisateur";
    const userRole = currentUser ? currentUser.role : "Visiteur";
    const enterpriseName =
      currentUser && currentUser.enterpriseName ? currentUser.enterpriseName : "KA Farm";
    const enterpriseCode =
      currentUser && currentUser.enterpriseCode ? currentUser.enterpriseCode : "KA-FARM";

    const sidebarHTML = `
      <aside id="sidebar" class="w-64 flex-shrink-0 bg-[#06130B] dark:bg-[#06130B] text-slate-300 flex flex-col border-r border-[#143E23] z-[60] lg:sticky lg:top-0 lg:h-screen transition-all duration-300 fixed inset-y-0 left-0 transform -translate-x-full lg:translate-x-0 lg:transform-none">
        
        <!-- En-tête de la barre latérale -->
        <div class="p-5 border-b border-[#143E23] flex items-center justify-between">
          <a href="/index.html" class="flex items-center gap-3 text-left hover:opacity-90 transition-opacity">
            <!-- Logo SVG haute fidélité personnalisé de KA Farm -->
            <div class="h-10 w-10 bg-white/5 p-1 rounded-xl border border-[#143E23]/30 flex items-center justify-center">
              <svg class="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- Contours du bouclier -->
                <path d="M50 12 C70 12, 82 15, 82 34 C82 52, 70 66, 50 75 C30 66, 18 52, 18 34 C18 15, 30 12, 50 12 Z" stroke="#10b981" stroke-width="2" stroke-linejoin="round" fill="none"/>
                <path d="M50 15 C67 15, 78 18, 78 34 C78 50, 67 63, 50 71 C33 63, 22 50, 22 34 C22 18, 33 15, 50 15 Z" stroke="#10b981" stroke-width="0.8" stroke-linejoin="round" fill="none"/>
                
                <!-- Contour de "KA" -->
                <path d="M29 29 V46 M29 37 L38 29 M32 39 L39 46" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M44 46 L49 29 L54 46 M46 41 H52" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>

                <!-- Icône de pousse -->
                <path d="M59 46 H71" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
                <path d="M65 46 V39" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
                <path d="M65 39 C61 39, 58 36, 58 33 C58 30, 61 29, 65 33 C65 33, 65 39, 65 39 Z" stroke="#10b981" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
                <path d="M65 37 C65 37, 72 37, 72 31 C72 28, 69 27, 65 33" stroke="#10b981" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
                
                <!-- Texte "FARM" -->
                <text x="50" y="61" fill="#059669" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="12.5" text-anchor="middle" letter-spacing="1">FARM</text>
              </svg>
            </div>
            <div>
              <h1 class="text-sm font-black tracking-widest text-white leading-tight">KA FARM</h1>
              <p class="text-[10px] text-[#819888] font-bold">Maraîchage & Élevage 🇸🇳</p>
            </div>
          </a>
          <div class="flex items-center gap-1.5">
            <!-- Bouton de changement de thème -->
            <button onclick="window.toggleAppTheme()" id="btn-theme-desktop" class="p-1.5 text-slate-400 hover:text-white hover:bg-[#0E2F19] rounded-lg transition-all cursor-pointer" title="Basculer le thème">
              <i data-lucide="${isDarkMode ? "sun" : "moon"}" class="h-4 w-4"></i>
            </button>
            <button onclick="window.toggleMobileSidebar()" class="lg:hidden p-1 text-slate-400 hover:text-white">
              <i data-lucide="x" class="h-5 w-5"></i>
            </button>
          </div>
        </div>

        <!-- Boutons de navigation -->
        <div class="flex-1 overflow-y-auto px-3 py-4 space-y-5 text-left">
          <div class="space-y-1">
            <a href="/index.html" data-tab="accueil" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="home" class="h-4 w-4"></i>
              Accueil
            </a>
          </div>

          <div class="space-y-1">
            <p class="px-3 text-[10px] font-black text-[#4F6D58] uppercase tracking-widest mb-1.5">Mon Espace Personnel</p>
            <a href="/pages/shared/dashboard.html" data-tab="dashboard" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="layout-dashboard" class="h-4 w-4"></i>
              Tableau de Bord
            </a>
            <a href="/pages/personal/my-tasks.html" data-tab="tasks" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <div class="flex items-center gap-3">
                <i data-lucide="check-square" class="h-4 w-4"></i>
                Tâches d'Entretien
              </div>
              <span id="tasks-badge" class="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded-full font-bold hidden">0</span>
            </a>
            <a href="/pages/personal/my-sales.html" data-tab="sales" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="coins" class="h-4 w-4"></i>
              Mes Ventes (Terrain)
            </a>
          </div>

          <div class="space-y-1">
            <p class="px-3 text-[10px] font-black text-[#4F6D58] uppercase tracking-widest mb-1.5">Données d'Exploitation</p>
            <a href="/pages/shared/crops.html" data-tab="crops" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <div class="flex items-center gap-3">
                <i data-lucide="folder-dot" class="h-4 w-4"></i>
                Suivi des Cultures
              </div>
              <span id="crops-badge" class="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">0</span>
            </a>
            <a href="/pages/shared/parcelles.html" data-tab="parcelles" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <div class="flex items-center gap-3">
                <i data-lucide="map" class="h-4 w-4"></i>
                Gestion des Parcelles
              </div>
              <span id="parcelles-badge" class="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">0</span>
            </a>
            <a href="/pages/shared/employees.html" data-tab="employees" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <div class="flex items-center gap-3">
                <i data-lucide="users" class="h-4 w-4"></i>
                Gestion des Employés
              </div>
              <span id="employees-badge" class="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">0</span>
            </a>
            <a href="/pages/shared/irrigation.html" data-tab="irrigation" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="droplet" class="h-4 w-4"></i>
              Planning d'Arrosage
            </a>
            <a href="/pages/shared/calendar.html" data-tab="calendar" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-emerald-300">
              <i data-lucide="calendar-days" class="h-4 w-4 text-emerald-400"></i>
              Calendrier Agricole
            </a>
            <a href="/pages/shared/harvest.html" data-tab="harvest" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="sprout" class="h-4 w-4"></i>
              Journal des Récoltes
            </a>
            <a href="/pages/shared/treatments.html" data-tab="treatments" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <div class="flex items-center gap-3">
                <i data-lucide="shield-alert" class="h-4 w-4"></i>
                Carnet Phytosanitaire
              </div>
              <span id="treatments-badge" class="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.2 rounded-full font-bold">0</span>
            </a>
            <a href="/pages/shared/finances.html" data-tab="finances" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="landmark" class="h-4 w-4"></i>
              Gestion des Finances
            </a>
            <a href="/pages/shared/profitability.html" data-tab="profitability" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <div class="flex items-center gap-3">
                <i data-lucide="calculator" class="h-4 w-4"></i>
                Rentabilité par Culture
              </div>
              <span id="profitability-badge" class="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded-full font-bold">0</span>
            </a>
            <a href="/pages/shared/stocks.html" data-tab="stocks" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <div class="flex items-center gap-3">
                <i data-lucide="package" class="h-4 w-4"></i>
                Inventaire & Stocks
              </div>
              <span id="stocks-badge" class="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">0</span>
            </a>
            <a href="/pages/shared/market-prices.html" data-tab="market-prices" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-orange-300">
              <i data-lucide="trending-up" class="h-4 w-4 text-orange-400"></i>
              Prix du Marché
            </a>
            <a href="/pages/shared/tools-sharing.html" data-tab="tools-sharing" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-cyan-300">
              <i data-lucide="wrench" class="h-4 w-4 text-cyan-400"></i>
              Bourse d'Outils
            </a>
            <a href="/pages/shared/elevage.html" data-tab="elevage" class="nav-btn w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-[#ffedd5]">
              <div class="flex items-center gap-3">
                <i data-lucide="paw-print" class="h-4 w-4 text-amber-400"></i>
                Suivi de l'Élevage
              </div>
              <span id="elevage-badge" class="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold">0</span>
            </a>
            <a href="/pages/shared/alerts.html" data-tab="alerts" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-rose-300">
              <i data-lucide="alert-triangle" class="h-4 w-4 text-rose-400"></i>
              Alertes Sanitaires
            </a>
            <a href="/pages/shared/training.html" data-tab="training" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-[#a5f3fc]">
              <i data-lucide="graduation-cap" class="h-4 w-4 text-cyan-400"></i>
              Guides de Formation
            </a>
          </div>

          <div class="space-y-1">
            <p class="px-3 text-[10px] font-black text-[#4F6D58] uppercase tracking-widest mb-1.5">Configuration</p>
            <a href="/pages/personal/profile.html" data-tab="profile" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="user" class="h-4 w-4"></i>
              Mon Profil & Réseaux
            </a>
            <a href="/pages/personal/settings.html" data-tab="settings" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="settings" class="h-4 w-4"></i>
              Paramètres
            </a>
            <a href="/pages/shared/about.html" data-tab="about" class="nav-btn w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i data-lucide="info" class="h-4 w-4"></i>
              À Propos
            </a>
            <button onclick="window.handleLogout()" class="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#0E2F19] hover:text-white cursor-pointer transition-all">
              <i data-lucide="log-out" class="h-4 w-4"></i>
              Déconnexion
            </button>
          </div>
        </div>

        <!-- Panneau utilisateur du pied de barre latérale -->
        <div class="p-4 border-t border-[#143E23] space-y-3 bg-[#051009]">
            <div class="px-1 text-left">
            <div class="flex items-center gap-2.5">
              <div id="user-avatar" class="h-8 w-8 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-xs border border-emerald-500/30 flex-shrink-0">${userInitials}</div>
              <div class="flex-1 min-w-0">
                <p id="user-name-display" class="text-xs font-black text-white truncate leading-none">${userName}</p>
                <p id="user-role-display" class="text-[9px] text-[#819888] font-bold mt-0.5 uppercase tracking-wider">${userRole}</p>
                <p class="text-[9px] text-emerald-400 font-medium truncate mt-0.5">${enterpriseName}</p>
              </div>
            </div>
          </div>

          
          <div class="flex items-center justify-between text-[11px] font-bold text-[#819888] px-1 pt-1 border-t border-[#143E23]/40">
            <span class="flex items-center gap-1"><i data-lucide="moon" class="h-3.5 w-3.5 text-emerald-500"></i> Sombre</span>
            <button onclick="window.toggleAppTheme()" id="dark-toggle-btn" class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 ease-in-out ${isDarkMode ? "bg-emerald-600" : "bg-slate-300"}">
              <span id="dark-toggle-circle" class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ease-in-out ${isDarkMode ? "translate-x-5" : ""}"></span>
            </button>
          </div>
        </div>
      </aside>
    `;

    placeholder.innerHTML = sidebarHTML;

    // Déclencher un événement pour signaler que la barre latérale a été chargée
    document.dispatchEvent(new Event("sidebarInjected"));
  },

  injectMobileHeader() {
    const placeholder = document.getElementById("mobile-header-placeholder");
    if (!placeholder) return;

    placeholder.innerHTML = `
      <div class="lg:hidden flex items-center justify-between px-4 py-3 bg-[#06130B] border-b border-[#143E23] text-white">
        <a href="/index.html" class="flex items-center gap-2.5">
          <!-- Logo SVG haute fidélité personnalisé de KA Farm -->
          <div class="h-9 w-9 bg-white/5 p-0.5 rounded-lg border border-[#143E23]/30 flex items-center justify-center">
            <svg class="w-full h-full" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <!-- Shield Outlines -->
              <path d="M50 12 C70 12, 82 15, 82 34 C82 52, 70 66, 50 75 C30 66, 18 52, 18 34 C18 15, 30 12, 50 12 Z" stroke="#10b981" stroke-width="2" stroke-linejoin="round" fill="none"/>
              <path d="M50 15 C67 15, 78 18, 78 34 C78 50, 67 63, 50 71 C33 63, 22 50, 22 34 C22 18, 33 15, 50 15 Z" stroke="#10b981" stroke-width="0.8" stroke-linejoin="round" fill="none"/>
              
              <!-- "KA" Outline -->
              <path d="M29 29 V46 M29 37 L38 29 M32 39 L39 46" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M44 46 L49 29 L54 46 M46 41 H52" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>

              <!-- Sprout Icon -->
              <path d="M59 46 H71" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
              <path d="M65 46 V39" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
              <path d="M65 39 C61 39, 58 36, 58 33 C58 30, 61 29, 65 33 C65 33, 65 39, 65 39 Z" stroke="#10b981" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
              <path d="M65 37 C65 37, 72 37, 72 31 C72 28, 69 27, 65 33" stroke="#10b981" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
              
              <!-- "FARM" Text -->
              <text x="50" y="61" fill="#059669" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="12.5" text-anchor="middle" letter-spacing="1">FARM</text>
            </svg>
          </div>
          <div>
            <span class="font-extrabold text-sm tracking-tight">KA FARM</span>
            <p class="text-[9px] text-emerald-400 leading-none font-bold">Sénégal • Maraîchage</p>
          </div>
        </a>
        <div class="flex items-center gap-2">
          <!-- Status profile pill -->
          <span class="inline-flex items-center gap-1 py-0.5 px-2 rounded-full bg-emerald-500/10 text-[9px] font-extrabold text-emerald-400 border border-emerald-500/20">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ${currentUser ? currentUser.name.split(" ")[0] : "Amadou"}
          </span>
          <!-- Bouton de changement de thème -->
          <button onclick="window.toggleAppTheme()" id="btn-theme-mobile" class="p-1.5 text-slate-300 hover:text-white hover:bg-[#0E2F19] rounded-lg transition-all cursor-pointer" title="Basculer le thème">
            <i data-lucide="${isDarkMode ? "sun" : "moon"}" class="h-4.5 w-4.5"></i>
          </button>
        </div>
      </div>
    `;
  },

  injectMobileBottomNav() {
    if (document.getElementById("mobile-bottom-nav")) return;

    const bottomNav = document.createElement("nav");
    bottomNav.id = "mobile-bottom-nav";
    bottomNav.className =
      "fixed bottom-0 left-0 right-0 h-16 bg-[#06130B]/95 dark:bg-[#06130B]/95 backdrop-blur-md border-t border-[#143E23] flex items-center justify-around px-2 z-50 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.45)]";

    bottomNav.innerHTML = `
      <a href="/pages/shared/dashboard.html" data-tab="dashboard" class="mobile-nav-btn flex flex-col items-center justify-center flex-1 py-1 text-slate-400 dark:text-[#819888] hover:text-emerald-400 dark:hover:text-emerald-400 transition-all duration-200">
        <i data-lucide="layout-dashboard" class="h-5 w-5"></i>
        <span class="text-[9px] font-black mt-1 tracking-tight">Tableau</span>
        <span class="mobile-nav-dot scale-0"></span>
      </a>
      <a href="/pages/shared/parcelles.html" data-tab="parcelles" class="mobile-nav-btn flex flex-col items-center justify-center flex-1 py-1 text-slate-400 dark:text-[#819888] hover:text-emerald-400 dark:hover:text-emerald-400 transition-all duration-200">
        <i data-lucide="map" class="h-5 w-5"></i>
        <span class="text-[9px] font-black mt-1 tracking-tight">Parcelles</span>
        <span class="mobile-nav-dot scale-0"></span>
      </a>
      <a href="/pages/shared/crops.html" data-tab="crops" class="mobile-nav-btn flex flex-col items-center justify-center flex-1 py-1 text-slate-400 dark:text-[#819888] hover:text-emerald-400 dark:hover:text-emerald-400 transition-all duration-200">
        <i data-lucide="sprout" class="h-5 w-5"></i>
        <span class="text-[9px] font-black mt-1 tracking-tight">Cultures</span>
        <span class="mobile-nav-dot scale-0"></span>
      </a>
      <a href="/pages/shared/elevage.html" data-tab="elevage" class="mobile-nav-btn flex flex-col items-center justify-center flex-1 py-1 text-slate-400 dark:text-[#819888] hover:text-emerald-400 dark:hover:text-emerald-400 transition-all duration-200">
        <i data-lucide="paw-print" class="h-5 w-5"></i>
        <span class="text-[9px] font-black mt-1 tracking-tight">Élevage</span>
        <span class="mobile-nav-dot scale-0"></span>
      </a>
      <button onclick="window.toggleMobileSidebar()" class="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 dark:text-[#819888] hover:text-emerald-400 dark:hover:text-emerald-400 cursor-pointer transition-all duration-200">
        <i data-lucide="menu" class="h-5 w-5"></i>
        <span class="text-[9px] font-black mt-1 tracking-tight">Menu</span>
        <span class="mobile-nav-dot scale-0 invisible"></span>
      </button>
    `;

    document.body.appendChild(bottomNav);

    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Déclencher l'événement sidebarInjected pour permettre au routeur de mettre en évidence les boutons de navigation inférieure
    setTimeout(() => {
      document.dispatchEvent(new Event("sidebarInjected"));
    }, 50);
  },

  injectFooter() {
    const mainEl = document.querySelector("main");
    if (mainEl && !document.getElementById("app-global-footer")) {
      const footer = document.createElement("footer");
      footer.id = "app-global-footer";
      footer.className =
        "mt-auto py-6 border-t border-slate-150 dark:border-[#143E23]/15 text-center text-[11px] text-slate-400 dark:text-[#5F8369] font-medium w-full";
      footer.innerHTML = `
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto px-6">
          <div class="flex items-center gap-1.5">
            <span>&copy; 2024 <span class="font-black text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">KA Farm</span>. Tous droits réservés</span>
          </div>
          <div class="flex items-center gap-2 bg-slate-50 dark:bg-[#051108] border border-slate-100 dark:border-[#143E23]/20 px-3 py-1.5 rounded-full text-[10px] text-slate-400 dark:text-[#5F8369]">
            <span class="relative flex h-1.5 w-1.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>Système Horticole &bull; Sénégal</span>
          </div>
        </div>
      `;
      mainEl.appendChild(footer);
    }
  },

  setupGlobalListeners() {
    window.toggleMobileSidebar = () => {
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        const isCurrentlyActive = sidebar.classList.contains("active");

        if (isCurrentlyActive) {
          // Fermer la barre latérale
          sidebar.classList.add("-translate-x-full");
          sidebar.classList.remove("active");

          // Supprimer l'arrière-plan de superposition s'il existe
          const backdrop = document.getElementById("sidebar-backdrop");
          if (backdrop) {
            backdrop.classList.remove("opacity-100");
            backdrop.classList.add("opacity-0");
            setTimeout(() => {
              backdrop.remove();
            }, 300);
          }
        } else {
          // Ouvrir la barre latérale
          sidebar.classList.remove("-translate-x-full");
          sidebar.classList.add("active");

          // Créer et insérer l'arrière-plan de superposition
          let backdrop = document.getElementById("sidebar-backdrop");
          if (!backdrop) {
            backdrop = document.createElement("div");
            backdrop.id = "sidebar-backdrop";
            backdrop.className =
              "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden transition-opacity duration-300 opacity-0";
            backdrop.onclick = window.toggleMobileSidebar;
            document.body.appendChild(backdrop);
            // Trigger transition
            setTimeout(() => {
              backdrop.classList.remove("opacity-0");
              backdrop.classList.add("opacity-100");
            }, 10);
          }
        }
      }
    };

    window.toggleAppTheme = () => {
      this.toggleTheme();
    };

    window.handleLogout = () => {
      if (confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
        KAStorage.setCurrentUser(null);
        window.location.href = "/pages/auth/login.html";
      }
    };

    // Charger automatiquement les icônes Lucide
    if (window.lucide) {
      window.lucide.createIcons();
    }

    document.addEventListener("sidebarInjected", () => {
      if (window.lucide) {
        window.lucide.createIcons();
      }
    });

    // Micro-interaction globale : effet de rebond et d'agrandissement lorsqu'une icône ou un bouton icône est cliqué
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!target) return;

      let icon = null;
      // 1. If we clicked the icon itself (or SVG)
      if (
        target.hasAttribute("data-lucide") ||
        target.tagName === "SVG" ||
        target.closest("[data-lucide]")
      ) {
        icon =
          target.hasAttribute("data-lucide") || target.tagName === "SVG"
            ? target
            : target.closest("[data-lucide]");
      } else {
        // 2. Si nous avons cliqué sur un bouton, un lien ou un onglet actif personnalisé contenant une icône
        const parentBtn = target.closest('button, a, .nav-btn, [role="button"], .tab-btn');
        if (parentBtn) {
          icon = parentBtn.querySelector("[data-lucide], svg");
        }
      }

      if (icon) {
        // Déclencher l'animation de rebond en douceur
        icon.classList.remove("animate-icon-pop");
        // Forcer le reflow / repaint pour redémarrer l'animation CSS
        void icon.offsetWidth;
        icon.classList.add("animate-icon-pop");

        // Retirer la classe une fois l'animation terminée (320 ms correspondent aux keyframes CSS)
        setTimeout(() => {
          icon.classList.remove("animate-icon-pop");
        }, 350);
      }
    });
  },

  updateBadges() {
    // Mettre à jour le compteur du badge des cultures
    const crops = KAStorage.getCrops();
    const cropsBadge = document.getElementById("crops-badge");
    if (cropsBadge) {
      cropsBadge.textContent = crops.length;
    }

    // Mettre à jour le compteur du badge des parcelles
    const parcelles = KAStorage.getParcelles();
    const parcellesBadge = document.getElementById("parcelles-badge");
    if (parcellesBadge) {
      parcellesBadge.textContent = parcelles.length;
    }

    // Mettre à jour le compteur du badge des employés
    const employees = KAStorage.getEmployees ? KAStorage.getEmployees() : [];
    const employeesBadge = document.getElementById("employees-badge");
    if (employeesBadge) {
      employeesBadge.textContent = employees.length;
    }

    // Mettre à jour le compteur des tâches incomplètes
    const tasks = KAStorage.getTasks();
    const pendingTasks = tasks.filter((t) => !t.completed).length;
    const tasksBadge = document.getElementById("tasks-badge");
    if (tasksBadge) {
      if (pendingTasks > 0) {
        tasksBadge.textContent = pendingTasks;
        tasksBadge.classList.remove("hidden");
      } else {
        tasksBadge.classList.add("hidden");
      }
    }

    // Mettre à jour le badge des stocks en affichant le nombre d'articles en faible quantité
    const stocks = KAStorage.getStocks();
    const lowStocksCount = stocks.filter((s) => s.quantity <= s.maxQuantity * 0.2).length;
    const stocksBadge = document.getElementById("stocks-badge");
    if (stocksBadge) {
      if (lowStocksCount > 0) {
        stocksBadge.textContent = `${lowStocksCount} Bas`;
        stocksBadge.className =
          "text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.2 rounded-full font-bold";
      } else {
        stocksBadge.textContent = stocks.length;
        stocksBadge.className =
          "text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold";
      }
    }

    // Mettre à jour le badge d'élevage en affichant les alertes actives ou le total
    const cheptel = KAStorage.getCheptel ? KAStorage.getCheptel() : [];
    const alertAnimalsCount = cheptel.filter(
      (c) => c.status === "Surveiller" || c.status === "Malade" || c.status === "Alerte"
    ).length;
    const elevageBadge = document.getElementById("elevage-badge");
    if (elevageBadge) {
      if (alertAnimalsCount > 0) {
        elevageBadge.textContent = `${alertAnimalsCount} Alerte`;
        elevageBadge.className =
          "text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded-full font-bold";
      } else {
        elevageBadge.textContent = cheptel.length;
        elevageBadge.className =
          "text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded-full font-bold";
      }
    }
  },
};

// Démarrer le framework de l'application
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    App.init();
  });
} else {
  App.init();
}
