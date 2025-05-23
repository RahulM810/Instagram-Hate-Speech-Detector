require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ApifyClient } = require('apify-client');
const fs = require('fs');
const { Parser } = require('json2csv');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'], 
  methods: ['POST', 'GET']
}));

app.use(express.json());

if (!process.env.APIFY_TOKEN) {
  console.error('❌ FATAL ERROR: Missing APIFY_TOKEN in .env file');
  process.exit(1);
}

let client;
try {
  client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  console.log('✅ Apify client initialized successfully');
} catch (err) {
  console.error('❌ Failed to initialize Apify client:', err);
  process.exit(1);
}

// ✅ Scrape Instagram Comments
app.post('/api/scrape-comments', async (req, res) => {
  try {
    let { postUrl, resultsLimit = 20 } = req.body;

    if (!postUrl || typeof postUrl !== 'string') {
      return res.status(400).json({ error: "Valid Instagram post URL is required" });
    }

    if (!/^https:\/\/(www\.)?instagram\.com\/p\/.+/.test(postUrl)) {
      postUrl = `https://www.instagram.com/p/${postUrl.replace(/.*instagram\.com\/p\/|\/$/, '')}/`;
    }

    const input = {
      directUrls: [postUrl],
      resultsType: 'comments',
      resultsLimit: Math.min(Math.max(Number(resultsLimit), 1, 100)),
      proxyConfiguration: { useApifyProxy: true }
    };

    console.log('✅ Scraping comments for:', postUrl);

    const run = await client.actor("shu8hvrXbJbY3Eb9W").call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items.length) {
      return res.status(404).json({ error: "No comments found for this post" });
    }

    const comments = items.map(comment => ({
      username: comment.username || 'Unknown',
      text: comment.text || 'No text',
      timestamp: comment.timestamp || new Date().toISOString()
    }));

    res.json({ success: true, message: "Comments scraped successfully", comments });

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: "Scraping failed", details: error.message });
  }
});

// ✅ Export Scraped Comments to CSV
app.post('/api/export-comments', async (req, res) => {
  try {
    const { comments } = req.body;
    if (!Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ error: "No comments data provided" });
    }

    // Format comments: Include only id and text
    const formattedComments = comments.map((comment, index) => ({
      id: index + 1,  // Assign an auto-incrementing ID
      text: comment.text || 'No text'
    }));

    // Convert to CSV format
    const parser = new Parser({ fields: ['id', 'text'] });
    const csv = parser.parse(formattedComments);

    // Define file path in the "data" directory
    const dirPath = path.join(__dirname, 'data');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const fileName = `comments_${Date.now()}.csv`;
    const filePath = path.join(dirPath, fileName);
    
    // Write CSV file
    fs.writeFileSync(filePath, csv);
    
    console.log(`✅ CSV saved successfully: ${filePath}`);

    res.json({ success: true, message: "CSV file generated", filePath });

  } catch (error) {
    console.error('❌ CSV Export Error:', error);
    res.status(500).json({ error: "Failed to generate CSV file", details: error.message });
  }
});


// ✅ Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    apify: !!client,
    env: { tokenConfigured: !!process.env.APIFY_TOKEN, port: PORT }
  });
});

// ✅ Start Server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}/health`);
  console.log(`🔗 Scrape comments: http://localhost:${PORT}/api/scrape-comments`);
});
