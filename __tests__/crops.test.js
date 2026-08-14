// KA Farm - Tests pour le module Cultures
import { CropsModule } from "../js/modules/crops.js";

// Simuler localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Simuler KAStorage
const mockKAStorage = {
  getCrops: () => [],
  saveCrops: (crops) => {
    localStorage.setItem("ka_farm_crops", JSON.stringify(crops));
  },
  getNurseries: () => [],
  saveNurseries: (nurseries) => {
    localStorage.setItem("ka_farm_nurseries", JSON.stringify(nurseries));
  },
  getParcelles: () => [],
  getScopedKey: (key) => key,
  init: () => {},
};

Object.defineProperty(window, "KAStorage", { value: mockKAStorage });

// Simuler window.confirm
window.confirm = jest.fn(() => true);

// Simuler les icônes Lucide
window.lucide = { createIcons: () => {} };

// Simuler fetch
global.fetch = () => Promise.resolve({});

describe("CropsModule", () => {
  beforeEach(() => {
    localStorage.clear();
    // Empêcher le chargement des données de démonstration en définissant des tableaux vides
    localStorage.setItem("ka_farm_crops", JSON.stringify([]));
    localStorage.setItem("ka_farm_nurseries", JSON.stringify([]));
    // Réinitialiser la simulation de confirm
    window.confirm = jest.fn(() => true);
  });

  test("devrait initialiser le module sans erreur", () => {
    // Simuler les éléments DOM requis
    document.body.innerHTML = `
      <div id="crops-container"></div>
      <div id="nurseries-container"></div>
      <div id="treatments-container"></div>
      <div id="library-container"></div>
    `;
    expect(() => CropsModule.init()).not.toThrow();
  });

  test("devrait calculer le rendement pour tomate", () => {
    // Simuler les entrées du calculateur
    document.body.innerHTML = `
      <select id="est-crop-select"><option value="tomate" selected></option></select>
      <input id="est-surface" value="10">
      <input id="est-density" value="4">
      <input id="est-sowing-date" value="2026-06-01">
      <span id="est-yield-result"></span>
      <span id="est-yield-sub"></span>
    `;

    CropsModule.updateYieldEstimator();

    const result = document.getElementById("est-yield-result").textContent;
    expect(result).toContain("T");
  });

  test("devrait calculer le cycle pour oignon", () => {
    document.body.innerHTML = `
      <select id="est-crop-select"><option value="oignon" selected></option></select>
      <input id="est-surface" value="5">
      <input id="est-density" value="8">
      <input id="est-sowing-date" value="2026-06-01">
      <span id="est-date-result"></span>
    `;

    CropsModule.updateYieldEstimator();

    const harvestDate = document.getElementById("est-date-result").textContent;
    expect(harvestDate).not.toBe("-- -- ----");
  });

  test("devrait gérer les cultures vides", () => {
    // Mock empty crops
    mockKAStorage.getCrops = () => [];

    document.body.innerHTML = `
      <div id="crops-container"></div>
    `;

    CropsModule.renderCrops();

    const container = document.getElementById("crops-container");
    expect(container.innerHTML).toContain("Aucune culture");
  });

  test("devrait ajouter une culture", () => {
    const crops = [];
    mockKAStorage.saveCrops(crops);

    document.body.innerHTML = `
      <form id="shared-crop-form">
        <input id="form-crop-name" value="Tomate Test">
        <select id="form-crop-field-select"><option value="Parcelle Nord" selected></option></select>
        <input id="form-crop-sowing" value="2026-06-01">
        <input id="form-crop-harvest" value="2026-08-01">
        <input id="form-crop-status" value="Croissance">
        <input id="form-crop-water" value="Optimale">
        <input id="form-crop-fert" value="OK">
        <div id="crops-container"></div>
      </form>
    `;

    const form = document.getElementById("shared-crop-form");
    form.dispatchEvent(new Event("submit"));

    const savedCrops = JSON.parse(localStorage.getItem("ka_farm_crops"));
    expect(savedCrops.length).toBe(1);
    expect(savedCrops[0].name).toBe("Tomate Test");
  });

  test("devrait supprimer une culture", () => {
    const crops = [
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
    ];
    mockKAStorage.saveCrops(crops);

    document.body.innerHTML = `
      <div id="crops-container"></div>
    `;

    window.confirm = jest.fn(() => true);
    window.deleteCrop("C-123");

    const savedCrops = JSON.parse(localStorage.getItem("ka_farm_crops"));
    expect(savedCrops.length).toBe(0);
    expect(window.confirm).toHaveBeenCalled();
  });

  test("devrait basculer le statut hydrique", () => {
    const crops = [{ id: "C-1", name: "Test", waterStatus: "Optimale" }];
    mockKAStorage.saveCrops(crops);

    document.body.innerHTML = `
      <div id="crops-container"></div>
    `;

    window.toggleWaterStatus("C-1");

    const savedCrops = JSON.parse(localStorage.getItem("ka_farm_crops"));
    expect(savedCrops[0].waterStatus).toBe("Besoin d'eau");
  });

  test("devrait créer une pépinière", () => {
    const nurseries = [];
    mockKAStorage.saveNurseries(nurseries);

    document.body.innerHTML = `
      <form id="shared-nursery-form">
        <input id="form-nursery-name" value="Pépinière Test">
        <select id="form-nursery-crop"><option value="Tomate" selected></option></select>
        <input id="form-nursery-qty" value="100">
        <input id="form-nursery-sowing" value="2026-06-01">
        <input id="form-nursery-transplant" value="2026-07-01">
        <input id="form-nursery-status" value="Semis">
        <div id="nurseries-container"></div>
      </form>
    `;

    const form = document.getElementById("shared-nursery-form");
    form.dispatchEvent(new Event("submit"));

    const savedNurseries = JSON.parse(localStorage.getItem("ka_farm_nurseries"));
    expect(savedNurseries.length).toBe(1);
    expect(savedNurseries[0].name).toBe("Pépinière Test");
  });

  test("devrait faire évoluer le statut de pépinière", () => {
    const nurseries = [
      {
        id: "PEP-1",
        name: "Test",
        status: "Semis",
        sowingDate: "2026-06-01",
        plannedTransplantDate: "2026-07-01",
        quantityEst: 50,
        healthStatus: "Excellent",
      },
    ];
    mockKAStorage.saveNurseries(nurseries);

    document.body.innerHTML = `
      <div id="nurseries-container"></div>
    `;

    window.confirm = jest.fn(() => true);
    window.nextNurseryStatus("PEP-1");

    const savedNurseries = JSON.parse(localStorage.getItem("ka_farm_nurseries"));
    expect(savedNurseries[0].status).toBe("Levée");
  });

  test("devrait filtrer les cultures par recherche", () => {
    const crops = [
      {
        id: "C-1",
        name: "Tomate Mongal",
        field: "Nord",
        seedType: "Hybride",
        season: "Saison Sèche",
      },
      { id: "C-2", name: "Oignon Rouge", field: "Sud", seedType: "Locale", season: "Saison Pluie" },
    ];
    mockKAStorage.saveCrops(crops);

    document.body.innerHTML = `
      <input id="crops-search" value="tomate">
      <div id="crops-container"></div>
    `;

    window.filterActiveCrops();

    // Le filtre devrait trouver la tomate
    const container = document.getElementById("crops-container");
    expect(container.innerHTML).toContain("Tomate Mongal");
  });
});
