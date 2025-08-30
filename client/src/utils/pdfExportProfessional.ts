import jsPDF from 'jspdf';
import { Post } from '../types';

interface PostWithComments extends Post {
  comments?: Array<{
    content: string;
    author_name?: string;
    username?: string;
    created_at?: string;
  }>;
}

export async function generateProfessionalPDF(
  posts: PostWithComments[],
  reportMetadata?: {
    reportTitle?: string;
    author?: string;
    unit?: string;
    classification?: string;
    category?: string;
  }
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter'
  });

  // Use Courier (monospace) font for the entire document
  doc.setFont('courier', 'normal');
  
  const pageWidth = 8.5;
  const pageHeight = 11;
  const leftMargin = 0.75;
  const rightMargin = 0.75;
  const topMargin = 0.75;
  const bottomMargin = 0.75;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  
  let currentPage = 1;
  const totalPages = posts.length;
  
  // Process each post as a separate page
  posts.forEach((post, index) => {
    if (index > 0) {
      doc.addPage();
      currentPage++;
    }
    
    let yPosition = topMargin;
    
    // Header - VECTOR INTELLIGENCE with page number
    doc.setFontSize(10);
    doc.setFont('courier', 'bold');
    
    // Split VECTOR and INTELLIGENCE with spaces
    const vectorText = 'V E C T O R';
    const intelligenceText = 'I N T E L L I G E N C E';
    
    // Blue color for VECTOR
    doc.setTextColor(0, 123, 255);
    doc.text(vectorText, leftMargin, yPosition);
    
    // Measure VECTOR text width
    const vectorWidth = doc.getTextWidth(vectorText);
    
    // Black color for INTELLIGENCE
    doc.setTextColor(0, 0, 0);
    doc.text(intelligenceText, leftMargin + vectorWidth + 0.5, yPosition);
    
    // Page number on the right
    doc.setFont('courier', 'normal');
    const pageText = `Page ${currentPage}`;
    doc.text(pageText, pageWidth - rightMargin - doc.getTextWidth(pageText), yPosition);
    
    yPosition += 0.15;
    
    // Security banner
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const securityText = 'Law Enforcement Sensitive - Do Not Release Without Consent';
    const unitText = reportMetadata?.unit || 'Cherokee Sheriff\'s Office - Criminal Intelligence Division';
    doc.text(securityText, leftMargin, yPosition);
    yPosition += 0.1;
    doc.text(unitText, pageWidth - rightMargin - doc.getTextWidth(unitText), yPosition);
    
    yPosition += 0.25;
    
    // Intel Report Number/Post ID and post count
    doc.setFontSize(12);
    doc.setFont('courier', 'bold');
    const reportNumber = post.intel_number || `${post.id}`;
    doc.text(reportNumber, leftMargin, yPosition);
    
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    const postCount = `Post ${index + 1} of ${totalPages}`;
    doc.text(postCount, pageWidth - rightMargin - doc.getTextWidth(postCount), yPosition);
    
    yPosition += 0.25;
    
    // Author and Date Generated block with gray background
    doc.setFillColor(240, 240, 240);
    doc.rect(leftMargin, yPosition - 0.05, contentWidth, 0.35, 'F');
    
    doc.setFontSize(10);
    doc.setFont('courier', 'normal');
    doc.setTextColor(0, 0, 0);
    
    // Author line
    doc.text('Author:', leftMargin + 0.1, yPosition + 0.05);
    doc.text(post.author_name || post.agent_name || 'Unknown', leftMargin + 1.2, yPosition + 0.05);
    
    // Date Generated line
    doc.text('Date Generated:', leftMargin + 0.1, yPosition + 0.2);
    const generatedDate = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    const generatedTime = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    doc.text(`${generatedDate}, ${generatedTime}`, leftMargin + 1.8, yPosition + 0.2);
    
    yPosition += 0.5;
    
    // Unit/Agency Name - centered
    doc.setFontSize(14);
    doc.setFont('courier', 'bold');
    const agencyName = reportMetadata?.unit?.split('-')[0]?.trim() || 'Cherokee Multi-Agency Narcotics Squad';
    const agencyWidth = doc.getTextWidth(agencyName);
    doc.text(agencyName, (pageWidth - agencyWidth) / 2, yPosition);
    
    yPosition += 0.3;
    
    // Document Type
    doc.setFontSize(12);
    doc.setFont('courier', 'normal');
    const docType = post.classification === 'Intelligence Report' ? 'Investigative Narrative' : post.category_name || 'Report';
    doc.text(docType, leftMargin, yPosition);
    
    yPosition += 0.3;
    
    // Report Number (centered)
    doc.setFontSize(14);
    doc.setFont('courier', 'bold');
    const reportNumWidth = doc.getTextWidth(reportNumber);
    doc.text(reportNumber, (pageWidth - reportNumWidth) / 2, yPosition);
    
    yPosition += 0.3;
    
    // Report Title (centered)
    doc.setFontSize(12);
    doc.setFont('courier', 'normal');
    const reportTitle = post.title || 'Untitled Report';
    const titleWidth = doc.getTextWidth(reportTitle);
    doc.text(reportTitle, (pageWidth - titleWidth) / 2, yPosition);
    
    yPosition += 0.4;
    
    // Report Fields - Each label on its own line, value on next line
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    
    // Date of Report
    if (post.date || post.created_at) {
      doc.text('Date of Report', leftMargin, yPosition);
      yPosition += 0.15;
      doc.setFont('courier', 'normal');
      const reportDate = post.date ? 
        new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) :
        new Date(post.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      doc.text(reportDate, leftMargin, yPosition);
      yPosition += 0.25;
    }
    
    // Time of Report
    if (post.time || post.created_at) {
      doc.setFont('courier', 'bold');
      doc.text('Time of Report', leftMargin, yPosition);
      yPosition += 0.15;
      doc.setFont('courier', 'normal');
      const reportTime = post.time || 
        new Date(post.created_at).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
      // CRITICAL: No leading spaces - value must align with label above
      doc.text(reportTime, leftMargin, yPosition);
      yPosition += 0.25;
    }
    
    // Incident Location
    if (post.incident_location || post.location) {
      doc.setFont('courier', 'bold');
      doc.text('Incident Location', leftMargin, yPosition);
      yPosition += 0.15;
      doc.setFont('courier', 'normal');
      const location = post.incident_location || post.location || 'Not specified';
      doc.text(location, leftMargin, yPosition);
      yPosition += 0.25;
    }
    
    // Report Title field (if different from header title)
    if (post.subject) {
      doc.setFont('courier', 'bold');
      doc.text('Report Title', leftMargin, yPosition);
      yPosition += 0.15;
      doc.setFont('courier', 'normal');
      doc.text(post.subject, leftMargin, yPosition);
      yPosition += 0.25;
    }
    
    // Narrative section
    yPosition += 0.2;
    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    const narrativeLabel = 'Narrative';
    const narrativeWidth = doc.getTextWidth(narrativeLabel);
    doc.text(narrativeLabel, (pageWidth - narrativeWidth) / 2, yPosition);
    
    yPosition += 0.25;
    
    // Narrative content
    doc.setFont('courier', 'normal');
    doc.setFontSize(11);
    
    const narrative = post.summary || post.content || 'No narrative available.';
    const lines = doc.splitTextToSize(narrative, contentWidth);
    
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - bottomMargin - 0.5) {
        // Add footer before page break
        addFooter(doc, currentPage);
        
        doc.addPage();
        currentPage++;
        yPosition = topMargin;
        
        // Repeat header on new page
        addHeader(doc, currentPage, reportNumber, postCount);
        yPosition = topMargin + 0.8;
      }
      
      doc.text(line, leftMargin, yPosition);
      yPosition += 0.15;
    });
    
    // Add footer to current page
    addFooter(doc, currentPage);
  });
  
  // Save the PDF
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = reportMetadata?.reportTitle ? 
    `${reportMetadata.reportTitle.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.pdf` :
    `intel_report_${timestamp}.pdf`;
  
  doc.save(filename);
}

function addHeader(doc: jsPDF, pageNum: number, reportNumber: string, postCount: string) {
  const pageWidth = 8.5;
  const leftMargin = 0.75;
  const rightMargin = 0.75;
  const topMargin = 0.75;
  
  // Header - VECTOR INTELLIGENCE with page number
  doc.setFontSize(10);
  doc.setFont('courier', 'bold');
  
  const vectorText = 'V E C T O R';
  const intelligenceText = 'I N T E L L I G E N C E';
  
  doc.setTextColor(0, 123, 255);
  doc.text(vectorText, leftMargin, topMargin);
  
  const vectorWidth = doc.getTextWidth(vectorText);
  
  doc.setTextColor(0, 0, 0);
  doc.text(intelligenceText, leftMargin + vectorWidth + 0.5, topMargin);
  
  doc.setFont('courier', 'normal');
  const pageText = `Page ${pageNum}`;
  doc.text(pageText, pageWidth - rightMargin - doc.getTextWidth(pageText), topMargin);
}

function addFooter(doc: jsPDF, pageNum: number) {
  const pageWidth = 8.5;
  const pageHeight = 11;
  const leftMargin = 0.75;
  const rightMargin = 0.75;
  const bottomMargin = 0.75;
  
  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  doc.setTextColor(102, 102, 102);
  
  const footerText = 'Law Enforcement Sensitive - Do Not Release Without Consent';
  const unitText = 'Cherokee Sheriff\'s Office - Criminal Intelligence Division';
  
  doc.text(footerText, leftMargin, pageHeight - bottomMargin + 0.2);
  doc.text(unitText, pageWidth - rightMargin - doc.getTextWidth(unitText), pageHeight - bottomMargin + 0.2);
}

// Export default for backward compatibility
export default { generateProfessionalPDF };