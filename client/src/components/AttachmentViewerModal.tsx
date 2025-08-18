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
  const relativeOrAbsolute = rawUrl.startsWith('/') ? rawUrl : rawUrl;
  const remoteBase = (process.env.REACT_APP_WP_SITE_URL || 'https://cmansrms.us').replace(/\/$/, '');
  const remoteUrl = relativeOrAbsolute.startsWith('http') ? relativeOrAbsolute : `${remoteBase}${relativeOrAbsolute}`;
  const authToken = typeof window !== 'undefined' ? (localStorage.getItem('token') || '') : '';
  const tokenQuery = authToken ? `&t=${encodeURIComponent(authToken)}` : '';
  const proxyUrl = `${API_BASE_URL}/media?url=${encodeURIComponent(relativeOrAbsolute)}${tokenQuery}`;

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
            src={proxyUrl}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = remoteUrl; }}
            alt={attachment.title || 'Attachment image'}
            style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: 4 }}
          />
        )}
        {isPdf && (
          <Box sx={{ height: '80vh' }}>
            <object data={proxyUrl} type="application/pdf" width="100%" height="100%">
              <embed src={proxyUrl} type="application/pdf" width="100%" height="100%" />
              <Typography variant="body2">Unable to preview PDF. <a href={remoteUrl} target="_blank" rel="noreferrer">Open in new tab</a></Typography>
            </object>
          </Box>
        )}
        {isVideo && (
          <video controls style={{ width: '100%' }}>
            <source src={proxyUrl} />
          </video>
        )}
        {isAudio && (
          <audio controls style={{ width: '100%' }}>
            <source src={proxyUrl} />
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


