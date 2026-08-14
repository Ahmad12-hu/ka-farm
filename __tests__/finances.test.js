// KA Farm - Tests pour le module Finances
import { FinancesModule } from "../js/modules/finances.js";

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
  getFinances: () => [],
  saveFinances: (finances) => {
    localStorage.setItem("ka_farm_finances", JSON.stringify(finances));
  },
  getFinanceStats: () => ({ totalRevenu: 0, totalDepense: 0, solde: 0 }),
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

describe("FinancesModule", () => {
  beforeEach(() => {
    localStorage.clear();
    // Empêcher le chargement des données de démonstration
    localStorage.setItem("ka_farm_finances", JSON.stringify([]));
    // Réinitialiser la simulation de confirm
    window.confirm = jest.fn(() => true);
  });

  test("devrait initialiser le module sans erreur", () => {
    // Simuler les éléments DOM requis pour l'initialisation
    document.body.innerHTML = `
      <tbody id="finances-table-body"></tbody>
      <span id="finances-total-revenu"></span>
      <span id="finances-total-depense"></span>
      <span id="finances-total-solde"></span>
      <div id="compost-carbon-input"></div>
      <div id="compost-nitrogen-input"></div>
      <div id="compost-result-box"></div>
      <span id="compost-ratio-text"></span>
      <span id="compost-status-label"></span>
      <span id="compost-advice-text"></span>
    `;
    expect(() => FinancesModule.init()).not.toThrow();
  });

  test("devrait calculer le ratio de compost", () => {
    document.body.innerHTML = `
      <input id="compost-carbon-input" value="10">
      <input id="compost-nitrogen-input" value="2">
      <div id="compost-result-box"></div>
      <span id="compost-ratio-text"></span>
      <span id="compost-status-label"></span>
      <span id="compost-advice-text"></span>
    `;

    FinancesModule.calculateCompost();

    const ratioText = document.getElementById("compost-ratio-text").textContent;
    expect(ratioText).toContain("C/N");
  });

  test("devrait identifier un excès de carbone", () => {
    document.body.innerHTML = `
      <input id="compost-carbon-input" value="20">
      <input id="compost-nitrogen-input" value="1">
      <div id="compost-result-box"></div>
      <span id="compost-ratio-text"></span>
      <span id="compost-status-label"></span>
      <span id="compost-advice-text"></span>
    `;

    FinancesModule.calculateCompost();

    const statusLabel = document.getElementById("compost-status-label").textContent;
    expect(statusLabel).toContain("EXCES DE CARBONE");
  });

  test("devrait identifier un excès d'azote", () => {
    document.body.innerHTML = `
      <input id="compost-carbon-input" value="2">
      <input id="compost-nitrogen-input" value="10">
      <div id="compost-result-box"></div>
      <span id="compost-ratio-text"></span>
      <span id="compost-status-label"></span>
      <span id="compost-advice-text"></span>
    `;

    FinancesModule.calculateCompost();

    const statusLabel = document.getElementById("compost-status-label").textContent;
    expect(statusLabel).toContain("EXCES D'AZOTE");
  });

  test("devrait identifier un ratio équilibré", () => {
    document.body.innerHTML = `
      <input id="compost-carbon-input" value="12">
      <input id="compost-nitrogen-input" value="3">
      <div id="compost-result-box"></div>
      <span id="compost-ratio-text"></span>
      <span id="compost-status-label"></span>
      <span id="compost-advice-text"></span>
    `;

    FinancesModule.calculateCompost();

    const statusLabel = document.getElementById("compost-status-label").textContent;
    expect(statusLabel).toContain("EQUILIBRE");
  });

  test("devrait gérer les finances vides", () => {
    mockKAStorage.getFinances = () => [];

    document.body.innerHTML = `
      <tbody id="finances-table-body"></tbody>
      <span id="finances-total-revenu"></span>
      <span id="finances-total-depense"></span>
      <span id="finances-total-solde"></span>
    `;

    FinancesModule.renderFinances();

    const tbody = document.getElementById("finances-table-body");
    expect(tbody.innerHTML).toContain("Aucun flux financier");
  });

  test("devrait ajouter une transaction financière", () => {
    const finances = [];
    mockKAStorage.saveFinances(finances);

    document.body.innerHTML = `
      <form id="shared-finance-form">
        <input id="form-fin-desc" value="Vente tomates">
        <select id="form-fin-type"><option value="Revenu" selected></option></select>
        <select id="form-fin-cat"><option value="Vente" selected></option></select>
        <input id="form-fin-amount" value="50000">
        <input id="form-fin-date" value="2026-06-15">
        <tbody id="finances-table-body"></tbody>
      </form>
    `;

    const form = document.getElementById("shared-finance-form");
    form.dispatchEvent(new Event("submit"));

    const savedFinances = JSON.parse(localStorage.getItem("ka_farm_finances"));
    expect(savedFinances.length).toBe(1);
    expect(savedFinances[0].description).toBe("Vente tomates");
    expect(savedFinances[0].amount).toBe(50000);

    // Reset date field
    const dateField = document.getElementById("form-fin-date");
    if (dateField) dateField.value = "2026-06-26";
  });

  test("devrait supprimer une transaction", () => {
    const finances = [
      {
        id: "F-123",
        description: "Test",
        type: "Revenu",
        category: "Vente",
        amount: 1000,
        date: "2026-06-15",
      },
    ];
    mockKAStorage.saveFinances(finances);

    document.body.innerHTML = `
      <tbody id="finances-table-body"></tbody>
    `;

    window.confirm = jest.fn(() => true);
    window.deleteFinance("F-123");

    const savedFinances = JSON.parse(localStorage.getItem("ka_farm_finances"));
    expect(savedFinances.length).toBe(0);
    expect(window.confirm).toHaveBeenCalled();
  });

  test("devrait calculer les marges par parcelle", () => {
    const finances = [
      {
        id: "F-1",
        description: "Vente Parcelle Nord",
        type: "Revenu",
        amount: 100000,
        parcelId: "P-001",
        cropName: "Tomate",
      },
      {
        id: "F-2",
        description: "Dépense Parcelle Nord",
        type: "Dépense",
        amount: 50000,
        parcelId: "P-001",
        cropName: "Tomate",
      },
    ];
    mockKAStorage.saveFinances(finances);

    document.body.innerHTML = `
      <tbody id="parcel-margins-table-body"></tbody>
      <canvas id="parcel-margins-chart"></canvas>
      <div id="finances-table-body"></div>
    `;

    FinancesModule.renderCharts();

    const tbody = document.getElementById("parcel-margins-table-body");
    expect(tbody.innerHTML).toContain("Parcelle Nord");
    expect(tbody.innerHTML).toContain("50 000"); // Marge nette
  });

  test("devrait calculer les marges par culture", () => {
    const finances = [
      {
        id: "F-1",
        description: "Vente tomates",
        type: "Revenu",
        amount: 200000,
        cropName: "Tomate Mongal F1",
      },
      {
        id: "F-2",
        description: "Achat semences tomates",
        type: "Dépense",
        amount: 80000,
        cropName: "Tomate Mongal F1",
      },
    ];
    mockKAStorage.saveFinances(finances);

    document.body.innerHTML = `
      <tbody id="crop-margins-table-body"></tbody>
      <canvas id="crop-performance-chart"></canvas>
      <div id="finances-table-body"></div>
    `;

    FinancesModule.renderCharts();

    const tbody = document.getElementById("crop-margins-table-body");
    expect(tbody.innerHTML).toContain("Tomate Mongal F1");
    expect(tbody.innerHTML).toContain("120 000"); // Marge nette
  });

  test("devrait mettre à jour le simulateur de marché", () => {
    document.body.innerHTML = `
      <input id="cost-seeds" value="10000">
      <input id="cost-fertilizers" value="5000">
      <input id="cost-fuel" value="3000">
      <input id="cost-labor" value="20000">
      <input id="cost-others" value="2000">
      <input id="param-yield" value="1000">
      <select id="market-crop-select"><option value="tomate" selected></option></select>
      <span id="calc-total-cost"></span>
      <span id="calc-cost-per-kg"></span>
      <span id="calc-net-profit"></span>
      <span id="calc-roi"></span>
      <div id="profit-advice-title"></div>
      <div id="profit-advice-desc"></div>
      <div id="profit-indicator-icon"></div>
    `;

    FinancesModule.updateMarketCalculations();

    const totalCost = document.getElementById("calc-total-cost").textContent;
    expect(totalCost).toContain("40 000");
  });

  test("devrait calculer le ROI positif", () => {
    document.body.innerHTML = `
      <input id="cost-seeds" value="10000">
      <input id="cost-fertilizers" value="5000">
      <input id="cost-fuel" value="3000">
      <input id="cost-labor" value="20000">
      <input id="cost-others" value="2000">
      <input id="param-yield" value="1000">
      <select id="market-crop-select"><option value="tomate" selected></option></select>
      <span id="calc-total-cost"></span>
      <span id="calc-cost-per-kg"></span>
      <span id="calc-net-profit"></span>
      <span id="calc-roi"></span>
    `;

    FinancesModule.updateMarketCalculations();

    const roi = document.getElementById("calc-roi").textContent;
    expect(roi).toContain("+"); // ROI positif
  });

  test("devrait calculer le ROI négatif", () => {
    document.body.innerHTML = `
      <input id="cost-seeds" value="100000">
      <input id="cost-fertilizers" value="50000">
      <input id="cost-fuel" value="30000">
      <input id="cost-labor" value="200000">
      <input id="cost-others" value="20000">
      <input id="param-yield" value="500">
      <select id="market-crop-select"><option value="tomate" selected></option></select>
      <span id="calc-total-cost"></span>
      <span id="calc-cost-per-kg"></span>
      <span id="calc-net-profit"></span>
      <span id="calc-roi"></span>
    `;

    FinancesModule.updateMarketCalculations();

    const roi = document.getElementById("calc-roi").textContent;
    expect(roi).toContain("-"); // ROI négatif
  });

  test("devrait afficher les marchés disponibles", () => {
    document.body.innerHTML = `
      <select id="market-crop-select"><option value="tomate" selected></option></select>
      <div id="markets-comparison-grid"></div>
    `;

    FinancesModule.renderMarkets();

    const grid = document.getElementById("markets-comparison-grid");
    expect(grid.innerHTML).toContain("Sandiara");
    expect(grid.innerHTML).toContain("Mbour");
    expect(grid.innerHTML).toContain("Dakar");
  });

  test("devrait changer le marché sélectionné", () => {
    FinancesModule.selectedMarket = "mbour";

    FinancesModule.setSimSelectedMarket("dakar");

    expect(FinancesModule.selectedMarket).toBe("dakar");
  });
});
