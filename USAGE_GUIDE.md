# Aurora Aqua - Scraped Data Usage Guide

This guide explains how to use the scraped data from the Aurora Aqua website in your new 3D website project.

## Data Structure Overview

```
webscraper/output/
├── data/
│   ├── all-pages.json        # Complete data from all scraped pages
│   ├── sitemap.json         # Site structure and page metadata
│   ├── images.json          # Images with metadata and filenames
│   └── manifest.json        # Scraping statistics
├── images/                  # Downloaded images
│   ├── aurora-aqua-mark.svg
│   ├── aurora-aqua-logo.svg
│   └── in.svg
└── SCRAPING_SUMMARY.md      # Human-readable summary
```

## Getting Started

1. **Copy the data to your new project**: Copy the entire `webscraper/output/` directory to your new website project
2. **Update paths**: Modify the data to reference your new website's structure
3. **Process images**: Optimize images for web and update references

## Data Files

### all-pages.json

This file contains detailed data from all scraped pages:

```json
{
  "url": "https://www.auroraaqua.in/",
  "title": "Aurora Aqua",
  "metaDescription": "",
  "metaKeywords": "",
  "content": [
    {
      "tag": "p",
      "text": "Aurora Aqua is the umbrella for data-driven aquaculture..."
    }
  ],
  "images": [
    {
      "src": "https://www.auroraaqua.in/aurora-aqua-mark.svg",
      "alt": "Aurora Aqua",
      "title": ""
    }
  ],
  "navigation": [
    {
      "text": "Overview",
      "url": "https://www.auroraaqua.in/",
      "isExternal": false
    }
  ],
  "sections": [
    {
      "id": "section-0",
      "class": "relative mb-12 grid gap-8 ...",
      "content": [...]
    }
  ]
}
```

### sitemap.json

Site map with all page metadata:

```json
[
  {
    "url": "https://www.auroraaqua.in/",
    "title": "Aurora Aqua",
    "description": "",
    "keywords": ""
  }
]
```

### images.json

Images with download information:

```json
[
  {
    "originalUrl": "https://www.auroraaqua.in/aurora-aqua-mark.svg",
    "filename": "aurora-aqua-mark.svg"
  }
]
```

### manifest.json

Scraping statistics:

```json
{
  "pages": 4,
  "images": 3,
  "imagesDownloaded": 3,
  "sections": 24,
  "lastUpdated": "2024-01-15T10:30:00.000Z"
}
```

## Content Extracted

### Main Pages
1. **Home Page** - Overview of Aurora Aqua platform
2. **Products Section** - Information about Aqua Sahay product
3. **Contact Section** - Contact and collaboration information

### Key Content Categories

#### Core Platform Description
- "Aurora Aqua is the umbrella for data-driven aquaculture"
- "Helping farms, integrators and partners move from scattered logs to structured, visible operations"
- "Structured logs, insights, partner APIs and offline-first field use"

#### Coverage Areas
- Coastal Andhra Pradesh
- Tamil Nadu
- Odisha

#### Key Features
1. **Daily Operations**: Logs, tasks, checklists, expenses, inventory
2. **Intelligence Layer**: Risk assessment, opportunity identification, seasonality, pond performance
3. **Partner Integrations**: Sensors, labs, buyers through clean APIs

#### Operator-First Principles
- Designed with on-ground teams
- Offline-first for remote areas with patchy networks
- Single data backbone for alignment
- Clean APIs for integration

#### Product Suite
1. **Aqua Sahay**: Farm-operations app for ponds and crops
2. **Intelligence Layer**: Dashboards, alerts, AI-powered recommendations
3. **Partner APIs**: Clean way for devices, labs, and systems to integrate

## Using the Data in Your 3D Website

### Content Strategy

1. **Hero Section**: Use the main platform description
2. **Features Grid**: Highlight the three core layers
3. **Product Showcase**: Detail each product module
4. **Market Coverage**: Use the India map image and regional information
5. **Contact Section**: Include the collaboration invite

### Visual Assets

- **Logo Files**: `aurora-aqua-logo.svg` (full logo), `aurora-aqua-mark.svg` (icon)
- **India Map**: `in.svg` (coastal footprint map)

### Navigation Structure

```
- Overview (Home)
- Products
  - Aqua Sahay
  - Intelligence Layer
  - Partner APIs
- Contact
```

### Content Recommendations

1. **Data Visualization**: Create 3D visualizations of the aquaculture data backbone
2. **Interactive Maps**: Show the coastal coverage areas with interactive elements
3. **Product Demos**: Create 3D mockups of the app interface
4. **Case Studies**: Visualize how Aurora Aqua transforms aquaculture operations

## Technical Implementation

### Importing Data

```javascript
// In your new project
import allPages from './path/to/webscraper/output/data/all-pages.json';
import images from './path/to/webscraper/output/data/images.json';

// Access data
console.log('Pages:', allPages.length);
console.log('Images:', images.length);
```

### Image Paths

```javascript
// Map original URLs to local files
const imageMap = new Map(images.map(img => [img.originalUrl, img.filename]));

// Replace in content
const processedContent = allPages.map(page => ({
  ...page,
  images: page.images.map(img => ({
    ...img,
    src: imageMap.get(img.src)
  }))
}));
```

### Content Rendering

```javascript
// Render sections
const renderSection = (section) => {
  return `
    <section id="${section.id}" class="${section.class}">
      ${section.content.map(element => {
        if (element.tag === 'h1') {
          return `<h1 class="hero-title">${element.text}</h1>`;
        }
        if (element.tag === 'p') {
          return `<p class="body-text">${element.text}</p>`;
        }
        return `<${element.tag}>${element.text}</${element.tag}>`;
      }).join('')}
    </section>
  `;
};
```

## Performance Optimization

1. **Image Optimization**: Convert SVG to optimized formats, compress images
2. **Lazy Loading**: Implement lazy loading for images and content
3. **Code Splitting**: Split content based on sections
4. **Caching**: Implement service worker caching for static assets

## Legal Considerations

- This data is for internal migration purposes only
- Ensure compliance with copyright laws
- Respect the original website's terms of service
- Update all links to point to your new domain

## Next Steps

1. Review the scraped content and organize it into your new site structure
2. Create wireframes and design mockups based on the content
3. Implement the 3D website using the scraped data
4. Test and iterate based on user feedback

## Resources

- [Scraping Summary](SCRAPING_SUMMARY.md) - Detailed scraping report
- [Manifest](output/data/manifest.json) - Statistics about the scrape
- [Sitemap](output/data/sitemap.json) - Site structure overview

---

**Note**: Remember to update all external links and references to point to your new domain before deploying.
