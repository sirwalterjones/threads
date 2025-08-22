jQuery(document).ready(function($) {
    'use strict';
    
    // Refresh status every 30 seconds
    setInterval(refreshStatus, 30000);
    
    // Initial load
    refreshStatus();
    loadLogs();
    
    // Manual sync button
    $('#manual-sync').on('click', function() {
        var $btn = $(this);
        $btn.prop('disabled', true).text('Triggering Sync...');
        
        $.ajax({
            url: threadsIntel.ajaxUrl,
            type: 'POST',
            data: {
                action: 'threads_intel_enhanced_sync',
                nonce: threadsIntel.nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('Manual sync triggered successfully!');
                    refreshStatus();
                    loadLogs();
                } else {
                    alert('Failed to trigger sync: ' + (response.data || 'Unknown error'));
                }
            },
            error: function() {
                alert('Failed to trigger sync. Please try again.');
            },
            complete: function() {
                $btn.prop('disabled', false).text('Trigger Manual Sync');
            }
        });
    });
    
    // Refresh status button
    $('#refresh-status').on('click', function() {
        refreshStatus();
        loadLogs();
    });
    
    function refreshStatus() {
        $.ajax({
            url: threadsIntel.ajaxUrl,
            type: 'POST',
            data: {
                action: 'threads_intel_get_status',
                nonce: threadsIntel.nonce
            },
            success: function(response) {
                if (response.success) {
                    updateStatus(response.data);
                }
            },
            error: function() {
                $('#sync-status').html('<p style="color: red;">Failed to load status</p>');
            }
        });
    }
    
    function updateStatus(data) {
        var statusHtml = '<table class="widefat">';
        statusHtml += '<tr><td><strong>Last Sync:</strong></td><td>' + (data.last_sync || 'Never') + '</td></tr>';
        statusHtml += '<tr><td><strong>Sync Attempts:</strong></td><td>' + data.sync_attempts + '</td></tr>';
        statusHtml += '<tr><td><strong>Currently Running:</strong></td><td>' + (data.is_running ? 'Yes' : 'No') + '</td></tr>';
        statusHtml += '<tr><td><strong>Next Scheduled:</strong></td><td>' + (data.next_scheduled ? new Date(data.next_scheduled * 1000).toLocaleString() : 'Not scheduled') + '</td></tr>';
        statusHtml += '<tr><td><strong>WP Cron Disabled:</strong></td><td>' + (data.cron_disabled ? 'Yes (This may cause sync issues)' : 'No') + '</td></tr>';
        statusHtml += '</table>';
        
        $('#sync-status').html(statusHtml);
    }
    
    function loadLogs() {
        // For now, we'll just show a message since logs are stored in WordPress options
        $('#sync-logs').html('<p>Recent sync logs are stored in WordPress options. Check the WordPress error log for detailed information.</p>');
    }
});
