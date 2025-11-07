/**
 * DETAIL MANAGER CONTROLLER
 * Handles detailed view pages for anime and manga
 */
class DetailManager {
    constructor() {
        this.malId = null;
        this.type = null;
        this.data = null;
        this.jikanApiBase = 'https://api.jikan.moe/v4';
        
        this.init();
    }

    /**
     * Initialize the detail manager
     */
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.malId = urlParams.get('mal_id');
        this.type = urlParams.get('type') || 'anime';

        if (!this.malId) {
            this.showError('No ID provided');
            return;
        }

        this.loadDetails();
    }

    /**
     * Load detailed information from Jikan API
     */
    async loadDetails() {
        try {
            const response = await fetch(`${this.jikanApiBase}/${this.type}/${this.malId}/full`);
            if (!response.ok) throw new Error('Failed to fetch details');
            
            const result = await response.json();
            this.data = result.data;
            
            this.renderDetails();
        } catch (error) {
            console.error('Error loading details:', error);
            this.showError('Failed to load details. Please try again later.');
        }
    }

    /**
     * Render details to the page
     */
    renderDetails() {
        const loading = document.getElementById('loadingState');
        const content = document.getElementById('detailContent');
        const error = document.getElementById('errorState');

        loading.style.display = 'none';
        error.style.display = 'none';
        content.style.display = 'block';

        if (this.type === 'anime') {
            content.innerHTML = this.renderAnimeDetails();
        } else {
            content.innerHTML = this.renderMangaDetails();
        }

        this.bindEvents();
    }

    /**
     * Render anime details page
     */
    renderAnimeDetails() {
        const anime = this.data;
        const imageUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;
        const trailerUrl = anime.trailer?.embed_url;
        const score = anime.score || 'N/A';
        const episodes = anime.episodes || '?';
        const status = anime.status || 'Unknown';
        const rating = anime.rating || 'Unknown';

        return `
            <div class="detail-hero" style="background: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('${imageUrl}'); background-size: cover; background-position: center;">
                <div class="container">
                    <div class="detail-hero-content">
                        <div class="detail-poster">
                            <img src="${imageUrl}" alt="${anime.title}">
                        </div>
                        <div class="detail-info">
                            <h1 class="detail-title">${anime.title}</h1>
                            ${anime.title_english ? `<h2 class="detail-subtitle">${anime.title_english}</h2>` : ''}
                            
                            <div class="detail-meta">
                                <span class="meta-item">⭐ ${score}</span>
                                <span class="meta-item">${episodes} episodes</span>
                                <span class="meta-item">${status}</span>
                                <span class="meta-item">${rating}</span>
                            </div>

                            <div class="detail-actions">
                                <button class="btn btn-large btn-primary" onclick="detailManager.addToWatchlist()">
                                    <i class="fas fa-plus"></i> Add to Watchlist
                                </button>
                                ${trailerUrl ? `
                                    <button class="btn btn-large btn-secondary" onclick="detailManager.showTrailer()">
                                        <i class="fas fa-film"></i> Watch Trailer
                                    </button>
                                ` : ''}
                                <button class="btn btn-large btn-secondary" onclick="history.back()">
                                    <i class="fas fa-arrow-left"></i> Go Back
                                </button>
                            </div>

                            ${anime.synopsis ? `
                                <div class="detail-synopsis">
                                    <h3>Synopsis</h3>
                                    <p>${anime.synopsis}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="detail-content">
                <div class="container">
                    <div class="detail-grid">
                        <div class="detail-sidebar">
                            <div class="info-card">
                                <h4>Information</h4>
                                <div class="info-list">
                                    ${anime.type ? `<div class="info-item"><strong>Type:</strong> ${anime.type}</div>` : ''}
                                    ${anime.episodes ? `<div class="info-item"><strong>Episodes:</strong> ${anime.episodes}</div>` : ''}
                                    ${anime.status ? `<div class="info-item"><strong>Status:</strong> ${anime.status}</div>` : ''}
                                    ${anime.aired?.string ? `<div class="info-item"><strong>Aired:</strong> ${anime.aired.string}</div>` : ''}
                                    ${anime.season ? `<div class="info-item"><strong>Season:</strong> ${anime.season} ${anime.year || ''}</div>` : ''}
                                    ${anime.studios?.length > 0 ? `<div class="info-item"><strong>Studios:</strong> ${anime.studios.map(s => s.name).join(', ')}</div>` : ''}
                                    ${anime.genres?.length > 0 ? `<div class="info-item"><strong>Genres:</strong> ${anime.genres.map(g => g.name).join(', ')}</div>` : ''}
                                    ${anime.duration ? `<div class="info-item"><strong>Duration:</strong> ${anime.duration}</div>` : ''}
                                    ${anime.rating ? `<div class="info-item"><strong>Rating:</strong> ${anime.rating}</div>` : ''}
                                </div>
                            </div>

                            ${anime.statistics ? `
                                <div class="info-card">
                                    <h4>Statistics</h4>
                                    <div class="info-list">
                                        <div class="info-item"><strong>Score:</strong> ${anime.score || 'N/A'}</div>
                                        <div class="info-item"><strong>Ranked:</strong> ${anime.rank ? '#' + anime.rank : 'N/A'}</div>
                                        <div class="info-item"><strong>Popularity:</strong> ${anime.popularity ? '#' + anime.popularity : 'N/A'}</div>
                                        <div class="info-item"><strong>Members:</strong> ${anime.members?.toLocaleString() || 'N/A'}</div>
                                        <div class="info-item"><strong>Favorites:</strong> ${anime.favorites?.toLocaleString() || 'N/A'}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <div class="detail-main">
                            ${anime.background ? `
                                <div class="detail-section">
                                    <h3>Background</h3>
                                    <p>${anime.background}</p>
                                </div>
                            ` : ''}

                            ${anime.theme?.openings?.length > 0 ? `
                                <div class="detail-section">
                                    <h3>Opening Themes</h3>
                                    <ul>
                                        ${anime.theme.openings.map(theme => `<li>${theme}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}

                            ${anime.theme?.endings?.length > 0 ? `
                                <div class="detail-section">
                                    <h3>Ending Themes</h3>
                                    <ul>
                                        ${anime.theme.endings.map(theme => `<li>${theme}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}

                            ${anime.relations && anime.relations.length > 0 ? `
                                <div class="detail-section">
                                    <h3>Related Anime</h3>
                                    <div class="relations-grid">
                                        ${anime.relations.slice(0, 6).map(relation => `
                                            <div class="relation-item" onclick="detailManager.openRelation('${relation.relation}', ${relation.entry[0]?.mal_id}, '${relation.entry[0]?.type}')">
                                                <span class="relation-type">${relation.relation}</span>
                                                <span class="relation-title">${relation.entry[0]?.name || relation.entry[0]?.title}</span>
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
    }

    /**
     * Render manga details page
     */
    renderMangaDetails() {
        const manga = this.data;
        const imageUrl = manga.images?.jpg?.large_image_url || manga.images?.jpg?.image_url;
        const score = manga.score || 'N/A';
        const chapters = manga.chapters || '?';
        const volumes = manga.volumes || '?';
        const status = manga.status || 'Unknown';

        return `
            <div class="detail-hero" style="background: linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.7)), url('${imageUrl}'); background-size: cover; background-position: center;">
                <div class="container">
                    <div class="detail-hero-content">
                        <div class="detail-poster">
                            <img src="${imageUrl}" alt="${manga.title}">
                        </div>
                        <div class="detail-info">
                            <h1 class="detail-title">${manga.title}</h1>
                            ${manga.title_english ? `<h2 class="detail-subtitle">${manga.title_english}</h2>` : ''}
                            
                            <div class="detail-meta">
                                <span class="meta-item">⭐ ${score}</span>
                                <span class="meta-item">${chapters} chapters</span>
                                <span class="meta-item">${volumes} volumes</span>
                                <span class="meta-item">${status}</span>
                            </div>

                            <div class="detail-actions">
                                <button class="btn btn-large btn-primary" onclick="detailManager.addToReadingList()">
                                    <i class="fas fa-plus"></i> Add to Reading List
                                </button>
                                <button class="btn btn-large btn-secondary" onclick="history.back()">
                                    <i class="fas fa-arrow-left"></i> Go Back
                                </button>
                            </div>

                            ${manga.synopsis ? `
                                <div class="detail-synopsis">
                                    <h3>Synopsis</h3>
                                    <p>${manga.synopsis}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="detail-content">
                <div class="container">
                    <div class="detail-grid">
                        <div class="detail-sidebar">
                            <div class="info-card">
                                <h4>Information</h4>
                                <div class="info-list">
                                    ${manga.type ? `<div class="info-item"><strong>Type:</strong> ${manga.type}</div>` : ''}
                                    ${manga.chapters ? `<div class="info-item"><strong>Chapters:</strong> ${manga.chapters}</div>` : ''}
                                    ${manga.volumes ? `<div class="info-item"><strong>Volumes:</strong> ${manga.volumes}</div>` : ''}
                                    ${manga.status ? `<div class="info-item"><strong>Status:</strong> ${manga.status}</div>` : ''}
                                    ${manga.published?.string ? `<div class="info-item"><strong>Published:</strong> ${manga.published.string}</div>` : ''}
                                    ${manga.authors?.length > 0 ? `<div class="info-item"><strong>Authors:</strong> ${manga.authors.map(a => a.name).join(', ')}</div>` : ''}
                                    ${manga.genres?.length > 0 ? `<div class="info-item"><strong>Genres:</strong> ${manga.genres.map(g => g.name).join(', ')}</div>` : ''}
                                    ${manga.serializations?.length > 0 ? `<div class="info-item"><strong>Serialization:</strong> ${manga.serializations.map(s => s.name).join(', ')}</div>` : ''}
                                </div>
                            </div>

                            ${manga.statistics ? `
                                <div class="info-card">
                                    <h4>Statistics</h4>
                                    <div class="info-list">
                                        <div class="info-item"><strong>Score:</strong> ${manga.score || 'N/A'}</div>
                                        <div class="info-item"><strong>Ranked:</strong> ${manga.rank ? '#' + manga.rank : 'N/A'}</div>
                                        <div class="info-item"><strong>Popularity:</strong> ${manga.popularity ? '#' + manga.popularity : 'N/A'}</div>
                                        <div class="info-item"><strong>Members:</strong> ${manga.members?.toLocaleString() || 'N/A'}</div>
                                        <div class="info-item"><strong>Favorites:</strong> ${manga.favorites?.toLocaleString() || 'N/A'}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <div class="detail-main">
                            ${manga.background ? `
                                <div class="detail-section">
                                    <h3>Background</h3>
                                    <p>${manga.background}</p>
                                </div>
                            ` : ''}

                            ${manga.relations && manga.relations.length > 0 ? `
                                <div class="detail-section">
                                    <h3>Related Manga</h3>
                                    <div class="relations-grid">
                                        ${manga.relations.slice(0, 6).map(relation => `
                                            <div class="relation-item" onclick="detailManager.openRelation('${relation.relation}', ${relation.entry[0]?.mal_id}, '${relation.entry[0]?.type}')">
                                                <span class="relation-type">${relation.relation}</span>
                                                <span class="relation-title">${relation.entry[0]?.name || relation.entry[0]?.title}</span>
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
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Additional event bindings can be added here
    }

    /**
     * Add anime to watchlist
     */
    async addToWatchlist() {
        try {
            if (window.electronAPI) {
                await window.electronAPI.addToWatchlist(this.data);
                this.showNotification('Added to watchlist!');
            } else {
                this.showNotification('Watchlist feature requires the desktop app');
            }
        } catch (error) {
            console.error('Error adding to watchlist:', error);
            this.showNotification('Failed to add to watchlist');
        }
    }

    /**
     * Add manga to reading list
     */
    async addToReadingList() {
        try {
            if (window.electronAPI) {
                await window.electronAPI.addToReadingList(this.data);
                this.showNotification('Added to reading list!');
            } else {
                this.showNotification('Reading list feature requires the desktop app');
            }
        } catch (error) {
            console.error('Error adding to reading list:', error);
            this.showNotification('Failed to add to reading list');
        }
    }

    /**
     * Show trailer modal
     */
    showTrailer() {
        if (this.data.trailer?.embed_url) {
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.9); z-index: 10000; display: flex;
                align-items: center; justify-content: center;
            `;
            
            modal.innerHTML = `
                <div style="background: var(--card-bg); padding: 20px; border-radius: 8px; max-width: 800px; width: 90%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="color: var(--light); margin: 0;">${this.data.title} - Official Trailer</h3>
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                                style="background: none; border: none; color: var(--light); font-size: 20px; cursor: pointer;">
                            ×
                        </button>
                    </div>
                    <iframe 
                        width="100%" 
                        height="400" 
                        src="${this.data.trailer.embed_url}" 
                        frameborder="0" 
                        allowfullscreen
                        style="border-radius: 4px;"
                    ></iframe>
                    <div style="margin-top: 15px; text-align: center;">
                        <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.remove()">
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
    }

    /**
     * Open related anime/manga
     */
    openRelation(relationType, malId, mediaType) {
        if (malId && mediaType) {
            window.location.href = `detail.html?mal_id=${malId}&type=${mediaType}`;
        }
    }

    /**
     * Show error state
     */
    showError(message) {
        const loading = document.getElementById('loadingState');
        const content = document.getElementById('detailContent');
        const error = document.getElementById('errorState');

        loading.style.display = 'none';
        content.style.display = 'none';
        error.style.display = 'block';

        error.querySelector('h3').textContent = message;
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.detailManager = new DetailManager();
});