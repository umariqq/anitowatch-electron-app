/**
 * CHARACTERS MANAGER CONTROLLER
 * Handles character browsing, favorites, and voice actor information
 */
class CharacterManager {
    constructor() {
        this.currentPage = 1;
        this.hasMore = true;
        this.currentFilters = {};
        this.jikanApiBase = 'https://api.jikan.moe/v4';
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        this.favoriteCharacters = new Set();
        
        this.init();
    }

    /**
     * Initialize the characters manager
     */
    async init() {
        await this.loadFavoriteCharacters();
        await this.loadCharacters();
        this.bindEvents();
    }

    /**
     * Load user's favorite characters from storage
     */
    async loadFavoriteCharacters() {
        try {
            if (window.electronAPI) {
                const favorites = await window.electronAPI.getFavorites();
                this.favoriteCharacters = new Set(favorites.map(fav => fav.mal_id));
            } else {
                // Fallback to localStorage for browser testing
                const saved = localStorage.getItem('anitowatch-favorite-characters');
                if (saved) {
                    this.favoriteCharacters = new Set(JSON.parse(saved));
                }
            }
        } catch (error) {
            console.error('Error loading favorite characters:', error);
        }
    }

    /**
     * Save favorite characters to storage
     */
    async saveFavoriteCharacters() {
        try {
            if (window.electronAPI) {
                // Favorites are automatically saved by main process
            } else {
                localStorage.setItem('anitowatch-favorite-characters', 
                    JSON.stringify([...this.favoriteCharacters]));
            }
        } catch (error) {
            console.error('Error saving favorite characters:', error);
        }
    }

    /**
     * Load characters from Jikan API
     */
    async loadCharacters() {
        const grid = document.getElementById('charactersGrid');
        if (!grid) return;

        try {
            if (this.currentPage === 1) {
                grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading characters...</p></div>';
            }
            
            let url = `${this.jikanApiBase}/characters?page=${this.currentPage}&limit=20&order_by=favorites&sort=desc`;
            
            // Add search filter if present
            if (this.currentFilters.search) {
                url = `${this.jikanApiBase}/characters?q=${encodeURIComponent(this.currentFilters.search)}&page=${this.currentPage}&limit=20`;
            }

            const response = await fetch(url);
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                const safeCharacters = data.data.filter(char => this.isSafeCharacter(char));
                
                if (this.currentPage === 1) {
                    grid.innerHTML = safeCharacters.map(character => 
                        this.createCharacterCard(character)
                    ).join('');
                } else {
                    grid.innerHTML += safeCharacters.map(character => 
                        this.createCharacterCard(character)
                    ).join('');
                }
                
                this.hasMore = data.pagination && data.pagination.has_next_page;
                document.getElementById('loadMore').style.display = this.hasMore ? 'block' : 'none';
                
                this.updateStats(safeCharacters.length);
                this.bindCardEvents();
            } else {
                grid.innerHTML = '<div class="empty-state">No characters found matching your criteria.</div>';
                document.getElementById('loadMore').style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading characters:', error);
            grid.innerHTML = '<div class="error">Failed to load characters. Please try again later.</div>';
        }
    }

    /**
     * Create character card HTML
     */
    createCharacterCard(character) {
        const imageUrl = character.images?.jpg?.image_url;
        const isFavorite = this.favoriteCharacters.has(character.mal_id);
        const favoriteCount = character.favorites?.toLocaleString() || '0';
        
        return `
            <div class="character-card" data-character-id="${character.mal_id}">
                <div class="character-card-image">
                    <img src="${imageUrl}" alt="${character.name}" loading="lazy">
                    <button class="favorite-btn ${isFavorite ? 'favorited' : ''}" 
                            onclick="characterManager.toggleFavorite(${character.mal_id})">
                        <i class="fas fa-heart"></i>
                    </button>
                    <div class="character-card-badge">
                        ❤️ ${favoriteCount}
                    </div>
                </div>
                <div class="character-card-content">
                    <h3 class="character-card-name">${character.name}</h3>
                    <p class="character-card-anime">${this.getAnimeNames(character.anime)}</p>
                    <div class="character-card-actions">
                        <button class="btn btn-primary btn-small" onclick="characterManager.viewCharacterDetails(${character.mal_id})">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="characterManager.viewVoiceActors(${character.mal_id}, '${character.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-microphone"></i> Voice Actors
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
     * Toggle character favorite status
     */
    async toggleFavorite(characterId) {
        try {
            if (this.favoriteCharacters.has(characterId)) {
                // Remove from favorites
                this.favoriteCharacters.delete(characterId);
                if (window.electronAPI) {
                    await window.electronAPI.removeFromFavorites(characterId);
                }
                this.showNotification('Removed from favorites');
            } else {
                // Add to favorites - fetch character data first
                const response = await fetch(`${this.jikanApiBase}/characters/${characterId}`);
                const data = await response.json();
                const character = data.data;
                
                this.favoriteCharacters.add(characterId);
                if (window.electronAPI) {
                    await window.electronAPI.addToFavorites(character);
                }
                this.showNotification('Added to favorites!');
            }
            
            await this.saveFavoriteCharacters();
            this.updateFavoriteButton(characterId);
        } catch (error) {
            console.error('Error toggling favorite:', error);
            this.showNotification('Failed to update favorites');
        }
    }

    /**
     * Update favorite button appearance
     */
    updateFavoriteButton(characterId) {
        const button = document.querySelector(`[data-character-id="${characterId}"] .favorite-btn`);
        if (button) {
            const isFavorite = this.favoriteCharacters.has(characterId);
            button.classList.toggle('favorited', isFavorite);
        }
    }

    /**
     * View character details
     */
    async viewCharacterDetails(characterId) {
        try {
            const response = await fetch(`${this.jikanApiBase}/characters/${characterId}/full`);
            const data = await response.json();
            
            this.showCharacterModal(data.data);
        } catch (error) {
            console.error('Error loading character details:', error);
            this.showNotification('Failed to load character details');
        }
    }

    /**
     * View voice actors for character
     */
    async viewVoiceActors(characterId, characterName) {
        try {
            const response = await fetch(`${this.jikanApiBase}/characters/${characterId}/voices`);
            const data = await response.json();
            
            this.showVoiceActorsModal(characterName, data.data);
        } catch (error) {
            console.error('Error loading voice actors:', error);
            this.showNotification('Failed to load voice actors');
        }
    }

    /**
     * Show character details modal
     */
    showCharacterModal(character) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <div class="modal-header">
                    <h3>${character.name}</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="character-detail">
                        <div class="character-detail-image">
                            <img src="${character.images?.jpg?.image_url}" alt="${character.name}">
                        </div>
                        <div class="character-detail-info">
                            <div class="character-meta">
                                <span class="meta-item">❤️ ${character.favorites?.toLocaleString() || '0'} favorites</span>
                                ${character.nicknames && character.nicknames.length > 0 ? 
                                    `<span class="meta-item">AKA: ${character.nicknames.join(', ')}</span>` : ''}
                            </div>
                            
                            ${character.about ? `
                                <div class="character-about">
                                    <h4>About</h4>
                                    <p>${character.about}</p>
                                </div>
                            ` : ''}
                            
                            ${character.anime && character.anime.length > 0 ? `
                                <div class="character-anime">
                                    <h4>Anime Appearances</h4>
                                    <div class="anime-list">
                                        ${character.anime.slice(0, 5).map(anime => `
                                            <div class="anime-item" onclick="characterManager.openAnime(${anime.anime?.mal_id})">
                                                <img src="${anime.anime?.images?.jpg?.small_image_url}" alt="${anime.anime?.title}">
                                                <span>${anime.anime?.title}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Show voice actors modal
     */
    showVoiceActorsModal(characterName, voiceActors) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <div class="modal-header">
                    <h3>Voice Actors for ${characterName}</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${voiceActors && voiceActors.length > 0 ? `
                        <div class="voice-actors-list">
                            ${voiceActors.map(va => `
                                <div class="voice-actor-card">
                                    <div class="voice-actor-image">
                                        <img src="${va.person?.images?.jpg?.image_url}" alt="${va.person?.name}">
                                    </div>
                                    <div class="voice-actor-info">
                                        <h4>${va.person?.name}</h4>
                                        <p class="voice-actor-language">${va.language || 'Japanese'}</p>
                                        <button class="btn btn-small btn-primary" onclick="characterManager.viewVoiceActorDetails(${va.person?.mal_id}, '${va.person?.name.replace(/'/g, "\\'")}')">
                                            View Other Roles
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>No voice actor information available.</p>'}
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
     * View voice actor details
     */
    async viewVoiceActorDetails(voiceActorId, voiceActorName) {
        try {
            const response = await fetch(`${this.jikanApiBase}/people/${voiceActorId}/full`);
            const data = await response.json();
            
            this.showVoiceActorModal(voiceActorName, data.data);
        } catch (error) {
            console.error('Error loading voice actor details:', error);
            this.showNotification('Failed to load voice actor details');
        }
    }

    /**
     * Show voice actor details modal
     */
    showVoiceActorModal(voiceActorName, voiceActor) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3>${voiceActorName}</h3>
                    <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="voice-actor-detail">
                        <div class="voice-actor-detail-image">
                            <img src="${voiceActor.images?.jpg?.image_url}" alt="${voiceActorName}">
                        </div>
                        <div class="voice-actor-detail-info">
                            ${voiceActor.about ? `
                                <div class="voice-actor-about">
                                    <h4>About</h4>
                                    <p>${voiceActor.about.substring(0, 300)}...</p>
                                </div>
                            ` : ''}
                            
                            ${voiceActor.voices && voiceActor.voices.length > 0 ? `
                                <div class="voice-actor-roles">
                                    <h4>Notable Roles</h4>
                                    <div class="roles-grid">
                                        ${voiceActor.voices.slice(0, 8).map(role => `
                                            <div class="role-card" onclick="characterManager.openAnime(${role.anime?.mal_id})">
                                                <img src="${role.anime?.images?.jpg?.small_image_url}" alt="${role.anime?.title}">
                                                <div class="role-info">
                                                    <strong>${role.character?.name}</strong>
                                                    <span>${role.anime?.title}</span>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
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
    }

    /**
     * Open anime details page
     */
    openAnime(malId) {
        window.location.href = `detail.html?mal_id=${malId}&type=anime`;
    }

    /**
     * Load more characters (pagination)
     */
    async loadMore() {
        this.currentPage++;
        await this.loadCharacters();
    }

    /**
     * Search characters
     */
    search() {
        const searchInput = document.getElementById('characterSearch');
        this.currentFilters.search = searchInput.value.trim();
        this.currentPage = 1;
        this.loadCharacters();
    }

    /**
     * Apply filters (placeholder for future enhancement)
     */
    applyFilters() {
        this.currentPage = 1;
        this.loadCharacters();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        document.getElementById('characterSearch').value = '';
        document.getElementById('animeFilter').value = '';
        document.getElementById('typeFilter').value = '';
        
        this.currentFilters = {};
        this.currentPage = 1;
        this.loadCharacters();
    }

    /**
     * Update statistics display
     */
    updateStats(characterCount) {
        const statsElement = document.getElementById('totalCharacters');
        if (statsElement) {
            statsElement.textContent = `${characterCount} characters loaded`;
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
     * Bind events
     */
    bindEvents() {
        this.bindCardEvents();
    }

    bindCardEvents() {
        // Additional event bindings can be added here
    }

    /**
     * Character safety filter
     */
    isSafeCharacter(character) {
        // Basic safety filter - can be enhanced with more specific rules
        return true;
    }
}