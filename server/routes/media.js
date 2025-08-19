const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();

// Proxy remote WordPress media through our server with Basic/JWT auth
// Accept JWT via Authorization header or token query param since <img>/<video> cannot set headers
router.get('/', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : (typeof req.query.t === 'string' ? req.query.t : null);
    const token = headerToken || queryToken;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(403).json({ error: 'Invalid token' });
    }

    const userResult = await pool.query('SELECT id, role, is_active FROM users WHERE id = ?', [decoded.userId]);
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      return res.status(403).json({ error: 'Invalid or inactive user' });
    }

    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    // Support relative paths like /wp-content/uploads/...
    const siteUrl = process.env.WORDPRESS_SITE_URL || (process.env.WORDPRESS_API_URL ? new URL(process.env.WORDPRESS_API_URL).origin : '');
    let absoluteUrl = url;
    if (typeof absoluteUrl === 'string' && absoluteUrl.startsWith('/')) {
      if (!siteUrl) return res.status(400).json({ error: 'Cannot resolve relative URL without WORDPRESS_SITE_URL' });
      absoluteUrl = new URL(absoluteUrl, siteUrl).toString();
    }

    let target;
    try {
      target = new URL(absoluteUrl);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Restrict to the WordPress host
    const allowedHosts = new Set();
    const apiBase = process.env.WORDPRESS_API_URL || '';
    if (apiBase) allowedHosts.add(new URL(apiBase).host);
    if (process.env.WORDPRESS_SITE_URL) {
      try { allowedHosts.add(new URL(process.env.WORDPRESS_SITE_URL).host); } catch {}
    }
    if (process.env.WORDPRESS_ALLOWED_MEDIA_HOSTS) {
      process.env.WORDPRESS_ALLOWED_MEDIA_HOSTS.split(',').map(h => h.trim()).filter(Boolean).forEach(h => {
        try { allowedHosts.add(new URL(h).host); } catch { allowedHosts.add(h); }
      });
    }
    if (!allowedHosts.has(target.host)) {
      return res.status(403).json({ error: 'URL not allowed' });
    }

    const client = axios.create({
      timeout: 20000,
      responseType: 'stream',
      headers: {
        'User-Agent': process.env.WORDPRESS_USER_AGENT || 'Mozilla/5.0',
        'Accept': '*/*'
      }
    });

    if (process.env.WORDPRESS_BASIC_USER && process.env.WORDPRESS_BASIC_PASS) {
      client.defaults.auth = {
        username: process.env.WORDPRESS_BASIC_USER,
        password: process.env.WORDPRESS_BASIC_PASS
      };
    }
    if (process.env.WORDPRESS_JWT_TOKEN) {
      client.defaults.headers.Authorization = `Bearer ${process.env.WORDPRESS_JWT_TOKEN}`;
    }

    const fetchWithFallbacks = async () => {
      const tried = new Set();
      const candidates = [];
      const originalUrl = target.toString();
      candidates.push(originalUrl);

      // If http, also try https
      if (target.protocol === 'http:') {
        try {
          const httpsUrl = new URL(originalUrl);
          httpsUrl.protocol = 'https:';
          candidates.push(httpsUrl.toString());
        } catch {}
      }

      // If WordPress size suffix (e.g., -300x300) exists before extension, try stripping it
      try {
        const m = target.pathname.match(/-(\d+)x(\d+)(?=\.[a-z0-9]+($|[?#]))/i);
        if (m) {
          const strippedPath = target.pathname.replace(/-(\d+)x(\d+)(?=\.[a-z0-9]+($|[?#]))/i, '');
          const u = new URL(originalUrl);
          u.pathname = strippedPath;
          candidates.push(u.toString());
        }
      } catch {}

      // Try each candidate until one succeeds
      for (const u of candidates) {
        if (tried.has(u)) continue;
        tried.add(u);
        try {
          const uOrigin = (() => { try { return new URL(u).origin; } catch { return (process.env.WORDPRESS_SITE_URL ? new URL(process.env.WORDPRESS_SITE_URL).origin : undefined); } })();
          const headers = {};
          if (req.headers.range) headers['Range'] = req.headers.range;
          if (uOrigin) {
            // Only set Referer if it's a valid URL to avoid header errors
            const refererUrl = process.env.WORDPRESS_REFERER || uOrigin;
            try {
              new URL(refererUrl); // Validate URL
              headers['Referer'] = refererUrl;
            } catch (e) {
              console.warn('Invalid Referer URL, skipping:', refererUrl);
            }
            headers['Origin'] = uOrigin;
          }
          // Prefer inline rendering in some upstreams
          const lower = (new URL(u)).pathname.toLowerCase();
          if (lower.endsWith('.pdf')) headers['Accept'] = 'application/pdf,*/*';
          if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp)$/i.test(lower)) headers['Accept'] = 'image/*,*/*';
          const resp = await client.get(u, { headers });
          return { resp, usedUrl: u };
        } catch (e) {
          if (e?.response?.status && e.response.status !== 404) {
            console.error(`Media proxy upstream error ${e.response.status} for ${u}`);
            throw e; // non-404 errors propagate
          }
          // else, try next candidate
        }
      }
      // If all candidates failed, throw last
      throw Object.assign(new Error('Upstream not found'), { status: 404 });
    };

    const { resp: upstream, usedUrl } = await fetchWithFallbacks();

    // Forward content headers
    let contentType = upstream.headers['content-type'];
    if (!contentType || /octet-stream/i.test(String(contentType))) {
      const pathname = target.pathname || '';
      const lower = pathname.toLowerCase();
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (lower.endsWith('.png')) contentType = 'image/png';
      else if (lower.endsWith('.gif')) contentType = 'image/gif';
      else if (lower.endsWith('.webp')) contentType = 'image/webp';
      else if (lower.endsWith('.bmp')) contentType = 'image/bmp';
      else if (lower.endsWith('.pdf')) contentType = 'application/pdf';
      else if (lower.endsWith('.mp4')) contentType = 'video/mp4';
      else if (lower.endsWith('.mov')) contentType = 'video/quicktime';
      else if (lower.endsWith('.webm')) contentType = 'video/webm';
      else if (lower.endsWith('.mp3')) contentType = 'audio/mpeg';
      else if (lower.endsWith('.wav')) contentType = 'audio/wav';
      else if (lower.endsWith('.m4a') || lower.endsWith('.aac')) contentType = 'audio/mp4';
    }
    if (contentType) {
      res.set('Content-Type', contentType);
    }
    if (upstream.headers['content-length']) {
      res.set('Content-Length', upstream.headers['content-length']);
    }
    if (upstream.headers['accept-ranges']) {
      res.set('Accept-Ranges', upstream.headers['accept-ranges']);
    }
    if (upstream.headers['content-range']) {
      res.set('Content-Range', upstream.headers['content-range']);
    }
    // Force inline rendering to avoid download prompts for images/PDF/video/audio
    const contentDisposition = upstream.headers['content-disposition'];
    if (contentDisposition) {
      res.set('Content-Disposition', contentDisposition.replace(/attachment/i, 'inline'));
    } else {
      res.set('Content-Disposition', 'inline');
    }
    if (upstream.headers['cache-control']) {
      res.set('Cache-Control', upstream.headers['cache-control']);
    } else {
      res.set('Cache-Control', 'public, max-age=3600');
    }

    res.status(upstream.status || 200);
    upstream.data.pipe(res);
  } catch (error) {
    const status = error.response?.status || 502;
    console.error('Media proxy failure:', status, error.message);
    res.status(status).json({ error: 'Failed to fetch media' });
  }
});

module.exports = router;


