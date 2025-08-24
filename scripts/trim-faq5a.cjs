const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

function getLocaleFiles() {
  return fs
    .readdirSync(LOCALES_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Attempt to cut text at first sentence end or when a bilateral-exception phrase starts
function trimToFirstSentenceWithoutBilateral(text) {
  if (typeof text !== 'string') return text;

  // Punctuation that commonly ends a sentence across our locales
  const sentenceEndChars = ['.', '!', '?', '。', '！', '？', '۔'];

  // Phrases that signal bilateral-exception mentions across many languages
  const bilateralPatterns = [
    /bilater/iu,              // many European languages
    /ikili/iu,                // Turkish
    /двусторон/iu,           // Russian/Bulgarian, etc.
    /двосторон/iu,           // Ukrainian, etc.
    /двостран/iu,
    /dwustron/iu,            // Polish
    /bilaterál/iu,           // Czech/Slovak variants
    /dvostr/iu,              // Slovenian/Serbian/Croatian
    /dvišal/iu,              // Lithuanian
    /divpus/iu,              // Latvian
    /kahdenväl/iu,           // Finnish
    /kahepool/iu,            // Estonian
    /دو\s?طرف/iu,            // Urdu/Arabic (دو طرفه/دوطرفه)
    /دوجانبه/iu,             // Persian
    /ثنائ/iu,                // Arabic
    /二国間/iu,               // Japanese
    /双边|雙邊/iu,            // Chinese (Simplified/Traditional)
    /양자/iu,                // Korean
    /ทวิภาคี/iu,             // Thai
    /song\s?phương/iu        // Vietnamese
  ];

  // Find earliest bilateral mention index, if any
  let bilateralIndex = -1;
  for (const re of bilateralPatterns) {
    const m = text.match(re);
    if (m) {
      const idx = m.index ?? -1;
      if (idx !== -1 && (bilateralIndex === -1 || idx < bilateralIndex)) {
        bilateralIndex = idx;
      }
    }
  }

  // Find first sentence-ending punctuation
  let sentenceEndIndex = -1;
  for (let i = 0; i < text.length; i++) {
    if (sentenceEndChars.includes(text[i])) {
      sentenceEndIndex = i + 1; // include the punctuation
      break;
    }
  }

  // Decide cut point: earliest of sentence end or bilateral mention
  let cutAt = -1;
  if (bilateralIndex !== -1 && sentenceEndIndex !== -1) {
    cutAt = Math.min(sentenceEndIndex, bilateralIndex);
  } else if (bilateralIndex !== -1) {
    cutAt = bilateralIndex;
  } else if (sentenceEndIndex !== -1) {
    cutAt = sentenceEndIndex;
  }

  if (cutAt === -1) return text.trim();

  return text.slice(0, cutAt).trim();
}

function main() {
  const files = getLocaleFiles();
  let changed = 0;
  for (const file of files) {
    const fullPath = path.join(LOCALES_DIR, file);
    const data = readJson(fullPath);
    if (!data || !data.content || typeof data.content.faq5A !== 'string') continue;

    const original = data.content.faq5A;
    const trimmed = trimToFirstSentenceWithoutBilateral(original);
    if (trimmed !== original) {
      data.content.faq5A = trimmed;
      writeJson(fullPath, data);
      console.log(`Updated ${file}: shortened faq5A`);
      changed++;
    }
  }
  console.log(`\nDone. Files updated: ${changed}`);
}

main();


