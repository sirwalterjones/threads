#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-fp5c1p1ql-walter-jones-projects.vercel.app/api';
const WORDPRESS_API = 'https://cmansrms.us/wp-json/wp/v2';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔍 Deep debugging content migration issue...\n');

async function debugContentIssue() {
  try {
    console.log('Step 1: Get ONE WordPress post with known content...');
    
    const wpResponse = await axios.get(`${WORDPRESS_API}/posts/160026`); // Specific post with content
    const post = wpResponse.data;
    
    console.log('WordPress Post Details:');
    console.log('- ID:', post.id);
    console.log('- Title type:', typeof post.title);
    console.log('- Title value:', post.title);
    console.log('- Content type:', typeof post.content);
    console.log('- Content.rendered exists:', !!post.content?.rendered);
    console.log('- Content.rendered length:', post.content?.rendered?.length || 0);
    console.log('- Content.rendered preview:', post.content?.rendered?.slice(0, 100) || 'None');
    
    console.log('\nStep 2: Create payload exactly like our client sends...');
    
    const payload = {
      posts: [{
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt,
        slug: post.slug,
        date: post.date,
        modified: post.modified,
        author: post.author,
        author_name: 'Test Author',
        status: post.status,
        featured_media: post.featured_media,
        categories: post.categories
      }]
    };
    
    console.log('Payload content field:');
    console.log('- Type:', typeof payload.posts[0].content);
    console.log('- Has rendered:', !!payload.posts[0].content?.rendered);
    console.log('- Rendered length:', payload.posts[0].content?.rendered?.length || 0);
    console.log('- Direct content:', payload.posts[0].content === post.content ? 'Same reference' : 'Different');
    
    console.log('\nStep 3: Send to server and check what happens...');
    
    const uploadResponse = await axios.post(
      `${VERCEL_API_BASE}/admin/insert-batch-data`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${JWT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Server response:', uploadResponse.data);
    
    console.log('\nStep 4: Check what got stored...');
    
    const storedResponse = await axios.get(`${VERCEL_API_BASE}/posts/${post.id}`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    if (storedResponse.data) {
      const stored = storedResponse.data;
      console.log('Stored post:');
      console.log('- Title:', stored.title);
      console.log('- Content length:', stored.content?.length || 0);
      console.log('- Content type:', typeof stored.content);
      console.log('- Content preview:', stored.content?.slice(0, 100) || 'None');
      console.log('- Author:', stored.author_name);
    } else {
      console.log('❌ Could not retrieve stored post');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugContentIssue();