// KA Farm - Module des statistiques et de la vue d'ensemble du tableau de bord
import { KAStorage } from "../storage.js";
import { ErrorHandler } from "./error-handler.js";

export const DashboardModule = {
  init() {
    try {
      this.selectedZone = localStorage.getItem("ka_farm_zone") || "Dakar";
      this.render();
      this.setupListeners();
    } catch (err) {
      ErrorHandler.log(err, "DashboardModule.init");
    }
    this.setupGlobalSearch();

    // Redessiner le graphique D3 si le thème sombre/clair change
    window.onThemeChanged = (dark) => {
      this.renderBudgetChart();
    };
  },

  render() {
    let crops, tasks;
    try {
      crops = KAStorage.getCrops();
      tasks = KAStorage.getTasks();
    } catch (err) {
      ErrorHandler.log(err, "DashboardModule.render");
      return;
    }
    const nurseries = KAStorage.getNurseries();
    const stocks = KAStorage.getStocks();
    const finances = KAStorage.getFinances();

    // 1. Quantités
    const cropsCount = crops.length;
    const activeTasksCount = tasks.filter((t) => !t.completed).length;
    const nurseriesCount = nurseries.length;

    const cheptel = KAStorage.getCheptel ? KAStorage.getCheptel() : [];
    let totalCheptelCount = 0;
    cheptel.forEach((c) => (totalCheptelCount += parseInt(c.quantity) || 0));

    const elCrops = document.getElementById("stat-crops-count");
    const elTasks = document.getElementById("stat-tasks-count");
    const elNurseries = document.getElementById("stat-nurseries-count");
    const elCheptel = document.getElementById("stat-cheptel-count");

    if (elCrops) {
      if (window.animateValue) window.animateValue(elCrops, 0, cropsCount, 700);
      else elCrops.textContent = cropsCount;
    }
    if (elTasks) {
      if (window.animateValue) window.animateValue(elTasks, 0, activeTasksCount, 700);
      else elTasks.textContent = activeTasksCount;
    }
    if (elNurseries) {
      if (window.animateValue) window.animateValue(elNurseries, 0, nurseriesCount, 700);
      else elNurseries.textContent = nurseriesCount;
    }
    if (elCheptel) {
      if (window.animateValue) window.animateValue(elCheptel, 0, totalCheptelCount, 700);
      else elCheptel.textContent = totalCheptelCount;
    }

    // 2. Calcul financier centralisé
    const { totalRevenu, totalDepense, solde } = KAStorage.getFinanceStats();

    const elRevenu = document.getElementById("stat-total-revenu");
    const elDepense = document.getElementById("stat-total-depense");
    const elSolde = document.getElementById("stat-solde");

    if (elRevenu) {
      if (window.animateValue) window.animateValue(elRevenu, 0, totalRevenu, 900);
      else elRevenu.textContent = totalRevenu.toLocaleString("fr-FR") + " F";
    }
    if (elDepense) {
      if (window.animateValue) window.animateValue(elDepense, 0, totalDepense, 900);
      else elDepense.textContent = totalDepense.toLocaleString("fr-FR") + " F";
    }
    if (elSolde) {
      if (window.animateValue) window.animateValue(elSolde, 0, solde, 1100);
      else elSolde.textContent = solde.toLocaleString("fr-FR") + " F";
      if (solde >= 0) {
        elSolde.className = "text-xl md:text-2xl font-black text-emerald-400 font-mono mt-1";
      } else {
        elSolde.className = "text-xl md:text-2xl font-black text-rose-300 font-mono mt-1";
      }
    }

    // 3. Bannière d'alerte sur l'eau
    const hasDryCrop = crops.some((c) => c.waterStatus === "Besoin d'eau");
    const elWaterAlert = document.getElementById("dashboard-water-alert");
    if (elWaterAlert) {
      elWaterAlert.classList.toggle("hidden", !hasDryCrop);
    }

    // 3b. DAR alert banner
    const treatments = KAStorage.getTreatments ? KAStorage.getTreatments() : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeDarTreatments = treatments.filter((t) => {
      if (t.harvestReady) return false;
      const applied = new Date(t.dateApplied);
      applied.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays < t.dar;
    });
    const elDarAlert = document.getElementById("dashboard-dar-alert");
    if (elDarAlert) {
      elDarAlert.classList.toggle("hidden", activeDarTreatments.length === 0);
    }

    // 4. Quick Harvest summary list
    const harvestListContainer = document.getElementById("dash-harvest-list");
    if (harvestListContainer) {
      const harvestCrops = crops.filter((c) => c.status === "Récoltable");
      if (harvestCrops.length === 0) {
        harvestListContainer.innerHTML =
          '<p class="text-[11px] text-slate-400 font-bold py-1">Aucune culture récoltable actuellement.</p>';
      } else {
        harvestListContainer.innerHTML = harvestCrops
          .map(
            (c) => `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800/20">
            <span class="font-bold text-slate-700 dark:text-slate-300">🌱 ${c.name}</span>
            <span class="text-[9px] bg-emerald-550/10 text-emerald-600 dark:text-emerald-400 font-extrabold px-1.5 py-0.2 rounded-full uppercase">${c.field}</span>
          </div>
        `
          )
          .join("");
      }
    }

    // 5. Critical Low Stocks summary list
    const stockListContainer = document.getElementById("dash-stock-list");
    if (stockListContainer) {
      const lowStocks = stocks.filter((s) => s.quantity / s.maxQuantity <= 0.25);
      if (lowStocks.length === 0) {
        stockListContainer.innerHTML =
          '<p class="text-[11px] text-emerald-500 bg-emerald-500/5 px-2.5 py-1.5 rounded-lg font-bold">✅ Tous les stocks sont au-dessus du seuil critique.</p>';
      } else {
        stockListContainer.innerHTML = lowStocks
          .map(
            (s) => `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800/20">
            <span class="font-bold text-slate-750 dark:text-slate-300">📦 ${s.name}</span>
            <span class="text-[9px] text-rose-500 font-black">${s.quantity} / ${s.maxQuantity} ${s.unit}</span>
          </div>
        `
          )
          .join("");
      }
    }

    // 5b. Recent Livestock Production list
    const elevageProdContainer = document.getElementById("dash-elevage-production-list");
    if (elevageProdContainer) {
      const elevageProds = KAStorage.getElevageProduction ? KAStorage.getElevageProduction() : [];
      if (elevageProds.length === 0) {
        elevageProdContainer.innerHTML =
          '<p class="text-[11px] text-slate-400 font-bold py-1">Aucune production notée.</p>';
      } else {
        const recentProds = [...elevageProds]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 3);
        elevageProdContainer.innerHTML = recentProds
          .map(
            (p) => `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800/20">
            <span class="font-bold text-slate-750 dark:text-slate-300">${p.type === "Lait" ? "🥛" : "🥚"} ${p.type} (${p.date})</span>
            <span class="text-[10px] text-emerald-500 font-mono font-black">${p.quantity} ${p.unit}</span>
          </div>
        `
          )
          .join("");
      }
    }

    // 6. Recent Finances summary list
    const financesContainer = document.getElementById("dash-finances-list");
    if (financesContainer) {
      const recentFinances = finances.slice(0, 4);
      financesContainer.innerHTML = recentFinances
        .map((f) => {
          const isRevenu = f.type === "Revenu";
          const color = isRevenu ? "text-emerald-500" : "text-rose-500";
          const sign = isRevenu ? "+" : "-";
          return `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-50 dark:border-slate-800/20">
            <div>
              <p class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">${f.description}</p>
              <span class="text-[9px] text-slate-400">${f.date}</span>
            </div>
            <span class="font-extrabold font-mono ${color}">${sign}${f.amount.toLocaleString("fr-FR")} F</span>
          </div>
        `;
        })
        .join("");
    }

    // 7. Render local weather recommendations
    this.updateWeatherWidget();

    // 8. Visualisation D3.js du budget mensuel de l'exploitation
    this.renderBudgetChart();
  },

  async updateWeatherWidget() {
    const selector = document.getElementById("weather-selector");
    if (selector) {
      selector.value = this.selectedZone;
    }

    const cityDetails = window.WEATHER_RECOMMENDATIONS[this.selectedZone];
    if (!cityDetails) return;

    const elCityName = document.getElementById("weather-city-name");
    const elTemp = document.getElementById("weather-temp");
    const elHumid = document.getElementById("weather-humidity");
    const elPrecip = document.getElementById("weather-precipitation");
    const elCond = document.getElementById("weather-condition");
    const elAdvice = document.getElementById("weather-advice");

    // 1. Set fallback values instantly so the user has immediate visual feedback
    if (elCityName) elCityName.textContent = cityDetails.city;
    if (elTemp) elTemp.textContent = cityDetails.temp;
    if (elHumid) elHumid.textContent = cityDetails.humidity;
    if (elPrecip) elPrecip.textContent = cityDetails.precipitation || "0.0 mm";
    if (elCond) elCond.textContent = cityDetails.condition;
    if (elAdvice) elAdvice.textContent = cityDetails.advice;

    // 2. Fetch real weather data asynchronously via our proxy API
    if (cityDetails.lat && cityDetails.lon) {
      // Add a subtle opacity effect during loading to show that something is happening
      const weatherGrid = elTemp?.parentElement?.parentElement;
      if (weatherGrid) {
        weatherGrid.classList.add("opacity-75", "transition-opacity");
      }

      try {
        const response = await fetch(`/api/weather?lat=${cityDetails.lat}&lon=${cityDetails.lon}`);
        if (!response.ok) throw new Error("Failed to fetch real-time weather");

        const realData = await response.json();

        // Update DOM with live values from API if they exist and are valid numbers/strings
        if (realData) {
          if (elTemp) {
            const tempVal =
              typeof realData.temp === "number"
                ? realData.temp.toFixed(1)
                : realData.temp || cityDetails.temp;
            elTemp.innerHTML = `${tempVal}${String(tempVal).includes("°C") ? "" : "°C"} <span class="text-[9px] text-emerald-500 font-extrabold uppercase align-super ml-0.5">Live</span>`;
          }

          if (elHumid) {
            const humidVal =
              typeof realData.humidity === "number"
                ? realData.humidity
                : realData.humidity || cityDetails.humidity;
            elHumid.innerHTML = `${humidVal}${String(humidVal).includes("%") ? "" : "%"} <span class="text-[9px] text-emerald-500 font-extrabold uppercase align-super ml-0.5">Live</span>`;
          }

          if (elPrecip) {
            const precipVal =
              typeof realData.precipitation === "number"
                ? realData.precipitation.toFixed(1)
                : realData.precipitation || cityDetails.precipitation || "0.0";
            elPrecip.innerHTML = `${precipVal}${String(precipVal).includes("mm") ? "" : " mm"} <span class="text-[9px] text-emerald-500 font-extrabold uppercase align-super ml-0.5">Live</span>`;
          }
        }

        // Map WMO weather codes to human-readable text
        const getConditionText = (code) => {
          if (code === 0) return "Ensoleillé";
          if (code >= 1 && code <= 3) return "Partiellement nuageux";
          if (code === 45 || code === 48) return "Brouillard";
          if (code >= 51 && code <= 55) return "Bruine légère";
          if (code >= 61 && code <= 65) return "Pluie en cours";
          if (code >= 80 && code <= 82) return "Averses";
          if (code >= 95) return "Orages";
          return cityDetails.condition; // fallback
        };

        if (
          elCond &&
          realData &&
          realData.weather_code !== undefined &&
          realData.weather_code !== null
        ) {
          elCond.textContent = getConditionText(realData.weather_code);
        }

        // Dynamically adjust Advice based on actual live precipitation, wind, and temperature!
        if (elAdvice && realData) {
          const livePrecip =
            typeof realData.precipitation === "number"
              ? realData.precipitation
              : parseFloat(realData.precipitation) || 0;
          const liveTemp =
            typeof realData.temp === "number" ? realData.temp : parseFloat(realData.temp) || 0;
          const liveHumid =
            typeof realData.humidity === "number"
              ? realData.humidity
              : parseFloat(realData.humidity) || 0;
          const liveWind =
            typeof realData.wind_speed === "number"
              ? realData.wind_speed
              : parseFloat(realData.wind_speed) || 0;

          if (livePrecip > 0.5) {
            elAdvice.innerHTML = `🌧️ <span class="text-sky-500 font-extrabold uppercase">Alerte Pluies (${livePrecip.toFixed(1)} mm)</span> : Précipitations mesurées. <strong>L'arrosage est inutile / à suspendre absolument</strong> pour éviter le lessivage des sols et économiser le carburant du forage !`;
          } else if (liveWind > 15 && liveHumid < 45) {
            elAdvice.innerHTML = `💨 <span class="text-amber-500 font-extrabold uppercase">Alerte Harmattan (Vent Sec)</span> : Vent desséchant de ${liveWind.toFixed(1)} km/h avec humidité basse (${liveHumid}%). <strong>Arrosage indispensable et régulier</strong> avec renforcement du paillage organique pour protéger les racines !`;
          } else if (liveTemp > 32) {
            elAdvice.innerHTML = `🔥 <span class="text-rose-500 font-extrabold uppercase">Alerte Forte Chaleur (${liveTemp.toFixed(1)}°C)</span> : Canicule intense. L'évapotranspiration est critique. <strong>Activez un arrosage d'appoint de 30 minutes par vanne</strong> exclusivement tôt le matin ou après 17h !`;
          } else if (liveHumid > 80) {
            elAdvice.innerHTML = `💧 <span class="text-emerald-500 font-extrabold uppercase">Humidité Élevée (${liveHumid}%)</span> : Humidité de l'air saturée. <strong>Limitez l'irrigation foliaire</strong> de fin de journée pour prévenir l'apparition du mildiou et de la pourriture racinaire sur les oignons et tomates.`;
          } else {
            elAdvice.textContent = cityDetails.advice; // Use preset recommendation for normal conditions
          }
        }
      } catch (err) {
        ErrorHandler.log(err, "DashboardModule.updateWeatherWidget", "warn");
      } finally {
        if (weatherGrid) {
          weatherGrid.classList.remove("opacity-75");
        }
      }
    }
  },

  setupListeners() {
    const selector = document.getElementById("weather-selector");
    if (selector) {
      selector.addEventListener("change", (e) => {
        this.selectedZone = e.target.value;
        localStorage.setItem("ka_farm_zone", this.selectedZone);
        this.updateWeatherWidget();

        // Also update settings page selector value if we have a settings sync
        const settingsZone = document.getElementById("settings-zone-selector");
        if (settingsZone) settingsZone.value = this.selectedZone;
      });
    }
  },

  setupGlobalSearch() {
    const searchInput = document.getElementById("global-search-input");
    const dropdown = document.getElementById("global-search-dropdown");
    const resultsContainer = document.getElementById("global-search-results");
    const clearBtn = document.getElementById("global-search-clear");
    const searchBadge = document.getElementById("search-badge");

    if (!searchInput || !dropdown || !resultsContainer) return;

    const performSearch = () => {
      const query = searchInput.value.toLowerCase().trim();

      if (!query) {
        dropdown.classList.add("hidden");
        if (clearBtn) clearBtn.classList.add("hidden");
        if (searchBadge) searchBadge.classList.remove("hidden");
        return;
      }

      if (clearBtn) clearBtn.classList.remove("hidden");
      if (searchBadge) searchBadge.classList.add("hidden");

      const parcelles = KAStorage.getParcelles() || [];
      const stocks = KAStorage.getStocks() || [];
      const cropLibrary = KAStorage.getCropLibrary() || [];

      // Filter parcelles
      const matchingParcelles = parcelles.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(query) ||
          (p.currentCrop || "").toLowerCase().includes(query) ||
          (p.status || "").toLowerCase().includes(query)
      );

      // Filter stocks
      const matchingStocks = stocks.filter(
        (s) =>
          (s.name || "").toLowerCase().includes(query) ||
          (s.category || "").toLowerCase().includes(query)
      );

      // Filter crop library
      const matchingCrops = cropLibrary.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(query) ||
          (c.variety || "").toLowerCase().includes(query) ||
          (c.tips || "").toLowerCase().includes(query)
      );

      const totalResultsCount =
        matchingParcelles.length + matchingStocks.length + matchingCrops.length;

      if (totalResultsCount === 0) {
        resultsContainer.innerHTML = `
          <div class="p-6 text-center text-slate-400 dark:text-slate-500">
            <i data-lucide="alert-circle" class="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600 mb-2"></i>
            <p class="text-xs font-bold">Aucun résultat trouvé pour "${searchInput.value}"</p>
            <p class="text-[10px] mt-0.5">Essayez avec un autre mot-clé (ex: Tomate, Oignon, Parcelle, Compost...)</p>
          </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        dropdown.classList.remove("hidden");
        return;
      }

      let html = "";

      // Render Parcelles Section
      if (matchingParcelles.length > 0) {
        html += matchingParcelles
          .map(
            (p) => `
          <a href="/pages/shared/parcelles.html?id=${p.id}" class="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#143E23]/25 transition-all duration-150 border-b border-slate-50 dark:border-[#143E23]/10">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 bg-sky-500/10 text-sky-500 rounded-xl flex items-center justify-center font-bold">
                🗺️
              </div>
              <div>
                <p class="text-xs font-black text-slate-800 dark:text-white">${p.name}</p>
                <p class="text-[10px] text-[#819888] font-extrabold uppercase mt-0.5">🌾 Culture : ${p.currentCrop || "Aucune"}</p>
              </div>
            </div>
            <span class="text-[9px] bg-sky-500/10 text-sky-500 border border-sky-500/10 font-extrabold uppercase px-2 py-0.5 rounded-full">Parcelle</span>
          </a>
        `
          )
          .join("");
      }

      // Render Stocks Section
      if (matchingStocks.length > 0) {
        html += matchingStocks
          .map(
            (s) => `
          <a href="/pages/shared/stocks.html?search=${encodeURIComponent(s.name)}" class="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#143E23]/25 transition-all duration-150 border-b border-slate-50 dark:border-[#143E23]/10">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center font-bold">
                📦
              </div>
              <div>
                <p class="text-xs font-black text-slate-800 dark:text-white">${s.name}</p>
                <p class="text-[10px] text-slate-400 font-semibold mt-0.5">Quantité : ${s.quantity} / ${s.maxQuantity} ${s.unit}</p>
              </div>
            </div>
            <span class="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/10 font-extrabold uppercase px-2 py-0.5 rounded-full">Stock</span>
          </a>
        `
          )
          .join("");
      }

      // Render Crops Library Section
      if (matchingCrops.length > 0) {
        html += matchingCrops
          .map(
            (c) => `
          <a href="/pages/shared/crops.html?search=${encodeURIComponent(c.name)}" class="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-[#143E23]/25 transition-all duration-150 border-b border-slate-50 dark:border-[#143E23]/10">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center text-sm">
                ${c.emoji || "🍅"}
              </div>
              <div>
                <p class="text-xs font-black text-slate-800 dark:text-white">${c.name}</p>
                <p class="text-[10px] text-[#819888] font-extrabold uppercase mt-0.5">${c.variety}</p>
              </div>
            </div>
            <span class="text-[9px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/10 font-extrabold uppercase px-2 py-0.5 rounded-full">Fiche</span>
          </a>
        `
          )
          .join("");
      }

      resultsContainer.innerHTML = html;
      dropdown.classList.remove("hidden");
    };

    searchInput.addEventListener("input", performSearch);
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim()) {
        dropdown.classList.remove("hidden");
      }
    });

    document.addEventListener("click", (e) => {
      if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dropdown.classList.add("hidden");
        searchInput.blur();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        dropdown.classList.add("hidden");
        clearBtn.classList.add("hidden");
        if (searchBadge) searchBadge.classList.remove("hidden");
        searchInput.focus();
      });
    }
  },

  renderBudgetChart() {
    const svgEl = document.getElementById("budget-donut-chart");
    if (!svgEl) return;

    // Vider les anciens éléments du SVG
    svgEl.innerHTML = "";

    // 1. Récupérer les données réelles de l'exploitation
    const finances = KAStorage.getFinances() || [];
    const payments = KAStorage.getEmployeePayments() || [];
    const healthInterventions = KAStorage.get("ka_farm_elevage_health", []) || [];

    // On se base sur le mois simulé "2026-06" (mois actuel du tableau de bord)
    const currentMonthStr = "2026-06";

    // Agrégations financières dynamiques
    let salaires = 0;
    payments.forEach((p) => {
      if (p.date && p.date.startsWith(currentMonthStr) && p.status === "Payé") {
        salaires += Number(p.amount) || 0;
      }
    });

    let santeElevage = 0;
    healthInterventions.forEach((h) => {
      if (h.date && h.date.startsWith(currentMonthStr)) {
        santeElevage += Number(h.cost) || 0;
      }
    });

    let semences = 0;
    let compost = 0;
    let irrigation = 0;
    let divers = 0;

    finances.forEach((f) => {
      if (f.type === "Dépense" && f.date && f.date.startsWith(currentMonthStr)) {
        const amt = Number(f.amount) || 0;
        const cat = (f.category || "").toLowerCase();
        if (cat.includes("semence")) {
          semences += amt;
        } else if (cat.includes("compost") || cat.includes("amendement")) {
          compost += amt;
        } else if (cat.includes("irrigation") || cat.includes("eau") || cat.includes("carburant")) {
          irrigation += amt;
        } else {
          divers += amt;
        }
      }
    });

    // Liste des catégories budgétaires avec couleurs premium harmonisées
    let data = [
      { label: "Salaires Ouvriers", amount: salaires, color: "#10B981", icon: "users" }, // emerald-500
      { label: "Compost & Amendements", amount: compost, color: "#8B5CF6", icon: "leaf" }, // purple-500
      { label: "Achat de Semences", amount: semences, color: "#3B82F6", icon: "sprout" }, // blue-500
      {
        label: "Santé Élevage & Véto",
        amount: santeElevage,
        color: "#EC4899",
        icon: "heart-pulse",
      }, // pink-500
      { label: "Irrigation & Énergie", amount: irrigation, color: "#06B6D4", icon: "droplet" }, // cyan-500
      { label: "Divers & Autres", amount: divers, color: "#F59E0B", icon: "package" }, // amber-500
    ];

    // Ne conserver que les catégories avec des dépenses actives (> 0)
    data = data.filter((d) => d.amount > 0);

    // Solution de repli si aucune dépense réelle n'est présente dans le cache
    if (data.length === 0) {
      data = [
        { label: "Salaires Ouvriers", amount: 350000, color: "#10B981", icon: "users" },
        { label: "Compost & Amendements", amount: 50000, color: "#8B5CF6", icon: "leaf" },
        { label: "Achat de Semences", amount: 35000, color: "#3B82F6", icon: "sprout" },
        { label: "Santé Élevage & Véto", amount: 23000, color: "#EC4899", icon: "heart-pulse" },
      ];
    }

    const total = d3.sum(data, (d) => d.amount);

    // Mettre à jour le texte du total au centre
    const totalEl = document.getElementById("budget-chart-total");
    if (totalEl) {
      totalEl.textContent = total.toLocaleString("fr-FR") + " F";
    }

    // Configuration des dimensions du donut D3.js
    const width = 200;
    const height = 200;
    const radius = Math.min(width, height) / 2;
    const donutWidth = 24; // Épaisseur de l'anneau

    // Création de l'élément G de base dans le SVG existant
    const svg = d3
      .select("#budget-donut-chart")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Arcs pour l'état normal et l'état de survol (effet ressort/pop)
    const arc = d3
      .arc()
      .innerRadius(radius - donutWidth)
      .outerRadius(radius);

    const arcHover = d3
      .arc()
      .innerRadius(radius - donutWidth - 4)
      .outerRadius(radius + 4);

    const pie = d3
      .pie()
      .value((d) => d.amount)
      .sort(null); // Conserver l'ordre pour l'harmonie des couleurs

    const isDark = document.documentElement.classList.contains("dark");
    const strokeColor = isDark ? "#0B2112" : "#ffffff";

    // Tracé des secteurs
    const path = svg
      .selectAll("path")
      .data(pie(data))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      .attr("class", "cursor-pointer transition-all duration-300")
      .style("stroke", strokeColor)
      .style("stroke-width", "2px");

    // Animation d'entrée interpolée (effet de croissance circulaire sur 1s)
    path
      .transition()
      .duration(1000)
      .attrTween("d", (d) => {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function (t) {
          return arc(interpolate(t));
        };
      });

    // Gestionnaires d'interactions interactives
    path
      .on("mouseover", function (event, d) {
        // Agrandir le secteur survolé
        d3.select(this).transition().duration(200).attr("d", arcHover);

        // Mettre à jour les statistiques au centre du donut
        if (totalEl) {
          const pct = Math.round((d.data.amount / total) * 100);
          totalEl.innerHTML = `
          <span class="text-[9px] text-emerald-500 font-extrabold truncate max-w-[85px] block leading-tight">${d.data.label}</span>
          <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white font-mono leading-none">${d.data.amount.toLocaleString("fr-FR")} F</span>
          <span class="text-[9px] text-slate-400 dark:text-slate-500 font-bold block">(${pct}%)</span>
        `;
        }

        // Mettre en surbrillance visuelle la ligne correspondante de la légende
        const legendRow = document.getElementById(`legend-${d.index}`);
        if (legendRow) {
          legendRow.className =
            "flex items-center justify-between p-1.5 rounded-xl bg-slate-100 dark:bg-emerald-950/40 border border-slate-250 dark:border-emerald-500/20 transform scale-[1.015] transition-all duration-200 shadow-sm";
        }
      })
      .on("mouseout", function (event, d) {
        // Revenir à l'arc standard
        d3.select(this).transition().duration(200).attr("d", arc);

        // Restaurer le total global
        if (totalEl) {
          totalEl.innerHTML = `
          <span class="text-[8px] text-slate-400 dark:text-[#819888] font-bold uppercase tracking-wider block">Total</span>
          <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white font-mono leading-none">${total.toLocaleString("fr-FR")} F</span>
        `;
        }

        // Restaurer le style normal de la ligne de légende
        const legendRow = document.getElementById(`legend-${d.index}`);
        if (legendRow) {
          legendRow.className =
            "flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#0D2615]/30 border border-transparent transition-all duration-200";
        }
      });

    // Génération de la légende dynamique personnalisable
    const legendContainer = document.getElementById("budget-legend");
    if (legendContainer) {
      legendContainer.innerHTML = data
        .map((d, index) => {
          const pct = Math.round((d.amount / total) * 100);
          return `
          <div id="legend-${index}" class="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#0D2615]/30 border border-transparent transition-all duration-200 cursor-pointer">
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full flex-shrink-0" style="background-color: ${d.color}"></span>
              <span class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${d.label}</span>
            </div>
            <div class="text-right flex items-center gap-1.5 font-mono">
              <span class="text-[11px] font-black text-slate-800 dark:text-slate-100">${d.amount.toLocaleString("fr-FR")} F</span>
              <span class="text-[9px] text-slate-400 dark:text-[#819888] font-semibold">(${pct}%)</span>
            </div>
          </div>
        `;
        })
        .join("");

      // Lier également le survol de la légende pour animer le secteur D3 correspondant
      data.forEach((d, index) => {
        const legendRow = document.getElementById(`legend-${index}`);
        if (legendRow) {
          legendRow.addEventListener("mouseover", () => {
            path
              .filter((p, i) => i === index)
              .transition()
              .duration(200)
              .attr("d", arcHover);

            if (totalEl) {
              const pct = Math.round((d.amount / total) * 100);
              totalEl.innerHTML = `
                <span class="text-[9px] text-emerald-500 font-extrabold truncate max-w-[85px] block leading-tight">${d.label}</span>
                <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white font-mono leading-none">${d.amount.toLocaleString("fr-FR")} F</span>
                <span class="text-[9px] text-slate-400 dark:text-slate-500 font-bold block">(${pct}%)</span>
              `;
            }

            legendRow.className =
              "flex items-center justify-between p-1.5 rounded-xl bg-slate-100 dark:bg-emerald-950/40 border border-slate-250 dark:border-emerald-500/20 transform scale-[1.015] transition-all duration-200 shadow-sm";
          });

          legendRow.addEventListener("mouseout", () => {
            path
              .filter((p, i) => i === index)
              .transition()
              .duration(200)
              .attr("d", arc);

            if (totalEl) {
              totalEl.innerHTML = `
                <span class="text-[8px] text-slate-400 dark:text-[#819888] font-bold uppercase tracking-wider block">Total</span>
                <span class="text-xs sm:text-sm font-black text-slate-800 dark:text-white font-mono leading-none">${total.toLocaleString("fr-FR")} F</span>
              `;
            }

            legendRow.className =
              "flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#0D2615]/30 border border-transparent transition-all duration-200";
          });
        }
      });
    }
  },
};

// Start dashboard module
document.addEventListener("DOMContentLoaded", () => {
  DashboardModule.init();
});

// Live update listener from cloud database
document.addEventListener("ka_data_updated", () => {
  DashboardModule.init();
});
