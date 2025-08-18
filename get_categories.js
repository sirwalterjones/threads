const axios = require('axios');

async function tryGetCategories() {
  const baseUrl = 'https://cmansrms.us/wp-json/wp/v2';
  
  const attempts = [
    // Standard request
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    },
    // Mobile user agent
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
      }
    },
    // Curl-like
    {
      headers: {
        'User-Agent': 'curl/7.68.0',
        'Accept': 'application/json'
      }
    },
    // WordPress specific
    {
      headers: {
        'User-Agent': 'WordPress/6.0; https://example.com',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      console.log(`Attempt ${i + 1}: Trying with ${JSON.stringify(attempts[i].headers['User-Agent'])}`);
      
      const response = await axios.get(`${baseUrl}/categories`, {
        ...attempts[i],
        params: { per_page: 100, page: 1 },
        timeout: 10000
      });
      
      console.log(`Success! Found ${response.data.length} categories`);
      console.log('Categories:');
      response.data.forEach(cat => {
        console.log(`- ID: ${cat.id}, Name: ${cat.name}, Slug: ${cat.slug}, Count: ${cat.count}`);
      });
      return response.data;
      
    } catch (error) {
      console.log(`Attempt ${i + 1} failed: ${error.response?.status || error.code} - ${error.response?.statusText || error.message}`);
      
      if (i < attempts.length - 1) {
        console.log('Waiting 2 seconds before next attempt...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  console.log('All attempts failed. The site appears to be blocking all requests.');
  return null;
}

// Try alternative endpoints
async function tryAlternativeEndpoints() {
  const endpoints = [
    '/categories',
    '/posts/categories',
    '/wp/v2/categories',
    '/../categories'  // Sometimes works with path traversal
  ];
  
  const baseUrl = 'https://cmansrms.us/wp-json/wp/v2';
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\nTrying endpoint: ${endpoint}`);
      const response = await axios.get(`${baseUrl}${endpoint}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });
      
      console.log(`Success with ${endpoint}!`);
      return response.data;
    } catch (error) {
      console.log(`Failed ${endpoint}: ${error.response?.status || error.code}`);
    }
  }
  
  return null;
}

async function main() {
  console.log('=== Attempting to get WordPress categories ===\n');
  
  let categories = await tryGetCategories();
  
  if (!categories) {
    console.log('\n=== Trying alternative endpoints ===');
    categories = await tryAlternativeEndpoints();
  }
  
  if (!categories) {
    console.log('\n=== All methods failed ===');
    console.log('The WordPress site is blocking all access attempts.');
    console.log('This is likely due to a security plugin or firewall.');
  }
}

main().catch(console.error);