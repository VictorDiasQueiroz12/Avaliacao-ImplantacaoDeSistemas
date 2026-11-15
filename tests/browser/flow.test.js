import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { createPool } from '../../src/db/pool.js';
import { initializeDatabase } from '../../src/db/migrate.js';
import { createApp } from '../../src/app.js';
test('fluxo na interface, estados de API e telas responsivas', async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString || !new URL(connectionString).pathname.endsWith('_test')) throw new Error('Use um TEST_DATABASE_URL exclusivo terminado em _test.');
  const executablePath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const pool = createPool(connectionString);
  let browser, server;
  try {
    await initializeDatabase(pool);
    const baseline = `Base UI ${Date.now()}`;
    await pool.query('INSERT INTO products(name,price_cents) VALUES ($1,$2)', [baseline, 100]);
    server = createApp(pool).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('button', { name: `Adicionar ${baseline}`, exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).click();
    await page.getByRole('button', { name: 'Cadastrar produto', exact: true }).last().click();
    assert.match(await page.locator('#name-error').textContent(), /Informe/);
    const productName = `Tapioca UI ${Date.now()}`;
    await page.getByLabel('Nome do produto').fill(productName);
    await page.getByLabel('Descrição').fill('Queijo e tomate.');
    await page.getByLabel('Preço (R$)').fill('7,35');
    await page.locator('#save-product').click();
    await page.locator('#product-dialog').waitFor({ state: 'hidden' });
    await page.getByLabel('Buscar no cardápio').fill(productName);
    await page.getByRole('button', { name: `Adicionar ${productName}`, exact: true }).first().click();
    await page.getByRole('link', { name: /Novo pedido/ }).first().click();
    await page.getByRole('button', { name: `Aumentar quantidade de ${productName}`, exact: true }).click();
    assert.match(await page.locator('#cart-total').textContent(), /14,70/);
    await page.getByRole('button', { name: `Remover ${productName}`, exact: true }).click();
    assert.ok(await page.locator('#confirm-order').isDisabled());
    await page.getByRole('button', { name: `Adicionar ${productName}`, exact: true }).last().click();
    await page.getByLabel(`Quantidade de ${productName}`, { exact: true }).fill('2');
    await page.getByLabel(`Quantidade de ${productName}`, { exact: true }).press('Tab');
    await page.locator('#confirm-order').click();
    await page.waitForURL('**/#historico');
    await page.locator('.order-record').first().waitFor();
    assert.match(await page.locator('.order-record').first().textContent(), /14,70/);
    assert.match(await page.locator('.order-record').first().textContent(), new RegExp(productName));
    await page.route('**/api/orders?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Falha simulada de consulta.' }) }));
    await page.locator('#reload-orders').click();
    await page.getByText('Falha simulada de consulta.', { exact: true }).waitFor();
    await page.unroute('**/api/orders?*');
    await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
    await page.locator('.order-record').first().waitFor();
    await page.route('**/api/products', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.getByRole('link', { name: /Novo pedido/ }).first().click();
    await page.locator('#reload-products').click();
    await page.getByText('Ainda não há produtos. Cadastre um produto no cardápio.', { exact: true }).waitFor();
    await page.unroute('**/api/products');
    await page.locator('#reload-products').click();
    await page.getByRole('button', { name: `Adicionar ${productName}`, exact: true }).last().waitFor();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const hash of ['cardapio', 'pedido', 'historico']) {
        await page.evaluate(hash => { location.hash = hash; }, hash);
        await page.waitForFunction(hash => !document.getElementById(hash).hidden, hash);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow em ${hash} a ${width}px`);
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
