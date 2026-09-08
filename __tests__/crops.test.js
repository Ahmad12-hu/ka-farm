// KA Farm - Tests pour le module Cultures
import { CropsModule } from "../js/modules/crops.js";
import { KAStorage } from "../js/storage.js";

// KAStorage (coeur) n'expose pas les méthodes "pépinière" (déjà dans js/storage/crops.js).
// On les rattache à l'objet singleton partagé pour que le module fonctionne avec le vrai storage local.
if (!KAStorage.getNurseries) KAStorage.getNurseries = () => KAStorage.get("ka_farm_nurseries", []);
if (!KAStorage.saveNurseries) KAStorage.saveNurseries = (n) => KAStorage.set("ka_farm_nurseries", n);

// Mocks globaux
window.confirm = jest.fn(() => true);
window.lucide = { createIcons: () => {} };
window.App = { updateBadges: () => {} };
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => [] }));

const norm = (s) => String(s).replace(/[\u202F\u00A0]/g, " ");

function cropEls(html) {
  document.body.innerHTML = `
    <div id="crops-container"></div>
    <div id="nurseries-container"></div>
    <div id="treatments-container"></div>
    <div id="library-container"></div>
    <input id="crops-search" value="">
    <select id="crops-filter-field"><option value="all" selected></option></select>
    <select id="crops-filter-seed"><option value="all" selected></option></select>
    <select id="crops-filter-season"><option value="all" selected></option></select>
    <form id="shared-crop-form">
      <input id="form-crop-name">
      <select id="form-crop-field-select"></select>
      <input id="form-crop-sowing">
      <input id="form-crop-harvest">
      <input id="form-crop-seed-type" value="Hybride F1 Certifiée">
      <input id="form-crop-season" value="Saison Sèche Froide">
    </form>
    <div id="crop-form-modal" class="hidden"></div>
    <form id="shared-nursery-form">
      <input id="form-nursery-name">
      <select id="form-nursery-crop"></select>
      <input id="form-nursery-qty">
      <input id="form-nursery-sowing">
      <input id="form-nursery-transplant">
    </form>
    <div id="nursery-form-modal" class="hidden"></div>
    ${html}
  `;
}

describe("CropsModule", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ka_farm_crops", JSON.stringify([]));
    localStorage.setItem("ka_farm_nurseries", JSON.stringify([]));
    window.confirm = jest.fn(() => true);
  });

  test("devrait initialiser le module sans erreur", () => {
    cropEls("");
    expect(() => CropsModule.init()).not.toThrow();
  });

  test("devrait calculer le rendement pour tomate", () => {
    cropEls(`
      <select id="est-crop-select"><option value="tomate" selected></option></select>
      <input id="est-surface" value="10">
      <input id="est-density" value="4">
      <input id="est-sowing-date" value="2026-06-01">
      <span id="est-yield-result"></span>
      <span id="est-yield-sub"></span>
    `);
    CropsModule.updateYieldEstimator();
    expect(document.getElementById("est-yield-result").textContent).toContain("T");
  });

  test("devrait calculer le cycle pour oignon", () => {
    cropEls(`
      <select id="est-crop-select"><option value="oignon" selected></option></select>
      <input id="est-surface" value="5">
      <input id="est-density" value="8">
      <input id="est-sowing-date" value="2026-06-01">
      <span id="est-date-result"></span>
    `);
    CropsModule.updateYieldEstimator();
    expect(document.getElementById("est-date-result").textContent).not.toBe("-- -- ----");
  });

  test("devrait gérer les cultures vides", () => {
    cropEls("");
    CropsModule.renderCrops();
    expect(document.getElementById("crops-container").innerHTML).toContain("Aucune culture");
  });

  test("devrait ajouter une culture via le formulaire", () => {
    cropEls("");
    document.getElementById("form-crop-name").value = "Tomate Test";
    document.getElementById("form-crop-field-select").innerHTML =
      '<option value="Parcelle Nord" selected></option>';
    document.getElementById("form-crop-sowing").value = "2026-06-01";
    document.getElementById("form-crop-harvest").value = "2026-08-01";

    CropsModule.init();
    document.getElementById("shared-crop-form").dispatchEvent(new Event("submit"));

    const savedCrops = JSON.parse(localStorage.getItem("ka_farm_crops"));
    expect(savedCrops.length).toBe(1);
    expect(savedCrops[0].name).toBe("Tomate Test");
  });

  test("devrait supprimer une culture", () => {
    localStorage.setItem(
      "ka_farm_crops",
      JSON.stringify([
        {
          id: "C-123",
          name: "Tomate à supprimer",
          field: "Nord",
          sowingDate: "2026-06-01",
          harvestDate: "2026-08-01",
          status: "Croissance",
          waterStatus: "Optimale",
          fertilizerStatus: "OK",
          photos: [],
        },
      ])
    );
    cropEls("");
    window.deleteCrop("C-123");
    expect(JSON.parse(localStorage.getItem("ka_farm_crops")).length).toBe(0);
    expect(window.confirm).toHaveBeenCalled();
  });

  test("devrait basculer le statut hydrique", () => {
    localStorage.setItem(
      "ka_farm_crops",
      JSON.stringify([{ id: "C-1", name: "Test", waterStatus: "Optimale" }])
    );
    cropEls("");
    window.toggleWaterStatus("C-1");
    expect(JSON.parse(localStorage.getItem("ka_farm_crops"))[0].waterStatus).toBe("Besoin d'eau");
  });

  test("devrait créer une pépinière via le formulaire", () => {
    cropEls("");
    document.getElementById("form-nursery-name").value = "Pépinière Test";
    document.getElementById("form-nursery-crop").innerHTML =
      '<option value="Tomate" selected></option>';
    document.getElementById("form-nursery-qty").value = "100";
    document.getElementById("form-nursery-sowing").value = "2026-06-01";
    document.getElementById("form-nursery-transplant").value = "2026-07-01";

    CropsModule.init();
    document.getElementById("shared-nursery-form").dispatchEvent(new Event("submit"));

    const savedNurseries = JSON.parse(localStorage.getItem("ka_farm_nurseries"));
    expect(savedNurseries.length).toBe(1);
    expect(savedNurseries[0].name).toBe("Pépinière Test");
  });

  test("devrait faire évoluer le statut de pépinière", () => {
    localStorage.setItem(
      "ka_farm_nurseries",
      JSON.stringify([
        {
          id: "PEP-1",
          name: "Test",
          status: "Semis",
          sowingDate: "2026-06-01",
          plannedTransplantDate: "2026-07-01",
          quantityEst: 50,
          healthStatus: "Excellent",
        },
      ])
    );
    cropEls("");
    window.nextNurseryStatus("PEP-1");
    expect(JSON.parse(localStorage.getItem("ka_farm_nurseries"))[0].status).toBe("Levée");
  });

  test("devrait filtrer les cultures par recherche", () => {
    localStorage.setItem(
      "ka_farm_crops",
      JSON.stringify([
        { id: "C-1", name: "Tomate Mongal", field: "Nord", seedType: "Hybride", season: "Saison Sèche" },
        { id: "C-2", name: "Oignon Rouge", field: "Sud", seedType: "Locale", season: "Saison Pluie" },
      ])
    );
    cropEls('<input id="crops-search" value="tomate">');
    window.filterActiveCrops();
    expect(norm(document.getElementById("crops-container").innerHTML)).toContain("Tomate Mongal");
  });
});