# Aurora Aqua Web Scraper

A comprehensive web scraper designed to extract all data from the existing Aurora Aqua website, ready to be used in the new 3D website implementation.

## Features

- 📄 **Complete Site Scraper**: Extracts all pages, content, and assets
- 📸 **Image Downloader**: Downloads all images with proper file handling
- 🏗️ **Structured Data**: Outputs data in well-organized JSON format
- 📊 **Metadata Extraction**: Captures page titles, descriptions, keywords, and navigation
- 🎯 **Section Detection**: Identifies semantic sections (hero, features, services, etc.)
- 📈 **Detailed Reporting**: Generates scraping summary and statistics
- 📱 **Responsive Design**: Handles mobile and desktop layouts

## Installation

```bash
# Navigate to scraper directory
cd webscraper

# Install dependencies
npm install
```

## Usage

```bash
# Run the scraper
npm run scrape

# Clean output directory
npm run clean
```

## Output Structure

```
webscraper/output/
├── data/
│   ├── all-pages.json        # Complete data for all scraped pages
│   ├── sitemap.json         # Site map with all page metadata
│   ├── images.json          # Images metadata with download info
│   └── manifest.json        # Scraping statistics and summary
├── images/                  # Downloaded images (optimized filenames)
└── SCRAPING_SUMMARY.md      # Human-readable summary of scraping results
```

## Data Format

### Page Data Structure

```json
{
  "url": "https://www.auroraaqua.in/page",
  "title": "Page Title",
  "metaDescription": "Page description...",
  "metaKeywords": "keywords, for, page",
  "content": [
    {
      "tag": "h1",
      "text": "Main Heading"
    },
    {
      "tag": "p",
      "text": "Paragraph content..."
    }
  ],
  "images": [
    {
      "src": "https://www.auroraaqua.in/image.jpg",
      "alt": "Image description",
      "title": "Image title"
    }
  ],
  "navigation": [
    {
      "text": "Home",
      "url": "https://www.auroraaqua.in/",
      "isExternal": false
    }
  ],
  "sections": [
    {
      "id": "hero",
      "class": "hero-section",
      "content": [
        {
          "tag": "h1",
          "text": "Welcome to Aurora Aqua"
        }
      ]
    }
  ]
}
```

## Features Extracted

### Content Types
- Page titles and metadata
- Paragraphs and headings
- Lists (ordered and unordered)
- Images with alt text
- Navigation links
- Semantic sections

### Assets
- All images in JPG/PNG/WebP/GIF formats
- Optimized file names using slugification

### Structure
- Complete site map
- Navigation hierarchy
- Section-based content organization
- Responsive data structure

## Performance

- Handles rate limiting to avoid overwhelming the server
- Parallel image downloads for efficiency
- Memory optimized data processing
- Detailed error handling and logging

## Requirements

- Node.js 14.x or higher
- npm 6.x or higher
- Stable internet connection

## Legal Notice

This scraper is intended for personal use only to migrate your existing website data to a new platform. Please ensure you have the right to scrape and use this data. Respect the website's `robots.txt` and terms of service.

## Troubleshooting

### Common Issues

1. **Network Errors**: Check your internet connection and try again
2. **Rate Limiting**: The scraper automatically handles this with delays
3. **Image Download Failures**: Check if images are accessible directly

### Debugging

```bash
# Run scraper with detailed logging
DEBUG=scraper:* npm run scrape
```

## Future Improvements

- [ ] PDF document extraction
- [ ] Video and audio asset download
- [ ] Social media metadata extraction
- [ ] Advanced content classification
- [ ] Export to Markdown/HTML formats

## License

MIT License - Feel free to use this scraper for your project

## Contact

For questions or support, please contact the Aurora Aqua team.
