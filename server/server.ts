import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import { createApp } from './app.js';

dotenv.config();

const { app } = createApp();

async function startServer() {
  const isProduction =
    process.env.NODE_ENV === 'production';

  // ==========================================================
  // Frontend
  // ==========================================================

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');

    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      res.sendFile(
        path.join(distPath, 'index.html')
      );
    });
  }

  // ==========================================================
  // Server
  // ==========================================================

  const PORT = process.env.PORT || 8000;

  app.listen(PORT, () => {
    console.log(
      `Server running on http://localhost:${PORT}`
    );
  });
}

startServer();