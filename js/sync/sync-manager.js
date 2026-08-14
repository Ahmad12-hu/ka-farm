// KA Farm - Sync Manager
// Orchestrateur central de la synchronisation localStorage ↔ Firestore
// Gère les états en ligne/hors ligne, le traitement par lots et le signal de présence

import { syncQueue } from "./queue-manager.js";

export class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.syncInterval = null;
    this.heartbeatInterval = null;
    this.batchSize = 10; // Nombre maximal d'actions par cycle de synchronisation
    this.syncCheckInterval = 3000; // Vérifier la file toutes les 3 secondes
    this.heartbeatInterval = 30000; // Signal de présence toutes les 30 secondes

    this.listeners = [];
  }

  /**
    * Initialiser le gestionnaire de synchronisation
   */
  init() {
    try {
      console.log("[SyncManager] Initializing...");

      // Surveiller les changements en ligne / hors ligne
      window.addEventListener("online", () => this.onOnline());
      window.addEventListener("offline", () => this.onOffline());

      // Démarrer la boucle de synchronisation
      this.startSyncLoop();

      // Démarrer le signal de présence
      this.startHeartbeat();

      console.log("[SyncManager] Initialized. Online:", this.isOnline);
      this.emit("init", { online: this.isOnline });
    } catch (err) {
      console.error("[SyncManager] Init failed:", err);
    }
  }

  /**
    * Appelé lorsque la connexion revient en ligne
   */
  onOnline() {
    this.isOnline = true;
    console.log("[SyncManager] 🟢 ONLINE - Starting sync...");
    this.emit("online", { timestamp: Date.now() });
    this.processSyncQueue();
  }

  /**
    * Appelé lorsque la connexion passe hors ligne
   */
  onOffline() {
    this.isOnline = false;
    console.warn("[SyncManager] 🔴 OFFLINE - Queue mode active");
    this.emit("offline", { timestamp: Date.now() });
  }

  /**
    * Démarrer la boucle de synchronisation (vérification périodique de la file)
   */
  startSyncLoop() {
    if (this.syncInterval) clearInterval(this.syncInterval);

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.processSyncQueue();
      }
    }, this.syncCheckInterval);
  }

  /**
   * Process queue: fetch actions and send to Firestore
   */
  async processSyncQueue() {
    if (this.isSyncing || !this.isOnline) return;

    try {
      this.isSyncing = true;
      const stats = syncQueue.getStats();

      if (stats.pending === 0) {
        this.isSyncing = false;
        return; // Rien à synchroniser
      }

      console.log(`[SyncManager] Processing ${stats.pending} pending actions...`);

      // Récupérer les actions relançables (en respectant le délai d'attente progressif)
      const actions = syncQueue.getRetryableActions().slice(0, this.batchSize);

      if (actions.length === 0) {
        this.isSyncing = false;
        return;
      }

      // Traiter chaque action
      for (const action of actions) {
        await this.syncAction(action);

        // Petite pause entre les actions
        await new Promise((r) => setTimeout(r, 100));
      }

      this.emit("sync-complete", { processed: actions.length });
      console.log(`[SyncManager] ✅ Synced ${actions.length} actions`);
    } catch (err) {
      console.error("[SyncManager] processSyncQueue failed:", err);
      this.emit("sync-error", { error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
    * Synchroniser une seule action vers Firestore
   * @param {Object} action
   */
  async syncAction(action) {
    try {
      syncQueue.markProcessing(action.id);

      // Simuler la synchronisation Firebase (à remplacer par un appel API réel)
      const response = await this.sendToFirebase(action);

      if (response.success) {
        syncQueue.markSynced(action.id);
        this.emit("action-synced", { action: action.id });
      } else {
        throw new Error(response.error || "Sync failed");
      }
    } catch (err) {
      const shouldRetry = syncQueue.markFailed(action.id, err);
      this.emit("action-failed", {
        action: action.id,
        error: err.message,
        willRetry: shouldRetry,
      });
    }
  }

  /**
    * Envoyer l'action vers Firebase (solution temporaire)
   * @param {Object} action
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async sendToFirebase(action) {
    try {
      // TODO : remplacer par le vrai point de terminaison Firebase
      // Pour l'instant, simuler avec une vérification de localStorage

      const key = `ka_farm_${action.action.toLowerCase()}`;
      const storedValue = localStorage.getItem(key);

      if (!storedValue) {
        return { success: false, error: "No data in localStorage" };
      }

      // Simuler un délai réseau
      await new Promise((r) => setTimeout(r, Math.random() * 500));

      // En production, faire un POST vers : /api/sync
      // const response = await fetch('/api/sync', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(action)
      // });
      // return response.json();

      console.log(`[SyncManager] Would sync to Firebase:`, action);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Start heartbeat (optional: detect stale connection)
   */
  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(() => {
      // Interroger le serveur pour vérifier la connexion réelle
      if (this.isOnline) {
        this.checkConnection();
      }
    }, this.heartbeatInterval);
  }

  /**
   * Check actual connection to server
   */
  async checkConnection() {
    try {
      // Requête HEAD simple pour vérifier la connectivité
      const response = await fetch("/api/health", {
        method: "HEAD",
        cache: "no-cache",
      });

      if (!response.ok && !this.isOnline) {
        this.onOffline();
      } else if (response.ok && !this.isOnline) {
        this.onOnline();
      }
    } catch (err) {
        // Erreur réseau : marquer comme hors ligne
      if (this.isOnline) {
        this.onOffline();
      }
    }
  }

  /**
   * Manually trigger sync (for testing/UI)
   */
  async manualSync() {
    if (!this.isOnline) {
      console.warn("[SyncManager] Cannot sync while offline");
      return { success: false, error: "Offline" };
    }

    try {
      await this.processSyncQueue();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    const queueStats = syncQueue.getStats();
    return {
      online: this.isOnline,
      syncing: this.isSyncing,
      queueSize: queueStats.total,
      pending: queueStats.pending,
      processing: queueStats.processing,
      failed: queueStats.failed,
      synced: queueStats.synced,
    };
  }

  /**
   * Enqueue action for sync
   * @param {Object} action - { action, data, enterpriseId? }
   * @returns {Promise<string>} Action ID
   */
  async enqueue(action) {
    return syncQueue.enqueue(action);
  }

  /**
   * Subscribe to sync events
   * @param {Function} callback - (event, data) => void
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Emit sync event
   * @param {string} event
   * @param {Object} data
   */
  emit(event, data) {
    this.listeners.forEach((listener) => {
      try {
        listener(event, data);
      } catch (err) {
        console.error("[SyncManager] Listener error:", err);
      }
    });
  }

  /**
   * Cleanup (on logout/app close)
   */
  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    window.removeEventListener("online", () => this.onOnline());
    window.removeEventListener("offline", () => this.onOffline());
    console.log("[SyncManager] Destroyed");
  }
}

// Singleton instance
export const syncManager = new SyncManager();

// Expose globally for debugging
window.syncManager = syncManager;
window.syncQueue = syncQueue;
