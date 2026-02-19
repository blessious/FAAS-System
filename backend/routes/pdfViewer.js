const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Serve PDF through PDF.js viewer
router.get('/view/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename || !filename.endsWith('.pdf')) {
      return res.status(400).json({ error: 'Invalid PDF filename' });
    }
    
    // Check if file exists
    const pythonDir = path.resolve(__dirname, '../python');
    const pdfDir = path.join(pythonDir, 'generated/generated-pdf');
    const filePath = path.join(pdfDir, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF not found' });
    }
    
    // Create HTML with PDF.js viewer
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>FAAS Preview - ${filename}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          height: 100vh;
          overflow: hidden;
        }
        
        .viewer-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
        }
        
        .viewer-header {
          background: white;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          z-index: 10;
        }
        
        .viewer-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .header-actions {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        
        .btn {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
        }
        
        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        
        .btn-primary:hover {
          background: #2563eb;
        }
        
        .btn-outline {
          background: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        
        .btn-outline:hover {
          background: #f9fafb;
        }
        
        #pdf-viewer {
          flex: 1;
          border: none;
          width: 100%;
        }
        
        .pdfjs-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 2rem;
          text-align: center;
          color: #6b7280;
        }
        
        .pdfjs-error h3 {
          color: #ef4444;
          margin-bottom: 0.5rem;
        }
      </style>
    </head>
    <body>
      <div class="viewer-container">
        <div class="viewer-header">
          <h2>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M10 9H8"/>
              <path d="M16 13H8"/>
              <path d="M16 17H8"/>
            </svg>
            FAAS Document: ${filename}
          </h2>
          <div class="header-actions">
            <a href="/api/files/pdf/${filename}" download="${filename}" class="btn btn-outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
            <button onclick="window.print()" class="btn btn-outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print
            </button>
            <button onclick="window.close()" class="btn btn-outline">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close
            </button>
          </div>
        </div>
        
        <iframe 
          id="pdf-viewer"
          src="/pdfjs/web/viewer.html?file=/api/files/pdf/${encodeURIComponent(filename)}"
          title="PDF Viewer"
        ></iframe>
        
        <div id="fallback-message" class="pdfjs-error" style="display: none;">
          <h3>Unable to load PDF viewer</h3>
          <p>Please try downloading the file instead.</p>
          <a href="/api/files/pdf/${filename}" download="${filename}" class="btn btn-primary" style="margin-top: 1rem;">
            Download PDF
          </a>
        </div>
      </div>
      
      <script>
        // Check if PDF.js loaded successfully
        setTimeout(() => {
          const iframe = document.getElementById('pdf-viewer');
          const fallback = document.getElementById('fallback-message');
          
          if (iframe && iframe.contentDocument && iframe.contentDocument.body.innerHTML.includes('PDF.js')) {
            // PDF.js loaded successfully
            console.log('PDF.js viewer loaded');
          } else {
            // Show fallback message
            iframe.style.display = 'none';
            fallback.style.display = 'flex';
          }
        }, 2000);
      </script>
    </body>
    </html>`;
    
    res.send(html);
    
  } catch (error) {
    console.error('Error serving PDF viewer:', error);
    res.status(500).json({ error: 'Failed to load PDF viewer' });
  }
});

module.exports = router;