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
  Badge
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
import apiService from '../services/api';
import { format } from 'date-fns';
import PostDetailModal from '../components/PostDetailModal';

const HomeSimple: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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
      const [postsResponse, categoriesResponse] = await Promise.all([
        apiService.getPosts({
          page,
          limit: 12,
          search: searchTerm,
          category: selectedCategory,
          author: authorFilter,
          dateFrom: dateFromFilter,
          dateTo: dateToFilter,
          sortBy,
          sortOrder,
          ...filters,
          ...(origin !== 'all' ? { origin } as any : {}),
          ...(mineOnly ? { mine: true } as any : {})
        }),
        categories.length === 0 ? apiService.getCategories() : Promise.resolve(categories)
      ]);

      setPosts(postsResponse.posts);
      setTotalPages(postsResponse.pagination.pages);
      if (categories.length === 0) {
        setCategories(categoriesResponse as Category[]);
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
    const escaped = highlightTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = input.split(regex);
    return parts.map((part, i) => (
      regex.test(part) ? (
        <mark key={i} style={{ backgroundColor: 'yellow', padding: 0 }}>{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      )
    ));
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
      nextOrigin = 'manual';
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

  const handleSearch = () => {
    const parsed = parseAdvancedQuery();
    const q = parsed.remainingQuery;
    setSearchTerm(q);
    setCurrentPage(1);
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

  const handlePostClick = (postId: number) => {
    setSelectedPostId(postId);
    setModalOpen(true);
  };

  const handleDelete = async (postId: number) => {
    if (!window.confirm('Delete this post? This action cannot be undone.')) return;
    try {
      await apiService.deletePost(postId);
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

  const handleCategoryFilter = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    loadData(1, { category: categoryId });
  };

  const stripHtmlTags = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
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
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Intelligence Database
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Search and browse intelligence reports and case files
          </Typography>
        </Box>

        {/* Search and Filters (modernized) */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            {/* Primary search bar */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder='Search posts (e.g., "car theft" author:smith before:2025-01-01 origin:wordpress)'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Search syntax">
                        <IconButton aria-label="search help" onClick={()=> setHelpOpen(true)} size="small">
                          <HelpOutline />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
              <Button variant="contained" onClick={handleSearch} disabled={loading} sx={{ minWidth: 120 }}>
                Search
              </Button>
            </Box>

            {/* Uniform filter grid */}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select value={selectedCategory} label="Category" onChange={(e) => handleCategoryFilter(e.target.value)}>
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id.toString()}>
                      {category.parent_name ? `${category.parent_name} › ${category.name}` : category.name} ({category.post_count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Origin</InputLabel>
                <Select value={origin} label="Origin" onChange={(e)=> {
                  const val = e.target.value as 'all'|'wordpress'|'manual';
                  setOrigin(val);
                  setCurrentPage(1);
                  loadData(1, { ...(val !== 'all' ? { origin: val } as any : {}), ...(mineOnly ? { mine: true } as any : {}) });
                }}>
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="wordpress">From WordPress</MenuItem>
                  <MenuItem value="manual">My Threads</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                variant="outlined"
                label="Author"
                placeholder="Filter by author"
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                InputProps={{ startAdornment: (<InputAdornment position="start"><Person /></InputAdornment>) }}
              />

              <TextField
                fullWidth
                variant="outlined"
                label="Date From"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                variant="outlined"
                label="Date To"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />

              <FormControl fullWidth>
                <InputLabel>Sort By</InputLabel>
                <Select value={sortBy} label="Sort By" onChange={(e)=> setSortBy(e.target.value as any)}>
                  <MenuItem value="wp_published_date">Published Date</MenuItem>
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="author_name">Author</MenuItem>
                  <MenuItem value="ingested_at">Ingested</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Select value={sortOrder} label="Order" onChange={(e)=> setSortOrder(e.target.value as any)}>
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
              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))' }}>
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
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 4,
                      },
                    }}
                    onClick={() => handlePostClick(post.id)}
                  >
                    <CardContent>
                      <Typography variant="h6" component="h2" gutterBottom>
                        {highlightText(stripHtmlTags(post.title))}
                      </Typography>
                      
                      {post.excerpt && (
                        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                          {highlightText(stripHtmlTags(post.excerpt).substring(0, 450))}...
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                        {post.category_name && (
                          <Chip size="small" label={post.category_name} color="primary" />
                        )}
                        <Chip size="small" label={post.author_name} />
                        <Chip size="small" label={format(new Date(post.wp_published_date), 'MMM dd, yyyy')} />
                      </Box>

                      {/* Media attachments preview */}
                      {post.featured_media_url && (
                        <Box sx={{ mb: 2 }}>
                          <img 
                            src={post.featured_media_url} 
                            alt="Featured media"
                            style={{ maxWidth: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                          />
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {showCount ? (
                          <Badge badgeContent={contentCount} color="secondary">
                            <Button
                              startIcon={<Visibility />}
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostClick(post.id);
                              }}
                            >
                              View Details
                            </Button>
                          </Badge>
                        ) : (
                          <Button
                            startIcon={<Visibility />}
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostClick(post.id);
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
                          >
                            Edit
                          </Button>
                        )}
                        {!post.wp_post_id && (
                          <Button
                            size="small"
                            color="error"
                            onClick={(e)=>{ e.stopPropagation(); handleDelete(post.id); }}
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
                  <Typography sx={{ px: 2, py: 1, alignSelf: 'center' }}>
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