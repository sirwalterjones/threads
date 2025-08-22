// Responsive Design Utilities
// Provides consistent breakpoints and responsive patterns across the application

export const breakpoints = {
  xs: 0,      // Extra small devices (phones)
  sm: 600,    // Small devices (tablets)
  md: 900,    // Medium devices (small laptops)
  lg: 1200,   // Large devices (desktops)
  xl: 1536,   // Extra large devices (large desktops)
};

export const responsive = {
  // Grid columns for different screen sizes
  grid: {
    xs1: { xs: 'repeat(1, 1fr)' },
    xs2: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
    xs3: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
    xs4: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
    xs6: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(6, 1fr)' },
    auto: { xs: 'repeat(auto-fit, minmax(280px, 1fr))' },
    autoSmall: { xs: 'repeat(auto-fit, minmax(200px, 1fr))' },
    autoMedium: { xs: 'repeat(auto-fit, minmax(300px, 1fr))' },
    autoLarge: { xs: 'repeat(auto-fit, minmax(400px, 1fr))' },
  },

  // Spacing for different screen sizes
  spacing: {
    xs: { xs: 1, sm: 2, md: 3 },
    sm: { xs: 2, sm: 3, md: 4 },
    md: { xs: 3, sm: 4, md: 6 },
    lg: { xs: 4, sm: 6, md: 8 },
    xl: { xs: 6, sm: 8, md: 12 },
  },

  // Typography sizes for different screen sizes
  typography: {
    h1: { xs: '1.75rem', sm: '2.25rem', md: '2.5rem', lg: '3rem' },
    h2: { xs: '1.5rem', sm: '1.75rem', md: '2rem', lg: '2.25rem' },
    h3: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem', lg: '2rem' },
    h4: { xs: '1.125rem', sm: '1.25rem', md: '1.5rem', lg: '1.75rem' },
    h5: { xs: '1rem', sm: '1.125rem', md: '1.25rem', lg: '1.5rem' },
    h6: { xs: '0.875rem', sm: '1rem', md: '1.125rem', lg: '1.25rem' },
    body1: { xs: '0.875rem', sm: '1rem', md: '1rem', lg: '1.125rem' },
    body2: { xs: '0.75rem', sm: '0.875rem', md: '0.875rem', lg: '1rem' },
  },

  // Container widths for different screen sizes
  container: {
    xs: { xs: '100%', sm: '100%', md: '100%' },
    sm: { xs: '100%', sm: '90%', md: '80%', lg: '70%' },
    md: { xs: '100%', sm: '90%', md: '85%', lg: '80%' },
    lg: { xs: '100%', sm: '95%', md: '90%', lg: '85%' },
    xl: { xs: '100%', sm: '95%', md: '95%', lg: '90%' },
  },

  // Padding and margins for different screen sizes
  padding: {
    xs: { xs: 2, sm: 3, md: 4 },
    sm: { xs: 3, sm: 4, md: 6 },
    md: { xs: 4, sm: 6, md: 8 },
    lg: { xs: 6, sm: 8, md: 12 },
    xl: { xs: 8, sm: 12, md: 16 },
  },

  margin: {
    xs: { xs: 1, sm: 2, md: 3 },
    sm: { xs: 2, sm: 3, md: 4 },
    md: { xs: 3, sm: 4, md: 6 },
    lg: { xs: 4, sm: 6, md: 8 },
    xl: { xs: 6, sm: 8, md: 12 },
  },

  // Gap sizes for different screen sizes
  gap: {
    xs: { xs: 1, sm: 1.5, md: 2 },
    sm: { xs: 1.5, sm: 2, md: 3 },
    md: { xs: 2, sm: 3, md: 4 },
    lg: { xs: 3, sm: 4, md: 6 },
    xl: { xs: 4, sm: 6, md: 8 },
  },
};

// Common responsive patterns
export const responsivePatterns = {
  // Card grid that adapts to screen size
  cardGrid: {
    xs: 'repeat(1, 1fr)',
    sm: 'repeat(2, 1fr)',
    md: 'repeat(3, 1fr)',
    lg: 'repeat(4, 1fr)',
    xl: 'repeat(5, 1fr)',
  },

  // Form layout that stacks on mobile
  formLayout: {
    xs: '1fr',
    sm: '1fr',
    md: '2fr 1fr',
    lg: '3fr 1fr',
  },

  // Sidebar layout
  sidebarLayout: {
    xs: '1fr',
    sm: '1fr',
    md: '1fr 300px',
    lg: '1fr 350px',
  },

  // Navigation layout
  navLayout: {
    xs: 'auto 1fr auto',
    sm: 'auto 1fr auto',
    md: 'auto 1fr auto',
  },
};

// Utility functions for responsive design
export const responsiveUtils = {
  // Get responsive value based on breakpoint
  getValue: (values: any, breakpoint: keyof typeof breakpoints) => {
    return values[breakpoint] || values.xs || values;
  },

  // Create responsive object
  create: (xs: any, sm?: any, md?: any, lg?: any, xl?: any) => {
    return { xs, ...(sm && { sm }), ...(md && { md }), ...(lg && { lg }), ...(xl && { xl }) };
  },

  // Hide element on specific breakpoints
  hide: {
    xs: { display: { xs: 'none', sm: 'block' } },
    sm: { display: { xs: 'block', sm: 'none', md: 'block' } },
    md: { display: { xs: 'block', md: 'none', lg: 'block' } },
    lg: { display: { xs: 'block', lg: 'none' } },
  },

  // Show element only on specific breakpoints
  show: {
    xs: { display: { xs: 'block', sm: 'none' } },
    sm: { display: { xs: 'none', sm: 'block', md: 'none' } },
    md: { display: { xs: 'none', md: 'block', lg: 'none' } },
    lg: { display: { xs: 'none', lg: 'block' } },
  },
};

export default responsive;
