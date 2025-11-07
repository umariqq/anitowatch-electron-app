/**
 * SEARCH MANAGER CONTROLLER
 * Handles search functionality across anime, manga, and characters
 */
class SearchManager {
    constructor() {
        this.currentQuery = '';
        this.currentPage = 1;
        this.currentType = 'all';
        this.hasMore = true;
        this.jikanApiBase = 'https://api.jikan.moe/v4';
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        
        this.init();
    }

    /**
     * Initialize the search manager
     */
    init() {
        this.parseURLParams();
        this.performSearch();
        this.bindEvents();
    }

    /**
     * Parse search query from URL parameters
     */
    parseURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        
        if (query) {
            this.currentQuery = query;
            document.getElementById('searchInput').value = query;
        }
    }

    /**
     * Perform search based on current query and filters
     */
    async performSearch() {
        if (!this.currentQuery.trim()) {
            this.showNoResults('Please enter a search term');
            return;
        }

        this.currentPage = 1;
        this.hasMore = true;
        
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Searching...</p></div>';
        
        document.getElementById('noResults').style.display = 'none';
        document.getElementById('loadMore').style.display = 'none';

        await this.executeSearch();
    }

    /**
     * Execute the search across Jikan API
     */
    async executeSearch() {
        try {
            let animeResults = [];
            let mangaResults = [];
            let characterResults = [];

            // Search anime if needed
            if (this.currentType === 'all' || this.currentType === 'anime') {
                const animeResponse = await fetch(
                    `${this.jikanApiBase}/anime?q=${encodeURIComponent(this.currentQuery)}&page=${this.currentPage}&limit=12`
                );
                const animeData = await animeResponse.json();
                animeResults = (animeData.data || []).filter(item => this.isSafeContent(item));
            }

            // Search manga if needed
            if (this.currentType === 'all' || this.currentType === 'manga') {
                const mangaResponse = await fetch(
                    `${this.jikanApiBase}/manga?q=${encodeURIComponent(this.currentQuery)}&page=${this.currentPage}&limit=12`
                );
                const mangaData = await mangaResponse.json();
                mangaResults = (mangaData.data || []).filter(item => this.isSafeContent(item));
            }

            // Search characters if needed
            if (this.currentType === 'all' || this.currentType === 'characters') {
                const characterResponse = await fetch(
                    `${this.jikanApiBase}/characters?q=${encodeURIComponent(this.currentQuery)}&page=${this.currentPage}&limit=12`
                );
                const characterData = await characterResponse.json();
                characterResults = characterData.data || [];
            }

            this.displayResults(animeResults, mangaResults, characterResults);
            this.updateResultCount(animeResults.length, mangaResults.length, characterResults.length);

        } catch (error) {
            console.error('Search error:', error);
            this.showNoResults('Search failed. Please try again.');
        }
    }

    /**
     * Display search results
     */
    displayResults(animeResults, mangaResults, characterResults) {
        const resultsContainer = document.getElementById('searchResults');
        let html = '';

        if (this.currentType === 'all') {
            // Display all result types
            if (animeResults.length > 0) {
                html += `
                    <div class="search-category">
                        <h3 class="category-title">
                            <i class="fas fa-tv"></i> Anime Results (${animeResults.length})
                        </h3>
                        <div class="recent-grid">
                            ${animeResults.map(anime => this.createAnimeCard(anime)).join('')}
                        </div>
                    </div>
                `;
            }

            if (mangaResults.length > 0) {
                html += `
                    <div class="search-category">
                        <h3 class="category-title">
                            <i class="fas fa-book"></i> Manga Results (${mangaResults.length})
                        </h3>
                        <div class="manga-grid">
                            ${mangaResults.map(manga => this.createMangaCard(manga)).join('')}
                        </div>
                    </div>
                `;
            }

            if (characterResults.length > 0) {
                html += `
                    <div class="search-category">
                        <h3 class="category-title">
                            <i class="fas fa-users"></i> Character Results (${characterResults.length})
                        </h3>
                        <div class="characters-grid">
                            ${characterResults.map(character => this.createCharacterCard(character)).join('')}
                        </div>
                    </div>
                `;
            }
        } else if (this.currentType === 'anime' && animeResults.length > 0) {
            // Display only anime results
            html = `
                <div class="recent-grid">
                    ${animeResults.map(anime => this.createAnimeCard(anime)).join('')}
                </div>
            `;
        } else if (this.currentType === 'manga' && mangaResults.length > 0) {
            // Display only manga results
            html = `
                <div class="manga-grid">
                    ${mangaResults.map(manga => this.createMangaCard(manga)).join('')}
                </div>
            `;
        } else if (this.currentType === 'characters' && characterResults.length > 0) {
            // Display only character results
            html = `
                <div class="characters-grid">
                    ${characterResults.map(character => this.createCharacterCard(character)).join('')}
                </div>
            `;
        }

        if (this.currentPage === 1) {
            resultsContainer.innerHTML = html || '<div class="empty-state">No results found</div>';
        } else {
            resultsContainer.innerHTML += html;
        }

        // Show/hide load more button
        const hasAnimeNextPage = animeResults.length === 12;
        const hasMangaNextPage = mangaResults.length === 12;
        const hasCharacterNextPage = characterResults.length === 12;
        this.hasMore = hasAnimeNextPage || hasMangaNextPage || hasCharacterNextPage;
        
        document.getElementById('loadMore').style.display = this.hasMore ? 'block' : 'none';
        document.getElementById('noResults').style.display = (html === '') ? 'block' : 'none';

        this.bindCardEvents();
    }

    /**
     * Create anime card for search results
     */
    createAnimeCard(anime) {
        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
        const score = anime.score || 'N/A';
        const episodes = anime.episodes || '?';
        
        return `
            <div class="anime-card" data-mal-id="${anime.mal_id}">
                <div class="anime-card-image">
                    <img src="${imageUrl}" alt="${anime.title}" loading="lazy">
                    <div class="anime-card-badge">⭐ ${score}</div>
                    <div class="anime-card-actions">
                        <button class="btn btn-primary btn-small" onclick="searchManager.viewDetails(${anime.mal_id}, 'anime')">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="searchManager.addToWatchlist(${anime.mal_id})">
                            <i class="fas fa-plus"></i> Track
                        </button>
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
     * Create manga card for search results
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
                        <button class="btn btn-primary btn-small" onclick="searchManager.viewDetails(${manga.mal_id}, 'manga')">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="searchManager.addToReadingList(${manga.mal_id})">
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
     * Create character card for search results
     */
    createCharacterCard(character) {
        const imageUrl = character.images?.jpg?.image_url;
        
        return `
            <div class="character-card" data-character-id="${character.mal_id}">
                <div class="character-card-image">
                    <img src="${imageUrl}" alt="${character.name}" loading="lazy">
                    <div class="character-card-badge">
                        ❤️ ${character.favorites?.toLocaleString() || '0'}
                    </div>
                </div>
                <div class="character-card-content">
                    <h3 class="character-card-name">${character.name}</h3>
                    <p class="character-card-anime">${this.getAnimeNames(character.anime)}</p>
                    <div class="character-card-actions">
                        <button class="btn btn-primary btn-small" onclick="searchManager.viewCharacterDetails(${character.mal_id})">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Get anime names for character display
     */
    getAnimeNames(anime) {
        if (!anime || anime.length === 0) return 'Unknown Anime';
        return anime.slice(0, 2).map(a => a.anime?.title || 'Unknown').join(', ');
    }

    /**
     * View details for anime/manga
     */
    viewDetails(malId, type) {
        window.location.href = `detail.html?mal_id=${malId}&type=${type}`;
    }

    /**
     * View character details
     */
    viewCharacterDetails(characterId) {
        // For characters, we'll show a modal instead of navigating
        this.showCharacterModal(characterId);
    }

    /**
     * Show character details modal
     */
    async showCharacterModal(characterId) {
        try {
            const response = await fetch(`${this.jikanApiBase}/characters/${characterId}`);
            const data = await response.json();
            const character = data.data;
            
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>${character.name}</h3>
                        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="character-detail" style="text-align: center;">
                            <div class="character-detail-image">
                                <img src="${character.images?.jpg?.image_url}" alt="${character.name}" style="max-width: 200px;">
                            </div>
                            <div class="character-detail-info">
                                <div class="character-meta">
                                    <span class="meta-item">❤️ ${character.favorites?.toLocaleString() || '0'} favorites</span>
                                </div>
                                ${character.about ? `
                                    <div class="character-about">
                                        <h4>About</h4>
                                        <p>${character.about.substring(0, 200)}...</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        } catch (error) {
            console.error('Error loading character details:', error);
        }
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
     * Switch between search tabs
     */
    switchTab(type) {
        this.currentType = type;
        this.currentPage = 1;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.performSearch();
    }

    /**
     * Load more results (pagination)
     */
    async loadMore() {
        this.currentPage++;
        await this.executeSearch();
    }

    /**
     * Update result count display
     */
    updateResultCount(animeCount, mangaCount, characterCount) {
        const resultCount = document.getElementById('resultCount');
        let message = '';

        if (this.currentType === 'all') {
            const total = animeCount + mangaCount + characterCount;
            message = `${total} results found (${animeCount} anime, ${mangaCount} manga, ${characterCount} characters)`;
        } else if (this.currentType === 'anime') {
            message = `${animeCount} anime results found`;
        } else if (this.currentType === 'manga') {
            message = `${mangaCount} manga results found`;
        } else if (this.currentType === 'characters') {
            message = `${characterCount} character results found`;
        }

        resultCount.textContent = message;
    }

    /**
     * Show no results state
     */
    showNoResults(message) {
        const resultsContainer = document.getElementById('searchResults');
        const noResults = document.getElementById('noResults');
        
        resultsContainer.innerHTML = '';
        noResults.style.display = 'block';
        noResults.querySelector('h3').textContent = message;
        
        document.getElementById('loadMore').style.display = 'none';
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
     * Bind events
     */
    bindEvents() {
        this.bindCardEvents();
    }

    bindCardEvents() {
        document.querySelectorAll('.anime-card, .manga-card, .character-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const malId = card.dataset.malId || card.dataset.characterId;
                    const type = card.dataset.type || 'anime';
                    
                    if (type === 'manga') {
                        this.viewDetails(malId, 'manga');
                    } else if (card.classList.contains('character-card')) {
                        this.viewCharacterDetails(malId);
                    } else {
                        this.viewDetails(malId, 'anime');
                    }
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