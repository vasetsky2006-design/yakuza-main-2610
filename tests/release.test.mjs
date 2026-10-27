import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const read = name => readFile(path.join(site, name), 'utf8');

test('Netlify publishes public files using portable paths', async () => {
  const config = await readFile(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(config, /publish\s*=\s*"site"/);
  assert.match(config, /command\s*=\s*"npm run build"/);
  assert.match(config, /directory\s*=\s*"netlify\/functions"/);
  assert.doesNotMatch(config, /\/Users\/|\/workspace\/|publishOrigin/);
  for (const name of ['README.md', 'package.json', 'netlify.toml', 'tests', 'netlify']) await assert.rejects(access(path.join(site, name)));
});

test('Control Tower homepage preserves consulting and labels future modules', async () => {
  const home = await read('index.html'), sales = await read('sales.html'), bot = await read('sales-bot.html');
  assert.match(home, /<title>YAKUZA AI Control Tower/);
  assert.match(home, /href="\/sales"/); assert.match(home, /href="\/sales-bot"/);
  assert.match(sales, /4 000 грн/); assert.match(sales, /24 000 грн/);
  assert.match(sales, /action='\/\.netlify\/functions\/lead-intake'/);
  assert.match(sales, /rel="canonical" href="https:\/\/yakuza\.pp\.ua\/sales"/);
  assert.match(bot, /https:\/\/t\.me\/yakuza_sales_bot\?start=site_free/);
  const cards = [...home.matchAll(/<article[^>]+data-module="vision"[^>]*>([\s\S]*?)<\/article>/g)];
  for (const name of ['Sakura', 'KATANA', 'Torii', 'Shogun']) assert.ok(cards.some(card => card[1].includes('<h3>' + name + '</h3>')), name);
});

test('internal links and relocated anchors resolve', async () => {
  for (const name of (await readdir(site)).filter(name => name.endsWith('.html'))) {
    const html = await read(name);
    assert.doesNotMatch(html, /href=["']\/#(?:brief|output)["']/);
    for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
      const raw = match[1];
      if (/^(https?:|mailto:|tel:|data:|javascript:|#)/.test(raw) || raw.startsWith('/.netlify/')) continue;
      const url = new URL(raw, 'https://yakuza.pp.ua/' + name);
      let resource = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      if (!path.extname(resource)) resource += '.html';
      await access(path.join(site, resource)).catch(() => assert.fail(name + ': missing ' + raw));
      if (url.hash && resource.endsWith('.html')) {
        const destination = await read(resource), id = decodeURIComponent(url.hash.slice(1));
        assert.ok(destination.includes('id="' + id + '"') || destination.includes("id='" + id + "'"), name + ': missing anchor ' + raw);
      }
    }
  }
});

test('ecosystem filters update modules and accessibility state', async () => {
  const buttons = ['all','current','vision'].map(filter => ({dataset:{filter}, attributes:{}, listeners:{}, setAttribute(k,v){this.attributes[k]=v;}, addEventListener(e,f){this.listeners[e]=f;}}));
  const modules = ['current','current','vision','vision','vision','vision'].map(module => ({dataset:{module},hidden:false}));
  const count = {textContent:''};
  runInNewContext(await read('tower.js'), {document:{querySelectorAll(s){return s === '[data-filter]' ? buttons : s === '[data-module]' ? modules : [];}, querySelector(){return count;}}});
  for (const [index, expected] of [[1,2],[2,4],[0,6]]) {
    buttons[index].listeners.click();
    assert.equal(modules.filter(m => !m.hidden).length, expected);
    assert.equal(buttons[index].attributes['aria-pressed'], 'true');
  }
  assert.match(count.textContent, /6/);
});
