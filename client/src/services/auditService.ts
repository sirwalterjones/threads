import axios from 'axios';
import { API_BASE_URL } from './api';

const auditService = {
  async trackSearch(query: string, results: number) {
    // Temporarily disabled to fix search functionality
    // try {
    //   await axios.post(`${API_BASE_URL}/audit/log`, {
    //     action: 'SEARCH',
    //     meta: { query, results }
    //   });
    // } catch {}
  },
  
  async trackView(type: 'post'|'category'|'user', id: number, title?: string) {
    // Temporarily disabled to fix search functionality
    // try {
    //   await axios.post(`${API_BASE_URL}/audit/log`, {
    //     action: 'VIEW',
    //     meta: { type, id, title }
    //   });
    // } catch {}
  },
  
  async trackDelete(type: 'post', id: number, title?: string) {
    // Temporarily disabled to fix search functionality
    // try {
    //   await axios.post(`${API_BASE_URL}/audit/log`, {
    //     action: 'DELETE',
    //     meta: { type, id, title }
    //   });
    // } catch {}
  },
  
  async trackEdit(type: 'post'|'category', id: number, changes?: any) {
    // Temporarily disabled to fix search functionality
    // try {
    //   await axios.post(`${API_BASE_URL}/audit/log`, {
    //     action: 'EDIT',
    //     meta: { type, id, changes }
    //   });
    // } catch {}
  },
  
  async trackCreate(type: 'post'|'category', id: string | number, data?: any) {
    // Temporarily disabled to fix search functionality
    // try {
    //   await axios.post(`${API_BASE_URL}/audit/log`, {
    //     action: 'CREATE',
    //     meta: { type, id, data }
    //   });
    // } catch {}
  },
  
  async trackLogin(username: string) {
    // Temporarily disabled to fix search functionality
    // try {
    //   await axios.post(`${API_BASE_URL}/audit/log`, {
    //     action: 'LOGIN',
    //     meta: { username, timestamp: new Date().toISOString() }
    //   });
    // } catch {}
  },
  
  async trackLogout(username: string) {
    // Temporarily disabled to fix search functionality
    // try {
    //   await axios.post(`${API_BASE_URL}/audit/log`, {
    //     action: 'LOGOUT',
    //     meta: { username, timestamp: new Date().toISOString() }
    //   });
    // } catch {}
  }
};

export default auditService;