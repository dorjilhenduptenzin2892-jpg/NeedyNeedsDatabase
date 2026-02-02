/**
 * Service Worker Utility Functions
 * Provides convenient methods to interact with the service worker
 */

interface ServiceWorkerRegistration {
  update(): Promise<void>;
  unregister(): Promise<boolean>;
  addEventListener(type: string, listener: EventListener): void;
}

interface ServiceWorkerContainer {
  register(scriptURL: string, options?: object): Promise<ServiceWorkerRegistration>;
  controller: ServiceWorker | null;
  ready: Promise<ServiceWorkerRegistration>;
  addEventListener(type: string, listener: EventListener): void;
}

export const swUtils = {
  /**
   * Initialize service worker with notifications for updates
   */
  init: async () => {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Workers not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('ServiceWorker initialized:', registration.scope);
      return registration;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
      return null;
    }
  },

  /**
   * Check for service worker updates
   */
  checkForUpdates: async () => {
    if (!navigator.serviceWorker.controller) {
      return false;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      if (registrations.length > 0) {
        await registrations[0].update();
        return true;
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
    return false;
  },

  /**
   * Clear all caches
   */
  clearCache: async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log('Caches cleared');
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  },

  /**
   * Get cache size
   */
  getCacheSize: async () => {
    let totalSize = 0;
    const cacheNames = await caches.keys();

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return totalSize;
  },

  /**
   * Format cache size for display
   */
  formatCacheSize: (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  },

  /**
   * Check if app is offline
   */
  isOffline: () => {
    return !navigator.onLine;
  },

  /**
   * Listen for online/offline events
   */
  onOnlineStatusChange: (callback: (isOnline: boolean) => void) => {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  },

  /**
   * Register for background sync
   */
  registerBackgroundSync: async (tag: string) => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register(tag);
        console.log(`Background sync registered for: ${tag}`);
        return true;
      } catch (error) {
        console.error('Background sync registration failed:', error);
        return false;
      }
    }
    return false;
  },

  /**
   * Send message to service worker
   */
  sendMessage: (message: object) => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  },
};

export default swUtils;
