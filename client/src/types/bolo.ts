export interface BOLO {
  id: number;
  case_number: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  status: 'pending' | 'active' | 'resolved' | 'expired' | 'cancelled';
  type: 'person' | 'vehicle' | 'property' | 'other';
  
  // Subject Information
  subject_name?: string;
  subject_aliases?: string[];
  subject_description?: string;
  date_of_birth?: string;
  age_range?: string;
  height?: string;
  weight?: string;
  hair_color?: string;
  eye_color?: string;
  distinguishing_features?: string;
  last_seen_wearing?: string;
  armed_dangerous?: boolean;
  armed_dangerous_details?: string;
  
  // Vehicle Information
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  license_plate?: string;
  vehicle_vin?: string;
  vehicle_features?: string;
  direction_of_travel?: string;
  
  // Incident Information
  incident_date?: string;
  incident_location?: string;
  last_known_location?: string;
  jurisdiction?: string;
  
  // Content
  title: string;
  summary: string;
  narrative?: string;
  officer_safety_info?: string;
  approach_instructions?: string;
  
  // Media
  primary_image_url?: string;
  primary_thumbnail_url?: string;
  media?: BOLOMedia[];
  
  // Metadata
  created_by: number;
  creator_username: string;
  agency_name: string;
  officer_name: string;
  officer_badge?: string;
  contact_info?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  
  // Sharing
  public_share_token: string;
  is_public: boolean;
  view_count: number;
  
  // Engagement
  repost_count: number;
  comment_count: number;
  save_count: number;
  is_saved?: boolean;
  is_reposted?: boolean;
  
  // Comments
  comments?: BOLOComment[];
}

export interface BOLOMedia {
  id: number;
  type: 'image' | 'video' | 'document' | 'audio';
  url: string;
  thumbnail_url?: string;
  caption?: string;
  mime_type: string;
  is_primary: boolean;
}

export interface BOLOComment {
  id: number;
  bolo_id: number;
  user_id: number;
  username: string;
  user_role?: string;
  agency_name?: string;
  content: string;
  is_internal: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface BOLORepost {
  id: number;
  original_bolo_id: number;
  reposted_by: number;
  repost_message?: string;
  agency_name: string;
  created_at: string;
}

export interface BOLOActivity {
  id: number;
  bolo_id: number;
  user_id: number;
  action: 'viewed' | 'shared' | 'reposted' | 'commented' | 'updated' | 'saved' | 'unsaved';
  timestamp: string;
  metadata?: any;
}

export interface BOLOFilters {
  type?: 'person' | 'vehicle' | 'property' | 'other';
  priority?: 'immediate' | 'high' | 'medium' | 'low';
  status?: 'pending' | 'active' | 'resolved' | 'expired' | 'cancelled';
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'priority' | 'incident_date' | 'view_count';
  sortOrder?: 'ASC' | 'DESC';
}

export interface BOLOFeedResponse {
  bolos: BOLO[];
  total: number;
  page: number;
  pages: number;
}

export interface BOLOFormData {
  type: 'person' | 'vehicle' | 'property' | 'other';
  priority: 'immediate' | 'high' | 'medium' | 'low';
  status?: 'pending' | 'active' | 'resolved' | 'expired' | 'cancelled';
  
  // Subject fields (for person type)
  subject_name?: string;
  subject_aliases?: string;
  subject_description?: string;
  date_of_birth?: string;
  age_range?: string;
  height?: string;
  weight?: string;
  hair_color?: string;
  eye_color?: string;
  distinguishing_features?: string;
  last_seen_wearing?: string;
  armed_dangerous?: boolean;
  armed_dangerous_details?: string;
  
  // Vehicle fields (for vehicle type)
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_color?: string;
  license_plate?: string;
  vehicle_vin?: string;
  vehicle_features?: string;
  direction_of_travel?: string;
  
  // Common fields
  incident_date?: string;
  incident_location?: string;
  last_known_location?: string;
  jurisdiction?: string;
  title: string;
  summary: string;
  narrative?: string;
  officer_safety_info?: string;
  approach_instructions?: string;
  contact_info?: string;
  is_public?: boolean;
  expires_at?: string;
}