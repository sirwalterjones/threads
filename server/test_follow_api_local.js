const axios = require('axios');

// Test the follow API endpoints locally
async function testFollowAPILocal() {
  try {
    console.log('Testing follow API endpoints locally...');
    
    // Test the follow status endpoint
    console.log('\n1. Testing follow status endpoint...');
    try {
      const statusResponse = await axios.post('http://localhost:3001/api/posts/follow-status', {
        postIds: [1, 2, 3]
      }, {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE',
          'Content-Type': 'application/json'
        }
      });
      console.log('Follow status response:', statusResponse.data);
    } catch (error) {
      console.error('Follow status error:', error.response?.data || error.message);
    }
    
    // Test the follow post endpoint
    console.log('\n2. Testing follow post endpoint...');
    try {
      const followResponse = await axios.post('http://localhost:3001/api/posts/1/follow', {}, {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE',
          'Content-Type': 'application/json'
        }
      });
      console.log('Follow post response:', followResponse.data);
    } catch (error) {
      console.error('Follow post error:', error.response?.data || error.message);
    }
    
    // Test the unfollow post endpoint
    console.log('\n3. Testing unfollow post endpoint...');
    try {
      const unfollowResponse = await axios.delete('http://localhost:3001/api/posts/1/follow', {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
        }
      });
      console.log('Unfollow post response:', unfollowResponse.data);
    } catch (error) {
      console.error('Unfollow post error:', error.response?.data || error.message);
    }
    
    // Test the following posts endpoint
    console.log('\n4. Testing following posts endpoint...');
    try {
      const followingResponse = await axios.get('http://localhost:3001/api/posts/following?page=1&limit=5', {
        headers: {
          'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
        }
      });
      console.log('Following posts response:', followingResponse.data);
    } catch (error) {
      console.error('Following posts error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

console.log('To use this script:');
console.log('1. Start your local server: npm run dev');
console.log('2. Get your JWT token from the browser (localStorage.getItem("token"))');
console.log('3. Replace YOUR_JWT_TOKEN_HERE with your actual token');
console.log('4. Run: node test_follow_api_local.js');

testFollowAPILocal();
