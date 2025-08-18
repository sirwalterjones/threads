# Vercel Deployment Guide

This application is now configured for deployment on Vercel. Follow these steps to deploy:

## Prerequisites
1. Install Vercel CLI: `npm i -g vercel`
2. Have a Vercel account at [vercel.com](https://vercel.com)

## Deployment Steps

### 1. Login to Vercel
```bash
vercel login
```

### 2. Set Environment Variables
In your Vercel dashboard or via CLI, set these environment variables:

**Required:**
- `JWT_SECRET` - A secure random string for JWT token signing
- `NODE_ENV` - Set to "production"

**WordPress Integration (if using):**
- `WORDPRESS_API_URL` - Your WordPress site's REST API URL
- `WORDPRESS_USERNAME` - WordPress username for API access
- `WORDPRESS_PASSWORD` - WordPress application password

**Optional:**
- `DATABASE_URL` - External database URL (SQLite used by default)
- `RATE_LIMIT_WINDOW_MS` - Rate limiting window (default: 900000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

### 3. Deploy
```bash
vercel --prod
```

## Configuration Files

The following files have been configured for Vercel:

- `vercel.json` - Main Vercel configuration
- `package.json` - Updated with `vercel-build` script
- `.env.example` - Updated with Vercel environment variables
- `server/index.js` - Updated CORS configuration for Vercel domains

## Database Considerations

The app uses SQLite by default, which works on Vercel but has limitations:
- SQLite files are ephemeral on Vercel (reset on each deployment)
- For persistent data, consider using:
  - Vercel Postgres
  - PlanetScale
  - Supabase
  - Any PostgreSQL-compatible database

## Custom Domain

After deployment, you can add a custom domain in your Vercel dashboard and update the CORS configuration in `server/index.js` if needed.

## Troubleshooting

1. **Build failures**: Check that all dependencies are listed in `package.json`
2. **CORS errors**: Update the origin array in `server/index.js`
3. **Database issues**: Ensure DATABASE_URL is set if using external database
4. **Environment variables**: Verify all required env vars are set in Vercel dashboard

## Local Testing

Test the production build locally:
```bash
npm run build
npm start
```