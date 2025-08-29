import axios from 'axios';
import { BOLO, BOLOFilters, BOLOFeedResponse, BOLOFormData, BOLOComment } from '../types/bolo';

const API_BASE_URL = '/api';

class BOLOApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  }

  private getMultipartHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': token ? `Bearer ${token}` : ''
      // Don't set Content-Type for multipart/form-data, let browser set it
    };
  }

  /**
   * Create a new BOLO with media files
   */
  async createBOLO(formData: BOLOFormData, files: File[]): Promise<BOLO> {
    const data = new FormData();
    
    // Append BOLO data fields
    Object.keys(formData).forEach(key => {
      const value = (formData as any)[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value.toString());
        }
      }
    });
    
    // Append files
    files.forEach(file => {
      data.append('media', file);
    });
    
    const response = await axios.post(
      `${API_BASE_URL}/bolo/create`,
      data,
      {
        headers: this.getMultipartHeaders()
      }
    );
    
    return response.data.bolo;
  }

  /**
   * Get BOLO feed with filters
   */
  async getBOLOFeed(filters: BOLOFilters = {}): Promise<BOLOFeedResponse> {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      const value = (filters as any)[key];
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await axios.get(
      `${API_BASE_URL}/bolo/feed?${params.toString()}`,
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data;
  }

  /**
   * Get single BOLO by ID
   */
  async getBOLOById(id: number): Promise<BOLO> {
    const response = await axios.get(
      `${API_BASE_URL}/bolo/${id}`,
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data;
  }

  /**
   * Get public BOLO by share token (no auth required)
   */
  async getPublicBOLO(token: string): Promise<BOLO> {
    const response = await axios.get(
      `${API_BASE_URL}/bolo/public/${token}`
    );
    
    return response.data;
  }

  /**
   * Update BOLO
   */
  async updateBOLO(id: number, updates: Partial<BOLOFormData>): Promise<BOLO> {
    const response = await axios.put(
      `${API_BASE_URL}/bolo/${id}`,
      updates,
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data.bolo;
  }

  /**
   * Update BOLO with files
   */
  async updateBOLOWithFiles(id: number, formData: BOLOFormData, files: File[]): Promise<BOLO> {
    const data = new FormData();
    
    // Append BOLO data fields
    Object.keys(formData).forEach(key => {
      const value = (formData as any)[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value.toString());
        }
      }
    });
    
    // Append files
    files.forEach(file => {
      data.append('media', file);
    });
    
    const response = await axios.put(
      `${API_BASE_URL}/bolo/${id}`,
      data,
      {
        headers: this.getMultipartHeaders()
      }
    );
    
    return response.data.bolo;
  }

  /**
   * Update BOLO status
   */
  async updateBOLOStatus(id: number, status: BOLO['status']): Promise<BOLO> {
    const response = await axios.patch(
      `${API_BASE_URL}/bolo/${id}/status`,
      { status },
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data.bolo;
  }

  /**
   * Repost BOLO
   */
  async repostBOLO(id: number, message?: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(
      `${API_BASE_URL}/bolo/${id}/repost`,
      { message },
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data;
  }

  /**
   * Add comment to BOLO
   */
  async addComment(id: number, content: string, isInternal: boolean = false): Promise<BOLOComment> {
    const response = await axios.post(
      `${API_BASE_URL}/bolo/${id}/comment`,
      { content, isInternal },
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data.comment;
  }

  /**
   * Toggle save/unsave BOLO
   */
  async toggleSaveBOLO(id: number): Promise<boolean> {
    const response = await axios.post(
      `${API_BASE_URL}/bolo/${id}/save`,
      {},
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data.saved;
  }

  /**
   * Get saved BOLOs
   */
  async getSavedBOLOs(limit: number = 20, offset: number = 0): Promise<BOLO[]> {
    const response = await axios.get(
      `${API_BASE_URL}/bolo/saved/list?limit=${limit}&offset=${offset}`,
      {
        headers: this.getAuthHeaders()
      }
    );
    
    return response.data.bolos || [];
  }

  /**
   * Upload additional media to existing BOLO
   */
  async uploadMedia(boloId: number, files: File[]): Promise<{ success: boolean; message: string }> {
    const data = new FormData();
    
    files.forEach(file => {
      data.append('media', file);
    });
    
    const response = await axios.post(
      `${API_BASE_URL}/bolo/${boloId}/media`,
      data,
      {
        headers: this.getMultipartHeaders()
      }
    );
    
    return response.data;
  }

  /**
   * Get shareable link for BOLO
   */
  getShareableLink(bolo: BOLO): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/bolo/public/${bolo.public_share_token}`;
  }

  /**
   * Copy shareable link to clipboard
   */
  async copyShareableLink(bolo: BOLO): Promise<boolean> {
    try {
      const link = this.getShareableLink(bolo);
      await navigator.clipboard.writeText(link);
      return true;
    } catch (error) {
      console.error('Failed to copy link:', error);
      return false;
    }
  }
}

export default new BOLOApiService();