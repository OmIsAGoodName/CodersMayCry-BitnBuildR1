import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let geminiKey = process.env.GEMINI_API_KEY || '';
let openAiKey = process.env.OPENAI_API_KEY || '';

try {
  const envPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const geminiMatch = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/) || envContent.match(/AI_API_KEY=([^\r\n]+)/);
    if (geminiMatch && geminiMatch[1]) geminiKey = geminiMatch[1].trim();

    const openAiMatch = envContent.match(/OPENAI_API_KEY=([^\r\n]+)/);
    if (openAiMatch && openAiMatch[1]) openAiKey = openAiMatch[1].trim();
  }
} catch {}

const port = Number(process.env.PORT || 5173);
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  define: {
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
    'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(openAiKey),
    'import.meta.env.VITE_AI_API_KEY': JSON.stringify(geminiKey || openAiKey),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'janvyapar-ai-proxy',
      configureServer(server) {
        server.middlewares.use('/api/ai/parse', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }

          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk;
          });

          req.on('end', async () => {
            try {
              const { text, modelName = 'gemini-3.6-flash', apiKey, systemPrompt } = JSON.parse(bodyStr || '{}');
              const keyToUse = (apiKey || geminiKey || '').trim().replace(/^["']|["']$/g, '');

              if (!keyToUse) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'No API key provided' }));
                return;
              }

              const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${keyToUse}`;
              const googleRes = await fetch(googleUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [
                    {
                      parts: [{ text: `${systemPrompt}\n\nParse this WhatsApp message into structured order JSON:\n${text}` }],
                    },
                  ],
                  generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                  },
                }),
              });

              if (googleRes.ok) {
                const data = await googleRes.json();
                const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, rawJson }));
              } else {
                const errJson = await googleRes.json().catch(() => null);
                res.writeHead(googleRes.status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, status: googleRes.status, error: errJson?.error?.message || `HTTP ${googleRes.status}` }));
              }
            } catch (err: unknown) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: false, error: (err as Error)?.message || 'Proxy error' }));
            }
          });
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
