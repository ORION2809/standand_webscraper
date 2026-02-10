#!/usr/bin/env node

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs-extra';
import path from 'path';
import slugify from 'slugify';

const BASE_URL = 'https://www.auroraaqua.in';
const OUTPUT_DIR = path.join(process.cwd(), 'output');

// Create output directories
const createDirectories = async () => {
  await fs.ensureDir(OUTPUT_DIR);
  await fs.ensureDir(path.join(OUTPUT_DIR, 'images'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'data'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'assets'));
};

// Fetch page content
const fetchPage = async (url) => {
  try {
    console.log(`Fetching: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error.message);
    return null;
  }
};

// Extract links from page
const extractLinks = ($, baseUrl) => {
  const links = new Set();
  $('a[href]').each((_, element) => {
    let href = $(element).attr('href');
    
    // Skip mailto and tel links
    if (href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }
    
    // Convert relative paths to absolute URLs
    if (href.startsWith('/')) {
      href = new URL(href, baseUrl).toString();
    } else if (!href.startsWith('http')) {
      return;
    }
    
    // Only include links from the same domain
    if (href.startsWith(BASE_URL)) {
      links.add(href);
    }
  });
  
  return Array.from(links);
};

// Extract page data
const extractPageData = ($, url) => {
  const title = $('title').text().trim();
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
  
  // Extract main content
  const content = [];
  $('main, .container, #content').each((_, element) => {
    // Extract text content with structure
    $(element).find('p, h1, h2, h3, h4, h5, h6, ul, ol').each((_, child) => {
      const tagName = child.tagName.toLowerCase();
      const text = $(child).text().trim();
      
      if (text && text.length > 10) { // Skip very short content
        content.push({
          tag: tagName,
          text: text
        });
      }
    });
  });
  
  // Extract images
  const images = [];
  $('img[src]').each((_, element) => {
    const src = $(element).attr('src');
    const alt = $(element).attr('alt') || '';
    const title = $(element).attr('title') || '';
    
    let imageUrl = src;
    if (!src.startsWith('http')) {
      imageUrl = new URL(src, url).toString();
    }
    
    images.push({
      src: imageUrl,
      alt: alt,
      title: title
    });
  });
  
  // Extract navigation
  const navigation = [];
  $('nav, .nav, .menu, [role="navigation"]').each((_, nav) => {
    $(nav).find('a').each((_, link) => {
      const href = $(link).attr('href');
      const text = $(link).text().trim();
      
      if (text && href) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = new URL(href, BASE_URL).toString();
        }
        
        navigation.push({
          text: text,
          url: fullUrl,
          isExternal: !fullUrl.startsWith(BASE_URL)
        });
      }
    });
  });
  
  // Extract sections
  const sections = [];
  $('section, .section, .hero, .feature, .service').each((i, section) => {
    const sectionId = $(section).attr('id') || `section-${i}`;
    const sectionClass = $(section).attr('class') || '';
    
    sections.push({
      id: sectionId,
      class: sectionClass,
      content: extractSectionContent($(section))
    });
  });
  
  return {
    url: url,
    title: title,
    metaDescription: metaDescription,
    metaKeywords: metaKeywords,
    content: content,
    images: images,
    navigation: navigation,
    sections: sections
  };
};

// Extract section content
const extractSectionContent = ($section) => {
  const content = [];
  
  $section.find('p, h1, h2, h3, h4, h5, h6, ul, ol, .text, .description').each((_, element) => {
    const tag = element.tagName.toLowerCase();
    const text = $(element).text().trim();
    
    if (text && text.length > 5) {
      content.push({
        tag: tag,
        text: text
      });
    }
  });
  
  return content;
};

// Download image
const downloadImage = async (url, outputPath) => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    
    // Determine file extension
    const contentType = response.headers['content-type'];
    let extension = 'jpg';
    if (contentType.includes('png')) {
      extension = 'png';
    } else if (contentType.includes('gif')) {
      extension = 'gif';
    } else if (contentType.includes('webp')) {
      extension = 'webp';
    }
    
    const filename = slugify(path.basename(url).split('?')[0].split('#')[0]) + '.' + extension;
    const savePath = path.join(outputPath, filename);
    
    await fs.writeFile(savePath, response.data);
    return filename;
  } catch (error) {
    console.error(`Failed to download image ${url}:`, error.message);
    return null;
  }
};

// Main scraping function
const scrapeWebsite = async () => {
  console.log('🚀 Starting Aurora Aqua website scraper');
  
  // Create directories
  await createDirectories();
  
  // Start with homepage
  const pagesToVisit = new Set([BASE_URL]);
  const visitedPages = new Set();
  const allPagesData = [];
  const allImages = new Set();
  
  // Scrape pages
  while (pagesToVisit.size > 0) {
    const currentUrl = pagesToVisit.values().next().value;
    
    if (visitedPages.has(currentUrl)) {
      pagesToVisit.delete(currentUrl);
      continue;
    }
    
    visitedPages.add(currentUrl);
    pagesToVisit.delete(currentUrl);
    
    const html = await fetchPage(currentUrl);
    if (!html) {
      continue;
    }
    
    const $ = cheerio.load(html);
    
    // Extract page data
    const pageData = extractPageData($, currentUrl);
    allPagesData.push(pageData);
    
    // Add images to download list
    pageData.images.forEach(img => {
      allImages.add(img.src);
    });
    
    // Extract and queue new links
    const links = extractLinks($, currentUrl);
    links.forEach(link => {
      if (!visitedPages.has(link) && !pagesToVisit.has(link)) {
        pagesToVisit.add(link);
      }
    });
    
    console.log(`✅ Scraped: ${currentUrl}`);
    console.log(`📄 Pages to visit: ${pagesToVisit.size}`);
  }
  
  // Download images
  console.log(`\n📸 Downloading ${allImages.size} images...`);
  const imagesDownloaded = [];
  for (const imageUrl of allImages) {
    const filename = await downloadImage(imageUrl, path.join(OUTPUT_DIR, 'images'));
    if (filename) {
      imagesDownloaded.push({
        originalUrl: imageUrl,
        filename: filename
      });
    }
  }
  
  // Save data
  console.log(`\n💾 Saving data...`);
  
  // Save all pages data
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'all-pages.json'), allPagesData, { spaces: 2 });
  
  // Save images metadata
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'images.json'), imagesDownloaded, { spaces: 2 });
  
  // Create site map
  const siteMap = allPagesData.map(page => ({
    url: page.url,
    title: page.title,
    description: page.metaDescription,
    keywords: page.metaKeywords
  }));
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'sitemap.json'), siteMap, { spaces: 2 });
  
  // Create assets manifest
  const assetsManifest = {
    pages: allPagesData.length,
    images: allImages.size,
    imagesDownloaded: imagesDownloaded.length,
    sections: allPagesData.reduce((sum, page) => sum + page.sections.length, 0),
    lastUpdated: new Date().toISOString()
  };
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'manifest.json'), assetsManifest, { spaces: 2 });
  
  // Create markdown summary
  let summary = `# Aurora Aqua - Website Data Summary\n\n`;
  summary += `## Scraping Results\n\n`;
  summary += `**Total Pages Scraped:** ${allPagesData.length}\n`;
  summary += `**Total Images Found:** ${allImages.size}\n`;
  summary += `**Images Downloaded:** ${imagesDownloaded.length}\n`;
  summary += `**Total Sections:** ${allPagesData.reduce((sum, page) => sum + page.sections.length, 0)}\n`;
  summary += `**Scraping Date:** ${new Date().toISOString()}\n\n`;
  
  summary += `## Page List\n\n`;
  siteMap.forEach(page => {
    summary += `### [${page.title}](${page.url})\n`;
    summary += `**URL:** ${page.url}\n`;
    if (page.description) {
      summary += `**Description:** ${page.description}\n`;
    }
    if (page.keywords) {
      summary += `**Keywords:** ${page.keywords}\n`;
    }
    summary += `\n`;
  });
  
  await fs.writeFile(path.join(OUTPUT_DIR, 'SCRAPING_SUMMARY.md'), summary, 'utf8');
  
  console.log(`\n✅ Scraping completed!`);
  console.log(`📦 Output directory: ${OUTPUT_DIR}`);
  console.log(`📄 Pages scraped: ${allPagesData.length}`);
  console.log(`📸 Images downloaded: ${imagesDownloaded.length}`);
};

// Start scraping
scrapeWebsite().catch(error => {
  console.error('❌ Scraper error:', error);
  process.exit(1);
});
