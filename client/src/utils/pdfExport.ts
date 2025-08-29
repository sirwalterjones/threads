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

// Cache for loaded images
const imageCache: Map<string, { width: number; height: number; data: string }> = new Map();

export const generatePDF = async (posts: Post[], options: { includeComments?: boolean; includeTags?: boolean } = {}) => {
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
  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    
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
    
    // Featured media image if present
    if (post.featured_media_url) {
      try {
        const imageAdded = await addImageToPDF(doc, post.featured_media_url, 20, yPosition, 170);
        if (imageAdded.success) {
          yPosition = imageAdded.newY + 5;
        } else {
          // Fallback text for failed image
          doc.setFontSize(9);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
          doc.text(`[Featured Image: ${post.featured_media_url}]`, 20, yPosition);
          yPosition += 5;
        }
      } catch (error) {
        // Fallback for image load error
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        doc.text(`[Featured Image: ${post.featured_media_url}]`, 20, yPosition);
        yPosition += 5;
      }
    }
    
    // Post content with HTML formatting and inline images
    // First extract images and get formatted text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content || '';
    
    // Extract and handle images separately
    const images = tempDiv.querySelectorAll('img');
    const imagePositions = new Map<string, { src: string; alt?: string }>();
    
    images.forEach((img, index) => {
      const placeholder = `__IMG_${index}__`;
      const src = img.src || img.getAttribute('data-src') || '';
      const alt = img.alt || img.getAttribute('alt') || '';
      if (src) {
        imagePositions.set(placeholder, { src, alt });
        const placeholderSpan = document.createElement('span');
        placeholderSpan.textContent = placeholder;
        img.replaceWith(placeholderSpan);
      }
    });
    
    // Parse the HTML with formatting
    const formattedContent = parseHtmlToFormattedText(tempDiv.innerHTML);
    
    // Render formatted content
    let listCounter = 0;
    for (const segment of formattedContent) {
      // Check for image placeholders
      const imgMatch = segment.text.match(/__IMG_(\d+)__/);
      if (imgMatch) {
        const placeholder = imgMatch[0];
        const imgInfo = imagePositions.get(placeholder);
        if (imgInfo) {
          // Render text before image
          const beforeText = segment.text.substring(0, imgMatch.index || 0).trim();
          if (beforeText) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
            const lines = doc.splitTextToSize(beforeText, 170);
            lines.forEach((line: string) => {
              if (yPosition > 270) {
                doc.addPage();
                addPageHeader(doc, black, white);
                yPosition = 45;
              }
              doc.text(line, 20, yPosition);
              yPosition += 5;
            });
          }
          
          // Render image
          if (yPosition > 200) {
            doc.addPage();
            addPageHeader(doc, black, white);
            yPosition = 45;
          }
          
          try {
            const imageAdded = await addImageToPDF(doc, imgInfo.src, 20, yPosition, 170);
            if (imageAdded.success) {
              yPosition = imageAdded.newY + 5;
              // Add image caption if alt text exists
              if (imgInfo.alt) {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
                doc.text(imgInfo.alt, 20, yPosition);
                yPosition += 4;
              }
            } else {
              doc.setFontSize(9);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
              doc.text(`[Image: ${imgInfo.alt || imgInfo.src}]`, 20, yPosition);
              yPosition += 5;
            }
          } catch (error) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
            doc.text(`[Image: ${imgInfo.alt || imgInfo.src}]`, 20, yPosition);
            yPosition += 5;
          }
          
          // Render text after image
          const afterText = segment.text.substring((imgMatch.index || 0) + placeholder.length).trim();
          if (afterText) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
            const lines = doc.splitTextToSize(afterText, 170);
            lines.forEach((line: string) => {
              if (yPosition > 270) {
                doc.addPage();
                addPageHeader(doc, black, white);
                yPosition = 45;
              }
              doc.text(line, 20, yPosition);
              yPosition += 5;
            });
          }
          continue;
        }
      }
      
      // Skip empty text segments
      if (!segment.text.trim()) continue;
      
      // Set font styles based on formatting
      if (segment.header) {
        // Headers
        const sizes = { 1: 16, 2: 14, 3: 12, 4: 11, 5: 10, 6: 10 };
        doc.setFontSize(sizes[segment.header] || 10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        
        // Add spacing before headers
        if (yPosition > 50) yPosition += 3;
      } else if (segment.code) {
        // Code blocks
        doc.setFontSize(9);
        doc.setFont('courier', 'normal');
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        
        // Add background for code blocks
        const codeLines = doc.splitTextToSize(segment.text, 165);
        const codeHeight = codeLines.length * 4.5 + 2;
        if (yPosition + codeHeight > 270) {
          doc.addPage();
          addPageHeader(doc, black, white);
          yPosition = 45;
        }
        doc.setFillColor(247, 247, 247);
        doc.rect(20, yPosition - 3, 170, codeHeight, 'F');
      } else if (segment.blockquote) {
        // Blockquotes
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
      } else {
        // Regular text
        doc.setFontSize(10);
        const style = segment.bold && segment.italic ? 'bolditalic' :
                     segment.bold ? 'bold' :
                     segment.italic ? 'italic' : 'normal';
        doc.setFont('helvetica', style);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      }
      
      // Handle list items
      let textToRender = segment.text;
      let indent = 20;
      if (segment.listItem) {
        if (segment.list === 'bullet') {
          textToRender = `• ${segment.text}`;
        } else if (segment.list === 'number') {
          listCounter++;
          textToRender = `${listCounter}. ${segment.text}`;
        }
        indent = 25;
      } else if (!segment.listItem && listCounter > 0) {
        listCounter = 0; // Reset counter when list ends
      }
      
      // Handle blockquotes with left border
      if (segment.blockquote) {
        indent = 30;
        doc.setDrawColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        doc.setLineWidth(0.5);
      }
      
      // Split and render text
      const lines = doc.splitTextToSize(textToRender, 170 - (indent - 20));
      lines.forEach((line: string, lineIndex: number) => {
        if (yPosition > 270) {
          doc.addPage();
          addPageHeader(doc, black, white);
          yPosition = 45;
        }
        
        // Draw blockquote border
        if (segment.blockquote && lineIndex === 0) {
          doc.line(25, yPosition - 2, 25, yPosition + (lines.length * 5) - 3);
        }
        
        // Render text with potential link
        if (segment.link && !segment.code) {
          doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
          doc.textWithLink(line, indent, yPosition, { url: segment.link });
          doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        } else {
          doc.text(line, indent, yPosition);
        }
        
        yPosition += segment.code ? 4.5 : 5;
      });
      
      // Reset font after code blocks
      if (segment.code) {
        doc.setFont('helvetica', 'normal');
      }
      
      // Add extra spacing after certain elements
      if (segment.header || segment.blockquote) {
        yPosition += 2;
      }
    }
    
    // Attachments section with images
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
      
      for (const attachment of post.attachments) {
        if (yPosition > 250) {
          doc.addPage();
          addPageHeader(doc, black, white);
          yPosition = 45;
        }
        
        // Check if attachment is an image
        if (attachment.mime_type && attachment.mime_type.startsWith('image/') && attachment.url) {
          try {
            const imageAdded = await addImageToPDF(doc, attachment.url, 25, yPosition, 100);
            if (imageAdded.success) {
              // Add caption for the image
              doc.setFontSize(8);
              doc.text(attachment.title || attachment.filename || 'Attachment', 25, imageAdded.newY + 3);
              yPosition = imageAdded.newY + 8;
            } else {
              // Text fallback
              const attachmentText = `• ${attachment.title || attachment.filename || 'Attachment'} (${attachment.mime_type || 'file'})`;
              doc.text(attachmentText, 25, yPosition);
              yPosition += 4;
            }
          } catch (error) {
            // Text fallback
            const attachmentText = `• ${attachment.title || attachment.filename || 'Attachment'} (${attachment.mime_type || 'file'})`;
            doc.text(attachmentText, 25, yPosition);
            yPosition += 4;
          }
        } else {
          // Non-image attachment
          const attachmentText = `• ${attachment.title || attachment.filename || 'Attachment'} (${attachment.mime_type || 'file'})`;
          doc.text(attachmentText, 25, yPosition);
          if (attachment.url) {
            doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
            doc.textWithLink('[View]', 180, yPosition, { url: attachment.url });
            doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
          }
          yPosition += 4;
        }
      }
    }
    
    // Comments section (unchanged)
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
  }
  
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

// Helper function to add images to PDF
async function addImageToPDF(
  doc: jsPDF, 
  imageUrl: string, 
  x: number, 
  y: number, 
  maxWidth: number
): Promise<{ success: boolean; newY: number }> {
  try {
    // Check cache first
    let imageData = imageCache.get(imageUrl);
    
    if (!imageData) {
      // Load image
      const img = await loadImage(imageUrl);
      if (!img) {
        return { success: false, newY: y };
      }
      
      // Calculate dimensions
      const aspectRatio = img.height / img.width;
      let width = Math.min(img.width, maxWidth);
      let height = width * aspectRatio;
      
      // Limit height to prevent page overflow
      const maxHeight = 100;
      if (height > maxHeight) {
        height = maxHeight;
        width = height / aspectRatio;
      }
      
      imageData = {
        width,
        height,
        data: img.data
      };
      
      // Cache the processed image
      imageCache.set(imageUrl, imageData);
    }
    
    // Add image to PDF
    doc.addImage(imageData.data, 'JPEG', x, y, imageData.width, imageData.height);
    
    return { success: true, newY: y + imageData.height };
  } catch (error) {
    console.error('Failed to add image to PDF:', imageUrl, error);
    return { success: false, newY: y };
  }
}

// Helper function to load images
async function loadImage(url: string): Promise<{ width: number; height: number; data: string } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      resolve({
        width: img.width,
        height: img.height,
        data: dataUrl
      });
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', url);
      resolve(null);
    };
    
    // Handle relative URLs and proxy if needed
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // For external images, we might need a proxy to avoid CORS issues
      // For now, try direct load with CORS
      img.src = url;
    } else {
      // Relative URL - prepend base URL
      img.src = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    }
    
    // Timeout after 5 seconds
    setTimeout(() => {
      resolve(null);
    }, 5000);
  });
}

// Helper function to parse content and extract images
async function parseContentWithImages(html: string): Promise<Array<{ type: 'text' | 'image'; content?: string; src?: string }>> {
  const parts: Array<{ type: 'text' | 'image'; content?: string; src?: string }> = [];
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Extract images and replace with placeholders
  const images = tempDiv.querySelectorAll('img');
  const imageMap = new Map<string, string>();
  
  images.forEach((img, index) => {
    const placeholder = `__IMAGE_${index}__`;
    const src = img.src || img.getAttribute('data-src') || img.getAttribute('src') || '';
    if (src) {
      imageMap.set(placeholder, src);
      img.replaceWith(placeholder);
    }
  });
  
  // Get cleaned text content
  const textContent = cleanHtmlContent(tempDiv.innerHTML);
  
  // Split text by image placeholders
  const lines = textContent.split('\n');
  
  for (const line of lines) {
    if (line.includes('__IMAGE_')) {
      // Check if this line contains an image placeholder
      const match = line.match(/__IMAGE_(\d+)__/);
      if (match && match.index !== undefined) {
        const placeholder = match[0];
        const src = imageMap.get(placeholder);
        
        // Add text before image if any
        const beforeText = line.substring(0, match.index).trim();
        if (beforeText) {
          parts.push({ type: 'text', content: beforeText });
        }
        
        // Add image
        if (src) {
          parts.push({ type: 'image', src });
        }
        
        // Add text after image if any
        if (match.index !== undefined) {
          const afterText = line.substring(match.index + placeholder.length).trim();
          if (afterText) {
            parts.push({ type: 'text', content: afterText });
          }
        }
      } else {
        parts.push({ type: 'text', content: line });
      }
    } else if (line.trim()) {
      parts.push({ type: 'text', content: line });
    }
  }
  
  // Combine consecutive text parts
  const combinedParts: Array<{ type: 'text' | 'image'; content?: string; src?: string }> = [];
  let currentText = '';
  
  for (const part of parts) {
    if (part.type === 'text') {
      currentText += (currentText ? '\n' : '') + part.content;
    } else {
      if (currentText) {
        combinedParts.push({ type: 'text', content: currentText });
        currentText = '';
      }
      combinedParts.push(part);
    }
  }
  
  if (currentText) {
    combinedParts.push({ type: 'text', content: currentText });
  }
  
  return combinedParts;
}

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

// Helper function to parse HTML and extract formatted content
interface FormattedText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  header?: 1 | 2 | 3 | 4 | 5 | 6;
  link?: string;
  list?: 'bullet' | 'number';
  listItem?: boolean;
  code?: boolean;
  blockquote?: boolean;
}

function parseHtmlToFormattedText(html: string): FormattedText[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const formatted: FormattedText[] = [];
  
  function processNode(node: Node, parentStyles: Partial<FormattedText> = {}): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        formatted.push({ ...parentStyles, text });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      let styles = { ...parentStyles };
      
      // Handle different HTML elements
      switch (tagName) {
        case 'h1':
          styles = { header: 1 };
          break;
        case 'h2':
          styles = { header: 2 };
          break;
        case 'h3':
          styles = { header: 3 };
          break;
        case 'h4':
          styles = { header: 4 };
          break;
        case 'h5':
          styles = { header: 5 };
          break;
        case 'h6':
          styles = { header: 6 };
          break;
        case 'strong':
        case 'b':
          styles.bold = true;
          break;
        case 'em':
        case 'i':
          styles.italic = true;
          break;
        case 'a':
          styles.link = (element as HTMLAnchorElement).href;
          break;
        case 'ul':
          styles.list = 'bullet';
          break;
        case 'ol':
          styles.list = 'number';
          break;
        case 'li':
          styles.listItem = true;
          break;
        case 'code':
        case 'pre':
          styles.code = true;
          break;
        case 'blockquote':
          styles.blockquote = true;
          break;
        case 'br':
          formatted.push({ text: '\n' });
          return;
        case 'p':
        case 'div':
          // Process children then add line break
          Array.from(node.childNodes).forEach(child => processNode(child, styles));
          formatted.push({ text: '\n' });
          return;
      }
      
      // Process child nodes
      Array.from(node.childNodes).forEach(child => processNode(child, styles));
      
      // Add line break after block elements
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tagName)) {
        formatted.push({ text: '\n' });
      }
    }
  }
  
  Array.from(tempDiv.childNodes).forEach(node => processNode(node));
  
  // Merge consecutive text nodes with same formatting
  const merged: FormattedText[] = [];
  let current: FormattedText | null = null;
  
  for (const item of formatted) {
    if (current && 
        current.bold === item.bold && 
        current.italic === item.italic && 
        current.header === item.header &&
        current.link === item.link &&
        current.code === item.code &&
        current.blockquote === item.blockquote &&
        !item.listItem) {
      current.text += item.text;
    } else {
      if (current) merged.push(current);
      current = { ...item };
    }
  }
  if (current) merged.push(current);
  
  return merged;
}

// Helper function to clean HTML content (fallback for simple text extraction)
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

export const downloadPDF = async (posts: Post[], filename?: string, options?: { includeComments?: boolean; includeTags?: boolean }) => {
  const doc = await generatePDF(posts, options);
  const defaultFilename = `vector-export-${Date.now()}.pdf`;
  doc.save(filename || defaultFilename);
};