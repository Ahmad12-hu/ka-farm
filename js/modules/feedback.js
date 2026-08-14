// KA Farm - Module de Feedback
// Système de collecte d'avis utilisateur

export const FeedbackModule = {
  supabaseUrl: null,
  supabaseKey: null,
  supabaseClient: null,

  /**
   * Initialise le module de feedback
   * @param {string} url - URL Supabase
   * @param {string} key - Clé API Supabase
   */
  init(url, key) {
    this.supabaseUrl = url;
    this.supabaseKey = key;

    // Créer le bouton flottant
    this.injectFloatingButton();

    // Charger les APIs Supabase si pas déjà fait
    if (!window.supabase) {
      this.loadSupabase();
    } else {
      this.supabaseClient = window.supabase.createClient(url, key);
    }
  },

  /**
   * Charge la librairie Supabase dynamiquement
   */
  loadSupabase() {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.onload = () => {
      this.supabaseClient = window.supabase.createClient(this.supabaseUrl, this.supabaseKey);
    };
    document.head.appendChild(script);
  },

  /**
   * Injecte le bouton flottant dans toutes les pages
   */
  injectFloatingButton() {
    // Éviter les doublons
    if (document.getElementById("feedback-fab")) {
      console.log("Feedback button already exists, skipping injection");
      return;
    }

    // Si le body n'est pas encore chargé, utiliser un MutationObserver
    if (!document.body) {
      console.log("Body not ready, setting up observer...");
      const observer = new MutationObserver((mutations, obs) => {
        if (document.body) {
          console.log("Body detected, injecting button...");
          this.createButton();
          obs.disconnect();
        }
      });

      observer.observe(document.documentElement, { childList: true, subtree: true });

      // Fallback après 5 secondes
      setTimeout(() => {
        if (!document.getElementById("feedback-fab") && document.body) {
          console.log("Fallback: forcing button injection...");
          this.createButton();
        }
      }, 5000);
    } else {
      console.log("Body ready, injecting button immediately...");
      this.createButton();
    }
  },

  /**
   * Crée et injecte le bouton (helper method)
   */
  createButton() {
    if (document.getElementById("feedback-fab")) {
      console.log("Button already exists");
      return;
    }

    const fab = document.createElement("button");
    fab.id = "feedback-fab";
    fab.className =
      "fixed bottom-28 right-6 z-[9999] bg-emerald-600 hover:bg-emerald-500 text-white p-6 rounded-full shadow-2xl hover:shadow-emerald-500/70 transition-all duration-300 hover:scale-125 cursor-pointer border-4 border-white/20 backdrop-blur-sm";
    fab.title = "Donner mon avis";
    fab.setAttribute("aria-label", "Donner mon avis sur l'application");
    fab.onclick = () => this.openModal();

    fab.innerHTML = `
      <svg class="w-10 h-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
      </svg>
    `;

    document.body.appendChild(fab);
    console.log("✅ Feedback button injected successfully at position bottom-28 right-6");
  },

    /**
     * Ouvre la fenêtre modale de retour utilisateur
     */
  openModal() {
    const modal = document.createElement("div");
    modal.id = "feedback-modal";
    modal.className = "fixed inset-0 z-50 hidden";
    modal.innerHTML = `
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-0" id="feedback-backdrop"></div>
      <div class="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div class="bg-[#162010] border border-[#143E23] rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-black/50 transform scale-95 opacity-0 transition-all duration-300 pointer-events-none" id="feedback-content">
          
          <!-- En-tête -->
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-black text-white flex items-center gap-2">
              <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
              </svg>
              Donner mon avis
            </h3>
            <button onclick="window.FeedbackModule.closeModal()" class="text-slate-400 hover:text-white transition-colors p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <!-- Question 1 : note rapide -->
          <div class="mb-5">
            <label class="block text-sm font-bold text-slate-200 mb-2">
              Comment trouvez-vous l'application ?
            </label>
            <div class="flex gap-2 justify-center" id="rating-buttons">
              <button type="button" data-rating="1" class="rating-btn text-3xl hover:scale-125 transition-transform duration-200 cursor-pointer">😞</button>
              <button type="button" data-rating="2" class="rating-btn text-3xl hover:scale-125 transition-transform duration-200 cursor-pointer">😐</button>
              <button type="button" data-rating="3" class="rating-btn text-3xl hover:scale-125 transition-transform duration-200 cursor-pointer">🙂</button>
              <button type="button" data-rating="4" class="rating-btn text-3xl hover:scale-125 transition-transform duration-200 cursor-pointer">😃</button>
            </div>
            <input type="hidden" id="feedback-rating" value="">
          </div>

          <!-- Question 2 : améliorations -->
          <div class="mb-4">
            <label class="block text-sm font-bold text-slate-200 mb-2">
              Qu'est-ce qu'on pourrait améliorer ?
            </label>
            <textarea 
              id="feedback-message" 
              rows="4" 
              class="w-full bg-[#0f1a0b] border border-[#143E23] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
              placeholder="Vos suggestions, bugs rencontrés, idées..."
            ></textarea>
          </div>

          <!-- Bouton d'envoi -->
          <button 
            id="feedback-submit"
            class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Envoyer mon avis
          </button>

          <!-- Message de confirmation -->
          <div id="feedback-success" class="hidden mt-3 text-center text-sm font-bold text-emerald-400">
            ✓ Merci pour votre retour !
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Afficher avec animation
    requestAnimationFrame(() => {
      modal.classList.remove("hidden");
      const backdrop = document.getElementById("feedback-backdrop");
      const content = document.getElementById("feedback-content");

      setTimeout(() => {
        backdrop.classList.remove("opacity-0");
        backdrop.classList.add("opacity-100");
        content.classList.remove("scale-95", "opacity-0", "pointer-events-none");
        content.classList.add("scale-100", "opacity-100");
      }, 10);
    });

    // Gestion des étoiles / emojis
    this.setupRatingButtons();

    // Gestion de la soumission
    document
      .getElementById("feedback-submit")
      .addEventListener("click", () => this.submitFeedback());

    // Fermer en cliquant sur l'arrière-plan
    document.getElementById("feedback-backdrop").addEventListener("click", () => this.closeModal());

    // Fermer avec la touche Échap
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        this.closeModal();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  },

    /**
     * Configure les boutons de notation
     */
  setupRatingButtons() {
    const buttons = document.querySelectorAll(".rating-btn");
    const input = document.getElementById("feedback-rating");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Reset tous les boutons
        buttons.forEach((b) => {
          b.classList.remove("scale-125", "ring-2", "ring-emerald-400", "rounded-full");
        });

        // Activer le bouton sélectionné
        btn.classList.add("scale-125", "ring-2", "ring-emerald-400", "rounded-full");
        input.value = btn.dataset.rating;
      });
    });
  },

  /**
   * Soumet le feedback
   */
  async submitFeedback() {
    const rating = document.getElementById("feedback-rating").value;
    const message = document.getElementById("feedback-message").value.trim();

    if (!rating) {
      alert("Veuillez sélectionner une note 😊");
      return;
    }

    const submitBtn = document.getElementById("feedback-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Envoi en cours...";

    // Récupérer l'utilisateur connecté si disponible
    let userId = null;
    try {
      const currentUser = window.UserManager?.getCurrentUser();
      if (currentUser) {
        userId = currentUser.id;
      }
    } catch (e) {
      // Utilisateur non connecté
    }

    const feedback = {
      date: new Date().toISOString(),
      note: parseInt(rating),
      message: message || "",
      user_id: userId,
    };

    try {
      if (this.supabaseClient) {
        await this.supabaseClient.from("feedback").insert([feedback]);
      } else {
        // Fallback: stocker localement si Supabase n'est pas configuré
        this.storeLocally(feedback);
      }

      // Afficher confirmation
      document.getElementById("feedback-success").classList.remove("hidden");
      submitBtn.textContent = "Envoyé !";

      // Fermer après 2 secondes
      setTimeout(() => {
        this.closeModal();
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de l'envoi du feedback:", error);
      alert("Désolé, une erreur est survenue. Veuillez réessayer.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Envoyer mon avis";
    }
  },

  /**
   * Stocke le feedback localement si Supabase n'est pas disponible
   */
  storeLocally(feedback) {
    const feedbacks = JSON.parse(localStorage.getItem("ka_farm_feedbacks") || "[]");
    feedbacks.push(feedback);
    localStorage.setItem("ka_farm_feedbacks", JSON.stringify(feedbacks));
  },

  /**
   * Ferme le modal avec animation
   */
  closeModal() {
    const modal = document.getElementById("feedback-modal");
    if (!modal) return;

    const backdrop = document.getElementById("feedback-backdrop");
    const content = document.getElementById("feedback-content");

    // Animation de sortie
    backdrop.classList.remove("opacity-100");
    backdrop.classList.add("opacity-0");
    content.classList.remove("scale-100", "opacity-100");
    content.classList.add("scale-95", "opacity-0");

    setTimeout(() => {
      modal.remove();
    }, 300);
  },
};

// Rendre disponible globalement
window.FeedbackModule = FeedbackModule;
