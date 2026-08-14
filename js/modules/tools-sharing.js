// KA Farm - Module de bourse d'outils agricoles
// Fonctionnalité 2.6 : partage et location d'outils agricoles entre fermes

import { KAStorage } from "../storage.js";
import { ErrorHandler } from "./error-handler.js";

// ============================================================
// EXPORT PRINCIPAL DU MODULE
// ============================================================

export const ToolsSharingModule = {
  // Gestion de l'état
  state: {
    selectedRegion: "Niayes",
    selectedToolType: "",
    searchQuery: "",
    viewMode: "catalog", // 'catalog', 'my-rentals', 'my-tools', 'favorites'
    currentUserFarmId: "FARM-006", // TODO : récupérer depuis la session
    currentUserFarmName: "Ferme Ba - Dakar", // TODO : récupérer depuis la session
  },

  // Types d'outils
  toolTypes: [
    "Irrigation",
    "Transport",
    "Traitement",
    "Labour",
    "Désherbage",
    "Entretien",
    "Récolte",
    "Autre",
  ],

  // Régions
  regions: ["Niayes", "Dakar", "Thiès", "Saint-Louis", "Kaolack", "Mbour", "Fatick", "Diourbel"],

  // ============================================================
  // INITIALISATION
  // ============================================================

  init() {
    try {
      this.storage = KAStorage;
      this.cacheElements();
      this.setupListeners();
      this.render();
      this.loadInitialData();
    } catch (err) {
      ErrorHandler.log(err, "ToolsSharingModule.init");
    }
  },

  cacheElements() {
    this.elements = {
      // Statistiques
      statTotalTools: document.getElementById("stat-total-tools"),
      statAvailableTools: document.getElementById("stat-available-tools"),
      statActiveRentals: document.getElementById("stat-active-rentals"),
      statTotalRentals: document.getElementById("stat-total-rentals"),

      // Onglets d'affichage
      viewCatalogBtn: document.getElementById("view-catalog"),
      viewMyRentalsBtn: document.getElementById("view-my-rentals"),
      viewMyToolsBtn: document.getElementById("view-my-tools"),
      viewFavoritesBtn: document.getElementById("view-favorites"),

      // Conteneur des cartes d'outils
      toolsGrid: document.getElementById("tools-grid"),

      // Tableau des locations
      rentalsTableBody: document.getElementById("rentals-table-body"),

      // Tableau de mes outils
      myToolsTableBody: document.getElementById("my-tools-table-body"),

      // Tableau des favoris
      favoritesTableBody: document.getElementById("favorites-table-body"),

      // Fenêtre modale de détail d'un outil
      toolDetailModal: document.getElementById("tool-detail-modal"),

      // Fenêtre modale de location
      rentalModal: document.getElementById("rental-modal"),

      // Fenêtre modale d'ajout d'un outil
      addToolModal: document.getElementById("add-tool-modal"),

      // Fenêtre modale d'avis
      reviewModal: document.getElementById("review-modal"),
    };
  },

  setupListeners() {
    // Onglets d'affichage
    if (this.elements.viewCatalogBtn) {
      this.elements.viewCatalogBtn.addEventListener("click", () => this.switchView("catalog"));
    }
    if (this.elements.viewMyRentalsBtn) {
      this.elements.viewMyRentalsBtn.addEventListener("click", () => this.switchView("my-rentals"));
    }
    if (this.elements.viewMyToolsBtn) {
      this.elements.viewMyToolsBtn.addEventListener("click", () => this.switchView("my-tools"));
    }
    if (this.elements.viewFavoritesBtn) {
      this.elements.viewFavoritesBtn.addEventListener("click", () => this.switchView("favorites"));
    }

    // Fenêtres modales
    if (this.elements.toolDetailModal) {
      const closeBtn = this.elements.toolDetailModal.querySelector("[data-close-tool-detail]");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => this.closeToolDetailModal());
      }
    }

    if (this.elements.rentalModal) {
      const saveBtn = this.elements.rentalModal.querySelector("[data-save-rental]");
      const closeBtn = this.elements.rentalModal.querySelector("[data-close-rental]");
      if (saveBtn) saveBtn.addEventListener("click", () => this.saveRental());
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeRentalModal());
    }

    if (this.elements.addToolModal) {
      const saveBtn = this.elements.addToolModal.querySelector("[data-save-tool]");
      const closeBtn = this.elements.addToolModal.querySelector("[data-close-tool]");
      if (saveBtn) saveBtn.addEventListener("click", () => this.saveTool());
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeAddToolModal());
    }

    if (this.elements.reviewModal) {
      const saveBtn = this.elements.reviewModal.querySelector("[data-save-review]");
      const closeBtn = this.elements.reviewModal.querySelector("[data-close-review]");
      if (saveBtn) saveBtn.addEventListener("click", () => this.saveReview());
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeReviewModal());
    }

    // Bouton d'ajout d'un outil
    const addToolBtn = document.getElementById("add-tool-btn");
    if (addToolBtn) {
      addToolBtn.addEventListener("click", () => this.openAddToolModal());
    }

    // Recherche
    const searchInput = document.getElementById("tools-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.state.searchQuery = e.target.value;
        this.render();
      });
    }

    // Filtres
    const regionFilter = document.getElementById("filter-region");
    if (regionFilter) {
      regionFilter.addEventListener("change", (e) => {
        this.state.selectedRegion = e.target.value;
        this.render();
      });
    }

    const typeFilter = document.getElementById("filter-tool-type");
    if (typeFilter) {
      typeFilter.addEventListener("change", (e) => {
        this.state.selectedToolType = e.target.value;
        this.render();
      });
    }
  },

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  loadInitialData() {
    this.tools = this.storage.getToolsSharing();
    this.rentals = this.storage.getToolRentals();
    this.favorites = this.storage.getToolFavorites();
    this.reviews = this.storage.getToolReviews();
    this.updateStats();
  },

  updateStats() {
    const tools = this.storage.getToolsSharing();
    const availableTools = this.storage.getAvailableTools();
    const activeRentals = this.storage.getActiveRentals();
    const allRentals = this.storage.getToolRentals();

    if (this.elements.statTotalTools) {
      this.elements.statTotalTools.textContent = tools.length;
    }
    if (this.elements.statAvailableTools) {
      this.elements.statAvailableTools.textContent = availableTools.length;
    }
    if (this.elements.statActiveRentals) {
      this.elements.statActiveRentals.textContent = activeRentals.length;
    }
    if (this.elements.statTotalRentals) {
      this.elements.statTotalRentals.textContent = allRentals.length;
    }
  },

  // ============================================================
  // GESTION DES VUES
  // ============================================================

  switchView(mode) {
    this.state.viewMode = mode;

    // Mettre à jour l'onglet actif
    if (this.elements.viewCatalogBtn) {
      this.elements.viewCatalogBtn.classList.toggle("bg-brand-green", mode === "catalog");
      this.elements.viewCatalogBtn.classList.toggle("bg-brand-slate", mode !== "catalog");
    }
    if (this.elements.viewMyRentalsBtn) {
      this.elements.viewMyRentalsBtn.classList.toggle("bg-brand-green", mode === "my-rentals");
      this.elements.viewMyRentalsBtn.classList.toggle("bg-brand-slate", mode !== "my-rentals");
    }
    if (this.elements.viewMyToolsBtn) {
      this.elements.viewMyToolsBtn.classList.toggle("bg-brand-green", mode === "my-tools");
      this.elements.viewMyToolsBtn.classList.toggle("bg-brand-slate", mode !== "my-tools");
    }
    if (this.elements.viewFavoritesBtn) {
      this.elements.viewFavoritesBtn.classList.toggle("bg-brand-green", mode === "favorites");
      this.elements.viewFavoritesBtn.classList.toggle("bg-brand-slate", mode !== "favorites");
    }

    // Afficher / masquer les sections
    const catalogSection = document.getElementById("catalog-section");
    const myRentalsSection = document.getElementById("my-rentals-section");
    const myToolsSection = document.getElementById("my-tools-section");
    const favoritesSection = document.getElementById("favorites-section");

    if (catalogSection) catalogSection.classList.toggle("hidden", mode !== "catalog");
    if (myRentalsSection) myRentalsSection.classList.toggle("hidden", mode !== "my-rentals");
    if (myToolsSection) myToolsSection.classList.toggle("hidden", mode !== "my-tools");
    if (favoritesSection) favoritesSection.classList.toggle("hidden", mode !== "favorites");

    this.render();
  },

  // ============================================================
  // RENDU
  // ============================================================

  render() {
    this.updateStats();

    switch (this.state.viewMode) {
      case "catalog":
        this.renderCatalog();
        break;
      case "my-rentals":
        this.renderMyRentals();
        break;
      case "my-tools":
        this.renderMyTools();
        break;
      case "favorites":
        this.renderFavorites();
        break;
    }
  },

  renderCatalog() {
    if (!this.elements.toolsGrid) return;

    let tools = this.storage.getAvailableTools();

    // Appliquer les filtres
    if (this.state.selectedRegion) {
      tools = tools.filter((t) => t.region === this.state.selectedRegion);
    }
    if (this.state.selectedToolType) {
      tools = tools.filter((t) => t.tool_type === this.state.selectedToolType);
    }
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      tools = tools.filter(
        (t) =>
          t.tool_name.toLowerCase().includes(query) ||
          t.tool_type.toLowerCase().includes(query) ||
          t.owner_farm_name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      );
    }

    // Sort by rating descending
    tools.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    this.elements.toolsGrid.innerHTML = tools
      .map((tool) => {
        const avgRating = this.storage.getAverageToolRating(tool.id);
        const reviewCount = this.storage.getToolReviewCount(tool.id);
        const isFavorited = this.storage.isToolFavorited(this.state.currentUserFarmId, tool.id);

        const defaultImage =
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%231e293b'/%3E%3Cg transform='translate(200, 150)'%3E%3Ccircle cx='0' cy='0' r='60' fill='%23334155' stroke='%2310B981' stroke-width='3'/%3E%3Cpath d='M-30,-20 L-10,-20 L-10,20 L-30,20 Z' fill='%2310B981'/%3E%3Cpath d='M-10,-20 L20,-20 L20,20 L-10,20 Z' fill='%23059669'/%3E%3Cpath d='M20,-10 L40,-10 L40,10 L20,10 Z' fill='%2310B981'/%3E%3Ccircle cx='50' cy='0' r='8' fill='%23047857'/%3E%3C/g%3E%3Ctext x='200' y='230' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='14' font-weight='bold'%3EOutil Agricole%3C/text%3E%3C/svg%3E";

        return `
        <div class="bg-brand-slate rounded-xl border border-gray-700 overflow-hidden hover:border-brand-green transition-colors">
          <div class="relative">
            <img src="${tool.photos && tool.photos[0] ? tool.photos[0] : defaultImage}" 
                 alt="${tool.tool_name}" 
                 class="w-full h-48 object-cover">
            <button onclick="ToolsSharingModule.toggleFavorite('${tool.id}')" 
                    class="absolute top-3 right-3 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-colors">
              <i data-lucide="${isFavorited ? "heart" : "heart"}" class="w-5 h-5 ${isFavorited ? "fill-current text-red-500" : ""}"></i>
            </button>
            <span class="absolute top-3 left-3 px-3 py-1 bg-brand-green/90 text-white text-xs font-bold rounded-full">
              ${tool.daily_rental_price_fcfa.toLocaleString("fr-FR")} FCFA/jour
            </span>
          </div>
          
          <div class="p-4">
            <h3 class="text-lg font-semibold text-white mb-1">${tool.tool_name}</h3>
            <p class="text-sm text-gray-400 mb-2">${tool.brand} ${tool.model}</p>
            
            <div class="flex items-center gap-2 mb-3">
              <span class="px-2 py-1 bg-gray-700 text-gray-200 text-xs rounded-full">${tool.tool_type}</span>
              <span class="px-2 py-1 bg-gray-700 text-gray-200 text-xs rounded-full">${tool.region}</span>
            </div>
            
            <p class="text-sm text-gray-300 mb-3 line-clamp-2">${tool.description}</p>
            
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-1">
                <i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-current"></i>
                <span class="text-sm text-white font-medium">${avgRating.toFixed(1)}</span>
                <span class="text-xs text-gray-400">(${reviewCount} avis)</span>
              </div>
              <span class="text-sm text-gray-300">${tool.total_rentals} locations</span>
            </div>
            
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-gray-400">Propriétaire</p>
                <p class="text-sm text-white font-medium">${tool.owner_farm_name}</p>
              </div>
              <button onclick="ToolsSharingModule.openToolDetail('${tool.id}')" 
                      class="px-4 py-2 bg-brand-green hover:bg-brand-hover text-white text-sm font-medium rounded-lg transition-colors">
                Voir détails
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    this.renderLucideIcons();
  },

  renderMyRentals() {
    if (!this.elements.rentalsTableBody) return;

    const rentals = this.storage.getRentalsByRenter(this.state.currentUserFarmId);

    // Sort by rental start date descending
    rentals.sort((a, b) => new Date(b.rental_start) - new Date(a.rental_start));

    this.elements.rentalsTableBody.innerHTML = rentals
      .map((rental) => {
        const tool = this.storage.getToolSharingById(rental.tool_id);
        const now = new Date();
        const endDate = new Date(rental.rental_end);
        const isActive =
          endDate >= now && rental.status !== "Annulée" && rental.status !== "Terminée";

        return `
        <tr class="border-b border-gray-700 hover:bg-gray-800/50">
          <td class="px-4 py-3">${tool ? tool.tool_name : rental.tool_id}</td>
          <td class="px-4 py-3">${tool ? tool.owner_farm_name : "N/A"}</td>
          <td class="px-4 py-3">${new Date(rental.rental_start).toLocaleDateString("fr-FR")}</td>
          <td class="px-4 py-3">${new Date(rental.rental_end).toLocaleDateString("fr-FR")}</td>
          <td class="px-4 py-3 text-right">${rental.total_amount_fcfa.toLocaleString("fr-FR")}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-1 rounded-full text-xs ${isActive ? "bg-green-800 text-green-200" : rental.status === "Annulée" ? "bg-red-800 text-red-200" : "bg-blue-800 text-blue-200"}">
              ${rental.status}
            </span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            ${
              isActive
                ? `
              <button onclick="ToolsSharingModule.returnTool('${rental.id}')" 
                      class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg mr-2">
                Retour
              </button>
            `
                : ""
            }
            <button onclick="ToolsSharingModule.openRentalDetail('${rental.id}')" 
                    class="text-gray-400 hover:text-white">
              <i data-lucide="eye"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    this.renderLucideIcons();
  },

  renderMyTools() {
    if (!this.elements.myToolsTableBody) return;

    const tools = this.storage
      .getToolsSharing()
      .filter((t) => t.owner_farm_id === this.state.currentUserFarmId);

    this.elements.myToolsTableBody.innerHTML = tools
      .map((tool) => {
        const avgRating = this.storage.getAverageToolRating(tool.id);
        const rentalCount = this.storage.getRentalHistory(tool.id).length;

        return `
        <tr class="border-b border-gray-700 hover:bg-gray-800/50">
          <td class="px-4 py-3">${tool.tool_name}</td>
          <td class="px-4 py-3">${tool.tool_type}</td>
          <td class="px-4 py-3">${tool.region}</td>
          <td class="px-4 py-3 text-right">${tool.daily_rental_price_fcfa.toLocaleString("fr-FR")}</td>
          <td class="px-4 py-3 text-center">
            <span class="px-2 py-1 rounded-full text-xs ${tool.is_available ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200"}">
              ${tool.is_available ? "Disponible" : "Indisponible"}
            </span>
          </td>
          <td class="px-4 py-3 text-center">
            <i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-current mx-auto"></i>
            <div class="text-xs text-gray-300">${avgRating.toFixed(1)} (${rentalCount})</div>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <button onclick="ToolsSharingModule.toggleAvailability('${tool.id}')" 
                    class="text-yellow-400 hover:text-yellow-300 mr-2">
              <i data-lucide="toggle-left"></i>
            </button>
            <button onclick="ToolsSharingModule.editTool('${tool.id}')" 
                    class="text-gray-400 hover:text-white mr-2">
              <i data-lucide="pencil"></i>
            </button>
            <button onclick="ToolsSharingModule.deleteTool('${tool.id}')" 
                    class="text-red-400 hover:text-red-300">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    this.renderLucideIcons();
  },

  renderFavorites() {
    if (!this.elements.favoritesTableBody) return;

    const favorites = this.storage.getFavoritesByFarm(this.state.currentUserFarmId);
    const tools = favorites
      .map((fav) => this.storage.getToolSharingById(fav.tool_id))
      .filter((t) => t);

    this.elements.favoritesTableBody.innerHTML = tools
      .map((tool) => {
        const avgRating = this.storage.getAverageToolRating(tool.id);

        return `
        <tr class="border-b border-gray-700 hover:bg-gray-800/50">
          <td class="px-4 py-3">${tool.tool_name}</td>
          <td class="px-4 py-3">${tool.tool_type}</td>
          <td class="px-4 py-3">${tool.owner_farm_name}</td>
          <td class="px-4 py-3">${tool.region}</td>
          <td class="px-4 py-3 text-right">${tool.daily_rental_price_fcfa.toLocaleString("fr-FR")}</td>
          <td class="px-4 py-3 text-center">
            <i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-current mx-auto"></i>
            <div class="text-xs text-gray-300">${avgRating.toFixed(1)}</div>
          </td>
          <td class="px-4 py-3 whitespace-nowrap">
            <button onclick="ToolsSharingModule.openRentalModal('${tool.id}')" 
                    class="px-3 py-1 bg-brand-green hover:bg-brand-hover text-white text-xs rounded-lg mr-2">
              Louer
            </button>
            <button onclick="ToolsSharingModule.toggleFavorite('${tool.id}')" 
                    class="text-red-400 hover:text-red-300">
              <i data-lucide="heart" class="fill-current"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    this.renderLucideIcons();
  },

  renderLucideIcons() {
    if (typeof lucide === "undefined") return;
    document.querySelectorAll("[data-lucide]").forEach((el) => {
      const iconName = el.getAttribute("data-lucide");
      el.innerHTML = lucide.create(iconName);
    });
  },

  // ============================================================
  // FENÊTRE MODALE DE DÉTAIL D'UN OUTIL
  // ============================================================

  openToolDetail(toolId) {
    const tool = this.storage.getToolSharingById(toolId);
    if (!tool) return;

    const avgRating = this.storage.getAverageToolRating(toolId);
    const reviewCount = this.storage.getToolReviewCount(toolId);
    const isFavorited = this.storage.isToolFavorited(this.state.currentUserFarmId, toolId);
    const reviews = this.storage.getToolReviewsByTool(toolId);
    const rentalHistory = this.storage.getRentalHistory(toolId);

    const defaultImage =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%231e293b'/%3E%3Cg transform='translate(200, 150)'%3E%3Ccircle cx='0' cy='0' r='60' fill='%23334155' stroke='%2310B981' stroke-width='3'/%3E%3Cpath d='M-30,-20 L-10,-20 L-10,20 L-30,20 Z' fill='%2310B981'/%3E%3Cpath d='M-10,-20 L20,-20 L20,20 L-10,20 Z' fill='%23059669'/%3E%3Cpath d='M20,-10 L40,-10 L40,10 L20,10 Z' fill='%2310B981'/%3E%3Ccircle cx='50' cy='0' r='8' fill='%23047857'/%3E%3C/g%3E%3Ctext x='200' y='230' text-anchor='middle' fill='%2394a3b8' font-family='Arial' font-size='14' font-weight='bold'%3EOutil Agricole%3C/text%3E%3C/svg%3E";

    const modal = this.elements.toolDetailModal;
    if (!modal) return;

    modal.innerHTML = `
        <div class="bg-brand-slate rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-gray-700">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-semibold text-white">${tool.tool_name}</h2>
            <button data-close-tool-detail class="text-gray-400 hover:text-white">
              <i data-lucide="x" class="w-6 h-6"></i>
            </button>
          </div>
          
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div>
              <img src="${tool.photos && tool.photos[0] ? tool.photos[0] : defaultImage}" 
                 alt="${tool.tool_name}" 
                 class="w-full h-64 object-cover rounded-xl mb-4">
            
            <div class="flex items-center gap-2 mb-4">
              <span class="px-3 py-1 bg-brand-green/20 text-brand-green text-sm font-bold rounded-full">
                ${tool.daily_rental_price_fcfa.toLocaleString("fr-FR")} FCFA/jour
              </span>
              ${
                tool.hourly_rental_price_fcfa > 0
                  ? `
                <span class="px-3 py-1 bg-gray-700 text-gray-200 text-sm rounded-full">
                  ${tool.hourly_rental_price_fcfa.toLocaleString("fr-FR")} FCFA/heure
                </span>
              `
                  : ""
              }
            </div>
          </div>
          
          <div class="space-y-4">
            <div>
              <h3 class="text-lg font-semibold text-white mb-2">Informations</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-400">Type</span>
                  <span class="text-white">${tool.tool_type}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Marque</span>
                  <span class="text-white">${tool.brand}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Modèle</span>
                  <span class="text-white">${tool.model}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Année</span>
                  <span class="text-white">${tool.purchase_year}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">État</span>
                  <span class="text-white">${tool.condition}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Durée min.</span>
                  <span class="text-white">${tool.minimum_rental_hours} heures</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-white mb-2">Propriétaire</h3>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-400">Ferme</span>
                  <span class="text-white">${tool.owner_farm_name}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Contact</span>
                  <span class="text-white">${tool.owner_contact_name} (${tool.owner_phone})</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-400">Localisation</span>
                  <span class="text-white">${tool.owner_location}, ${tool.region}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-2">Description</h3>
          <p class="text-gray-300 text-sm">${tool.description}</p>
        </div>
        
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-white mb-2">Instructions d'utilisation</h3>
          <p class="text-gray-300 text-sm">${tool.usage_instructions}</p>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 class="text-lg font-semibold text-white mb-2">Exigences</h3>
            <div class="space-y-1 text-sm">
              <div class="flex items-center gap-2">
                <i data-lucide="${tool.insurance_required ? "check-circle" : "x-circle"}" class="w-4 h-4 ${tool.insurance_required ? "text-green-400" : "text-red-400"}"></i>
                <span class="text-gray-300">Assurance ${tool.insurance_required ? "requise" : "non requise"}</span>
              </div>
              <div class="text-gray-300">Caution: ${tool.deposit_required.toLocaleString("fr-FR")} FCFA</div>
            </div>
          </div>
          
          <div>
            <h3 class="text-lg font-semibold text-white mb-2">Statistiques</h3>
            <div class="space-y-1 text-sm">
              <div class="flex items-center gap-2">
                <i data-lucide="star" class="w-4 h-4 text-yellow-400 fill-current"></i>
                <span class="text-white">${avgRating.toFixed(1)} (${reviewCount} avis)</span>
              </div>
              <div class="text-gray-300">Total locations: ${rentalHistory.length}</div>
              <div class="text-gray-300">Vérifié: ${tool.is_verified ? "Oui" : "Non"}</div>
            </div>
          </div>
        </div>
        
        <div class="flex gap-4 mb-6">
          <button onclick="ToolsSharingModule.openRentalModal('${tool.id}')" 
                  class="flex-1 px-6 py-3 bg-brand-green hover:bg-brand-hover text-white font-medium rounded-lg transition-colors">
            <i data-lucide="calendar" class="w-5 h-5 inline-block mr-2"></i>
            Réserver
          </button>
          <button onclick="ToolsSharingModule.toggleFavorite('${tool.id}')" 
                  class="px-6 py-3 ${isFavorited ? "bg-red-600 hover:bg-red-700" : "bg-gray-700 hover:bg-gray-600"} text-white font-medium rounded-lg transition-colors">
            <i data-lucide="${isFavorited ? "heart" : "heart"}" class="w-5 h-5 fill-current"></i>
          </button>
        </div>
        
        ${
          reviews.length > 0
            ? `
          <div class="border-t border-gray-700 pt-6">
            <h3 class="text-lg font-semibold text-white mb-4">Avis (${reviews.length})</h3>
            <div class="space-y-4">
              ${reviews
                .map((review) => {
                  const reviewer = this.storage
                    .getToolSharing()
                    .find((t) => t.owner_farm_id === review.renter_farm_id);
                  return `
                  <div class="bg-gray-800/50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          ${review.renter_farm_id.substring(0, 2)}
                        </div>
                        <div>
                          <p class="text-sm text-white font-medium">${reviewer ? reviewer.owner_farm_name : "Utilisateur"}</p>
                          <div class="flex gap-1">
                            ${[...Array(5)]
                              .map((_, i) => {
                                const star =
                                  i < Math.floor(review.rating)
                                    ? "star"
                                    : i < review.rating
                                      ? "star-half"
                                      : "star-off";
                                return `<i data-lucide="${star}" class="w-3 h-3 ${i < review.rating ? "text-yellow-400 fill-current" : "text-gray-500"}"></i>`;
                              })
                              .join("")}
                          </div>
                        </div>
                      </div>
                      <span class="text-xs text-gray-400">${new Date(review.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <p class="text-sm text-gray-300">${review.review_text}</p>
                    <p class="text-xs text-gray-500 mt-2">Louerait à nouveau: ${review.would_rent_again ? "Oui" : "Non"}</p>
                  </div>
                `;
                })
                .join("")}
            </div>
          </div>
        `
            : ""
        }
      </div>
    `;

    modal.classList.remove("hidden");
    this.renderLucideIcons();
  },

  closeToolDetailModal() {
    if (this.elements.toolDetailModal) {
      this.elements.toolDetailModal.classList.add("hidden");
    }
  },

  // ============================================================
  // FENÊTRE MODALE DE LOCATION
  // ============================================================

  openRentalModal(toolId) {
    const tool = this.storage.getToolSharingById(toolId);
    if (!tool) return;

    this.currentRentalToolId = toolId;

    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split("T")[0];

    if (this.elements.rentalModal) {
      const toolNameEl = this.elements.rentalModal.querySelector("[data-tool-name]");
      const toolPriceEl = this.elements.rentalModal.querySelector("[data-tool-price]");
      const startDateEl = this.elements.rentalModal.querySelector("[data-rental-start]");
      const endDateEl = this.elements.rentalModal.querySelector("[data-rental-end]");
      const hoursEl = this.elements.rentalModal.querySelector("[data-rental-hours]");
      const totalEl = this.elements.rentalModal.querySelector("[data-rental-total]");
      const ownerEl = this.elements.rentalModal.querySelector("[data-owner-info]");

      if (toolNameEl) toolNameEl.textContent = tool.tool_name;
      if (toolPriceEl)
        toolPriceEl.textContent = `${tool.daily_rental_price_fcfa.toLocaleString("fr-FR")} FCFA/jour`;
      if (startDateEl) startDateEl.value = startDate;
      if (endDateEl) endDateEl.value = endDateStr;
      if (hoursEl) hoursEl.value = tool.minimum_rental_hours || 1;
      if (totalEl)
        totalEl.textContent = tool.daily_rental_price_fcfa.toLocaleString("fr-FR") + " FCFA";
      if (ownerEl)
        ownerEl.textContent = `${tool.owner_farm_name} - ${tool.owner_contact_name} (${tool.owner_phone})`;

      this.elements.rentalModal.classList.remove("hidden");
    }
  },

  closeRentalModal() {
    if (this.elements.rentalModal) {
      this.elements.rentalModal.classList.add("hidden");
    }
    this.currentRentalToolId = null;
  },

  calculateRentalTotal() {
    const tool = this.storage.getToolSharingById(this.currentRentalToolId);
    if (!tool) return 0;

    const startDateEl = this.elements.rentalModal.querySelector("[data-rental-start]");
    const endDateEl = this.elements.rentalModal.querySelector("[data-rental-end]");
    const hoursEl = this.elements.rentalModal.querySelector("[data-rental-hours]");
    const totalEl = this.elements.rentalModal.querySelector("[data-rental-total]");

    if (!startDateEl || !endDateEl || !hoursEl || !totalEl) return;

    const startDate = new Date(startDateEl.value);
    const endDate = new Date(endDateEl.value);
    const hours = parseInt(hoursEl.value) || tool.minimum_rental_hours;

    // Calculate days difference
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Utiliser le tarif journalier pour les jours complets, et le tarif horaire pour les jours partiels
    let total = 0;
    if (tool.hourly_rental_price_fcfa > 0 && hours < 24) {
      total = hours * tool.hourly_rental_price_fcfa;
    } else {
      total = daysDiff * tool.daily_rental_price_fcfa;
    }

    totalEl.textContent = total.toLocaleString("fr-FR") + " FCFA";
    return total;
  },

  saveRental() {
    const tool = this.storage.getToolSharingById(this.currentRentalToolId);
    if (!tool) return;

    const startDateEl = this.elements.rentalModal.querySelector("[data-rental-start]");
    const endDateEl = this.elements.rentalModal.querySelector("[data-rental-end]");
    const hoursEl = this.elements.rentalModal.querySelector("[data-rental-hours]");

    if (!startDateEl || !endDateEl || !hoursEl) return;

    const startDate = startDateEl.value + "T08:00:00.000Z";
    const endDate = endDateEl.value + "T18:00:00.000Z";
    const hours = parseInt(hoursEl.value) || tool.minimum_rental_hours;

    // Calculate days difference
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    let totalAmount = 0;
    if (tool.hourly_rental_price_fcfa > 0 && hours < 24) {
      totalAmount = hours * tool.hourly_rental_price_fcfa;
    } else {
      totalAmount = daysDiff * tool.daily_rental_price_fcfa;
    }

    const rental = {
      id: `RENT-${Date.now()}`,
      tool_id: tool.id,
      renter_farm_id: this.state.currentUserFarmId,
      renter_farm_name: this.state.currentUserFarmName,
      renter_contact_name: "Utilisateur Actuel", // TODO: Get from session
      renter_phone: "", // TODO: Get from session
      rental_start: startDate,
      rental_end: endDate,
      total_hours: hours,
      daily_rate: tool.daily_rental_price_fcfa,
      total_amount_fcfa: totalAmount,
      deposit_paid_fcfa: 0,
      balance_due_fcfa: totalAmount,
      payment_status: "En attente",
      pickup_location: tool.owner_location,
      return_location: tool.owner_location,
      actual_return: null,
      condition_on_return: "Bon état",
      damage_noted: "",
      damage_cost: 0,
      status: "Confirmée",
      cancellation_reason: "",
      notes: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.storage.addToolRental(rental);

    // Mark tool as unavailable
    this.storage.updateToolSharing(tool.id, { is_available: false });

    this.closeRentalModal();
    this.loadInitialData();
    this.render();

    ErrorHandler.showToast("Location réservée avec succès!", "success");
  },

  returnTool(rentalId) {
    const rental = this.storage.getToolRentalById(rentalId);
    if (!rental) return;

    const tool = this.storage.getToolSharingById(rental.tool_id);
    if (!tool) return;

    // Mark as returned
    const updatedRental = this.storage.updateToolRental(rentalId, {
      status: "Terminée",
      actual_return: new Date().toISOString(),
      condition_on_return: "Bon état",
      updated_at: new Date().toISOString(),
    });

    // Mark tool as available again
    this.storage.updateToolSharing(tool.id, { is_available: true });

    this.loadInitialData();
    this.render();

    ErrorHandler.showToast("Outils retourné avec succès!", "success");
  },

  // ============================================================
  // FENÊTRE MODALE D'AJOUT D'UN OUTIL
  // ============================================================

  openAddToolModal(toolId = null) {
    this.currentToolId = toolId;

    if (toolId) {
      const tool = this.storage.getToolSharingById(toolId);
      if (tool) {
        // Populate form with tool data
        const form = this.elements.addToolModal.querySelector("form");
        if (form) {
          form.elements["tool-name"].value = tool.tool_name || "";
          form.elements["tool-type"].value = tool.tool_type || "";
          form.elements["tool-brand"].value = tool.brand || "";
          form.elements["tool-model"].value = tool.model || "";
          form.elements["tool-year"].value = tool.purchase_year || "";
          form.elements["tool-condition"].value = tool.condition || "";
          form.elements["tool-description"].value = tool.description || "";
          form.elements["tool-daily-price"].value = tool.daily_rental_price_fcfa || "";
          form.elements["tool-hourly-price"].value = tool.hourly_rental_price_fcfa || "";
          form.elements["tool-min-hours"].value = tool.minimum_rental_hours || "";
          form.elements["tool-region"].value = tool.region || "";
          form.elements["tool-location"].value = tool.owner_location || "";
          form.elements["tool-usage"].value = tool.usage_instructions || "";
          form.elements["tool-maintenance"].value = tool.maintenance_requirements || "";
          form.elements["tool-insurance"].checked = tool.insurance_required || false;
          form.elements["tool-deposit"].value = tool.deposit_required || "";
          form.elements["tool-verified"].checked = tool.is_verified || false;
          form.elements["tool-notes"].value = tool.notes || "";
        }
      }
    } else {
      // Réinitialiser le formulaire
      const form = this.elements.addToolModal.querySelector("form");
      if (form) form.reset();
    }

    if (this.elements.addToolModal) {
      this.elements.addToolModal.classList.remove("hidden");
    }
  },

  closeAddToolModal() {
    if (this.elements.addToolModal) {
      this.elements.addToolModal.classList.add("hidden");
    }
    this.currentToolId = null;
  },

  saveTool() {
    const form = this.elements.addToolModal.querySelector("form");
    if (!form) return;

    const tool = {
      id: this.currentToolId || `TS-${Date.now()}`,
      tool_name: form.elements["tool-name"].value,
      tool_type: form.elements["tool-type"].value,
      brand: form.elements["tool-brand"].value,
      model: form.elements["tool-model"].value,
      purchase_year: parseInt(form.elements["tool-year"].value) || 0,
      condition: form.elements["tool-condition"].value,
      description: form.elements["tool-description"].value,
      daily_rental_price_fcfa: parseInt(form.elements["tool-daily-price"].value) || 0,
      hourly_rental_price_fcfa: parseInt(form.elements["tool-hourly-price"].value) || 0,
      minimum_rental_hours: parseInt(form.elements["tool-min-hours"].value) || 1,
      is_available: true,
      owner_farm_id: this.state.currentUserFarmId,
      owner_farm_name: this.state.currentUserFarmName,
      owner_contact_name: "Utilisateur Actuel", // TODO : récupérer depuis la session
      owner_phone: "", // TODO : récupérer depuis la session
      owner_location: form.elements["tool-location"].value,
      owner_lat: 14.7932, // TODO : récupérer depuis la géolocalisation
      owner_lng: -17.2654, // TODO : récupérer depuis la géolocalisation
      region: form.elements["tool-region"].value,
      usage_instructions: form.elements["tool-usage"].value,
      maintenance_requirements: form.elements["tool-maintenance"].value,
      insurance_required: form.elements["tool-insurance"].checked,
      deposit_required: parseInt(form.elements["tool-deposit"].value) || 0,
      total_rentals: 0,
      rating: 0,
      is_verified: form.elements["tool-verified"].checked,
      photos: [],
      notes: form.elements["tool-notes"].value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.currentToolId) {
      this.storage.updateToolSharing(this.currentToolId, tool);
    } else {
      this.storage.addToolSharing(tool);
    }

    this.closeAddToolModal();
    this.loadInitialData();
    this.render();

    ErrorHandler.showToast("Outil enregistré avec succès!", "success");
  },

  editTool(toolId) {
    this.openAddToolModal(toolId);
  },

  deleteTool(toolId) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet outil ?")) {
      this.storage.deleteToolSharing(toolId);
      this.loadInitialData();
      this.render();
    }
  },

  toggleAvailability(toolId) {
    this.storage.toggleToolAvailability(toolId);
    this.loadInitialData();
    this.render();
  },

  // ============================================================
  // FENÊTRE MODALE D'AVIS
  // ============================================================

  openReviewModal(rentalId) {
    this.currentReviewRentalId = rentalId;
    const rental = this.storage.getToolRentalById(rentalId);

    if (rental) {
      const tool = this.storage.getToolSharingById(rental.tool_id);
      if (tool && this.elements.reviewModal) {
        const toolNameEl = this.elements.reviewModal.querySelector("[data-review-tool]");
        if (toolNameEl) toolNameEl.textContent = tool.tool_name;
      }
    }

    if (this.elements.reviewModal) {
      this.elements.reviewModal.classList.remove("hidden");
    }
  },

  closeReviewModal() {
    if (this.elements.reviewModal) {
      this.elements.reviewModal.classList.add("hidden");
    }
    this.currentReviewRentalId = null;
  },

  saveReview() {
    const form = this.elements.reviewModal.querySelector("form");
    if (!form || !this.currentReviewRentalId) return;

    const rental = this.storage.getToolRentalById(this.currentReviewRentalId);
    if (!rental) return;

    const review = {
      id: `TRV-${Date.now()}`,
      rental_id: this.currentReviewRentalId,
      tool_id: rental.tool_id,
      renter_farm_id: rental.renter_farm_id,
      rating: parseInt(form.elements["review-rating"].value) || 5,
      review_text: form.elements["review-text"].value,
      would_rent_again: form.elements["review-again"].checked,
      created_at: new Date().toISOString(),
    };

    this.storage.addToolReview(review);

    // Mettre à jour la note de l'outil
    const tool = this.storage.getToolSharingById(rental.tool_id);
    if (tool) {
      const avgRating = this.storage.getAverageToolRating(rental.tool_id);
      this.storage.updateToolSharing(tool.id, { rating: avgRating });
    }

    this.closeReviewModal();
    this.loadInitialData();
    this.render();

    ErrorHandler.showToast("Avis soumis avec succès!", "success");
  },

  // ============================================================
  // FAVORITES
  // ============================================================

  toggleFavorite(toolId) {
    const isFavorited = this.storage.isToolFavorited(this.state.currentUserFarmId, toolId);

    if (isFavorited) {
      this.storage.removeToolFavorite(this.state.currentUserFarmId, toolId);
      ErrorHandler.showToast("Retiré des favoris", "success");
    } else {
      this.storage.addToolFavorite({
        id: `TF-${Date.now()}`,
        farm_id: this.state.currentUserFarmId,
        tool_id: toolId,
      });
      ErrorHandler.showToast("Ajouté aux favoris", "success");
    }

    this.loadInitialData();
    this.render();
  },
};

// Initialiser le module lorsque le DOM est chargé
document.addEventListener("DOMContentLoaded", () => {
  ToolsSharingModule.init();
});
