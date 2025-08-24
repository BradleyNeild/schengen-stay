const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

const DEFAULTS = {
  kofiCta: 'Buy me a coffee',
  kofiAriaLabel: 'Buy me a coffee on Ko‑fi'
};

// Minimal translations for a few major locales; others fall back to English
const TRANSLATIONS = {
  ar: { kofiCta: 'ادعمني بفنجان قهوة', kofiAriaLabel: 'ادعمني على Ko‑fi' },
  de: { kofiCta: 'Spendier mir einen Kaffee', kofiAriaLabel: 'Unterstütze mich auf Ko‑fi' },
  es: { kofiCta: 'Invítame a un café', kofiAriaLabel: 'Apóyame en Ko‑fi' },
  fr: { kofiCta: 'Offrez‑moi un café', kofiAriaLabel: 'Soutenez‑moi sur Ko‑fi' },
  it: { kofiCta: 'Offrimi un caffè', kofiAriaLabel: 'Sostienimi su Ko‑fi' },
  pt: { kofiCta: 'Pague‑me um café', kofiAriaLabel: 'Apoie‑me no Ko‑fi' },
  'pt-BR': { kofiCta: 'Pague‑me um café', kofiAriaLabel: 'Apoie‑me no Ko‑fi' },
  nl: { kofiCta: 'Trakteer me op koffie', kofiAriaLabel: 'Steun me op Ko‑fi' },
  sv: { kofiCta: 'Bjud mig på kaffe', kofiAriaLabel: 'Stöd mig på Ko‑fi' },
  pl: { kofiCta: 'Postaw mi kawę', kofiAriaLabel: 'Wesprzyj mnie na Ko‑fi' },
  ru: { kofiCta: 'Угости меня кофе', kofiAriaLabel: 'Поддержать на Ko‑fi' },
  uk: { kofiCta: 'Почастуйте мене кавою', kofiAriaLabel: 'Підтримайте мене на Ko‑fi' },
  tr: { kofiCta: 'Bana bir kahve ısmarla', kofiAriaLabel: 'Ko‑fi üzerinden destekle' },
  el: { kofiCta: 'Κεράστε μου έναν καφέ', kofiAriaLabel: 'Υποστήριξέ με στο Ko‑fi' },
  he: { kofiCta: 'תקנו לי קפה', kofiAriaLabel: 'תמכו בי ב‑Ko‑fi' },
  fa: { kofiCta: 'یک قهوه مهمانم شو', kofiAriaLabel: 'از من در Ko‑fi حمایت کنید' },
  ur: { kofiCta: 'مجھے کافی پلائیں', kofiAriaLabel: 'Ko‑fi پر سپورٹ کریں' },
  hi: { kofiCta: 'मुझे कॉफ़ी पिलाएँ', kofiAriaLabel: 'Ko‑fi पर समर्थन करें' },
  bn: { kofiCta: 'আমাকে কফি খাওয়ান', kofiAriaLabel: 'Ko‑fi এ সমর্থন করুন' },
  ja: { kofiCta: 'コーヒーをおごる', kofiAriaLabel: 'Ko‑fi で支援する' },
  ko: { kofiCta: '커피 한 잔 사줘요', kofiAriaLabel: 'Ko‑fi에서 후원하기' },
  zh: { kofiCta: '请我喝杯咖啡', kofiAriaLabel: '在 Ko‑fi 上支持我' },
  'zh-TW': { kofiCta: '請我喝杯咖啡', kofiAriaLabel: '在 Ko‑fi 上支持我' },
  vi: { kofiCta: 'Mời tôi một ly cà phê', kofiAriaLabel: 'Ủng hộ tôi trên Ko‑fi' },
  id: { kofiCta: 'Belikan saya kopi', kofiAriaLabel: 'Dukung saya di Ko‑fi' },
  ms: { kofiCta: 'Belanja saya kopi', kofiAriaLabel: 'Sokong saya di Ko‑fi' }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function main() {
  const files = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
  let updated = 0;
  for (const file of files) {
    const full = path.join(LOCALES_DIR, file);
    const data = readJson(full);
    const code = (data.lang || path.basename(file, '.json')).replace('_', '-');
    const base = code in TRANSLATIONS ? TRANSLATIONS[code] : (TRANSLATIONS[data.lang] || {});
    data.ui = data.ui || {};
    if (!data.ui.kofiCta) data.ui.kofiCta = base.kofiCta || DEFAULTS.kofiCta;
    if (!data.ui.kofiAriaLabel) data.ui.kofiAriaLabel = base.kofiAriaLabel || DEFAULTS.kofiAriaLabel;
    writeJson(full, data);
    updated++;
  }
  console.log(`Updated ${updated} locale files with Ko‑fi keys.`);
}

main();


