const pdfGenerator = require('./services/pdfGenerator');
const fs = require('fs');
const path = require('path');

async function testLocalPDF() {
  try {
    console.log('Testing PDF Generation Locally...\n');
    
    // Create sample posts data
    const posts = [
      {
        id: 1,
        title: 'Introduction to Vector Security Platform',
        content: `Welcome to the Vector Security Platform. This comprehensive system provides:
        
- Real-time threat monitoring and detection
- Advanced analytics and reporting
- Compliance tracking and audit trails
- Incident response management
- Security metrics dashboard

Our platform ensures your organization stays compliant with CJIS security requirements while maintaining operational efficiency.`,
        author_name: 'Security Admin',
        created_at: new Date('2025-01-15'),
        likes_count: 42,
        tags: ['#security', '#cjis', '#compliance'],
        comments: [
          {
            author_name: 'John Doe',
            content: 'Great overview of the platform capabilities!',
            created_at: new Date('2025-01-16')
          },
          {
            author_name: 'Jane Smith',
            content: 'The compliance tracking feature is exactly what we needed.',
            created_at: new Date('2025-01-17')
          }
        ]
      },
      {
        id: 2,
        title: 'Best Practices for Data Encryption',
        content: `Implementing proper data encryption is crucial for maintaining security. Key considerations include:

1. Use AES-256 encryption for data at rest
2. Implement TLS 1.3 for data in transit
3. Rotate encryption keys regularly
4. Store keys securely in a key management system
5. Audit all encryption/decryption operations

Remember: encryption is only as strong as your key management practices.`,
        author_name: 'Crypto Expert',
        created_at: new Date('2025-01-20'),
        likes_count: 28,
        tags: ['#encryption', '#security', '#bestpractices'],
        comments: []
      },
      {
        id: 3,
        title: 'Incident Response Procedures',
        content: `When a security incident occurs, follow these steps:

DETECT: Identify the incident through monitoring systems
CONTAIN: Isolate affected systems to prevent spread
INVESTIGATE: Determine the scope and impact
REMEDIATE: Remove threats and patch vulnerabilities
RECOVER: Restore normal operations
DOCUMENT: Create detailed incident report

Time is critical - every minute counts in incident response.`,
        author_name: 'IR Team Lead',
        created_at: new Date('2025-01-25'),
        likes_count: 35,
        tags: ['#incident-response', '#security', '#procedures'],
        comments: [
          {
            author_name: 'Security Analyst',
            content: 'This checklist has been invaluable during recent incidents.',
            created_at: new Date('2025-01-26')
          }
        ]
      }
    ];
    
    const user = {
      id: 1,
      username: 'testuser',
      email: 'test@vector.com'
    };
    
    const options = {
      includeComments: true,
      includeTags: true,
      dateRange: 'January 2025'
    };
    
    console.log('Generating PDF with Vector branding...');
    const pdfBuffer = await pdfGenerator.generatePostsPDF(posts, user, options);
    
    // Save PDF to file
    const outputPath = path.join(__dirname, `vector-test-export-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBuffer);
    
    console.log(`✅ PDF generated successfully!`);
    console.log(`📄 File saved to: ${outputPath}`);
    console.log(`📊 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`\n✨ Features included:`);
    console.log(`   - Vector branding and colors`);
    console.log(`   - ${posts.length} posts with content`);
    console.log(`   - Comments for each post`);
    console.log(`   - Tags displayed`);
    console.log(`   - Professional formatting`);
    
    // Cleanup
    await pdfGenerator.cleanup();
    
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    await pdfGenerator.cleanup();
  }
}

// Run the test
testLocalPDF();