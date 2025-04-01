const fs = require('fs');
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

// List of markdown files in the order we want to combine them
const files = [
  'README.md',
  '01-system-overview.md',
  '02-fastapi-architecture.md',
  '03-design-patterns.md',
  '04-provider-system.md',
  '05-file-processing.md',
  '06-security.md',
  '07-aws-integration.md',
  '08-error-handling.md'
];

// Create the HTML header with styles
const htmlHeader = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Octo FastAPI Documentation</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 {
      border-bottom: 2px solid #4285f4;
      padding-bottom: 10px;
      margin-top: 40px;
    }
    h2 {
      margin-top: 30px;
      border-bottom: 1px solid #e0e0e0;
      padding-bottom: 5px;
    }
    h3 {
      margin-top: 25px;
    }
    code {
      background-color: #f5f5f5;
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
    }
    pre {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: monospace;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    table, th, td {
      border: 1px solid #ddd;
    }
    th, td {
      padding: 10px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin-left: 0;
      padding-left: 20px;
      color: #666;
    }
    a {
      color: #4285f4;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    img {
      max-width: 100%;
    }
    .toc {
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .toc ul {
      list-style-type: none;
    }
    .page-break {
      page-break-after: always;
    }
    @media print {
      body {
        font-size: 12pt;
      }
      h1 {
        font-size: 24pt;
      }
      h2 {
        font-size: 18pt;
      }
      h3 {
        font-size: 14pt;
      }
      pre, code {
        font-size: 10pt;
      }
    }
  </style>
</head>
<body>
  <div class="document">
`;

// Create the HTML footer
const htmlFooter = `
  </div>
</body>
</html>
`;

// Read all markdown files, convert to HTML, and combine
let combinedHtml = htmlHeader;
let toc = '<div class="toc"><h2>Table of Contents</h2><ul>';

files.forEach((file, index) => {
  const content = fs.readFileSync(file, 'utf8');
  const html = md.render(content);

  // Add to table of contents if it has a top-level heading
  const firstHeadingMatch = content.match(/^# (.+)/m);
  if (firstHeadingMatch) {
    const heading = firstHeadingMatch[1];
    toc += `<li><a href="#section-${index}">${heading}</a></li>`;
  }

  // Add section with anchor for TOC linking
  combinedHtml += `<div id="section-${index}" class="section">${html}</div>`;

  // Add page break between sections (except the last one)
  if (index < files.length - 1) {
    combinedHtml += '<div class="page-break"></div>';
  }
});

toc += '</ul></div>';

// Insert TOC after header
combinedHtml = htmlHeader + toc + combinedHtml.substring(htmlHeader.length);

// Add footer
combinedHtml += htmlFooter;

// Write the combined HTML to a file
fs.writeFileSync('octo-fastapi-documentation.html', combinedHtml);

console.log('Documentation generated: octo-fastapi-documentation.html');
