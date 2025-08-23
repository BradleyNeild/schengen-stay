import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();

const LOCALES_DIR = path.join(__dirname, 'locales');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const DIST_DIR = path.join(__dirname, 'dist');

// Simple, localized titles for each supported language
// Ensures consistent, concise titles across all locales
const SIMPLE_TITLES = {
  'en': 'Schengen Stay - Simple Visa Planner',
  'ar': 'Schengen Stay - مخطط تأشيرة بسيط',
  'bg': 'Schengen Stay - Опростен планер за визи',
  'bn': 'Schengen Stay - সহজ ভিসা পরিকল্পক',
  'cs': 'Schengen Stay - Jednoduchý plánovač víz',
  'da': 'Schengen Stay - Simpel visumplanlægger',
  'de': 'Schengen Stay - Einfacher Visa-Planer',
  'el': 'Schengen Stay - Απλό εργαλείο βίζας',
  'es': 'Schengen Stay - Planificador de visado simple',
  'et': 'Schengen Stay - Lihtne viisumiplaneerija',
  'fa': 'Schengen Stay - برنامه‌ریز ساده ویزا',
  'fi': 'Schengen Stay - Yksinkertainen viisumisuunnittelija',
  'fil': 'Schengen Stay - Simpleng visa planner',
  'fr': 'Schengen Stay - Planificateur de visa simple',
  'he': 'Schengen Stay - מתכנן ויזה פשוט',
  'hi': 'Schengen Stay - सरल वीज़ा प्लानर',
  'hu': 'Schengen Stay - Egyszerű vízumtervező',
  'id': 'Schengen Stay - Perencana visa sederhana',
  'is': 'Schengen Stay - Einfalt áritunaráætlun',
  'it': 'Schengen Stay - Pianificatore di visto semplice',
  'ja': 'Schengen Stay - かんたんビザプランナー',
  'ko': 'Schengen Stay - 간단한 비자 플래너',
  'lt': 'Schengen Stay - Paprastas vizų planuoklis',
  'lv': 'Schengen Stay - Vienkāršs vīzas plānotājs',
  'ms': 'Schengen Stay - Perancang visa ringkas',
  'nl': 'Schengen Stay - Eenvoudige visumplanner',
  'no': 'Schengen Stay - Enkel visumplanlegger',
  'pl': 'Schengen Stay - Prosty planer wizowy',
  'pt': 'Schengen Stay - Planeador de visto simples',
  'pt-BR': 'Schengen Stay - Planejador de visto simples',
  'ro': 'Schengen Stay - Planificator de viză simplu',
  'ru': 'Schengen Stay - Простой планировщик виз',
  'sk': 'Schengen Stay - Jednoduchý plánovač víz',
  'sl': 'Schengen Stay - Preprost načrtovalnik vizumov',
  'sr': 'Schengen Stay - Jednostavan planer viza',
  'sv': 'Schengen Stay - Enkel visumplanerare',
  'th': 'Schengen Stay - ตัววางแผนวีซ่าแบบง่าย',
  'tr': 'Schengen Stay - Basit vize planlayıcı',
  'uk': 'Schengen Stay - Простий планувальник віз',
  'ur': 'Schengen Stay - سادہ ویزا پلانر',
  'vi': 'Schengen Stay - Trình lập kế hoạch visa đơn giản',
  'zh': 'Schengen Stay - 简单的签证规划器',
  'zh-TW': 'Schengen Stay - 簡單的簽證規劃器'
};

// Auto-discover supported locales from the locales directory
function discoverLocales() {
  const localeFiles = fs.existsSync(LOCALES_DIR)
    ? fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'))
    : [];

  const discovered = [];
  for (const file of localeFiles) {
    try {
      const raw = readJson(path.join(LOCALES_DIR, file));
      const fileBase = path.basename(file, '.json');
      const code = (raw.lang || fileBase).replace('_', '-');
      const canonical = raw?.head?.canonical
        || (code === 'en' ? 'https://schengen-stay.com/' : `https://schengen-stay.com/${code}/`);
      const pathPrefix = code === 'en' ? '/' : `/${code}/`;
      discovered.push({ code, file, baseUrl: canonical, pathPrefix });
    } catch (e) {
      console.warn(`Failed to parse locale file ${file}:`, e?.message || e);
    }
  }

  // Ensure 'en' is first, then sort remaining by code for stable output
  discovered.sort((a, b) => {
    if (a.code === 'en') return -1;
    if (b.code === 'en') return 1;
    return a.code.localeCompare(b.code);
  });
  return discovered;
}

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

function buildHreflangLinks(currentCode, supported) {
  const links = [];
  // x-default → root
  links.push(`<link rel="alternate" hreflang="x-default" href="https://schengen-stay.com/">`);
  for (const l of supported) {
    const href = l.baseUrl;
    links.push(`<link rel="alternate" hreflang="${l.code}" href="${href}">`);
  }
  return links.join('\n    ');
}

function buildLangSwitcher(currentCode, supported) {
  const nameMap = {
    en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', nl: 'Nederlands', sv: 'Svenska', pl: 'Polski', fi: 'Suomi', bg: 'Български',
    ru: 'Русский', uk: 'Українська', tr: 'Türkçe', ar: 'العربية', he: 'עברית', fa: 'فارسی', ur: 'اردو',
    hi: 'हिन्दी', bn: 'বাংলা', th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa Indonesia', ms: 'Bahasa Melayu', ja: '日本語', ko: '한국어',
    zh: '中文(简体)', 'zh-TW': '中文(繁體)', pt: 'Português', 'pt-BR': 'Português (Brasil)', cs: 'Čeština', da: 'Dansk', el: 'Ελληνικά', et: 'Eesti',
    hu: 'Magyar', is: 'Íslenska', lt: 'Lietuvių', lv: 'Latviešu', no: 'Norsk', ro: 'Română', sk: 'Slovenčina', sl: 'Slovenščina', sr: 'Српски', fil: 'Filipino'
  };
  const flagMap = {
    en: '🇬🇧', de: '🇩🇪', fr: '🇫🇷', es: '🇪🇸', it: '🇮🇹', nl: '🇳🇱', sv: '🇸🇪', pl: '🇵🇱', fi: '🇫🇮', bg: '🇧🇬',
    ru: '🇷🇺', uk: '🇺🇦', tr: '🇹🇷', ar: '🇸🇦', he: '🇮🇱', fa: '🇮🇷', ur: '🇵🇰',
    hi: '🇮🇳', bn: '🇧🇩', th: '🇹🇭', vi: '🇻🇳', id: '🇮🇩', ms: '🇲🇾', ja: '🇯🇵', ko: '🇰🇷',
    zh: '🇨🇳', 'zh-TW': '🇹🇼', pt: '🇵🇹', 'pt-BR': '🇧🇷', cs: '🇨🇿', da: '🇩🇰', el: '🇬🇷', et: '🇪🇪',
    hu: '🇭🇺', is: '🇮🇸', lt: '🇱🇹', lv: '🇱🇻', no: '🇳🇴', ro: '🇷🇴', sk: '🇸🇰', sl: '🇸🇮', sr: '🇷🇸', fil: '🇵🇭'
  };
  const options = supported.map(l => {
    const href = l.code === 'en' ? '/' : `/${l.code}/`;
    const label = `${flagMap[l.code] || '🌐'} ${nameMap[l.code] || l.code.toUpperCase()}`;
    const selected = l.code === currentCode ? ' selected' : '';
    return `<option value="${href}" data-lang="${l.code}"${selected}>${label}</option>`;
  });
  return `<label for="lang-select" class="sr-only">Language</label><select id="lang-select" class="lang-select">${options.join('')}</select>`;
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

function writeSitemap(supported) {
  const urls = [];
  const now = new Date().toISOString().slice(0,10);
  for (const l of supported) {
    urls.push({ loc: l.baseUrl, changefreq: 'weekly', priority: '1.0' });
    urls.push({ loc: new URL('privacy.html', l.baseUrl).toString(), changefreq: 'yearly', priority: '0.3' });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), xml, 'utf8');
}

// Append directory-style redirects for each locale to dist/_redirects
function writeRedirects(supported) {
  const redirectsPath = path.join(DIST_DIR, '_redirects');
  try {
    let existing = '';
    if (fs.existsSync(redirectsPath)) {
      existing = fs.readFileSync(redirectsPath, 'utf8');
    }
    const lines = [];
    for (const l of supported) {
      if (l.code === 'en') continue;
      const line = `/${l.code}  /${l.code}/  301`;
      if (!existing.includes(line)) lines.push(line);
    }
    if (lines.length > 0) {
      const out = existing.trimEnd() + (existing ? '\n\n' : '') + '# Locale directory redirects (auto-generated)\n' + lines.join('\n') + '\n';
      fs.writeFileSync(redirectsPath, out, 'utf8');
    }
  } catch (e) {
    console.warn('Failed to write locale redirects:', e?.message || e);
  }
}

function injectRuntimeI18n(html, localeData) {
  const boot = `<script>window.LOCALE=${JSON.stringify(localeData.lang || 'en')};window.I18N=${JSON.stringify(localeData)};</script>`;
  // Inject before first stylesheet link to be early
  return html.replace('</head>', `${boot}\n</head>`);
}

function build() {
  copyStatic();
  const SUPPORTED = discoverLocales();
  const indexTemplate = readTemplate('index.html');
  const privacyTemplate = readTemplate('privacy.html');

  // Ensure redirects include discovered locales
  writeRedirects(SUPPORTED);

  for (const l of SUPPORTED) {
    // Handle locale files where filename may differ from lang code (e.g., pt_BR.json → pt-BR)
    const fileCandidate = fs.existsSync(path.join(LOCALES_DIR, `${l.code}.json`))
      ? `${l.code}.json`
      : fs.readdirSync(LOCALES_DIR).find(f => f.endsWith('.json') && (readJson(path.join(LOCALES_DIR, f)).lang || path.basename(f, '.json')).replace('_', '-') === l.code);
    const localePath = path.join(LOCALES_DIR, fileCandidate || `${l.code}.json`);
    if (!fs.existsSync(localePath)) {
      console.warn(`Missing locale file: ${localePath}`);
      continue;
    }
    const data = readJson(localePath);

    // Compute simple, localized title for this locale
    const codeKey = l.code;
    const langKey = (data.lang || '').replace('_', '-');
    const simpleTitle = SIMPLE_TITLES[codeKey] || SIMPLE_TITLES[langKey] || SIMPLE_TITLES.en;
    const head = { ...(data.head || {}), title: simpleTitle, ogTitle: simpleTitle, twitterTitle: simpleTitle };

    const outDir = path.join(DIST_DIR, l.code === 'en' ? '.' : l.code);
    ensureDir(outDir);

    // common substitutions
    const rtlLangs = new Set(['ar', 'he', 'fa', 'ur']);
    const model = {
      lang: data.lang || l.code,
      dir: data.dir || (rtlLangs.has(l.code) ? 'rtl' : 'ltr'),
      head,
      home: data.home || {},
      sections: data.sections || {},
      privacy: data.privacy || {},
      ui: data.ui || {},
      content: data.content || {},
      og: { locale: data['og.locale'] || 'en_US' },
      'head.hreflangLinks': buildHreflangLinks(l.code, SUPPORTED),
      links: {
        home: l.code === 'en' ? '/' : `/${l.code}/`,
        privacy: l.code === 'en' ? '/privacy.html' : `/${l.code}/privacy.html`
      },
      langSwitcher: buildLangSwitcher(l.code, SUPPORTED)
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

  writeSitemap(SUPPORTED);
}

build();


