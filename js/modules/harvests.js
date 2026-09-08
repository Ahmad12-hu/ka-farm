import { KAStorage } from "../storage.js";
import { logger } from "./logger.js";
import { ErrorHandler } from "./error-handler.js";
import { UserManager } from "../user-manager.js";

export const HarvestsModule = {
  async init() {
    try {
      this.applyRbac();
      await this.fetchAndRenderHarvests();
      this.setupModal();
    } catch (err) {
      ErrorHandler.log(err, "HarvestsModule.init");
    }
  },

  applyRbac() {
    const addBtn = document.getElementById("btn-add-harvest");
    if (!addBtn) return;

    const canAdd = UserManager.canManageHarvests();
    addBtn.disabled = !canAdd;
    addBtn.classList.toggle("opacity-50", !canAdd);
    addBtn.classList.toggle("pointer-events-none", !canAdd);
    addBtn.title = canAdd ? "Ajouter une récolte" : "Accès restreint : rôle non autorisé";
  },

  setupModal() {
    const modal = document.getElementById("harvest-modal");
    const closeBtn = document.getElementById("btn-close-harvest-modal");
    const cancelBtn = document.getElementById("btn-cancel-harvest");
    const form = document.getElementById("harvest-form");
    if (!modal || !form) return;

    const hideModal = () => modal.classList.add("hidden");

    const openModal = () => {
      this.populateCropOptions();
      modal.classList.remove("hidden");
    };

    const addBtn = document.getElementById("btn-add-harvest");
    if (addBtn) {
      addBtn.replaceWith(addBtn.cloneNode(true));
    }

    const newAddBtn = document.getElementById("btn-add-harvest");
    if (newAddBtn) {
      newAddBtn.addEventListener("click", () => {
        if (!UserManager.canManageHarvests()) {
          ErrorHandler.showToast("Vous n’avez pas les droits pour ajouter une récolte.", "error");
          return;
        }
        openModal();
      });
    }

    closeBtn.addEventListener("click", hideModal);
    cancelBtn.addEventListener("click", hideModal);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.saveHarvest();
    });
  },

  populateCropOptions() {
    const select = document.getElementById("harvest-crop");
    if (!select) return;
    const crops = KAStorage.getCrops();
    const uniqueNames = Array.from(new Set(crops.map((c) => c.name)));
    select.innerHTML =
      '<option value="">Sélectionner une culture</option>' +
      uniqueNames.map((name) => `<option value="${name}">${name}</option>`).join("");
  },

  async fetchAndRenderHarvests() {
    const tableBody = document.getElementById("harvests-table-body");
    if (!tableBody) return;

    try {
      const harvests = KAStorage.getHarvests();
      tableBody.innerHTML = "";

      if (harvests.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-400 font-semibold">Aucune récolte n'a encore été enregistrée.</td></tr>`;
        return;
      }

      const sortedHarvests = [...harvests].sort((a, b) => new Date(b.date) - new Date(a.date));

      sortedHarvests.forEach((harvest) => {
        const row = document.createElement("tr");
        row.className = "hover:bg-slate-50 dark:hover:bg-[#0E2F19]/50 transition-colors";
        row.innerHTML = `
          <td class="p-4 font-bold text-slate-700 dark:text-slate-200">${harvest.crop_name || "N/A"}</td>
          <td class="p-4 text-slate-600 dark:text-slate-400 font-semibold">${harvest.parcel_name || "N/A"}</td>
          <td class="p-4 text-slate-600 dark:text-slate-300 font-mono font-bold">${harvest.quantity_kg || 0} kg</td>
          <td class="p-4 text-slate-600 dark:text-slate-400 font-semibold">${harvest.date ? new Date(harvest.date).toLocaleDateString("fr-FR") : "N/A"}</td>
          <td class="p-4">
            <span class="px-2 py-1 text-[10px] font-black rounded-full ${harvest.quality === "A" ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}">
              Qualité ${harvest.quality || "B"}
            </span>
          </td>
          <td class="p-4">
            <button class="p-1.5 text-slate-400 hover:text-emerald-500"><i data-lucide="edit-3" class="h-3.5 w-3.5"></i></button>
            <button class="p-1.5 text-slate-400 hover:text-rose-500"><i data-lucide="trash-2" class="h-3.5 w-3.5"></i></button>
          </td>
        `;
        tableBody.appendChild(row);
      });

      if (window.lucide) {
        lucide.createIcons();
      }
    } catch (err) {
      ErrorHandler.log(err, "HarvestsModule.fetchAndRenderHarvests", "error");
      tableBody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-rose-400 font-semibold">Erreur: Impossible de charger les données.</td></tr>`;
    }
  },

  saveHarvest() {
    const cropName = document.getElementById("harvest-crop").value;
    const date = document.getElementById("harvest-date").value;
    const quantity = parseFloat(document.getElementById("harvest-quantity").value) || 0;
    const quality = document.getElementById("harvest-quality").value;
    const notes = document.getElementById("harvest-notes").value;

    if (!cropName || !date || quantity <= 0) {
      ErrorHandler.showToast("Veuillez remplir la culture, la date et la quantité.", "error");
      return;
    }

    const crops = KAStorage.getCrops();
    const crop = crops.find((c) => c.name === cropName);
    const parcelName = crop ? crop.field : "N/A";

    const harvest = {
      id: `HARVEST-${Date.now()}`,
      crop_name: cropName,
      parcel_name: parcelName,
      quantity_kg: quantity,
      date,
      quality,
      notes,
    };

    const harvests = KAStorage.getHarvests();
    harvests.unshift(harvest);
    KAStorage.saveHarvests(harvests);

    ErrorHandler.showToast("Récolte enregistrée", "success");
    document.getElementById("harvest-modal").classList.add("hidden");
    document.getElementById("harvest-form").reset();
    this.fetchAndRenderHarvests();
  },
};

document.addEventListener("DOMContentLoaded", () => HarvestsModule.init());
