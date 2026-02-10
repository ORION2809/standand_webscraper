#!/usr/bin/env node

import puppeteer from 'puppeteer';
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

// Download image
const downloadImage = async (page, url, outputPath) => {
  try {
    const response = await page.goto(url, { waitUntil: 'networkidle0' });
    const buffer = await response.buffer();
    
    // Determine file extension
    const contentType = response.headers()['content-type'];
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
    
    await fs.writeFile(savePath, buffer);
    return filename;
  } catch (error) {
    console.error(`Failed to download image ${url}:`, error.message);
    return null;
  }
};

// Extract page data
const extractPageData = async (page, url) => {
  return await page.evaluate(() => {
    const title = document.title;
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
    
    // Extract main content
    const content = [];
    const selectors = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol'];
    selectors.forEach(tag => {
      document.querySelectorAll(tag).forEach(element => {
        const text = element.textContent.trim();
        if (text && text.length > 10) {
          content.push({
            tag: tag,
            text: text
          });
        }
      });
    });
    
    // Extract images
    const images = [];
    document.querySelectorAll('img[src]').forEach(img => {
      const src = img.src;
      const alt = img.alt || '';
      const title = img.title || '';
      
      images.push({
        src: src,
        alt: alt,
        title: title
      });
    });
    
    // Extract navigation
    const navigation = [];
    const navElements = document.querySelectorAll('nav a, .nav a, .menu a, [role="navigation"] a');
    navElements.forEach(link => {
      const href = link.getAttribute('href');
      const text = link.textContent.trim();
      
      if (text && href) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = new URL(href, window.location.origin).toString();
        }
        
        navigation.push({
          text: text,
          url: fullUrl,
          isExternal: !fullUrl.startsWith(window.location.origin)
        });
      }
    });
    
    // Extract sections
    const sections = [];
    document.querySelectorAll('section, .section, .hero, .feature, .service').forEach((section, i) => {
      const sectionId = section.id || `section-${i}`;
      const sectionClass = section.className || '';
      
      const sectionContent = [];
      selectors.forEach(tag => {
        section.querySelectorAll(tag).forEach(element => {
          const text = element.textContent.trim();
          if (text && text.length > 5) {
            sectionContent.push({
              tag: tag,
              text: text
            });
          }
        });
      });
      
      sections.push({
        id: sectionId,
        class: sectionClass,
        content: sectionContent
      });
    });
    
    return {
      url: window.location.href,
      title: title,
      metaDescription: metaDescription,
      metaKeywords: metaKeywords,
      content: content,
      images: images,
      navigation: navigation,
      sections: sections
    };
  });
};

// Extract links from page
const extractLinks = async (page, baseUrl) => {
  const links = await page.evaluate((origin) => {
    const uniqueLinks = new Set();
    const allLinks = document.querySelectorAll('a[href]');
    
    allLinks.forEach(link => {
      const href = link.getAttribute('href');
      
      if (!href.startsWith('mailto:') && !href.startsWith('tel:')) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = new URL(href, origin).toString();
        } else if (!href.startsWith('http')) {
          return;
        }
        
        if (fullUrl.startsWith(origin)) {
          uniqueLinks.add(fullUrl);
        }
      }
    });
    
    return Array.from(uniqueLinks);
  }, baseUrl);
  
  return links;
};

// Main scraping function
const scrapeWebsite = async () => {
  console.log('🚀 Starting Aurora Aqua website scraper with Puppeteer');
  
  // Create directories
  await createDirectories();
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
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
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      console.log(`Fetching: ${currentUrl}`);
      await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Extract page data
      const pageData = await extractPageData(page, currentUrl);
      allPagesData.push(pageData);
      
      // Add images to download list
      pageData.images.forEach(img => {
        allImages.add(img.src);
      });
      
      // Extract and queue new links
      const links = await extractLinks(page, BASE_URL);
      links.forEach(link => {
        if (!visitedPages.has(link) && !pagesToVisit.has(link)) {
          pagesToVisit.add(link);
        }
      });
      
      await page.close();
      
      console.log(`✅ Scraped: ${currentUrl}`);
      console.log(`📄 Pages to visit: ${pagesToVisit.size}`);
      
    } catch (error) {
      console.error(`❌ Failed to scrape ${currentUrl}:`, error.message);
    }
  }
  
  // Download images
  console.log(`\n📸 Downloading ${allImages.size} images...`);
  const imagesDownloaded = [];
  const imagePage = await browser.newPage();
  
  for (const imageUrl of allImages) {
    const filename = await downloadImage(imagePage, imageUrl, path.join(OUTPUT_DIR, 'images'));
    if (filename) {
      imagesDownloaded.push({
        originalUrl: imageUrl,
        filename: filename
      });
    }
  }
  
  await imagePage.close();
  await browser.close();
  
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
