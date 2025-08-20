#!/usr/bin/env node

const axios = require('axios');

const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';

console.log('🔍 Debugging what data we\'re actually sending to server...\n');

async function debugMigrationData() {
  try {
    console.log('Step 1: Getting WordPress post...');
    
    const response = await axios.get(`${WORDPRESS_API}/posts?per_page=1`);
    const posts = response.data;
    const post = posts[0];
    
    console.log('Raw WordPress post structure:');
    console.log('- Post ID:', post.id);
    console.log('- Title structure:', typeof post.title, post.title);
    console.log('- Content structure:', typeof post.content, !!post.content);
    console.log('- Content.rendered exists:', !!post.content?.rendered);
    console.log('- Content.rendered length:', post.content?.rendered?.length || 0);
    console.log('- Author:', post.author);
    
    console.log('\nStep 2: Processing like our migration script...');
    
    // Process exactly like our migration script
    const processedPost = {
      id: post.id,
      title: post.title?.rendered || post.title,
      content: post.content?.rendered || '',
      excerpt: post.excerpt?.rendered || post.excerpt || '',
      slug: post.slug || '',
      date: post.date,
      modified: post.modified,
      author: post.author,
      author_name: 'Unknown Author', // This would be set by embedded processing
      status: post.status,
      featured_media: post.featured_media || null,
      categories: post.categories || []
    };
    
    console.log('Processed post data:');
    console.log('- Title:', processedPost.title);
    console.log('- Content length:', processedPost.content.length);
    console.log('- Content preview:', processedPost.content.slice(0, 100) + '...');
    console.log('- Has category links:', processedPost.content.includes('/category/'));
    
    console.log('\nStep 3: Data that would be sent to server:');
    const payload = { posts: [processedPost] };
    console.log('Payload structure:', Object.keys(payload));
    console.log('Post keys:', Object.keys(payload.posts[0]));
    console.log('Content field value:', payload.posts[0].content.slice(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugMigrationData();