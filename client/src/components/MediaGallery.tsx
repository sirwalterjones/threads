import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  AttachFile as AttachmentIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface MediaFile {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

interface MediaGalleryProps {
  attachments: MediaFile[];
  maxHeight?: number;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({ attachments, maxHeight = 200 }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon />;
    if (mimeType === 'application/pdf') return <PdfIcon />;
    if (mimeType.startsWith('audio/')) return <AudioIcon />;
    if (mimeType.startsWith('video/')) return <VideoIcon />;
    return <AttachmentIcon />;
  };

  const getFileUrl = (fileId: number, filename: string) => {
    return `/api/files/${fileId}/${encodeURIComponent(filename)}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const currentFile = attachments[currentIndex];
  const isImage = currentFile?.mime_type?.startsWith('image/');
  const isVideo = currentFile?.mime_type?.startsWith('video/');

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + attachments.length) % attachments.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % attachments.length);
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewOpen(true);
  };

  const handleDownload = (e: React.MouseEvent, file: MediaFile) => {
    e.stopPropagation();
    const url = getFileUrl(file.id, file.filename);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          height: maxHeight,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: '#F3F4F6',
          mb: 2,
          cursor: 'pointer'
        }}
        onClick={handlePreview}
      >
        {/* Main Media Display */}
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          {isImage ? (
            <img
              src={getFileUrl(currentFile.id, currentFile.filename)}
              alt={currentFile.original_name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
              onError={(e) => {
                // Show placeholder if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          ) : isVideo ? (
            <video
              src={getFileUrl(currentFile.id, currentFile.filename)}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
              controls={false}
              muted
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23e5e7eb'/%3E%3C/svg%3E"
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6B7280',
                textAlign: 'center',
                p: 2
              }}
            >
              <Box sx={{ fontSize: 48, mb: 1, color: '#9CA3AF' }}>
                {getFileIcon(currentFile.mime_type)}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {currentFile.original_name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                {formatFileSize(currentFile.file_size)}
              </Typography>
            </Box>
          )}

          {/* Navigation Arrows (only show if more than 1 file) */}
          {attachments.length > 1 && (
            <>
              <IconButton
                onClick={handlePrevious}
                sx={{
                  position: 'absolute',
                  left: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' },
                  width: 32,
                  height: 32
                }}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                onClick={handleNext}
                sx={{
                  position: 'absolute',
                  right: 8,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.7)' },
                  width: 32,
                  height: 32
                }}
              >
                <ChevronRight />
              </IconButton>
            </>
          )}

          {/* File counter */}
          {attachments.length > 1 && (
            <Chip
              label={`${currentIndex + 1} / ${attachments.length}`}
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                fontSize: '0.75rem'
              }}
            />
          )}
        </Box>

        {/* File type indicator */}
        <Chip
          icon={getFileIcon(currentFile.mime_type)}
          label={currentFile.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            fontSize: '0.7rem'
          }}
        />
      </Box>

      {/* Preview Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{currentFile.original_name}</Typography>
          <IconButton onClick={() => setPreviewOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ textAlign: 'center', p: 2 }}>
          {isImage ? (
            <img
              src={getFileUrl(currentFile.id, currentFile.filename)}
              alt={currentFile.original_name}
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          ) : isVideo ? (
            <video
              src={getFileUrl(currentFile.id, currentFile.filename)}
              controls
              style={{
                maxWidth: '100%',
                maxHeight: '70vh'
              }}
            />
          ) : (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Box sx={{ fontSize: 64, mb: 2, color: '#9CA3AF' }}>
                {getFileIcon(currentFile.mime_type)}
              </Box>
              <Typography variant="h6" sx={{ mb: 1 }}>
                {currentFile.original_name}
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280', mb: 1 }}>
                {currentFile.mime_type}
              </Typography>
              <Typography variant="body2" sx={{ color: '#6B7280' }}>
                {formatFileSize(currentFile.file_size)}
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', p: 3 }}>
          <Box>
            {attachments.length > 1 && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button onClick={handlePrevious} disabled={attachments.length <= 1}>
                  Previous
                </Button>
                <Button onClick={handleNext} disabled={attachments.length <= 1}>
                  Next
                </Button>
              </Box>
            )}
          </Box>
          <Button 
            variant="contained" 
            onClick={(e) => handleDownload(e, currentFile)}
            sx={{ backgroundColor: '#000000', '&:hover': { backgroundColor: '#1F2937' } }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MediaGallery;