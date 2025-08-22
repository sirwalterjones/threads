jQuery(document).ready(function($) {
    // Test endpoints
    $('#test-status').on('click', function() {
        testEndpoint('status');
    });
    
    $('#test-posts').on('click', function() {
        testEndpoint('posts');
    });
    
    $('#test-categories').on('click', function() {
        testEndpoint('categories');
    });
    
    function testEndpoint(endpoint) {
        const button = $(`#test-${endpoint}`);
        const originalText = button.text();
        
        button.prop('disabled', true).text('Testing...');
        
        const siteUrl = window.location.origin;
        const url = `${siteUrl}/wp-json/threads-intel/v1/${endpoint}`;
        
        $.ajax({
            url: url,
            method: 'GET',
            timeout: 10000,
            success: function(response) {
                $('#test-results').html(`
                    <div class="notice notice-success">
                        <p><strong>✅ ${endpoint.toUpperCase()} endpoint working!</strong></p>
                        <p><strong>URL:</strong> <code>${url}</code></p>
                        <p><strong>Response:</strong></p>
                        <pre>${JSON.stringify(response, null, 2)}</pre>
                    </div>
                `);
            },
            error: function(xhr, status, error) {
                $('#test-results').html(`
                    <div class="notice notice-error">
                        <p><strong>❌ ${endpoint.toUpperCase()} endpoint failed!</strong></p>
                        <p><strong>URL:</strong> <code>${url}</code></p>
                        <p><strong>Status:</strong> ${xhr.status} ${xhr.statusText}</p>
                        <p><strong>Error:</strong> ${error}</p>
                        <p><strong>Response:</strong></p>
                        <pre>${xhr.responseText}</pre>
                    </div>
                `);
            },
            complete: function() {
                button.prop('disabled', false).text(originalText);
            }
        });
    }
    
    // Auto-test status endpoint on page load
    setTimeout(function() {
        $('#test-status').click();
    }, 1000);
});
