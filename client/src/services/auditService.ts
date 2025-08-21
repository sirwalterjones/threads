import axios from 'axios';
import { API_BASE_URL } from './api';

const auditService = {
  async trackSearch(query: string, results: number) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'SEARCH',
        meta: { query, results }
      });
    } catch {}
  },
  async trackView(type: 'post'|'category'|'user', id: number, title?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'VIEW',
        meta: { type, id, title }
      });
    } catch {}
  },
  async trackDelete(type: 'post', id: number, title?: string) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'DELETE',
        meta: { type, id, title }
      });
    } catch {}
  },
  async trackEdit(type: 'post'|'category', id: number, changes?: any) {
    try {
      await axios.post(`${API_BASE_URL}/audit/log`, {
        action: 'EDIT',
        meta: { type, id, changes }
      });
    } catch {}
  }
};

export default auditService;

import apiService from './api';

export interface AuditEvent {
  action: string;
  resource_type: string;
  resource_id?: string | number;
  details?: any;
  ip_address?: string;
}

class AuditService {
  private static instance: AuditService;
  private pendingEvents: AuditEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  private constructor() {
    // Flush pending events every 5 seconds
    this.flushTimer = setInterval(() => {
      this.flushEvents();
    }, 5000);
  }

  private async getClientIP(): Promise<string> {
    try {
      // Try to get real IP from various services
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip || 'unknown';
    } catch {
      try {
        // Fallback service
        const response = await fetch('https://httpbin.org/ip');
        const data = await response.json();
        return data.origin?.split(',')[0] || 'unknown';
      } catch {
        return 'unknown';
      }
    }
  }

  async trackLogin(username: string): Promise<void> {
    await this.logEvent({
      action: 'USER_LOGIN',
      resource_type: 'user',
      resource_id: username,
      details: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    });
  }

  async trackLogout(username: string): Promise<void> {
    await this.logEvent({
      action: 'USER_LOGOUT',
      resource_type: 'user',
      resource_id: username,
      details: {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      }
    });
  }

  async trackSearch(query: string, resultsCount: number): Promise<void> {
    await this.logEvent({
      action: 'SEARCH_PERFORMED',
      resource_type: 'search',
      details: {
        query: query,
        resultsCount: resultsCount,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  }

  async trackView(resourceType: string, resourceId: string | number, resourceTitle?: string): Promise<void> {
    await this.logEvent({
      action: 'RESOURCE_VIEWED',
      resource_type: resourceType,
      resource_id: resourceId,
      details: {
        title: resourceTitle,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  }

  async trackEdit(resourceType: string, resourceId: string | number, changes: any): Promise<void> {
    await this.logEvent({
      action: 'RESOURCE_EDITED',
      resource_type: resourceType,
      resource_id: resourceId,
      details: {
        changes: changes,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  }

  async trackCreate(resourceType: string, resourceId: string | number, data: any): Promise<void> {
    await this.logEvent({
      action: 'RESOURCE_CREATED',
      resource_type: resourceType,
      resource_id: resourceId,
      details: {
        data: data,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  }

  async trackDelete(resourceType: string, resourceId: string | number, resourceTitle?: string): Promise<void> {
    await this.logEvent({
      action: 'RESOURCE_DELETED',
      resource_type: resourceType,
      resource_id: resourceId,
      details: {
        title: resourceTitle,
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    });
  }

  async trackPageView(pageName: string): Promise<void> {
    await this.logEvent({
      action: 'PAGE_VIEWED',
      resource_type: 'page',
      resource_id: pageName,
      details: {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        referrer: document.referrer
      }
    });
  }

  private async logEvent(event: AuditEvent): Promise<void> {
    try {
      // Get real IP address
      if (!event.ip_address) {
        event.ip_address = await this.getClientIP();
      }

      // Add to pending events for batch processing
      this.pendingEvents.push(event);

      // If this is a critical event (login, logout, delete), flush immediately
      if (['USER_LOGIN', 'USER_LOGOUT', 'RESOURCE_DELETED'].includes(event.action)) {
        await this.flushEvents();
      }
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    try {
      const eventsToFlush = [...this.pendingEvents];
      this.pendingEvents = [];

      await apiService.logAuditEvents(eventsToFlush);
    } catch (error) {
      console.error('Failed to flush audit events:', error);
      // Re-add events back to pending if they failed to send
      this.pendingEvents.unshift(...this.pendingEvents);
    }
  }

  // Clean up on page unload
  beforeUnload(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Attempt to flush remaining events synchronously
    if (this.pendingEvents.length > 0) {
      navigator.sendBeacon('/api/audit/bulk', JSON.stringify(this.pendingEvents));
    }
  }
}

export const auditService = AuditService.getInstance();

// Set up page unload handler
window.addEventListener('beforeunload', () => {
  auditService.beforeUnload();
});

export default auditService;