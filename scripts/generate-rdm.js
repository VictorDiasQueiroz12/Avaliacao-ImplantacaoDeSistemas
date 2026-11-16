import { chromium } from 'playwright-core';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true
});
try {
  await mkdir(new URL('../output/pdf/', import.meta.url), { recursive: true });
  const page = await browser.newPage();
  await page.setContent(await readFile(new URL('../docs/ficha-rdm.html', import.meta.url), 'utf8'));
  await page.pdf({ path: fileURLToPath(new URL('../output/pdf/Ficha-RDM-EstuLanches.pdf', import.meta.url)),
    format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true });
  console.log('Gerado: output/pdf/Ficha-RDM-EstuLanches.pdf');
} finally { await browser.close(); }
