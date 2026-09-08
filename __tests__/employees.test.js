// KA Farm - Tests pour le module Employés
import { EmployeesModule } from "../js/modules/employees.js";
import { KAStorage } from "../js/storage.js";

// Méthodes de domaine manquantes sur KAStorage (coeur) - rattachées au singleton partagé.
if (!KAStorage.getAttendance) KAStorage.getAttendance = () => KAStorage.get("ka_farm_attendance", []);
if (!KAStorage.saveAttendance) KAStorage.saveAttendance = (a) => KAStorage.set("ka_farm_attendance", a);
if (!KAStorage.getEmployeePayments)
  KAStorage.getEmployeePayments = () => KAStorage.get("ka_farm_employee_payments", []);
if (!KAStorage.saveEmployeePayments)
  KAStorage.saveEmployeePayments = (p) => KAStorage.set("ka_farm_employee_payments", p);

// Mocks globaux
window.confirm = jest.fn(() => true);
window.lucide = { createIcons: () => {} };
window.App = { updateBadges: () => {} };
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => [] }));

const norm = (s) => String(s).replace(/[\u202F\u00A0]/g, " ");

function empEls(html) {
  document.body.innerHTML = `
    <table><tbody id="employees-table-body"></tbody></table>
    <table><tbody id="attendance-table-body"></tbody></table>
    <div id="attendance-history-days"></div>
    <div id="payments-history-list"></div>
    <input id="attendance-date" value="2026-06-26">
    <span id="stat-total-employees"></span>
    <select id="calc-employee-select"></select>
    <input id="calc-start-date" value="2026-06-01">
    <input id="calc-end-date" value="2026-06-26">
    <span id="calc-days-present"></span>
    <span id="calc-days-half"></span>
    <span id="calc-days-absent"></span>
    <span id="calc-gross-salary"></span>
    <span id="calc-already-paid"></span>
    <span id="calc-net-due"></span>
    <button id="btn-trigger-payment"></button>
    <form id="add-employee-form">
      <input id="form-emp-name">
      <input id="form-emp-phone">
      <input id="form-emp-role">
      <input id="form-emp-rate">
      <select id="form-emp-status"></select>
    </form>
    <div id="add-employee-modal" class="hidden"></div>
    <form id="edit-employee-form">
      <input id="form-edit-emp-id">
      <input id="form-edit-emp-name">
      <input id="form-edit-emp-phone">
      <input id="form-edit-emp-role">
      <input id="form-edit-emp-rate">
      <select id="form-edit-emp-status"></select>
    </form>
    <div id="edit-employee-modal" class="hidden"></div>
    ${html}
  `;
}

describe("EmployeesModule", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("ka_farm_employees", JSON.stringify([]));
    localStorage.setItem("ka_farm_attendance", JSON.stringify([]));
    localStorage.setItem("ka_farm_employee_payments", JSON.stringify([]));
    localStorage.setItem("ka_farm_tasks", JSON.stringify([]));
    window.confirm = jest.fn(() => true);
  });

  test("devrait initialiser le module sans erreur", () => {
    empEls("");
    expect(() => EmployeesModule.init()).not.toThrow();
  });

  test("devrait ajouter un employé via le formulaire", () => {
    empEls("");
    document.getElementById("form-emp-name").value = "Amadou Diallo";
    document.getElementById("form-emp-phone").value = "771234567";
    document.getElementById("form-emp-role").value = "Ouvrier agricole";
    document.getElementById("form-emp-rate").value = "3500";
    document.getElementById("form-emp-status").innerHTML =
      '<option value="Actif" selected></option>';

    EmployeesModule.init();
    document.getElementById("add-employee-form").dispatchEvent(new Event("submit"));

    const saved = JSON.parse(localStorage.getItem("ka_farm_employees"));
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe("Amadou Diallo");
    expect(saved[0].dailyRate).toBe(3500);
  });

  test("devrait modifier un employé via le formulaire", () => {
    localStorage.setItem(
      "ka_farm_employees",
      JSON.stringify([
        { id: "E-001", name: "Amadou Diallo", phone: "771234567", role: "Ouvrier agricole", dailyRate: 3500, status: "Actif" },
      ])
    );
    empEls("");
    document.getElementById("form-edit-emp-id").value = "E-001";
    document.getElementById("form-edit-emp-name").value = "Amadou Diallo Modifié";
    document.getElementById("form-edit-emp-phone").value = "771234567";
    document.getElementById("form-edit-emp-role").value = "Chef d'Exploitation";
    document.getElementById("form-edit-emp-rate").value = "4000";
    document.getElementById("form-edit-emp-status").innerHTML =
      '<option value="Actif" selected></option>';

    EmployeesModule.init();
    document.getElementById("edit-employee-form").dispatchEvent(new Event("submit"));

    const saved = JSON.parse(localStorage.getItem("ka_farm_employees"));
    expect(saved[0].name).toBe("Amadou Diallo Modifié");
    expect(saved[0].dailyRate).toBe(4000);
  });

  test("devrait enregistrer un pointage journalier", () => {
    localStorage.setItem(
      "ka_farm_employees",
      JSON.stringify([
        { id: "E-001", name: "Amadou Diallo", phone: "771234567", role: "Ouvrier agricole", dailyRate: 3500, status: "Actif" },
      ])
    );
    empEls(`
      <form id="attendance-form">
        <input type="radio" name="status-E-001" value="Présent" checked>
        <input type="text" name="notes-E-001" value="Aucune note">
      </form>
    `);

    EmployeesModule.init();
    document.getElementById("attendance-form").dispatchEvent(new Event("submit"));

    const saved = JSON.parse(localStorage.getItem("ka_farm_attendance"));
    expect(saved.length).toBe(1);
    expect(saved[0].employeeId).toBe("E-001");
    expect(saved[0].status).toBe("Présent");
  });

  test("devrait calculer le salaire correctement", () => {
    localStorage.setItem(
      "ka_farm_employees",
      JSON.stringify([
        { id: "E-001", name: "Amadou Diallo", phone: "771234567", role: "Ouvrier agricole", dailyRate: 3500, status: "Actif" },
      ])
    );
    localStorage.setItem(
      "ka_farm_attendance",
      JSON.stringify([
        { employeeId: "E-001", date: "2026-06-01", status: "Présent", notes: "" },
        { employeeId: "E-001", date: "2026-06-02", status: "Présent", notes: "" },
        { employeeId: "E-001", date: "2026-06-03", status: "Demi-journée", notes: "" },
      ])
    );

    empEls("");
    EmployeesModule.init();
    window.calculateSalary();

    expect(norm(document.getElementById("calc-days-present").textContent)).toBe("2");
    expect(norm(document.getElementById("calc-days-half").textContent)).toBe("1");
    // 2 jours pleins + 1 demi-journée = 2.5 jours * 3500 = 8750
    expect(norm(document.getElementById("calc-gross-salary").textContent)).toBe("8 750");
  });

  test("devrait filtrer les employés par recherche", () => {
    localStorage.setItem(
      "ka_farm_employees",
      JSON.stringify([
        { id: "E-001", name: "Amadou Diallo", phone: "771234567", role: "Ouvrier agricole", dailyRate: 3500, status: "Actif" },
        { id: "E-002", name: "Fatou Sow", phone: "781234567", role: "Responsable terrain", dailyRate: 5000, status: "Actif" },
      ])
    );
    empEls('<input id="search-employees" value="amadou">');

    EmployeesModule.init();
    EmployeesModule.filterEmployees("amadou");

    const tbody = document.getElementById("employees-table-body");
    expect(tbody.innerHTML).toContain("Amadou Diallo");
    expect(tbody.innerHTML).not.toContain("Fatou Sow");
  });
});