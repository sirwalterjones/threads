import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Post } from '../types';

interface PostWithComments extends Post {
  comments?: Array<{
    content: string;
    author_name?: string;
    username?: string;
    created_at?: string;
  }>;
}

// Extend jsPDF types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
    previousAutoTable?: {
      finalY: number;
    };
  }
}

interface ImageInfo {
  width: number;
  height: number;
  data: string;
}

// Cache for loaded images
const imageCache: Map<string, ImageInfo> = new Map();

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

export const generatePDF = async (posts: PostWithComments[], options: { includeComments?: boolean; includeTags?: boolean; user?: { username?: string; email?: string } } = {}) => {
  const doc = new jsPDF();
  
  // Professional color scheme
  const black: [number, number, number] = [0, 0, 0];
  const white: [number, number, number] = [255, 255, 255];
  const darkGray: [number, number, number] = [51, 51, 51];
  const mediumGray: [number, number, number] = [102, 102, 102];
  const lightGray: [number, number, number] = [240, 240, 240];
  const accentBlue: [number, number, number] = [0, 123, 255];
  
  // Add compact header
  const addCompactHeader = (pageNum: number = 1) => {
    doc.setFillColor(black[0], black[1], black[2]);
    doc.rect(0, 0, 210, 15, 'F');
    
    doc.setTextColor(white[0], white[1], white[2]);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('VECTOR', 10, 10);
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${pageNum}`, 200, 10, { align: 'right' });
  };
  
  // First page - Table of Contents
  addCompactHeader();
  
  doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const generatedBy = options.user?.username || options.user?.email || 'Unknown User';
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  doc.text(`Generated by ${generatedBy} on ${date} | ${posts.length} ${posts.length === 1 ? 'Post' : 'Posts'}`, 10, 20);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', 10, 30);
  
  let tocY = 36;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  posts.forEach((post, index) => {
    if (tocY > 285) {
      doc.addPage();
      addCompactHeader(doc.getNumberOfPages());
      tocY = 22;
    }
    
    const pageNum = index + 2;
    const title = post.title || 'Untitled Post';
    const truncatedTitle = title.length > 90 ? title.substring(0, 87) + '...' : title;
    
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    doc.text(`${pageNum}.`, 12, tocY);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(truncatedTitle, 20, tocY);
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    doc.text(`${pageNum}`, 198, tocY, { align: 'right' });
    tocY += 4;
  });
  
  // Process each post on its own page
  for (let index = 0; index < posts.length; index++) {
    const post = posts[index];
    
    // New page for each post
    doc.addPage();
    addCompactHeader(doc.getNumberOfPages());
    
    let yPosition = 20;
    
    // Post title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    const titleLines = doc.splitTextToSize(post.title || 'Untitled Post', 190);
    titleLines.forEach((line: string) => {
      if (yPosition > 285) {
        doc.addPage();
        addCompactHeader(doc.getNumberOfPages());
        yPosition = 20;
      }
      doc.text(line, 10, yPosition);
      yPosition += 5;
    });
    
    // Metadata line (compact)
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
    const author = post.author_name || 'Unknown';
    const postDate = post.wp_published_date ? new Date(post.wp_published_date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : 'No date';
    doc.text(`${author} | ${postDate}`, 10, yPosition);
    yPosition += 3;
    
    // Tags inline (compact)
    if (options.includeTags && post.tags && post.tags.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
      const tagsText = post.tags.slice(0, 5).join(' ');
      const tagLines = doc.splitTextToSize(tagsText, 190);
      doc.text(tagLines[0], 10, yPosition);
      yPosition += 3;
    }
    
    // Featured image (if exists)
    if (post.featured_media_url) {
      if (yPosition > 200) {
        doc.addPage();
        addCompactHeader(doc.getNumberOfPages());
        yPosition = 20;
      }
      try {
        const imageAdded = await addImageToPDF(doc, post.featured_media_url, 10, yPosition, 190);
        if (imageAdded.success) {
          yPosition = imageAdded.newY + 2;
        }
      } catch (error) {
        console.error('Failed to add featured image:', error);
      }
    }
    
    // Parse HTML content with formatting and images
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content || '';
    
    // Extract images and create placeholders
    const images = tempDiv.querySelectorAll('img');
    const imagePositions = new Map<string, { src: string; alt?: string }>();
    
    images.forEach((img, idx) => {
      const placeholder = `__IMG_${idx}__`;
      const src = img.src || img.getAttribute('data-src') || '';
      const alt = img.alt || img.getAttribute('alt') || '';
      if (src) {
        imagePositions.set(placeholder, { src, alt });
        const placeholderSpan = document.createElement('span');
        placeholderSpan.textContent = placeholder;
        img.replaceWith(placeholderSpan);
      }
    });
    
    // Parse HTML with formatting
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
          // Add text before image if any
          const beforeText = segment.text.substring(0, imgMatch.index || 0).trim();
          if (beforeText) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
            const lines = doc.splitTextToSize(beforeText, 190);
            lines.forEach((line: string) => {
              if (yPosition > 285) {
                doc.addPage();
                addCompactHeader(doc.getNumberOfPages());
                yPosition = 20;
              }
              doc.text(line, 10, yPosition);
              yPosition += 4;
            });
          }
          
          // Add image
          if (yPosition > 200) {
            doc.addPage();
            addCompactHeader(doc.getNumberOfPages());
            yPosition = 20;
          }
          
          try {
            const imageAdded = await addImageToPDF(doc, imgInfo.src, 10, yPosition, 190);
            if (imageAdded.success) {
              yPosition = imageAdded.newY + 2;
              // Add image caption if alt text exists
              if (imgInfo.alt) {
                doc.setFontSize(7);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
                doc.text(imgInfo.alt, 10, yPosition);
                yPosition += 3;
              }
            }
          } catch (error) {
            console.error('Failed to embed image:', error);
          }
          
          // Add text after image if any
          const afterText = segment.text.substring((imgMatch.index || 0) + placeholder.length).trim();
          if (afterText) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
            const lines = doc.splitTextToSize(afterText, 190);
            lines.forEach((line: string) => {
              if (yPosition > 285) {
                doc.addPage();
                addCompactHeader(doc.getNumberOfPages());
                yPosition = 20;
              }
              doc.text(line, 10, yPosition);
              yPosition += 4;
            });
          }
          continue;
        }
      }
      
      // Skip empty text segments
      if (!segment.text.trim()) continue;
      
      // Set font styles based on formatting
      if (segment.header) {
        // Headers - compact sizes
        const sizes = { 1: 14, 2: 12, 3: 11, 4: 10, 5: 9, 6: 9 };
        doc.setFontSize(sizes[segment.header] || 9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        
        // Minimal spacing before headers
        if (yPosition > 25) yPosition += 2;
      } else if (segment.code) {
        // Code blocks
        doc.setFontSize(8);
        doc.setFont('courier', 'normal');
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        
        // Light gray background for code
        const codeLines = doc.splitTextToSize(segment.text, 185);
        const codeHeight = codeLines.length * 3.5 + 1;
        if (yPosition + codeHeight > 285) {
          doc.addPage();
          addCompactHeader(doc.getNumberOfPages());
          yPosition = 20;
        }
        doc.setFillColor(247, 247, 247);
        doc.rect(10, yPosition - 2, 190, codeHeight, 'F');
      } else if (segment.blockquote) {
        // Blockquotes
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
      } else {
        // Regular text
        doc.setFontSize(9);
        const style = segment.bold && segment.italic ? 'bolditalic' :
                     segment.bold ? 'bold' :
                     segment.italic ? 'italic' : 'normal';
        doc.setFont('helvetica', style);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      }
      
      // Handle list items
      let textToRender = segment.text;
      let indent = 10;
      if (segment.listItem) {
        if (segment.list === 'bullet') {
          textToRender = `• ${segment.text}`;
        } else if (segment.list === 'number') {
          listCounter++;
          textToRender = `${listCounter}. ${segment.text}`;
        }
        indent = 15;
      } else if (!segment.listItem && listCounter > 0) {
        listCounter = 0;
      }
      
      // Handle blockquotes with left border
      if (segment.blockquote) {
        indent = 20;
        doc.setDrawColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        doc.setLineWidth(0.3);
      }
      
      // Split and render text
      const lines = doc.splitTextToSize(textToRender, 190 - (indent - 10));
      lines.forEach((line: string, lineIndex: number) => {
        if (yPosition > 285) {
          doc.addPage();
          addCompactHeader(doc.getNumberOfPages());
          yPosition = 20;
        }
        
        // Draw blockquote border
        if (segment.blockquote && lineIndex === 0) {
          doc.line(15, yPosition - 2, 15, yPosition + (lines.length * 4) - 2);
        }
        
        // Render text with potential link
        if (segment.link && !segment.code) {
          doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
          doc.textWithLink(line, indent, yPosition, { url: segment.link });
          doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        } else {
          doc.text(line, indent, yPosition);
        }
        
        yPosition += segment.code ? 3.5 : segment.header ? 4.5 : 4;
      });
      
      // Reset font after code blocks
      if (segment.code) {
        doc.setFont('helvetica', 'normal');
      }
      
      // Minimal spacing after elements
      if (segment.header) {
        yPosition += 1;
      } else if (segment.blockquote) {
        yPosition += 0.5;
      }
    }
    
    // Attachments - compact with image support
    if (post.attachments && post.attachments.length > 0) {
      if (yPosition > 275) {
        doc.addPage();
        addCompactHeader(doc.getNumberOfPages());
        yPosition = 20;
      }
      
      yPosition += 2;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text('Attachments:', 10, yPosition);
      yPosition += 3;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
      
      for (const attachment of post.attachments) {
        if (yPosition > 280) {
          doc.addPage();
          addCompactHeader(doc.getNumberOfPages());
          yPosition = 20;
        }
        
        // Check if attachment is an image
        const attachmentWithUrl = attachment as any;
        if (attachment.mime_type && attachment.mime_type.startsWith('image/') && attachmentWithUrl.url) {
          try {
            const imageAdded = await addImageToPDF(doc, attachmentWithUrl.url, 15, yPosition, 100);
            if (imageAdded.success) {
              // Add caption
              doc.setFontSize(7);
              doc.text((attachment as any).title || attachment.filename || 'Attachment', 15, imageAdded.newY + 2);
              yPosition = imageAdded.newY + 5;
            } else {
              // Text fallback
              const attachmentText = `• ${(attachment as any).title || attachment.filename || 'Attachment'}`;
              doc.text(attachmentText, 12, yPosition);
              yPosition += 3;
            }
          } catch (error) {
            // Text fallback
            const attachmentText = `• ${(attachment as any).title || attachment.filename || 'Attachment'}`;
            doc.text(attachmentText, 12, yPosition);
            yPosition += 3;
          }
        } else {
          // Non-image attachment
          const attachmentText = `• ${(attachment as any).title || attachment.filename || 'Attachment'} (${attachment.mime_type || 'file'})`;
          doc.text(attachmentText, 12, yPosition);
          if (attachmentWithUrl.url) {
            doc.setTextColor(accentBlue[0], accentBlue[1], accentBlue[2]);
            doc.textWithLink('[View]', 185, yPosition, { url: attachmentWithUrl.url });
            doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
          }
          yPosition += 3;
        }
      }
    }
    
    // Comments - very compact
    if (options.includeComments && post.comments && post.comments.length > 0) {
      if (yPosition > 270) {
        doc.addPage();
        addCompactHeader(doc.getNumberOfPages());
        yPosition = 20;
      }
      
      yPosition += 3;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(`Comments (${post.comments.length})`, 10, yPosition);
      yPosition += 3;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      
      post.comments.forEach((comment: any) => {
        if (yPosition > 282) {
          doc.addPage();
          addCompactHeader(doc.getNumberOfPages());
          yPosition = 20;
        }
        
        const commentAuthor = comment.author_name || comment.username || 'Anonymous';
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.text(commentAuthor + ':', 10, yPosition);
        yPosition += 3;
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
        const commentLines = doc.splitTextToSize(comment.content || '', 185);
        commentLines.forEach((line: string) => {
          if (yPosition > 285) {
            doc.addPage();
            addCompactHeader(doc.getNumberOfPages());
            yPosition = 20;
          }
          doc.text(line, 12, yPosition);
          yPosition += 3;
        });
        yPosition += 1;
      });
    }
  }
  
  // Add page numbers to footer
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(7);
  doc.setTextColor(mediumGray[0], mediumGray[1], mediumGray[2]);
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`${i} / ${pageCount}`, 105, 292, { align: 'center' });
  }
  
  return doc;
};

// Image loading and embedding function
async function addImageToPDF(doc: jsPDF, imageUrl: string, x: number, y: number, maxWidth: number) {
  try {
    const imageData = await loadImage(imageUrl);
    if (!imageData) {
      console.warn('Could not load image:', imageUrl);
      return { success: false, newY: y };
    }
    
    // Calculate dimensions
    const aspectRatio = imageData.height / imageData.width;
    let imgWidth = Math.min(maxWidth, imageData.width * 0.264583); // Convert pixels to mm
    let imgHeight = imgWidth * aspectRatio;
    
    // Limit height
    const maxHeight = 100;
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = imgHeight / aspectRatio;
    }
    
    // Check if fits on current page
    if (y + imgHeight > 285) {
      return { success: false, newY: y };
    }
    
    // Add the image
    doc.addImage(imageData.data, 'JPEG', x, y, imgWidth, imgHeight);
    return { success: true, newY: y + imgHeight };
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return { success: false, newY: y };
  }
}

// Load image with CORS support
async function loadImage(url: string): Promise<ImageInfo | null> {
  // Check cache first
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        
        // Limit canvas size for performance
        const maxDimension = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > maxDimension || height > maxDimension) {
          const scale = Math.min(maxDimension / width, maxDimension / height);
          width *= scale;
          height *= scale;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        
        const imageInfo = {
          width,
          height,
          data: dataUrl
        };
        
        imageCache.set(url, imageInfo);
        resolve(imageInfo);
      } catch (error) {
        console.error('Error processing image:', error);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      console.warn('Failed to load image:', url);
      resolve(null);
    };
    
    // Handle URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      img.src = url;
    } else if (url.startsWith('/')) {
      img.src = `${window.location.origin}${url}`;
    } else {
      img.src = url;
    }
    
    // Timeout
    setTimeout(() => resolve(null), 5000);
  });
}

export const downloadPDF = async (posts: PostWithComments[], filename?: string, options?: { includeComments?: boolean; includeTags?: boolean; user?: { username?: string; email?: string } }) => {
  const doc = await generatePDF(posts, options);
  const defaultFilename = `vector-export-${Date.now()}.pdf`;
  doc.save(filename || defaultFilename);
};