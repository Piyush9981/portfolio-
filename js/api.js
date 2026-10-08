/**
 * Portfolio Client API Configuration
 */
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
  ? 'http://localhost:4000/api'
  : '/api'; // In production, routed through reverse proxy or configured URL

const api = {
  async fetchProjects() {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      return result.data || [];
    } catch (err) {
      console.warn('[API Client] Could not reach backend API for projects:', err.message);
      return null; // Signals error state
    }
  },

  async fetchClasswork(params = {}) {
    try {
      const query = new URLSearchParams(params).toString();
      const url = `${API_BASE_URL}/classwork${query ? `?${query}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (err) {
      console.warn('[API Client] Could not reach backend API for classwork:', err.message);
      return null;
    }
  },

  getDownloadUrl(materialId) {
    return `${API_BASE_URL}/classwork/download/${materialId}`;
  }
};
