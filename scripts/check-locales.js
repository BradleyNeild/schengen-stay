const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getLocaleFiles() {
	return fs
		.readdirSync(LOCALES_DIR)
		.filter((f) => f.endsWith('.json'))
		.sort();
}

function flattenObject(input, prefix = '') {
	const flat = {};
	for (const [key, value] of Object.entries(input)) {
		const composedKey = prefix ? `${prefix}.${key}` : key;
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			Object.assign(flat, flattenObject(value, composedKey));
		} else {
			flat[composedKey] = value;
		}
	}
	return flat;
}

function summarize(arr, max = 12) {
	if (arr.length === 0) return [];
	if (arr.length <= max) return arr;
	return [...arr.slice(0, max), `...(+${arr.length - max} more)`];
}

function main() {
	const files = getLocaleFiles();
	if (!files.includes('en.json')) {
		console.error('Missing baseline locales/en.json');
		process.exit(1);
	}

	const en = readJson(path.join(LOCALES_DIR, 'en.json'));
	const enFlat = flattenObject(en);

	for (const file of files) {
		if (file === 'en.json') continue;
		const fullPath = path.join(LOCALES_DIR, file);
		const data = readJson(fullPath);
		const flat = flattenObject(data);

		const missing = [];
		const extra = [];
		const untranslated = [];

		for (const key of Object.keys(enFlat)) {
			if (!(key in flat)) {
				missing.push(key);
			} else if (typeof enFlat[key] === 'string' && enFlat[key] === flat[key]) {
				untranslated.push(key);
			}
		}

		for (const key of Object.keys(flat)) {
			if (!(key in enFlat)) extra.push(key);
		}

		console.log(`\n== ${file} ==`);
		console.log(`Missing: ${missing.length}`);
		for (const k of summarize(missing)) console.log(`  ${k}`);
		console.log(`Extra: ${extra.length}`);
		for (const k of summarize(extra)) console.log(`  ${k}`);
		console.log(`Untranslated: ${untranslated.length}`);
		for (const k of summarize(untranslated)) console.log(`  ${k}`);
	}
}

main();


