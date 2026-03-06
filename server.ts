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
