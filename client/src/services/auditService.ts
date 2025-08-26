import axios from 'axios';
import { API_BASE_URL } from './api';

// Get auth token for audit requests
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const auditService = {
  async trackSearch(query: string, results: number) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'SEARCH',
        table_name: 'search',
        meta: { query, results, timestamp: new Date().toISOString() }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log search audit:', error);
    }
  },
  
  async trackView(type: 'post'|'category'|'user'|'intel_report', id: number, title?: string) {
    try {
      // Map intel_report to the correct table name
      const tableName = type === 'intel_report' ? 'intel_reports' : `${type}s`;
      
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'VIEW',
        table_name: tableName,
        record_id: id,
        meta: { type, id, title, timestamp: new Date().toISOString() }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log view audit:', error);
    }
  },
  
  async trackDelete(type: 'post'|'category', id: number, title?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'DELETE',
        table_name: `${type}s`,
        record_id: id,
        meta: { type, id, title, timestamp: new Date().toISOString() }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log delete audit:', error);
    }
  },
  
  async trackEdit(type: 'post'|'category'|'comment', id: number, changes?: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'EDIT',
        table_name: `${type}s`,
        record_id: id,
        meta: { 
          type, 
          id, 
          changes, 
          timestamp: new Date().toISOString(),
          changesSummary: changes ? Object.keys(changes).join(', ') : 'Unknown changes'
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log edit audit:', error);
    }
  },
  
  async trackCreate(type: 'post'|'category'|'comment', id: string | number, data?: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'CREATE',
        table_name: `${type}s`,
        record_id: id,
        meta: { 
          type, 
          id, 
          data: data ? { title: data.title, ...data } : undefined,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log create audit:', error);
    }
  },
  
  async trackLogin(username: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'LOGIN',
        table_name: 'users',
        meta: { username, timestamp: new Date().toISOString() }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log login audit:', error);
    }
  },
  
  async trackLogout(username: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'LOGOUT',
        table_name: 'users',
        meta: { username, timestamp: new Date().toISOString() }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log logout audit:', error);
    }
  },

  async trackCommentCreate(postId: number, commentId: number, content: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'CREATE',
        table_name: 'comments',
        record_id: commentId,
        meta: { 
          type: 'comment',
          postId,
          commentId,
          contentPreview: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log comment create audit:', error);
    }
  },

  async trackCommentEdit(commentId: number, oldContent: string, newContent: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'EDIT',
        table_name: 'comments',
        record_id: commentId,
        meta: { 
          type: 'comment',
          commentId,
          changes: {
            content: {
              from: oldContent.slice(0, 100) + (oldContent.length > 100 ? '...' : ''),
              to: newContent.slice(0, 100) + (newContent.length > 100 ? '...' : '')
            }
          },
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log comment edit audit:', error);
    }
  },

  async trackPostEdit(postId: number, changes: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'EDIT',
        table_name: 'posts',
        record_id: postId,
        meta: { 
          type: 'post',
          postId,
          changes,
          changesSummary: Object.keys(changes).join(', '),
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log post edit audit:', error);
    }
  }
};

export default auditService;