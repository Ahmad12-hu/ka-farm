// KA Farm - Tests pour le module Finances
import { FinancesModule } from "../js/modules/finances.js";

// Mocks globaux
window.confirm = jest.fn(() => true);
window.lucide = { createIcons: () => {} };
window.App = { updateBadges: () => {} };
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => [] }));
// Chart.js n'est pas chargé en environnement de test (représentation graphique)
global.Chart = class Chart {
  constructor() {}
  destroy() {}
  update() {}
};

const norm = (s) => String(s).replace(/[\u202F\u00A0]/g, " ");

function finEls(html) {
  document.body.innerHTML = `
    <table><tbody id="finances-table-body"></tbody></table>
    <span id="finances-total-revenu"></span>
    <span id="finances-total-depense"></span>
    <span id="finances-total-solde"></span>
    <table><tbody id="parcel-margins-table-body"></tbody></table>
    <table><tbody id="crop-margins-table-body"></tbody></table>
    <canvas id="parcel-margins-chart"></canvas>
    <canvas id="crop-performance-chart"></canvas>
    <input id="compost-carbon-input">
    <input id="compost-nitrogen-input">
    <div id="compost-result-box" class="hidden"></div>
    <span id="compost-ratio-text"></span>
    <span id="compost-status-label"></span>
    <span id="compost-advice-text"></span>
    <form id="shared-finance-form">
      <input id="form-fin-desc">
      <select id="form-fin-type"></select>
      <select id="form-fin-cat"></select>
      <input id="form-fin-amount">
      <input id="form-fin-date">
      <input id="form-fin-parcel">
      <input id="form-fin-crop">
    </form>
    <div id="finance-modal" class="hidden"></div>
    <input id="cost-seeds">
    <input id="cost-fertilizers">
    <input id="cost-fuel">
    <input id="cost-labor">
    <input id="cost-others">
    <input id="param-yield">
    <select id="market-crop-select"><option value="tomate" selected></option></select>
    <span id="calc-total-cost"></span>
    <span id="calc-cost-per-kg"></span>
    <span id="calc-net-profit"></span>
    <span id="calc-roi"></span>
    <span id="yield-display"></span>
    <div id="markets-comparison-grid"></div>
    <div id="profit-advice-title"></div>
    <div id="profit-advice-desc"></div>
    <div id="profit-indicator-icon"></div>
    ${html}
  `;
}

describe("FinancesModule", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ka_farm_finances", JSON.stringify([]));
    window.confirm = jest.fn(() => true);
  });

  test("devrait initialiser le module sans erreur", () => {
    finEls("");
    expect(() => FinancesModule.init()).not.toThrow();
  });

  test("devrait calculer le ratio de compost", () => {
    finEls("");
    document.getElementById("compost-carbon-input").value = "10";
    document.getElementById("compost-nitrogen-input").value = "2";
    FinancesModule.calculateCompost();
    expect(document.getElementById("compost-ratio-text").textContent).toContain("C/N");
  });

  test("devrait identifier un excès de carbone", () => {
    finEls("");
    document.getElementById("compost-carbon-input").value = "20";
    document.getElementById("compost-nitrogen-input").value = "1";
    FinancesModule.calculateCompost();
    expect(document.getElementById("compost-status-label").textContent).toContain(
      "EXCES DE CARBONE"
    );
  });

  test("devrait identifier un excès d'azote", () => {
    finEls("");
    document.getElementById("compost-carbon-input").value = "2";
    document.getElementById("compost-nitrogen-input").value = "10";
    FinancesModule.calculateCompost();
    expect(document.getElementById("compost-status-label").textContent).toContain("EXCES D'AZOTE");
  });

  test("devrait identifier un ratio équilibré", () => {
    finEls("");
    // C/N = (5*60 + 10*15) / (5+10) = 30 => dans la zone idéale [25,35]
    document.getElementById("compost-carbon-input").value = "5";
    document.getElementById("compost-nitrogen-input").value = "10";
    FinancesModule.calculateCompost();
    expect(document.getElementById("compost-status-label").textContent).toContain("ÉQUILIBRÉ");
  });

  test("devrait gérer les finances vides", () => {
    finEls("");
    FinancesModule.renderFinances();
    expect(document.getElementById("finances-table-body").innerHTML).toContain(
      "Aucun flux financier"
    );
  });

  test("devrait ajouter une transaction financière via le formulaire", () => {
    finEls("");
    document.getElementById("form-fin-desc").value = "Vente tomates";
    document.getElementById("form-fin-type").innerHTML =
      '<option value="Revenu" selected></option>';
    document.getElementById("form-fin-cat").innerHTML =
      '<option value="Vente" selected></option>';
    document.getElementById("form-fin-amount").value = "50000";
    document.getElementById("form-fin-date").value = "2026-06-15";

    FinancesModule.init();
    document.getElementById("shared-finance-form").dispatchEvent(new Event("submit"));

    const saved = JSON.parse(localStorage.getItem("ka_farm_finances"));
    expect(saved.length).toBe(1);
    expect(saved[0].description).toBe("Vente tomates");
    expect(saved[0].amount).toBe(50000);
  });

  test("devrait supprimer une transaction", () => {
    localStorage.setItem(
      "ka_farm_finances",
      JSON.stringify([
        { id: "F-123", description: "Test", type: "Revenu", category: "Vente", amount: 1000, date: "2026-06-15" },
      ])
    );
    finEls("");

    FinancesModule.init();
    window.deleteFinance("F-123");

    expect(JSON.parse(localStorage.getItem("ka_farm_finances")).length).toBe(0);
    expect(window.confirm).toHaveBeenCalled();
  });

  test("devrait calculer les marges par parcelle", () => {
    localStorage.setItem(
      "ka_farm_finances",
      JSON.stringify([
        { id: "F-1", description: "Vente Parcelle Nord", type: "Revenu", amount: 100000, parcelId: "P-001", cropName: "Tomate" },
        { id: "F-2", description: "Dépense Parcelle Nord", type: "Dépense", amount: 50000, parcelId: "P-001", cropName: "Tomate" },
      ])
    );
    finEls("");

    FinancesModule.renderCharts();

    const tbody = document.getElementById("parcel-margins-table-body");
    expect(tbody.innerHTML).toContain("Parcelle Nord");
    // Marge nette = 100000 - 50000 = 50000
    expect(norm(tbody.innerHTML)).toContain("50 000");
  });

  test("devrait calculer les marges par culture", () => {
    localStorage.setItem(
      "ka_farm_finances",
      JSON.stringify([
        { id: "F-1", description: "Vente tomates", type: "Revenu", amount: 200000, cropName: "Tomate Mongal F1" },
        { id: "F-2", description: "Achat semences tomates", type: "Dépense", amount: 80000, cropName: "Tomate Mongal F1" },
      ])
    );
    finEls("");

    FinancesModule.renderCharts();

    const tbody = document.getElementById("crop-margins-table-body");
    expect(tbody.innerHTML).toContain("Tomate Mongal F1");
    expect(norm(tbody.innerHTML)).toContain("120 000"); // 200000 - 80000
  });

  test("devrait mettre à jour le simulateur de marché (coût total)", () => {
    finEls("");
    document.getElementById("cost-seeds").value = "10000";
    document.getElementById("cost-fertilizers").value = "5000";
    document.getElementById("cost-fuel").value = "3000";
    document.getElementById("cost-labor").value = "20000";
    document.getElementById("cost-others").value = "2000";
    document.getElementById("param-yield").value = "1000";

    FinancesModule.updateMarketCalculations();

    // Coût total = 10000+5000+3000+20000+2000 = 40000
    expect(norm(document.getElementById("calc-total-cost").textContent)).toContain("40 000");
  });

  test("devrait calculer le ROI positif", () => {
    finEls("");
    document.getElementById("cost-seeds").value = "10000";
    document.getElementById("cost-fertilizers").value = "5000";
    document.getElementById("cost-fuel").value = "3000";
    document.getElementById("cost-labor").value = "20000";
    document.getElementById("cost-others").value = "2000";
    document.getElementById("param-yield").value = "1000";

    FinancesModule.updateMarketCalculations();

    const roi = document.getElementById("calc-roi").textContent;
    expect(roi).toContain("+");
  });

  test("devrait calculer le ROI négatif", () => {
    finEls("");
    document.getElementById("cost-seeds").value = "100000";
    document.getElementById("cost-fertilizers").value = "50000";
    document.getElementById("cost-fuel").value = "30000";
    document.getElementById("cost-labor").value = "200000";
    document.getElementById("cost-others").value = "20000";
    document.getElementById("param-yield").value = "500";

    FinancesModule.updateMarketCalculations();

    const roi = document.getElementById("calc-roi").textContent;
    expect(roi).toContain("-");
  });

  test("devrait afficher les marchés disponibles", () => {
    finEls("");
    FinancesModule.renderMarkets();
    const grid = document.getElementById("markets-comparison-grid").innerHTML;
    expect(grid).toContain("Sandiara");
    expect(grid).toContain("Mbour");
    expect(grid).toContain("Dakar");
  });

  test("devrait changer le marché sélectionné", () => {
    finEls("");
    FinancesModule.initMarketSimulator();
    FinancesModule.selectedMarket = "mbour";
    window.setSimSelectedMarket("dakar");
    expect(FinancesModule.selectedMarket).toBe("dakar");
  });
});