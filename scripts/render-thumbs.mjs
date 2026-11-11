// Pre-renders the still pictures (hero, cards, house and catalogue thumbnails) to public/renders/*.webp.
// Run with the site previewing on :4321:  npm run build && npx astro preview & node scripts/render-thumbs.mjs
// Needs Playwright (npx playwright install chromium) and Python with Pillow for the WebP step.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.env.BASE ?? 'http://localhost:4321';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const only = process.argv[2]; // optional: comma-separated keys
await page.goto(`${base}/dev/renders${only ? `?only=${only}` : ''}`);
await page.waitForFunction(() => (window).__renders, null, { timeout: 300000 });
const out = await page.evaluate(() => (window).__renders);
await browser.close();

mkdirSync('public/renders', { recursive: true });
const keys = Object.keys(out).sort();
for (const k of keys) writeFileSync(`public/renders/${k}.png`, Buffer.from(out[k].split(',')[1], 'base64'));
execFileSync('python3', ['-c', `
import glob, os
from PIL import Image
for p in glob.glob('public/renders/*.png'):
    im = Image.open(p)
    im.save(p[:-4] + '.webp', 'WEBP', quality=82, method=6)
    os.remove(p)
`], { stdio: 'inherit' });
const prev = only ? JSON.parse(readFileSync('src/lib/renders.json', 'utf8')) : [];
writeFileSync('src/lib/renders.json', JSON.stringify([...new Set([...prev, ...keys])].sort(), null, 0) + '\n');
console.log(`${keys.length} pictures written`);
