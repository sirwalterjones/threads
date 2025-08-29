const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testPDFExport() {
  try {
    console.log('Testing PDF Export Feature...\n');
    
    // Login to get token
    console.log('1. Logging in...');
    const loginResponse = await axios.post('https://cso.vectoronline.us/api/auth/login', {
      username: 'admin',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.token;
    console.log('✓ Login successful\n');
    
    // Get recent posts
    console.log('2. Fetching posts...');
    const postsResponse = await axios.get('https://cso.vectoronline.us/api/posts', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const posts = postsResponse.data.posts.slice(0, 3); // Get first 3 posts
    const postIds = posts.map(p => p.id);
    console.log(`✓ Found ${posts.length} posts to export: ${postIds.join(', ')}\n`);
    
    // Export to PDF
    console.log('3. Generating PDF export...');
    const exportResponse = await axios.post(
      'https://cso.vectoronline.us/api/export/pdf',
      {
        postIds: postIds,
        includeComments: true,
        includeTags: true
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );
    
    // Save PDF to file
    const pdfPath = path.join(__dirname, `test-export-${Date.now()}.pdf`);
    fs.writeFileSync(pdfPath, exportResponse.data);
    console.log(`✓ PDF saved to: ${pdfPath}`);
    console.log(`✓ File size: ${(exportResponse.data.length / 1024).toFixed(2)} KB\n`);
    
    // Check export history
    console.log('4. Checking export history...');
    const historyResponse = await axios.get('https://cso.vectoronline.us/api/export/history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const latestExport = historyResponse.data[0];
    console.log('✓ Latest export record:');
    console.log(`  - Type: ${latestExport.export_type}`);
    console.log(`  - Posts: ${latestExport.post_count}`);
    console.log(`  - Size: ${(latestExport.file_size / 1024).toFixed(2)} KB`);
    console.log(`  - Status: ${latestExport.status}`);
    console.log(`  - Date: ${new Date(latestExport.export_date).toLocaleString()}\n`);
    
    // Get export stats
    console.log('5. Getting export statistics...');
    const statsResponse = await axios.get('https://cso.vectoronline.us/api/export/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ Export Statistics:');
    console.log(`  - Total exports: ${statsResponse.data.total_exports}`);
    console.log(`  - Total posts exported: ${statsResponse.data.total_posts_exported}`);
    console.log(`  - Total size: ${(statsResponse.data.total_file_size / 1024).toFixed(2)} KB`);
    
    console.log('\n✅ PDF Export test completed successfully!');
    console.log(`\nYou can view the exported PDF at: ${pdfPath}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

// Run the test
testPDFExport();