/**
 * ANIME BROWSER CONTROLLER
 * Handles anime browsing, filtering, and search functionality
 */
class AnimeBrowser {
    constructor() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentFilters = {};
        this.jikanApiBase = 'https://api.jikan.moe/v4';
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        
        this.init();
    }

    /**
     * Initialize the anime browser
     */
    async init() {
        await this.loadGenres();
        await this.loadAnime();
        this.bindEvents();
    }

    /**
     * Load anime genres from Jikan API
     */
    async loadGenres() {
        const cacheKey = 'anime_genres';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            this.populateGenreFilter(cached.data);
            return;
        }

        try {
            const response = await fetch(`${this.jikanApiBase}/genres/anime`);
            const data = await response.json();
            
            // Cache genres
            this.cache.set(cacheKey, {
                data: data.data,
                timestamp: Date.now()
            });
            
            this.populateGenreFilter(data.data);
        } catch (error) {
            console.error('Error loading genres:', error);
        }
    }

    /**
     * Populate genre filter dropdown
     */
    populateGenreFilter(genres) {
        const genreSelect = document.getElementById('genreFilter');
        
        // Filter out adult genres and sort alphabetically
        const safeGenres = genres
            .filter(genre => !['Hentai', 'Erotica'].includes(genre.name))
            .sort((a, b) => a.name.localeCompare(b.name));
        
        safeGenres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre.mal_id;
            option.textContent = genre.name;
            genreSelect.appendChild(option);
        });
    }

    /**
     * Load anime based on current filters
     */
    async loadAnime() {
        const grid = document.getElementById('animeGrid');
        if (!grid) return;

        try {
            // Show loading state only for first page
            if (this.currentPage === 1) {
                grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading anime...</p></div>';
            }
            
            // Build API URL with current filters
            let url = `${this.jikanApiBase}/anime?page=${this.currentPage}&limit=24`;
            
            // Add search query if present
            if (this.currentFilters.search) {
                url += `&q=${encodeURIComponent(this.currentFilters.search)}`;
            }
            
            // Add genre filter
            if (this.currentFilters.genre) {
                url += `&genres=${this.currentFilters.genre}`;
            }
            
            // Add type filter
            if (this.currentFilters.type) {
                url += `&type=${this.currentFilters.type}`;
            }
            
            // Add status filter
            if (this.currentFilters.status) {
                url += `&status=${this.currentFilters.status}`;
            }
            
            // Add sorting
            if (this.currentFilters.sort) {
                switch(this.currentFilters.sort) {
                    case 'popularity':
                        url += '&order_by=members&sort=desc';
                        break;
                    case 'score':
                        url += '&order_by=score&sort=desc';
                        break;
                    case 'title':
                        url += '&order_by=title&sort=asc';
                        break;
                    case 'episodes':
                        url += '&order_by=episodes&sort=desc';
                        break;
                }
            }

            const response = await fetch(url);
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                // Filter out adult content
                const safeAnime = data.data.filter(item => this.isSafeContent(item));
                
                if (this.currentPage === 1) {
                    // First page - replace content
                    grid.innerHTML = safeAnime.map(anime => 
                        this.createAnimeCard(anime)
                    ).join('');
                } else {
                    // Subsequent pages - append content
                    grid.innerHTML += safeAnime.map(anime => 
                        this.createAnimeCard(anime)
                    ).join('');
                }
                
                // Update pagination controls
                this.hasMore = data.pagination && data.pagination.has_next_page;
                document.getElementById('loadMore').style.display = this.hasMore ? 'block' : 'none';
                
                // Update statistics
                this.updateStats(safeAnime.length);
                this.bindCardEvents();
            } else {
                // No results found
                grid.innerHTML = '<div class="empty-state">No anime found matching your criteria.</div>';
                document.getElementById('loadMore').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading anime:', error);
            grid.innerHTML = '<div class="error">Failed to load anime. Please try again later.</div>';
        }
    }

    /**
     * Create anime card HTML
     */
    createAnimeCard(anime) {
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
                                onclick="animeBrowser.viewDetails(${anime.mal_id})">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="btn btn-secondary btn-small track-btn" 
                                onclick="animeBrowser.addToWatchlist(${anime.mal_id})">
                            <i class="fas fa-plus"></i> Track
                        </button>
                        ${hasTrailer ? `
                            <button class="btn btn-secondary btn-small trailer-btn" 
                                    onclick="animeBrowser.showTrailer(${JSON.stringify(anime).replace(/'/g, "\\'")})">
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
                        <span>${anime.status || 'Unknown'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * View anime details
     */
    viewDetails(malId) {
        window.location.href = `detail.html?mal_id=${malId}&type=anime`;
    }

    /**
     * Add anime to watchlist
     */
    async addToWatchlist(malId) {
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
     * Show trailer modal
     */
    showTrailer(anime) {
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
                    <button class="btn btn-primary" onclick="animeBrowser.viewDetails(${anime.mal_id})">
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
     * Load more anime (pagination)
     */
    async loadMore() {
        this.currentPage++;
        await this.loadAnime();
    }

    /**
     * Search anime by title
     */
    search() {
        const searchInput = document.getElementById('animeSearch');
        this.currentFilters.search = searchInput.value.trim();
        this.currentPage = 1;
        this.loadAnime();
    }

    /**
     * Apply filters to anime list
     */
    applyFilters() {
        const genreFilter = document.getElementById('genreFilter');
        const typeFilter = document.getElementById('typeFilter');
        const statusFilter = document.getElementById('statusFilter');
        const sortFilter = document.getElementById('sortFilter');
        
        this.currentFilters.genre = genreFilter.value;
        this.currentFilters.type = typeFilter.value;
        this.currentFilters.status = statusFilter.value;
        this.currentFilters.sort = sortFilter.value;
        this.currentPage = 1;
        
        this.loadAnime();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        document.getElementById('genreFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('sortFilter').value = 'popularity';
        document.getElementById('animeSearch').value = '';
        
        this.currentFilters = {};
        this.currentPage = 1;
        this.loadAnime();
    }

    /**
     * Update statistics display
     */
    updateStats(animeCount) {
        const statsElement = document.getElementById('totalAnime');
        if (statsElement) {
            statsElement.textContent = `${animeCount} anime loaded`;
        }
    }

    /**
     * Show notification
     */
    showNotification(message) {
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

    /**
     * Bind card click events
     */
    bindEvents() {
        this.bindCardEvents();
    }

    bindCardEvents() {
        document.querySelectorAll('.anime-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicked on a button
                if (!e.target.closest('button')) {
                    const malId = card.dataset.malId;
                    this.viewDetails(malId);
                }
            });
        });
    }

    /**
     * Content safety filter
     */
    isSafeContent(item) {
        const blockedGenres = ['Hentai', 'Erotica'];
        const blockedRatings = ['Rx', 'R+'];
        
        if (item.rating && blockedRatings.includes(item.rating)) return false;
        if (Array.isArray(item.genres)) {
            const hasBlockedGenre = item.genres.some(genre => 
                blockedGenres.includes(genre.name)
            );
            if (hasBlockedGenre) return false;
        }
        return true;
    }
}