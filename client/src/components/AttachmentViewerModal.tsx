import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box
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
  if (!attachment) return null;

  const rawUrl = attachment.url;
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
  const remoteUrl = absoluteUrl;
  
  // For cmansrms.us, use direct URLs since it's a public WordPress site
  const shouldUseDirectUrl = absoluteUrl.includes('cmansrms.us');
  const finalUrl = shouldUseDirectUrl ? absoluteUrl : proxyUrl;

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
              if (!shouldUseDirectUrl) {
                (e.currentTarget as HTMLImageElement).src = remoteUrl; 
              }
            }}
            alt={attachment.title || 'Attachment image'}
            style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: 4 }}
          />
        )}
        {isPdf && (
          <Box sx={{ height: '80vh' }}>
            <object data={finalUrl} type="application/pdf" width="100%" height="100%">
              <embed src={finalUrl} type="application/pdf" width="100%" height="100%" />
              <Typography variant="body2">Unable to preview PDF. <a href={remoteUrl} target="_blank" rel="noreferrer">Open in new tab</a></Typography>
            </object>
          </Box>
        )}
        {isVideo && (
          <video controls style={{ width: '100%' }}>
            <source src={finalUrl} />
            {!shouldUseDirectUrl && <source src={remoteUrl} />}
          </video>
        )}
        {isAudio && (
          <audio controls style={{ width: '100%' }}>
            <source src={finalUrl} />
            {!shouldUseDirectUrl && <source src={remoteUrl} />}
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


