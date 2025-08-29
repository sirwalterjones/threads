import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Post {
  id: number;
  title: string;
  content: string;
  author_name?: string;
  created_at?: string;
  tags?: string[];
  comments?: Comment[];
  attachments?: any[];
  featured_media_url?: string;
}

interface Comment {
  id: number;
  content: string;
  author_name?: string;
  created_at: string;
}

export const generatePDF = (posts: Post[], options: { includeComments?: boolean; includeTags?: boolean } = {}) => {
  const doc = new jsPDF();
  
  // Professional color scheme
  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [255, 255, 255];
  const darkGray: [number, number, number] = [51, 51, 51];
  const mediumGray: [number, number, number] = [102, 102, 102];
  const lightGray: [number, number, number] = [240, 240, 240];
  const accentBlue: [number, number, number] = [0, 123, 255];
  
  // Add black header with white text
  doc.setFillColor(black[0], black[1], black[2]);
  doc.rect(0, 0, 210, 35, 'F');
  
  // Add Vector logo/title
  doc.setTextColor(white[0], white[1], white[2]);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('VECTOR', 20, 22);
  
  // Add subtle tagline
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Intelligence & Security Platform', 20, 30);
  
  // Add export date on the right
  doc.setFontSize(9);
  doc.text(new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }), 190, 30, { align: 'right' });
  
  // Reset text color for body content
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  // Add document info section
  let yPosition = 45;
  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(0, 38, 210, 12, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
  doc.text(`Document contains ${posts.length} post${posts.length !== 1 ? 's' : ''}`, 20, 45);
  doc.text(`Generated: ${new Date().toLocaleTimeString()}`, 190, 45, { align: 'right' });
  
  yPosition = 60;
  
  // Process each post with improved formatting
  posts.forEach((post, index) => {
    // Check if we need a new page
    if (yPosition > 240) {
      doc.addPage();
      addPageHeader(doc, black, white);
      yPosition = 45;
    }
    
    // Add post number
    doc.setFontSize(8);
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    doc.text(`POST ${index + 1} OF ${posts.length}`, 20, yPosition);
    yPosition += 5;
    
    // Post title with better formatting
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    const titleLines = doc.splitTextToSize(post.title || 'Untitled Post', 170);
    titleLines.forEach((line: string) => {
      if (yPosition > 270) {
        doc.addPage();
        addPageHeader(doc, black, white);
        yPosition = 45;
      }
      doc.text(line, 20, yPosition);
      yPosition += 7;
    });
    
    yPosition += 2;
    
    // Post metadata bar
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(20, yPosition - 4, 170, 6, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    const author = post.author_name || 'Unknown Author';
    const date = post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'No date';
    doc.text(`${author} • ${date}`, 22, yPosition);
    yPosition += 8;
    
    // Tags if present
    if (options.includeTags && post.tags && post.tags.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
      const tagsText = post.tags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join('  ');
      const tagLines = doc.splitTextToSize(tagsText, 170);
      tagLines.forEach((line: string) => {
        if (yPosition > 270) {
          doc.addPage();
          addPageHeader(doc, black, white);
          yPosition = 45;
        }
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
      yPosition += 2;
    }
    
    // Post content - show full content, not truncated
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    
    // Clean HTML and preserve formatting
    const cleanContent = cleanHtmlContent(post.content || '');
    const contentLines = doc.splitTextToSize(cleanContent, 170);
    
    contentLines.forEach((line: string) => {
      if (yPosition > 270) {
        doc.addPage();
        addPageHeader(doc, black, white);
        yPosition = 45;
      }
      doc.text(line, 20, yPosition);
      yPosition += 5;
    });
    
    // Attachments section
    if (post.attachments && post.attachments.length > 0) {
      yPosition += 3;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text('Attachments:', 20, yPosition);
      yPosition += 5;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
      
      post.attachments.forEach((attachment: any) => {
        if (yPosition > 270) {
          doc.addPage();
          addPageHeader(doc, black, white);
          yPosition = 45;
        }
        const attachmentText = `• ${attachment.title || attachment.filename || 'Attachment'} (${attachment.mime_type || 'file'})`;
        doc.text(attachmentText, 25, yPosition);
        if (attachment.url) {
          doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
          doc.textWithLink('[View]', 180, yPosition, { url: attachment.url });
          doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        }
        yPosition += 4;
      });
    }
    
    // Featured media
    if (post.featured_media_url) {
      yPosition += 3;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
      doc.text(`[Featured Image: ${post.featured_media_url}]`, 20, yPosition);
      yPosition += 5;
    }
    
    // Comments section with improved formatting
    if (options.includeComments && post.comments && post.comments.length > 0) {
      yPosition += 5;
      
      // Comments header
      doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.rect(20, yPosition - 4, 170, 6, 'F');
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(`Comments (${post.comments.length})`, 22, yPosition);
      yPosition += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      post.comments.forEach((comment, commentIndex) => {
        if (yPosition > 260) {
          doc.addPage();
          addPageHeader(doc, black, white);
          yPosition = 45;
        }
        
        // Comment metadata
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        doc.text(comment.author_name || 'Anonymous', 25, yPosition);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(` - ${new Date(comment.created_at).toLocaleDateString()}`, 25 + doc.getTextWidth(comment.author_name || 'Anonymous'), yPosition);
        yPosition += 4;
        
        // Comment content
        doc.setFontSize(9);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        const commentLines = doc.splitTextToSize(comment.content, 160);
        commentLines.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            addPageHeader(doc, black, white);
            yPosition = 45;
          }
          doc.text(line, 25, yPosition);
          yPosition += 4;
        });
        
        yPosition += 3;
      });
    }
    
    // Add separator between posts
    yPosition += 8;
    if (index < posts.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(20, yPosition, 190, yPosition);
      yPosition += 10;
    }
  });
  
  // Add page numbers and footer to all pages
  const pageCount = doc.getNumberOfPages();
  doc.setFont('helvetica', 'normal');
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer background
    doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    doc.rect(0, 280, 210, 17, 'F');
    
    // Footer content
    doc.setFontSize(8);
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    doc.text('© Vector Intelligence Platform - Confidential', 20, 290);
    doc.text(`Page ${i} of ${pageCount}`, 190, 290, { align: 'right' });
  }
  
  return doc;
};

// Helper function to add page header on new pages
function addPageHeader(doc: jsPDF, black: [number, number, number], white: [number, number, number]) {
  doc.setFillColor(black[0], black[1], black[2]);
  doc.rect(0, 0, 210, 20, 'F');
  
  doc.setTextColor(white[0], white[1], white[2]);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VECTOR', 20, 13);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Continued...', 190, 13, { align: 'right' });
}

// Helper function to clean HTML content
function cleanHtmlContent(html: string): string {
  // Remove HTML tags but preserve structure
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
    .trim();
  
  return text;
}

export const downloadPDF = (posts: Post[], filename?: string, options?: { includeComments?: boolean; includeTags?: boolean }) => {
  const doc = generatePDF(posts, options);
  const defaultFilename = `vector-export-${Date.now()}.pdf`;
  doc.save(filename || defaultFilename);
};