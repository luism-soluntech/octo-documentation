const fs = require('fs');
const HTMLtoDOCX = require('html-to-docx');

// Read the HTML file
const html = fs.readFileSync('octo-fastapi-documentation.html', 'utf8');

// Convert HTML to DOCX
async function generateDocx() {
  try {
    const docxBuffer = await HTMLtoDOCX(html, null, {
      title: 'Octo FastAPI Documentation',
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    // Save the DOCX file
    fs.writeFileSync('octo-fastapi-documentation.docx', docxBuffer);
    console.log('Word document generated: octo-fastapi-documentation.docx');
  } catch (error) {
    console.error('Error generating Word document:', error);
  }
}

generateDocx();
