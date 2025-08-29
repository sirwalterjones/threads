import React, { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  Badge,
  Autocomplete,
  Checkbox
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility,
  ViewModule,
  ViewList,
  Person,
  HelpOutline,
  Feed,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileDownload,
  CheckBox,
  CheckBoxOutlineBlank,
  SelectAll,
  Clear as ClearIcon
} from '@mui/icons-material';
import { Post, Category, SearchFilters } from '../types';
import apiService, { API_BASE_URL } from '../services/api';
import auditService from '../services/auditService';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';
import PostDetailModal from '../components/PostDetailModal';
import IntelReportDetailModal from '../components/IntelReportDetailModal';
import MediaGallery from '../components/MediaGallery';
import FollowButton from '../components/FollowButton';
import DeletePostButton from '../components/DeletePostButton';
import IntelReportCard from '../components/IntelReportCard';
import TwitterStylePostCard from '../components/TwitterStylePostCard';
import TagDisplay from '../components/TagDisplay';
import TagFilter from '../components/TagFilter';
import { useAuth } from '../contexts/AuthContext';



const HomeSimple: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Array<{ name: string; totalPosts: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const isAdmin = user?.role === 'admin' || user?.super_admin;
  const [searchTerm, setSearchTerm] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'feed'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [origin, setOrigin] = useState<'all'|'wordpress'|'manual'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [intelModalOpen, setIntelModalOpen] = useState(false);
  const [selectedIntelReportId, setSelectedIntelReportId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'wp_published_date'|'title'|'author_name'|'ingested_at'>('ingested_at');
  const [sortOrder, setSortOrder] = useState<'ASC'|'DESC'>('DESC');
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [exportMode, setExportMode] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set());

  const categoryByName = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.name.toLowerCase(), c));
    return map;
  }, [categories]);

  // Switch to grid view on mobile if table view is selected
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 600 && viewMode === 'table') {
        setViewMode('grid');
      }
    };
    
    // Check on mount
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewMode]);

  const loadData = async (page = 1, filters: SearchFilters = {}) => {
    try {
      setLoading(true);
      const [postsResponse, categoriesResponse, authorsResponse, tagsResponse] = await Promise.all([
        apiService.getPosts({
          page,
          limit: 12,
          search: searchTerm,
          author: authorFilter,
          dateFrom: dateFromFilter,
          dateTo: dateToFilter,
          sortBy,
          sortOrder,
          ...filters,
          ...(origin !== 'all' ? { origin } as any : {}),
          ...(mineOnly ? { mine: true } as any : {}),
          ...(selectedTags.length > 0 ? { tags: selectedTags.join(',') } as any : {})
        }),
        categories.length === 0 ? apiService.getCategories() : Promise.resolve(categories),
        authors.length === 0 ? apiService.getAuthors().catch(() => ({ authors: [] })) : Promise.resolve({ authors }),
        availableTags.length === 0 ? apiService.getTags().catch(() => []) : Promise.resolve(availableTags)
      ]);

      setPosts(postsResponse.posts);
      setTotalPages(postsResponse.pagination.pages);
      if (categories.length === 0) {
        setCategories(categoriesResponse as Category[]);
      }
      if (authors.length === 0) {
        setAuthors(authorsResponse.authors);
      }
      if (availableTags.length === 0 && Array.isArray(tagsResponse)) {
        setAvailableTags(tagsResponse);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };



  const parseAdvancedQuery = () => {
    // Supports: author:, category:, before:YYYY-MM-DD, after:YYYY-MM-DD, origin:(manual|wordpress), mine:true, quoted phrases
    // Extract tokens from searchTerm into state/filters
    const text = searchTerm || '';
    const tokens = text.match(/\"[^\"]+\"|\S+/g) || [];
    let remaining: string[] = [];
    let nextAuthor = authorFilter;
    let nextCategory = selectedCategory;
    let nextDateFrom = dateFromFilter;
    let nextDateTo = dateToFilter;
    let nextOrigin = origin;
    let nextMine = mineOnly;

    for (const token of tokens) {
      const raw = token;
      const unquoted = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
      const lower = unquoted.toLowerCase();

      if (lower.startsWith('author:')) {
        nextAuthor = unquoted.slice(7).trim();
        continue;
      }
      if (lower.startsWith('category:')) {
        const catName = unquoted.slice(9).trim().toLowerCase();
        const cat = categoryByName.get(catName);
        if (cat) nextCategory = String(cat.id);
        continue;
      }
      if (lower.startsWith('before:')) {
        nextDateTo = unquoted.slice(7).trim();
        continue;
      }
      if (lower.startsWith('after:')) {
        nextDateFrom = unquoted.slice(6).trim();
        continue;
      }
      if (lower.startsWith('origin:')) {
        const val = unquoted.slice(7).trim();
        if (val === 'manual' || val === 'wordpress') nextOrigin = val as any;
        continue;
      }
      if (lower === 'mine:true') {
        nextMine = true;
        continue;
      }
      remaining.push(unquoted);
    }

    // Apply parsed values to state
    setAuthorFilter(nextAuthor);
    setSelectedCategory(nextCategory);
    setDateFromFilter(nextDateFrom);
    setDateToFilter(nextDateTo);
    setOrigin(nextOrigin);
    setMineOnly(nextMine);

    const remainingQuery = remaining.join(' ').trim();
    return { remainingQuery, nextAuthor, nextCategory, nextDateFrom, nextDateTo, nextOrigin, nextMine };
  };

  const highlightTerms = useMemo(() => {
    // Parse search terms preserving quoted phrases
    const tokens = (searchTerm.match(/\"[^\"]+\"|\S+/g) || [])
      .map(token => {
        // Remove quotes but preserve the phrase structure for highlighting
        if (token.startsWith('"') && token.endsWith('"')) {
          return token.slice(1, -1); // Keep as phrase (with spaces)
        }
        return token;
      })
      .filter(t => t && !t.includes(':'));
    return tokens;
  }, [searchTerm]);

  const highlightText = (input: string) => {
    if (!highlightTerms.length || !input) return input;
    
    // Parse search terms to handle phrases and individual words correctly
    const parseSearchTerms = (terms: string[]): { phrases: string[], words: string[] } => {
      const phrases: string[] = [];
      const words: string[] = [];
      
      terms.forEach(term => {
        const trimmed = term.trim();
        if (trimmed.includes(' ')) {
          // Multi-word terms are treated as phrases
          phrases.push(trimmed);
        } else {
          // Single words
          words.push(trimmed);
        }
      });
      
      return { phrases, words };
    };
    
    const { phrases, words } = parseSearchTerms(highlightTerms);
    let result = input;
    
    // First, highlight exact phrases (more specific)
    phrases.forEach(phrase => {
      const phraseRegex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(phraseRegex, '<<<PHRASE_MATCH:$1>>>');
    });
    
    // Then highlight individual words with word boundaries (prevents partial matches)
    words.forEach(word => {
      const wordRegex = new RegExp(`\\b(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
      result = result.replace(wordRegex, '<<<WORD_MATCH:$1>>>');
    });
    
    // Convert placeholder markers to React components
    const parts = result.split(/(<<<(?:PHRASE|WORD)_MATCH:[^>]+>>>)/);
    
    return parts.map((part, index) => {
      if (part.startsWith('<<<') && part.endsWith('>>>')) {
        // Extract the matched text from the placeholder
        const matchText = part.replace(/<<<(?:PHRASE|WORD)_MATCH:([^>]+)>>>/, '$1');
        return (
          <mark 
            key={index} 
            style={{ 
              backgroundColor: '#fbbf24', 
              color: '#000', 
              padding: '1px 3px', 
              borderRadius: '3px',
              fontWeight: 'bold'
            }}
          >
            {matchText}
          </mark>
        );
      }
      return part;
    });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qOrigin = params.get('origin');
    const qMine = params.get('mine');
    const isMyThreadsPath = window.location.pathname === '/my-threads';

    let nextOrigin: 'all'|'manual'|'wordpress' = origin;
    let nextMine = mineOnly;

    if (qOrigin === 'manual' || qOrigin === 'wordpress') {
      nextOrigin = qOrigin as any;
      setOrigin(qOrigin as any);
    }
    if (qMine === 'true') {
      nextMine = true;
      setMineOnly(true);
    }

    if (isMyThreadsPath) {
      nextOrigin = 'manual'; // Show only manually created posts, not WordPress posts
      nextMine = true;
      setOrigin('manual');
      setMineOnly(true);
    }

    loadData(currentPage, {
      ...(nextOrigin !== 'all' ? { origin: nextOrigin } as any : {}),
      ...(nextMine ? { mine: true } as any : {})
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Separate effect to handle path changes
  useEffect(() => {
    const isMyThreadsPath = location.pathname === '/my-threads';
    
    if (isMyThreadsPath) {
      setOrigin('manual'); // Show only manually created posts, not WordPress posts
      setMineOnly(true); // But only show user's own posts
      setCurrentPage(1);
    } else {
      // Reset filters when leaving My Threads page
      if (mineOnly) {
        setOrigin('all');
        setMineOnly(false);
        setCurrentPage(1);
      }
    }
  }, [location.pathname, mineOnly]); // Listen for path changes



  const handleSearch = async () => {
    const parsed = parseAdvancedQuery();
    const q = parsed.remainingQuery;
    setSearchTerm(q);
    setCurrentPage(1);
    
    // Track search activity
    if (q && q.trim()) {
      await auditService.trackSearch(q, 0); // Will update with results count later
    }
    
    loadData(1, {
      search: q,
      ...(origin !== 'all' ? { origin } as any : {}),
      ...(mineOnly ? { mine: true } as any : {}),
      ...(selectedTags.length > 0 ? { tags: selectedTags.join(',') } as any : {})
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePostClick = async (postId: number) => {
    setSelectedPostId(postId);
    setModalOpen(true);
    
    // Find the post title for audit logging
    const post = posts.find(p => p.id === postId);
    await auditService.trackView('post', postId, post?.title);
  };

  const handleIntelReportClick = async (reportId: number) => {
    setSelectedIntelReportId(reportId);
    setIntelModalOpen(true);
    
    // Find the report for audit logging
    const report = posts.find(p => p.id === reportId && p.result_type === 'intel_report');
    await auditService.trackView('intel_report', reportId, report?.title);
  };

  const handleDelete = async (postId: number) => {
    if (!window.confirm('Delete this post? This action cannot be undone.')) return;
    try {
      // Find the post title for audit logging
      const post = posts.find(p => p.id === postId);
      
      await apiService.deletePost(postId);
      
      // Track deletion
      await auditService.trackDelete('post', postId, post?.title);
      
      // Reload current page
      loadData(currentPage);
    } catch (e:any) {
      setError(e?.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPostId(null);
  };

  const handleIntelModalClose = () => {
    setIntelModalOpen(false);
    setSelectedIntelReportId(null);
  };

  // When filters change and results are shown, auto-refresh results (debounced)
  useEffect(() => {
    if (loading) return;
    if (posts.length === 0) return; // only auto-update after initial results exist
    const debounce = setTimeout(() => {
      // Find the category name by ID for the backend
      const categoryName = selectedCategory ? categories.find(c => c.id.toString() === selectedCategory)?.name : null;
      
      loadData(1, {
        ...(categoryName ? { category: categoryName } as any : {}),
        ...(authorFilter ? { author: authorFilter } as any : {}),
        ...(dateFromFilter ? { dateFrom: dateFromFilter } as any : {}),
        ...(dateToFilter ? { dateTo: dateToFilter } as any : {}),
        ...(origin !== 'all' ? { origin } as any : {}),
        ...(mineOnly ? { mine: true } as any : {}),
        ...(selectedTags.length > 0 ? { tags: selectedTags.join(',') } as any : {}),
        sortBy,
        sortOrder
      });
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, authorFilter, dateFromFilter, dateToFilter, origin, mineOnly, sortBy, sortOrder, categories, selectedTags]);

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    // Don't call loadData here - let the useEffect handle it
  };

  // Admin Intel Report Handlers
  const handleIntelEdit = (reportId: number) => {
    // Navigate to intel report edit page
    window.location.href = `/intel-reports?edit=${reportId}`;
  };

  const handleIntelDelete = async (reportId: number) => {
    if (!isAdmin) return;
    
    if (window.confirm('Are you sure you want to delete this intel report? This action cannot be undone.')) {
      try {
        await apiService.deleteIntelReport(reportId.toString());
        setIntelModalOpen(false);
        // Refresh the current search/list
        loadData(currentPage);
      } catch (error) {
        console.error('Failed to delete intel report:', error);
        alert('Failed to delete intel report. Please try again.');
      }
    }
  };

  const handleIntelStatusChange = async (reportId: number) => {
    if (!isAdmin) return;
    
    const status = prompt('Enter new status (pending, approved, rejected):');
    if (!status || !['pending', 'approved', 'rejected'].includes(status.toLowerCase())) {
      if (status) alert('Invalid status. Please enter: pending, approved, or rejected');
      return;
    }

    const comments = prompt('Review comments (optional):') || '';
    
    try {
      const validStatus = status.toLowerCase() as 'pending' | 'approved' | 'rejected';
      await apiService.updateIntelReportStatus(reportId.toString(), validStatus, comments);
      setIntelModalOpen(false);
      // Refresh the current search/list
      loadData(currentPage);
    } catch (error) {
      console.error('Failed to update intel report status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const stripHtmlTags = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  // Extract image URLs from HTML content (used for WP-ingested posts)
  const extractImageUrls = (html?: string): string[] => {
    if (!html) return [];
    try {
      const div = document.createElement('div');
      div.innerHTML = html;
      const imgs = Array.from(div.querySelectorAll('img'));
      return imgs
        .map(img => {
          let src = (img.getAttribute('src') || '').trim();
          if (!src) src = (img.getAttribute('data-src') || '').trim();
          if (!src) {
            const srcset = (img.getAttribute('srcset') || '').trim();
            if (srcset) {
              // Take the first candidate URL
              src = srcset.split(',')[0].trim().split(' ')[0];
            }
          }
          return src;
        })
        .filter(src => !!src);
    } catch {
      return [];
    }
  };

  const resolveContentImageUrl = (rawUrl: string): string => {
    if (!rawUrl) return rawUrl;

    // If it's already a local file URL (served by Threads Intel), return as-is
    if (rawUrl.startsWith('/api/files/') || rawUrl.startsWith(`${API_BASE_URL}/files/`)) {
      console.log('resolveContentImageUrl: Using local file URL:', rawUrl);
      return rawUrl;
    }

    const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
    let absolute = rawUrl;
    if (rawUrl.startsWith('/')) absolute = `${remoteBase}${rawUrl}`;
    else if (!rawUrl.startsWith('http')) absolute = `${remoteBase}/${rawUrl}`;

    // For now, skip the proxy and use direct URLs to ensure images display
    console.log('resolveContentImageUrl: Using direct URL (proxy disabled):', absolute);
    return absolute;
  };

  const countMatches = (text: string, terms: string[]) => {
    if (!text || !terms.length) return 0;
    const plain = stripHtmlTags(text);
    let total = 0;
    for (const term of terms) {
      if (!term) continue;
      const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = plain.match(re);
      if (matches) total += matches.length;
    }
    return total;
  };

  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        px: { xs: 1, sm: 2, md: 3 } // Reduce padding on mobile
      }}
    >
      <Box sx={{ 
        py: { xs: 1, sm: 2, md: 3 }, 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column' 
      }}>
        {/* Dashboard-style Search Interface */}
        {posts.length === 0 && !loading && (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            minHeight: '80vh',
            flexDirection: 'column',
            width: '100%',
            flex: 1
          }}>
            <Box sx={{ width: '100%', maxWidth: '900px', textAlign: 'center', px: 2 }}>
              <Typography variant="h2" sx={{ 
                color: '#1F2937', 
                textAlign: 'center', 
                mb: 2,
                fontWeight: 300,
                fontSize: { xs: '2.5rem', md: '3.5rem' }
              }}>
                {location.pathname === '/my-threads' ? 'My Threads' : 'Search Vector'}
              </Typography>
              
              {location.pathname === '/my-threads' && (
                <Typography variant="h6" sx={{ 
                  color: '#71767B', 
                  textAlign: 'center', 
                  mb: 4,
                  fontWeight: 400,
                  fontSize: { xs: '1rem', md: '1.25rem' }
                }}>
                  Create and manage your own intelligence threads
                </Typography>
              )}
              
              <Box sx={{ 
                position: 'relative',
                width: '100%',
                maxWidth: '800px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder={location.pathname === '/my-threads' ? "Search your threads..." : "Search your threads..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '50px',
                      backgroundColor: '#16181C',
                      fontSize: '18px',
                      height: '50px',
                      border: '1px solid #2F3336',
                      '&:hover': {
                        borderColor: '#1D9BF0'
                      },
                      '&.Mui-focused': {
                        borderColor: '#1D9BF0',
                        backgroundColor: '#000000'
                      },
                      '& fieldset': {
                        border: 'none'
                      },
                      '& input': {
                        padding: '12px 24px 12px 50px',
                        fontSize: '18px',
                        color: '#E7E9EA',
                        '&::placeholder': {
                          color: '#71767B',
                          opacity: 1
                        }
                      }
                    }
                  }}
                  InputProps={{
                    startAdornment: (
                      <Box sx={{ 
                        position: 'absolute', 
                        left: 20, 
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                        <SearchIcon sx={{ color: '#71767B', fontSize: 20 }} />
                      </Box>
                    ),
                    endAdornment: (
                      <Box sx={{ position: 'absolute', right: 20, zIndex: 1 }}>
                        <Tooltip title="Search syntax">
                          <IconButton aria-label="search help" onClick={()=> setHelpOpen(true)} size="small">
                            <HelpOutline sx={{ color: '#71767B' }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )
                  }}
                />
                
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  gap: 2, 
                  mt: 2 
                }}>
                  <Button 
                    variant="outlined" 
                    onClick={handleSearch}
                    disabled={loading || !searchTerm.trim()}
                    size="small"
                    sx={{ 
                      borderRadius: '8px',
                      borderColor: '#2F3336',
                      color: '#E7E9EA',
                      fontSize: '14px',
                      fontWeight: 500,
                      px: 3,
                      py: 1,
                      textTransform: 'none',
                      '&:hover': {
                        borderColor: '#1D9BF0',
                        backgroundColor: 'rgba(29, 155, 240, 0.1)',
                        color: '#1D9BF0'
                      },
                      '&:disabled': {
                        borderColor: '#2F3336',
                        color: '#71767B'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {loading ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
                    Search
                  </Button>
                  
                  {location.pathname === '/my-threads' && (
                    <Button 
                      variant="contained" 
                      onClick={() => {
                        const evt = new CustomEvent('open-new-post-modal', { detail: {} });
                        window.dispatchEvent(evt);
                      }}
                      size="small"
                      sx={{ 
                        borderRadius: '8px',
                        backgroundColor: '#1D9BF0',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 500,
                        px: 3,
                        py: 1,
                        textTransform: 'none',
                        '&:hover': {
                          backgroundColor: '#1a8cd8'
                        },
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Create New Thread
                    </Button>
                  )}
                  
                  <Button 
                    variant="outlined" 
                    onClick={() => {
                      setSearchTerm('');
                      setPosts([]);
                      setCurrentPage(1);
                    }}
                    disabled={!searchTerm && posts.length === 0}
                    size="small"
                    sx={{ 
                      borderRadius: '8px',
                      borderColor: '#2F3336',
                      color: '#71767B',
                      fontSize: '14px',
                      fontWeight: 500,
                      px: 3,
                      py: 1,
                      textTransform: 'none',
                      '&:hover': {
                        borderColor: '#71767B',
                        backgroundColor: 'rgba(113, 118, 123, 0.1)',
                        color: '#E7E9EA'
                      },
                      '&:disabled': {
                        borderColor: '#2F3336',
                        color: '#71767B'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {/* Compact Search Bar for Results Page */}
        {(posts.length > 0 || loading) && (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' }, // Stack vertically on mobile
            justifyContent: 'center', 
            alignItems: 'center', 
            mb: { xs: 3, sm: 4 },
            gap: { xs: 2, sm: 2 },
            px: { xs: 1, sm: 0 }, // Reduce padding on mobile
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden' // Prevent overflow
          }}>
            <Box sx={{ 
              position: 'relative',
              width: '100%',
              maxWidth: { xs: '100%', sm: '400px' } // Reduce max width
            }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Search your threads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: { xs: '25px', sm: '50px' },
                    backgroundColor: '#16181C',
                    fontSize: { xs: '16px', sm: '18px' },
                    height: { xs: '45px', sm: '50px' },
                    border: '1px solid #2F3336',
                    '&:hover': {
                      borderColor: '#1D9BF0'
                    },
                    '&.Mui-focused': {
                      borderColor: '#1D9BF0',
                      backgroundColor: '#000000'
                    },
                    '& fieldset': {
                      border: 'none'
                    },
                    '& input': {
                      padding: { xs: '10px 20px 10px 45px', sm: '12px 24px 12px 50px' },
                      fontSize: { xs: '16px', sm: '18px' },
                      color: '#E7E9EA',
                      '&::placeholder': {
                        color: '#71767B',
                        opacity: 1
                      }
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ 
                      position: 'absolute', 
                      left: { xs: 15, sm: 20 }, 
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <SearchIcon sx={{ color: '#71767B', fontSize: { xs: 18, sm: 20 } }} />
                    </Box>
                  ),
                  endAdornment: (
                    <Box sx={{ position: 'absolute', right: { xs: 15, sm: 20 }, zIndex: 1 }}>
                      <Tooltip title="Search syntax">
                        <IconButton aria-label="search help" onClick={()=> setHelpOpen(true)} size="small">
                          <HelpOutline sx={{ color: '#71767B' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                }}
              />
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              gap: 1, 
              width: { xs: '100%', sm: 'auto' },
              flexDirection: { xs: 'row', sm: 'row' }
            }}>
              <Button 
                variant="outlined" 
                onClick={handleSearch}
                disabled={loading || !searchTerm.trim()}
                size={window.innerWidth < 600 ? "medium" : "small"}
                sx={{ 
                  flex: { xs: 1, sm: 'none' }, // Take equal width on mobile
                  borderRadius: '8px',
                  borderColor: '#2F3336',
                  color: '#E7E9EA',
                  fontSize: { xs: '14px', sm: '14px' },
                  fontWeight: 500,
                  px: { xs: 2, sm: 3 },
                  py: { xs: 1.2, sm: 1 },
                  textTransform: 'none',
                  minWidth: { xs: 'auto', sm: '80px' },
                  '&:hover': {
                    borderColor: '#1D9BF0',
                    backgroundColor: 'rgba(29, 155, 240, 0.1)',
                    color: '#1D9BF0'
                  },
                  '&:disabled': {
                    borderColor: '#2F3336',
                    color: '#71767B'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {loading ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
                Search
              </Button>
              
              <Button 
                variant="outlined" 
                onClick={() => {
                  setSearchTerm('');
                  setPosts([]);
                  setCurrentPage(1);
                }}
                disabled={!searchTerm && posts.length === 0}
                size="small"
                sx={{ 
                  flex: { xs: 1, sm: 'none' }, // Take equal width on mobile
                  borderRadius: '8px',
                  borderColor: '#2F3336',
                  color: '#71767B',
                  fontSize: { xs: '14px', sm: '14px' },
                  fontWeight: 500,
                  px: { xs: 2, sm: 3 },
                  py: { xs: 1.2, sm: 1 },
                  textTransform: 'none',
                  minWidth: { xs: 'auto', sm: '80px' },
                  '&:hover': {
                    borderColor: '#71767B',
                    backgroundColor: 'rgba(113, 118, 123, 0.1)',
                    color: '#E7E9EA'
                  },
                  '&:disabled': {
                    borderColor: '#2F3336',
                    color: '#71767B'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                Clear
              </Button>
            </Box>
          </Box>
        )}

        {/* Advanced Filters - Separate Section */}
        <Card sx={{ 
          mb: { xs: 2, sm: 3, md: 4 },
          mx: { xs: 0, sm: 1, md: 0 }, // Add margin for mobile
          backgroundColor: '#16181C',
          border: '1px solid #2F3336',
          borderRadius: 2
        }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}> {/* Reduce padding on mobile */}
            <Typography variant="h6" sx={{ 
              mb: { xs: 1.5, sm: 2 }, 
              color: '#E7E9EA', 
              fontWeight: 600,
              fontSize: { xs: '1.1rem', sm: '1.25rem' } // Smaller font on mobile
            }}>
              Advanced Filters
            </Typography>

            {/* Uniform filter grid */}
            <Box sx={{ 
              display: 'grid', 
              gap: { xs: 1.5, sm: 2 }, 
              gridTemplateColumns: { 
                xs: '1fr', // Single column on mobile
                sm: 'repeat(auto-fit, minmax(160px, 1fr))', 
                md: 'repeat(auto-fit, minmax(180px, 1fr))'
              }
            }}>
              <Autocomplete
                fullWidth
                options={[{ id: '', name: 'All Categories', post_count: 0, parent_name: null }, ...categories]}
                getOptionLabel={(option) => 
                  option.id === '' ? 'All Categories' : 
                  `${option.parent_name ? `${option.parent_name} › ` : ''}${option.name} (${option.post_count})`
                }
                value={categories.find(c => c.id.toString() === selectedCategory) || { id: '', name: 'All Categories', post_count: 0, parent_name: null }}
                onChange={(_, newValue) => {
                  handleCategoryFilter(newValue?.id?.toString() || '');
                }}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Category"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        color: '#E7E9EA',
                        backgroundColor: '#16181C',
                        '& fieldset': {
                          borderColor: '#2F3336',
                        },
                        '&:hover fieldset': {
                          borderColor: '#71767B',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#1D9BF0',
                        },
                        '& .MuiInputBase-input': {
                          color: '#E7E9EA !important',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: '#E7E9EA',
                        '&.Mui-focused': {
                          color: '#1D9BF0',
                        },
                      },
                    }}
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                PaperComponent={({ children, ...props }) => (
                  <div
                    {...props}
                    style={{
                      backgroundColor: '#16181C',
                      border: '1px solid #2F3336',
                      borderRadius: '8px',
                      marginTop: '4px',
                      ...props.style,
                    }}
                  >
                    {children}
                  </div>
                )}
                slotProps={{
                  paper: {
                    sx: {
                      backgroundColor: '#16181C !important',
                      border: '1px solid #2F3336 !important',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4) !important',
                      '& .MuiAutocomplete-option': {
                        color: '#E7E9EA !important',
                        backgroundColor: '#16181C !important',
                        fontSize: '0.875rem !important',
                        padding: '8px 16px !important',
                        '&:hover': {
                          backgroundColor: '#2F3336 !important',
                          color: '#FFFFFF !important',
                        },
                        '&.Mui-focused': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                          color: '#FFFFFF !important',
                        },
                        '&[aria-selected="true"]': {
                          backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                          color: '#FFFFFF !important',
                        },
                        '& *': {
                          color: '#E7E9EA !important',
                        },
                      },
                      '& .MuiAutocomplete-listbox': {
                        backgroundColor: '#16181C !important',
                        color: '#E7E9EA !important',
                        padding: '4px 0 !important',
                        '& li': {
                          color: '#E7E9EA !important',
                        },
                      },
                    },
                  },
                }}
                sx={{
                  '& .MuiAutocomplete-option': {
                    color: '#E7E9EA !important',
                    backgroundColor: '#16181C !important',
                    fontSize: '0.875rem !important',
                    padding: '8px 16px !important',
                    '&:hover': {
                      backgroundColor: '#2F3336 !important',
                      color: '#FFFFFF !important',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                      color: '#FFFFFF !important',
                    },
                    '&[aria-selected="true"]': {
                      backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                      color: '#FFFFFF !important',
                    },
                    '& *': {
                      color: '#E7E9EA !important',
                    },
                  },
                  '& .MuiAutocomplete-listbox': {
                    backgroundColor: '#16181C !important',
                    color: '#E7E9EA !important',
                    padding: '4px 0 !important',
                    '& li': {
                      color: '#E7E9EA !important',
                    },
                  },
                  '& .MuiAutocomplete-paper': {
                    backgroundColor: '#16181C !important',
                    border: '1px solid #2F3336 !important',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4) !important',
                  },
                  '& .MuiAutocomplete-popper': {
                    '& .MuiPaper-root': {
                      backgroundColor: '#16181C !important',
                      color: '#E7E9EA !important',
                    },
                  },
                }}
              />

              <FormControl fullWidth sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#E7E9EA',
                  backgroundColor: '#16181C',
                  '& fieldset': {
                    borderColor: '#2F3336',
                  },
                  '&:hover fieldset': {
                    borderColor: '#71767B',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1D9BF0',
                  },
                  '& .MuiSelect-select': {
                    color: '#E7E9EA !important',
                    backgroundColor: 'transparent',
                  },
                  '& .MuiInputBase-input': {
                    color: '#E7E9EA !important',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#E7E9EA',
                  '&.Mui-focused': {
                    color: '#1D9BF0',
                  },
                },
              }}>
                <InputLabel>Origin</InputLabel>
                <Select value={origin} label="Origin" onChange={(e)=> {
                  const val = e.target.value as 'all'|'wordpress'|'manual';
                  setOrigin(val);
                  setCurrentPage(1);
                  loadData(1, { ...(val !== 'all' ? { origin: val } as any : {}), ...(mineOnly ? { mine: true } as any : {}) });
                }}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16181C !important',
                      border: '1px solid #2F3336 !important',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4) !important',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA !important',
                        backgroundColor: '#16181C !important',
                        fontSize: '0.875rem !important',
                        padding: '8px 16px !important',
                        '&:hover': {
                          backgroundColor: '#2F3336 !important',
                          color: '#FFFFFF !important',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                          color: '#FFFFFF !important',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                          },
                        },
                      },
                    },
                  },
                }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="wordpress">From WordPress</MenuItem>
                  <MenuItem value="manual">My Threads</MenuItem>
                </Select>
              </FormControl>

{authors.length > 0 ? (
                <FormControl fullWidth sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#E7E9EA',
                    '& fieldset': {
                      borderColor: '#2F3336',
                    },
                    '&:hover fieldset': {
                      borderColor: '#71767B',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1D9BF0',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#71767B',
                    '&.Mui-focused': {
                      color: '#1D9BF0',
                    },
                  },
                }}>
                  <InputLabel>Author</InputLabel>
                  <Select
                    value={authorFilter}
                    label="Author"
                    onChange={(e) => {
                      setAuthorFilter(e.target.value);
                      setCurrentPage(1);
                      loadData(1, { author: e.target.value, ...(origin !== 'all' ? { origin } as any : {}), ...(mineOnly ? { mine: true } as any : {}) });
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          backgroundColor: '#16181C !important',
                          border: '1px solid #2F3336 !important',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4) !important',
                          '& .MuiMenuItem-root': {
                            color: '#E7E9EA !important',
                            backgroundColor: '#16181C !important',
                            fontSize: '0.875rem !important',
                            padding: '8px 16px !important',
                            '&:hover': {
                              backgroundColor: '#2F3336 !important',
                              color: '#FFFFFF !important',
                            },
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                              color: '#FFFFFF !important',
                              '&:hover': {
                                backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                              },
                            },
                          },
                        },
                      },
                    }}
                  >
                    <MenuItem value="">All Authors</MenuItem>
                    {authors.map((author) => (
                      <MenuItem key={author.name} value={author.name}>
                        {author.name} ({author.totalPosts} posts)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  fullWidth
                  variant="outlined"
                  label="Author (type to filter)"
                  placeholder="e.g., Admin, Stephanie Hardison"
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  helperText="Authors API unavailable - type author name manually"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      color: '#E7E9EA',
                      '& fieldset': {
                        borderColor: '#2F3336',
                      },
                      '&:hover fieldset': {
                        borderColor: '#71767B',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#1D9BF0',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#71767B',
                      '&.Mui-focused': {
                        color: '#1D9BF0',
                      },
                    },
                    '& .MuiFormHelperText-root': {
                      color: '#E7E9EA',
                    },
                  }}
                />
              )}

              <TextField
                fullWidth
                variant="outlined"
                label="Date From"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#E7E9EA',
                    backgroundColor: '#16181C',
                    '& fieldset': {
                      borderColor: '#2F3336',
                    },
                    '&:hover fieldset': {
                      borderColor: '#71767B',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1D9BF0',
                    },
                    '& .MuiInputBase-input': {
                      color: '#E7E9EA !important',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#E7E9EA',
                    '&.Mui-focused': {
                      color: '#1D9BF0',
                    },
                  },
                }}
              />

              <TextField
                fullWidth
                variant="outlined"
                label="Date To"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#E7E9EA',
                    backgroundColor: '#16181C',
                    '& fieldset': {
                      borderColor: '#2F3336',
                    },
                    '&:hover fieldset': {
                      borderColor: '#71767B',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#1D9BF0',
                    },
                    '& .MuiInputBase-input': {
                      color: '#E7E9EA !important',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#E7E9EA',
                    '&.Mui-focused': {
                      color: '#1D9BF0',
                    },
                  },
                }}
              />

              <FormControl fullWidth sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#E7E9EA',
                  backgroundColor: '#16181C',
                  '& fieldset': {
                    borderColor: '#2F3336',
                  },
                  '&:hover fieldset': {
                    borderColor: '#71767B',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1D9BF0',
                  },
                  '& .MuiSelect-select': {
                    color: '#E7E9EA !important',
                    backgroundColor: 'transparent',
                  },
                  '& .MuiInputBase-input': {
                    color: '#E7E9EA !important',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#E7E9EA',
                  '&.Mui-focused': {
                    color: '#1D9BF0',
                  },
                },
              }}>
                <InputLabel>Sort By</InputLabel>
                <Select value={sortBy} label="Sort By" onChange={(e)=> setSortBy(e.target.value as any)}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16181C !important',
                      border: '1px solid #2F3336 !important',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4) !important',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA !important',
                        backgroundColor: '#16181C !important',
                        fontSize: '0.875rem !important',
                        padding: '8px 16px !important',
                        '&:hover': {
                          backgroundColor: '#2F3336 !important',
                          color: '#FFFFFF !important',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                          color: '#FFFFFF !important',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                          },
                        },
                      },
                    },
                  },
                }}
                >
                  <MenuItem value="wp_published_date">Published Date</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="author_name">Author</MenuItem>
                  <MenuItem value="ingested_at">Ingested</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{
                '& .MuiOutlinedInput-root': {
                  color: '#E7E9EA',
                  backgroundColor: '#16181C',
                  '& fieldset': {
                    borderColor: '#2F3336',
                  },
                  '&:hover fieldset': {
                    borderColor: '#71767B',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#1D9BF0',
                  },
                  '& .MuiSelect-select': {
                    color: '#E7E9EA !important',
                    backgroundColor: 'transparent',
                  },
                  '& .MuiInputBase-input': {
                    color: '#E7E9EA !important',
                  },
                },
                '& .MuiInputLabel-root': {
                  color: '#E7E9EA',
                  '&.Mui-focused': {
                    color: '#1D9BF0',
                  },
                },
              }}>
                <InputLabel>Order</InputLabel>
                <Select value={sortOrder} label="Order" onChange={(e)=> setSortOrder(e.target.value as any)}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#16181C !important',
                      border: '1px solid #2F3336 !important',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4) !important',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA !important',
                        backgroundColor: '#16181C !important',
                        fontSize: '0.875rem !important',
                        padding: '8px 16px !important',
                        '&:hover': {
                          backgroundColor: '#2F3336 !important',
                          color: '#FFFFFF !important',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1) !important',
                          color: '#FFFFFF !important',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2) !important',
                          },
                        },
                      },
                    },
                  },
                }}
                >
                  <MenuItem value="DESC">Newest First</MenuItem>
                  <MenuItem value="ASC">Oldest First</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant={mineOnly ? 'contained' : 'outlined'}
                onClick={()=>{
                  const next = !mineOnly;
                  setMineOnly(next);
                  setCurrentPage(1);
                  loadData(1, { ...(origin !== 'all' ? { origin } as any : {}), ...(next ? { mine: true } as any : {}) });
                }}
              >
                Mine Only
              </Button>

              <Button
                variant={selectedCategory && categories.find(c => c.name === 'Intel Quick Updates' && c.id.toString() === selectedCategory) ? 'contained' : 'outlined'}
                color="secondary"
                onClick={() => {
                  const intelCategory = categories.find(c => c.name === 'Intel Quick Updates');
                  if (intelCategory) handleCategoryFilter(intelCategory.id.toString());
                }}
                disabled={!categories.find(c => c.name === 'Intel Quick Updates')}
              >
                Intel Quick Updates
              </Button>
            </Box>

            {/* Tag Filter */}
            {availableTags.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <TagFilter
                  availableTags={availableTags}
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                />
              </Box>
            )}

            {/* Active filter chips and view switch */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {selectedCategory && (
                  <Chip
                    label={`Category: ${categories.find(c => c.id.toString() === selectedCategory)?.name}`}
                    onDelete={() => handleCategoryFilter('')}
                    size="small"
                    color="primary"
                  />
                )}
                {authorFilter && (
                  <Chip
                    label={`Author: ${authorFilter}`}
                    onDelete={() => setAuthorFilter('')}
                    size="small"
                    color="secondary"
                  />
                )}
                {dateFromFilter && (
                  <Chip
                    label={`From: ${dateFromFilter}`}
                    onDelete={() => setDateFromFilter('')}
                    size="small"
                    color="default"
                  />
                )}
                {dateToFilter && (
                  <Chip
                    label={`To: ${dateToFilter}`}
                    onDelete={() => setDateToFilter('')}
                    size="small"
                    color="default"
                  />
                )}
                {origin !== 'all' && (
                  <Chip
                    label={`Origin: ${origin}`}
                    onDelete={() => setOrigin('all')}
                    size="small"
                    color="default"
                  />
                )}
                {mineOnly && (
                  <Chip
                    label={`Mine Only`}
                    onDelete={() => setMineOnly(false)}
                    size="small"
                    color="default"
                  />
                )}
                {selectedTags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => setSelectedTags(prev => prev.filter(t => t !== tag))}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(29, 155, 240, 0.1)',
                      color: '#1D9BF0',
                      borderColor: '#1D9BF0',
                      '& .MuiChip-deleteIcon': {
                        color: '#1D9BF0'
                      }
                    }}
                  />
                ))}
              </Box>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Button
                  variant={exportMode ? 'contained' : 'outlined'}
                  startIcon={<FileDownload />}
                  onClick={() => {
                    setExportMode(!exportMode);
                    setSelectedPosts(new Set());
                  }}
                  size="small"
                  sx={{
                    borderRadius: '8px',
                    borderColor: '#2F3336',
                    color: exportMode ? '#ffffff' : '#E7E9EA',
                    backgroundColor: exportMode ? '#1D9BF0' : 'transparent',
                    fontSize: '14px',
                    fontWeight: 500,
                    px: 2,
                    py: 1,
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: '#1D9BF0',
                      backgroundColor: exportMode ? '#1a8cd8' : 'rgba(29, 155, 240, 0.1)',
                      color: exportMode ? '#ffffff' : '#1D9BF0'
                    }
                  }}
                >
                  Export Mode
                </Button>

                <ToggleButtonGroup
                  value={viewMode}
                  exclusive
                  onChange={(_, newMode) => newMode && setViewMode(newMode)}
                  size="small"
                sx={{
                  display: { xs: 'flex', sm: 'flex' },
                  '& .MuiToggleButton-root': {
                    color: '#E7E9EA',
                    borderColor: '#2F3336',
                    px: { xs: 1.5, sm: 2 }, // Adjust padding for mobile
                    py: { xs: 1, sm: 1.5 },
                    minWidth: { xs: '44px', sm: '48px' }, // Ensure touch-friendly size
                    '&:hover': {
                      backgroundColor: 'rgba(29, 155, 240, 0.1)',
                      borderColor: '#1D9BF0',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'rgba(29, 155, 240, 0.2)',
                      color: '#1D9BF0',
                      borderColor: '#1D9BF0',
                      '&:hover': {
                        backgroundColor: 'rgba(29, 155, 240, 0.3)',
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="grid">
                  <ViewModule />
                </ToggleButton>
                <ToggleButton 
                  value="table" 
                  sx={{ display: { xs: 'none', sm: 'flex' } }} // Hide on mobile
                >
                  <ViewList />
                </ToggleButton>
                <ToggleButton value="feed">
                  <Feed />
                </ToggleButton>
              </ToggleButtonGroup>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Floating Export Toolbar */}
        {exportMode && selectedPosts.size > 0 && (
          <Paper
            sx={{
              position: 'fixed',
              bottom: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1300,
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: 2,
              px: 3,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
            }}
          >
            <Typography sx={{ color: '#E7E9EA', fontWeight: 500 }}>
              {selectedPosts.size} {selectedPosts.size === 1 ? 'post' : 'posts'} selected
            </Typography>
            
            <Button
              variant="contained"
              startIcon={<FileDownload />}
              onClick={async () => {
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch('/api/export/pdf', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      postIds: Array.from(selectedPosts),
                      includeComments: true,
                      includeTags: true
                    })
                  });
                  
                  if (!response.ok) {
                    throw new Error('Export failed');
                  }
                  
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `vector-threads-export-${Date.now()}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                  
                  // Reset export mode
                  setExportMode(false);
                  setSelectedPosts(new Set());
                } catch (error) {
                  console.error('Export error:', error);
                  alert('Failed to export posts. Please try again.');
                }
              }}
              sx={{
                backgroundColor: '#1D9BF0',
                '&:hover': {
                  backgroundColor: '#1a8cd8'
                }
              }}
            >
              Export PDF
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SelectAll />}
              onClick={() => {
                const allPostIds = new Set(posts.map(p => p.id));
                setSelectedPosts(allPostIds);
              }}
              sx={{
                borderColor: '#374151',
                color: '#9CA3AF',
                '&:hover': {
                  borderColor: '#6B7280',
                  backgroundColor: 'rgba(156, 163, 175, 0.1)'
                }
              }}
            >
              Select All
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={() => setSelectedPosts(new Set())}
              sx={{
                borderColor: '#374151',
                color: '#9CA3AF',
                '&:hover': {
                  borderColor: '#6B7280',
                  backgroundColor: 'rgba(156, 163, 175, 0.1)'
                }
              }}
            >
              Clear
            </Button>
          </Paper>
        )}

        

        {/* Results */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

                 {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
                         {posts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="textSecondary">
                  {location.pathname === '/my-threads' ? 'No threads found' : 'No posts found'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {location.pathname === '/my-threads' 
                    ? 'Create your first thread or try adjusting your search criteria' 
                    : 'Try adjusting your search criteria'
                  }
                </Typography>
              </Box>
            ) : viewMode === 'grid' ? (
              <Box sx={{ 
                display: 'grid', 
                gap: { xs: 2, sm: 2, md: 3 }, 
                gridTemplateColumns: { 
                  xs: 'repeat(1, 1fr)', 
                  sm: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  md: 'repeat(auto-fit, minmax(300px, 1fr))' 
                }, 
                maxWidth: { xs: '100%', sm: '100%', md: '1200px' }, 
                mx: 'auto',
                px: { xs: 2, sm: 2, md: 0 }
              }}>
                                    {posts.map((post) => {
                  const titleText = stripHtmlTags(post.title);
                  const excerptText = stripHtmlTags(post.excerpt || '');
                  const contentText = stripHtmlTags(post.content || '');
                  const contentCount = countMatches(contentText, highlightTerms);
                  const showCount = contentCount > 0;

                  // Check if this is an intel report and render appropriate card
                  if (post.result_type === 'intel_report') {
                    return (
                      <IntelReportCard
                        key={`intel_${post.id}`}
                        report={post}
                        onClick={handleIntelReportClick}
                        highlightText={highlightText}
                      />
                    );
                  }

                  // Regular post card
                  return (
                  <Card
                    key={post.id}
                    sx={{
                      height: '100%',
                      backgroundColor: '#16181C',
                      border: '1px solid #2F3336',
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      position: 'relative',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      },
                    }}
                    onClick={() => {
                      if (exportMode) {
                        const newSelected = new Set(selectedPosts);
                        if (newSelected.has(post.id)) {
                          newSelected.delete(post.id);
                        } else {
                          newSelected.add(post.id);
                        }
                        setSelectedPosts(newSelected);
                      } else {
                        handlePostClick(post.id);
                      }
                    }}
                  >
                    {/* Export Mode Checkbox */}
                    {exportMode && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          zIndex: 1,
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          borderRadius: 1,
                          p: 0.5
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newSelected = new Set(selectedPosts);
                            if (newSelected.has(post.id)) {
                              newSelected.delete(post.id);
                            } else {
                              newSelected.add(post.id);
                            }
                            setSelectedPosts(newSelected);
                          }}
                          sx={{ p: 0 }}
                        >
                          {selectedPosts.has(post.id) ? (
                            <CheckBox sx={{ color: '#1D9BF0' }} />
                          ) : (
                            <CheckBoxOutlineBlank sx={{ color: '#71767B' }} />
                          )}
                        </IconButton>
                      </Box>
                    )}
                    <CardContent>
                      {/* Media Gallery - prefer uploaded attachments; fallback to first image(s) in content */}
                      {post.attachments && post.attachments.length > 0 && (
                        <MediaGallery attachments={post.attachments} maxHeight={180} />
                      )}
                      {(!post.attachments || post.attachments.length === 0) && (
                        <>
                          {(() => {
                            const imageUrls = extractImageUrls(post.content).slice(0, 5);
                            if (imageUrls.length === 0) return null;
                            return (
                              <Box sx={{ 
                                mb: 2, 
                                display: 'flex', 
                                gap: { xs: 0.5, sm: 1 }, 
                                overflowX: 'auto', 
                                pb: 1,
                                px: { xs: 0.5, sm: 0 }
                              }}>
                                {imageUrls.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={resolveContentImageUrl(url)}
                                    alt={`Post image ${idx + 1}`}
                                    style={{ 
                                      width: window.innerWidth < 600 ? 120 : 160, 
                                      height: window.innerWidth < 600 ? 90 : 120, 
                                      objectFit: 'cover', 
                                      borderRadius: '8px', 
                                      flex: '0 0 auto' 
                                    }}
                                    onError={(e) => {
                                      console.log('Image failed to load, falling back to direct URL:', url);
                                      const img = e.currentTarget as HTMLImageElement;
                                      // Fallback to direct WordPress URL if proxy fails
                                      if (url.includes('cmansrms.us') || url.includes('wordpress')) {
                                        img.src = url.startsWith('http') ? url : `https://cmansrms.us${url.startsWith('/') ? url : `/${url}`}`;
                                      } else {
                                        img.style.display = 'none';
                                      }
                                    }}
                                  />
                                ))}
                              </Box>
                            );
                          })()}
                        </>
                      )}
                      
                      <Typography variant="h6" component="h2" gutterBottom sx={{ color: '#E7E9EA', fontSize: '1rem', mb: 1 }}>
                        {highlightText(stripHtmlTags(post.title))}
                      </Typography>
                      
                      {/* Display tags */}
                      {post.tags && post.tags.length > 0 && (
                        <Box sx={{ mb: 1 }}>
                          <TagDisplay 
                            tags={post.tags} 
                            size="small"
                            onTagClick={(tag) => {
                              // Add tag to selected tags if not already selected
                              if (!selectedTags.includes(tag)) {
                                setSelectedTags([...selectedTags, tag]);
                              }
                            }}
                          />
                        </Box>
                      )}
                      
                      {(() => {
                        const raw = post.excerpt && post.excerpt.trim().length > 0 
                          ? post.excerpt 
                          : (post.content || '');
                        const text = stripHtmlTags(raw);
                        if (!text) return null;
                        return (
                          <Typography variant="body2" sx={{ color: '#6B7280', mb: 1, fontSize: '0.875rem' }}>
                            {highlightText(text.substring(0, 450))}...
                          </Typography>
                        );
                      })()}

                      <Box sx={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: { xs: 0.25, sm: 0.5 }, 
                        mb: 1 
                      }}>
                        {post.category_name && (
                          <Chip 
                            size={window.innerWidth < 600 ? "medium" : "small"}
                            label={post.category_name} 
                            color="primary"
                            variant="outlined"
                            sx={{ 
                              fontSize: { xs: '0.875rem', sm: '0.75rem' },
                              height: { xs: '28px', sm: '24px' }
                            }}
                          />
                        )}
                        <Chip 
                          size={window.innerWidth < 600 ? "medium" : "small"}
                          label={post.author_name} 
                          variant="outlined"
                          sx={{ 
                            borderColor: '#E5E7EB',
                            color: '#6B7280',
                            fontSize: { xs: '0.875rem', sm: '0.75rem' },
                            height: { xs: '28px', sm: '24px' }
                          }}
                        />
                        <Chip 
                          size={window.innerWidth < 600 ? "medium" : "small"}
                          label={format(new Date(post.wp_published_date), 'MMM dd, yyyy')} 
                          variant="outlined"
                          sx={{ 
                            borderColor: '#E5E7EB',
                            color: '#6B7280',
                            fontSize: { xs: '0.875rem', sm: '0.75rem' },
                            height: { xs: '28px', sm: '24px' }
                          }}
                        />
                        {/* Comment Count Indicator */}
                        {post.comment_count && post.comment_count > 0 && (
                          <Chip 
                            size={window.innerWidth < 600 ? "medium" : "small"}
                            label={`💬 ${post.comment_count}`}
                            color="secondary"
                            variant="filled"
                            sx={{ 
                              fontSize: { xs: '0.875rem', sm: '0.75rem' },
                              backgroundColor: '#8B5CF6',
                              color: 'white',
                              height: { xs: '28px', sm: '24px' },
                              '& .MuiChip-label': {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }
                            }}
                          />
                        )}
                      </Box>

                      {/* Featured Media */}
                      {post.featured_media_url && (
                        <Box sx={{ mb: 2 }}>
                          <img
                            src={resolveContentImageUrl(post.featured_media_url)}
                            alt="Featured media"
                            style={{ 
                              maxWidth: '100%', 
                              height: 'auto', 
                              borderRadius: '8px',
                              border: '1px solid red' // Debug border to see if image is there
                            }}
                            onLoad={() => console.log('Featured media loaded successfully:', post.featured_media_url)}
                            onError={(e) => {
                              console.log('Featured media failed to load, falling back to direct URL:', post.featured_media_url);
                              const img = e.currentTarget as HTMLImageElement;
                              // Fallback to direct WordPress URL if proxy fails
                              if (post.featured_media_url && (post.featured_media_url.includes('cmansrms.us') || post.featured_media_url.includes('wordpress'))) {
                                img.src = post.featured_media_url.startsWith('http') ? post.featured_media_url : `https://cmansrms.us${post.featured_media_url.startsWith('/') ? post.featured_media_url : `/${post.featured_media_url}`}`;
                              }
                            }}
                          />
                        </Box>
                      )}

                      {/* Action Buttons - Centered at bottom */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        gap: 1, 
                        mt: 'auto', 
                        pt: 1,
                        flexDirection: 'row'
                      }}>
                        {/* Follow Button */}
                        <FollowButton
                          postId={post.id}
                          variant="icon"
                          size="small"
                          showTooltip={false}
                          onFollowChange={(isFollowing) => {
                            console.log(`Post ${post.id} ${isFollowing ? 'followed' : 'unfollowed'}`);
                          }}
                        />
                        
                        {showCount ? (
                          <Badge badgeContent={contentCount} color="secondary">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostClick(post.id);
                              }}
                              sx={{
                                color: '#71767B',
                                '&:hover': {
                                  color: '#1D9BF0',
                                  backgroundColor: 'rgba(29, 155, 240, 0.1)'
                                }
                              }}
                            >
                              <Visibility sx={{ fontSize: '1.2rem' }} />
                            </IconButton>
                          </Badge>
                        ) : (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostClick(post.id);
                            }}
                            sx={{
                              color: '#71767B',
                              '&:hover': {
                                color: '#1D9BF0',
                                backgroundColor: 'rgba(29, 155, 240, 0.1)'
                              }
                            }}
                          >
                            <Visibility sx={{ fontSize: '1.2rem' }} />
                          </IconButton>
                        )}

                        {/* Edit button for manual posts */}
                        {!post.wp_post_id && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              const evt = new CustomEvent('open-new-post-modal', { detail: { postId: post.id } });
                              window.dispatchEvent(evt);
                            }}
                            sx={{
                              color: '#71767B',
                              '&:hover': {
                                color: '#1D9BF0',
                                backgroundColor: 'rgba(29, 155, 240, 0.1)'
                              }
                            }}
                          >
                            <EditIcon sx={{ fontSize: '1.2rem' }} />
                          </IconButton>
                        )}
                        
                        {/* Delete Button - using DeletePostButton component which handles permissions */}
                        <DeletePostButton
                          postId={post.id}
                          postTitle={post.title}
                          variant="icon"
                          size="small"
                          onDelete={(deletedPostId) => {
                            console.log(`Post ${deletedPostId} deleted from search results`);
                            // Remove the deleted post from the current list
                            setPosts(prevPosts => prevPosts.filter(p => p.id !== deletedPostId));
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                );})}
              </Box>
            ) : viewMode === 'feed' ? (
              <Box sx={{ 
                maxWidth: { xs: '100%', sm: '600px', md: '900px' }, 
                mx: 'auto',
                px: { xs: 0, sm: 1, md: 2 } // Add responsive padding
              }}>
                {posts.map((post) => {
                  // Check if this is an intel report and render appropriate card
                  if (post.result_type === 'intel_report') {
                    return (
                      <IntelReportCard
                        key={`intel_${post.id}`}
                        report={post}
                        onClick={handleIntelReportClick}
                        highlightText={highlightText}
                      />
                    );
                  }

                  // Regular post using Twitter-style layout
                  return (
                    <TwitterStylePostCard
                      key={post.id}
                      post={post}
                      onClick={handlePostClick}
                      highlightText={highlightText}
                      onFollowChange={(postId, isFollowing) => {
                        console.log(`Post ${postId} ${isFollowing ? 'followed' : 'unfollowed'} from search`);
                        // Refresh the current search results
                        loadData(currentPage);
                      }}
                    />
                  );
                })}
              </Box>
            ) : (
              <Box sx={{ 
                display: { xs: 'none', md: 'block' },
                overflowX: 'auto'
              }}>
                <TableContainer 
                  component={Paper}
                  sx={{
                    backgroundColor: '#16181C',
                    '& .MuiTableCell-root': {
                      backgroundColor: '#16181C',
                      color: '#E7E9EA',
                      borderBottom: '1px solid #2F3336'
                    },
                    '& .MuiTableHead-root .MuiTableCell-root': {
                      backgroundColor: '#1E293B',
                      color: '#E7E9EA',
                      fontWeight: 600,
                      borderBottom: '2px solid #2F3336'
                    },
                    '& .MuiTableRow-root:hover': {
                      backgroundColor: '#1C1F23'
                    }
                  }}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>Author</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Published</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                  <TableBody>
                    {posts.map((post) => {
                      const titleText = stripHtmlTags(post.title);
                      const excerptText = stripHtmlTags(post.excerpt || '');
                      const contentText = stripHtmlTags(post.content || '');
                      const contentCount = countMatches(contentText, highlightTerms);
                      const showCount = contentCount > 0;
                      return (
                      <TableRow 
                        key={post.id}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                        onClick={() => handlePostClick(post.id)}
                      >
                        <TableCell>
                          <Box>
                            <Typography variant="subtitle2">
                              {highlightText(stripHtmlTags(post.title))}
                            </Typography>
                            {post.excerpt && (
                              <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                                {highlightText(stripHtmlTags(post.excerpt).substring(0, 150))}...
                              </Typography>
                            )}
                            {/* Display tags in table */}
                            {post.tags && post.tags.length > 0 && (
                              <Box sx={{ mt: 0.5 }}>
                                <TagDisplay 
                                  tags={post.tags} 
                                  size="small"
                                  maxDisplay={3}
                                  onTagClick={(tag) => {
                                    // Add tag to selected tags if not already selected
                                    if (!selectedTags.includes(tag)) {
                                      setSelectedTags([...selectedTags, tag]);
                                    }
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>{post.author_name}</TableCell>
                        <TableCell>
                          {post.category_name && (
                            <Chip size="small" label={post.category_name} color="primary" />
                          )}
                        </TableCell>
                        <TableCell>
                          {format(new Date(post.wp_published_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {/* Follow Button */}
                            <FollowButton
                              postId={post.id}
                              variant="icon"
                              size="small"
                              showTooltip={false}
                              onFollowChange={(isFollowing) => {
                                console.log(`Post ${post.id} ${isFollowing ? 'followed' : 'unfollowed'}`);
                              }}
                            />
                            
                            {/* Delete Button */}
                            <DeletePostButton
                              postId={post.id}
                              postTitle={post.title}
                              variant="icon"
                              size="small"
                              onDelete={(deletedPostId) => {
                                console.log(`Post ${deletedPostId} deleted from table view`);
                                setPosts(prevPosts => prevPosts.filter(p => p.id !== deletedPostId));
                              }}
                            />
                            
                            {showCount ? (
                              <Badge badgeContent={contentCount} color="secondary">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePostClick(post.id);
                                  }}
                                >
                                  <Visibility />
                                </IconButton>
                              </Badge>
                            ) : (
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePostClick(post.id);
                                }}
                              >
                                <Visibility />
                              </IconButton>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
              </TableContainer>
              </Box>
            )}

            {totalPages > 1 && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mt: { xs: 3, sm: 4 },
                px: { xs: 2, sm: 0 } // Add padding on mobile
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  gap: { xs: 0.5, sm: 1 },
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  justifyContent: 'center'
                }}>
                  <Button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    size={window.innerWidth < 600 ? "small" : "medium"}
                    sx={{
                      minWidth: { xs: '80px', sm: 'auto' },
                      fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}
                  >
                    Previous
                  </Button>
                  <Typography sx={{ 
                    px: { xs: 1, sm: 2 }, 
                    py: 1, 
                    alignSelf: 'center', 
                    color: '#E7E9EA',
                    fontSize: { xs: '0.9rem', sm: '1rem' },
                    textAlign: 'center',
                    minWidth: { xs: '80px', sm: 'auto' }
                  }}>
                    Page {currentPage} of {totalPages}
                  </Typography>
                  <Button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    size={window.innerWidth < 600 ? "small" : "medium"}
                    sx={{
                      minWidth: { xs: '80px', sm: 'auto' },
                      fontSize: { xs: '0.8rem', sm: '0.875rem' }
                    }}
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            )}
          </>
        )}

        {/* Post Detail Modal */}
        <PostDetailModal
          open={modalOpen}
          onClose={handleModalClose}
          postId={selectedPostId}
          highlightTerms={highlightTerms}
        />

        {/* Intel Report Detail Modal */}
        <IntelReportDetailModal
          open={intelModalOpen}
          onClose={handleIntelModalClose}
          reportId={selectedIntelReportId}
          onEdit={handleIntelEdit}
          onDelete={handleIntelDelete}
          onStatusChange={handleIntelStatusChange}
        />

        {/* Search Help Dialog */}
        <Dialog open={helpOpen} onClose={()=> setHelpOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Search help</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
{`Basics: free text matches title, content, excerpt. Use quotes for exact phrases.
Example: "stolen vehicle"

Filters:
- author:<name>          e.g., author:smith
- category:<name>        e.g., category:Intel Quick Updates
- after:YYYY-MM-DD       e.g., after:2025-01-01
- before:YYYY-MM-DD      e.g., before:2025-06-30
- origin:(manual|wordpress)
- mine:true              (only posts you created)

Combine tokens to AND conditions.
Example:
"vehicle break-in" author:jdoe after:2024-10-01 origin:wordpress mine:true`}
            </Typography>
          </DialogContent>
        </Dialog>
      </Box>
    </Container>
  );
};

export default HomeSimple;