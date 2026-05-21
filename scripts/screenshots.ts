import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = process.env.SCREENSHOT_URL ?? 'http://localhost:3000';
const OUT_DIR = resolve(process.cwd(), '..', 'docs', 'screenshots');

const PAGES: Array<{ name: string; path: string; waitFor?: string }> = [
  { name: 'chat', path: '/chat', waitFor: 'header' },
  { name: 'conversations', path: '/conversations', waitFor: 'h1' },
  { name: 'dashboard', path: '/dashboard', waitFor: '.recharts-wrapper, h1' },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  let failures = 0;
  for (const target of PAGES) {
    const url = BASE_URL + target.path;
    const out = resolve(OUT_DIR, `${target.name}.png`);
    try {
      console.log(`[screenshot] -> ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      if (target.waitFor) {
        await page
          .locator(target.waitFor)
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => undefined);
      }
      await page.waitForTimeout(800);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`[screenshot] saved ${out}`);
    } catch (err) {
      failures += 1;
      console.error(`[screenshot] ${target.name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  if (failures > 0) {
    console.error(`[screenshot] ${failures} failure(s)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[screenshot] fatal:', err);
  process.exit(1);
});
