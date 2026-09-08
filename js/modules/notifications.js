// KA Farm - Sanitary Alerts & Gemini AI Advisor Module
import { KAStorage } from "../storage.js";
import { logger } from "./logger.js";
import { ErrorHandler } from "./error-handler.js";
import { AIService } from "./ai-service.js";

let chatHistory = [];
let currentAgent = "advisor";
let currentLanguage = "fr";

export const NotificationsModule = {
  init() {
    this.renderAlerts();
    this.renderAdvisorChat();
    this.setupListeners();
    this.loadAgents();
  },

  async loadAgents() {
    try {
      const res = await fetch("/api/ai/agents");
      if (res.ok) {
        const agents = await res.json();
        const select = document.getElementById("advisor-agent-select");
        if (select && agents.length) {
          select.innerHTML = agents
            .map(
              (a) =>
                `<option value="${a.id}">${a.name} - ${a.description}</option>`
            )
            .join("");
          select.value = currentAgent;
        }
      }
    } catch (err) {
      logger.warn("Notifications: Failed to load AI agents", { error: err.message });
    }
  },

  renderAlerts() {
    const container = document.getElementById("alerts-container");
    if (!container) return;

    const crops = KAStorage.getCrops();
    const alerts = [];

    // Extract all sanitary alerts from crop photos
    crops.forEach((crop) => {
      const photos = crop.photos || [];
      photos.forEach((photo) => {
        if (photo.status === "Surveiller" || photo.status === "Alerte") {
          alerts.push({
            cropName: crop.name,
            cropField: crop.field,
            cropId: crop.id,
            ...photo,
          });
        }
      });
    });

    if (alerts.length === 0) {
      container.innerHTML = `
        <div class="p-6 bg-[#0B2112]/40 border border-[#143E23]/25 rounded-3xl text-center space-y-4 animate-fadeIn">
          <div class="inline-flex h-16 w-16 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-2xl items-center justify-center text-3xl shadow-lg shadow-emerald-500/5">
            🛡️
          </div>
          <div class="space-y-1">
            <h4 class="text-sm font-black text-white">Aucune anomalie active détectée</h4>
            <p class="text-xs text-[#819888] font-semibold max-w-sm mx-auto">Toutes les planches de l'exploitation KA Farm sont saines et sous contrôle rigoureux.</p>
          </div>
          
          <div class="grid grid-cols-2 gap-3 pt-3 text-left">
            <div class="p-3 bg-[#051009]/50 border border-[#143E23]/30 rounded-2xl">
              <span class="text-[8px] font-black text-[#4F6D58] uppercase tracking-widest">Pépinières</span>
              <p class="text-xs font-black text-emerald-400 mt-1 flex items-center gap-1">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Conforme
              </p>
            </div>
            <div class="p-3 bg-[#051009]/50 border border-[#143E23]/30 rounded-2xl">
              <span class="text-[8px] font-black text-[#4F6D58] uppercase tracking-widest">Ravageurs</span>
              <p class="text-xs font-black text-emerald-400 mt-1 flex items-center gap-1">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Pression nulle
              </p>
            </div>
            <div class="p-3 bg-[#051009]/50 border border-[#143E23]/30 rounded-2xl col-span-2">
              <span class="text-[8px] font-black text-[#4F6D58] uppercase tracking-widest">Dernière inspection terrain</span>
              <p class="text-[11px] font-bold text-slate-300 mt-1 flex items-center justify-between">
                <span>Aujourd'hui, 08:15</span>
                <span class="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-black">Validée</span>
              </p>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Sort by date (most recent first)
    alerts.sort((a, b) => b.id.localeCompare(a.id));

    container.innerHTML = alerts
      .map((alert) => {
        const isRed = alert.status === "Alerte";
        const badgeColor = isRed
          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
          : "bg-amber-500/10 text-amber-500 border-amber-500/20";
        const statusLabel = isRed ? "Grave / Alerte" : "À Surveiller";
        const icon = isRed ? "shield-x" : "alert-circle";

        return `
        <div class="p-5 bg-[#0B2112]/40 border border-[#143E23]/30 rounded-3xl flex flex-col sm:flex-row gap-4 text-left shadow-xl hover:border-emerald-500/20 transition-all duration-300 hover:scale-[1.01] animate-fadeIn">
          <!-- Alert Photo with hover lens icon effect -->
          <div class="relative group w-24 h-24 flex-shrink-0 mx-auto sm:mx-0">
            <img src="${alert.imageUrl}" alt="Alerte" class="w-full h-full object-cover rounded-2xl border border-[#143E23]/60 cursor-pointer transition-transform group-hover:scale-105 duration-300" onclick="window.viewFullSizePhoto('${alert.imageUrl}')">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity flex items-center justify-center pointer-events-none">
              <i data-lucide="zoom-in" class="h-5 w-5 text-white"></i>
            </div>
          </div>

          <div class="flex-grow space-y-2 min-w-0">
            <div class="flex justify-between items-start gap-2 flex-wrap">
              <div>
                <h4 class="text-sm font-black text-white flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full ${isRed ? "bg-rose-500" : "bg-amber-500"} animate-pulse"></span>
                  ${alert.cropName}
                </h4>
                <p class="text-[10px] text-[#819888] font-bold uppercase tracking-wider">${alert.cropField}</p>
              </div>
              <span class="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeColor} flex items-center gap-1">
                <i data-lucide="${icon}" class="h-3 w-3"></i> ${statusLabel}
              </span>
            </div>

            <div class="bg-[#051009]/40 p-3 rounded-xl border border-[#143E23]/25">
              <p class="text-xs text-slate-300 font-semibold leading-relaxed whitespace-pre-line">${alert.notes}</p>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1 flex-wrap">
              <span class="text-[9px] text-[#4F6D58] font-black uppercase tracking-wider">Signalé le ${alert.date}</span>
              <button onclick="window.askAdvisorAbout('${alert.cropName}', '${alert.notes}')" class="px-3.5 py-2 bg-purple-600/15 hover:bg-purple-600/30 border border-purple-500/30 text-purple-350 hover:text-white font-extrabold text-[10px] rounded-xl cursor-pointer transition-all flex items-center gap-1.5">
                <i data-lucide="sparkles" class="h-3.5 w-3.5 text-purple-450"></i> Demander conseil à l'IA Advisor
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  renderAdvisorChat() {
    const container = document.getElementById("advisor-chat-container");
    if (!container) return;

    if (chatHistory.length === 0) {
      container.innerHTML = `
        <div class="h-full flex flex-col justify-center text-left p-6 md:p-8 space-y-6 animate-fadeIn">
          <div class="space-y-3">
            <div class="h-11 w-11 bg-purple-500/10 border border-purple-500/25 text-purple-400 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/5">
              <i data-lucide="sparkles" class="h-5 w-5"></i>
            </div>
            
            <h1 class="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight max-w-md">
              Bonjour, de quoi votre exploitation a-t-elle besoin aujourd'hui ?
            </h1>
            <p class="text-[11px] text-[#819888] font-bold max-w-sm leading-relaxed">
              Je suis KA-Advisor, votre IA d'expertise horticole et d'agriculture écologique au Sénégal. Posez-moi une question ou demandez-moi un traitement biologique pour soigner vos cultures.
            </p>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div onclick="window.askPreset('Fiche complète sur la Mineuse de la tomate (Tuta Absoluta)')" class="p-4 bg-[#0B2112]/50 hover:bg-[#0B2112]/85 border border-[#143E23]/45 rounded-2xl cursor-pointer hover:border-purple-500/50 transition-all space-y-1 group">
              <div class="flex items-center gap-2">
                <span class="text-xs">🐛</span>
                <h5 class="text-xs font-black text-white group-hover:text-purple-300 transition-colors">Tuta Absoluta</h5>
              </div>
              <p class="text-[10px] text-slate-400 leading-relaxed font-semibold">Comment diagnostiquer et éradiquer biologiquement la mineuse de la tomate au Sénégal.</p>
            </div>

            <div onclick="window.askPreset('Comment préparer facilement du purin de neem à la ferme ?')" class="p-4 bg-[#0B2112]/50 hover:bg-[#0B2112]/85 border border-[#143E23]/45 rounded-2xl cursor-pointer hover:border-purple-500/50 transition-all space-y-1 group">
              <div class="flex items-center gap-2">
                <span class="text-xs">🌱</span>
                <h5 class="text-xs font-black text-white group-hover:text-purple-300 transition-colors">Purin de Neem</h5>
              </div>
              <p class="text-[10px] text-slate-400 leading-relaxed font-semibold">Recette traditionnelle, dosage de traitement et étapes d'application faciles.</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = chatHistory
      .map((m) => {
        const isUser = m.role === "user";
        const bg = isUser
          ? "bg-emerald-600 border border-emerald-500 text-white rounded-br-none ml-12"
          : "bg-[#0B2112] border border-[#143E23]/40 text-slate-100 rounded-bl-none mr-12 shadow-md";
        const align = isUser ? "justify-end" : "justify-start";
        const label = isUser ? "Vous" : "KA-Advisor (IA)";
        const labelColor = isUser ? "text-emerald-300" : "text-purple-300";
        const icon = isUser ? "user" : "bot";

        return `
        <div class="flex ${align} text-left animate-fadeIn">
          <div class="p-4 rounded-2xl ${bg} max-w-[85%] space-y-2">
            <div class="flex items-center gap-1.5 pb-1 border-b border-[#143E23]/15">
              <i data-lucide="${icon}" class="h-3 w-3 ${labelColor}"></i>
              <span class="text-[9px] font-black uppercase tracking-wider ${labelColor}">${label}</span>
            </div>
            <p class="text-xs font-semibold leading-relaxed whitespace-pre-line">${m.text}</p>
          </div>
        </div>
      `;
      })
      .join("");

    // Scroll chat to bottom
    container.scrollTop = container.scrollHeight;

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  async sendToAdvisor(prompt) {
    if (!prompt.trim()) return;

    chatHistory.push({ role: "user", text: prompt });
    this.renderAdvisorChat();

    // Show AI loading indicator
    const chatContainer = document.getElementById("advisor-chat-container");
    const loadingId = `load-${Date.now()}`;
    if (chatContainer) {
      const loader = document.createElement("div");
      loader.id = loadingId;
      loader.className = "flex justify-start text-left";
      loader.innerHTML = `
        <div class="p-3 bg-slate-50 dark:bg-[#061109]/70 border border-slate-100 dark:border-emerald-950/20 text-slate-500 rounded-2xl rounded-tl-none mr-12 flex items-center gap-2">
          <span class="text-[9px] font-black uppercase tracking-wider text-purple-400">🤖 Conseiller</span>
          <p class="text-xs font-bold italic flex items-center gap-1 animate-pulse">
            Analyse et rédaction du diagnostic en cours...
          </p>
        </div>
      `;
      chatContainer.appendChild(loader);
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    try {
      // Utiliser le service IA centralisé avec l'agent sélectionné
      const result = await AIService.ask({
        prompt,
        agentType: currentAgent,
        history: chatHistory.slice(0, -1),
        language: currentLanguage,
      });

      // Remove loading indicator
      const loaderEl = document.getElementById(loadingId);
      if (loaderEl) loaderEl.remove();

      chatHistory.push({ role: "advisor", text: result.text });
    } catch (err) {
      logger.error("Notifications: Error sending to advisor", { error: err.message });
      const loaderEl = document.getElementById(loadingId);
      if (loaderEl) loaderEl.remove();

      chatHistory.push({
        role: "advisor",
        text: `⚠️ Désolé, une erreur technique est survenue lors de la communication avec l'IA : ${err.message || "Serveur indisponible"}.`,
      });
    }

    this.renderAdvisorChat();
  },

  setupListeners() {
    const form = document.getElementById("advisor-chat-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = document.getElementById("advisor-chat-input");
        if (!input) return;

        const val = input.value;
        input.value = "";
        this.sendToAdvisor(val);
      });
    }

    // Agent selector - change AI specialist
    const agentSelect = document.getElementById("advisor-agent-select");
    if (agentSelect) {
      agentSelect.addEventListener("change", (e) => {
        currentAgent = e.target.value;
        // If Wolof selected, switch language
        currentLanguage = currentAgent === "wolofAdvisor" ? "wo" : "fr";
        logger.info("AI Agent changed", { agent: currentAgent, language: currentLanguage });
      });
    }

    // Preset questions helper
    window.askPreset = (text) => {
      this.sendToAdvisor(text);
    };

    // Clear chat history
    window.clearChatHistory = () => {
      chatHistory = [];
      this.renderAdvisorChat();
    };

    // Full screen image modal zoom
    window.viewFullSizePhoto = (url) => {
      const modal = document.getElementById("photo-modal");
      const img = document.getElementById("modal-image");
      if (modal && img) {
        img.src = url;
        modal.classList.remove("hidden");
      }
    };

    window.closePhotoModal = () => {
      const modal = document.getElementById("photo-modal");
      if (modal) {
        modal.classList.add("hidden");
      }
    };

    // Interactive button helper
    window.askAdvisorAbout = (cropName, diagnosticNotes) => {
      // Direct question payload
      const query = `Bonjour KA-Advisor, que me conseilles-tu d'utiliser pour soigner ma planche de ${cropName} ? Le diagnostic indique : "${diagnosticNotes}". Quels biopesticides locaux ou remèdes écologiques sénégalais comme le neem me conseilles-tu ?`;
      this.sendToAdvisor(query);

      // Focus/Scroll into view of chat form input
      const chatInput = document.getElementById("advisor-chat-input");
      if (chatInput) {
        chatInput.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };

    // Simulate real alert demo
    window.simulateDemoAlert = () => {
      const crops = KAStorage.getCrops();
      if (crops.length === 0) {
        ErrorHandler.showToast(
          "Aucune culture n'est actuellement configurée dans votre base.",
          "error"
        );
        return;
      }

      // Find Tomate or first crop
      const targetCrop = crops.find((c) => c.name.toLowerCase().includes("tomate")) || crops[0];
      if (!targetCrop.photos) {
        targetCrop.photos = [];
      }

      // Check if demo already simulated
      if (targetCrop.photos.some((p) => p.id === "demo-alert-1")) {
        ErrorHandler.showToast(
          "L'alerte de démonstration est déjà active ! Regardez le panneau de gauche.",
          "error"
        );
        return;
      }

      const demoAlert = {
        id: "demo-alert-1",
        imageUrl:
          "https://images.unsplash.com/photo-1592417817098-8f3d6eb19675?auto=format&fit=crop&w=600&q=80",
        status: "Alerte",
        date: new Date().toLocaleDateString("fr-FR"),
        notes:
          "Anomalie identifiée : Feuilles flétries avec galeries foliaires argentées creusées par des larves. Forte suspicion de Mineuse de la Tomate (Tuta Absoluta) sur la planche.",
      };

      targetCrop.photos.unshift(demoAlert);
      KAStorage.saveCrops(crops);

      // Re-render alerts
      this.renderAlerts();

      // Scroll to top of alerts
      const alertsContainer = document.getElementById("alerts-container");
      if (alertsContainer) {
        alertsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
  },
};

// Start notifications module
document.addEventListener("DOMContentLoaded", () => {
  NotificationsModule.init();
});
