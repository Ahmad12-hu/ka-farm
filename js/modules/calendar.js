// KA Farm - Agricultural Calendar & Dynamic Task Reminders Module
import { KAStorage } from "../storage.js";
import { ErrorHandler } from "./error-handler.js";

const currentDate = new Date();
let selectedYear = currentDate.getFullYear();
let selectedMonth = currentDate.getMonth();

const MONTHS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

// Local Senegal Crop Parameters
const CROP_METADATA = {
  "Tomate Mongal F1": {
    cycleDays: 95,
    wateringFreq: "Tous les 2 jours",
    milestones: [
      {
        name: "Levée & Soins Pépinière",
        days: 7,
        desc: "Surveiller l'apparition des pousses et arroser délicatement le matin.",
        icon: "droplet",
      },
      {
        name: "Repiquage en Planche",
        days: 30,
        desc: "Sélectionner les plants robustes et transplanter avec un apport de compost.",
        icon: "arrow-up-right",
      },
      {
        name: "Tuteurage & Floraison",
        days: 60,
        desc: "Poser les tuteurs et surveiller les acariens et la mouche blanche.",
        icon: "flower",
      },
      {
        name: "Début Récolte estimé",
        days: 95,
        desc: "Récolter au stade rouge/orangé pour le transport au marché.",
        icon: "shopping-bag",
      },
    ],
    seasonalAdvice: {
      Froid: "Saison idéale (Nov-Fév). Excellente nouaison des fruits et risque réduit de mildiou.",
      Chaud:
        "Saison critique (Mar-Juin). Fort ensoleillement, risque de brûlure des fruits, ombrage recommandé.",
      Hivernage:
        "Saison humide (Juil-Oct). Risque de maladies cryptogamiques élevé, drainer soigneusement les planches.",
    },
  },
  "Oignon Rouge de Galmi": {
    cycleDays: 150,
    wateringFreq: "Tous les 3 jours",
    milestones: [
      {
        name: "Levée des semis",
        days: 10,
        desc: "Garder la pépinière propre et exempte de mauvaises herbes.",
        icon: "sprout",
      },
      {
        name: "Repiquage de fond",
        days: 45,
        desc: "Couper le tiers supérieur des feuilles et installer en ligne à 10cm.",
        icon: "arrow-down-to-dot",
      },
      {
        name: "Bulbaison & Sarclage",
        days: 100,
        desc: "Sarcler à la main pour libérer le bulbe et favoriser sa croissance.",
        icon: "shield",
      },
      {
        name: "Séchage & Récolte",
        days: 150,
        desc: "Casser les tiges au sol et récolter. Arrêter l'arrosage 15j avant.",
        icon: "combine",
      },
    ],
    seasonalAdvice: {
      Froid: "Saison optimale. Le froid favorise une superbe qualité de bulbe de Galmi.",
      Chaud: "Saison moyenne. Arrosage accru requis pour compenser l'évapotranspiration.",
      Hivernage: "Déconseillé. Risque élevé de pourriture racinaire et de fonte des semis.",
    },
  },
  "Chou Cabus": {
    cycleDays: 90,
    wateringFreq: "Tous les 2 jours",
    milestones: [
      {
        name: "Pépinière",
        days: 6,
        desc: "Arrosage quotidien sans excès pour éviter la fonte des semis.",
        icon: "droplet",
      },
      {
        name: "Repiquage vigoureux",
        days: 25,
        desc: "Transplanter à 40cm d'intervalle. Apporter de la fumure azotée.",
        icon: "expand",
      },
      {
        name: "Pomaison",
        days: 65,
        desc: "Début de la formation de la pomme. Surveillance stricte des chenilles.",
        icon: "alert-circle",
      },
      {
        name: "Récolte ferme",
        days: 90,
        desc: "Couper les pommes fermes au ras du sol avec un couteau propre.",
        icon: "check",
      },
    ],
    seasonalAdvice: {
      Froid: "Idéal (Nov-Jan). Températures douces propices à de belles pommes de chou fermes.",
      Chaud: "Difficile. Sensibilité accrue aux ravageurs et montée en graine précoce.",
      Hivernage:
        "Risques sanitaires intenses. Traitement préventif bio-phytosanitaire obligatoire.",
    },
  },
  "Menthe de Thiès": {
    cycleDays: 45,
    wateringFreq: "Quotidien",
    milestones: [
      {
        name: "Reprise des éclats",
        days: 8,
        desc: "Repiquer des éclats de racines saines dans un sol humide.",
        icon: "link-2",
      },
      {
        name: "Ramification",
        days: 25,
        desc: "Pincer les têtes pour stimuler le développement des tiges secondaires.",
        icon: "scissors",
      },
      {
        name: "Récolte récurrente",
        days: 45,
        desc: "Couper la menthe régulièrement pour une repousse vigoureuse.",
        icon: "scissors-line-dashed",
      },
    ],
    seasonalAdvice: {
      Froid: "Bonne croissance. Protéger des vents desséchants de l'Est (Harmattan).",
      Chaud:
        "Arrosage biquotidien indispensable. La menthe adore la chaleur si elle a assez d'eau.",
      Hivernage: "Excellente période. Veiller juste au désherbage car la menthe est vite envahie.",
    },
  },
  "Papayer Solo": {
    cycleDays: 270,
    wateringFreq: "Tous les 3 jours",
    milestones: [
      {
        name: "Germination sachet",
        days: 15,
        desc: "Semer en sachets individuels sous ombrage partiel.",
        icon: "container",
      },
      {
        name: "Mise en place verger",
        days: 60,
        desc: "Planter à 3m de distance en cuvettes profondes avec fumier de fond.",
        icon: "map-pin",
      },
      {
        name: "Floraison & Sexage",
        days: 150,
        desc: "Identifier les fleurs femelles/hermaphrodites. Éliminer les mâles en excès.",
        icon: "flower-2",
      },
      {
        name: "Premières Récoltes",
        days: 270,
        desc: "Récolte des papayes dès l'apparition des premières stries jaunes.",
        icon: "carrot",
      },
    ],
    seasonalAdvice: {
      Froid: "Croissance ralentie par les températures nocturnes plus basses.",
      Chaud: "Développement rapide des fruits. Veiller à pailler le pied pour retenir l'eau.",
      Hivernage: "Attention à la pourriture du collet. Créer des buttes de surélévation.",
    },
  },
};

export const CalendarModule = {
  init() {
    try {
      this.renderMonthCalendar();
      this.renderSuggestedReminders();
      this.populatePlanificationModal();
      this.setupListeners();
      this.checkUpcomingAlerts();
    } catch (err) {
      ErrorHandler.log(err, "CalendarModule.init");
    }
  },

  // Renders the monthly grid
  renderMonthCalendar() {
    const grid = document.getElementById("calendar-days-grid");
    const header = document.getElementById("calendar-month-year");
    if (!grid || !header) return;

    header.textContent = `${MONTHS_FR[selectedMonth]} ${selectedYear}`;

    // Clear previous
    grid.innerHTML = "";

    // First day of selected month
    const firstDayIndex = (new Date(selectedYear, selectedMonth, 1).getDay() + 6) % 7; // Monday is 0, Sunday is 6
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const prevMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();

    const crops = KAStorage.getCrops();
    const tasks = KAStorage.getTasks();

    // 1. Fill previous month tail days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      grid.appendChild(this.createDayElement(dayNum, true, [], false));
    }

    // 2. Fill current month days
    const today = new Date();
    const isCurrentMonthYear =
      today.getFullYear() === selectedYear && today.getMonth() === selectedMonth;
    const todayDate = today.getDate();

    for (let day = 1; day <= totalDays; day++) {
      const dateString = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const events = this.getEventsForDate(dateString, crops, tasks);
      const isToday = isCurrentMonthYear && day === todayDate;

      grid.appendChild(this.createDayElement(day, false, events, isToday));
    }

    // 3. Fill next month head days to complete 42-day calendar grid
    const totalRendered = firstDayIndex + totalDays;
    const remaining = 42 - totalRendered;
    for (let day = 1; day <= remaining; day++) {
      grid.appendChild(this.createDayElement(day, true, [], false));
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  createDayElement(day, isOutside, events, isToday) {
    const container = document.createElement("div");

    let baseClass =
      "min-h-[60px] p-1.5 rounded-2xl flex flex-col justify-between border transition-all text-left relative cursor-pointer ";
    if (isOutside) {
      baseClass +=
        "bg-slate-50/50 dark:bg-[#061109]/10 text-slate-300 dark:text-[#4F6D58]/40 border-slate-100 dark:border-transparent opacity-40 pointer-events-none";
    } else if (isToday) {
      baseClass +=
        "bg-emerald-600/10 dark:bg-emerald-600/15 border-emerald-500 text-slate-800 dark:text-white font-black ring-1 ring-emerald-500/30";
    } else {
      baseClass +=
        "bg-white dark:bg-[#0B2112]/30 border-slate-100 dark:border-[#143E23]/25 hover:border-emerald-500/50 dark:hover:bg-[#143E23]/10 text-slate-700 dark:text-slate-300";
    }

    container.className = baseClass;

    // Day Label
    const dayLabel = document.createElement("span");
    dayLabel.className = "text-xs font-bold leading-none";
    dayLabel.textContent = day;
    container.appendChild(dayLabel);

    // Events container
    if (events.length > 0) {
      const dotsContainer = document.createElement("div");
      dotsContainer.className = "flex flex-wrap gap-1 mt-1 max-h-[30px] overflow-hidden";

      events.slice(0, 3).forEach((evt) => {
        const dot = document.createElement("span");
        dot.className = `h-2 w-2 rounded-full flex-shrink-0 ${evt.colorClass}`;
        dot.title = `${evt.type}: ${evt.title}`;
        dotsContainer.appendChild(dot);
      });

      // indicator if more than 3 events
      if (events.length > 3) {
        const plus = document.createElement("span");
        plus.className = "text-[7px] font-bold text-slate-400";
        plus.textContent = `+${events.length - 3}`;
        dotsContainer.appendChild(plus);
      }

      container.appendChild(dotsContainer);

      // Onclick tooltip/info
      container.onclick = () => {
        const listText = events.map((evt) => `• [${evt.type}] ${evt.title}`).join("\n");
        ErrorHandler.showToast(
          `Événements du jour (${day} ${MONTHS_FR[selectedMonth]}):\n\n${listText}`,
          "info"
        );
      };
    }

    return container;
  },

  // Identifie les événements à une date donnée
  getEventsForDate(dateString, crops, tasks) {
    const events = [];

    // 1. Semis
    crops.forEach((c) => {
      if (c.sowingDate === dateString) {
        events.push({
          type: "Semis",
          title: `${c.name} (${c.field})`,
          colorClass: "bg-emerald-500",
        });
      }
    });

    // 2. Récolte
    crops.forEach((c) => {
      if (c.harvestDate === dateString) {
        events.push({
          type: "Récolte",
          title: `Récolte prévue: ${c.name}`,
          colorClass: "bg-amber-500",
        });
      }
    });

    // 3. Irrigation et tâches système
    tasks.forEach((t) => {
      if (t.dueDate === dateString) {
        const color = t.category === "Irrigation" ? "bg-sky-400" : "bg-purple-400";
        events.push({
          type: t.category,
          title: t.title + (t.completed ? " (Complété)" : ""),
          colorClass: color,
        });
      }
    });

    return events;
  },

  // Naviguer entre les mois du calendrier
  navigateMonth(direction) {
    selectedMonth += direction;
    if (selectedMonth < 0) {
      selectedMonth = 11;
      selectedYear -= 1;
    } else if (selectedMonth > 11) {
      selectedMonth = 0;
      selectedYear += 1;
    }
    this.renderMonthCalendar();
  },

  setTodayMonth() {
    selectedYear = currentDate.getFullYear();
    selectedMonth = currentDate.getMonth();
    this.renderMonthCalendar();
  },

  // Aide locale sur le climat du Sénégal basée sur la date de semis
  getSenegalSeason(dateObj) {
    const month = dateObj.getMonth(); // 0 to 11
    if (month >= 10 || month <= 1) {
      // Nov., déc., janv., févr.
      return { name: "Contre-saison froide ❄️", key: "Froid" };
    } else if (month >= 2 && month <= 5) {
      // Mars, avr., mai, juin
      return { name: "Contre-saison chaude ☀️", key: "Chaud" };
    } else {
      // Juil., août, sept., oct.
      return { name: "Hivernage (Saison des pluies) 🌧️", key: "Hivernage" };
    }
  },

  // Simulateur
  runSimulation(e) {
    if (e) e.preventDefault();

    const cropName = document.getElementById("sim-crop").value;
    const zone = document.getElementById("sim-zone").value;
    const sowingDateStr = document.getElementById("sim-date").value;

    if (!sowingDateStr) {
      ErrorHandler.showToast("Veuillez sélectionner une date de semis.", "error");
      return;
    }

    const sowingDate = new Date(sowingDateStr);
    const meta = CROP_METADATA[cropName];
    if (!meta) return;

    // Saison climatique
    const season = this.getSenegalSeason(sowingDate);
    const seasonBadge = document.getElementById("sim-season-badge");
    if (seasonBadge) {
      seasonBadge.textContent = `Climat: ${season.name}`;
      if (season.key === "Froid") {
        seasonBadge.className =
          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-sky-100 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400";
      } else if (season.key === "Chaud") {
        seasonBadge.className =
          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400";
      } else {
        seasonBadge.className =
          "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-purple-100 dark:border-purple-500/20 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400";
      }
    }

    // Title update
    const titleLabel = document.getElementById("sim-title-label");
    if (titleLabel) {
      titleLabel.innerHTML = `<i data-lucide="git-commit" class="h-4 w-4 text-emerald-500"></i> ${cropName} (${zone})`;
    }

    // Milestones dynamic creation
    const container = document.getElementById("sim-steps-container");
    if (container) {
      container.innerHTML = meta.milestones
        .map((m) => {
          const milestoneDate = new Date(sowingDate.getTime() + m.days * 24 * 60 * 60 * 1000);
          const dateStrFormatted = milestoneDate.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return `
          <div class="p-4 bg-slate-50 dark:bg-[#061109]/30 border border-slate-100 dark:border-[#143E23]/25 rounded-2xl text-left space-y-2 relative overflow-hidden">
            <div class="absolute top-0 right-0 h-10 w-10 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-bl-3xl flex items-center justify-center text-emerald-400">
              <i data-lucide="${m.icon || "star"}" class="h-4 w-4"></i>
            </div>
            <div class="space-y-0.5">
              <p class="text-[9px] text-emerald-500 dark:text-emerald-400 font-extrabold uppercase tracking-wider">Jour +${m.days}</p>
              <h4 class="text-xs font-black text-slate-850 dark:text-white leading-tight">${m.name}</h4>
              <p class="text-[10px] text-slate-400 dark:text-emerald-500/60 font-black font-mono">${dateStrFormatted}</p>
            </div>
            <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">${m.desc}</p>
          </div>
        `;
        })
        .join("");
    }

    // Conseils spécifiques locaux
    const adviceTextEl = document.getElementById("sim-advice-text");
    const adviceTitleEl = document.getElementById("sim-advice-title");

    if (adviceTextEl && adviceTitleEl) {
      adviceTitleEl.textContent = `Conseil agro-climatique (${cropName} • ${season.name}) :`;

      const specificAdvice = meta.seasonalAdvice[season.key] || "Conseil standard.";
      adviceTextEl.textContent = `${specificAdvice} Zone horticole choisie : ${zone}. Fréquence d'irrigation moyenne conseillée : ${meta.wateringFreq}. Assurez-vous d'adapter vos planches de culture à l'écoulement des eaux locales.`;
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  },

  // Génère des alertes automatiques et des rappels suggérés à partir des cultures actives et des pépinières
  renderSuggestedReminders() {
    const listContainer = document.getElementById("suggested-reminders-list");
    if (!listContainer) return;

    const crops = KAStorage.getCrops();
    const nurseries = KAStorage.getNurseries();
    const suggestions = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Vérifier le niveau d'eau des cultures actives
    crops.forEach((c) => {
      if (c.waterStatus === "Besoin d'eau") {
        suggestions.push({
          id: `SUG-WATER-${c.id}`,
          title: `💧 Arrosage urgent requis`,
          cropName: c.name,
          field: c.field,
          priority: "Haute",
          desc: `La planche affiche un stress hydrique. Effectuer un tour d'arrosage.`,
          actionCategory: "Irrigation",
          completed: false,
        });
      }
    });

    // 2. Calculer les activités suggérées selon le cycle
    crops.forEach((c) => {
      const sowing = new Date(c.sowingDate);
      sowing.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - sowing.getTime();
      const ageDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      // Récupérer la famille de culture de base si elle existe dans nos métadonnées
      const cleanName = Object.keys(CROP_METADATA).find((k) =>
        c.name.toLowerCase().includes(k.split(" ")[0].toLowerCase())
      );
      const meta = CROP_METADATA[cleanName];

      if (meta && ageDays > 0) {
        // Recommend weeding/weeding if day is around 20-30 days
        if (ageDays >= 20 && ageDays <= 32 && c.status !== "Récoltable") {
          suggestions.push({
            id: `SUG-WEED-${c.id}`,
            title: `🚜 Sarclage et désherbage`,
            cropName: c.name,
            field: c.field,
            priority: "Moyenne",
            desc: `À ${ageDays} jours, la concurrence des mauvaises herbes ralentit la croissance.`,
            actionCategory: "Entretien",
            completed: false,
          });
        }

        // Recommend fertilisation during flowering or mid-cycle (day 50-65)
        if (ageDays >= 50 && ageDays <= 65 && c.status !== "Récoltable") {
          suggestions.push({
            id: `SUG-FERT-${c.id}`,
            title: `🌿 Fertilisation organique de fond`,
            cropName: c.name,
            field: c.field,
            priority: "Moyenne",
            desc: `Planche à ${ageDays} jours. Apport d'azote ou de potasse recommandé pour optimiser le rendement.`,
            actionCategory: "Entretien",
            completed: false,
          });
        }

        // Near Harvest dates (within 7 days)
        const harvest = new Date(c.harvestDate);
        harvest.setHours(0, 0, 0, 0);
        const timeToHarvest = harvest.getTime() - today.getTime();
        const daysToHarvest = Math.round(timeToHarvest / (1000 * 60 * 60 * 24));

        if (daysToHarvest >= 0 && daysToHarvest <= 7 && c.status !== "Récoltable") {
          suggestions.push({
            id: `SUG-HARV-${c.id}`,
            title: `🍎 Préparation de récolte`,
            cropName: c.name,
            field: c.field,
            priority: "Haute",
            desc: `La date de récolte théorique approche dans ${daysToHarvest} jours. Organiser les paniers de transport.`,
            actionCategory: "Entretien",
            completed: false,
          });
        }
      }
    });

    // 3. Check nurseries planned transplantation dates
    nurseries.forEach((n) => {
      const transplant = new Date(n.plannedTransplantDate);
      transplant.setHours(0, 0, 0, 0);
      const timeToTransplant = transplant.getTime() - today.getTime();
      const daysToTransplant = Math.round(timeToTransplant / (1000 * 60 * 60 * 24));

      if (daysToTransplant <= 3 && n.status !== "Prêt pour repiquage") {
        suggestions.push({
          id: `SUG-TRANS-${n.id}`,
          title: `🌱 Repiquage pépinière`,
          cropName: n.name,
          field: "Au champ libre",
          priority: "Haute",
          desc: `La pépinière de ${n.cropType} arrive à maturité. Préparer le lit de repiquage.`,
          actionCategory: "Pépinière",
          completed: false,
        });
      }
    });

    // Fallback default suggestions if everything is perfect
    if (suggestions.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-10 text-slate-400 dark:text-slate-500">
          <i data-lucide="check-circle" class="h-8 w-8 text-emerald-500 mx-auto mb-2"></i>
          <p class="text-xs font-bold">Tout est sous contrôle !</p>
          <p class="text-[9px] text-slate-450 mt-1">Vos planches de culture ne requièrent aucune intervention planifiée aujourd'hui.</p>
        </div>
      `;
      // Hide global button
      document.getElementById("add-all-reminders-btn").classList.add("hidden");
      return;
    }

    document.getElementById("add-all-reminders-btn").classList.remove("hidden");

    // Render cards
    listContainer.innerHTML = suggestions
      .map((s) => {
        const isHigh = s.priority === "Haute";
        const badgeClass = isHigh
          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
          : "bg-amber-500/10 text-amber-500 border-amber-500/20";

        return `
        <div id="card-${s.id}" class="p-3 bg-slate-50 dark:bg-[#061109]/40 border border-slate-100 dark:border-emerald-950/30 rounded-2xl space-y-2 text-left relative transition-all">
          <div class="flex justify-between items-start gap-1">
            <div>
              <span class="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${badgeClass}">
                ${s.priority}
              </span>
              <h4 class="text-xs font-black text-slate-800 dark:text-white mt-1 leading-tight">${s.title}</h4>
              <p class="text-[9.5px] text-[#819888] font-bold uppercase mt-0.5">${s.cropName} • <span class="text-slate-400">${s.field}</span></p>
            </div>
            
            <button onclick="window.addSuggestedTask('${s.id}', '${s.title.replace(/'/g, "\\'")}', '${s.actionCategory}', '${s.priority}')" class="p-1 hover:bg-[#143E23]/20 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 rounded-lg transition-colors cursor-pointer" title="Ajouter à mon agenda">
              <i data-lucide="plus-circle" class="h-4 w-4"></i>
            </button>
          </div>
          <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">${s.desc}</p>
        </div>
      `;
      })
      .join("");

    if (window.lucide) {
      window.lucide.createIcons();
    }

    // Keep state references
    window.activeSuggestedReminders = suggestions;
  },

  checkUpcomingAlerts() {
    const crops = KAStorage.getCrops();
    const alerts = crops.filter((c) => c.waterStatus === "Besoin d'eau").length;
    const banner = document.getElementById("calendar-alert-banner");
    const text = document.getElementById("calendar-alert-text");

    if (alerts > 0) {
      if (banner && text) {
        text.textContent = `Alerte : ${alerts} planche${alerts > 1 ? "s" : ""} de culture requièrent un arrosage immédiat pour éviter un ralentissement du cycle végétatif.`;
        banner.classList.remove("hidden");
      }
    } else {
      if (banner) banner.classList.add("hidden");
    }
  },

  populatePlanificationModal() {
    const select = document.getElementById("plan-parcel");
    if (!select) return;

    const parcelles = KAStorage.getParcelles();
    // Fill parcelles
    if (parcelles.length === 0) {
      select.innerHTML = `<option value="">-- Aucune parcelle disponible --</option>`;
    } else {
      select.innerHTML = parcelles
        .map(
          (p) => `
        <option value="${p.id}">${p.name} (${p.surface} m² - ${p.status})</option>
      `
        )
        .join("");
    }
  },

  setupListeners() {
    // Simulator trigger on change
    const cropSim = document.getElementById("sim-crop");
    if (cropSim) {
      // Set default sim date on page load to today
      const dateSim = document.getElementById("sim-date");
      if (dateSim && !dateSim.value) {
        dateSim.value = new Date().toISOString().split("T")[0];
      }

      // Auto run simulation initially
      this.runSimulation();
    }

    // Global simulation window helpers
    window.openSimulationModal = () => {
      this.populatePlanificationModal();
      const modal = document.getElementById("planification-modal");
      const sowingDateInput = document.getElementById("plan-sowing-date");
      if (sowingDateInput) {
        sowingDateInput.value = new Date().toISOString().split("T")[0];
      }
      if (modal) modal.classList.remove("hidden");
    };

    window.closeSimulationModal = () => {
      const modal = document.getElementById("planification-modal");
      if (modal) modal.classList.add("hidden");
    };

    window.navigateMonth = (direction) => {
      this.navigateMonth(direction);
    };

    window.setTodayMonth = () => {
      this.setTodayMonth();
    };

    window.runSimulation = (e) => {
      this.runSimulation(e);
    };

    // Single reminder tasks loader
    window.addSuggestedTask = (id, title, category, priority) => {
      const tasks = KAStorage.getTasks();

      // Add standard task
      const newTask = {
        id: `T-${Date.now()}`,
        title,
        category,
        dueDate: new Date().toISOString().split("T")[0],
        assignee: "Samba", // samba is default active worker
        priority,
        completed: false,
      };

      tasks.unshift(newTask);
      KAStorage.saveTasks(tasks);

      // Hide card smoothly
      const card = document.getElementById(`card-${id}`);
      if (card) {
        card.style.opacity = "0";
        card.style.transform = "scale(0.95)";
        setTimeout(() => {
          card.remove();
          this.renderMonthCalendar();

          if (window.App && typeof window.App.updateBadges === "function") {
            window.App.updateBadges();
          }
        }, 300);
      }

      ErrorHandler.showToast(
        `Rappel ajouté à vos tâches d'entretien d'aujourd'hui : "${title}" !`,
        "success"
      );
    };

    // Add all reminders
    window.addAllSuggestedTasks = () => {
      const suggestions = window.activeSuggestedReminders || [];
      if (suggestions.length === 0) return;

      const tasks = KAStorage.getTasks();

      suggestions.forEach((s) => {
        tasks.unshift({
          id: `T-${Date.now()}-${Math.random()}`,
          title: s.title,
          category: s.actionCategory,
          dueDate: new Date().toISOString().split("T")[0],
          assignee: "Samba",
          priority: s.priority,
          completed: false,
        });
      });

      KAStorage.saveTasks(tasks);
      this.renderMonthCalendar();
      this.renderSuggestedReminders();

      if (window.App && typeof window.App.updateBadges === "function") {
        window.App.updateBadges();
      }

      ErrorHandler.showToast(
        `${suggestions.length} rappels agricoles ont été inscrits avec succès dans votre agenda !`,
        "success"
      );
    };

    // Save active planned cycle
    window.saveActivePlannedCycle = (e) => {
      e.preventDefault();

      const parcelId = document.getElementById("plan-parcel").value;
      const cropName = document.getElementById("plan-crop").value;
      const sowingDateStr = document.getElementById("plan-sowing-date").value;
      const needNursery = document.getElementById("plan-nursery").value === "oui";

      if (!parcelId || !cropName || !sowingDateStr) {
        ErrorHandler.showToast("Veuillez remplir l'ensemble des champs.", "error");
        return;
      }

      const parcelles = KAStorage.getParcelles();
      const parcelIdx = parcelles.findIndex((p) => p.id === parcelId);
      if (parcelIdx === -1) return;

      const sowingDate = new Date(sowingDateStr);
      const meta = CROP_METADATA[cropName];
      if (!meta) return;

      // Update parcel status
      parcelles[parcelIdx].status = "Cultivée";
      parcelles[parcelIdx].currentCrop = cropName;
      if (!parcelles[parcelIdx].history.includes(cropName)) {
        parcelles[parcelIdx].history.unshift(cropName);
      }
      KAStorage.saveParcelles(parcelles);

      // Create crop active element
      const crops = KAStorage.getCrops();
      const harvestDate = new Date(sowingDate.getTime() + meta.cycleDays * 24 * 60 * 60 * 1000);
      const harvestDateStr = harvestDate.toISOString().split("T")[0];

      const newCrop = {
        id: `C-${Date.now()}`,
        name: cropName,
        field: parcelles[parcelIdx].name,
        sowingDate: sowingDateStr,
        harvestDate: harvestDateStr,
        status: "Semis",
        waterStatus: "Optimale",
        fertilizerStatus: "OK",
        photos: [],
      };

      crops.unshift(newCrop);
      KAStorage.saveCrops(crops);

      // Optionally create associated nursery
      if (needNursery) {
        const nurseries = KAStorage.getNurseries();
        const transplantDate = new Date(
          sowingDate.getTime() + (meta.milestones[1]?.days || 30) * 24 * 60 * 60 * 1000
        );

        nurseries.unshift({
          id: `PEP-${Date.now()}`,
          name: `Pépinière ${cropName.split(" ")[0]} - Lancement`,
          cropType: cropName.split(" ")[0],
          sowingDate: sowingDateStr,
          plannedTransplantDate: transplantDate.toISOString().split("T")[0],
          quantityEst: Math.round(parcelles[parcelIdx].surface * 5), // Estimate plants density
          status: "Semis",
          healthStatus: "Excellent",
        });
        KAStorage.saveNurseries(nurseries);
      }

      // Automatically create a few startup tasks in the manager
      const tasks = KAStorage.getTasks();

      // Weeding task
      const weedDate = new Date(sowingDate.getTime() + 25 * 24 * 60 * 60 * 1000);
      tasks.unshift({
        id: `T-${Date.now()}-1`,
        title: `Sarclage & Désherbage requis : ${cropName}`,
        category: "Entretien",
        dueDate: weedDate.toISOString().split("T")[0],
        assignee: "Awa",
        priority: "Moyenne",
        completed: false,
      });

      // Watering initial task
      tasks.unshift({
        id: `T-${Date.now()}-2`,
        title: `Irrigation régulière lancée : ${cropName} (${parcelles[parcelIdx].name})`,
        category: "Irrigation",
        dueDate: sowingDateStr,
        assignee: "Ibrahima",
        priority: "Haute",
        completed: false,
      });

      KAStorage.saveTasks(tasks);

      // Hide and notify
      this.closeSimulationModal();
      this.renderMonthCalendar();
      this.renderSuggestedReminders();
      this.checkUpcomingAlerts();

      if (window.App && typeof window.App.updateBadges === "function") {
        window.App.updateBadges();
      }

      ErrorHandler.showToast(
        `Cycle horticole de ${cropName} lancé avec succès sur la parcelle "${parcelles[parcelIdx].name}" !\n\nUn calendrier de tâches automatiques a été synchronisé.`,
        "success"
      );
    };
  },
};

// Start calendar module
document.addEventListener("DOMContentLoaded", () => {
  CalendarModule.init();
});

document.addEventListener("ka_data_updated", (e) => {
  if (e.detail && (e.detail.key === "ka_farm_tasks" || e.detail.key === "ka_farm_crops")) {
    CalendarModule.renderMonthCalendar();
    CalendarModule.renderSuggestedReminders();
  }
});
