// KA Farm - Crops & Nurseries Module (With Sanitary Diagnostics)
import { KAStorage, CropsStorage } from "../storage.js";
import { logger } from "./logger.js";
import { ErrorHandler } from "./error-handler.js";
import { UserManager } from "../user-manager.js";

let liveStream = null;
let currentSanitaryBase64 = "";

const CROP_LIBRARY_DATA = CropsStorage.getCropLibrary();

/**
 * Initialize the CropsModule, rendering all components and setting up event listeners.
 * @async
 * @function
 */
export const CropsModule = {
  /**
   * Initialize module: populate selects, render crops/nurseries/treatments/library, setup listeners.
   * @async
   */
  init() {
    try {
      this.populateParcelOptions();
      this.renderCrops();
      this.renderNurseries();
      this.renderTreatments();
      this.renderLibrary(); // Option 4
      this.initYieldEstimator();
      this.setupListeners();

      // Support search query parameter for fiches de culture
      const urlParams = new URLSearchParams(window.location.search);
      const searchParam = urlParams.get("search");
      if (searchParam) {
        const searchInput = document.getElementById("library-search");
        if (searchInput) {
          searchInput.value = searchParam;
          if (window.filterLibraryCrops) {
            window.filterLibraryCrops();
          }
        }
      }
    } catch (err) {
      ErrorHandler.log(err, "CropsModule.init");
    }
  },

  /**
   * Populate parcel dropdowns used in crop filters and forms with available parcel names.
   * @function
   */
  populateParcelOptions() {
    const filterFieldSelect = document.getElementById("crops-filter-field");
    const formFieldSelect = document.getElementById("form-crop-field-select");

    if (!filterFieldSelect && !formFieldSelect) return;

    const parcelles = KAStorage.getParcelles();
    const crops = KAStorage.getCrops();

    const parcelNamesSet = new Set(parcelles.map((p) => p.name));
    crops.forEach((c) => {
      if (c.field) {
        parcelNamesSet.add(c.field);
      }
    });
    const sortedParcels = Array.from(parcelNamesSet).sort();

    if (filterFieldSelect) {
      filterFieldSelect.innerHTML =
        '<option value="all">📍 Toutes Parcelles</option>' +
        sortedParcels.map((p) => `<option value="${p}">${p}</option>`).join("");
    }

    if (formFieldSelect) {
      formFieldSelect.innerHTML =
        sortedParcels.map((p) => `<option value="${p}">${p}</option>`).join("") +
        '<option value="custom">+ Saisir une nouvelle parcelle...</option>';
    }
  },

  initYieldEstimator() {
    const dateInput = document.getElementById("est-sowing-date");
    if (dateInput) {
      dateInput.value = new Date().toISOString().split("T")[0];
    }

    window.updateYieldEstimator = () => this.updateYieldEstimator();
    this.updateYieldEstimator();
  },

  updateYieldEstimator() {
    const cropType = document.getElementById("est-crop-select")?.value;
    const surface = parseFloat(document.getElementById("est-surface")?.value) || 0;
    const density = parseFloat(document.getElementById("est-density")?.value) || 0;
    const sowingDateStr = document.getElementById("est-sowing-date")?.value;

    if (!cropType) return;

    let yieldFactor = 0; // average yield per plant in kg
    let cycleDays = 90;

    if (cropType === "tomate") {
      yieldFactor = 2.5; // 2.5kg per tomato plant
      cycleDays = 80;
    } else if (cropType === "oignon") {
      yieldFactor = 0.15; // 150g per onion bulb
      cycleDays = 135;
    } else if (cropType === "menthe") {
      yieldFactor = 0.8; // 800g of leaves per m2-equivalent plant cuts
      cycleDays = 45;
    } else if (cropType === "chou") {
      yieldFactor = 1.2; // 1.2kg per cabbage head
      cycleDays = 90;
    } else if (cropType === "piment") {
      yieldFactor = 0.5; // 500g of peppers per plant
      cycleDays = 135;
    }

    const totalPlants = surface * density;
    const yieldKg = totalPlants * yieldFactor;
    const yieldTons = yieldKg / 1000;

    const yieldResult = document.getElementById("est-yield-result");
    const yieldSub = document.getElementById("est-yield-sub");
    if (yieldResult) yieldResult.textContent = `${yieldTons.toFixed(2)} T`;
    if (yieldSub)
      yieldSub.textContent = `~ ${Math.round(yieldKg).toLocaleString("fr-FR")} kg de légumes`;

    const dateResult = document.getElementById("est-date-result");
    const daysCountdown = document.getElementById("est-days-countdown");
    const alertPanel = document.getElementById("est-alert-panel");
    const alertTitle = document.getElementById("est-alert-title");
    const alertDesc = document.getElementById("est-alert-desc");
    const alertIcon = document.getElementById("est-alert-icon");

    if (sowingDateStr) {
      const sowingDate = new Date(sowingDateStr);
      const harvestDate = new Date(sowingDate.getTime() + cycleDays * 24 * 60 * 60 * 1000);

      const options = { day: "numeric", month: "long", year: "numeric" };
      if (dateResult) dateResult.textContent = harvestDate.toLocaleDateString("fr-FR", options);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      harvestDate.setHours(0, 0, 0, 0);
      const timeDiff = harvestDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      if (daysCountdown) {
        if (daysDiff > 0) {
          daysCountdown.textContent = `${daysDiff} jours restants`;
        } else if (daysDiff === 0) {
          daysCountdown.textContent = `Aujourd'hui !`;
        } else {
          daysCountdown.textContent = `Récolte passée de ${Math.abs(daysDiff)} jours`;
        }
      }

      if (alertPanel && alertTitle && alertDesc) {
        if (daysDiff > 14) {
          alertPanel.className =
            "p-3.5 bg-emerald-550/5 dark:bg-[#061109]/20 rounded-xl border border-emerald-500/10 flex items-start gap-3";
          alertTitle.className = "text-xs font-extrabold text-emerald-600 dark:text-emerald-400";
          alertTitle.textContent = "Planche en croissance saine";
          alertDesc.textContent = `La récolte est prévue dans ${daysDiff} jours. Continuez l'irrigation selon les recommandations du calculateur intelligent.`;
          if (alertIcon) alertIcon.className = "h-4 w-4 text-emerald-500";
        } else if (daysDiff <= 14 && daysDiff >= 0) {
          alertPanel.className =
            "p-3.5 bg-amber-550/5 dark:bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-start gap-3 animate-pulse";
          alertTitle.className = "text-xs font-extrabold text-amber-600 dark:text-amber-400";
          alertTitle.textContent = "Récolte imminente ! 🎉";
          alertDesc.textContent = `Il reste moins de deux semaines (${daysDiff} j) avant la maturité optimale. Préparez vos caisses, organisez le transport et vérifiez les cours des marchés locaux !`;
          if (alertIcon) alertIcon.className = "h-4 w-4 text-amber-500";
        } else {
          alertPanel.className =
            "p-3.5 bg-rose-550/5 dark:bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-start gap-3";
          alertTitle.className = "text-xs font-extrabold text-rose-500";
          alertTitle.textContent = "Période de récolte dépassée !";
          alertDesc.textContent = `Attention ! Le cycle théorique est achevé depuis ${Math.abs(daysDiff)} jours. Récoltez immédiatement pour éviter les pertes ou la pourriture sur pied.`;
          if (alertIcon) alertIcon.className = "h-4 w-4 text-rose-500";
        }
      }
    } else {
      if (dateResult) dateResult.textContent = "-- -- ----";
      if (daysCountdown) daysCountdown.textContent = "-- jours restants";
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  renderLibrary(filteredData = null) {
    const container = document.getElementById("library-container");
    if (!container) return;

    const data = filteredData || CROP_LIBRARY_DATA;

    if (data.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-8 text-slate-400">
          <p class="text-xs font-semibold">Aucune fiche ne correspond à votre recherche.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = data
      .map((crop) => {
        let typeBadge = "";
        if (crop.type === "Fruit") {
          typeBadge =
            '<span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/10">Fruits</span>';
        } else if (crop.type === "Bulbe") {
          typeBadge =
            '<span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/10">Bulbe</span>';
        } else {
          typeBadge =
            '<span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/10">Feuille</span>';
        }

        return `
        <div class="p-5 bg-white dark:bg-[#0B2112] border border-slate-100 dark:border-[#143E23]/30 rounded-3xl space-y-4 text-left shadow-sm flex flex-col justify-between hover:border-emerald-500/30 transition-all duration-200">
          <div class="space-y-3">
            <div class="flex justify-between items-start gap-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">${crop.emoji}</span>
                <div>
                  <h4 class="text-xs font-black text-slate-800 dark:text-white leading-tight">${crop.name}</h4>
                  <p class="text-[9px] text-[#819888] font-bold uppercase mt-0.5">${crop.variety}</p>
                </div>
              </div>
              ${typeBadge}
            </div>

            <div class="space-y-2 text-[11px] font-semibold border-t border-b border-slate-50 dark:border-[#143E23]/10 py-3">
              <div class="flex justify-between gap-1.5">
                <span class="text-slate-400">⏱️ Cycle:</span>
                <span class="text-slate-700 dark:text-slate-200 font-extrabold text-right">${crop.cycle}</span>
              </div>
              <div class="flex justify-between gap-1.5">
                <span class="text-slate-400">💧 Eau requis:</span>
                <span class="text-slate-700 dark:text-slate-200 font-extrabold text-right truncate max-w-[130px]" title="${crop.water}">${crop.water}</span>
              </div>
              <div class="flex justify-between gap-1.5">
                <span class="text-slate-400">📈 Rendement:</span>
                <span class="text-slate-700 dark:text-slate-200 font-extrabold text-right">${crop.yield}</span>
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-[8px] text-slate-400 uppercase tracking-wider block font-black">Conseils Pratiques (Sénégal)</span>
              <p class="text-[10px] text-slate-500 dark:text-slate-350 leading-relaxed font-semibold italic">"${crop.tips}"</p>
            </div>
          </div>

          <div class="pt-3 flex gap-1.5 border-t border-slate-50 dark:border-[#143E23]/10">
            <button onclick="window.prefillCropForm('${crop.name}', 'crop')" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1">
              <i data-lucide="plus" class="h-3 w-3"></i> Cultiver
            </button>
            <button onclick="window.prefillCropForm('${crop.name}', 'nursery')" class="flex-1 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-[#061109]/30 dark:hover:bg-[#061109]/60 text-emerald-500 border border-slate-250 dark:border-[#143E23]/20 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1">
              <i data-lucide="layers" class="h-3 w-3"></i> Pépinière
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  /**
   * Render the list of crops into the crops container, optionally filtering with provided array.
   * @param {Array} [filteredCrops=null] - Optional prefiltered crop list to render.
   * @function
   */
  renderCrops(filteredCrops = null) {
    const container = document.getElementById("crops-container");
    if (!container) return;

    const crops = filteredCrops || KAStorage.getCrops();

    if (crops.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-10 text-slate-400">
          <p class="text-xs font-bold">Aucune culture enregistrée ou aucun résultat de recherche.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = crops
      .map((crop) => {
        // Water badge
        const isDry = crop.waterStatus === "Besoin d'eau";
        const waterColor = isDry
          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
          : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        const waterIcon = isDry ? "droplet-off" : "droplet";

        // Fertilization badge
        const fertNeed = crop.fertilizerStatus !== "OK";
        const fertColor = fertNeed
          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
          : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

        // Sanitary status from recent photo or default sain
        const photos = crop.photos || [];
        let statusLabel = "🟢 Sain";
        let statusBadge = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

        if (photos.length > 0) {
          const lastPhoto = photos[0];
          if (lastPhoto.status === "Surveiller") {
            statusLabel = "🟡 À surveiller";
            statusBadge = "bg-amber-500/10 text-amber-500 border-amber-500/20";
          } else if (lastPhoto.status === "Alerte") {
            statusLabel = "🔴 Alerte / Maladie";
            statusBadge = "bg-rose-500/10 text-rose-500 border-rose-500/20";
          }
        }

        const seedType = crop.seedType || "Hybride F1 Certifiée";
        const season = crop.season || "Saison Sèche Froide";

        return `
        <div class="p-5 bg-white dark:bg-[#0B2112] border border-slate-100 dark:border-[#143E23]/30 rounded-3xl space-y-4 text-left shadow-sm">
          <div class="flex justify-between items-start gap-2">
            <div>
              <h3 class="text-sm font-black text-slate-800 dark:text-white">${crop.name}</h3>
              <p class="text-[10px] text-[#819888] font-bold mt-0.5 uppercase tracking-wider">${crop.field}</p>
            </div>
            <button onclick="window.deleteCrop('${crop.id}')" class="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#143E23]/20 transition-all cursor-pointer">
              <i data-lucide="trash-2" class="h-4 w-4"></i>
            </button>
          </div>

          <!-- Status & Season Row -->
          <div class="flex flex-wrap gap-2">
            <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-100 dark:border-[#143E23]/30 bg-slate-50 dark:bg-emerald-950/20 text-slate-600 dark:text-emerald-400">
              📊 ${crop.status}
            </span>
            <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${statusBadge}">
              🛡️ ${statusLabel}
            </span>
          </div>

          <!-- Season & Seed Badges -->
          <div class="flex flex-wrap gap-1.5 pt-1">
            <span class="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-550/10 text-amber-600 dark:text-amber-400 border border-amber-500/15">
              📅 ${season}
            </span>
            <span class="text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-550/10 text-cyan-600 dark:text-cyan-400 border border-cyan-550/15">
              🌱 ${seedType}
            </span>
          </div>

          <!-- Parameters Details -->
          <div class="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50 dark:border-[#143E23]/10 text-[11px] font-semibold">
            <div class="space-y-1">
              <p class="text-[9px] text-slate-400 uppercase tracking-wider">État hydrique</p>
              <button onclick="window.toggleWaterStatus('${crop.id}')" class="w-full flex items-center justify-between px-2 py-1 rounded border cursor-pointer transition-colors ${waterColor}">
                <span>${crop.waterStatus}</span>
                <i data-lucide="${waterIcon}" class="h-3 w-3"></i>
              </button>
            </div>
            <div class="space-y-1">
              <p class="text-[9px] text-slate-400 uppercase tracking-wider">Nutriments</p>
              <button onclick="window.toggleFertStatus('${crop.id}')" class="w-full flex items-center justify-between px-2 py-1 rounded border cursor-pointer transition-colors ${fertColor}">
                <span class="truncate">${crop.fertilizerStatus}</span>
                <i data-lucide="leaf" class="h-3 w-3"></i>
              </button>
            </div>
          </div>

          <!-- Dates -->
          <div class="pt-2 flex justify-between items-center text-[10px] text-slate-400 font-extrabold">
            <span>📅 Semis: ${crop.sowingDate}</span>
            <span>🎯 Récolte: ${crop.harvestDate}</span>
          </div>

          <!-- Diagnostic Action -->
          <div class="pt-3 border-t border-slate-50 dark:border-[#143E23]/10 flex gap-2">
            <button onclick="window.openSanitaryDiagnostics('${crop.id}')" class="w-full py-2 bg-slate-50 hover:bg-slate-100 dark:bg-[#061109]/35 dark:hover:bg-[#061109]/65 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs rounded-xl border border-slate-200 dark:border-[#143E23]/20 cursor-pointer flex items-center justify-center gap-1.5 transition-all">
              <i data-lucide="camera" class="h-3.5 w-3.5"></i> Diagnostic Sanitaire (${photos.length})
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }

    if (window.App && typeof window.App.updateBadges === "function") {
      window.App.updateBadges();
    }
  },

  /**
   * Render nurseries list into the nurseries container.
   * @function
   */
  renderNurseries() {
    const container = document.getElementById("nurseries-container");
    if (!container) return;

    const nurseries = KAStorage.getNurseries();

    if (nurseries.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-10 text-slate-450">
          <p class="text-xs font-bold">Aucune pépinière enregistrée.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = nurseries
      .map((n) => {
        let statusColor = "bg-[#061109]/40 border-slate-100 text-slate-600 dark:text-slate-400";
        if (n.status === "Prêt pour repiquage") {
          statusColor = "bg-emerald-500/10 border-emerald-500/20 text-emerald-500";
        }

        return `
        <div class="p-5 bg-white dark:bg-[#0B2112] border border-slate-100 dark:border-[#143E23]/30 rounded-3xl space-y-4 text-left shadow-sm">
          <div class="flex justify-between items-start gap-2">
            <div>
              <h3 class="text-sm font-black text-slate-800 dark:text-white">${n.name}</h3>
              <p class="text-[10px] text-[#819888] font-bold mt-0.5 uppercase tracking-wider">${n.cropType} • Est. ${n.quantityEst} plants</p>
            </div>
            <button onclick="window.deleteNursery('${n.id}')" class="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#143E23]/20 transition-all cursor-pointer">
              <i data-lucide="trash-2" class="h-4 w-4"></i>
            </button>
          </div>

          <div class="flex items-center justify-between text-[11px] font-semibold">
            <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${statusColor}">
              🌱 ${n.status}
            </span>
            <span class="text-[10px] text-[#819888] font-bold">❤️ ${n.healthStatus}</span>
          </div>

          <div class="pt-3 border-t border-slate-50 dark:border-[#143E23]/10 flex gap-2">
            <button onclick="window.nextNurseryStatus('${n.id}')" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5">
              <i data-lucide="arrow-right-circle" class="h-3.5 w-3.5"></i> Évoluer le stade
            </button>
          </div>

          <div class="pt-2 text-[10px] text-slate-400 font-extrabold flex justify-between">
            <span>📅 Semis: ${n.sowingDate}</span>
            <span>📍 Repiquage: ${n.plannedTransplantDate}</span>
          </div>
        </div>
      `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  setupListeners() {
    // Delete crop
    window.deleteCrop = (id) => {
      if (!confirm("Voulez-vous supprimer cette culture ?")) return;
      const crops = KAStorage.getCrops().filter((c) => c.id !== id);
      KAStorage.saveCrops(crops);
      this.renderCrops();
    };

    // Toggle water status
    window.toggleWaterStatus = (id) => {
      const crops = KAStorage.getCrops();
      const idx = crops.findIndex((c) => c.id === id);
      if (idx !== -1) {
        crops[idx].waterStatus =
          crops[idx].waterStatus === "Optimale" ? "Besoin d'eau" : "Optimale";
        KAStorage.saveCrops(crops);
        this.renderCrops();
      }
    };

    // Toggle fertilizer status
    window.toggleFertStatus = (id) => {
      const crops = KAStorage.getCrops();
      const idx = crops.findIndex((c) => c.id === id);
      if (idx !== -1) {
        const states = ["OK", "Besoin d'azote", "Besoin de potasse"];
        const curIdx = states.indexOf(crops[idx].fertilizerStatus);
        crops[idx].fertilizerStatus = states[(curIdx + 1) % states.length];
        KAStorage.saveCrops(crops);
        this.renderCrops();
      }
    };

    // Delete nursery
    window.deleteNursery = (id) => {
      if (!confirm("Voulez-vous supprimer cette pépinière ?")) return;
      const nurseries = KAStorage.getNurseries().filter((n) => n.id !== id);
      KAStorage.saveNurseries(nurseries);
      this.renderNurseries();
    };

    // Nursery status evolution
    window.nextNurseryStatus = (id) => {
      const nurseries = KAStorage.getNurseries();
      const idx = nurseries.findIndex((n) => n.id === id);
      if (idx !== -1) {
        const states = ["Semis", "Levée", "Prêt pour repiquage"];
        const curIdx = states.indexOf(nurseries[idx].status);
        if (curIdx < states.length - 1) {
          nurseries[idx].status = states[curIdx + 1];
        } else {
          // If already Ready, we can transplant it to crops!
          if (
            confirm(
              "Cette pépinière est prête. Voulez-vous la repiquer et l'ajouter aux planches de cultures actives ?"
            )
          ) {
            const crops = KAStorage.getCrops();
            const newCrop = {
              id: `C-${Date.now()}`,
              name: nurseries[idx].name,
              field: "Parcelle Ouest - Verger",
              sowingDate: nurseries[idx].sowingDate,
              harvestDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split("T")[0],
              seedType: "Locale Améliorée",
              season: "Saison Sèche Froide",
              status: "Croissance",
              waterStatus: "Optimale",
              fertilizerStatus: "OK",
              photos: [],
            };
            crops.unshift(newCrop);
            KAStorage.saveCrops(crops);

            // Remove nursery
            const updatedNurseries = nurseries.filter((n) => n.id !== id);
            KAStorage.saveNurseries(updatedNurseries);

            ErrorHandler.showToast("Pépinière transplantée avec succès !", "success");
            this.populateParcelOptions();
            this.renderCrops();
            this.renderNurseries();
            return;
          }
        }
        KAStorage.saveNurseries(nurseries);
        this.renderNurseries();
      }
    };

    window.onCropFieldChange = (val) => {
      const customContainer = document.getElementById("form-crop-field-custom-container");
      const customInput = document.getElementById("form-crop-field-custom");
      if (customContainer) {
        if (val === "custom") {
          customContainer.classList.remove("hidden");
          if (customInput) customInput.setAttribute("required", "true");
        } else {
          customContainer.classList.add("hidden");
          if (customInput) customInput.removeAttribute("required");
        }
      }
    };

    window.filterActiveCrops = () => {
      const query = document.getElementById("crops-search")?.value.toLowerCase().trim() || "";
      const filterField = document.getElementById("crops-filter-field")?.value || "all";
      const filterSeed = document.getElementById("crops-filter-seed")?.value || "all";
      const filterSeason = document.getElementById("crops-filter-season")?.value || "all";

      const crops = KAStorage.getCrops();

      const filtered = crops.filter((crop) => {
        const matchesQuery =
          crop.name.toLowerCase().includes(query) ||
          (crop.field && crop.field.toLowerCase().includes(query));

        const matchesField = filterField === "all" || crop.field === filterField;

        const matchesSeed =
          filterSeed === "all" || (crop.seedType || "Hybride F1 Certifiée") === filterSeed;

        const matchesSeason =
          filterSeason === "all" || (crop.season || "Saison Sèche Froide") === filterSeason;

        return matchesQuery && matchesField && matchesSeed && matchesSeason;
      });

      this.renderCrops(filtered);
    };

    // Crop submission
    const cropForm = document.getElementById("shared-crop-form");
    if (cropForm) {
      cropForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("form-crop-name").value;

        const fieldSelect = document.getElementById("form-crop-field-select");
        let field = fieldSelect ? fieldSelect.value : "";
        if (field === "custom") {
          field = document.getElementById("form-crop-field-custom")?.value || "Nouvelle Parcelle";
        }

        const sowing = document.getElementById("form-crop-sowing").value;
        const harvest = document.getElementById("form-crop-harvest").value;
        const seedType =
          document.getElementById("form-crop-seed-type")?.value || "Hybride F1 Certifiée";
        const season = document.getElementById("form-crop-season")?.value || "Saison Sèche Froide";

        if (!name || !field || !sowing || !harvest) return;

        const crops = KAStorage.getCrops();
        crops.unshift({
          id: `C-${Date.now()}`,
          name,
          field,
          sowingDate: sowing,
          harvestDate: harvest,
          seedType,
          season,
          status: "Semis",
          waterStatus: "Optimale",
          fertilizerStatus: "OK",
          photos: [],
        });

        KAStorage.saveCrops(crops);
        this.populateParcelOptions();
        this.renderCrops();
        cropForm.reset();

        const customContainer = document.getElementById("form-crop-field-custom-container");
        if (customContainer) customContainer.classList.add("hidden");

        // Hide modal
        document.getElementById("crop-form-modal").classList.add("hidden");
        ErrorHandler.showToast("Nouvelle planche de culture enregistrée !", "success");
      });
    }

    // Nursery submission
    const nurseryForm = document.getElementById("shared-nursery-form");
    if (nurseryForm) {
      nurseryForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("form-nursery-name").value;
        const cropType = document.getElementById("form-nursery-crop").value;
        const qty = parseInt(document.getElementById("form-nursery-qty").value);
        const sowing = document.getElementById("form-nursery-sowing").value;
        const transplant = document.getElementById("form-nursery-transplant").value;

        if (!name || !cropType || !qty || !sowing || !transplant) return;

        const nurseries = KAStorage.getNurseries();
        nurseries.unshift({
          id: `PEP-${Date.now()}`,
          name,
          cropType,
          sowingDate: sowing,
          plannedTransplantDate: transplant,
          quantityEst: qty,
          status: "Semis",
          healthStatus: "Excellent",
        });

        KAStorage.saveNurseries(nurseries);
        this.renderNurseries();
        nurseryForm.reset();

        // Hide modal
        document.getElementById("nursery-form-modal").classList.add("hidden");
        ErrorHandler.showToast("Nouvelle pépinière planifiée !", "success");
      });
    }

    // SANITARY COMPONENT ATTACHMENTS FOR CAMERA
    window.openSanitaryDiagnostics = (cropId) => {
      this.openSanitaryModal(cropId);
    };

    window.closeSanitaryModal = () => {
      document.getElementById("sanitary-modal").classList.add("hidden");
      this.stopLiveCamera();
    };

    window.startLiveCamera = () => {
      this.startLiveCamera();
    };

    window.captureLivePhoto = () => {
      this.captureLivePhoto();
    };

    window.resetSanitaryPhoto = () => {
      this.resetSanitaryPhoto();
    };

    window.handleSanitaryFile = (input) => {
      this.handleSanitaryFile(input);
    };

    window.saveSanitaryRecord = (event) => {
      this.saveSanitaryRecord(event);
    };

    window.deleteSanitaryRecord = (cropId, recordId) => {
      this.deleteSanitaryRecord(cropId, recordId);
    };

    window.analyzeSanitaryImage = () => {
      this.analyzeSanitaryImage();
    };

    // TREATMENT & DAR BINDINGS
    window.openTreatmentModal = () => {
      const modal = document.getElementById("treatment-modal");
      const cropSelect = document.getElementById("form-treat-crop");
      const dateInput = document.getElementById("form-treat-date");
      const productInput = document.getElementById("form-treat-product");
      const notesInput = document.getElementById("form-treat-notes");

      if (productInput) productInput.value = "";
      if (notesInput) notesInput.value = "";

      if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
      }

      if (cropSelect) {
        const crops = KAStorage.getCrops();
        if (crops.length === 0) {
          cropSelect.innerHTML = `<option value="">-- Aucune culture active --</option>`;
        } else {
          cropSelect.innerHTML = crops
            .map((c) => `<option value="${c.id}">${c.name} (${c.field})</option>`)
            .join("");
        }
      }

      // reset category and DAR to bio defaults
      const catSelect = document.getElementById("form-treat-category");
      if (catSelect) {
        catSelect.value = "bio-phytosanitaire";
        window.onTreatmentCategoryChange("bio-phytosanitaire");
      }

      if (modal) modal.classList.remove("hidden");
    };

    window.onTreatmentCategoryChange = (category) => {
      const darInput = document.getElementById("form-treat-dar");
      const label = document.getElementById("dar-suggest-label");
      if (!darInput) return;

      if (category === "bio-phytosanitaire") {
        darInput.value = 3;
        if (label) label.textContent = "Conseillé: 1-3j";
      } else if (category === "chimique-phytosanitaire") {
        darInput.value = 7;
        if (label) label.textContent = "Conseillé: 7-14j";
      } else if (category === "bio-engrais" || category === "chimique-engrais") {
        darInput.value = 0;
        if (label) label.textContent = "Conseillé: 0j";
      }
    };

    window.saveTreatmentRecord = (event) => {
      event.preventDefault();

      const cropId = document.getElementById("form-treat-crop").value;
      const category = document.getElementById("form-treat-category").value;
      const productName = document.getElementById("form-treat-product").value;
      const dateApplied = document.getElementById("form-treat-date").value;
      const dar = parseInt(document.getElementById("form-treat-dar").value) || 0;
      const notes = document.getElementById("form-treat-notes").value;

      if (!cropId || !productName || !dateApplied) {
        ErrorHandler.showToast("Veuillez remplir tous les champs obligatoires.", "error");
        return;
      }

      const crops = KAStorage.getCrops();
      const targetCrop = crops.find((c) => c.id === cropId);
      const cropName = targetCrop ? targetCrop.name : "Culture inconnue";

      const treatments = this.getTreatments();
      const newTreatment = {
        id: `TREAT-${Date.now()}`,
        cropId,
        cropName,
        category,
        productName,
        dateApplied,
        dar,
        notes,
      };

      treatments.unshift(newTreatment);
      localStorage.setItem("ka_farm_treatments", JSON.stringify(treatments));

      // Hide modal
      document.getElementById("treatment-modal").classList.add("hidden");

      // Notify & Render
      ErrorHandler.showToast("Traitement enregistré et DAR planifié !", "success");
      this.renderTreatments();
    };

    window.deleteTreatment = (id) => {
      if (!confirm("Voulez-vous supprimer ce traitement du registre ?")) return;
      const treatments = this.getTreatments().filter((t) => t.id !== id);
      localStorage.setItem("ka_farm_treatments", JSON.stringify(treatments));
      this.renderTreatments();
    };
  },

  // ==================== SANITARY MODULE METHODS ====================
  openSanitaryModal(cropId) {
    const modal = document.getElementById("sanitary-modal");
    const cropIdInput = document.getElementById("sanitary-crop-id");
    const titleSpan = document.getElementById("sanitary-modal-title");

    const crops = KAStorage.getCrops();
    const crop = crops.find((c) => c.id === cropId);
    if (!crop) return;

    cropIdInput.value = cropId;
    titleSpan.textContent = `Diagnostic Sanitaire - ${crop.name} (${crop.field})`;

    if (modal) modal.classList.remove("hidden");

    const form = document.getElementById("sanitary-form");
    if (form) form.reset();

    this.resetSanitaryPhoto();
    this.stopLiveCamera();
    this.renderSanitaryHistory(crop);
  },

  renderSanitaryHistory(crop) {
    const historyDiv = document.getElementById("sanitary-history");
    if (!historyDiv) return;

    const photos = crop.photos || [];
    if (photos.length === 0) {
      historyDiv.innerHTML = `
        <div class="text-center py-8 text-slate-400 dark:text-slate-500">
          <span class="text-3xl">📋</span>
          <p class="text-[11px] font-bold mt-2">Aucun historique sanitaire pour cette culture.</p>
          <p class="text-[9px] text-slate-450 mt-1">Prenez ou importez une photo à droite pour diagnostiquer.</p>
        </div>
      `;
      return;
    }

    historyDiv.innerHTML = photos
      .map((photo) => {
        let badgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        let statusLabel = "🟢 Sain";
        if (photo.status === "Surveiller") {
          badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
          statusLabel = "🟡 À surveiller";
        } else if (photo.status === "Alerte") {
          badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20";
          statusLabel = "🔴 Alerte / Maladie";
        }

        return `
        <div class="p-3 bg-slate-50 dark:bg-[#061109]/40 border border-slate-100 dark:border-emerald-950/30 rounded-2xl flex gap-3 items-start">
          <img src="${photo.imageUrl}" alt="Diagnostic" class="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-emerald-950 flex-shrink-0 cursor-pointer" onclick="window.viewFullSizePhoto('${photo.imageUrl}')">
          <div class="flex-grow space-y-1 text-left min-w-0">
            <div class="flex justify-between items-start">
              <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}">${statusLabel}</span>
              <button onclick="window.deleteSanitaryRecord('${crop.id}', '${photo.id}')" class="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer">
                <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
              </button>
            </div>
            <p class="text-[9px] text-slate-400 font-extrabold">${photo.date}</p>
            <p class="text-xs text-slate-700 dark:text-slate-300 font-semibold break-words leading-relaxed">${photo.notes || "Aucune observation."}</p>
          </div>
        </div>
      `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  async startLiveCamera() {
    const video = document.getElementById("sanitary-video");
    const placeholder = document.getElementById("sanitary-placeholder");
    const controls = document.getElementById("sanitary-camera-controls");
    const preview = document.getElementById("sanitary-preview");

    if (preview) preview.classList.add("hidden");
    if (placeholder) placeholder.classList.add("hidden");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      liveStream = stream;
      if (video) {
        video.srcObject = stream;
        video.classList.remove("hidden");
        video.play();
      }
      if (controls) controls.classList.remove("hidden");
    } catch (err) {
      ErrorHandler.log(err, "Crops.startLiveCamera");
      ErrorHandler.showToast(
        "Accès caméra direct indisponible. Veuillez utiliser le bouton 'Importer'.",
        "error"
      );
      if (placeholder) placeholder.classList.remove("hidden");
    }
  },

  stopLiveCamera() {
    const video = document.getElementById("sanitary-video");
    const controls = document.getElementById("sanitary-camera-controls");
    const placeholder = document.getElementById("sanitary-placeholder");

    if (liveStream) {
      liveStream.getTracks().forEach((track) => track.stop());
      liveStream = null;
    }

    if (video) {
      video.pause();
      video.srcObject = null;
      video.classList.add("hidden");
    }

    if (controls) controls.classList.add("hidden");
  },

  captureLivePhoto() {
    const video = document.getElementById("sanitary-video");
    const canvas = document.getElementById("sanitary-canvas");

    if (!video || !canvas) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    this.stopLiveCamera();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    this.compressAndStore(dataUrl);
  },

  handleSanitaryFile(input) {
    if (!input.files || !input.files[0]) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.compressAndStore(e.target.result);
    };
    reader.readAsDataURL(input.files[0]);
  },

  compressAndStore(rawBase64) {
    const preview = document.getElementById("sanitary-preview");
    const placeholder = document.getElementById("sanitary-placeholder");
    const resetBtn = document.getElementById("sanitary-reset-preview-btn");

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      const max_size = 600;
      if (width > height) {
        if (width > max_size) {
          height *= max_size / width;
          width = max_size;
        }
      } else {
        if (height > max_size) {
          width *= max_size / height;
          height = max_size;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.65);
      currentSanitaryBase64 = compressedDataUrl;

      if (preview) {
        preview.src = compressedDataUrl;
        preview.classList.remove("hidden");
      }
      if (placeholder) placeholder.classList.add("hidden");
      if (resetBtn) resetBtn.classList.remove("hidden");
    };
    img.src = rawBase64;
  },

  resetSanitaryPhoto() {
    const preview = document.getElementById("sanitary-preview");
    const placeholder = document.getElementById("sanitary-placeholder");
    const resetBtn = document.getElementById("sanitary-reset-preview-btn");
    const fileInput = document.getElementById("sanitary-file-input");

    currentSanitaryBase64 = "";
    if (fileInput) fileInput.value = "";

    if (preview) {
      preview.src = "";
      preview.classList.add("hidden");
    }
    if (resetBtn) resetBtn.classList.add("hidden");
    if (placeholder) placeholder.classList.remove("hidden");
  },

  saveSanitaryRecord(event) {
    event.preventDefault();
    const cropId = document.getElementById("sanitary-crop-id").value;
    const status = document.getElementById("sanitary-status-select").value;
    const notes = document.getElementById("sanitary-notes").value;

    if (!currentSanitaryBase64) {
      ErrorHandler.showToast("Veuillez d'abord capturer ou importer une photo.", "error");
      return;
    }

    const crops = KAStorage.getCrops();
    const cropIdx = crops.findIndex((c) => c.id === cropId);
    if (cropIdx === -1) return;

    const now = new Date();
    const options = {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    const formattedDate = now.toLocaleDateString("fr-FR", options);

    const newRecord = {
      id: `SAN-${Date.now()}`,
      date: formattedDate,
      imageUrl: currentSanitaryBase64,
      status,
      notes,
    };

    if (!crops[cropIdx].photos) {
      crops[cropIdx].photos = [];
    }

    crops[cropIdx].photos.unshift(newRecord);

    KAStorage.saveCrops(crops);
    this.renderCrops();
    this.renderSanitaryHistory(crops[cropIdx]);
    this.resetSanitaryPhoto();

    const notesTextarea = document.getElementById("sanitary-notes");
    if (notesTextarea) notesTextarea.value = "";

    ErrorHandler.showToast("Diagnostic sanitaire enregistré avec succès !", "success");
  },

  deleteSanitaryRecord(cropId, recordId) {
    if (!confirm("Veuillez confirmer la suppression de ce diagnostic.")) return;

    const crops = KAStorage.getCrops();
    const cropIdx = crops.findIndex((c) => c.id === cropId);
    if (cropIdx === -1) return;

    crops[cropIdx].photos = (crops[cropIdx].photos || []).filter((p) => p.id !== recordId);

    KAStorage.saveCrops(crops);
    this.renderCrops();
    this.renderSanitaryHistory(crops[cropIdx]);
  },

  async analyzeSanitaryImage() {
    if (!currentSanitaryBase64) {
      ErrorHandler.showToast("Veuillez d'abord capturer ou importer une photo.", "error");
      return;
    }

    if (!UserManager.canEditCrops()) {
      ErrorHandler.showToast("Accès refusé. Droits insuffisants pour le diagnostic IA.", "error");
      return;
    }

    const resultDiv = document.getElementById("sanitary-ai-result");
    const loadingDiv = document.getElementById("sanitary-ai-loading");
    const contentDiv = document.getElementById("sanitary-ai-content");
    const analyzeBtn = document.getElementById("sanitary-ai-analyze-btn");

    if (!resultDiv || !loadingDiv || !contentDiv || !analyzeBtn) return;

    try {
      analyzeBtn.disabled = true;
      resultDiv.classList.remove("hidden");
      loadingDiv.classList.remove("hidden");
      contentDiv.textContent = "";

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Diagnostique cette image de culture.",
          image: currentSanitaryBase64,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Erreur HTTP ${response.status}`);
      }

      if (data.text) {
        contentDiv.textContent = data.text;
      } else {
        contentDiv.textContent = "Aucun diagnostic retourné par l'IA.";
      }
    } catch (err) {
      logger.error("Error analyzing sanitary image", { error: err.message });
      contentDiv.textContent = `Erreur lors de l'analyse : ${err.message}`;
    } finally {
      loadingDiv.classList.add("hidden");
      analyzeBtn.disabled = false;
    }
  },

  updateCropsDarAlert() {
    const alertDiv = document.getElementById("crops-dar-alert");
    if (!alertDiv) return;

    const treatments = this.getTreatments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hasActiveDar = treatments.some((t) => {
      const applied = new Date(t.dateApplied);
      applied.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays < t.dar;
    });

    alertDiv.classList.toggle("hidden", !hasActiveDar);
  },

  getTreatments() {
    const defaultTreatments = [
      {
        id: "TREAT-1",
        cropId: "C-101",
        cropName: "Tomate Mongal F1",
        category: "bio-phytosanitaire",
        productName: "Purin de Neem (Insecticide bio)",
        dateApplied: "2026-06-25",
        dar: 3,
        notes: "Traitement foliaire contre la mouche blanche.",
      },
      {
        id: "TREAT-2",
        cropId: "C-102",
        cropName: "Oignon Rouge de Galmi",
        category: "bio-engrais",
        productName: "Compost Organique Bio",
        dateApplied: "2026-06-15",
        dar: 0,
        notes: "Amendement de fond mélangé lors du sarclage.",
      },
      {
        id: "TREAT-3",
        cropId: "C-104",
        cropName: "Chou Cabus",
        category: "chimique-phytosanitaire",
        productName: "Décis (Insecticide chimique)",
        dateApplied: "2026-06-23",
        dar: 7,
        notes: "Traitement curatif suite à l'alerte sur les chenilles.",
      },
    ];

    const saved = localStorage.getItem("ka_farm_treatments");
    if (!saved) {
      localStorage.setItem("ka_farm_treatments", JSON.stringify(defaultTreatments));
      return defaultTreatments;
    }
    return JSON.parse(saved);
  },

  renderTreatments() {
    const container = document.getElementById("treatments-container");
    if (!container) return;

    const treatments = this.getTreatments();

    // Update DAR alert visibility
    this.updateCropsDarAlert && this.updateCropsDarAlert();

    if (treatments.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-10 text-slate-450">
          <p class="text-xs font-bold">Aucun traitement ou fertilisation enregistré.</p>
        </div>
      `;
      return;
    }

    const categoryNames = {
      "bio-phytosanitaire": "🌿 Phytosanitaire Bio",
      "chimique-phytosanitaire": "⚠️ Chimique (Pesticide)",
      "bio-engrais": "🟤 Amendement Organique",
      "chimique-engrais": "🧪 Engrais Minéral",
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    container.innerHTML = treatments
      .map((t) => {
        const applied = new Date(t.dateApplied);
        applied.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - applied.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const daysRemaining = t.dar - diffDays;
        const isDARActive = daysRemaining > 0;

        // Status Styling
        const borderClass = isDARActive
          ? "border-rose-100 dark:border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10"
          : "border-emerald-100 dark:border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10";

        const badgeColor = isDARActive
          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
          : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

        const badgeText = isDARActive
          ? `⏳ DAR ACTIF: ${daysRemaining} j restant${daysRemaining > 1 ? "s" : ""}`
          : `✅ SAIN & SÉCURISÉ`;

        const instructionText = isDARActive
          ? `<p class="text-[10px] text-rose-500 font-extrabold flex items-center gap-1">🚫 RÉCOLTE INTERDITE (DAR en cours)</p>`
          : `<p class="text-[10px] text-emerald-500 font-extrabold flex items-center gap-1">🟢 PRÊT POUR LE MARCHÉ SÉNÉGALAIS 🇸🇳</p>`;

        const categoryLabel = categoryNames[t.category] || t.category;

        return `
        <div class="p-5 border rounded-3xl space-y-4 text-left shadow-sm flex flex-col justify-between ${borderClass}">
          <div class="space-y-3">
            <div class="flex justify-between items-start gap-2">
              <div>
                <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${badgeColor}">
                  ${badgeText}
                </span>
                <h3 class="text-sm font-black text-slate-800 dark:text-white mt-2">${t.productName}</h3>
                <p class="text-[10px] text-[#819888] font-extrabold uppercase tracking-wider mt-0.5">🌱 ${t.cropName}</p>
              </div>
              <button onclick="window.deleteTreatment('${t.id}')" class="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-[#143E23]/20 transition-all cursor-pointer">
                <i data-lucide="trash-2" class="h-4 w-4"></i>
              </button>
            </div>

            <!-- Parameters Details -->
            <div class="pt-3 border-t border-slate-50 dark:border-[#143E23]/10 space-y-2 text-[11px] font-semibold">
              <div class="flex justify-between">
                <span class="text-slate-400">Type de produit:</span>
                <span class="text-slate-700 dark:text-slate-300 font-bold">${categoryLabel}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Appliqué le:</span>
                <span class="text-slate-700 dark:text-slate-300 font-bold font-mono">${t.dateApplied}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Délai requis (DAR):</span>
                <span class="text-slate-700 dark:text-slate-300 font-bold font-mono">${t.dar} jour${t.dar > 1 ? "s" : ""}</span>
              </div>
            </div>

            ${
              t.notes
                ? `
            <div class="p-2.5 bg-white/40 dark:bg-black/20 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 font-medium italic">
              "${t.notes}"
            </div>
            `
                : ""
            }
          </div>

          <!-- Badge inférieur d'avertissement / sécurité -->
          <div class="pt-3 border-t border-slate-50 dark:border-[#143E23]/10 flex items-center justify-between">
            ${instructionText}
          </div>
        </div>
      `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },
};

// Assistant global de visualisation d'image
window.viewFullSizePhoto = (imgUrl) => {
  const viewer = document.createElement("div");
  viewer.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 cursor-zoom-out";
  viewer.innerHTML = `
    <div class="relative max-w-3xl max-h-[90vh]">
      <img src="${imgUrl}" class="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10">
      <p class="text-center text-xs text-white/60 mt-3 font-semibold">Cliquez n'importe où pour fermer</p>
    </div>
  `;
  viewer.onclick = () => viewer.remove();
  document.body.appendChild(viewer);
};

// Gestionnaires globaux pour la bibliothèque des fiches pratiques des cultures du Sénégal (Option 4)
window.filterLibraryCrops = () => {
  const query = document.getElementById("library-search")?.value.toLowerCase().trim() || "";
  const filterType = document.getElementById("library-filter")?.value || "all";

  const filtered = CROP_LIBRARY_DATA.filter((crop) => {
    const matchesSearch =
      crop.name.toLowerCase().includes(query) ||
      crop.variety.toLowerCase().includes(query) ||
      crop.tips.toLowerCase().includes(query) ||
      crop.water.toLowerCase().includes(query);

    const matchesType = filterType === "all" || crop.type === filterType;

    return matchesSearch && matchesType;
  });

  CropsModule.renderLibrary(filtered);
};

window.prefillCropForm = (cropName, destType) => {
  if (destType === "crop") {
    const nameInput = document.getElementById("form-crop-name");
    if (nameInput) nameInput.value = cropName;
    const modal = document.getElementById("crop-form-modal");
    if (modal) modal.classList.remove("hidden");
  } else {
    const nameInput = document.getElementById("form-nursery-name");
    const cropTypeInput = document.getElementById("form-nursery-crop");
    if (nameInput) nameInput.value = `Pépinière ${cropName}`;
    if (cropTypeInput) cropTypeInput.value = cropName;
    const modal = document.getElementById("nursery-form-modal");
    if (modal) modal.classList.remove("hidden");
  }
};

// Start crops module
document.addEventListener("DOMContentLoaded", () => {
  CropsModule.init();
});

document.addEventListener("ka_data_updated", (e) => {
  if (e.detail && (e.detail.key === "ka_farm_crops" || e.detail.key === "ka_farm_nurseries")) {
    CropsModule.renderCrops();
    CropsModule.renderNurseries();
    CropsModule.renderTreatments();
  }
});
