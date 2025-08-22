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
  Autocomplete
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility,
  ViewModule,
  ViewList,
  Person,
  HelpOutline
} from '@mui/icons-material';
import { Post, Category, SearchFilters } from '../types';
import apiService, { API_BASE_URL } from '../services/api';
import auditService from '../services/auditService';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';
import PostDetailModal from '../components/PostDetailModal';
import MediaGallery from '../components/MediaGallery';

const HomeSimple: React.FC = () => {
  const location = useLocation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Array<{ name: string; totalPosts: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [origin, setOrigin] = useState<'all'|'wordpress'|'manual'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'wp_published_date'|'title'|'author_name'|'ingested_at'>('wp_published_date');
  const [sortOrder, setSortOrder] = useState<'ASC'|'DESC'>('DESC');
  const [helpOpen, setHelpOpen] = useState(false);

  const categoryByName = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach(c => map.set(c.name.toLowerCase(), c));
    return map;
  }, [categories]);

  const loadData = async (page = 1, filters: SearchFilters = {}) => {
    try {
      setLoading(true);
      const [postsResponse, categoriesResponse, authorsResponse] = await Promise.all([
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
          ...(mineOnly ? { mine: true } as any : {})
        }),
        categories.length === 0 ? apiService.getCategories() : Promise.resolve(categories),
        authors.length === 0 ? apiService.getAuthors().catch(() => ({ authors: [] })) : Promise.resolve({ authors })
      ]);

      setPosts(postsResponse.posts);
      setTotalPages(postsResponse.pagination.pages);
      if (categories.length === 0) {
        setCategories(categoriesResponse as Category[]);
      }
      if (authors.length === 0) {
        setAuthors(authorsResponse.authors);
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
    // derive terms from current searchTerm (remaining free-text only)
    const tokens = (searchTerm.match(/\"[^\"]+\"|\S+/g) || [])
      .map(t => t.replace(/^\"|\"$/g, ''))
      .filter(t => t && !t.includes(':'));
    return tokens;
  }, [searchTerm]);

  const highlightText = (input: string) => {
    if (!highlightTerms.length) return input;
    
    // Create a single pattern for all terms with word variations
    const patterns = highlightTerms.map(term => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match the exact term or words containing the term
      return `\\b\\w*${escaped}\\w*\\b`;
    });
    
    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    const parts = input.split(regex);
    
    return parts.map((part, i) => {
      if (!part) return <React.Fragment key={i}></React.Fragment>;
      
      // Check if this part matches our regex (was captured)
      const isMatch = regex.test(part);
      regex.lastIndex = 0; // Reset regex state
      
      // Also check manually for term matching
      const shouldHighlight = isMatch || highlightTerms.some(term => 
        part.toLowerCase().includes(term.toLowerCase())
      );
      
      return shouldHighlight ? (
        <mark key={i} style={{ backgroundColor: '#FFEB3B', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      );
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
      ...(mineOnly ? { mine: true } as any : {})
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
        sortBy,
        sortOrder
      });
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, authorFilter, dateFromFilter, dateToFilter, origin, mineOnly, sortBy, sortOrder, categories]);

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    // Don't call loadData here - let the useEffect handle it
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
    const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
    let absolute = rawUrl;
    if (rawUrl.startsWith('/')) absolute = `${remoteBase}${rawUrl}`;
    else if (!rawUrl.startsWith('http')) absolute = `${remoteBase}/${rawUrl}`;
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    const tokenQuery = token ? `&t=${encodeURIComponent(token)}` : '';
    const shouldUseDirect = absolute.includes('cmansrms.us');
    return shouldUseDirect ? absolute : `${API_BASE_URL}/media?url=${encodeURIComponent(absolute)}${tokenQuery}`;
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
    <Container maxWidth="lg" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ py: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                Search Vector
              </Typography>
              
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
  placeholder=""
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '50px',
                      backgroundColor: 'white',
                      fontSize: '18px',
                      height: '64px',
                      boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.25)',
                      border: '2px solid transparent',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: '0 16px 50px -8px rgba(0, 0, 0, 0.35)',
                        transform: 'translateY(-1px)'
                      },
                      '&.Mui-focused': {
                        boxShadow: '0 16px 50px -8px rgba(0, 0, 0, 0.35)',
                        borderColor: '#3B82F6',
                        transform: 'translateY(-1px)'
                      },
                      '& fieldset': {
                        border: 'none'
                      },
                      '& input': {
                        padding: '20px 24px 20px 60px',
                        fontSize: '18px',
                        color: '#1F2937',
                        '&::placeholder': {
                          color: '#9CA3AF',
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
                        <SearchIcon sx={{ color: '#6B7280', fontSize: 24 }} />
                      </Box>
                    ),
                    endAdornment: (
                      <Box sx={{ position: 'absolute', right: 20, zIndex: 1 }}>
                        <Tooltip title="Search syntax">
                          <IconButton aria-label="search help" onClick={()=> setHelpOpen(true)} size="small">
                            <HelpOutline sx={{ color: '#6B7280' }} />
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
                  mt: 4 
                }}>
                  <Button 
                    variant="contained" 
                    onClick={handleSearch}
                    disabled={loading || !searchTerm.trim()}
                    size="large"
                    sx={{ 
                      borderRadius: '25px',
                      backgroundColor: '#000000',
                      color: 'white',
                      fontSize: '16px',
                      fontWeight: 600,
                      px: 4,
                      py: 1.5,
                      textTransform: 'none',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                      '&:hover': {
                        backgroundColor: '#1F2937',
                        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
                        transform: 'translateY(-1px)'
                      },
                      '&:disabled': {
                        backgroundColor: '#E5E7EB',
                        color: '#9CA3AF',
                        boxShadow: 'none'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {loading ? <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} /> : null}
                    Search
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
            justifyContent: 'center', 
            alignItems: 'center', 
            mb: 4,
            gap: 2,
            flexWrap: 'wrap'
          }}>
            <Box sx={{ 
              position: 'relative',
              width: '100%',
              maxWidth: '500px'
            }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder='Search posts...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '25px',
                    backgroundColor: 'white',
                    fontSize: '14px',
                    height: '44px',
                    boxShadow: '0 8px 25px -8px rgba(0, 0, 0, 0.2)',
                    border: '1px solid #E5E7EB',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 10px 30px -8px rgba(0, 0, 0, 0.25)',
                      borderColor: '#D1D5DB'
                    },
                    '&.Mui-focused': {
                      boxShadow: '0 10px 30px -8px rgba(59, 130, 246, 0.15)',
                      borderColor: '#3B82F6'
                    },
                    '& input': {
                      padding: '12px 16px 12px 45px',
                      fontSize: '14px',
                      color: '#1F2937',
                      '&::placeholder': {
                        color: '#9CA3AF',
                        opacity: 1
                      }
                    }
                  }
                }}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ 
                      position: 'absolute', 
                      left: 16, 
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <SearchIcon sx={{ color: '#6B7280', fontSize: 18 }} />
                    </Box>
                  ),
                  endAdornment: (
                    <Box sx={{ position: 'absolute', right: 16, zIndex: 1 }}>
                      <Tooltip title="Search syntax">
                        <IconButton aria-label="search help" onClick={()=> setHelpOpen(true)} size="small">
                          <HelpOutline sx={{ color: '#6B7280', fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                }}
              />
            </Box>
            
            <Button 
              variant="contained" 
              onClick={handleSearch}
              disabled={loading || !searchTerm.trim()}
              sx={{ 
                borderRadius: '20px',
                backgroundColor: '#000000',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                px: 3,
                py: 1,
                textTransform: 'none',
                minWidth: 'auto',
                height: '44px',
                '&:hover': {
                  backgroundColor: '#1F2937'
                },
                '&:disabled': {
                  backgroundColor: '#E5E7EB',
                  color: '#9CA3AF'
                }
              }}
            >
              {loading ? <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} /> : null}
              Search
            </Button>
          </Box>
        )}

        {/* Advanced Filters - Separate Section */}
        <Card sx={{ 
          mb: 4,
          backgroundColor: '#16181C',
          border: '1px solid #2F3336',
          borderRadius: 2
        }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, color: '#E7E9EA', fontWeight: 600 }}>
              Advanced Filters
            </Typography>

            {/* Uniform filter grid */}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
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
                sx={{
                  '& .MuiAutocomplete-option': {
                    color: '#E7E9EA',
                    '&:hover': {
                      backgroundColor: '#2F3336',
                    },
                    '&.Mui-focused': {
                      backgroundColor: 'rgba(29, 155, 240, 0.1)',
                    },
                  },
                }}
              />

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
                      backgroundColor: '#16181C',
                      border: '1px solid #2F3336',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        '&:hover': {
                          backgroundColor: '#2F3336',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1)',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2)',
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
                          backgroundColor: '#16181C',
                          border: '1px solid #2F3336',
                          '& .MuiMenuItem-root': {
                            color: '#E7E9EA',
                            '&:hover': {
                              backgroundColor: '#2F3336',
                            },
                            '&.Mui-selected': {
                              backgroundColor: 'rgba(29, 155, 240, 0.1)',
                              '&:hover': {
                                backgroundColor: 'rgba(29, 155, 240, 0.2)',
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
                }}
              />

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
                      backgroundColor: '#16181C',
                      border: '1px solid #2F3336',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        '&:hover': {
                          backgroundColor: '#2F3336',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1)',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2)',
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
                      backgroundColor: '#16181C',
                      border: '1px solid #2F3336',
                      '& .MuiMenuItem-root': {
                        color: '#E7E9EA',
                        '&:hover': {
                          backgroundColor: '#2F3336',
                        },
                        '&.Mui-selected': {
                          backgroundColor: 'rgba(29, 155, 240, 0.1)',
                          '&:hover': {
                            backgroundColor: 'rgba(29, 155, 240, 0.2)',
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
              </Box>

              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="grid">
                  <ViewModule />
                </ToggleButton>
                <ToggleButton value="table">
                  <ViewList />
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </CardContent>
        </Card>

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
                  No posts found
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Try adjusting your search criteria
                </Typography>
              </Box>
            ) : viewMode === 'grid' ? (
              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', maxWidth: '1200px', mx: 'auto' }}>
                {posts.map((post) => {
                  const titleText = stripHtmlTags(post.title);
                  const excerptText = stripHtmlTags(post.excerpt || '');
                  const contentText = stripHtmlTags(post.content || '');
                  const contentCount = countMatches(contentText, highlightTerms);
                  const showCount = contentCount > 0;
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
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                      },
                    }}
                    onClick={() => handlePostClick(post.id)}
                  >
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
                              <Box sx={{ mb: 2, display: 'flex', gap: 1, overflowX: 'auto', pb: 1 }}>
                                {imageUrls.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={resolveContentImageUrl(url)}
                                    alt={`Post image ${idx + 1}`}
                                    style={{ width: 160, height: 120, objectFit: 'cover', borderRadius: '8px', flex: '0 0 auto' }}
                                    onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; }}
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

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        {post.category_name && (
                          <Chip 
                            size="small" 
                            label={post.category_name} 
                            color="primary"
                            variant="outlined"
                            sx={{ fontSize: '0.75rem' }}
                          />
                        )}
                        <Chip 
                          size="small" 
                          label={post.author_name} 
                          variant="outlined"
                          sx={{ 
                            borderColor: '#E5E7EB',
                            color: '#6B7280',
                            fontSize: '0.75rem'
                          }}
                        />
                        <Chip 
                          size="small" 
                          label={format(new Date(post.wp_published_date), 'MMM dd, yyyy')} 
                          variant="outlined"
                          sx={{ 
                            borderColor: '#E5E7EB',
                            color: '#6B7280',
                            fontSize: '0.75rem'
                          }}
                        />
                        {/* Comment Count Indicator */}
                        {post.comment_count && post.comment_count > 0 && (
                          <Chip 
                            size="small" 
                            label={`💬 ${post.comment_count}`}
                            color="secondary"
                            variant="filled"
                            sx={{ 
                              fontSize: '0.75rem',
                              backgroundColor: '#8B5CF6',
                              color: 'white',
                              '& .MuiChip-label': {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }
                            }}
                          />
                        )}
                      </Box>

                      {/* Media attachments preview */}
                      {post.featured_media_url && (
                        <Box sx={{ mb: 2 }}>
                          <img 
                            src={post.featured_media_url.startsWith('http') 
                              ? post.featured_media_url 
                              : `https://cso.vectoronline.us${post.featured_media_url}`}
                            alt="Featured media"
                            style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                          />
                        </Box>
                      )}

                      {/* Action Buttons - Centered at bottom */}
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 'auto', pt: 1 }}>
                        {showCount ? (
                          <Badge badgeContent={contentCount} color="secondary">
                            <Button
                              startIcon={<Visibility />}
                              size="small"
                              variant="contained"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostClick(post.id);
                              }}
                              sx={{
                                backgroundColor: '#000000',
                                color: '#ffffff',
                                '&:hover': {
                                  backgroundColor: '#1a1a1a'
                                }
                              }}
                            >
                              View Details
                            </Button>
                          </Badge>
                        ) : (
                          <Button
                            startIcon={<Visibility />}
                            size="small"
                            variant="contained"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostClick(post.id);
                            }}
                            sx={{
                              backgroundColor: '#000000',
                              color: '#ffffff',
                              '&:hover': {
                                backgroundColor: '#1a1a1a'
                              }
                            }}
                          >
                            View Details
                          </Button>
                        )}
                        {/* Edit/Delete for manual posts authored by current user (server still enforces) */}
                        {!post.wp_post_id && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              const evt = new CustomEvent('open-new-post-modal', { detail: { postId: post.id } });
                              window.dispatchEvent(evt);
                            }}
                            sx={{
                              borderColor: '#2F3336',
                              color: '#E7E9EA',
                              '&:hover': {
                                borderColor: '#1D9BF0',
                                backgroundColor: 'rgba(29, 155, 240, 0.1)'
                              }
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {!post.wp_post_id && (
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={(e)=>{ e.stopPropagation(); handleDelete(post.id); }}
                            sx={{
                              borderColor: '#dc2626',
                              color: '#dc2626',
                              '&:hover': {
                                backgroundColor: 'rgba(220, 38, 38, 0.1)'
                              }
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                );})}
              </Box>
            ) : (
              <TableContainer component={Paper}>
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
                        </TableCell>
                      </TableRow>
                    );})}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>
                  <Typography sx={{ px: 2, py: 1, alignSelf: 'center', color: '#E7E9EA' }}>
                    Page {currentPage} of {totalPages}
                  </Typography>
                  <Button 
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
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