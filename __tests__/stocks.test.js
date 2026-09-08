// KA Farm - Tests pour le module Stocks
import { StocksModule } from "../js/modules/stocks.js";
import { KAStorage } from "../js/storage.js";

// Méthode de domaine manquante sur KAStorage (coeur) - rattachée au singleton partagé.
if (!KAStorage.getStocks) KAStorage.getStocks = () => KAStorage.get("ka_farm_stocks", []);
if (!KAStorage.saveStocks) KAStorage.saveStocks = (s) => KAStorage.set("ka_farm_stocks", s);

// Mocks globaux
window.confirm = jest.fn(() => true);
window.lucide = { createIcons: () => {} };
window.App = { updateBadges: () => {} };

const stockEls = (html = "") => {
  document.body.innerHTML = `
    <div id="stocks-container"></div>
    <div id="low-stocks-container"></div>
    <div id="stock-usage-history"></div>
    <div id="network-status-badge"></div>
    <div id="network-status-dot"></div>
    <span id="network-status-text"></span>
    <button id="toggle-offline-btn"></button>
    <span id="offline-toggle-text"></span>
    <i id="offline-toggle-icon"></i>
    <input id="stock-search-input" value="">
    <select id="stock-category-filter"><option value="all" selected></option></select>
    <span id="stocks-total-count"></span>
    <span id="stocks-alert-count"></span>
    <span id="stocks-average-percent"></span>
    <form id="new-stock-form">
      <input id="new-stock-name">
      <select id="new-stock-cat"></select>
      <input id="new-stock-unit">
      <input id="new-stock-qty">
      <input id="new-stock-max">
    </form>
    <div id="add-stock-modal" class="hidden"></div>
    <div id="adjust-stock-modal" class="hidden">
      <input id="adjust-item-id">
      <span id="adjust-item-name"></span>
      <span id="adjust-item-current"></span>
      <span id="adjust-unit-display"></span>
      <input id="adjust-amount">
      <input id="adjust-note">
      <select id="adjust-op-type"><option value="add" selected></option></select>
    </div>
    <form id="adjust-stock-form"></form>
    ${html}
  `;
};

describe("StocksModule", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ka_farm_stocks", JSON.stringify([]));
    window.confirm = jest.fn(() => true);
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => [], status: 200 })
    );
  });

  test("devrait initialiser le module sans erreur", async () => {
    stockEls();
    await expect(StocksModule.init()).resolves.toBeUndefined();
  });

  test("devrait ajouter un article en stock via le formulaire", () => {
    stockEls();
    document.getElementById("new-stock-name").value = "Engrais NPK";
    document.getElementById("new-stock-cat").innerHTML =
      '<option value="Engrais" selected></option>';
    document.getElementById("new-stock-unit").value = "kg";
    document.getElementById("new-stock-qty").value = "50";
    document.getElementById("new-stock-max").value = "100";

    StocksModule.setupListeners();
    document.getElementById("new-stock-form").dispatchEvent(new Event("submit"));

    const saved = JSON.parse(localStorage.getItem("ka_farm_stocks"));
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe("Engrais NPK");
    expect(saved[0].quantity).toBe(50);
    expect(saved[0].maxQuantity).toBe(100);
  });

  test("devrait ajuster la quantité d'un stock", () => {
    localStorage.setItem(
      "ka_farm_stocks",
      JSON.stringify([
        { id: "S-1", name: "Engrais NPK", category: "Engrais", quantity: 50, maxQuantity: 100, unit: "kg" },
      ])
    );
    stockEls();
    document.getElementById("adjust-item-id").value = "S-1";
    document.getElementById("adjust-amount").value = "30";
    document.getElementById("adjust-op-type").value = "add";

    StocksModule.setupListeners();
    document.getElementById("adjust-stock-form").dispatchEvent(new Event("submit"));

    const saved = JSON.parse(localStorage.getItem("ka_farm_stocks"));
    expect(saved[0].quantity).toBe(80); // 50 + 30
  });

  test("devrait supprimer un article du stock", () => {
    localStorage.setItem(
      "ka_farm_stocks",
      JSON.stringify([
        { id: "S-1", name: "Engrais NPK", category: "Engrais", quantity: 50, maxQuantity: 100, unit: "kg" },
      ])
    );
    stockEls();

    StocksModule.setupListeners();
    window.deleteStockItem("S-1");

    expect(JSON.parse(localStorage.getItem("ka_farm_stocks")).length).toBe(0);
  });

  test("devrait filtrer les stocks par catégorie", () => {
    localStorage.setItem(
      "ka_farm_stocks",
      JSON.stringify([
        { id: "S-1", name: "Engrais NPK", category: "Engrais", quantity: 50, maxQuantity: 100, unit: "kg" },
        { id: "S-2", name: "Semences Tomate", category: "Semences", quantity: 2, maxQuantity: 10, unit: "kg" },
      ])
    );
    stockEls();
    document.getElementById("stock-category-filter").innerHTML =
      '<option value="all"></option><option value="Engrais" selected></option>';

    StocksModule.setupListeners();
    StocksModule.renderStocks();

    const container = document.getElementById("stocks-container").innerHTML;
    expect(container).toContain("Engrais NPK");
    expect(container).not.toContain("Semences Tomate");
  });

  test("devrait compter les stocks bas (alerte)", () => {
    localStorage.setItem(
      "ka_farm_stocks",
      JSON.stringify([
        { id: "S-1", name: "Engrais NPK", category: "Engrais", quantity: 5, maxQuantity: 100, unit: "kg" }, // <= 20% => bas
        { id: "S-2", name: "Semences Tomate", category: "Semences", quantity: 100, maxQuantity: 200, unit: "kg" },
      ])
    );
    stockEls();

    StocksModule.setupListeners();
    StocksModule.renderStocks();

    // Huit intrants avec quantité <= 20% de la capacité => 1 alerte
    expect(document.getElementById("stocks-alert-count").textContent).toBe("1");
  });
});