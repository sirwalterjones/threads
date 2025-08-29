const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class PDFGenerator {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async generatePostsPDF(posts, user, options = {}) {
    await this.initialize();
    
    const page = await this.browser.newPage();
    
    try {
      // Create HTML content with Vector branding
      const htmlContent = this.createHTMLContent(posts, user, options);
      
      // Set content and wait for any images to load
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF with custom settings
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        margin: {
          top: '0.75in',
          right: '0.5in',
          bottom: '0.75in',
          left: '0.5in'
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: this.getHeaderTemplate(),
        footerTemplate: this.getFooterTemplate()
      });
      
      await page.close();
      
      return pdfBuffer;
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  createHTMLContent(posts, user, options) {
    const includeComments = options.includeComments !== false;
    const includeTags = options.includeTags !== false;
    
    const postsHTML = posts.map(post => {
      const tagsHTML = includeTags && post.tags && post.tags.length > 0
        ? `<div class="tags">${post.tags.map(tag => `<span class="tag">${tag}</span>`).join(' ')}</div>`
        : '';
      
      const commentsHTML = includeComments && post.comments && post.comments.length > 0
        ? `
          <div class="comments">
            <h4>Comments (${post.comments.length})</h4>
            ${post.comments.map(comment => `
              <div class="comment">
                <div class="comment-header">
                  <strong>${comment.author_name || 'Anonymous'}</strong>
                  <span class="comment-date">${new Date(comment.created_at).toLocaleDateString()}</span>
                </div>
                <div class="comment-content">${comment.content}</div>
              </div>
            `).join('')}
          </div>`
        : '';
      
      return `
        <div class="post">
          <h2>${post.title}</h2>
          <div class="post-meta">
            <span class="author">${post.author_name || user.username}</span>
            <span class="date">${new Date(post.created_at).toLocaleDateString()}</span>
            ${post.likes_count ? `<span class="likes">❤️ ${post.likes_count}</span>` : ''}
          </div>
          ${tagsHTML}
          <div class="post-content">${post.content}</div>
          ${commentsHTML}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Vector Threads Export</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #1a1a1a;
            line-height: 1.6;
            background: white;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            margin-bottom: 2rem;
            text-align: center;
            border-radius: 8px;
          }
          
          .header h1 {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            letter-spacing: -0.02em;
          }
          
          .header .subtitle {
            font-size: 0.9rem;
            opacity: 0.9;
          }
          
          .export-info {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 1rem;
            margin-bottom: 2rem;
            border-radius: 4px;
          }
          
          .export-info p {
            margin: 0.25rem 0;
            font-size: 0.9rem;
            color: #495057;
          }
          
          .post {
            margin-bottom: 2.5rem;
            padding-bottom: 2rem;
            border-bottom: 1px solid #e9ecef;
            page-break-inside: avoid;
          }
          
          .post:last-child {
            border-bottom: none;
          }
          
          .post h2 {
            color: #2d3748;
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 0.75rem;
            line-height: 1.3;
          }
          
          .post-meta {
            display: flex;
            gap: 1rem;
            font-size: 0.85rem;
            color: #6c757d;
            margin-bottom: 1rem;
          }
          
          .post-meta .author {
            font-weight: 500;
            color: #667eea;
          }
          
          .tags {
            margin-bottom: 1rem;
          }
          
          .tag {
            display: inline-block;
            background: #e7f3ff;
            color: #0066cc;
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.8rem;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
          }
          
          .post-content {
            font-size: 0.95rem;
            line-height: 1.8;
            color: #343a40;
            white-space: pre-wrap;
            word-wrap: break-word;
          }
          
          .comments {
            margin-top: 1.5rem;
            padding-top: 1rem;
            border-top: 1px solid #e9ecef;
          }
          
          .comments h4 {
            color: #495057;
            font-size: 1rem;
            margin-bottom: 1rem;
          }
          
          .comment {
            background: #f8f9fa;
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 0.75rem;
          }
          
          .comment-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            font-size: 0.85rem;
          }
          
          .comment-header strong {
            color: #495057;
          }
          
          .comment-date {
            color: #868e96;
          }
          
          .comment-content {
            font-size: 0.9rem;
            color: #495057;
            line-height: 1.6;
          }
          
          .watermark {
            position: fixed;
            bottom: 10px;
            right: 10px;
            opacity: 0.1;
            font-size: 3rem;
            font-weight: bold;
            transform: rotate(-45deg);
            color: #667eea;
            z-index: -1;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Vector Threads</h1>
          <div class="subtitle">Knowledge Sharing Platform</div>
        </div>
        
        <div class="export-info">
          <p><strong>Exported by:</strong> ${user.username}</p>
          <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Posts:</strong> ${posts.length}</p>
          ${options.dateRange ? `<p><strong>Date Range:</strong> ${options.dateRange}</p>` : ''}
        </div>
        
        ${postsHTML}
        
        <div class="watermark">VECTOR</div>
      </body>
      </html>
    `;
  }

  getHeaderTemplate() {
    return `
      <div style="width: 100%; font-size: 10px; padding: 5px 20px; color: #667eea;">
        <span>Vector Threads Export</span>
      </div>
    `;
  }

  getFooterTemplate() {
    return `
      <div style="width: 100%; font-size: 10px; padding: 5px 20px; display: flex; justify-content: space-between; color: #6c757d;">
        <span>© ${new Date().getFullYear()} Vector Online</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new PDFGenerator();