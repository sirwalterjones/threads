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
  },

  // Intel Report Audit Methods
  async trackIntelReportCreate(reportId: string, data: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'CREATE',
        table_name: 'intel_reports',
        record_id: reportId,
        meta: {
          type: 'intel_report',
          reportId,
          intelNumber: data.intelNumber,
          subject: data.subject,
          classification: data.classification,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log intel report create audit:', error);
    }
  },

  async trackIntelReportEdit(reportId: string, changes: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'EDIT',
        table_name: 'intel_reports',
        record_id: reportId,
        meta: {
          type: 'intel_report',
          reportId,
          changes,
          changesSummary: changes ? Object.keys(changes).join(', ') : 'Unknown changes',
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log intel report edit audit:', error);
    }
  },

  async trackIntelReportView(reportId: string, intelNumber?: string, subject?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'VIEW',
        table_name: 'intel_reports',
        record_id: reportId,
        meta: {
          type: 'intel_report',
          reportId,
          intelNumber,
          subject,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log intel report view audit:', error);
    }
  },

  async trackIntelReportApproval(reportId: string, action: 'approve' | 'reject', comments?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: action.toUpperCase(),
        table_name: 'intel_reports',
        record_id: reportId,
        meta: {
          type: 'intel_report_review',
          reportId,
          reviewAction: action,
          comments,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log intel report approval audit:', error);
    }
  },

  async trackIntelReportDelete(reportId: string, intelNumber?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'DELETE',
        table_name: 'intel_reports',
        record_id: reportId,
        meta: {
          type: 'intel_report',
          reportId,
          intelNumber,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log intel report delete audit:', error);
    }
  },

  // User Management Audit Methods
  async trackUserCreate(userId: number, userData: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'CREATE',
        table_name: 'users',
        record_id: userId,
        meta: {
          type: 'user',
          userId,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log user create audit:', error);
    }
  },

  async trackUserEdit(userId: number, changes: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'EDIT',
        table_name: 'users',
        record_id: userId,
        meta: {
          type: 'user',
          userId,
          changes,
          changesSummary: changes ? Object.keys(changes).join(', ') : 'Unknown changes',
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log user edit audit:', error);
    }
  },

  async trackUserDelete(userId: number, username?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'DELETE',
        table_name: 'users',
        record_id: userId,
        meta: {
          type: 'user',
          userId,
          username,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log user delete audit:', error);
    }
  },

  async trackUserRoleChange(userId: number, oldRole: string, newRole: string, username?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'ROLE_CHANGE',
        table_name: 'users',
        record_id: userId,
        meta: {
          type: 'user_role_change',
          userId,
          username,
          oldRole,
          newRole,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log user role change audit:', error);
    }
  },

  // File Operations Audit Methods
  async trackFileUpload(filename: string, fileSize: number, fileType: string, context?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'UPLOAD',
        table_name: 'files',
        meta: {
          type: 'file_upload',
          filename,
          fileSize,
          fileType,
          context,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log file upload audit:', error);
    }
  },

  async trackFileDelete(filename: string, context?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'DELETE',
        table_name: 'files',
        meta: {
          type: 'file_delete',
          filename,
          context,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log file delete audit:', error);
    }
  },

  // 2FA Audit Methods
  async track2FASetup(success: boolean, method?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: success ? '2FA_SETUP_SUCCESS' : '2FA_SETUP_FAILED',
        table_name: 'users',
        meta: {
          type: '2fa_setup',
          success,
          method,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log 2FA setup audit:', error);
    }
  },

  async track2FADisable(reason?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: '2FA_DISABLED',
        table_name: 'users',
        meta: {
          type: '2fa_disable',
          reason,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log 2FA disable audit:', error);
    }
  },

  async track2FAFailed(reason?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: '2FA_FAILED',
        table_name: 'users',
        meta: {
          type: '2fa_failed_attempt',
          reason,
          timestamp: new Date().toISOString()
        }
      }, { headers: getAuthHeaders() });
    } catch (error) {
      console.warn('Failed to log 2FA failed attempt audit:', error);
    }
  }
};

export default auditService;