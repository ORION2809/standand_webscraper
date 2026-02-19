#!/usr/bin/env node

import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import slugify from 'slugify';
import axios from 'axios';

const BASE_URL = 'https://metroconet.com';
const OUTPUT_DIR = path.join(process.cwd(), 'output');

// Create output directories
const createDirectories = async () => {
  await fs.ensureDir(OUTPUT_DIR);
  await fs.ensureDir(path.join(OUTPUT_DIR, 'images'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'data'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'assets'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'assets', 'css'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'assets', 'js'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'assets', 'documents'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'assets', 'fonts'));
  await fs.ensureDir(path.join(OUTPUT_DIR, 'assets', 'videos'));
};

// Download asset with axios
const downloadAsset = async (url, outputPath, filename) => {
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const savePath = path.join(outputPath, filename);
    await fs.writeFile(savePath, response.data);
    console.log(`  ✅ Downloaded: ${filename}`);
    return { success: true, filename };
  } catch (error) {
    console.error(`  ❌ Failed to download ${url}: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Generate safe filename
const generateFilename = (url, defaultExt = '') => {
  try {
    const urlObj = new URL(url);
    let filename = path.basename(urlObj.pathname);
    
    if (!filename || filename === '/') {
      filename = slugify(urlObj.hostname + urlObj.pathname, { lower: true, strict: true });
    }
    
    // Clean up filename
    filename = filename.replace(/[<>:"/\\|?*]/g, '-');
    
    if (!path.extname(filename) && defaultExt) {
      filename += defaultExt;
    }
    
    return filename || 'unnamed' + defaultExt;
  } catch {
    return 'unnamed' + defaultExt;
  }
};

// Extract comprehensive page data
const extractPageData = async (page, url) => {
  return await page.evaluate((baseUrl) => {
    const title = document.title || '';
    
    // Meta tags
    const metaTags = {};
    document.querySelectorAll('meta').forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv');
      const content = meta.getAttribute('content');
      if (name && content) {
        metaTags[name] = content;
      }
    });
    
    // Extract all text content with structure
    const content = [];
    const selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'span', 'div', 'article', 'blockquote', 'figcaption'];
    const seen = new Set();
    
    selectors.forEach(tag => {
      document.querySelectorAll(tag).forEach(element => {
        // Get direct text content only
        let text = '';
        element.childNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent;
          }
        });
        text = text.trim();
        
        if (text && text.length > 3 && !seen.has(text)) {
          seen.add(text);
          content.push({
            tag: tag,
            text: text,
            class: element.className || ''
          });
        }
      });
    });
    
    // Extract images with all attributes
    const images = [];
    document.querySelectorAll('img').forEach(img => {
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (src && !src.startsWith('data:')) {
        images.push({
          src: src,
          alt: img.alt || '',
          title: img.title || '',
          width: img.width || '',
          height: img.height || '',
          class: img.className || ''
        });
      }
    });
    
    // Background images from CSS
    document.querySelectorAll('*').forEach(el => {
      const style = getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== 'none' && bgImage.startsWith('url(')) {
        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1] && !match[1].startsWith('data:')) {
          images.push({
            src: match[1],
            alt: 'Background image',
            title: '',
            isBackground: true
          });
        }
      }
    });
    
    // Extract all links
    const links = [];
    const linkUrls = new Set();
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.href;
      if (href && !linkUrls.has(href)) {
        linkUrls.add(href);
        links.push({
          href: href,
          text: link.textContent.trim(),
          title: link.title || '',
          isExternal: !href.startsWith(baseUrl),
          isDocument: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar)$/i.test(href)
        });
      }
    });
    
    // Extract contact information
    const contactInfo = {
      emails: [],
      phones: [],
      addresses: []
    };
    
    // Find emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const pageText = document.body.innerText;
    const emails = pageText.match(emailRegex);
    if (emails) {
      contactInfo.emails = [...new Set(emails)];
    }
    
    // Find phone numbers
    const phoneRegex = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phones = pageText.match(phoneRegex);
    if (phones) {
      contactInfo.phones = [...new Set(phones)];
    }
    
    // mailto and tel links
    document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
      const email = a.href.replace('mailto:', '').split('?')[0];
      if (!contactInfo.emails.includes(email)) {
        contactInfo.emails.push(email);
      }
    });
    
    document.querySelectorAll('a[href^="tel:"]').forEach(a => {
      const phone = a.href.replace('tel:', '');
      if (!contactInfo.phones.includes(phone)) {
        contactInfo.phones.push(phone);
      }
    });
    
    // Extract forms
    const forms = [];
    document.querySelectorAll('form').forEach(form => {
      const fields = [];
      form.querySelectorAll('input, select, textarea').forEach(field => {
        fields.push({
          type: field.type || field.tagName.toLowerCase(),
          name: field.name || '',
          placeholder: field.placeholder || '',
          required: field.required || false
        });
      });
      
      forms.push({
        action: form.action || '',
        method: form.method || 'get',
        fields: fields
      });
    });
    
    // Extract navigation structure
    const navigation = [];
    document.querySelectorAll('nav, .nav, .menu, header, .header').forEach(nav => {
      const navLinks = [];
      nav.querySelectorAll('a[href]').forEach(link => {
        navLinks.push({
          text: link.textContent.trim(),
          href: link.href
        });
      });
      if (navLinks.length > 0) {
        navigation.push({
          type: nav.tagName.toLowerCase(),
          class: nav.className || '',
          links: navLinks
        });
      }
    });
    
    // Extract sections with content
    const sections = [];
    document.querySelectorAll('section, .section, main, article, .content, .container').forEach((section, i) => {
      const sectionContent = [];
      section.querySelectorAll('h1, h2, h3, h4, h5, h6, p').forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 3) {
          sectionContent.push({
            tag: el.tagName.toLowerCase(),
            text: text
          });
        }
      });
      
      if (sectionContent.length > 0) {
        sections.push({
          id: section.id || `section-${i}`,
          class: section.className || '',
          content: sectionContent
        });
      }
    });
    
    // Extract stylesheets
    const stylesheets = [];
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      if (link.href) {
        stylesheets.push(link.href);
      }
    });
    
    // Extract scripts
    const scripts = [];
    document.querySelectorAll('script[src]').forEach(script => {
      if (script.src) {
        scripts.push(script.src);
      }
    });
    
    // Extract videos
    const videos = [];
    document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').forEach(video => {
      if (video.src) {
        videos.push({
          src: video.src,
          type: video.tagName.toLowerCase()
        });
      }
      if (video.querySelector) {
        video.querySelectorAll('source').forEach(source => {
          videos.push({
            src: source.src,
            type: source.type || 'video'
          });
        });
      }
    });
    
    // Extract social links
    const socialLinks = [];
    const socialPatterns = ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'tiktok', 'pinterest'];
    document.querySelectorAll('a[href]').forEach(link => {
      socialPatterns.forEach(pattern => {
        if (link.href.toLowerCase().includes(pattern)) {
          socialLinks.push({
            platform: pattern,
            url: link.href
          });
        }
      });
    });
    
    // Extract structured data (JSON-LD)
    const structuredData = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        structuredData.push(JSON.parse(script.textContent));
      } catch {}
    });
    
    // Footer content
    let footerContent = '';
    const footer = document.querySelector('footer, .footer');
    if (footer) {
      footerContent = footer.innerText;
    }
    
    return {
      url: window.location.href,
      title: title,
      metaTags: metaTags,
      content: content,
      images: images,
      links: links,
      contactInfo: contactInfo,
      forms: forms,
      navigation: navigation,
      sections: sections,
      stylesheets: stylesheets,
      scripts: scripts,
      videos: videos,
      socialLinks: socialLinks,
      structuredData: structuredData,
      footerContent: footerContent
    };
  }, BASE_URL);
};

// Extract all links from page for crawling
const extractLinks = async (page) => {
  const links = await page.evaluate((baseUrl) => {
    const uniqueLinks = new Set();
    const allLinks = document.querySelectorAll('a[href]');
    
    allLinks.forEach(link => {
      let href = link.href;
      
      // Skip non-http links
      if (!href.startsWith('http')) return;
      if (href.includes('mailto:') || href.includes('tel:')) return;
      if (href.includes('#') && href.split('#')[0] === window.location.href.split('#')[0]) return;
      
      // Only include same-domain links
      try {
        const urlObj = new URL(href);
        if (urlObj.hostname.includes('metroconet.com')) {
          // Normalize URL
          let normalizedUrl = urlObj.origin + urlObj.pathname;
          if (normalizedUrl.endsWith('/')) {
            normalizedUrl = normalizedUrl.slice(0, -1);
          }
          uniqueLinks.add(normalizedUrl);
        }
      } catch {}
    });
    
    return Array.from(uniqueLinks);
  }, BASE_URL);
  
  return links;
};

// Main scraping function
const scrapeWebsite = async () => {
  console.log('🚀 Starting MetroConet comprehensive website scraper');
  console.log(`📌 Target: ${BASE_URL}`);
  console.log('');
  
  // Create directories
  await createDirectories();
  
  // Clear previous output
  await fs.emptyDir(path.join(OUTPUT_DIR, 'data'));
  await fs.emptyDir(path.join(OUTPUT_DIR, 'images'));
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  
  const pagesToVisit = new Set([BASE_URL, BASE_URL + '/']);
  const visitedPages = new Set();
  const allPagesData = [];
  const allImages = new Map(); // URL -> metadata
  const allDocuments = new Set();
  const allStylesheets = new Set();
  const allScripts = new Set();
  const allVideos = new Set();
  const allContactInfo = {
    emails: new Set(),
    phones: new Set()
  };
  const allSocialLinks = new Map();
  
  console.log('📄 Crawling pages...\n');
  
  // Scrape pages
  while (pagesToVisit.size > 0) {
    const currentUrl = pagesToVisit.values().next().value;
    
    // Normalize URL for comparison
    let normalizedUrl = currentUrl.replace(/\/$/, '');
    
    if (visitedPages.has(normalizedUrl)) {
      pagesToVisit.delete(currentUrl);
      continue;
    }
    
    visitedPages.add(normalizedUrl);
    pagesToVisit.delete(currentUrl);
    
    try {
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Block unnecessary resources to speed up
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['font'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      console.log(`📄 Fetching: ${currentUrl}`);
      
      try {
        await page.goto(currentUrl, { 
          waitUntil: 'networkidle2', 
          timeout: 45000 
        });
        
        // Wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (navError) {
        console.log(`  ⚠️ Navigation issue: ${navError.message}`);
        await page.close();
        continue;
      }
      
      // Extract page data
      const pageData = await extractPageData(page, currentUrl);
      allPagesData.push(pageData);
      
      // Collect images
      pageData.images.forEach(img => {
        if (img.src && !allImages.has(img.src)) {
          allImages.set(img.src, img);
        }
      });
      
      // Collect documents
      pageData.links.forEach(link => {
        if (link.isDocument) {
          allDocuments.add(link.href);
        }
      });
      
      // Collect stylesheets
      pageData.stylesheets.forEach(css => allStylesheets.add(css));
      
      // Collect scripts
      pageData.scripts.forEach(js => allScripts.add(js));
      
      // Collect videos
      pageData.videos.forEach(video => allVideos.add(JSON.stringify(video)));
      
      // Collect contact info
      pageData.contactInfo.emails.forEach(e => allContactInfo.emails.add(e));
      pageData.contactInfo.phones.forEach(p => allContactInfo.phones.add(p));
      
      // Collect social links
      pageData.socialLinks.forEach(social => {
        allSocialLinks.set(social.platform, social.url);
      });
      
      // Extract and queue new links
      const links = await extractLinks(page);
      links.forEach(link => {
        const normalizedLink = link.replace(/\/$/, '');
        if (!visitedPages.has(normalizedLink)) {
          pagesToVisit.add(link);
        }
      });
      
      await page.close();
      
      console.log(`  ✅ Scraped successfully`);
      console.log(`  📊 Images: ${pageData.images.length}, Links: ${pageData.links.length}`);
      console.log(`  📝 Remaining pages: ${pagesToVisit.size}\n`);
      
    } catch (error) {
      console.error(`  ❌ Failed to scrape ${currentUrl}: ${error.message}\n`);
    }
  }
  
  console.log('\n📸 Downloading images...');
  console.log(`   Found ${allImages.size} unique images\n`);
  
  const imagesDownloaded = [];
  let imageCount = 0;
  
  for (const [imageUrl, metadata] of allImages) {
    imageCount++;
    console.log(`[${imageCount}/${allImages.size}] ${imageUrl}`);
    
    try {
      const filename = generateFilename(imageUrl, '.jpg');
      const result = await downloadAsset(imageUrl, path.join(OUTPUT_DIR, 'images'), filename);
      
      if (result.success) {
        imagesDownloaded.push({
          originalUrl: imageUrl,
          filename: result.filename,
          alt: metadata.alt || '',
          title: metadata.title || ''
        });
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  // Download documents (PDFs, etc.)
  console.log('\n📄 Downloading documents...');
  console.log(`   Found ${allDocuments.size} documents\n`);
  
  const documentsDownloaded = [];
  for (const docUrl of allDocuments) {
    console.log(`📥 ${docUrl}`);
    const filename = generateFilename(docUrl);
    const result = await downloadAsset(docUrl, path.join(OUTPUT_DIR, 'assets', 'documents'), filename);
    if (result.success) {
      documentsDownloaded.push({
        originalUrl: docUrl,
        filename: result.filename
      });
    }
  }
  
  await browser.close();
  
  // Save all data
  console.log('\n💾 Saving data...\n');
  
  // Save all pages data
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'all-pages.json'), allPagesData, { spaces: 2 });
  console.log('  ✅ Saved: all-pages.json');
  
  // Save images metadata
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'images.json'), imagesDownloaded, { spaces: 2 });
  console.log('  ✅ Saved: images.json');
  
  // Save documents metadata
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'documents.json'), documentsDownloaded, { spaces: 2 });
  console.log('  ✅ Saved: documents.json');
  
  // Create comprehensive sitemap
  const siteMap = allPagesData.map(page => ({
    url: page.url,
    title: page.title,
    description: page.metaTags?.description || '',
    keywords: page.metaTags?.keywords || '',
    imageCount: page.images.length,
    linkCount: page.links.length,
    formCount: page.forms.length
  }));
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'sitemap.json'), siteMap, { spaces: 2 });
  console.log('  ✅ Saved: sitemap.json');
  
  // Save contact information
  const contactData = {
    emails: Array.from(allContactInfo.emails),
    phones: Array.from(allContactInfo.phones),
    socialLinks: Object.fromEntries(allSocialLinks)
  };
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'contact-info.json'), contactData, { spaces: 2 });
  console.log('  ✅ Saved: contact-info.json');
  
  // Save all external links
  const externalLinks = [];
  allPagesData.forEach(page => {
    page.links.forEach(link => {
      if (link.isExternal) {
        externalLinks.push({
          from: page.url,
          to: link.href,
          text: link.text
        });
      }
    });
  });
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'external-links.json'), externalLinks, { spaces: 2 });
  console.log('  ✅ Saved: external-links.json');
  
  // Save all forms
  const allForms = [];
  allPagesData.forEach(page => {
    page.forms.forEach(form => {
      allForms.push({
        pageUrl: page.url,
        ...form
      });
    });
  });
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'forms.json'), allForms, { spaces: 2 });
  console.log('  ✅ Saved: forms.json');
  
  // Save structured data
  const structuredDataList = [];
  allPagesData.forEach(page => {
    if (page.structuredData && page.structuredData.length > 0) {
      structuredDataList.push({
        pageUrl: page.url,
        data: page.structuredData
      });
    }
  });
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'structured-data.json'), structuredDataList, { spaces: 2 });
  console.log('  ✅ Saved: structured-data.json');
  
  // Save navigation structure
  const navStructure = [];
  allPagesData.forEach(page => {
    if (page.navigation && page.navigation.length > 0) {
      navStructure.push({
        pageUrl: page.url,
        navigation: page.navigation
      });
    }
  });
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'navigation.json'), navStructure, { spaces: 2 });
  console.log('  ✅ Saved: navigation.json');
  
  // Save assets list
  const assetsData = {
    stylesheets: Array.from(allStylesheets),
    scripts: Array.from(allScripts),
    videos: Array.from(allVideos).map(v => JSON.parse(v))
  };
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'assets.json'), assetsData, { spaces: 2 });
  console.log('  ✅ Saved: assets.json');
  
  // Create manifest
  const manifest = {
    website: BASE_URL,
    scrapedAt: new Date().toISOString(),
    statistics: {
      totalPages: allPagesData.length,
      totalImages: allImages.size,
      imagesDownloaded: imagesDownloaded.length,
      totalDocuments: allDocuments.size,
      documentsDownloaded: documentsDownloaded.length,
      totalExternalLinks: externalLinks.length,
      totalForms: allForms.length,
      totalStylesheets: allStylesheets.size,
      totalScripts: allScripts.size,
      emails: Array.from(allContactInfo.emails),
      phones: Array.from(allContactInfo.phones)
    }
  };
  await fs.writeJson(path.join(OUTPUT_DIR, 'data', 'manifest.json'), manifest, { spaces: 2 });
  console.log('  ✅ Saved: manifest.json');
  
  // Create comprehensive markdown summary
  let summary = `# MetroConet - Complete Website Scraping Report\n\n`;
  summary += `**Website:** ${BASE_URL}\n`;
  summary += `**Scraped:** ${new Date().toISOString()}\n\n`;
  
  summary += `## Summary Statistics\n\n`;
  summary += `| Metric | Count |\n`;
  summary += `|--------|-------|\n`;
  summary += `| Total Pages Scraped | ${allPagesData.length} |\n`;
  summary += `| Total Images Found | ${allImages.size} |\n`;
  summary += `| Images Downloaded | ${imagesDownloaded.length} |\n`;
  summary += `| Documents Found | ${allDocuments.size} |\n`;
  summary += `| Documents Downloaded | ${documentsDownloaded.length} |\n`;
  summary += `| External Links | ${externalLinks.length} |\n`;
  summary += `| Forms Found | ${allForms.length} |\n`;
  summary += `| Stylesheets | ${allStylesheets.size} |\n`;
  summary += `| Scripts | ${allScripts.size} |\n\n`;
  
  summary += `## Contact Information\n\n`;
  if (contactData.emails.length > 0) {
    summary += `### Emails\n`;
    contactData.emails.forEach(email => {
      summary += `- ${email}\n`;
    });
    summary += `\n`;
  }
  
  if (contactData.phones.length > 0) {
    summary += `### Phone Numbers\n`;
    contactData.phones.forEach(phone => {
      summary += `- ${phone}\n`;
    });
    summary += `\n`;
  }
  
  if (Object.keys(contactData.socialLinks).length > 0) {
    summary += `### Social Media\n`;
    Object.entries(contactData.socialLinks).forEach(([platform, url]) => {
      summary += `- **${platform}**: ${url}\n`;
    });
    summary += `\n`;
  }
  
  summary += `## Site Map\n\n`;
  siteMap.forEach((page, i) => {
    summary += `### ${i + 1}. ${page.title || 'Untitled'}\n`;
    summary += `- **URL:** ${page.url}\n`;
    if (page.description) {
      summary += `- **Description:** ${page.description}\n`;
    }
    summary += `- **Images:** ${page.imageCount}, **Links:** ${page.linkCount}, **Forms:** ${page.formCount}\n`;
    summary += `\n`;
  });
  
  summary += `## Page Contents\n\n`;
  allPagesData.forEach((page, i) => {
    summary += `### ${i + 1}. ${page.title || page.url}\n\n`;
    summary += `**URL:** ${page.url}\n\n`;
    
    // Add headings and content
    const headings = page.content.filter(c => ['h1', 'h2', 'h3'].includes(c.tag));
    if (headings.length > 0) {
      summary += `**Headings:**\n`;
      headings.forEach(h => {
        summary += `- ${h.text}\n`;
      });
      summary += `\n`;
    }
    
    // Add sections
    if (page.sections && page.sections.length > 0) {
      summary += `**Sections:** ${page.sections.length}\n\n`;
    }
    
    summary += `---\n\n`;
  });
  
  summary += `## Output Files\n\n`;
  summary += `- \`data/all-pages.json\` - Complete page data for all pages\n`;
  summary += `- \`data/sitemap.json\` - Site structure and meta information\n`;
  summary += `- \`data/images.json\` - Image metadata and download status\n`;
  summary += `- \`data/documents.json\` - Downloaded documents list\n`;
  summary += `- \`data/contact-info.json\` - Emails, phones, social links\n`;
  summary += `- \`data/forms.json\` - All forms and their fields\n`;
  summary += `- \`data/external-links.json\` - All external links\n`;
  summary += `- \`data/structured-data.json\` - JSON-LD structured data\n`;
  summary += `- \`data/navigation.json\` - Navigation structure\n`;
  summary += `- \`data/assets.json\` - CSS, JS, and video assets\n`;
  summary += `- \`data/manifest.json\` - Scraping manifest and statistics\n`;
  summary += `- \`images/\` - Downloaded images\n`;
  summary += `- \`assets/documents/\` - Downloaded documents (PDFs, etc.)\n`;
  
  await fs.writeFile(path.join(OUTPUT_DIR, 'SCRAPING_SUMMARY.md'), summary, 'utf8');
  console.log('  ✅ Saved: SCRAPING_SUMMARY.md');
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ SCRAPING COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log(`📦 Output directory: ${OUTPUT_DIR}`);
  console.log(`📄 Pages scraped: ${allPagesData.length}`);
  console.log(`📸 Images downloaded: ${imagesDownloaded.length}/${allImages.size}`);
  console.log(`📑 Documents downloaded: ${documentsDownloaded.length}/${allDocuments.size}`);
  console.log(`📧 Emails found: ${contactData.emails.length}`);
  console.log(`📞 Phones found: ${contactData.phones.length}`);
  console.log('='.repeat(60));
};

// Start scraping
scrapeWebsite().catch(error => {
  console.error('❌ Scraper error:', error);
  process.exit(1);
});
