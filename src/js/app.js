/**
 * MAIN APPLICATION CONTROLLER
 * Handles homepage data loading and global functionality
 */
class AniToWatchApp {
    constructor() {
        // Jikan API base URL - Primary data source
        this.jikanApiBase = 'https://api.jikan.moe/v4';
        
        // Content filtering for safety
        this.blockedGenres = ['Hentai', 'Erotica'];
        this.blockedRatings = ['Rx', 'R+'];
        
        // Cache for faster loading
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Load all homepage data in parallel for maximum speed
            await Promise.all([
                this.loadTrendingAnime(),
                this.loadRecentAnime(),
                this.loadPopularManga(),
                this.loadSchedule()
            ]);
            
            this.bindEvents();
            console.log('AniToWatch initialized successfully');
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showError('Failed to initialize application');
        }
    }

    /**
     * Load trending anime with caching
     */
    async loadTrendingAnime() {
        const container = document.getElementById('trendingAnime');
        if (!container) return;

        const cacheKey = 'trending_anime';
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            this.displayTrendingAnime(cached);
            return;
        }

        try {
            // Fetch from Jikan API
            const response = await fetch(`${this.jikanApiBase}/top/anime?limit=8`);
            if (!response.ok) throw new Error('Jikan API request failed');
            
            const data = await response.json();
            const safeAnime = (data.data || []).filter(item => this.isSafeContent(item));
            
            // Cache the results
            this.setCachedData(cacheKey, safeAnime);
            this.displayTrendingAnime(safeAnime);
            
        } catch (error) {
            console.error('Error loading trending anime:', error);
            container.innerHTML = '<div class="error">Failed to load trending anime</div>';
        }
    }

    /**
     * Display trending anime in the grid
     */
    displayTrendingAnime(animeList) {
        const container = document.getElementById('trendingAnime');
        container.innerHTML = animeList.map(anime => 
            this.createAnimeCard(anime, 'trending')
        ).join('');
        
        this.bindCardEvents();
    }

    /**
     * Load recent anime (currently airing)
     */
    async loadRecentAnime() {
        const container = document.getElementById('recentAnime');
        if (!container) return;

        const cacheKey = 'recent_anime';
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            container.innerHTML = cached.map(anime => 
                this.createAnimeCard(anime, 'recent')
            ).join('');
            this.bindCardEvents();
            return;
        }

        try {
            const response = await fetch(`${this.jikanApiBase}/seasons/now?limit=12`);
            const data = await response.json();
            
            const safeAnime = (data.data || []).filter(item => this.isSafeContent(item));
            this.setCachedData(cacheKey, safeAnime);
            
            container.innerHTML = safeAnime.map(anime => 
                this.createAnimeCard(anime, 'recent')
            ).join('');
            
            this.bindCardEvents();
        } catch (error) {
            console.error('Recent anime load error:', error);
        }
    }

    /**
     * Load popular manga
     */
    async loadPopularManga() {
        const container = document.getElementById('popularManga');
        if (!container) return;

        const cacheKey = 'popular_manga';
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            container.innerHTML = cached.map(manga => 
                this.createMangaCard(manga)
            ).join('');
            this.bindMangaCardEvents();
            return;
        }

        try {
            const response = await fetch(`${this.jikanApiBase}/top/manga?limit=12`);
            const data = await response.json();
            
            const safeManga = (data.data || []).filter(item => this.isSafeContent(item));
            this.setCachedData(cacheKey, safeManga);
            
            container.innerHTML = safeManga.map(manga => 
                this.createMangaCard(manga)
            ).join('');
            
            this.bindMangaCardEvents();
        } catch (error) {
            console.error('Popular manga load error:', error);
        }
    }

    /**
     * Load weekly anime schedule
     */
    async loadSchedule() {
        const container = document.getElementById('scheduleContainer');
        if (!container) return;

        const cacheKey = 'schedule';
        const cached = this.getCachedData(cacheKey);
        
        if (cached) {
            container.innerHTML = this.createScheduleHTML(cached);
            this.bindScheduleEvents();
            return;
        }

        try {
            const response = await fetch(`${this.jikanApiBase}/schedules`);
            const data = await response.json();
            
            const safeSchedule = (data.data || []).filter(item => this.isSafeContent(item));
            const grouped = this.groupScheduleByDay(safeSchedule);
            
            this.setCachedData(cacheKey, grouped);
            container.innerHTML = this.createScheduleHTML(grouped);
            this.bindScheduleEvents();
        } catch (error) {
            console.error('Schedule load error:', error);
        }
    }

    /**
     * Create anime card HTML
     */
    createAnimeCard(anime, type = 'normal') {
        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
        const score = anime.score || 'N/A';
        const episodes = anime.episodes || '?';
        const hasTrailer = !!anime.trailer?.embed_url;
        
        return `
            <div class="anime-card" data-mal-id="${anime.mal_id}">
                <div class="anime-card-image">
                    <img src="${imageUrl}" alt="${anime.title}" loading="lazy">
                    <div class="anime-card-badge">⭐ ${score}</div>
                    <div class="anime-card-actions">
                        <button class="btn btn-primary btn-small view-btn" 
                                onclick="app.viewAnimeDetails(${anime.mal_id})">
                            <i class="fas fa-info-circle"></i> View Details
                        </button>
                        <button class="btn btn-secondary btn-small watchlist-btn" 
                                onclick="app.addAnimeToWatchlist(${anime.mal_id})">
                            <i class="fas fa-plus"></i> Track
                        </button>
                        ${hasTrailer ? `
                            <button class="btn btn-secondary btn-small trailer-btn" 
                                    onclick="app.showTrailerModal(${JSON.stringify(anime).replace(/'/g, "\\'")})">
                                <i class="fas fa-film"></i> Trailer
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="anime-card-content">
                    <div class="anime-card-title">${anime.title}</div>
                    <div class="anime-card-meta">
                        <span>${episodes} eps</span>
                        <span>${anime.type || 'TV'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Create manga card HTML
     */
    createMangaCard(manga) {
        const imageUrl = manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || '';
        const chapters = manga.chapters || '?';
        const score = manga.score || 'N/A';
        
        return `
            <div class="manga-card" data-mal-id="${manga.mal_id}" data-type="manga">
                <div class="manga-card-image">
                    <img src="${imageUrl}" alt="${manga.title}" loading="lazy">
                    <div class="anime-card-actions">
                        <button class="btn btn-primary btn-small view-btn" 
                                onclick="app.viewMangaDetails(${manga.mal_id})">
                            <i class="fas fa-info-circle"></i> View Details
                        </button>
                        <button class="btn btn-secondary btn-small readinglist-btn" 
                                onclick="app.addMangaToReadingList(${manga.mal_id})">
                            <i class="fas fa-plus"></i> Track
                        </button>
                    </div>
                </div>
                <div class="manga-card-content">
                    <div class="manga-card-title">${manga.title}</div>
                    <div class="manga-card-chapters">${chapters} chapters • ⭐ ${score}</div>
                </div>
            </div>
        `;
    }

    /**
     * View anime details page
     */
    viewAnimeDetails(malId) {
        window.location.href = `detail.html?mal_id=${malId}&type=anime`;
    }

    /**
     * View manga details page
     */
    viewMangaDetails(malId) {
        window.location.href = `detail.html?mal_id=${malId}&type=manga`;
    }

    /**
     * Add anime to watchlist
     */
    async addAnimeToWatchlist(malId) {
        try {
            const response = await fetch(`${this.jikanApiBase}/anime/${malId}`);
            const data = await response.json();
            const anime = data.data;
            
            if (window.electronAPI) {
                await window.electronAPI.addToWatchlist(anime);
                this.showNotification(`Added "${anime.title}" to watchlist!`);
            } else {
                this.showNotification('Watchlist feature requires desktop app');
            }
        } catch (error) {
            console.error('Error adding to watchlist:', error);
            this.showNotification('Failed to add to watchlist');
        }
    }

    /**
     * Add manga to reading list
     */
    async addMangaToReadingList(malId) {
        try {
            const response = await fetch(`${this.jikanApiBase}/manga/${malId}`);
            const data = await response.json();
            const manga = data.data;
            
            if (window.electronAPI) {
                await window.electronAPI.addToReadingList(manga);
                this.showNotification(`Added "${manga.title}" to reading list!`);
            } else {
                this.showNotification('Reading list feature requires desktop app');
            }
        } catch (error) {
            console.error('Error adding to reading list:', error);
            this.showNotification('Failed to add to reading list');
        }
    }

    /**
     * Show trailer modal
     */
    showTrailerModal(anime) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); z-index: 10000; display: flex;
            align-items: center; justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: var(--card-bg); padding: 20px; border-radius: 8px; max-width: 800px; width: 90%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="color: var(--light); margin: 0;">${anime.title} - Official Trailer</h3>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="background: none; border: none; color: var(--light); font-size: 20px; cursor: pointer;">
                        ×
                    </button>
                </div>
                <iframe 
                    width="100%" 
                    height="400" 
                    src="${anime.trailer.embed_url}" 
                    frameborder="0" 
                    allowfullscreen
                    style="border-radius: 4px;"
                ></iframe>
                <div style="margin-top: 15px; text-align: center;">
                    <button class="btn btn-primary" onclick="app.viewAnimeDetails(${anime.mal_id})">
                        <i class="fas fa-info-circle"></i> View Details
                    </button>
                    <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()" style="margin-left: 10px;">
                        Close Trailer
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Cache management methods
     */
    getCachedData(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCachedData(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Utility methods
     */
    groupScheduleByDay(schedule) {
        const grouped = {};
        schedule.forEach(item => {
            const day = (item.broadcast?.day || 'Unknown').charAt(0).toUpperCase() + 
                       (item.broadcast?.day || 'Unknown').slice(1);
            if (!grouped[day]) grouped[day] = [];
            if (grouped[day].length < 5) grouped[day].push(item);
        });
        return grouped;
    }

    createScheduleHTML(grouped) {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days.map(day => {
            if (!grouped[day] || grouped[day].length === 0) return '';
            
            return `
                <div class="schedule-day">
                    <h3>${day}</h3>
                    ${grouped[day].map(anime => `
                        <div class="schedule-anime">
                            <div class="schedule-anime-title" data-mal-id="${anime.mal_id}">
                                ${anime.title}
                            </div>
                            <div class="schedule-anime-time">
                                ${anime.broadcast?.time || 'Time TBA'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');
    }

    showNotification(message) {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: var(--primary);
            color: white; padding: 15px 20px; border-radius: 5px; z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    showError(message) {
        console.error('Application Error:', message);
    }

    isSafeContent(item) {
        // Filter out adult content
        if (item.rating && this.blockedRatings.includes(item.rating)) return false;
        if (Array.isArray(item.genres)) {
            const hasBlockedGenre = item.genres.some(genre => 
                this.blockedGenres.includes(genre.name)
            );
            if (hasBlockedGenre) return false;
        }
        return true;
    }

    bindEvents() {
        // Global error handling
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
        });
    }

    bindCardEvents() {
        document.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const malId = card.dataset.malId;
                    this.viewAnimeDetails(malId);
                }
            });
        });
    }

    bindMangaCardEvents() {
        document.querySelectorAll('.manga-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const malId = card.dataset.malId;
                    this.viewMangaDetails(malId);
                }
            });
        });
    }

    bindScheduleEvents() {
        document.querySelectorAll('.schedule-anime-title').forEach(title => {
            title.addEventListener('click', () => {
                const malId = title.dataset.malId;
                this.viewAnimeDetails(malId);
            });
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AniToWatchApp();
});