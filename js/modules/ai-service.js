/**
 * KA-Farm AI Service Centralisé
 * Support multi-modèles (Gemini, OpenAI, Claude), streaming, agents spécialisés, Wolof, RAG
 */
import { logger } from "./logger.js";
import { ErrorHandler } from "./error-handler.js";
import { KAStorage } from "../storage.js";

// ====================================================================
// CONFIGURATION
// ====================================================================
const AI_CONFIG = {
  // Ordre de fallback des providers
  providers: ["gemini", "openai", "claude"],
  // Modèles Gemini
  gemini: {
    flash: "gemini-3.6-flash",
    flashLite: "gemini-3.5-flash-lite",
    pro: "gemini-3.6-flash",
  },
  // Modèles OpenAI (fallback)
  openai: {
    fast: "gpt-4o-mini",
    pro: "gpt-4o",
  },
  // Modèle Claude (fallback)
  claude: {
    fast: "claude-3-5-haiku-latest",
    pro: "claude-3-5-sonnet-latest",
  },
  cacheTTL: 5 * 60 * 1000, // 5 minutes
};

// Cache des réponses pour le mode offline
let responseCache = {};

// ====================================================================
// PROMPTS SPÉCIALISÉS - Agents IA
// ====================================================================
const SYSTEM_PROMPTS = {
  // Agent Horticole principal (existant amélioré)
  advisor: `Tu es KA-Farm Agro-Advisor, un conseiller horticole et maraîcher expert d'Afrique de l'Ouest (Sénégal). 
Réponds en français. Sois chaleureux, pragmatique, direct et scientifique.
Spécialisé dans : maraîchage (légumes, fines herbes, fruits), pépinières, irrigation, maladies horticoles, biopesticides locaux (neem, piment).
Donne des réponses concises, structurées et adaptées aux conditions sahéliennes.`,

  // Agent Diagnostic Plantes (existant amélioré)
  plantDoctor: `Tu es KA-Farm Doctor Plante, expert phytosanitaire horticole spécialisé dans le diagnostic visuel.
Analyse les photos de cultures et fournis un diagnostic structuré en français :
1) Maladie/carence probable
2) Niveau de gravité (Faible/Moyen/Élevé/Critique)
3) Traitement recommandé (bio ou chimique, dosage, fréquence)
4) Prévention
Sois direct, scientifique et adapté au Sénégal.`,

  // Agent Élevage (NOUVEAU)
  livestock: `Tu es KA-Farm Conseiller Élevage, expert en production animale en Afrique de l'Ouest.
Spécialisé dans : bovins, ovins, caprins, volailles au Sénégal.
Conseils sur : alimentation, santé animale, reproduction, logement, prophylaxie.
Réponds en français avec des solutions locales et abordables.`,

  // Agent Finances (NOUVEAU)
  finance: `Tu es KA-Farm Analyste Financier Agricole, expert en gestion financière des exploitations agricoles.
Aide à : analyser la rentabilité des cultures, optimiser les dépenses, prévoir les revenus,
conseiller sur les prix du marché (marchés sénégalais), suggestions de diversification.
Réponds en français avec des chiffres concrets adaptés au contexte sénégalais.`,
  
  // Agent Irrigation/Météo (NOUVEAU)
  irrigation: `Tu es KA-Farm Expert Irrigation & Météo, spécialisé en gestion de l'eau pour l'agriculture sahélienne.
Conseils sur : irrigation goutte-à-goutte, aspersion, calendrier d'arrosage selon les saisons,
gestion de la sécheresse, optimisation de l'eau, drainage.
Réponds en français avec des solutions adaptées au climat sénégalais.`,

  // Agent Compost/Sol (NOUVEAU)
  soil: `Tu es KA-Farm Expert Sol & Compost, spécialisé en agroécologie etfertilité des sols au Sénégal.
Conseils sur : fabrication de compost, fumier, amendements organiques, rotation des cultures,
analyse du sol (sableux, limoneux, argileux), couverture végétale.
Réponds en français avec des techniques locales et écologiques.`,

  // Agent Assistant Personnel (NOUVEAU)
  personal: `Tu es KA-Farm Assistant Personnel Agricole. Tu aides l'agriculteur à organiser son travail quotidien :
planification des tâches, rappels, suivi des cultures, gestion du temps.
Sois amical, motivateur et pratique. Réponds en français.`,

  // Agent Wolof (NOUVEAU)
  wolofAdvisor: `Ña ng ci KA-Farm Agro-Advisor, jàngoro bu am solo ci mbey mi ci Sénégal.
Maa ngiy faj ay jàngoro yu mel ni: mbey, garab, àndi ndox, ay jàkka, ay garab yu bon.
Maa ngiy wax ci Wolof ak Français. Na nga may ay mbir yu am solo ci sa mbey mi.`,
};

// ====================================================================
// CACHE & RAG CONTEXT
// ====================================================================
function getFarmContext(agentType) {
  try {
    const context = {};
    
    if (["advisor", "plantDoctor", "finance"].includes(agentType)) {
      context.crops = KAStorage.getCrops?.()?.slice(0, 5) || [];
    }
    if (["livestock"].includes(agentType)) {
      context.cheptel = KAStorage.getCheptel?.() || [];
      context.elevageProduction = KAStorage.getElevageProduction?.()?.slice(0, 10) || [];
    }
    if (["finance"].includes(agentType)) {
      context.finances = KAStorage.getFinances?.()?.slice(0, 10) || [];
    }
    if (["irrigation"].includes(agentType)) {
      context.parcelles = KAStorage.getParcelles?.() || [];
    }
    
    return context;
  } catch (e) {
    return {};
  }
}

function buildRAGPrompt(agentType, userPrompt) {
  const context = getFarmContext(agentType);
  let contextStr = "\n\n--- CONTEXTE DE VOTRE EXPLOITATION ---\n";
  
  if (context.crops?.length) {
    contextStr += `\n📊 Cultures actuelles :\n${context.crops.map(c => `- ${c.name} (${c.field || '?'}) - ${c.status || '?'}`).join('\n')}\n`;
  }
  if (context.cheptel?.length) {
    contextStr += `\n🐄 Cheptel :\n${context.cheptel.map(c => `- ${c.name}: ${c.quantity} ${c.unit || 'têtes'} (${c.status || '?'})`).join('\n')}\n`;
  }
  if (context.finances?.length) {
    const totalRevenus = context.finances.filter(f => f.type === 'Revenu').reduce((a, b) => a + (b.amount || 0), 0);
    const totalDepenses = context.finances.filter(f => f.type === 'Dépense').reduce((a, b) => a + (b.amount || 0), 0);
    contextStr += `\n💰 Finances récentes : Revenus: ${totalRevenus}F | Dépenses: ${totalDepenses}F\n`;
  }
  if (context.parcelles?.length) {
    contextStr += `\n🌾 Parcelles :\n${context.parcelles.map(p => `- ${p.name} (${p.surface}m², ${p.type_sol || '?'})`).join('\n')}\n`;
  }
  
  return `${userPrompt}${contextStr}`;
}

// ====================================================================
// PROVIDERS MULTI-MODÈLES
// ====================================================================
async function callGemini(prompt, systemPrompt, history, image, streaming = false) {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemPrompt,
      history,
      image,
      model: AI_CONFIG.gemini.pro,
      streaming,
      agentType: "direct",
    }),
  });
  return response;
}

async function callOpenAI(prompt, systemPrompt, history, image) {
  const response = await fetch("/api/ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemPrompt,
      history,
      image,
      model: AI_CONFIG.openai.fast,
    }),
  });
  return response;
}

async function callClaude(prompt, systemPrompt, history, image) {
  const response = await fetch("/api/ai/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      systemPrompt,
      history,
      image,
      model: AI_CONFIG.claude.fast,
    }),
  });
  return response;
}

// ====================================================================
// SERVICE PRINCIPAL
// ====================================================================
export const AIService = {
  /**
   * Envoyer une requête à l'IA avec fallback multi-modèle
   */
  async ask({ prompt, agentType = "advisor", history = [], image = null, language = "fr", streaming = false }) {
    const systemPrompt = language === "wo" ? SYSTEM_PROMPTS.wolofAdvisor : (SYSTEM_PROMPTS[agentType] || SYSTEM_PROMPTS.advisor);
    const enhancedPrompt = buildRAGPrompt(agentType, prompt);
    
    // Vérifier le cache
    const cacheKey = `${agentType}:${language}:${prompt.slice(0, 100)}`;
    const cached = responseCache[cacheKey];
    if (cached && Date.now() - cached.ts < AI_CONFIG.cacheTTL) {
      logger.info("AI: Using cached response", { agentType });
      return { text: cached.text, cached: true };
    }
    
    let lastError = null;
    
    for (const provider of AI_CONFIG.providers) {
      try {
        let response;
        
        switch (provider) {
          case "gemini":
            response = await callGemini(enhancedPrompt, systemPrompt, history, image, streaming);
            break;
          case "openai":
            response = await callOpenAI(enhancedPrompt, systemPrompt, history, image);
            break;
          case "claude":
            response = await callClaude(enhancedPrompt, systemPrompt, history, image);
            break;
        }
        
        if (response && response.ok) {
          const data = await response.json();
          if (data.text) {
            // Mettre en cache
            responseCache[cacheKey] = { text: data.text, ts: Date.now() };
            return { text: data.text, provider };
          }
        } else if (response) {
          const errData = await response.json().catch(() => ({}));
          lastError = new Error(errData.error || `${provider} failed`);
          logger.warn(`AI: ${provider} fallback`, { error: lastError.message });
        }
      } catch (err) {
        lastError = err;
        logger.warn(`AI: ${provider} error, trying next provider`, { error: err.message });
      }
    }
    
    // Si tout a échoué, retourner une erreur
    throw lastError || new Error("Tous les modèles d'IA sont indisponibles");
  },
  
  /**
   * Streaming via EventSource (SSE)
   */
  askStreaming({ prompt, agentType = "advisor", history = [], image = null, language = "fr" }) {
    const systemPrompt = language === "wo" ? SYSTEM_PROMPTS.wolofAdvisor : (SYSTEM_PROMPTS[agentType] || SYSTEM_PROMPTS.advisor);
    const enhancedPrompt = buildRAGPrompt(agentType, prompt);
    
    return fetch("/api/ai/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        systemPrompt,
        history,
        image,
        language,
        agentType,
      }),
    });
  },
  
  /**
   * Effacer le cache des réponses
   */
  clearCache() {
    responseCache = {};
    logger.info("AI: Cache cleared");
  },
  
  /**
   * Obtenir les prompts système disponibles
   */
  getAvailableAgents() {
    return Object.keys(SYSTEM_PROMPTS).map(key => ({
      id: key,
      name: getAgentDisplayName(key),
      description: getAgentDescription(key),
      icon: getAgentIcon(key),
    }));
  },
  
  /**
   * Traduire un texte via l'IA
   */
  async translate({ text, fromLang = "fr", toLang = "wo" }) {
    return this.ask({
      prompt: `Traduis ce texte du ${fromLang} au ${toLang} : "${text}". Réponds UNIQUEMENT avec la traduction, sans explications.`,
      agentType: "advisor",
    });
  },
};

// ====================================================================
// HELPER DISPLAY
// ====================================================================
function getAgentDisplayName(id) {
  const names = {
    advisor: "🤖 Conseiller Horticole IA",
    plantDoctor: "🔬 Docteur Plante IA",
    livestock: "🐄 Conseiller Élevage IA",
    finance: "💰 Analyste Financier IA",
    irrigation: "💧 Expert Irrigation IA",
    soil: "🌱 Expert Sol & Compost IA",
    personal: "📋 Assistant Personnel IA",
    wolofAdvisor: "🇸🇳 Conseiller en Wolof",
  };
  return names[id] || `Agent ${id}`;
}

function getAgentDescription(id) {
  const descs = {
    advisor: "Conseils maraîchage, maladies, traitements bio",
    plantDoctor: "Diagnostic visuel des maladies des plantes",
    livestock: "Soins, alimentation et reproduction animale",
    finance: "Rentabilité, budget et analyse financière",
    irrigation: "Gestion de l'eau et calendrier d'arrosage",
    soil: "Compost, amendements et fertilité des sols",
    personal: "Organisation des tâches et suivi quotidien",
    wolofAdvisor: "Nga wax ci Wolof, mbey mi ci Sénégal",
  };
  return descs[id] || "";
}

function getAgentIcon(id) {
  const icons = {
    advisor: "sparkles",
    plantDoctor: "scan-eye",
    livestock: "cow",
    finance: "trending-up",
    irrigation: "droplets",
    soil: "sprout",
    personal: "clipboard-check",
    wolofAdvisor: "globe",
  };
  return icons[id] || "bot";
}

export default AIService;