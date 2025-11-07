/**
 * READING LIST MANAGER CONTROLLER
 * Handles manga reading list management and progress tracking
 */
class ReadingListManager {
    constructor() {
        this.readingList = [];
        this.filteredList = [];
        this.currentFilter = 'all';
        this.currentSort = 'added';
        
        this.init();
    }

    /**
     * Initialize the reading list manager
     */
    async init() {
        await this.loadReadingList();
        this.updateStats();
        this.renderReadingList();
        this.bindEvents();
    }

    /**
     * Load reading list from storage
     */
    async loadReadingList() {
        try {
            if (window.electronAPI) {
                this.readingList = await window.electronAPI.getReadingList();
            } else {
                // Fallback for browser testing
                const saved = localStorage.getItem('anitowatch-readinglist');
                this.readingList = saved ? JSON.parse(saved) : [];
            }
            this.applyFiltersAndSort();
        } catch (error) {
            console.error('Error loading reading list:', error);
            this.readingList = [];
        }
    }

    /**
     * Filter reading list by status
     */
    filterReadingList() {
        const statusFilter = document.getElementById('statusFilter');
        this.currentFilter = statusFilter.value;
        this.applyFiltersAndSort();
    }

    /**
     * Sort reading list
     */
    sortReadingList() {
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
            this.filteredList = [...this.readingList];
        } else {
            this.filteredList = this.readingList.filter(item => item.status === this.currentFilter);
        }

        // Apply sorting
        switch (this.currentSort) {
            case 'title':
                this.filteredList.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'score':
                this.filteredList.sort((a, b) => (b.score || 0) - (a.score || 0));
                break;
            case 'chapters':
                this.filteredList.sort((a, b) => (b.chapters || 0) - (a.chapters || 0));
                break;
            case 'added':
            default:
                this.filteredList.sort((a, b) => new Date(b.added_date) - new Date(a.added_date));
                break;
        }

        this.renderReadingList();
    }

    /**
     * Render reading list to the page
     */
    renderReadingList() {
        const container = document.getElementById('readingListContent');
        const emptyState = document.getElementById('emptyReadingList');

        if (this.filteredList.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'block';
        emptyState.style.display = 'none';

        container.innerHTML = this.filteredList.map(manga => `
            <div class="readinglist-item">
                <div class="readinglist-item-image">
                    <img src="${manga.image}" alt="${manga.title}" loading="lazy">
                </div>
                <div class="readinglist-item-content">
                    <h3 class="readinglist-item-title">${manga.title}</h3>
                    <div class="readinglist-item-meta">
                        <span class="status-badge status-${manga.status}">${this.formatStatus(manga.status)}</span>
                        <span>${manga.chapters_read || 0}/${manga.chapters || '?'} chapters</span>
                        <span>⭐ ${manga.score || 'N/A'}</span>
                        <span>Your rating: ${manga.rating || 'Not rated'}</span>
                    </div>
                    ${manga.notes ? `<p class="readinglist-item-notes">${manga.notes}</p>` : ''}
                </div>
                <div class="readinglist-item-actions">
                    <button class="btn btn-primary btn-small" onclick="readingListManager.viewManga(${manga.mal_id})">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="readingListManager.editManga(${manga.mal_id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger btn-small" onclick="readingListManager.removeManga(${manga.mal_id})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    /**
     * View manga details
     */
    viewManga(malId) {
        window.location.href = `detail.html?mal_id=${malId}&type=manga`;
    }

    /**
     * Edit manga progress
     */
    editManga(malId) {
        const manga = this.readingList.find(m => m.mal_id === malId);
        if (!manga) return;

        const modal = document.getElementById('editModal');
        const formContent = document.getElementById('editFormContent');

        formContent.innerHTML = `
            <form onsubmit="readingListManager.saveEdit(${malId}); return false;">
                <div class="form-group">
                    <label>Status:</label>
                    <select id="editStatus" class="form-select">
                        <option value="planning" ${manga.status === 'planning' ? 'selected' : ''}>Planning to Read</option>
                        <option value="reading" ${manga.status === 'reading' ? 'selected' : ''}>Currently Reading</option>
                        <option value="completed" ${manga.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="dropped" ${manga.status === 'dropped' ? 'selected' : ''}>Dropped</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Chapters Read:</label>
                    <input type="number" id="editChapters" value="${manga.chapters_read || 0}" 
                           min="0" max="${manga.chapters || 9999}">
                </div>
                
                <div class="form-group">
                    <label>Your Rating (1-10):</label>
                    <input type="number" id="editRating" value="${manga.rating || 0}" 
                           min="0" max="10" step="0.5">
                </div>
                
                <div class="form-group">
                    <label>Notes:</label>
                    <textarea id="editNotes" rows="3">${manga.notes || ''}</textarea>
                </div>
                
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                    <button type="button" class="btn btn-secondary" onclick="readingListManager.closeEditModal()">Cancel</button>
                </div>
            </form>
        `;

        modal.style.display = 'block';
    }

    /**
     * Save edited manga progress
     */
    async saveEdit(malId) {
        const status = document.getElementById('editStatus').value;
        const chapters = parseInt(document.getElementById('editChapters').value) || 0;
        const rating = parseFloat(document.getElementById('editRating').value) || 0;
        const notes = document.getElementById('editNotes').value;

        try {
            // Note: Update functionality would need to be added to main process
            // For now, we'll update locally

            // Update local data
            const mangaIndex = this.readingList.findIndex(m => m.mal_id === malId);
            if (mangaIndex !== -1) {
                this.readingList[mangaIndex] = {
                    ...this.readingList[mangaIndex],
                    status,
                    chapters_read: chapters,
                    rating,
                    notes
                };
                await this.saveReadingList();
            }

            this.closeEditModal();
            this.applyFiltersAndSort();
            this.updateStats();

        } catch (error) {
            console.error('Error updating manga:', error);
            this.showNotification('Failed to update manga. Please try again.');
        }
    }

    /**
     * Close edit modal
     */
    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    /**
     * Remove manga from reading list
     */
    async removeManga(malId) {
        if (!confirm('Are you sure you want to remove this manga from your reading list?')) {
            return;
        }

        try {
            if (window.electronAPI) {
                await window.electronAPI.removeFromReadingList(malId);
            }

            this.readingList = this.readingList.filter(m => m.mal_id !== malId);
            await this.saveReadingList();

            this.applyFiltersAndSort();
            this.updateStats();

        } catch (error) {
            console.error('Error removing manga:', error);
            this.showNotification('Failed to remove manga. Please try again.');
        }
    }

    /**
     * Save reading list to storage
     */
    async saveReadingList() {
        try {
            if (window.electronAPI) {
                // Reading list is automatically saved by main process
            } else {
                localStorage.setItem('anitowatch-readinglist', JSON.stringify(this.readingList));
            }
        } catch (error) {
            console.error('Error saving reading list:', error);
        }
    }

    /**
     * Update reading list statistics
     */
    updateStats() {
        const totalManga = this.readingList.length;
        const totalChapters = this.readingList.reduce((sum, manga) => sum + (manga.chapters_read || 0), 0);
        const completedManga = this.readingList.filter(m => m.status === 'completed').length;
        
        document.getElementById('totalManga').textContent = `${totalManga} manga`;
        document.getElementById('totalChapters').textContent = `${totalChapters} chapters read`;
        document.getElementById('completedManga').textContent = `${completedManga} completed`;
    }

    /**
     * Format status for display
     */
    formatStatus(status) {
        const statusMap = {
            'planning': 'Planning',
            'reading': 'Reading',
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