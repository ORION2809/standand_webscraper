#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import slugify from 'slugify';

const OUTPUT_DIR = path.join(process.cwd(), 'output');

const main = async () => {
  console.log('📸 Starting image download');
  
  // Read all pages data
  const allPages = await fs.readJSON(path.join(OUTPUT_DIR, 'data', 'all-pages.json'));
  
  // Collect all unique images
  const allImages = new Set();
  allPages.forEach(page => {
    if (page.images) {
      page.images.forEach(img => {
        allImages.add(img.src);
      });
    }
  });
  
  console.log(`Found ${allImages.size} unique images`);
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  const downloadedImages = [];
  
  // Download images
  for (const imageUrl of allImages) {
    try {
      console.log(`Downloading: ${imageUrl}`);
      
      const response = await page.goto(imageUrl, { 
        waitUntil: 'networkidle0', 
        timeout: 15000 
      });
      
      const buffer = await response.buffer();
      
      // Determine file extension
      const contentType = response.headers()['content-type'];
      let extension = 'jpg';
      if (contentType?.includes('png')) {
        extension = 'png';
      } else if (contentType?.includes('gif')) {
        extension = 'gif';
      } else if (contentType?.includes('webp')) {
        extension = 'webp';
      } else if (contentType?.includes('svg')) {
        extension = 'svg';
      }
      
      // Generate filename
      const filename = slugify(path.basename(imageUrl).split('?')[0].split('#')[0]) + '.' + extension;
      const savePath = path.join(OUTPUT_DIR, 'images', filename);
      
      await fs.writeFile(savePath, buffer);
      downloadedImages.push({
        originalUrl: imageUrl,
        filename: filename
      });
      
      console.log(`✅ Saved: ${filename}`);
      
    } catch (error) {
      console.error(`❌ Failed to download ${imageUrl}:`, error.message);
    }
  }
  
  await page.close();
  await browser.close();
  
  // Save images metadata
  await fs.writeJSON(path.join(OUTPUT_DIR, 'data', 'images.json'), downloadedImages, { spaces: 2 });
  
  // Clean up duplicate pages in all-pages.json
  const uniquePages = [];
  const seenUrls = new Set();
  
  allPages.forEach(page => {
    if (!seenUrls.has(page.url)) {
      seenUrls.add(page.url);
      uniquePages.push(page);
    }
  });
  
  await fs.writeJSON(path.join(OUTPUT_DIR, 'data', 'all-pages.json'), uniquePages, { spaces: 2 });
  
  // Update manifest
  const manifest = await fs.readJSON(path.join(OUTPUT_DIR, 'data', 'manifest.json'));
  manifest.imagesDownloaded = downloadedImages.length;
  manifest.pages = uniquePages.length;
  await fs.writeJSON(path.join(OUTPUT_DIR, 'data', 'manifest.json'), manifest, { spaces: 2 });
  
  // Update summary
  let summary = `# Aurora Aqua - Website Data Summary\n\n`;
  summary += `## Scraping Results\n\n`;
  summary += `**Total Pages Scraped:** ${uniquePages.length}\n`;
  summary += `**Total Images Found:** ${allImages.size}\n`;
  summary += `**Images Downloaded:** ${downloadedImages.length}\n`;
  summary += `**Total Sections:** ${uniquePages.reduce((sum, page) => sum + page.sections.length, 0)}\n`;
  summary += `**Scraping Date:** ${new Date().toISOString()}\n\n`;
  
  summary += `## Page List\n\n`;
  uniquePages.forEach(page => {
    summary += `### [${page.title}](${page.url})\n`;
    summary += `**URL:** ${page.url}\n`;
    if (page.metaDescription) {
      summary += `**Description:** ${page.metaDescription}\n`;
    }
    if (page.metaKeywords) {
      summary += `**Keywords:** ${page.metaKeywords}\n`;
    }
    summary += `\n`;
  });
  
  await fs.writeFile(path.join(OUTPUT_DIR, 'SCRAPING_SUMMARY.md'), summary, 'utf8');
  
  console.log(`\n✅ Image download completed!`);
  console.log(`📦 Output directory: ${OUTPUT_DIR}`);
  console.log(`📄 Pages scraped: ${uniquePages.length}`);
  console.log(`📸 Images downloaded: ${downloadedImages.length}`);
};

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
