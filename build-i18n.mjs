import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

const LOCALES_DIR = path.join(__dirname, 'locales');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const DIST_DIR = path.join(__dirname, 'dist');

// Configure supported locales and their base paths
const SUPPORTED = [
  { code: 'en', baseUrl: 'https://schengen-stay.com/', pathPrefix: '/' },
  { code: 'de', baseUrl: 'https://schengen-stay.com/de/', pathPrefix: '/de/' },
  { code: 'fr', baseUrl: 'https://schengen-stay.com/fr/', pathPrefix: '/fr/' },
  { code: 'zh', baseUrl: 'https://schengen-stay.com/zh/', pathPrefix: '/zh/' },
  { code: 'hi', baseUrl: 'https://schengen-stay.com/hi/', pathPrefix: '/hi/' }
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function render(template, data) {
  return template.replace(/\{\{\s*([\w\.-]+)\s*\}\}/g, (_, key) => {
    // Support nested keys like head.title
    const parts = key.split('.');
    let cur = data;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else { cur = ''; break; }
    }
    return (cur ?? '').toString();
  });
}

function buildHreflangLinks(currentCode) {
  const links = [];
  // x-default → root
  links.push(`<link rel="alternate" hreflang="x-default" href="https://schengen-stay.com/">`);
  for (const l of SUPPORTED) {
    const href = l.baseUrl;
    links.push(`<link rel="alternate" hreflang="${l.code}" href="${href}">`);
  }
  return links.join('\n    ');
}

function buildLangSwitcher(currentCode) {
  const nameMap = { en: 'EN', de: 'DE', fr: 'FR', zh: '中文', hi: 'हिंदी' };
  const links = SUPPORTED.map(l => {
    const href = l.code === 'en' ? '/' : `/${l.code}/`;
    const label = nameMap[l.code] || l.code.toUpperCase();
    const current = l.code === currentCode;
    return `<a href="${href}"${current ? ' aria-current="true" class="active"' : ''}>${label}</a>`;
  });
  return links.join(' <span class="lang-sep">·</span> ');
}

function copyStatic() {
  // Copy top-level static files to dist root
  const staticFiles = [
    'styles.css', 'script.js', 'engine.js', 'site.webmanifest',
    'robots.txt', 'ads.txt', '_headers', '_redirects'
  ];
  ensureDir(DIST_DIR);
  for (const f of staticFiles) {
    if (fs.existsSync(path.join(__dirname, f))) {
      fs.copyFileSync(path.join(__dirname, f), path.join(DIST_DIR, f));
    }
  }
  // Copy icons folder
  const iconsSrc = path.join(__dirname, 'icons');
  const iconsDst = path.join(DIST_DIR, 'icons');
  if (fs.existsSync(iconsSrc)) {
    ensureDir(iconsDst);
    for (const file of fs.readdirSync(iconsSrc)) {
      fs.copyFileSync(path.join(iconsSrc, file), path.join(iconsDst, file));
    }
  }
}

function writeSitemap() {
  const urls = [];
  const now = new Date().toISOString().slice(0,10);
  for (const l of SUPPORTED) {
    urls.push({ loc: l.baseUrl, changefreq: 'weekly', priority: '1.0' });
    urls.push({ loc: new URL('privacy.html', l.baseUrl).toString(), changefreq: 'yearly', priority: '0.3' });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), xml, 'utf8');
}

function injectRuntimeI18n(html, localeData) {
  const boot = `<script>window.LOCALE=${JSON.stringify(localeData.lang || 'en')};window.I18N=${JSON.stringify(localeData)};</script>`;
  // Inject before first stylesheet link to be early
  return html.replace('</head>', `${boot}\n</head>`);
}

function build() {
  copyStatic();
  const indexTemplate = readTemplate('index.html');
  const privacyTemplate = readTemplate('privacy.html');

  for (const l of SUPPORTED) {
    const localePath = path.join(LOCALES_DIR, `${l.code}.json`);
    if (!fs.existsSync(localePath)) {
      console.warn(`Missing locale file: ${localePath}`);
      continue;
    }
    const data = readJson(localePath);

    const outDir = path.join(DIST_DIR, l.code === 'en' ? '.' : l.code);
    ensureDir(outDir);

    // common substitutions
    const model = {
      lang: data.lang || l.code,
      head: data.head || {},
      home: data.home || {},
      sections: data.sections || {},
      privacy: data.privacy || {},
      ui: data.ui || {},
      content: data.content || {},
      og: { locale: data['og.locale'] || 'en_US' },
      'head.hreflangLinks': buildHreflangLinks(l.code),
      links: {
        home: l.code === 'en' ? '/' : `/${l.code}/`,
        privacy: l.code === 'en' ? '/privacy.html' : `/${l.code}/privacy.html`
      },
      langSwitcher: buildLangSwitcher(l.code)
    };

    // Render index
    let indexHtml = render(indexTemplate, model);
    indexHtml = injectRuntimeI18n(indexHtml, data);
    fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml, 'utf8');

    // Render privacy
    let privacyHtml = render(privacyTemplate, model);
    privacyHtml = injectRuntimeI18n(privacyHtml, data);
    fs.writeFileSync(path.join(outDir, 'privacy.html'), privacyHtml, 'utf8');
  }

  writeSitemap();
}

build();


