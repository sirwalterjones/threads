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
}

interface Comment {
  id: number;
  content: string;
  author_name?: string;
  created_at: string;
}

export const generatePDF = (posts: Post[], options: { includeComments?: boolean; includeTags?: boolean } = {}) => {
  const doc = new jsPDF();
  
  // Set up colors - use as individual parameters instead of spread
  const primaryColor: [number, number, number] = [102, 126, 234]; // Vector brand color
  const textColor: [number, number, number] = [26, 26, 26];
  const lightGray: [number, number, number] = [248, 249, 250];
  
  // Add header with gradient effect (simulated)
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Add title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Vector Threads', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Knowledge Sharing Platform', 105, 30, { align: 'center' });
  
  // Reset text color
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  
  // Add export info
  let yPosition = 50;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Export Date: ${new Date().toLocaleString()}`, 20, yPosition);
  doc.text(`Total Posts: ${posts.length}`, 20, yPosition + 5);
  
  yPosition += 15;
  
  // Process each post
  posts.forEach((post, index) => {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    // Post title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(post.title || 'Untitled', 170);
    doc.text(titleLines, 20, yPosition);
    yPosition += titleLines.length * 6;
    
    // Post metadata
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(108, 117, 125);
    doc.text(`By: ${post.author_name || 'Unknown'}`, 20, yPosition);
    if (post.created_at) {
      doc.text(`Date: ${new Date(post.created_at).toLocaleDateString()}`, 80, yPosition);
    }
    yPosition += 5;
    
    // Tags
    if (options.includeTags && post.tags && post.tags.length > 0) {
      doc.setTextColor(0, 102, 204);
      doc.text(`Tags: ${post.tags.join(', ')}`, 20, yPosition);
      yPosition += 5;
    }
    
    // Reset text color
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // Post content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    // Clean and truncate content
    const cleanContent = (post.content || '')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .slice(0, 2000); // Limit content length
    
    const contentLines = doc.splitTextToSize(cleanContent, 170);
    const maxLines = Math.min(contentLines.length, 15); // Limit lines to prevent overflow
    
    for (let i = 0; i < maxLines; i++) {
      if (yPosition > 270) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(contentLines[i], 20, yPosition);
      yPosition += 5;
    }
    
    if (contentLines.length > maxLines) {
      doc.setTextColor(108, 117, 125);
      doc.text('... (content truncated)', 20, yPosition);
      yPosition += 5;
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    }
    
    // Comments
    if (options.includeComments && post.comments && post.comments.length > 0) {
      yPosition += 3;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Comments (${post.comments.length})`, 20, yPosition);
      yPosition += 5;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      post.comments.slice(0, 3).forEach(comment => {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Comment author and date
        doc.setTextColor(73, 80, 87);
        doc.text(`${comment.author_name || 'Anonymous'} - ${new Date(comment.created_at).toLocaleDateString()}`, 25, yPosition);
        yPosition += 4;
        
        // Comment content
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        const commentLines = doc.splitTextToSize(comment.content.slice(0, 200), 160);
        const maxCommentLines = Math.min(commentLines.length, 3);
        
        for (let i = 0; i < maxCommentLines; i++) {
          doc.text(commentLines[i], 25, yPosition);
          yPosition += 4;
        }
        yPosition += 2;
      });
      
      if (post.comments.length > 3) {
        doc.setTextColor(108, 117, 125);
        doc.text(`... and ${post.comments.length - 3} more comments`, 25, yPosition);
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        yPosition += 5;
      }
    }
    
    // Add separator between posts
    yPosition += 5;
    doc.setDrawColor(233, 236, 239);
    doc.line(20, yPosition, 190, yPosition);
    yPosition += 10;
  });
  
  // Add footer to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(108, 117, 125);
    doc.text(`© ${new Date().getFullYear()} Vector Online`, 20, 285);
    doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
  }
  
  return doc;
};

export const downloadPDF = (posts: Post[], filename?: string, options?: { includeComments?: boolean; includeTags?: boolean }) => {
  const doc = generatePDF(posts, options);
  const defaultFilename = `vector-threads-export-${Date.now()}.pdf`;
  doc.save(filename || defaultFilename);
};