// KA Farm - Module des commandes groupées d'intrants
// Fonctionnalité 2.7 : module coopératif pour commandes groupées

import { KAStorage } from "../storage.js";
import { ErrorHandler } from "./error-handler.js";

// ============================================================
// EXPORT PRINCIPAL DU MODULE
// ============================================================

export const GroupOrdersModule = {
  // Gestion de l'état
  state: {
    selectedRegion: "Niayes",
    selectedStatus: "",
    searchQuery: "",
    viewMode: "orders", // 'orders', 'items', 'farms'
    currentOrderId: null,
    currentFarmId: null,
  },

  // Régions
  regions: ["Niayes", "Dakar", "Thiès", "Saint-Louis", "Kaolack", "Mbour", "Fatick", "Diourbel"],

  // Statuts des commandes
  statuses: ["En cours", "Confirmée", "Livrée", "Annulée", "Terminée"],

  // ============================================================
  // INITIALISATION
  // ============================================================

  init() {
    try {
      this.storage = KAStorage;
      this.cacheElements();
      this.setupListeners();
      this.render();
      this.loadInitialData();
    } catch (err) {
      ErrorHandler.log(err, "GroupOrdersModule.init");
    }
  },

  cacheElements() {
    this.elements = {
      // Statistiques
      statTotalOrders: document.getElementById("stat-total-orders"),
      statActiveOrders: document.getElementById("stat-active-orders"),
      statDeliveredOrders: document.getElementById("stat-delivered-orders"),
      statTotalAmount: document.getElementById("stat-total-amount"),
      statTotalFarms: document.getElementById("stat-total-farms"),
      statActiveFarms: document.getElementById("stat-active-farms"),

      // Onglets d'affichage
      viewOrdersBtn: document.getElementById("view-orders"),
      viewItemsBtn: document.getElementById("view-items"),
      viewFarmsBtn: document.getElementById("view-farms"),

      // Tableaux
      ordersTableBody: document.getElementById("orders-table-body"),
      itemsTableBody: document.getElementById("items-table-body"),
      farmsTableBody: document.getElementById("farms-table-body"),

      // Fenêtres modales
      orderDetailModal: document.getElementById("order-detail-modal"),
      createOrderModal: document.getElementById("create-order-modal"),
      addFarmModal: document.getElementById("add-farm-modal"),
      addItemModal: document.getElementById("add-item-modal"),
    };
  },

  setupListeners() {
    // Onglets d'affichage
    if (this.elements.viewOrdersBtn) {
      this.elements.viewOrdersBtn.addEventListener("click", () => this.switchView("orders"));
    }
    if (this.elements.viewItemsBtn) {
      this.elements.viewItemsBtn.addEventListener("click", () => this.switchView("items"));
    }
    if (this.elements.viewFarmsBtn) {
      this.elements.viewFarmsBtn.addEventListener("click", () => this.switchView("farms"));
    }

    // Fenêtres modales
    if (this.elements.orderDetailModal) {
      const closeBtn = this.elements.orderDetailModal.querySelector("[data-close-order-detail]");
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeOrderDetailModal());
    }

    if (this.elements.createOrderModal) {
      const saveBtn = this.elements.createOrderModal.querySelector("[data-save-order]");
      const closeBtn = this.elements.createOrderModal.querySelector("[data-close-order]");
      if (saveBtn) saveBtn.addEventListener("click", () => this.saveOrder());
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeCreateOrderModal());
    }

    if (this.elements.addFarmModal) {
      const saveBtn = this.elements.addFarmModal.querySelector("[data-save-farm]");
      const closeBtn = this.elements.addFarmModal.querySelector("[data-close-farm]");
      if (saveBtn) saveBtn.addEventListener("click", () => this.saveFarm());
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeAddFarmModal());
    }

    if (this.elements.addItemModal) {
      const saveBtn = this.elements.addItemModal.querySelector("[data-save-item]");
      const closeBtn = this.elements.addItemModal.querySelector("[data-close-item]");
      if (saveBtn) saveBtn.addEventListener("click", () => this.saveItem());
      if (closeBtn) closeBtn.addEventListener("click", () => this.closeAddItemModal());
    }

    // Bouton d'ajout d'un outil
    const createOrderBtn = document.getElementById("create-order-btn");
    if (createOrderBtn) {
      createOrderBtn.addEventListener("click", () => this.openCreateOrderModal());
    }

    const addFarmBtn = document.getElementById("add-farm-btn");
    if (addFarmBtn) {
      addFarmBtn.addEventListener("click", () => this.openAddFarmModal());
    }

    const addItemBtn = document.getElementById("add-item-btn");
    if (addItemBtn) {
      addItemBtn.addEventListener("click", () => this.openAddItemModal());
    }

    // Recherche
    const searchInput = document.getElementById("group-search");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.state.searchQuery = e.target.value;
        this.render();
      });
    }

    // Filtres
    const regionFilter = document.getElementById("filter-region");
    if (regionFilter) {
      regionFilter.addEventListener("change", (e) => {
        this.state.selectedRegion = e.target.value;
        this.render();
      });
    }

    const statusFilter = document.getElementById("filter-status");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.state.selectedStatus = e.target.value;
        this.render();
      });
    }
  },

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  loadInitialData() {
    this.orders = this.storage.getGroupOrders();
    this.items = this.storage.getGroupOrderItems();
    this.farms = this.storage.getFarmsCommunity();
    this.updateStats();
  },

  updateStats() {
    const orderStats = this.storage.getGroupOrderStats();
    const communityStats = this.storage.getCommunityStats();

    if (this.elements.statTotalOrders) {
      this.elements.statTotalOrders.textContent = orderStats.total;
    }
    if (this.elements.statActiveOrders) {
      this.elements.statActiveOrders.textContent = orderStats.active;
    }
    if (this.elements.statDeliveredOrders) {
      this.elements.statDeliveredOrders.textContent = orderStats.delivered;
    }
    if (this.elements.statTotalAmount) {
      this.elements.statTotalAmount.textContent = orderStats.totalAmount.toLocaleString("fr-FR");
    }
    if (this.elements.statTotalFarms) {
      this.elements.statTotalFarms.textContent = communityStats.total;
    }
    if (this.elements.statActiveFarms) {
      this.elements.statActiveFarms.textContent = communityStats.active;
    }
  },

  // ============================================================
  // GESTION DES VUES
  // ============================================================

  switchView(mode) {
    this.state.viewMode = mode;

    // Mettre à jour l'onglet actif
    if (this.elements.viewOrdersBtn) {
      this.elements.viewOrdersBtn.classList.toggle("bg-brand-green", mode === "orders");
      this.elements.viewOrdersBtn.classList.toggle("bg-brand-slate", mode !== "orders");
    }
    if (this.elements.viewItemsBtn) {
      this.elements.viewItemsBtn.classList.toggle("bg-brand-green", mode === "items");
      this.elements.viewItemsBtn.classList.toggle("bg-brand-slate", mode !== "items");
    }
    if (this.elements.viewFarmsBtn) {
      this.elements.viewFarmsBtn.classList.toggle("bg-brand-green", mode === "farms");
      this.elements.viewFarmsBtn.classList.toggle("bg-brand-slate", mode !== "farms");
    }

    // Afficher / masquer les sections
    const ordersSection = document.getElementById("orders-section");
    const itemsSection = document.getElementById("items-section");
    const farmsSection = document.getElementById("farms-section");

    if (ordersSection) ordersSection.classList.toggle("hidden", mode !== "orders");
    if (itemsSection) itemsSection.classList.toggle("hidden", mode !== "items");
    if (farmsSection) farmsSection.classList.toggle("hidden", mode !== "farms");

    this.render();
  },

  // ============================================================
  // RENDU
  // ============================================================

  render() {
    this.updateStats();

    switch (this.state.viewMode) {
      case "orders":
        this.renderOrders();
        break;
      case "items":
        this.renderItems();
        break;
      case "farms":
        this.renderFarms();
        break;
    }
  },

  renderOrders() {
    if (!this.elements.ordersTableBody) return;

    let orders = this.storage.getGroupOrders();

    // Appliquer les filtres
    if (this.state.selectedRegion) {
      orders = orders.filter((o) => o.region === this.state.selectedRegion);
    }
    if (this.state.selectedStatus) {
      orders = orders.filter((o) => o.status === this.state.selectedStatus);
    }
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.group_name.toLowerCase().includes(query) ||
          o.supplier_name.toLowerCase().includes(query) ||
          o.region.toLowerCase().includes(query)
      );
    }

    // Sort by date descending
    orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    this.elements.ordersTableBody.innerHTML = orders
      .map((order) => {
        const items = this.storage.getGroupOrderItemsByOrder(order.id);
        const deliveredCount = items.filter((i) => i.delivery_received).length;
        const totalItems = items.length;

        return `
        <tr class="border-b border-gray-700 hover:bg-gray-800/50">
          <td class="px-4 py-3 whitespace-nowrap">${order.group_name}</td>
          <td class="px-4 py-3">${order.supplier_name}</td>
          <td class="px-4 py-3">${order.region}</td>
          <td class="px-4 py-3">${new Date(order.order_date).toLocaleDateString("fr-FR")}</td>
          <td class="px-4 py-3">${order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString("fr-FR") : "-"}</td>
          <td class="px-4 py-3 text-right">${order.total_amount_fcfa.toLocaleString("fr-FR")}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-1 rounded-full text-xs ${this.getStatusColor(order.status)}">
              ${order.status}
            </span>
          </td>
          <td class="px-4 py-3 text-center">${deliveredCount}/${totalItems} livrés</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <button onclick="GroupOrdersModule.viewOrderDetails('${order.id}')" 
                    class="text-brand-green hover:text-brand-hover mr-2">
              <i data-lucide="eye"></i>
            </button>
            <button onclick="GroupOrdersModule.editOrder('${order.id}')" 
                    class="text-yellow-400 hover:text-yellow-300 mr-2">
              <i data-lucide="pencil"></i>
            </button>
            <button onclick="GroupOrdersModule.deleteOrder('${order.id}')" 
                    class="text-red-400 hover:text-red-300">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    this.renderLucideIcons();
  },

  renderItems() {
    if (!this.elements.itemsTableBody) return;

    let items = this.storage.getGroupOrderItems();

    // Appliquer les filtres
    if (this.state.selectedRegion) {
      const orders = this.storage.getGroupOrdersByRegion(this.state.selectedRegion);
      const orderIds = orders.map((o) => o.id);
      items = items.filter((i) => orderIds.includes(i.group_order_id));
    }
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      items = items.filter(
        (i) =>
          i.intrant_name.toLowerCase().includes(query) || i.farm_name.toLowerCase().includes(query)
      );
    }

    // Sort by order date descending
    items.sort((a, b) => {
      const orderA = this.storage.getGroupOrderById(a.group_order_id);
      const orderB = this.storage.getGroupOrderById(b.group_order_id);
      if (!orderA || !orderB) return 0;
      return new Date(orderB.order_date) - new Date(orderA.order_date);
    });

    this.elements.itemsTableBody.innerHTML = items
      .map((item) => {
        const order = this.storage.getGroupOrderById(item.group_order_id);

        return `
        <tr class="border-b border-gray-700 hover:bg-gray-800/50">
          <td class="px-4 py-3">${item.intrant_name}</td>
          <td class="px-4 py-3">${order ? order.group_name : item.group_order_id}</td>
          <td class="px-4 py-3">${item.farm_name}</td>
          <td class="px-4 py-3">${item.quantity} ${item.unit}</td>
          <td class="px-4 py-3 text-right">${item.unit_price.toLocaleString("fr-FR")}</td>
          <td class="px-4 py-3 text-right">${item.total_price.toLocaleString("fr-FR")}</td>
          <td class="px-4 py-3 text-center">
            <span class="px-2 py-1 rounded-full text-xs ${item.delivery_received ? "bg-green-800 text-green-200" : "bg-amber-800 text-amber-200"}">
              ${item.delivery_received ? "Livré" : "En attente"}
            </span>
          </td>
          <td class="px-4 py-3 text-center">${item.received_quantity || 0}/${item.quantity}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            ${
              !item.delivery_received
                ? `
              <button onclick="GroupOrdersModule.markAsReceived('${item.id}')" 
                      class="px-3 py-1 bg-brand-green hover:bg-brand-hover text-white text-xs rounded-lg">
                Réception
              </button>
            `
                : ""
            }
          </td>
        </tr>
      `;
      })
      .join("");

    this.renderLucideIcons();
  },

  renderFarms() {
    if (!this.elements.farmsTableBody) return;

    let farms = this.storage.getFarmsCommunity();

    // Appliquer les filtres
    if (this.state.selectedRegion) {
      farms = farms.filter((f) => f.region === this.state.selectedRegion);
    }
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      farms = farms.filter(
        (f) =>
          f.farm_name.toLowerCase().includes(query) ||
          f.contact_name.toLowerCase().includes(query) ||
          f.location.toLowerCase().includes(query)
      );
    }

    // Sort by last order date descending
    farms.sort((a, b) => {
      if (!a.last_order_date && !b.last_order_date) return 0;
      if (!a.last_order_date) return 1;
      if (!b.last_order_date) return -1;
      return new Date(b.last_order_date) - new Date(a.last_order_date);
    });

    this.elements.farmsTableBody.innerHTML = farms
      .map((farm) => {
        const orderCount = this.storage.getGroupOrderItemsByFarm(farm.id).length;
        const lastOrder = this.storage.getGroupOrderItemsByFarm(farm.id)[0];

        return `
        <tr class="border-b border-gray-700 hover:bg-gray-800/50 ${!farm.is_active ? "opacity-50" : ""}">
          <td class="px-4 py-3 whitespace-nowrap">${farm.farm_name}</td>
          <td class="px-4 py-3">${farm.contact_name}</td>
          <td class="px-4 py-3">${farm.contact_phone}</td>
          <td class="px-4 py-3">${farm.region}</td>
          <td class="px-4 py-3">${farm.location}</td>
          <td class="px-4 py-3 text-center">
            <span class="px-2 py-1 rounded-full text-xs ${farm.is_active ? "bg-green-800 text-green-200" : "bg-red-800 text-red-200"}">
              ${farm.is_active ? "Active" : "Inactive"}
            </span>
          </td>
          <td class="px-4 py-3 text-center">${orderCount}</td>
          <td class="px-4 py-3">${farm.last_order_date ? new Date(farm.last_order_date).toLocaleDateString("fr-FR") : "-"}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <button onclick="GroupOrdersModule.viewFarmDetails('${farm.id}')" 
                    class="text-brand-green hover:text-brand-hover mr-2">
              <i data-lucide="eye"></i>
            </button>
            <button onclick="GroupOrdersModule.editFarm('${farm.id}')" 
                    class="text-yellow-400 hover:text-yellow-300 mr-2">
              <i data-lucide="pencil"></i>
            </button>
            <button onclick="GroupOrdersModule.deleteFarm('${farm.id}')" 
                    class="text-red-400 hover:text-red-300">
              <i data-lucide="trash-2"></i>
            </button>
          </td>
        </tr>
      `;
      })
      .join("");

    this.renderLucideIcons();
  },

  getStatusColor(status) {
    const colors = {
      "En cours": "bg-blue-800 text-blue-200",
      Confirmée: "bg-cyan-800 text-cyan-200",
      Livrée: "bg-green-800 text-green-200",
      Annulée: "bg-red-800 text-red-200",
      Terminée: "bg-gray-800 text-gray-200",
    };
    return colors[status] || "bg-gray-800 text-gray-200";
  },

  renderLucideIcons() {
    if (typeof lucide === "undefined") return;
    document.querySelectorAll("[data-lucide]").forEach((el) => {
      const iconName = el.getAttribute("data-lucide");
      el.innerHTML = lucide.create(iconName);
    });
  },

  // ============================================================
  // ORDER MANAGEMENT
  // ============================================================

  openCreateOrderModal(orderId = null) {
    this.currentOrderId = orderId;

    if (orderId) {
      const order = this.storage.getGroupOrderById(orderId);
      if (order) {
        const form = this.elements.createOrderModal.querySelector("form");
        if (form) {
          form.elements["order-name"].value = order.group_name || "";
          form.elements["order-supplier"].value = order.supplier_name || "";
          form.elements["order-region"].value = order.region || "";
          form.elements["order-date"].value = order.order_date || "";
          form.elements["order-delivery-date"].value = order.expected_delivery_date || "";
          form.elements["order-address"].value = order.delivery_address || "";
          form.elements["order-notes"].value = order.notes || "";
        }
      }
    } else {
      const form = this.elements.createOrderModal.querySelector("form");
      if (form) form.reset();

      // Définir la date par défaut
      const today = new Date().toISOString().split("T")[0];
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 10);
      const deliveryDateStr = deliveryDate.toISOString().split("T")[0];

      if (form) {
        form.elements["order-date"].value = today;
        form.elements["order-delivery-date"].value = deliveryDateStr;
      }
    }

    if (this.elements.createOrderModal) {
      this.elements.createOrderModal.classList.remove("hidden");
    }
  },

  closeCreateOrderModal() {
    if (this.elements.createOrderModal) {
      this.elements.createOrderModal.classList.add("hidden");
    }
    this.currentOrderId = null;
  },

  saveOrder() {
    const form = this.elements.createOrderModal.querySelector("form");
    if (!form) return;

    const order = {
      id: this.currentOrderId || `GO-${Date.now()}`,
      group_name: form.elements["order-name"].value,
      initiated_by: "Utilisateur Actuel", // TODO : récupérer depuis la session
      supplier_id: "",
      supplier_name: form.elements["order-supplier"].value,
      status: this.currentOrderId
        ? this.storage.getGroupOrderById(this.currentOrderId).status
        : "En cours",
      total_amount_fcfa: 0, // Sera calculé à partir des articles
      order_date: form.elements["order-date"].value,
      expected_delivery_date: form.elements["order-delivery-date"].value,
      delivery_address: form.elements["order-address"].value,
      region: form.elements["order-region"].value,
      notes: form.elements["order-notes"].value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.currentOrderId) {
      this.storage.updateGroupOrder(this.currentOrderId, order);
    } else {
      this.storage.addGroupOrder(order);
    }

    this.closeCreateOrderModal();
    this.loadInitialData();
    this.render();

    ErrorHandler.showToast("Commande enregistrée avec succès!", "success");
  },

  editOrder(orderId) {
    this.openCreateOrderModal(orderId);
  },

  deleteOrder(orderId) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette commande ?")) {
      // Supprimer d'abord tous les articles de cette commande
      const items = this.storage.getGroupOrderItemsByOrder(orderId);
      items.forEach((item) => {
        this.storage.deleteGroupOrderItem(item.id);
      });

      this.storage.deleteGroupOrder(orderId);
      this.loadInitialData();
      this.render();
    }
  },

  viewOrderDetails(orderId) {
    this.currentOrderId = orderId;
    this.openCreateOrderModal(orderId);

    // Afficher les articles de cette commande
    const items = this.storage.getGroupOrderItemsByOrder(orderId);
  },

  // ============================================================
  // ITEM MANAGEMENT
  // ============================================================

  openAddItemModal(itemId = null) {
    this.currentItemId = itemId;

    if (itemId) {
      const item = this.storage.getGroupOrderItems().find((i) => i.id === itemId);
      if (item) {
        const form = this.elements.addItemModal.querySelector("form");
        if (form) {
          form.elements["item-order"].value = item.group_order_id || "";
          form.elements["item-farm"].value = item.farm_id || "";
          form.elements["item-intrant"].value = item.intrant_name || "";
          form.elements["item-quantity"].value = item.quantity || "";
          form.elements["item-unit"].value = item.unit || "";
          form.elements["item-unit-price"].value = item.unit_price || "";
          form.elements["item-notes"].value = item.notes || "";
        }
      }
    } else {
      const form = this.elements.addItemModal.querySelector("form");
      if (form) {
        form.reset();
        form.elements["item-order"].value = this.currentOrderId || "";
      }
    }

    if (this.elements.addItemModal) {
      this.elements.addItemModal.classList.remove("hidden");
    }
  },

  closeAddItemModal() {
    if (this.elements.addItemModal) {
      this.elements.addItemModal.classList.add("hidden");
    }
    this.currentItemId = null;
  },

  saveItem() {
    const form = this.elements.addItemModal.querySelector("form");
    if (!form) return;

    const orderId = form.elements["item-order"].value;
    const order = this.storage.getGroupOrderById(orderId);
    if (!order) {
      ErrorHandler.showToast("Veuillez sélectionner une commande valide", "error");
      return;
    }

    const farm = this.storage
      .getFarmsCommunity()
      .find((f) => f.id === form.elements["item-farm"].value);

    const item = {
      id: this.currentItemId || `GOI-${Date.now()}`,
      group_order_id: orderId,
      farm_id: form.elements["item-farm"].value,
      farm_name: farm ? farm.farm_name : form.elements["item-farm"].value,
      intrant_id: "",
      intrant_name: form.elements["item-intrant"].value,
      quantity: parseFloat(form.elements["item-quantity"].value) || 0,
      unit: form.elements["item-unit"].value,
      unit_price: parseInt(form.elements["item-unit-price"].value) || 0,
      total_price:
        (parseFloat(form.elements["item-quantity"].value) || 0) *
        (parseInt(form.elements["item-unit-price"].value) || 0),
      delivery_received: false,
      received_quantity: 0,
      notes: form.elements["item-notes"].value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.currentItemId) {
      this.storage.updateGroupOrderItem(this.currentItemId, item);
    } else {
      this.storage.addGroupOrderItem(item);

      // Mettre à jour le montant total de la commande
      const orderItems = this.storage.getGroupOrderItemsByOrder(orderId);
      const totalAmount = orderItems.reduce((sum, i) => sum + (i.total_price || 0), 0);
      this.storage.updateGroupOrder(orderId, { total_amount_fcfa: totalAmount });
    }

    this.closeAddItemModal();
    this.loadInitialData();
    this.render();

    ErrorHandler.showToast("Article ajouté avec succès!", "success");
  },

  markAsReceived(itemId) {
    const item = this.storage.getGroupOrderItems().find((i) => i.id === itemId);
    if (!item) return;

    const quantity = prompt("Quantité reçue:", item.quantity);
    if (quantity !== null) {
      this.storage.markItemAsReceived(itemId, parseFloat(quantity));

      // Vérifier si tous les articles sont reçus
      const orderId = item.group_order_id;
      const orderItems = this.storage.getGroupOrderItemsByOrder(orderId);
      const allReceived = orderItems.every((i) => i.delivery_received);

      if (allReceived) {
        this.storage.updateGroupOrder(orderId, { status: "Livré" });
        // Mettre à jour la date de dernière commande de la ferme
        const farms = this.storage.getFarmsCommunity();
        const farmIds = [...new Set(orderItems.map((i) => i.farm_id))];
        farmIds.forEach((farmId) => {
          this.storage.updateFarmInCommunity(farmId, {
            last_order_date: new Date().toISOString().split("T")[0],
          });
        });
      }

      this.loadInitialData();
      this.render();
      ErrorHandler.showToast("Réception confirmée!", "success");
    }
  },

  // ============================================================
  // FARM MANAGEMENT
  // ============================================================

  openAddFarmModal(farmId = null) {
    this.currentFarmId = farmId;

    if (farmId) {
      const farm = this.storage.getFarmById(farmId);
      if (farm) {
        const form = this.elements.addFarmModal.querySelector("form");
        if (form) {
          form.elements["farm-name"].value = farm.farm_name || "";
          form.elements["farm-region"].value = farm.region || "";
          form.elements["farm-contact"].value = farm.contact_name || "";
          form.elements["farm-phone"].value = farm.contact_phone || "";
          form.elements["farm-email"].value = farm.contact_email || "";
          form.elements["farm-location"].value = farm.location || "";
          form.elements["farm-active"].checked = farm.is_active || true;
          form.elements["farm-notes"].value = farm.notes || "";
        }
      }
    } else {
      const form = this.elements.addFarmModal.querySelector("form");
      if (form) form.reset();
    }

    if (this.elements.addFarmModal) {
      this.elements.addFarmModal.classList.remove("hidden");
    }
  },

  closeAddFarmModal() {
    if (this.elements.addFarmModal) {
      this.elements.addFarmModal.classList.add("hidden");
    }
    this.currentFarmId = null;
  },

  saveFarm() {
    const form = this.elements.addFarmModal.querySelector("form");
    if (!form) return;

    const farm = {
      id: this.currentFarmId || `FC-${Date.now()}`,
      farm_name: form.elements["farm-name"].value,
      region: form.elements["farm-region"].value,
      contact_name: form.elements["farm-contact"].value,
      contact_phone: form.elements["farm-phone"].value,
      contact_email: form.elements["farm-email"].value,
      location: form.elements["farm-location"].value,
      is_active: form.elements["farm-active"].checked,
      last_order_date: null,
      notes: form.elements["farm-notes"].value,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.currentFarmId) {
      this.storage.updateFarmInCommunity(this.currentFarmId, farm);
    } else {
      this.storage.addFarmToCommunity(farm);
    }

    this.closeAddFarmModal();
    this.loadInitialData();
    this.render();

    ErrorHandler.showToast("Ferme enregistrée avec succès!", "success");
  },

  editFarm(farmId) {
    this.openAddFarmModal(farmId);
  },

  deleteFarm(farmId) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette ferme ?")) {
      // Delete all order items for this farm first
      const items = this.storage.getGroupOrderItemsByFarm(farmId);
      items.forEach((item) => {
        this.storage.deleteGroupOrderItem(item.id);
      });

      this.storage.deleteFarmFromCommunity(farmId);
      this.loadInitialData();
      this.render();
    }
  },

  viewFarmDetails(farmId) {
    this.currentFarmId = farmId;
    this.openAddFarmModal(farmId);
  },
};

// Initialiser le module lorsque le DOM est chargé
document.addEventListener("DOMContentLoaded", () => {
  GroupOrdersModule.init();
});
