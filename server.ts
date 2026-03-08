import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  let vite;
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom', // Use custom to handle index.html manually
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the dist directory in production
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  // API routes
  app.get('/api/news', async (req, res) => {
    const { q, apikey } = req.query;
    const apiKey = apikey || process.env.NEWS_API_KEY || process.env.VITE_NEWS_API_KEY;

    if (!apiKey) {
      return res.status(401).json({ errors: ["News API Key is missing. Please provide it in the UI or environment."] });
    }

    const gnewsUrl = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q as string)}&lang=en&max=15&apikey=${apiKey}`;

    try {
      const response = await fetch(gnewsUrl);
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      res.json(data);
    } catch (error) {
      console.error("Proxy News Error:", error);
      res.status(500).json({ errors: ["Internal server error while fetching news."] });
    }
  });

  // Fallback to index.html for SPA behavior
  app.get('*', async (req, res) => {
    const url = req.originalUrl;
    try {
      if (process.env.NODE_ENV !== 'production' && vite) {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } else {
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
      }
    } catch (e) {
      if (vite) vite.ssrFixStacktrace(e);
      res.status(500).end(e.stack);
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
