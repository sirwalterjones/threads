import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Alert
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { API_BASE_URL } from '../services/api';

interface AttachmentData {
  url: string;
  mime_type?: string | null;
  title?: string | null;
}

interface AttachmentViewerModalProps {
  open: boolean;
  onClose: () => void;
  attachment: AttachmentData | null;
}

const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({ open, onClose, attachment }) => {
  const [pdfError, setPdfError] = useState(false);
  
  // Reset error state when attachment changes
  useEffect(() => {
    setPdfError(false);
  }, [attachment?.url]);
  
  if (!attachment) return null;

  const rawUrl = attachment.url;
  
  // Check if this is our own uploaded file (from /api/files/) or a WordPress file
  const isOwnUploadedFile = rawUrl.includes('/api/files/') || rawUrl.startsWith(`${API_BASE_URL}/files/`);
  
  let finalUrl: string;
  
  if (isOwnUploadedFile) {
    // For our own uploaded files, use the URL directly - no proxy needed
    finalUrl = rawUrl;
  } else {
    // For WordPress/remote files, use the existing proxy logic
    const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
    
    // Handle relative URLs by making them absolute
    let absoluteUrl = rawUrl;
    if (rawUrl.startsWith('/')) {
      absoluteUrl = `${remoteBase}${rawUrl}`;
    } else if (!rawUrl.startsWith('http')) {
      absoluteUrl = `${remoteBase}/${rawUrl}`;
    }
    
    const authToken = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
    const tokenQuery = authToken ? `&t=${encodeURIComponent(authToken)}` : '';
    const proxyUrl = `${API_BASE_URL}/media?url=${encodeURIComponent(absoluteUrl)}${tokenQuery}`;
    
    // For now, use direct URLs for all cmansrms.us content since proxy is having issues
    const shouldUseDirectUrl = absoluteUrl.includes('cmansrms.us');
    finalUrl = shouldUseDirectUrl ? absoluteUrl : proxyUrl;
  }
  
  const remoteUrl = isOwnUploadedFile ? rawUrl : finalUrl;

  const mime = attachment.mime_type || '';
  const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(rawUrl) || mime.startsWith('image/');
  const isPdf = /\.pdf$/i.test(rawUrl) || mime === 'application/pdf';
  const isVideo = /\.(mp4|mov|webm)$/i.test(rawUrl) || mime.startsWith('video/');
  const isAudio = /\.(mp3|wav|m4a|aac)$/i.test(rawUrl) || mime.startsWith('audio/');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
        {attachment.title || 'Attachment'}
      </DialogTitle>
      <DialogContent dividers>
        {isImage && (
          <img
            src={finalUrl}
            onError={(e) => { 
              // For uploaded files, no fallback needed as they should work directly
              // For WordPress files, fallback to remoteUrl if proxy fails
              if (!isOwnUploadedFile && finalUrl !== remoteUrl) {
                (e.currentTarget as HTMLImageElement).src = remoteUrl; 
              }
            }}
            alt={attachment.title || 'Attachment image'}
            style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: 4 }}
          />
        )}
        {isPdf && (
          <Box sx={{ height: '80vh', width: '100%', position: 'relative' }}>
            {!pdfError ? (
              <>
                <iframe
                  src={`${finalUrl}#view=FitH`}
                  width="100%"
                  height="100%"
                  title={attachment.title || 'PDF Document'}
                  style={{ border: 'none', borderRadius: 4 }}
                  onError={() => setPdfError(true)}
                  onLoad={(e) => {
                    // Check if iframe loaded successfully
                    try {
                      const iframe = e.currentTarget as HTMLIFrameElement;
                      if (iframe.contentDocument === null) {
                        setPdfError(true);
                      }
                    } catch (error) {
                      // Cross-origin restrictions prevent access
                      // This is normal for external PDFs, so don't set error
                    }
                  }}
                />
                
                {/* Fallback buttons overlay */}
                <Box sx={{ 
                  position: 'absolute', 
                  top: 16, 
                  right: 16, 
                  display: 'flex', 
                  gap: 1,
                  zIndex: 1
                }}>
                  <Button 
                    size="small"
                    variant="contained" 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = finalUrl;
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      link.download = attachment.title || 'document.pdf';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    sx={{ 
                      minWidth: 'auto',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.9)' }
                    }}
                  >
                    📥
                  </Button>
                  <Button 
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = finalUrl;
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    sx={{ 
                      minWidth: 'auto',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,1)' }
                    }}
                  >
                    🔗
                  </Button>
                </Box>
              </>
            ) : (
              // Fallback UI when PDF preview fails
              <Box sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 2, 
                bgcolor: 'background.paper' 
              }}>
                <Alert severity="info" sx={{ mb: 2, maxWidth: 500 }}>
                  PDF preview is not available. This may be due to browser security restrictions or server configuration.
                </Alert>
                
                <Typography variant="h6">📄 PDF Document</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
                  {attachment.title || 'PDF Document'}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                  <Button 
                    variant="contained" 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = finalUrl;
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      link.download = attachment.title || 'document.pdf';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    sx={{ minWidth: 160 }}
                  >
                    📥 Download PDF
                  </Button>
                  <Button 
                    variant="outlined"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = finalUrl;
                      link.target = '_blank';
                      link.rel = 'noopener noreferrer';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    sx={{ minWidth: 160 }}
                  >
                    🔗 Open in New Tab
                  </Button>
                </Box>
                
                <Button 
                  variant="text"
                  size="small"
                  onClick={() => setPdfError(false)}
                  sx={{ mt: 1 }}
                >
                  Try Preview Again
                </Button>
              </Box>
            )}
          </Box>
        )}
        {isVideo && (
          <video controls style={{ width: '100%' }}>
            <source src={finalUrl} />
            {!isOwnUploadedFile && finalUrl !== remoteUrl && <source src={remoteUrl} />}
          </video>
        )}
        {isAudio && (
          <audio controls style={{ width: '100%' }}>
            <source src={finalUrl} />
            {!isOwnUploadedFile && finalUrl !== remoteUrl && <source src={remoteUrl} />}
          </audio>
        )}
        {!isImage && !isPdf && !isVideo && !isAudio && (
          <Typography variant="body2">
            Download: <a href={remoteUrl} target="_blank" rel="noopener noreferrer">{attachment.title || 'Attachment'}</a>
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AttachmentViewerModal;


