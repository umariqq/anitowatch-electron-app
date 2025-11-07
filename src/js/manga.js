/**
 * MANGA BROWSER CONTROLLER
 * Handles manga browsing, filtering, and search functionality
 */
class MangaBrowser {
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
     * Initialize the manga browser
     */
    async init() {
        await this.loadGenres();
        await this.loadManga();
        this.bindEvents();
    }

    /**
     * Load manga genres from Jikan API
     */
    async loadGenres() {
        const cacheKey = 'manga_genres';
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            this.populateGenreFilter(cached.data);
            return;
        }

        try {
            const response = await fetch(`${this.jikanApiBase}/genres/manga`);
            const data = await response.json();
            
            // Cache genres
            this.cache.set(cacheKey, {
                data: data.data,
                timestamp: Date.now()
            });
            
            this.populateGenreFilter(data.data);
        } catch (error) {
            console.error('Error loading manga genres:', error);
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
     * Load manga based on current filters
     */
    async loadManga() {
        const grid = document.getElementById('mangaGrid');
        if (!grid) return;

        try {
            if (this.currentPage === 1) {
                grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading manga...</p></div>';
            }
            
            // Build API URL with current filters
            let url = `${this.jikanApiBase}/manga?page=${this.currentPage}&limit=24`;
            
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
                    case 'chapters':
                        url += '&order_by=chapters&sort=desc';
                        break;
                }
            }

            const response = await fetch(url);
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                // Filter out adult content
                const safeManga = data.data.filter(item => this.isSafeContent(item));
                
                if (this.currentPage === 1) {
                    grid.innerHTML = safeManga.map(manga => 
                        this.createMangaCard(manga)
                    ).join('');
                } else {
                    grid.innerHTML += safeManga.map(manga => 
                        this.createMangaCard(manga)
                    ).join('');
                }
                
                this.hasMore = data.pagination && data.pagination.has_next_page;
                document.getElementById('loadMore').style.display = this.hasMore ? 'block' : 'none';
                
                this.updateStats(safeManga.length);
                this.bindCardEvents();
            } else {
                grid.innerHTML = '<div class="empty-state">No manga found matching your criteria.</div>';
                document.getElementById('loadMore').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading manga:', error);
            grid.innerHTML = '<div class="error">Failed to load manga. Please try again later.</div>';
        }
    }

    /**
     * Create manga card HTML
     */
    createMangaCard(manga) {
        const imageUrl = manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url || '';
        const chapters = manga.chapters || '?';
        const volumes = manga.volumes || '?';
        const score = manga.score || 'N/A';
        
        return `
            <div class="manga-card" data-mal-id="${manga.mal_id}" data-type="manga">
                <div class="manga-card-image">
                    <img src="${imageUrl}" alt="${manga.title}" loading="lazy">
                    <div class="anime-card-actions">
                        <button class="btn btn-primary btn-small view-btn" 
                                onclick="mangaBrowser.viewDetails(${manga.mal_id})">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="btn btn-secondary btn-small track-btn" 
                                onclick="mangaBrowser.addToReadingList(${manga.mal_id})">
                            <i class="fas fa-plus"></i> Track
                        </button>
                    </div>
                </div>
                <div class="manga-card-content">
                    <div class="manga-card-title">${manga.title}</div>
                    <div class="manga-card-chapters">
                        ${chapters} chapters • ${volumes} volumes • ⭐ ${score}
                    </div>
                    <div class="manga-card-meta">
                        <span>${manga.type || 'Manga'}</span>
                        <span>${manga.status || 'Unknown'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * View manga details
     */
    viewDetails(malId) {
        window.location.href = `detail.html?mal_id=${malId}&type=manga`;
    }

    /**
     * Add manga to reading list
     */
    async addToReadingList(malId) {
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
     * Load more manga (pagination)
     */
    async loadMore() {
        this.currentPage++;
        await this.loadManga();
    }

    /**
     * Search manga by title
     */
    search() {
        const searchInput = document.getElementById('mangaSearch');
        this.currentFilters.search = searchInput.value.trim();
        this.currentPage = 1;
        this.loadManga();
    }

    /**
     * Apply filters to manga list
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
        
        this.loadManga();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        document.getElementById('genreFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('sortFilter').value = 'popularity';
        document.getElementById('mangaSearch').value = '';
        
        this.currentFilters = {};
        this.currentPage = 1;
        this.loadManga();
    }

    /**
     * Update statistics display
     */
    updateStats(mangaCount) {
        const statsElement = document.getElementById('totalManga');
        if (statsElement) {
            statsElement.textContent = `${mangaCount} manga loaded`;
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
        document.querySelectorAll('.manga-card').forEach(card => {
            card.addEventListener('click', (e) => {
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
        
        if (Array.isArray(item.genres)) {
            const hasBlockedGenre = item.genres.some(genre => 
                blockedGenres.includes(genre.name)
            );
            if (hasBlockedGenre) return false;
        }
        return true;
    }
}