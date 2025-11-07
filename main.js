const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");

/**
 * MAIN APPLICATION CLASS
 * Handles Electron window management and data storage in JSON files
 */
class AniToWatchApp {
    constructor() {
        // Data file paths for JSON storage
        this.watchlistPath = path.join(__dirname, "data", "watchlist.json");
        this.readingListPath = path.join(__dirname, "data", "readinglist.json");
        this.favoritesPath = path.join(__dirname, "data", "favorites.json");
        this.mainWindow = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        app.whenReady().then(() => this.createWindow());
        
        // Quit when all windows are closed
        app.on("window-all-closed", () => {
            if (process.platform !== "darwin") app.quit();
        });

        // Recreate window on macOS when dock icon is clicked
        app.on("activate", () => {
            if (BrowserWindow.getAllWindows().length === 0) this.createWindow();
        });

        this.setupIPC();
    }

    /**
     * Create the main application window
     */
    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 1400,
            height: 900,
            minWidth: 1200,
            minHeight: 700,
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                contextIsolation: true,
                enableRemoteModule: false,
                nodeIntegration: false,
                webSecurity: true
            },
            title: "AniToWatch - Anime & Manga Tracker",
            show: false
        });

        // Load the main interface
        this.mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
        
        // Show window when ready
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            this.mainWindow.focus();
        });

        // Handle external links (open in default browser)
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url);
            return { action: 'deny' };
        });
    }

    /**
     * Set up Inter-Process Communication (IPC) handlers
     */
    setupIPC() {
        // Watchlist CRUD operations
        ipcMain.handle("get-watchlist", async () => {
            return await this.watchlistManager.getWatchlist();
        });

        ipcMain.handle("add-to-watchlist", async (event, anime) => {
            return await this.watchlistManager.addToWatchlist(anime);
        });

        ipcMain.handle("remove-from-watchlist", async (event, id) => {
            return await this.watchlistManager.removeFromWatchlist(id);
        });

        ipcMain.handle("update-watchlist", async (event, id, data) => {
            return await this.watchlistManager.updateWatchlist(id, data);
        });

        // Reading List CRUD operations
        ipcMain.handle("get-readinglist", async () => {
            return await this.readingListManager.getReadingList();
        });

        ipcMain.handle("add-to-readinglist", async (event, manga) => {
            return await this.readingListManager.addToReadingList(manga);
        });

        ipcMain.handle("remove-from-readinglist", async (event, id) => {
            return await this.readingListManager.removeFromReadingList(id);
        });

        // Favorites management
        ipcMain.handle("get-favorites", async () => {
            return await this.favoritesManager.getFavorites();
        });

        ipcMain.handle("add-to-favorites", async (event, character) => {
            return await this.favoritesManager.addToFavorites(character);
        });

        ipcMain.handle("remove-from-favorites", async (event, id) => {
            return await this.favoritesManager.removeFromFavorites(id);
        });
    }

    // Data manager getters
    get watchlistManager() {
        return new DataManager(this.watchlistPath, 'watchlist');
    }

    get readingListManager() {
        return new DataManager(this.readingListPath, 'readinglist');
    }

    get favoritesManager() {
        return new DataManager(this.favoritesPath, 'favorites');
    }
}

/**
 * DATA MANAGER CLASS
 * Handles all JSON file-based data operations
 */
class DataManager {
    constructor(filePath, type) {
        this.filePath = filePath;
        this.type = type;
        this.ensureDataDirectory();
    }

    /**
     * Ensure data directory and JSON file exist
     */
    ensureDataDirectory() {
        const dataDir = path.dirname(this.filePath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // Create empty JSON file if it doesn't exist
        if (!fs.existsSync(this.filePath)) {
            this.saveData([]);
        }
    }

    /**
     * Get data from JSON file
     */
    async getWatchlist() {
        try {
            console.log(`Reading ${this.type} from: ${this.filePath}`);
            
            if (!fs.existsSync(this.filePath)) {
                console.log(`File not found, creating empty ${this.type}`);
                return [];
            }
            
            const data = fs.readFileSync(this.filePath, "utf-8");
            
            if (!data.trim()) {
                console.log(`Empty file, returning empty array for ${this.type}`);
                return [];
            }
            
            const parsedData = JSON.parse(data);
            console.log(`Successfully loaded ${parsedData.length} items from ${this.type}`);
            return parsedData;
            
        } catch (error) {
            console.error(`Error reading ${this.type} from JSON file:`, error);
            // If file is corrupted, reset it
            this.saveData([]);
            return [];
        }
    }

    async getReadingList() {
        return this.getWatchlist();
    }

    async getFavorites() {
        return this.getWatchlist();
    }

    /**
     * Add item to JSON file
     */
    async addToWatchlist(anime) {
        try {
            let watchlist = await this.getWatchlist();
            
            const animeItem = {
                id: Date.now().toString(),
                mal_id: anime.mal_id,
                title: anime.title,
                image: anime.images?.jpg?.image_url,
                episodes: anime.episodes || 0,
                score: anime.score || 0,
                episodes_watched: 0,
                status: 'planning',
                rating: 0,
                notes: '',
                added_date: new Date().toISOString()
            };

            // Prevent duplicates
            if (!watchlist.find(a => a.mal_id === anime.mal_id)) {
                watchlist.push(animeItem);
                await this.saveData(watchlist);
                console.log(`Added "${anime.title}" to ${this.type}`);
            } else {
                console.log(`"${anime.title}" already exists in ${this.type}`);
            }
            
            return watchlist;
        } catch (error) {
            console.error(`Error adding to ${this.type}:`, error);
            throw error;
        }
    }

    async addToReadingList(manga) {
        try {
            let list = await this.getReadingList();
            
            const mangaItem = {
                id: Date.now().toString(),
                mal_id: manga.mal_id,
                title: manga.title,
                image: manga.images?.jpg?.image_url,
                chapters: manga.chapters || 0,
                score: manga.score || 0,
                chapters_read: 0,
                status: 'planning',
                rating: 0,
                notes: '',
                added_date: new Date().toISOString()
            };

            if (!list.find(m => m.mal_id === manga.mal_id)) {
                list.push(mangaItem);
                await this.saveData(list);
                console.log(`Added "${manga.title}" to ${this.type}`);
            } else {
                console.log(`"${manga.title}" already exists in ${this.type}`);
            }
            
            return list;
        } catch (error) {
            console.error(`Error adding to ${this.type}:`, error);
            throw error;
        }
    }

    async addToFavorites(character) {
        try {
            let favorites = await this.getFavorites();
            
            const characterItem = {
                id: Date.now().toString(),
                mal_id: character.mal_id,
                name: character.name,
                image: character.images?.jpg?.image_url,
                anime: character.anime?.[0]?.anime?.title || 'Unknown',
                favorites: character.favorites || 0,
                added_date: new Date().toISOString()
            };

            if (!favorites.find(c => c.mal_id === character.mal_id)) {
                favorites.push(characterItem);
                await this.saveData(favorites);
                console.log(`Added "${character.name}" to ${this.type}`);
            } else {
                console.log(`"${character.name}" already exists in ${this.type}`);
            }
            
            return favorites;
        } catch (error) {
            console.error(`Error adding to ${this.type}:`, error);
            throw error;
        }
    }

    /**
     * Remove item from JSON file
     */
    async removeFromWatchlist(id) {
        try {
            let watchlist = await this.getWatchlist();
            const itemToRemove = watchlist.find(a => a.mal_id === id);
            watchlist = watchlist.filter(a => a.mal_id !== id);
            
            await this.saveData(watchlist);
            
            if (itemToRemove) {
                console.log(`Removed "${itemToRemove.title}" from ${this.type}`);
            }
            
            return watchlist;
        } catch (error) {
            console.error(`Error removing from ${this.type}:`, error);
            throw error;
        }
    }

    async removeFromReadingList(id) {
        return this.removeFromWatchlist(id);
    }

    async removeFromFavorites(id) {
        return this.removeFromWatchlist(id);
    }

    /**
     * Update item in JSON file
     */
    async updateWatchlist(id, updates) {
        try {
            let watchlist = await this.getWatchlist();
            const index = watchlist.findIndex(a => a.mal_id === id);
            
            if (index !== -1) {
                const oldItem = { ...watchlist[index] };
                watchlist[index] = { ...watchlist[index], ...updates };
                await this.saveData(watchlist);
                
                console.log(`Updated "${oldItem.title}" in ${this.type}:`, updates);
            } else {
                console.log(`Item with ID ${id} not found in ${this.type}`);
            }
            
            return watchlist;
        } catch (error) {
            console.error(`Error updating ${this.type}:`, error);
            throw error;
        }
    }

    /**
     * Save data to JSON file with proper formatting
     */
    async saveData(data) {
        try {
            const jsonData = JSON.stringify(data, null, 2); // Pretty print with 2 spaces
            fs.writeFileSync(this.filePath, jsonData, "utf-8");
            console.log(`Successfully saved ${data.length} items to ${this.filePath}`);
        } catch (error) {
            console.error(`Error saving ${this.type} to JSON file:`, error);
            throw error;
        }
    }
}

// Start the application
new AniToWatchApp();