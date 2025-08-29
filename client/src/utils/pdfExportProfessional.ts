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

// Professional PDF color palette (for printing)
const colors = {
  primary: [0, 0, 0],            // Black for main headers
  secondary: [0, 0, 0],          // Black for body text
  accent: [0, 51, 153],          // Dark blue for links
  muted: [102, 102, 102],        // Gray for metadata
  light: [245, 245, 245],        // Light gray for backgrounds
  border: [204, 204, 204],       // Light gray border
  headerBg: [245, 245, 245],     // Light gray background for header
  headerText: [0, 0, 0],         // Black text for header
  bodyBg: [255, 255, 255],       // White background for body
  fieldBg: [250, 250, 250],      // Very light gray for field backgrounds
  success: [0, 128, 0],          // Green for success
  warning: [255, 140, 0],        // Orange for warnings
  danger: [220, 20, 60],         // Red for critical
  code: [0, 0, 0],               // Black for code
  codeBg: [245, 245, 245],       // Light gray background for code blocks
};

// Typography settings
const fonts = {
  heading: 'helvetica',
  body: 'helvetica',
  code: 'courier',
};

const fontSizes = {
  h1: 20,
  h2: 18,
  h3: 16,
  h4: 14,
  h5: 13,
  h6: 12,
  body: 12,
  small: 10,
  tiny: 9,
  code: 11,
};

const lineHeights = {
  heading: 1.5,
  body: 1.8,
  code: 1.5,
};

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
      const text = node.textContent;
      if (text) {
        // Clean up the text - remove excessive whitespace but preserve intentional spacing
        const cleanedText = text.replace(/\s+/g, ' ');
        if (cleanedText.trim()) {
          formatted.push({ ...parentStyles, text: cleanedText });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      let styles = { ...parentStyles };
      
      // Add paragraph break before block elements
      const isBlockElement = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre'].includes(tagName);
      if (isBlockElement && formatted.length > 0 && formatted[formatted.length - 1].text !== '\n\n') {
        formatted.push({ text: '\n\n', ...parentStyles });
      }
      
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
          formatted.push({ text: '\n', ...parentStyles });
          return;
        case 'p':
        case 'div':
          // Add line break before block elements if there's existing content
          if (formatted.length > 0 && !formatted[formatted.length - 1].text.endsWith('\n')) {
            formatted.push({ text: '\n', ...parentStyles });
          }
          break;
      }
      
      // Process children
      element.childNodes.forEach(child => processNode(child, styles));
      
      // Add line break after block elements and bold elements followed by line breaks
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'].includes(tagName)) {
        if (formatted.length > 0 && !formatted[formatted.length - 1].text.endsWith('\n')) {
          formatted.push({ text: '\n', ...parentStyles });
        }
      }
      
      // Special handling for bold text that appears to be a label (ends with colon or is short)
      if ((tagName === 'strong' || tagName === 'b') && formatted.length > 0) {
        const lastItem = formatted[formatted.length - 1];
        if (lastItem.bold && (lastItem.text.endsWith(':') || lastItem.text.length < 50)) {
          // This looks like a label, add extra spacing after it
          formatted.push({ text: '\n', ...parentStyles });
        }
      }
    }
  }
  
  tempDiv.childNodes.forEach(node => processNode(node));
  return formatted;
}

// Helper to load and embed images
async function loadImage(url: string): Promise<ImageInfo | null> {
  // Check cache first
  if (imageCache.has(url)) {
    return imageCache.get(url) || null;
  }

  try {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const timeout = setTimeout(() => {
        console.log('Image load timeout:', url);
        resolve(null);
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const info = {
              width: img.width,
              height: img.height,
              data: dataUrl
            };
            imageCache.set(url, info);
            resolve(info);
          } else {
            resolve(null);
          }
        } catch (err) {
          console.error('Canvas error:', err);
          resolve(null);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        console.log('Image load error:', url);
        resolve(null);
      };

      // Try direct URL first, then with proxy
      if (url.startsWith('http')) {
        img.src = url;
      } else if (url.startsWith('/')) {
        img.src = `${window.location.origin}${url}`;
      } else {
        img.src = url;
      }
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

// Add image to PDF with proper scaling
async function addImageToPDF(
  doc: jsPDF,
  imageUrl: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number = 80
): Promise<{ success: boolean; newY: number }> {
  try {
    const imageInfo = await loadImage(imageUrl);
    if (!imageInfo) {
      return { success: false, newY: y };
    }

    // Calculate dimensions maintaining aspect ratio
    let width = imageInfo.width;
    let height = imageInfo.height;
    const ratio = width / height;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / ratio;
    }

    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }

    // Check if image fits on current page
    if (y + height > 280) {
      return { success: false, newY: y };
    }

    doc.addImage(imageInfo.data, 'JPEG', x, y, width, height);
    return { success: true, newY: y + height };
  } catch (error) {
    console.error('Error adding image to PDF:', error);
    return { success: false, newY: y };
  }
}

export async function downloadPDF(
  posts: PostWithComments[],
  filename: string = 'threads-export.pdf',
  options: {
    includeComments?: boolean;
    includeTags?: boolean;
    user?: any;
  } = {}
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Add custom fonts if available
  doc.setProperties({
    title: filename.replace('.pdf', ''),
    subject: 'Threads Intelligence Export',
    author: options.user?.username || 'Threads Intel',
    keywords: 'threads, intelligence, export',
    creator: 'Threads Intelligence Platform'
  });

  let currentPage = 1;
  let yPosition = 20;

  // Professional header
  const addProfessionalHeader = (pageNum: number) => {
    // Light gray header background
    doc.setFillColor(colors.headerBg[0], colors.headerBg[1], colors.headerBg[2]);
    doc.rect(0, 0, 210, 15, 'F');
    
    // Organization name
    doc.setFont(fonts.heading, 'bold');
    doc.setFontSize(12);
    doc.setTextColor(colors.headerText[0], colors.headerText[1], colors.headerText[2]);
    doc.text('VECTOR INTELLIGENCE', 10, 10);
    
    // Page number
    doc.setFont(fonts.body, 'normal');
    doc.setFontSize(fontSizes.small);
    doc.setTextColor(colors.headerText[0], colors.headerText[1], colors.headerText[2]);
    doc.text(`Page ${pageNum}`, 195, 10, { align: 'right' });
  };

  // Add footer with law enforcement notice
  const addFooter = () => {
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.setLineWidth(0.3);
    doc.line(10, 285, 200, 285);
    
    doc.setFont(fonts.body, 'normal');
    doc.setFontSize(fontSizes.tiny);
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    
    // Left/Center: Law Enforcement notice
    doc.text('Law Enforcement Sensitive - Do Not Release Without Consent', 10, 290);
    
    // Right: Cherokee Sheriff's Office
    doc.text('Cherokee Sheriff\'s Office - Criminal Intelligence Division', 200, 290, { align: 'right' });
  };

  // Start with first post immediately - no title page or table of contents

  // Process each post
  for (let postIndex = 0; postIndex < posts.length; postIndex++) {
    const post = posts[postIndex];
    
    // Start new page for each post (first post gets page 1)
    if (postIndex === 0) {
      addProfessionalHeader(currentPage);
      addFooter();
      yPosition = 25;
    } else {
      doc.addPage();
      currentPage++;
      addProfessionalHeader(currentPage);
      addFooter();
      yPosition = 25;
    }

    // Post number indicator
    doc.setFont(fonts.body, 'normal');
    doc.setFontSize(fontSizes.tiny);
    doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
    doc.text(`Post ${postIndex + 1} of ${posts.length}`, 195, yPosition, { align: 'right' });

    // Post title with elegant styling
    doc.setFont(fonts.heading, 'bold');
    doc.setFontSize(fontSizes.h2);
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
    
    const titleLines = doc.splitTextToSize(post.title, 180);
    titleLines.forEach((line: string) => {
      if (yPosition > 270) {
        doc.addPage();
        currentPage++;
        addProfessionalHeader(currentPage);
        addFooter();
        yPosition = 25;
      }
      doc.text(line, 10, yPosition);
      yPosition += 7;
    });
    
    yPosition += 3;

    // Metadata section with icons/labels
    doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
    doc.roundedRect(10, yPosition - 3, 190, 20, 2, 2, 'F');
    
    doc.setFont(fonts.body, 'normal');
    doc.setFontSize(fontSizes.small);
    
    // Author
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    doc.setFont(fonts.body, 'bold');
    doc.text('Author:', 12, yPosition + 2);
    doc.setFont(fonts.body, 'normal');
    doc.text(post.author_name, 28, yPosition + 2);
    
    // Date Generated (instead of post date to avoid Invalid Date)
    doc.setFont(fonts.body, 'bold');
    doc.text('Date Generated:', 12, yPosition + 7);
    doc.setFont(fonts.body, 'normal');
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(generatedDate, 40, yPosition + 7);
    
    // Generated By (user who exported)
    if (options.user?.username) {
      doc.setFont(fonts.body, 'bold');
      doc.text('Generated By:', 100, yPosition + 7);
      doc.setFont(fonts.body, 'normal');
      doc.text(options.user.username, 125, yPosition + 7);
    }
    
    // Category
    if (post.category_name) {
      doc.setFont(fonts.body, 'bold');
      doc.text('Category:', 12, yPosition + 12);
      doc.setFont(fonts.body, 'normal');
      doc.text(post.category_name, 32, yPosition + 12);
    }
    
    // Tags
    if (options.includeTags && post.tags && post.tags.length > 0) {
      doc.setFont(fonts.body, 'bold');
      doc.text('Tags:', 100, yPosition + 2);
      doc.setFont(fonts.body, 'normal');
      doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
      const tagStr = post.tags.slice(0, 5).join(', ');
      doc.text(tagStr, 112, yPosition + 2);
      doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
    }
    
    yPosition += 22;

    // Content section with professional formatting
    const formattedContent = parseHtmlToFormattedText(post.content);
    let listCounter = 0;
    
    for (const segment of formattedContent) {
      // Check for page break
      if (yPosition > 270) {
        doc.addPage();
        currentPage++;
        addProfessionalHeader(currentPage);
        addFooter();
        yPosition = 25;
      }
      
      // Handle line breaks - proper paragraph spacing
      if (segment.text === '\n\n') {
        yPosition += 6; // Full paragraph break (like Word)
        continue;
      } else if (segment.text === '\n') {
        yPosition += 3; // Single line break
        continue;
      }
      
      // Skip completely empty text segments (but not line breaks)
      if (!segment.text.trim()) continue;
      
      // Set font styles based on formatting
      if (segment.header) {
        // Headers with proper spacing and typography
        const headerSizes = {
          1: fontSizes.h1,
          2: fontSizes.h2,
          3: fontSizes.h3,
          4: fontSizes.h4,
          5: fontSizes.h5,
          6: fontSizes.h6
        };
        
        // Add minimal space before headers
        if (yPosition > 30) yPosition += segment.header <= 2 ? 2 : 1;
        
        doc.setFontSize(headerSizes[segment.header] || fontSizes.h6);
        doc.setFont(fonts.heading, 'bold');
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      } else if (segment.code) {
        // Code blocks with background
        doc.setFontSize(fontSizes.code);
        doc.setFont(fonts.code, 'normal');
        doc.setTextColor(colors.code[0], colors.code[1], colors.code[2]);
        
        // Calculate code block dimensions
        const codeLines = doc.splitTextToSize(segment.text, 180);
        const codeHeight = codeLines.length * 4 + 4;
        
        if (yPosition + codeHeight > 270) {
          doc.addPage();
          currentPage++;
          addProfessionalHeader(currentPage);
          addFooter();
          yPosition = 25;
        }
        
        // Code background
        doc.setFillColor(colors.codeBg[0], colors.codeBg[1], colors.codeBg[2]);
        doc.roundedRect(12, yPosition - 2, 186, codeHeight, 1, 1, 'F');
      } else if (segment.blockquote) {
        // Blockquotes with elegant styling
        doc.setFontSize(fontSizes.body);
        doc.setFont(fonts.body, 'italic');
        doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
      } else {
        // Regular text with proper typography
        doc.setFontSize(fontSizes.body);
        const style = segment.bold && segment.italic ? 'bolditalic' :
                     segment.bold ? 'bold' :
                     segment.italic ? 'italic' : 'normal';
        doc.setFont(fonts.body, style);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
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
        indent = 18;
      } else if (!segment.listItem && listCounter > 0) {
        listCounter = 0;
      }
      
      // Handle blockquotes with left accent
      if (segment.blockquote) {
        indent = 20;
        doc.setDrawColor(colors.accent[0], colors.accent[1], colors.accent[2]);
        doc.setLineWidth(1.5);
      }
      
      // Split and render text
      const lines = doc.splitTextToSize(textToRender, 190 - (indent - 10));
      
      lines.forEach((line: string, lineIndex: number) => {
        if (yPosition > 270) {
          doc.addPage();
          currentPage++;
          addProfessionalHeader(currentPage);
          addFooter();
          yPosition = 25;
        }
        
        // Draw blockquote accent line
        if (segment.blockquote && lineIndex === 0) {
          doc.line(15, yPosition - 2, 15, yPosition + (lines.length * 5) - 2);
        }
        
        // Render text with potential link
        if (segment.link && !segment.code) {
          doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2]);
          doc.textWithLink(line, indent, yPosition, { url: segment.link });
          doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        } else if (segment.header && segment.header <= 3) {
          // Check if this is an intel report field that should be left-aligned
          const isIntelField = line.includes('Date of Report') || 
                              line.includes('Time of Report') || 
                              line.includes('Incident Location') || 
                              line.includes('Report Title');
          
          // Center "Investigative Narrative" title specifically
          const isNarrativeTitle = line === 'Investigative Narrative' || 
                                  line === 'INVESTIGATIVE NARRATIVE';
          
          if (isIntelField) {
            // Left align intel report fields
            doc.text(line, indent, yPosition);
          } else if (isNarrativeTitle) {
            // Center the Investigative Narrative title
            doc.text(line, 105, yPosition, { align: 'center' });
          } else {
            // Center other h1, h2, h3 headers
            doc.text(line, 105, yPosition, { align: 'center' });
          }
        } else if (!segment.code && !segment.listItem && line.length < 60 && 
                   !line.includes('Date of Report') &&
                   !line.includes('Time of Report') &&
                   !line.includes('Incident Location') &&
                   !line.includes('Report Title') &&
                   !line.match(/^\d{1,2}:\d{2} [AP]M$/i) && // Don't center time values
                   !line.match(/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}$/i) && // Don't center dates
                   (line === line.toUpperCase() || // All caps
                    line.match(/^\d{2}-\d{4}-\d{2}-\d{2}$/) || // Case number format
                    line.match(/^[A-Z][a-z]+ [A-Z][a-z]+ /) || // Title case multi-word
                    line === 'Investigative Narrative' || // Center this specific title
                    line === 'INVESTIGATIVE NARRATIVE' || // Center uppercase version
                    line.includes('Report') ||
                    line.includes('Squad'))) {
          // Center text that looks like headers (all caps, case numbers, or title-like) 
          // unless they are intel report fields or time/date values
          doc.text(line, 105, yPosition, { align: 'center' });
        } else if (segment.bold && segment.text.trim().startsWith('Time of Report:')) {
          // Special handling for Time of Report - ensure the value is left-aligned
          doc.text(line, indent, yPosition);
        } else {
          doc.text(line, segment.code ? 15 : indent, yPosition);
        }
        
        // Professional line spacing (like Word document)
        const lineSpacing = segment.header ? 8 :
                          segment.code ? 5 :
                          segment.blockquote ? 6 : 
                          6;
        yPosition += lineSpacing;
      });
      
      // Add professional spacing after elements (like Word)
      if (segment.header) {
        yPosition += segment.header <= 2 ? 5 : 3;
      } else if (segment.blockquote) {
        yPosition += 3;
      } else if (segment.code) {
        yPosition += 3;
      } else if (segment.bold && segment.text.trim().endsWith(':')) {
        // Add space after bold labels (like "Date of Report:")
        yPosition += 2;
      } else if (!segment.header && !segment.code && !segment.blockquote) {
        // Add small space after regular paragraphs
        yPosition += 1;
      }
    }
    
    // Images and attachments
    if (post.attachments && post.attachments.length > 0) {
      if (yPosition > 260) {
        doc.addPage();
        currentPage++;
        addProfessionalHeader(currentPage);
        addFooter();
        yPosition = 25;
      }
      
      yPosition += 5;
      doc.setFont(fonts.heading, 'bold');
      doc.setFontSize(fontSizes.h4);
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.text('Attachments', 10, yPosition);
      yPosition += 6;
      
      for (const attachment of post.attachments) {
        if (yPosition > 260) {
          doc.addPage();
          currentPage++;
          addProfessionalHeader(currentPage);
          addFooter();
          yPosition = 25;
        }
        
        const attachmentWithUrl = attachment as any;
        if (attachment.mime_type?.startsWith('image/') && attachmentWithUrl.url) {
          try {
            const imageResult = await addImageToPDF(doc, attachmentWithUrl.url, 15, yPosition, 120, 100);
            if (imageResult.success) {
              // Add image caption
              doc.setFont(fonts.body, 'italic');
              doc.setFontSize(fontSizes.small);
              doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
              doc.text(attachmentWithUrl.title || attachment.filename || 'Image', 15, imageResult.newY + 3);
              yPosition = imageResult.newY + 8;
            } else {
              // Fallback to text
              doc.setFont(fonts.body, 'normal');
              doc.setFontSize(fontSizes.small);
              doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
              doc.text(`• ${attachmentWithUrl.title || attachment.filename || 'Attachment'}`, 15, yPosition);
              yPosition += 5;
            }
          } catch (error) {
            console.error('Error processing attachment:', error);
          }
        } else {
          // Non-image attachment
          doc.setFont(fonts.body, 'normal');
          doc.setFontSize(fontSizes.small);
          doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
          doc.text(`• ${(attachment as any).title || attachment.filename || 'File'}`, 15, yPosition);
          yPosition += 5;
        }
      }
    }
    
    // Comments section
    if (options.includeComments && post.comments && post.comments.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        currentPage++;
        addProfessionalHeader(currentPage);
        addFooter();
        yPosition = 25;
      }
      
      yPosition += 8;
      doc.setFont(fonts.heading, 'bold');
      doc.setFontSize(fontSizes.h4);
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.text(`Comments (${post.comments.length})`, 10, yPosition);
      yPosition += 6;
      
      post.comments.forEach((comment, idx) => {
        if (yPosition > 260) {
          doc.addPage();
          currentPage++;
          addProfessionalHeader(currentPage);
          addFooter();
          yPosition = 25;
        }
        
        // Comment box with subtle background
        const commentLines = doc.splitTextToSize(comment.content, 175);
        const commentHeight = commentLines.length * 4 + 8;
        
        if (yPosition + commentHeight > 270) {
          doc.addPage();
          currentPage++;
          addProfessionalHeader(currentPage);
          addFooter();
          yPosition = 25;
        }
        
        // Comment background
        doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
        doc.roundedRect(12, yPosition - 2, 186, commentHeight, 1, 1, 'F');
        
        // Comment author and date
        doc.setFont(fonts.body, 'bold');
        doc.setFontSize(fontSizes.small);
        doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
        doc.text(comment.username || comment.author_name || 'Anonymous', 15, yPosition + 2);
        
        if (comment.created_at) {
          doc.setFont(fonts.body, 'normal');
          doc.setFontSize(fontSizes.tiny);
          doc.setTextColor(colors.muted[0], colors.muted[1], colors.muted[2]);
          const commentDate = new Date(comment.created_at).toLocaleDateString();
          doc.text(commentDate, 195, yPosition + 2, { align: 'right' });
        }
        
        // Comment content
        doc.setFont(fonts.body, 'normal');
        doc.setFontSize(fontSizes.small);
        doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
        
        yPosition += 6;
        commentLines.forEach((line: string) => {
          doc.text(line, 15, yPosition);
          yPosition += 4;
        });
        
        yPosition += 4;
      });
    }
  }

  // Save the PDF
  doc.save(filename);
}