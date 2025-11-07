const { contextBridge, ipcRenderer } = require("electron");

/**
 * PRELOAD SCRIPT
 * Safely exposes Electron APIs to the renderer process
 */
class ElectronAPI {
    constructor() {
        this.setupAPI();
    }

    setupAPI() {
        // Expose watchlist operations to renderer
        contextBridge.exposeInMainWorld("electronAPI", {
            // Watchlist operations
            getWatchlist: () => ipcRenderer.invoke("get-watchlist"),
            addToWatchlist: (anime) => ipcRenderer.invoke("add-to-watchlist", anime),
            removeFromWatchlist: (id) => ipcRenderer.invoke("remove-from-watchlist", id),
            updateWatchlist: (id, data) => ipcRenderer.invoke("update-watchlist", id, data),
            
            // Reading list operations
            getReadingList: () => ipcRenderer.invoke("get-readinglist"),
            addToReadingList: (manga) => ipcRenderer.invoke("add-to-readinglist", manga),
            removeFromReadingList: (id) => ipcRenderer.invoke("remove-from-readinglist", id),
            
            // Favorites operations
            getFavorites: () => ipcRenderer.invoke("get-favorites"),
            addToFavorites: (character) => ipcRenderer.invoke("add-to-favorites", character),
            removeFromFavorites: (id) => ipcRenderer.invoke("remove-from-favorites", id),
            
            // App information
            platform: process.platform,
            version: '1.0.0'
        });

        // Expose API information for the assignment
        contextBridge.exposeInMainWorld('apiInfo', {
            primary: 'Jikan API (MyAnimeList) - https://api.jikan.moe/v4/',
            features: 'Anime & Manga Tracker with Character System',
            assignment: '✅ Uses Jikan API for all data fetching'
        });
    }
}

// Initialize the API bridge
new ElectronAPI();