/**
 * WATCHLIST MANAGER CONTROLLER
 * Handles anime watchlist management and progress tracking
 */
class WatchlistManager {
    constructor() {
        this.watchlist = [];
        this.filteredList = [];
        this.currentFilter = 'all';
        this.currentSort = 'added';
        
        this.init();
    }

    /**
     * Initialize the watchlist manager
     */
    async init() {
        await this.loadWatchlist();
        this.updateStats();
        this.renderWatchlist();
        this.bindEvents();
    }

    /**
     * Load watchlist from storage
     */
    async loadWatchlist() {
        try {
            if (window.electronAPI) {
                this.watchlist = await window.electronAPI.getWatchlist();
            } else {
                // Fallback for browser testing
                const saved = localStorage.getItem('anitowatch-watchlist');
                this.watchlist = saved ? JSON.parse(saved) : [];
            }
            this.applyFiltersAndSort();
        } catch (error) {
            console.error('Error loading watchlist:', error);
            this.watchlist = [];
        }
    }

    /**
     * Filter watchlist by status
     */
    filterWatchlist() {
        const statusFilter = document.getElementById('statusFilter');
        this.currentFilter = statusFilter.value;
        this.applyFiltersAndSort();
    }

    /**
     * Sort watchlist
     */
    sortWatchlist() {
        const sortFilter = document.getElementById('sortFilter');
        this.currentSort = sortFilter.value;
        this.applyFiltersAndSort();
    }

    /**
     * Apply both filters and sorting
     */
    applyFiltersAndSort() {
        // Apply status filter
        if (this.currentFilter === 'all') {
            this.filteredList = [...this.watchlist];
        } else {
            this.filteredList = this.watchlist.filter(item => item.status === this.currentFilter);
        }

        // Apply sorting
        switch (this.currentSort) {
            case 'title':
                this.filteredList.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'score':
                this.filteredList.sort((a, b) => (b.score || 0) - (a.score || 0));
                break;
            case 'episodes':
                this.filteredList.sort((a, b) => (b.episodes || 0) - (a.episodes || 0));
                break;
            case 'added':
            default:
                this.filteredList.sort((a, b) => new Date(b.added_date) - new Date(a.added_date));
                break;
        }

        this.renderWatchlist();
    }

    /**
     * Render watchlist to the page
     */
    renderWatchlist() {
        const container = document.getElementById('watchlistContent');
        const emptyState = document.getElementById('emptyWatchlist');

        if (this.filteredList.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'block';
        emptyState.style.display = 'none';

        container.innerHTML = this.filteredList.map(anime => `
            <div class="watchlist-item">
                <div class="watchlist-item-image">
                    <img src="${anime.image}" alt="${anime.title}" loading="lazy">
                </div>
                <div class="watchlist-item-content">
                    <h3 class="watchlist-item-title">${anime.title}</h3>
                    <div class="watchlist-item-meta">
                        <span class="status-badge status-${anime.status}">${this.formatStatus(anime.status)}</span>
                        <span>${anime.episodes_watched || 0}/${anime.episodes || '?'} episodes</span>
                        <span>⭐ ${anime.score || 'N/A'}</span>
                        <span>Your rating: ${anime.rating || 'Not rated'}</span>
                    </div>
                    ${anime.notes ? `<p class="watchlist-item-notes">${anime.notes}</p>` : ''}
                </div>
                <div class="watchlist-item-actions">
                    <button class="btn btn-primary btn-small" onclick="watchlistManager.viewAnime(${anime.mal_id})">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="watchlistManager.editAnime(${anime.mal_id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-small" onclick="watchlistManager.removeAnime(${anime.mal_id})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * View anime details
     */
    viewAnime(malId) {
        window.location.href = `detail.html?mal_id=${malId}&type=anime`;
    }

    /**
     * Edit anime progress
     */
    editAnime(malId) {
        const anime = this.watchlist.find(a => a.mal_id === malId);
        if (!anime) return;

        const modal = document.getElementById('editModal');
        const formContent = document.getElementById('editFormContent');

        formContent.innerHTML = `
            <form onsubmit="watchlistManager.saveEdit(${malId}); return false;">
                <div class="form-group">
                    <label>Status:</label>
                    <select id="editStatus" class="form-select">
                        <option value="planning" ${anime.status === 'planning' ? 'selected' : ''}>Planning to Watch</option>
                        <option value="watching" ${anime.status === 'watching' ? 'selected' : ''}>Currently Watching</option>
                        <option value="completed" ${anime.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="dropped" ${anime.status === 'dropped' ? 'selected' : ''}>Dropped</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Episodes Watched:</label>
                    <input type="number" id="editEpisodes" value="${anime.episodes_watched || 0}" 
                           min="0" max="${anime.episodes || 999}">
                </div>
                
                <div class="form-group">
                    <label>Your Rating (1-10):</label>
                    <input type="number" id="editRating" value="${anime.rating || 0}" 
                           min="0" max="10" step="0.5">
                </div>
                
                <div class="form-group">
                    <label>Notes:</label>
                    <textarea id="editNotes" rows="3">${anime.notes || ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                    <button type="button" class="btn btn-secondary" onclick="watchlistManager.closeEditModal()">Cancel</button>
                </div>
            </form>
        `;

        modal.style.display = 'block';
    }

    /**
     * Save edited anime progress
     */
    async saveEdit(malId) {
        const status = document.getElementById('editStatus').value;
        const episodes = parseInt(document.getElementById('editEpisodes').value) || 0;
        const rating = parseFloat(document.getElementById('editRating').value) || 0;
        const notes = document.getElementById('editNotes').value;

        try {
            if (window.electronAPI) {
                await window.electronAPI.updateWatchlist(malId, {
                    status,
                    episodes_watched: episodes,
                    rating,
                    notes
                });
            }

            // Update local data
            const animeIndex = this.watchlist.findIndex(a => a.mal_id === malId);
            if (animeIndex !== -1) {
                this.watchlist[animeIndex] = {
                    ...this.watchlist[animeIndex],
                    status,
                    episodes_watched: episodes,
                    rating,
                    notes
                };
                await this.saveWatchlist();
            }

            this.closeEditModal();
            this.applyFiltersAndSort();
            this.updateStats();

        } catch (error) {
            console.error('Error updating anime:', error);
            this.showNotification('Failed to update anime. Please try again.');
        }
    }

    /**
     * Close edit modal
     */
    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    /**
     * Remove anime from watchlist
     */
    async removeAnime(malId) {
        if (!confirm('Are you sure you want to remove this anime from your watchlist?')) {
            return;
        }

        try {
            if (window.electronAPI) {
                await window.electronAPI.removeFromWatchlist(malId);
            }

            this.watchlist = this.watchlist.filter(a => a.mal_id !== malId);
            await this.saveWatchlist();

            this.applyFiltersAndSort();
            this.updateStats();

        } catch (error) {
            console.error('Error removing anime:', error);
            this.showNotification('Failed to remove anime. Please try again.');
        }
    }

    /**
     * Save watchlist to storage
     */
    async saveWatchlist() {
        try {
            if (window.electronAPI) {
                // Watchlist is automatically saved by main process
            } else {
                localStorage.setItem('anitowatch-watchlist', JSON.stringify(this.watchlist));
            }
        } catch (error) {
            console.error('Error saving watchlist:', error);
        }
    }

    /**
     * Update watchlist statistics
     */
    updateStats() {
        const totalAnime = this.watchlist.length;
        const totalEpisodes = this.watchlist.reduce((sum, anime) => sum + (anime.episodes_watched || 0), 0);
        const completedAnime = this.watchlist.filter(a => a.status === 'completed').length;
        
        document.getElementById('totalAnime').textContent = `${totalAnime} anime`;
        document.getElementById('totalEpisodes').textContent = `${totalEpisodes} episodes watched`;
        document.getElementById('completedAnime').textContent = `${completedAnime} completed`;
    }

    /**
     * Format status for display
     */
    formatStatus(status) {
        const statusMap = {
            'planning': 'Planning',
            'watching': 'Watching',
            'completed': 'Completed',
            'dropped': 'Dropped'
        };
        return statusMap[status] || status;
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
        // Event bindings are handled through inline onclick handlers
    }
}