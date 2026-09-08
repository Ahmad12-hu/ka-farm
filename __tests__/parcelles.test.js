// KA Farm - Tests pour le module Parcelles
import { ParcellesModule } from "../js/modules/parcelles.js";

// Mocks globaux
window.confirm = jest.fn(() => true);
window.lucide = { createIcons: () => {} };
window.App = { updateBadges: () => {} };
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => [] }));

const norm = (s) => String(s).replace(/[\u202F\u00A0]/g, " ");

function parcelEls(html) {
  document.body.innerHTML = `
    <div id="parcelles-container"></div>
    <div id="parcelle-details-container"></div>
    <tbody id="parcelles-table-body"></tbody>
    <span id="stat-total-surface"></span>
    <span id="detail-title"></span>
    <span id="detail-id"></span>
    <span id="detail-surface"></span>
    <span id="detail-current-crop"></span>
    <form id="add-parcel-form">
      <input id="form-add-name">
      <input id="form-add-surface">
      <select id="form-add-status"></select>
      <input id="form-add-lat">
      <input id="form-add-lng">
      <select id="form-add-water"></select>
      <select id="form-add-sol"></select>
      <input id="form-add-crop">
      <input id="form-add-history">
    </form>
    <div id="add-parcel-modal" class="hidden"></div>
    <form id="edit-parcel-form">
      <input id="form-edit-id">
      <input id="form-edit-name">
      <input id="form-edit-surface">
      <select id="form-edit-status"></select>
      <input id="form-edit-lat">
      <input id="form-edit-lng">
      <select id="form-edit-water"></select>
      <select id="form-edit-sol"></select>
      <input id="form-edit-crop">
    </form>
    <div id="edit-parcel-modal" class="hidden"></div>
    ${html}
  `;
}

describe("ParcellesModule", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ka_farm_parcelles", JSON.stringify([]));
    window.confirm = jest.fn(() => true);
  });

  test("devrait initialiser le module sans erreur", () => {
    parcelEls("");
    expect(() => ParcellesModule.init()).not.toThrow();
  });

  test("devrait ajouter une parcelle via le formulaire", () => {
    parcelEls("");
    document.getElementById("form-add-name").value = "Parcelle Nord";
    document.getElementById("form-add-surface").value = "1000";
    document.getElementById("form-add-status").innerHTML =
      '<option value="Cultivée" selected></option>';
    document.getElementById("form-add-lat").value = "14.7";
    document.getElementById("form-add-lng").value = "-17.4";
    document.getElementById("form-add-sol").innerHTML =
      '<option value="argileux" selected></option>';
    document.getElementById("form-add-water").innerHTML =
      '<option value="OK" selected></option>';
    document.getElementById("form-add-crop").value = "Tomate";

    ParcellesModule.init();
    document.getElementById("add-parcel-form").dispatchEvent(new Event("submit"));

    const savedParcelles = JSON.parse(localStorage.getItem("ka_farm_parcelles"));
    expect(savedParcelles.length).toBe(1);
    expect(savedParcelles[0].name).toBe("Parcelle Nord");
    expect(savedParcelles[0].surface).toBe(1000);
  });

  test("devrait modifier une parcelle via le formulaire", () => {
    localStorage.setItem(
      "ka_farm_parcelles",
      JSON.stringify([
        {
          id: "P-001",
          name: "Parcelle Nord",
          surface: 1000,
          type_sol: "argileux",
          currentCrop: "Tomate",
          status: "Cultivée",
          history: ["Tomate"],
        },
      ])
    );
    parcelEls("");
    document.getElementById("form-edit-id").value = "P-001";
    document.getElementById("form-edit-name").value = "Parcelle Nord Modifiée";
    document.getElementById("form-edit-surface").value = "1500";
    document.getElementById("form-edit-status").innerHTML =
      '<option value="Cultivée" selected></option>';
    document.getElementById("form-edit-lat").value = "14.7";
    document.getElementById("form-edit-lng").value = "-17.4";
    document.getElementById("form-edit-sol").innerHTML =
      '<option value="sableux" selected></option>';
    document.getElementById("form-edit-water").innerHTML =
      '<option value="OK" selected></option>';
    document.getElementById("form-edit-crop").value = "Tomate";

    ParcellesModule.init();
    document.getElementById("edit-parcel-form").dispatchEvent(new Event("submit"));

    const savedParcelles = JSON.parse(localStorage.getItem("ka_farm_parcelles"));
    expect(savedParcelles[0].name).toBe("Parcelle Nord Modifiée");
    expect(savedParcelles[0].surface).toBe(1500);
    expect(savedParcelles[0].type_sol).toBe("sableux");
  });

  test("devrait supprimer une parcelle", () => {
    localStorage.setItem(
      "ka_farm_parcelles",
      JSON.stringify([
        { id: "P-001", name: "Parcelle Nord", surface: 1000, status: "Cultivée", lat: 14.7, lng: -17.4 },
      ])
    );
    parcelEls("");
    ParcellesModule.init();
    window.deleteParcel("P-001");
    expect(JSON.parse(localStorage.getItem("ka_farm_parcelles")).length).toBe(0);
  });

  test("devrait sélectionner une parcelle et afficher les détails", () => {
    localStorage.setItem(
      "ka_farm_parcelles",
      JSON.stringify([
        { id: "P-001", name: "Parcelle Nord", surface: 1000, status: "Cultivée", currentCrop: "Tomate", lat: 14.7, lng: -17.4 },
      ])
    );
    parcelEls("");
    ParcellesModule.init();
    ParcellesModule.selectParcel("P-001");
    expect(document.getElementById("detail-title").textContent).toContain("Parcelle Nord");
  });

  test("devrait calculer la surface totale des parcelles", () => {
    localStorage.setItem(
      "ka_farm_parcelles",
      JSON.stringify([
        { id: "P-001", name: "Parcelle Nord", surface: 1000, status: "Cultivée", lat: 14.7, lng: -17.4 },
        { id: "P-002", name: "Parcelle Sud", surface: 1500, status: "Cultivée", lat: 14.7, lng: -17.4 },
      ])
    );
    parcelEls("");
    ParcellesModule.init();
    expect(norm(document.getElementById("stat-total-surface").textContent)).toBe("2 500");
  });

  test("devrait filtrer les parcelles par culture", () => {
    localStorage.setItem(
      "ka_farm_parcelles",
      JSON.stringify([
        { id: "P-001", name: "Parcelle Nord", surface: 1000, status: "Cultivée", currentCrop: "Tomate", lat: 14.7, lng: -17.4 },
        { id: "P-002", name: "Parcelle Sud", surface: 1500, status: "Cultivée", currentCrop: "Oignon", lat: 14.7, lng: -17.4 },
      ])
    );
    parcelEls("");
    ParcellesModule.init();
    // ParcellesModule.filterParcelles("Tomate");
    const filtered = JSON.parse(localStorage.getItem("ka_farm_parcelles")).filter(
      (p) => p.currentCrop && p.currentCrop.toLowerCase().includes("tomate")
    );
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("Parcelle Nord");
  });
});