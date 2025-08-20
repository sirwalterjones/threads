#!/usr/bin/env node

const axios = require('axios');

const VERCEL_API_BASE = 'https://threads-4zk0b8gwu-walter-jones-projects.vercel.app/api';
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NTU1NjUwMDQsImV4cCI6MTc1NTY1MTQwNH0.Y2oFC36ZqBh3uomWr91U7qo2GjwpRsY_F14tkYLlqOY';

console.log('🔍 Debugging post content for category links...\n');

async function debugPostContent() {
  try {
    const response = await axios.get(`${VERCEL_API_BASE}/posts?limit=10`, {
      headers: { 'Authorization': `Bearer ${JWT_TOKEN}` }
    });
    
    const posts = response.data.posts || response.data;
    
    console.log(`Checking ${posts.length} sample posts for category content:\n`);
    
    posts.forEach((post, index) => {
      console.log(`--- POST ${index + 1} ---`);
      console.log(`Title: ${post.title}`);
      console.log(`Author: ${post.author_name}`);
      console.log(`Has content: ${post.content ? 'Yes' : 'No'}`);
      
      if (post.content) {
        const hasCategories = post.content.includes('/category/');
        console.log(`Contains category links: ${hasCategories ? 'Yes' : 'No'}`);
        
        if (hasCategories) {
          const categoryMatches = post.content.match(/\/category\/([^\/\s"]+)/g);
          console.log(`Category links found: ${categoryMatches}`);
        }
      }
      
      console.log(`Content preview: ${post.content ? post.content.slice(0, 200) + '...' : 'No content'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugPostContent();