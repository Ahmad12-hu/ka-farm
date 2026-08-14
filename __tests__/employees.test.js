// KA Farm - Tests pour le module Employés
import { EmployeesModule } from "../js/modules/employees.js";

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
  getEmployees: () => [],
  saveEmployees: (emp) => {
    localStorage.setItem("ka_farm_employees", JSON.stringify(emp));
  },
  getAttendance: () => [],
  saveAttendance: (att) => {
    localStorage.setItem("ka_farm_attendance", JSON.stringify(att));
  },
  getEmployeePayments: () => [],
  saveEmployeePayments: (pay) => {
    localStorage.setItem("ka_farm_employee_payments", JSON.stringify(pay));
  },
  getTasks: () => [],
  saveTasks: (tasks) => {
    localStorage.setItem("ka_farm_tasks", JSON.stringify(tasks));
  },
  getFinances: () => [],
  saveFinances: (fin) => {
    localStorage.setItem("ka_farm_finances", JSON.stringify(fin));
  },
  getScopedKey: (key) => key,
  init: () => {},
};

Object.defineProperty(window, "KAStorage", { value: mockKAStorage });

// Simuler window.confirm
window.confirm = () => true;

// Simuler fetch
global.fetch = () => Promise.resolve({});

describe("EmployeesModule", () => {
  beforeEach(() => {
    localStorage.clear();
    // Empêcher le chargement des données de démonstration
    localStorage.setItem("ka_farm_employees", JSON.stringify([]));
    localStorage.setItem("ka_farm_attendance", JSON.stringify([]));
    localStorage.setItem("ka_farm_employee_payments", JSON.stringify([]));
    localStorage.setItem("ka_farm_tasks", JSON.stringify([]));
  });

  test("devrait initialiser le module sans erreur", () => {
    document.body.innerHTML = `
      <div id="employees-table-body"></div>
      <div id="attendance-table-body"></div>
      <div id="payments-history-list"></div>
    `;
    expect(() => EmployeesModule.init()).not.toThrow();
  });

  test("devrait ajouter un employé", () => {
    const employees = [];
    mockKAStorage.saveEmployees(employees);

    document.body.innerHTML = `
      <form id="add-employee-form">
        <input id="form-emp-name" value="Amadou Diallo">
        <input id="form-emp-phone" value="771234567">
        <select id="form-emp-role"><option value="Ouvrier" selected></option></select>
        <input id="form-emp-rate" value="3500">
        <select id="form-emp-status"><option value="Actif" selected></option></select>
      </form>
      <div id="employees-table-body"></div>
    `;

    const form = document.getElementById("add-employee-form");
    form.dispatchEvent(new Event("submit"));

    const savedEmployees = JSON.parse(localStorage.getItem("ka_farm_employees"));
    expect(savedEmployees.length).toBe(1);
    expect(savedEmployees[0].name).toBe("Amadou Diallo");
    expect(savedEmployees[0].dailyRate).toBe(3500);
  });

  test("devrait modifier un employé", () => {
    const employees = [
      {
        id: "E-001",
        name: "Amadou Diallo",
        phone: "771234567",
        role: "Ouvrier",
        dailyRate: 3500,
        status: "Actif",
      },
    ];
    mockKAStorage.saveEmployees(employees);

    document.body.innerHTML = `
      <form id="edit-employee-form">
        <input id="form-edit-emp-id" value="E-001">
        <input id="form-edit-emp-name" value="Amadou Diallo Modifié">
        <input id="form-edit-emp-phone" value="771234567">
        <input id="form-edit-emp-role" value="Ouvrier">
        <input id="form-edit-emp-rate" value="4000">
        <select id="form-edit-emp-status"><option value="Actif" selected></option></select>
      </form>
      <div id="employees-table-body"></div>
    `;

    const form = document.getElementById("edit-employee-form");
    form.dispatchEvent(new Event("submit"));

    const savedEmployees = JSON.parse(localStorage.getItem("ka_farm_employees"));
    expect(savedEmployees[0].name).toBe("Amadou Diallo Modifié");
    expect(savedEmployees[0].dailyRate).toBe(4000);
  });

  test("devrait supprimer un employé", () => {
    const employees = [
      {
        id: "E-001",
        name: "Amadou Diallo",
        phone: "771234567",
        role: "Ouvrier",
        dailyRate: 3500,
        status: "Actif",
      },
    ];
    mockKAStorage.saveEmployees(employees);

    document.body.innerHTML = `
      <div id="employees-table-body"></div>
    `;

    window.deleteEmployee("E-001");

    const savedEmployees = JSON.parse(localStorage.getItem("ka_farm_employees"));
    expect(savedEmployees.length).toBe(0);
  });

  test("devrait enregistrer un pointage journalier", () => {
    const employees = [
      {
        id: "E-001",
        name: "Amadou Diallo",
        phone: "771234567",
        role: "Ouvrier",
        dailyRate: 3500,
        status: "Actif",
      },
    ];
    mockKAStorage.saveEmployees(employees);

    document.body.innerHTML = `
      <form id="attendance-form">
        <input type="radio" name="status-E-001" value="Présent" checked>
        <input type="text" name="notes-E-001" value="Aucune note">
      </form>
      <input id="attendance-date" value="2026-06-26">
      <div id="attendance-table-body"></div>
    `;

    const form = document.getElementById("attendance-form");
    form.dispatchEvent(new Event("submit"));

    const savedAttendance = JSON.parse(localStorage.getItem("ka_farm_attendance"));
    expect(savedAttendance.length).toBe(1);
    expect(savedAttendance[0].employeeId).toBe("E-001");
    expect(savedAttendance[0].status).toBe("Présent");
  });

  test("devrait calculer le salaire correctement", () => {
    const employees = [
      {
        id: "E-001",
        name: "Amadou Diallo",
        phone: "771234567",
        role: "Ouvrier",
        dailyRate: 3500,
        status: "Actif",
      },
    ];
    const attendance = [
      { employeeId: "E-001", date: "2026-06-01", status: "Présent", notes: "" },
      { employeeId: "E-001", date: "2026-06-02", status: "Présent", notes: "" },
      { employeeId: "E-001", date: "2026-06-03", status: "Demi-journée", notes: "" },
    ];
    mockKAStorage.saveEmployees(employees);
    mockKAStorage.saveAttendance(attendance);

    document.body.innerHTML = `
      <select id="calc-employee-select"><option value="E-001" selected></option></select>
      <input id="calc-start-date" value="2026-06-01">
      <input id="calc-end-date" value="2026-06-03">
      <span id="calc-days-present"></span>
      <span id="calc-days-half"></span>
      <span id="calc-days-absent"></span>
      <span id="calc-gross-salary"></span>
      <span id="calc-already-paid"></span>
      <span id="calc-net-due"></span>
    `;

    window.calculateSalary();

    const grossSalary = document.getElementById("calc-gross-salary").textContent;
    expect(grossSalary).toBe("9 500"); // 2.5 jours * 3500
  });

  test("devrait filtrer les employés par recherche", () => {
    const employees = [
      {
        id: "E-001",
        name: "Amadou Diallo",
        phone: "771234567",
        role: "Ouvrier",
        dailyRate: 3500,
        status: "Actif",
      },
      {
        id: "E-002",
        name: "Fatou Sow",
        phone: "781234567",
        role: "Responsable",
        dailyRate: 5000,
        status: "Actif",
      },
    ];
    mockKAStorage.saveEmployees(employees);

    document.body.innerHTML = `
      <input id="search-employees" value="amadou">
      <div id="employees-table-body"></div>
    `;

    EmployeesModule.filterEmployees("amadou");

    const tbody = document.getElementById("employees-table-body");
    expect(tbody.innerHTML).toContain("Amadou Diallo");
    expect(tbody.innerHTML).not.toContain("Fatou Sow");
  });
});
