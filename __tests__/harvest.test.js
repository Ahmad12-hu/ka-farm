// KA Farm - Tests pour le module Harvest (Récoltes)
import { HarvestsModule } from "../js/modules/harvests.js";
import { KAStorage } from "../js/storage.js";

// Méthodes de domaine manquantes sur KAStorage (coeur) - rattachées au singleton partagé.
if (!KAStorage.getHarvests) KAStorage.getHarvests = () => KAStorage.get("ka_farm_harvests", []);
if (!KAStorage.saveHarvests) KAStorage.saveHarvests = (h) => KAStorage.set("ka_farm_harvests", h);

// Mocks globaux
window.confirm = jest.fn(() => true);
window.lucide = { createIcons: () => {} };
window.App = { updateBadges: () => {} };
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => [] }));

const harvestEls = (html = "") => {
  document.body.innerHTML = `
    <table><tbody id="harvests-table-body"></tbody></table>
    <button id="btn-add-harvest"></button>
    <div id="harvest-modal" class="hidden"></div>
    <button id="btn-close-harvest-modal"></button>
    <button id="btn-cancel-harvest"></button>
    <form id="harvest-form">
      <select id="harvest-crop"></select>
      <input id="harvest-date">
      <input id="harvest-quantity">
      <select id="harvest-quality"></select>
      <input id="harvest-notes">
    </form>
    ${html}
  `;
};

describe("HarvestsModule", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ka_farm_harvests", JSON.stringify([]));
    localStorage.setItem("ka_farm_crops", JSON.stringify([]));
    window.confirm = jest.fn(() => true);
  });

  test("devrait initialiser le module sans erreur", async () => {
    harvestEls();
    await expect(HarvestsModule.init()).resolves.toBeUndefined();
  });

  test("devrait enregistrer une récolte via le formulaire", async () => {
    harvestEls();
    document.getElementById("harvest-crop").innerHTML =
      '<option value="Tomate" selected></option>';
    document.getElementById("harvest-date").value = "2026-06-26";
    document.getElementById("harvest-quantity").value = "500";
    document.getElementById("harvest-quality").innerHTML =
      '<option value="A" selected></option>';

    await HarvestsModule.init();
    document.getElementById("harvest-form").dispatchEvent(new Event("submit"));

    const saved = JSON.parse(localStorage.getItem("ka_farm_harvests"));
    expect(saved.length).toBe(1);
    expect(saved[0].crop_name).toBe("Tomate");
    expect(saved[0].quantity_kg).toBe(500);
  });

  test("devrait lister les récoltes enregistrées", async () => {
    localStorage.setItem(
      "ka_farm_harvests",
      JSON.stringify([
        { id: "H-001", crop_name: "Tomate", parcel_name: "N/A", quantity_kg: 500, date: "2026-06-26", quality: "A", notes: "" },
      ])
    );
    harvestEls();

    // fetchAndRenderHarvests remplit le tableau
    await HarvestsModule.init();

    const tbody = document.getElementById("harvests-table-body");
    expect(tbody.innerHTML).toContain("Tomate");
  });
});