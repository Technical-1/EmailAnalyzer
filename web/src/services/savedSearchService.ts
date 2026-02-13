import type { SavedSearch } from '../types';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'email-analyzer-saved-searches';

/**
 * Service for managing saved searches
 */
class SavedSearchService {
  /**
   * Get all saved searches
   */
  getAll(): SavedSearch[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      
      const searches = JSON.parse(data) as SavedSearch[];
      return searches.map((s) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        lastUsed: s.lastUsed ? new Date(s.lastUsed) : undefined,
      }));
    } catch (error) {
      logger.error('Failed to load saved searches:', error);
      return [];
    }
  }

  /**
   * Save a new search
   */
  save(name: string, query: string): SavedSearch {
    const searches = this.getAll();
    
    const newSearch: SavedSearch = {
      id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      query,
      createdAt: new Date(),
    };

    searches.push(newSearch);
    this.persist(searches);
    
    return newSearch;
  }

  /**
   * Update last used timestamp
   */
  markUsed(id: string): void {
    const searches = this.getAll();
    const search = searches.find((s) => s.id === id);
    
    if (search) {
      search.lastUsed = new Date();
      this.persist(searches);
    }
  }

  /**
   * Delete a saved search
   */
  delete(id: string): void {
    const searches = this.getAll().filter((s) => s.id !== id);
    this.persist(searches);
  }

  /**
   * Update a saved search
   */
  update(id: string, updates: Partial<Pick<SavedSearch, 'name' | 'query'>>): void {
    const searches = this.getAll();
    const index = searches.findIndex((s) => s.id === id);
    
    if (index !== -1) {
      searches[index] = { ...searches[index], ...updates };
      this.persist(searches);
    }
  }

  /**
   * Get recent searches (sorted by last used)
   */
  getRecent(limit = 5): SavedSearch[] {
    return this.getAll()
      .filter((s) => s.lastUsed)
      .sort((a, b) => {
        const aTime = a.lastUsed?.getTime() || 0;
        const bTime = b.lastUsed?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  }

  /**
   * Persist searches to localStorage
   */
  private persist(searches: SavedSearch[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
    } catch (error) {
      logger.error('Failed to save searches:', error);
    }
  }
}

export const savedSearchService = new SavedSearchService();

