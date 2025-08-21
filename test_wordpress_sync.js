#!/usr/bin/env node

/**
 * Test script to validate WordPress sync functionality
 * This simulates the WordPress plugin behavior to diagnose sync issues
 */

const https = require('https');

const API_BASE = 'https://cso.vectoronline.us/api';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123456';

// Test timeout settings
const AUTH_TIMEOUT = 60000; // 60 seconds
const SYNC_TIMEOUT = 180000; // 3 minutes

async function makeRequest(path, method = 'GET', data = null, authToken = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_BASE + path);
        
        const options = {
            hostname: url.hostname,
            port: url.port || 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'WordPress-Plugin-Test/1.0'
            },
            timeout: method === 'POST' && path.includes('ingest') ? SYNC_TIMEOUT : AUTH_TIMEOUT,
            rejectUnauthorized: false // Similar to sslverify: false
        };
        
        if (authToken) {
            options.headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        const req = https.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedBody = JSON.parse(body);
                    resolve({
                        statusCode: res.statusCode,
                        body: parsedBody,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        body: body,
                        headers: res.headers
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timed out after ${options.timeout}ms`));
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function authenticate() {
    console.log('🔐 Testing authentication...');
    
    try {
        const response = await makeRequest('/auth/login', 'POST', {
            username: ADMIN_USERNAME,
            password: ADMIN_PASSWORD
        });
        
        if (response.statusCode === 200 && response.body.token) {
            console.log('✅ Authentication successful');
            return response.body.token;
        } else {
            throw new Error(`Auth failed: ${JSON.stringify(response.body)}`);
        }
    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        throw error;
    }
}

async function testDirectIngest(authToken) {
    console.log('📤 Testing direct ingest endpoint...');
    
    const testData = {
        posts: [
            {
                id: 99999,
                title: { rendered: 'WordPress Plugin Test Post' },
                content: { rendered: '<p>This is a test post from the WordPress plugin test script.</p>' },
                excerpt: { rendered: 'Test excerpt' },
                slug: 'test-post-' + Date.now(),
                status: 'publish',
                author: 1,
                author_name: 'Test Author',
                date: new Date().toISOString(),
                modified: new Date().toISOString(),
                categories: [1],
                tags: [],
                featured_media: 0,
                sticky: false,
                format: 'standard'
            }
        ],
        categories: [
            {
                id: 1,
                name: 'Test Category',
                slug: 'test-category',
                parent: 0,
                count: 1,
                description: 'Test category description'
            }
        ],
        timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
        source: 'wordpress_direct_test'
    };
    
    try {
        const response = await makeRequest('/admin/ingest-direct', 'POST', testData, authToken);
        
        if (response.statusCode === 200) {
            console.log('✅ Direct ingest successful:', JSON.stringify(response.body, null, 2));
            return true;
        } else {
            throw new Error(`Ingest failed (${response.statusCode}): ${JSON.stringify(response.body)}`);
        }
    } catch (error) {
        console.error('❌ Direct ingest failed:', error.message);
        throw error;
    }
}

async function runTests() {
    console.log('🧪 Starting WordPress Plugin Sync Tests');
    console.log('=======================================');
    
    try {
        // Test authentication
        const token = await authenticate();
        
        // Test direct ingest
        await testDirectIngest(token);
        
        console.log('');
        console.log('🎉 All tests passed! The WordPress plugin should work now.');
        console.log('');
        console.log('📋 Summary of fixes applied:');
        console.log('   • Increased authentication timeout from 30s to 60s');
        console.log('   • Increased sync timeout from 120s to 180s');
        console.log('   • Added sslverify: false to handle SSL certificate issues');
        console.log('   • Verified API endpoints are responding correctly');
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Upload the updated wordpress-direct-sync.php to your WordPress site');
        console.log('   2. Reactivate the plugin or trigger a manual sync');
        console.log('   3. Check the plugin admin page for sync status');
        
    } catch (error) {
        console.error('');
        console.error('💥 Test failed:', error.message);
        console.error('');
        console.error('🔧 Debugging suggestions:');
        console.error('   • Check if your WordPress server can reach cso.vectoronline.us');
        console.error('   • Verify WordPress allows outbound HTTPS connections');
        console.error('   • Check WordPress error logs for more details');
        process.exit(1);
    }
}

runTests();