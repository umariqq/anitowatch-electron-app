/**
 * FAVORITES MANAGER CONTROLLER
 * Handles displaying and managing user's favorite characters
 */
class FavoritesManager {
    constructor() {
        this.favorites = [];
        
        this.init();
    }

    /**
     * Initialize the favorites manager
     */
    async init() {
        await this.loadFavorites();
        this.renderFavorites();
        this.bindEvents();
    }

    /**
     * Load favorites from storage
     */
    async loadFavorites() {
        try {
            if (window.electronAPI) {
                this.favorites = await window.electronAPI.getFavorites();
            } else {
                // Fallback for browser testing
                const saved = localStorage.getItem('anitowatch-favorites');
                this.favorites = saved ? JSON.parse(saved) : [];
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
            this.favorites = [];
        }
    }

    /**
     * Render favorites to the page
     */
    renderFavorites() {
        const container = document.getElementById('favoritesContent');
        const emptyState = document.getElementById('emptyFavorites');
        const favoritesGrid = document.getElementById('favoritesGrid');

        if (this.favorites.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            this.updateStats();
            return;
        }

        container.style.display = 'block';
        emptyState.style.display = 'none';

        // Create character cards in 4-column grid
        favoritesGrid.innerHTML = this.favorites.map(character => this.createCharacterCard(character)).join('');

        this.updateStats();
        this.bindCardEvents();
    }

    /**
     * Create character card HTML for favorites
     */
    createCharacterCard(character) {
        const imageUrl = character.image || character.images?.jpg?.image_url;
        const favoriteCount = character.favorites?.toLocaleString() || '0';
        
        return `
            <div class="character-card" data-character-id="${character.mal_id}" style="margin: 10px;">
                <div class="character-card-image">
                    <img src="${imageUrl}" alt="${character.name}" loading="lazy">
                    <button class="favorite-btn favorited" 
                            onclick="favoritesManager.removeFavorite(${character.mal_id})">
                        <i class="fas fa-heart"></i>
                    </button>
                    <div class="character-card-badge">
                        ❤️ ${favoriteCount}
                    </div>
                </div>
                <div class="character-card-content">
                    <h3 class="character-card-name">${character.name}</h3>
                    <p class="character-card-anime">${character.anime || 'Unknown Anime'}</p>
                    <div class="character-card-actions">
                        <button class="btn btn-primary btn-small" onclick="favoritesManager.viewCharacterDetails(${character.mal_id})">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="favoritesManager.viewVoiceActors(${character.mal_id}, '${character.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-microphone"></i> Voice Actors
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Remove character from favorites
     */
    async removeFavorite(characterId) {
        if (!confirm('Are you sure you want to remove this character from your favorites?')) {
            return;
        }

        try {
            if (window.electronAPI) {
                await window.electronAPI.removeFromFavorites(characterId);
            } else {
                // Fallback for browser testing
                const saved = localStorage.getItem('anitowatch-favorites');
                let favorites = saved ? JSON.parse(saved) : [];
                favorites = favorites.filter(fav => fav.mal_id !== characterId);
                localStorage.setItem('anitowatch-favorites', JSON.stringify(favorites));
            }

            // Update local data
            this.favorites = this.favorites.filter(fav => fav.mal_id !== characterId);
            this.renderFavorites();

            this.showNotification('Removed from favorites');

        } catch (error) {
            console.error('Error removing favorite:', error);
            this.showNotification('Failed to remove from favorites');
        }
    }

    /**
     * View character details
     */
    async viewCharacterDetails(characterId) {
        try {
            const response = await fetch(`https://api.jikan.moe/v4/characters/${characterId}/full`);
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
            const response = await fetch(`https://api.jikan.moe/v4/characters/${characterId}/voices`);
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
                                            <div class="anime-item" onclick="favoritesManager.openAnime(${anime.anime?.mal_id})">
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
                                        <button class="btn btn-small btn-primary" onclick="favoritesManager.viewVoiceActorDetails(${va.person?.mal_id}, '${va.person?.name.replace(/'/g, "\\'")}')">
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
            const response = await fetch(`https://api.jikan.moe/v4/people/${voiceActorId}/full`);
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
                                            <div class="role-card" onclick="favoritesManager.openAnime(${role.anime?.mal_id})">
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
     * Update favorites statistics
     */
    updateStats() {
        const totalFavorites = this.favorites.length;
        document.getElementById('totalFavorites').textContent = `${totalFavorites} favorite characters`;
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
}