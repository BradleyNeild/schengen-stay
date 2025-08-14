const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

const daysAbbrevOverride = {
	cs: 'd.',
	da: 'd.',
	es: 'd.',
	is: 'd.',
	lt: 'd.',
	lv: 'd.',
	nl: 'd.',
	no: 'd.',
	pl: 'd.',
	pt: 'd.',
	'pt_BR': 'd.',
	sk: 'd.',
	sl: 'd.',
	sr: 'd.',
	sv: 'd.'
};

const maxOverride = {
	cs: 'max.',
	de: 'max.',
	fr: 'max.',
	hu: 'max.',
	it: 'max.',
	nl: 'max.',
	ro: 'max.',
	sk: 'max.',
	sv: 'max.',
	sr: 'maks'
};

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
	fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function main() {
	const files = fs.readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'));
	let touched = 0;
	for (const file of files) {
		const full = path.join(LOCALES_DIR, file);
		const data = readJson(full);
		const code = data.lang || path.basename(file, '.json');
		let changed = false;

		if (daysAbbrevOverride[code]) {
			if (data.js && data.js.daysAbbrev === 'd') {
				data.js.daysAbbrev = daysAbbrevOverride[code];
				changed = true;
			}
		}

		if (maxOverride[code]) {
			if (data.js && data.js.max === 'max') {
				data.js.max = maxOverride[code];
				changed = true;
			}
		}

		if (changed) {
			writeJson(full, data);
			touched++;
			console.log(`Updated ${file}`);
		}
	}
	console.log(`Done. Files updated: ${touched}`);
}

main();


