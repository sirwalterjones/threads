import axios, { AxiosResponse } from 'axios';
import { 
  User, 
  Post, 
  Category, 
  PostsResponse, 
  SearchFilters, 
  DashboardStats,
  AuditLogEntry,
  PostFormData,
  CategoryFormData,
  UserFormData,
  PostComment
} from '../types';

export const API_BASE_URL = '/api';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    axios.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return this.token;
  }

  // Authentication
  async login(username: string, password: string): Promise<{ user: User; token: string; requires2FA?: boolean }> {
    const response: AxiosResponse<{ user: User; token: string; requires2FA?: boolean }> = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { username, password }
    );
    return response.data;
  }

  async register(userData: UserFormData): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await axios.post(
      `${API_BASE_URL}/auth/register`,
      userData
    );
    return response.data;
  }

  async getProfile(): Promise<User> {
    const response: AxiosResponse<User> = await axios.get(`${API_BASE_URL}/auth/profile`);
    return response.data;
  }

  async updateProfile(data: { email?: string; currentPassword?: string; newPassword?: string; session_duration_hours?: number }): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await axios.put(
      `${API_BASE_URL}/auth/profile`,
      data
    );
    return response.data;
  }

  async getUsers(): Promise<User[]> {
    const response: AxiosResponse<User[]> = await axios.get(`${API_BASE_URL}/auth/users`);
    return response.data;
  }

  async updateUser(id: number, data: { role?: string; isActive?: boolean; username?: string; email?: string; password?: string }): Promise<{ user: User }> {
    const response: AxiosResponse<{ user: User }> = await axios.put(
      `${API_BASE_URL}/auth/users/${id}`,
      data
    );
    return response.data;
  }


  // Unified Search
  async unifiedSearch(query: string, page: number = 1, limit: number = 20): Promise<{
    posts: any[];
    bolos: any[];
    intelReports: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const response = await axios.get(`${API_BASE_URL}/search/unified`, {
      params: { q: query, page, limit }
    });
    return response.data;
  }

  // Posts
  async getPosts(filters: SearchFilters & { page?: number; limit?: number }): Promise<PostsResponse> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response: AxiosResponse<PostsResponse> = await axios.get(
      `${API_BASE_URL}/posts?${params.toString()}`
    );
    return response.data;
  }

  async getPost(id: number): Promise<Post> {
    const response: AxiosResponse<Post> = await axios.get(`${API_BASE_URL}/posts/${id}`);
    return response.data;
  }

  async createPost(postData: PostFormData): Promise<Post> {
    const response: AxiosResponse<Post> = await axios.post(`${API_BASE_URL}/posts`, postData);
    return response.data;
  }

  async uploadFile(formData: FormData): Promise<{ id: number; url: string; path: string; mimeType: string; originalName: string; size: number }> {
    const response = await axios.post(`${API_BASE_URL}/uploads`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async updatePost(id: number, postData: Partial<PostFormData>): Promise<Post> {
    const response: AxiosResponse<Post> = await axios.put(`${API_BASE_URL}/posts/${id}`, postData);
    return response.data;
  }

  async deletePost(id: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/posts/${id}`);
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    const response: AxiosResponse<Category[]> = await axios.get(`${API_BASE_URL}/categories`);
    return response.data;
  }

  async getCategory(id: number): Promise<Category> {
    const response: AxiosResponse<Category> = await axios.get(`${API_BASE_URL}/categories/${id}`);
    return response.data;
  }

  async getCategoryPosts(categoryId: number, filters?: { page?: number; limit?: number; search?: string }): Promise<{ posts: Post[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.search) params.append('search', filters.search);
    
    const response = await axios.get(`${API_BASE_URL}/categories/${categoryId}/posts?${params.toString()}`);
    return response.data;
  }

  async createCategory(categoryData: CategoryFormData): Promise<Category> {
    const response: AxiosResponse<Category> = await axios.post(`${API_BASE_URL}/categories`, categoryData);
    return response.data;
  }

  async updateCategory(id: number, categoryData: Partial<CategoryFormData>): Promise<Category> {
    const response: AxiosResponse<Category> = await axios.put(`${API_BASE_URL}/categories/${id}`, categoryData);
    return response.data;
  }

  async deleteCategory(id: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/categories/${id}`);
  }

  async hideCategoryFromPublic(id: number): Promise<Category> {
    const response: AxiosResponse<Category> = await axios.put(`${API_BASE_URL}/categories/${id}/hide`);
    return response.data;
  }

  async showCategoryToPublic(id: number): Promise<Category> {
    const response: AxiosResponse<Category> = await axios.put(`${API_BASE_URL}/categories/${id}/show`);
    return response.data;
  }

  async updateCategoryCounts(): Promise<{ totalPosts: number }> {
    const response = await axios.post(`${API_BASE_URL}/categories/update-counts`);
    return response.data;
  }

  // Admin functions
  async getDashboardStats(): Promise<DashboardStats> {
    const response: AxiosResponse<DashboardStats> = await axios.get(`${API_BASE_URL}/admin/dashboard`);
    return response.data;
  }

  async ingestWordPressData(): Promise<{ result: any }> {
    const response = await axios.post(`${API_BASE_URL}/admin/ingest-wordpress`);
    return response.data;
  }

  async ingestWordPressDataIncremental(): Promise<{ result: any }> {
    const response = await axios.post(`${API_BASE_URL}/admin/ingest-wordpress-incremental`);
    return response.data;
  }

  async purgeExpiredData(): Promise<{ purgedCount: number }> {
    const response = await axios.post(`${API_BASE_URL}/admin/purge-expired`);
    return response.data;
  }

  async getAuditLog(filters: {
    page?: number;
    limit?: number;
    userId?: number;
    action?: string;
    tableName?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ auditEntries: AuditLogEntry[]; pagination: any }> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(`${API_BASE_URL}/admin/audit-log?${params.toString()}`);
    return response.data;
  }

  async getSystemHealth(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/admin/health`);
    return response.data;
  }

  async getHealthSync(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/health/sync`);
    return response.data;
  }

  async performMaintenance(action: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/admin/maintenance`, { action });
    return response.data;
  }

  // Post Expiration Management
  async getExpiringPosts(filters: {
    page?: number;
    limit?: number;
    daysUntilExpiry?: number;
    category?: string;
    author?: string;
  }): Promise<{ posts: Post[]; pagination: any }> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(`${API_BASE_URL}/admin/expiring-posts?${params.toString()}`);
    return response.data;
  }

  async getExpiringIntelReports(filters: {
    page?: number;
    limit?: number;
    daysUntilExpiry?: number;
  }): Promise<{ reports: any[]; pagination: any }> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(`${API_BASE_URL}/intel-reports/expiring?${params.toString()}`);
    return response.data;
  }

  async updatePostRetention(id: number, retentionDays: number): Promise<Post> {
    const response: AxiosResponse<Post> = await axios.put(
      `${API_BASE_URL}/admin/posts/${id}/retention`,
      { retentionDays }
    );
    return response.data;
  }

  async bulkUpdateRetention(postIds: number[], retentionDays: number): Promise<{ updatedCount: number }> {
    const response = await axios.put(`${API_BASE_URL}/admin/posts/bulk-retention`, {
      postIds,
      retentionDays
    });
    return response.data;
  }

  async setDefaultRetentionForCategory(categoryId: number, retentionDays: number): Promise<{ success: boolean }> {
    const response = await axios.put(`${API_BASE_URL}/admin/categories/${categoryId}/default-retention`, {
      retentionDays
    });
    return response.data;
  }

  async getAuthors(): Promise<{ authors: Array<{ name: string; totalPosts: number; wordpressPosts: number; manualPosts: number }> }> {
    const response = await axios.get(`${API_BASE_URL}/posts/authors`);
    return response.data;
  }

  // Tags
  async getTags(): Promise<string[]> {
    const response = await axios.get(`${API_BASE_URL}/posts/tags`);
    return response.data;
  }

  async getPopularTags(limit = 10): Promise<Array<{ tag: string; count: number }>> {
    const response = await axios.get(`${API_BASE_URL}/posts/tags/popular?limit=${limit}`);
    return response.data;
  }

  async getPostsByTag(tagName: string, page = 1, limit = 12): Promise<PostsResponse> {
    const response = await axios.get(`${API_BASE_URL}/posts/tags/${encodeURIComponent(tagName)}/posts?page=${page}&limit=${limit}`);
    return response.data;
  }

  // Enhanced Audit Logging
  async logAuditEvents(events: any[]): Promise<{ success: boolean }> {
    const response = await axios.post(`${API_BASE_URL}/audit/bulk`, {
      events
    });
    return response.data;
  }

  async logAuditEvent(event: any): Promise<{ success: boolean }> {
    const response = await axios.post(`${API_BASE_URL}/audit/log`, event);
    return response.data;
  }

  // Comment Management
  async getComments(postId: number): Promise<{ comments: PostComment[] }> {
    const response = await axios.get(`${API_BASE_URL}/comments/post/${postId}`);
    return response.data;
  }

  async createComment(postId: number, content: string): Promise<{ comment: PostComment }> {
    const response = await axios.post(`${API_BASE_URL}/comments`, { postId, content });
    return response.data;
  }

  async updateComment(commentId: number, content: string): Promise<{ comment: PostComment }> {
    const response = await axios.put(`${API_BASE_URL}/comments/${commentId}`, { content });
    return response.data;
  }

  // Get users for @ mentions
  async getUsersForMentions(search?: string): Promise<{ users: Array<{ id: number; username: string; role: string }> }> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await axios.get(`${API_BASE_URL}/auth/users/mentions${params}`);
    return response.data;
  }

  // Notifications
  async getNotifications(): Promise<{ notifications: any[] }> {
    const response = await axios.get(`${API_BASE_URL}/notifications`);
    return response.data;
  }

  async markNotificationRead(id: number): Promise<{ success: boolean }> {
    const response = await axios.put(`${API_BASE_URL}/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    const response = await axios.put(`${API_BASE_URL}/notifications/read-all`);
    return response.data;
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    const response = await axios.get(`${API_BASE_URL}/notifications/unread-count`);
    return response.data;
  }

  async clearAllNotifications(): Promise<{ success: boolean }> {
    const response = await axios.delete(`${API_BASE_URL}/notifications`);
    return response.data;
  }

  async deleteComment(commentId: number): Promise<{ message: string }> {
    const response = await axios.delete(`${API_BASE_URL}/comments/${commentId}`);
    return response.data;
  }

  // Follow/Unfollow functionality
  async followPost(postId: number): Promise<{ message: string; following: boolean }> {
    const response = await axios.post(`${API_BASE_URL}/posts/${postId}/follow`);
    return response.data;
  }

  async unfollowPost(postId: number): Promise<{ message: string; following: boolean }> {
    const response = await axios.delete(`${API_BASE_URL}/posts/${postId}/follow`);
    return response.data;
  }

  async getFollowedPosts(page = 1, limit = 20): Promise<PostsResponse> {
    const response = await axios.get(`${API_BASE_URL}/posts/following`, {
      params: { page, limit }
    });
    return response.data;
  }

  async getFollowStatus(postIds: number[]): Promise<{ follows: Record<number, boolean> }> {
    const response = await axios.post(`${API_BASE_URL}/posts/follow-status`, {
      postIds
    });
    return response.data;
  }

  // Hot List functionality
  async getHotLists(): Promise<{ hotLists: Array<{ id: number; search_term: string; is_active: boolean; exact_match: boolean; created_at: string; updated_at: string }> }> {
    const response = await axios.get(`${API_BASE_URL}/hotlist`);
    return response.data;
  }

  async createHotList(searchTerm: string, exactMatch: boolean = false): Promise<{ hotList: { id: number; search_term: string; is_active: boolean; exact_match: boolean; created_at: string; updated_at: string } }> {
    const response = await axios.post(`${API_BASE_URL}/hotlist`, { searchTerm, exactMatch });
    return response.data;
  }

  async updateHotList(id: number, data: { searchTerm?: string; isActive?: boolean; exactMatch?: boolean }): Promise<{ hotList: { id: number; search_term: string; is_active: boolean; exact_match: boolean; created_at: string; updated_at: string } }> {
    const response = await axios.put(`${API_BASE_URL}/hotlist/${id}`, data);
    return response.data;
  }

  async deleteHotList(id: number): Promise<{ message: string }> {
    const response = await axios.delete(`${API_BASE_URL}/hotlist/${id}`);
    return response.data;
  }

  async getHotListAlerts(filters?: { page?: number; limit?: number; unreadOnly?: boolean }): Promise<{
    alerts: Array<{
      id: number;
      hot_list_id: number;
      post_id: number;
      is_read: boolean;
      highlighted_content: string;
      created_at: string;
      search_term: string;
      post_title: string;
      author_name: string;
      wp_published_date: string;
    }>;
    pagination: { page: number; limit: number; total: number };
  }> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.unreadOnly) params.append('unreadOnly', filters.unreadOnly.toString());
    
    const response = await axios.get(`${API_BASE_URL}/hotlist/alerts?${params.toString()}`);
    return response.data;
  }

  async markHotListAlertRead(id: number): Promise<{ message: string }> {
    const response = await axios.put(`${API_BASE_URL}/hotlist/alerts/${id}/read`);
    return response.data;
  }

  async markAllHotListAlertsRead(): Promise<{ message: string }> {
    const response = await axios.put(`${API_BASE_URL}/hotlist/alerts/read-all`);
    return response.data;
  }

  async getHotListUnreadCount(): Promise<{ count: number }> {
    const response = await axios.get(`${API_BASE_URL}/hotlist/alerts/unread-count`);
    return response.data;
  }

  async checkExistingPosts(searchTerm: string, hotListId?: number, exactMatch: boolean = false): Promise<{
    message: string;
    matchingPosts: number;
    alertsCreated: number;
    posts: Array<{
      id: number;
      title: string;
      author_name: string;
      wp_published_date: string;
    }>;
  }> {
    const response = await axios.post(`${API_BASE_URL}/hotlist/check-existing`, {
      searchTerm,
      hotListId,
      exactMatch
    });
    return response.data;
  }

  async clearAllHotListAlerts(): Promise<{ message: string; deletedCount: number }> {
    const response = await axios.delete(`${API_BASE_URL}/hotlist/alerts`);
    return response.data;
  }

  // Two-Factor Authentication
  async setup2FA(): Promise<{ secret: string; qrCode: string; manualEntryKey: string }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/setup`);
    return response.data;
  }

  async verify2FASetup(token: string): Promise<{ success: boolean; message: string; backupCodes: string[] }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/verify-setup`, { token });
    return response.data;
  }

  async verify2FA(token: string, isBackupCode: boolean = false): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/verify`, { token, isBackupCode });
    return response.data;
  }

  async get2FAStatus(): Promise<{ enabled: boolean; required: boolean; backupCodesRemaining: number }> {
    const response = await axios.get(`${API_BASE_URL}/2fa/status`);
    return response.data;
  }

  async enable2FARequirement(): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/enable-requirement`);
    return response.data;
  }

  async disable2FA(currentPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/disable`, { currentPassword });
    return response.data;
  }

  async adminReset2FA(userId: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/admin/reset/${userId}`);
    return response.data;
  }

  async adminToggle2FARequirement(userId: string, required: boolean): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/admin/toggle-requirement/${userId}`, { required });
    return response.data;
  }

  async adminForceEnable2FA(userId: string): Promise<{ success: boolean; message: string; setup: { secret: string; qrCode: string; manualEntryKey: string; backupCodes: string[] } }> {
    const response = await axios.post(`${API_BASE_URL}/2fa/admin/force-enable/${userId}`);
    return response.data;
  }

  // Intelligence Reports Methods
  async getIntelReports(params?: {
    status?: string;
    classification?: string;
    expiration?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    reports: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const response = await axios.get(`${API_BASE_URL}/intel-reports`, {
      params
    });
    return response.data;
  }

  async getIntelReport(id: string): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/intel-reports/${id}`);
    return response.data;
  }

  async createIntelReport(reportData: FormData): Promise<{ message: string; report: any }> {
    const response = await axios.post(`${API_BASE_URL}/intel-reports`, reportData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  async updateIntelReportStatus(
    id: string, 
    status: 'pending' | 'approved' | 'rejected', 
    reviewComments?: string
  ): Promise<{ message: string; report: any }> {
    const response = await axios.patch(
      `${API_BASE_URL}/intel-reports/${id}/status`,
      { status, review_comments: reviewComments }
    );
    return response.data;
  }

  async extendIntelReportExpiration(id: string, days: number = 30): Promise<{ message: string; report: any }> {
    const response = await axios.patch(
      `${API_BASE_URL}/intel-reports/${id}/extend`,
      { days }
    );
    return response.data;
  }

  async deleteIntelReport(id: string): Promise<{ message: string }> {
    const response = await axios.delete(`${API_BASE_URL}/intel-reports/${id}`);
    return response.data;
  }

  async getIntelReportsStats(): Promise<{
    total_reports: number;
    pending_reports: number;
    approved_reports: number;
    rejected_reports: number;
    expired_reports: number;
    expiring_soon_reports: number;
  }> {
    const response = await axios.get(`${API_BASE_URL}/intel-reports/stats/overview`);
    return response.data;
  }

  async deleteUser(userId: number): Promise<{ message: string; username: string }> {
    const response = await axios.delete(`${API_BASE_URL}/auth/users/${userId}`);
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;