jQuery(document).ready(function($) {
    'use strict';

    // Refresh status every 30 seconds
    setInterval(refreshStatus, 30000);

    // Initial load
    refreshStatus();
    loadLogs();
    loadCronStatus();

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
            error: function(xhr, status, error) {
                console.error('Manual sync error:', {xhr: xhr, status: status, error: error});
                alert('Failed to trigger sync. Error: ' + error);
            },
            complete: function() {
                $btn.prop('disabled', false).text('Trigger Manual Sync');
            }
        });
    });

    // Test connection button
    $('#test-connection').on('click', function() {
        var $btn = $(this);
        $btn.prop('disabled', true).text('Testing...');

        $.ajax({
            url: threadsIntel.ajaxUrl,
            type: 'POST',
            data: {
                action: 'threads_intel_test_connection',
                nonce: threadsIntel.nonce
            },
            success: function(response) {
                if (response.success) {
                    alert('Connection test successful!');
                } else {
                    alert('Connection test failed: ' + (response.data || 'Unknown error'));
                }
            },
            error: function(xhr, status, error) {
                console.error('Connection test error:', {xhr: xhr, status: status, error: error});
                alert('Connection test failed. Error: ' + error);
            },
            complete: function() {
                $btn.prop('disabled', false).text('Test Connection');
            }
        });
    });

    // Refresh status button
    $('#refresh-status').on('click', function() {
        refreshStatus();
        loadLogs();
        loadCronStatus();
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
                } else {
                    $('#sync-status').html('<p style="color: red;">Failed to load status: ' + (response.data || 'Unknown error') + '</p>');
                }
            },
            error: function(xhr, status, error) {
                console.error('Status refresh error:', {xhr: xhr, status: status, error: error});
                $('#sync-status').html('<p style="color: red;">Failed to load status. Error: ' + error + '</p>');
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
        statusHtml += '<tr><td><strong>Debug Mode:</strong></td><td>' + (data.debug_mode ? 'Enabled' : 'Disabled') + '</td></tr>';
        statusHtml += '</table>';

        $('#sync-status').html(statusHtml);
    }

    function loadLogs() {
        $.ajax({
            url: threadsIntel.ajaxUrl,
            type: 'POST',
            data: {
                action: 'threads_intel_get_status',
                nonce: threadsIntel.nonce
            },
            success: function(response) {
                if (response.success && response.data.recent_logs) {
                    updateLogs(response.data.recent_logs);
                } else {
                    $('#sync-logs').html('<p style="color: orange;">No recent logs available</p>');
                }
            },
            error: function(xhr, status, error) {
                console.error('Logs load error:', {xhr: xhr, status: status, error: error});
                $('#sync-logs').html('<p style="color: red;">Failed to load logs. Error: ' + error + '</p>');
            }
        });
    }

    function updateLogs(logs) {
        if (!logs || logs.length === 0) {
            $('#sync-logs').html('<p style="color: orange;">No recent sync logs found</p>');
            return;
        }

        var logsHtml = '<table class="widefat">';
        logsHtml += '<thead><tr><th>Timestamp</th><th>Message</th><th>User ID</th></tr></thead><tbody>';
        
        logs.forEach(function(log) {
            logsHtml += '<tr>';
            logsHtml += '<td>' + (log.timestamp || 'Unknown') + '</td>';
            logsHtml += '<td>' + (log.message || 'No message') + '</td>';
            logsHtml += '<td>' + (log.user_id || 'System') + '</td>';
            logsHtml += '</tr>';
        });
        
        logsHtml += '</tbody></table>';
        $('#sync-logs').html(logsHtml);
    }

    function loadCronStatus() {
        // Get WordPress cron status
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'wp_ajax_get_cron_status',
                nonce: threadsIntel.nonce
            },
            success: function(response) {
                if (response.success) {
                    updateCronStatus(response.data);
                } else {
                    $('#cron-status').html('<p style="color: orange;">Cron status not available</p>');
                }
            },
            error: function() {
                // Fallback: show basic cron info
                $('#cron-status').html('<p style="color: orange;">Cron status not available. Check WordPress Tools → Site Health → Info → Cron Events</p>');
            }
        });
    }

    function updateCronStatus(cronData) {
        var cronHtml = '<table class="widefat">';
        cronHtml += '<tr><td><strong>WP Cron Status:</strong></td><td>' + (cronData.disabled ? 'Disabled' : 'Enabled') + '</td></tr>';
        cronHtml += '<tr><td><strong>Next Scheduled Sync:</strong></td><td>' + (cronData.next_sync || 'Not scheduled') + '</td></tr>';
        cronHtml += '<tr><td><strong>Last Cron Run:</strong></td><td>' + (cronData.last_run || 'Unknown') + '</td></tr>';
        cronHtml += '</table>';
        
        $('#cron-status').html(cronHtml);
    }

    // Add some debugging info
    console.log('Threads Intel Debug Admin loaded');
    console.log('AJAX URL:', threadsIntel.ajaxUrl);
    console.log('Nonce:', threadsIntel.nonce);
});

