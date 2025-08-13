(function (root, factory) {
	if (typeof module === 'object' && module.exports) module.exports = factory();
	else root.SchengenEngine = factory();
}(this, function () {
	// Timezone-safe helpers (local date components only)
	function parseISODateLocal(isoDateString) {
		const parts = isoDateString.split('-');
		const year = parseInt(parts[0], 10);
		const month = parseInt(parts[1], 10) - 1;
		const day = parseInt(parts[2], 10);
		const date = new Date(year, month, day);
		if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
		return date;
	}

	function dateToISOString(date) {
		if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function getTodayLocal() {
		const now = new Date();
		return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
	}

	function calculateStayDuration(startDate, endDate) {
		let start = typeof startDate === 'string' ? parseISODateLocal(startDate) : startDate;
		let end = typeof endDate === 'string' ? parseISODateLocal(endDate) : endDate;
		if (!start || !end) return 0;
		const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
		const b = new Date(end.getFullYear(), end.getMonth(), end.getDate());
		if (b < a) return 0;
		const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
		return diff + 1; // inclusive
	}

	// Two-digit year policy
	let TWO_DIGIT_YEAR_WINDOW = 20;
	function setTwoDigitYearWindow(windowSize) {
		const bounded = Math.max(0, Math.min(50, Number(windowSize)));
		if (!Number.isNaN(bounded)) TWO_DIGIT_YEAR_WINDOW = bounded;
	}

	function convertTwoDigitYear(twoDigitYear) {
		const currentYear = getTodayLocal().getFullYear();
		const currentCentury = Math.floor(currentYear / 100) * 100;
		const currentTwoDigit = currentYear % 100;
		const windowSize = TWO_DIGIT_YEAR_WINDOW;
		if (Math.abs(twoDigitYear - currentTwoDigit) <= windowSize) return currentCentury + twoDigitYear;
		if (twoDigitYear > currentTwoDigit + windowSize) return currentCentury - 100 + twoDigitYear;
		if (twoDigitYear < currentTwoDigit - windowSize) return currentCentury + 100 + twoDigitYear;
		return currentCentury + twoDigitYear;
	}

	// Trips helpers
	function tripsSignature(tripsArray) {
		return (tripsArray || [])
			.map(t => `${t.entryDate}-${t.exitDate}`)
			.sort()
			.join('|');
	}

	function mergeTripsByDay(tripsArray) {
		const normalized = (tripsArray || [])
			.map(t => ({ entry: parseISODateLocal(t.entryDate), exit: parseISODateLocal(t.exitDate) }))
			.filter(x => x.entry && x.exit)
			.sort((a, b) => a.entry - b.entry);
		const merged = [];
		for (const t of normalized) {
			if (!merged.length) { merged.push({ start: t.entry, end: t.exit }); continue; }
			const last = merged[merged.length - 1];
			const lastEndPlusOne = new Date(last.end.getFullYear(), last.end.getMonth(), last.end.getDate() + 1);
			if (t.entry <= lastEndPlusOne) {
				if (t.exit > last.end) last.end = t.exit;
			} else {
				merged.push({ start: t.entry, end: t.exit });
			}
		}
		return merged;
	}

	class SchengenCalculationEngine {
		constructor(options = {}) {
			this.MAX_DAYS_IN_PERIOD = 90;
			this.PERIOD_LENGTH_DAYS = 180;
			this.cache = new Map();
			this.historyArrays = null;
			this.todayProvider = options.todayProvider || (() => getTodayLocal());
		}
		today() { return this.todayProvider(); }

		parseDate(dateStr) {
			if (dateStr instanceof Date) return new Date(dateStr.getFullYear(), dateStr.getMonth(), dateStr.getDate());
			return parseISODateLocal(dateStr);
		}

		dateToString(date) { return dateToISOString(date); }

		clearCache() { this.cache.clear(); this.historyArrays = null; }

		buildDailyHistory(trips, startDate = null, endDate = null) {
			if (!trips || trips.length === 0) {
				const today = this.today();
				return { dailyPresence: [], cumulativeDays: [], dateRange: { start: today, end: today }, totalDays: 0 };
			}
			const tripDates = trips.flatMap(trip => {
				const entry = this.parseDate(trip.entryDate);
				const exit = this.parseDate(trip.exitDate);
				return entry && exit ? [entry, exit] : [];
			}).filter(Boolean);
			if (tripDates.length === 0) {
				const today = this.today();
				return { dailyPresence: [], cumulativeDays: [], dateRange: { start: today, end: today }, totalDays: 0 };
			}
			const earliestTrip = new Date(Math.min(...tripDates.map(d => d.getTime())));
			const latestTrip = new Date(Math.max(...tripDates.map(d => d.getTime())));
			const analysisStart = startDate || new Date(earliestTrip.getTime() - (this.PERIOD_LENGTH_DAYS * 86400000));
			const analysisEnd = endDate || new Date(Math.max(latestTrip.getTime(), this.today().getTime()) + (this.PERIOD_LENGTH_DAYS * 86400000));
			analysisStart.setHours(0,0,0,0); analysisEnd.setHours(0,0,0,0);
			const totalDays = Math.round((analysisEnd.getTime() - analysisStart.getTime()) / 86400000) + 1;
			const dailyPresence = new Array(totalDays).fill(0);
			const cumulativeDays = new Array(totalDays).fill(0);
			const merged = mergeTripsByDay(trips);
			merged.forEach(({ start, end }) => {
				const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
				const endIt = new Date(end.getFullYear(), end.getMonth(), end.getDate());
				while (cur <= endIt) {
					const idx = Math.floor((cur.getTime() - analysisStart.getTime()) / 86400000);
					if (idx >= 0 && idx < totalDays) dailyPresence[idx] = 1;
					cur.setDate(cur.getDate() + 1);
				}
			});
			let windowSum = 0, left = 0;
			for (let i = 0; i < totalDays; i++) {
				windowSum += dailyPresence[i];
				if (i - left + 1 > this.PERIOD_LENGTH_DAYS) windowSum -= dailyPresence[left++];
				cumulativeDays[i] = windowSum;
			}
			return { dailyPresence, cumulativeDays, dateRange: { start: analysisStart, end: analysisEnd }, totalDays };
		}

		getDaysInPeriod(checkDate, trips = null) {
			const tripsToUse = trips || [];
			const dateKey = this.dateToString(checkDate);
			const cacheKey = `${dateKey}:${tripsSignature(tripsToUse)}`;
			if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
			if (!this.historyArrays || this.historyArrays.trips !== tripsToUse) {
				this.historyArrays = { ...this.buildDailyHistory(tripsToUse), trips: tripsToUse };
			}
			const dayIndex = Math.floor((checkDate.getTime() - this.historyArrays.dateRange.start.getTime()) / 86400000);
			const result = (dayIndex >= 0 && dayIndex < this.historyArrays.totalDays) ? this.historyArrays.cumulativeDays[dayIndex] : 0;
			this.cache.set(cacheKey, result);
			return result;
		}
	}

	return {
		SchengenCalculationEngine,
		parseISODateLocal,
		dateToISOString,
		calculateStayDuration,
		setTwoDigitYearWindow,
		convertTwoDigitYear
	};
}));


