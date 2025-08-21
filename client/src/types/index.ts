export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'edit' | 'view';
  createdAt?: string;
  lastLogin?: string;
  isActive?: boolean;
}

export interface MediaFile {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface Post {
  id: number;
  wp_post_id?: number;
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  status: string;
  author_name: string;
  wp_published_date: string;
  wp_modified_date?: string;
  ingested_at: string;
  retention_date: string;
  category_name?: string;
  category_slug?: string;
  featured_media_id?: number;
  featured_media_url?: string;
  attachments?: MediaFile[];
  metadata?: any;
  rank?: number;
}

export interface Category {
  id: number;
  wp_category_id?: number;
  name: string;
  slug: string;
  parent_id?: number;
  parent_name?: string;
  post_count: number;
  actual_post_count?: number;
  has_children?: boolean;
  created_at: string;
  updated_at?: string;
  is_hidden?: boolean;
}

export interface SearchFilters {
  search?: string;
  category?: string;
  author?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  mine?: boolean;
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PostsResponse {
  posts: Post[];
  pagination: PaginationData;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  table_name?: string;
  record_id?: number;
  timestamp: string;
  ip_address?: string;
  username?: string;
  new_values?: any;
}

export interface DashboardStats {
  counts: {
    totalPosts: number;
    totalCategories: number;
    totalUsers: number;
    recentPosts: number;
    expiringPosts: number;
    recentActivity: number;
  };
  topCategories: Array<{
    name: string;
    post_count: number;
    slug: string;
  }>;
  recentActivity: AuditLogEntry[];
  storage: {
    posts_size: string;
    total_size: string;
  };
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export interface PostFormData {
  title: string;
  content: string;
  excerpt: string;
  categoryId: string;
  retentionDays: string;
}

export interface CategoryFormData {
  name: string;
  slug: string;
  parentId: string;
}

export interface UserFormData {
  username: string;
  email: string;
  password: string;
  role: string;
}