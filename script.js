// Schengen Visa Calculator - Main Script

// Global variables
let trips = [];
let currentDate = new Date();
let displayDate = new Date();
let selectedStartDate = null;
let selectedEndDate = null;
let selectionMode = false;

// Modern Schengen Calculation Engine - Extracted and modernized from reference
class SchengenCalculationEngine {
    constructor() {
        this.SCHENGEN_START_DATE = new Date(2013, 3, 22); // April 22, 2013
        this.MAX_DAYS_IN_PERIOD = 90;
        this.PERIOD_LENGTH_DAYS = 180;
        this.cache = new Map();
        this.historyArrays = null; // Will contain daily history data
    }

    // Core function: Build daily history arrays for comprehensive calculation
    buildDailyHistory(trips, startDate = null, endDate = null) {
        if (!trips || trips.length === 0) {
            return { dailyPresence: [], cumulativeDays: [], dateRange: { start: new Date(), end: new Date() } };
        }

        // Determine date range to analyze
        const tripDates = trips.flatMap(trip => [
            this.parseDate(trip.entryDate),
            this.parseDate(trip.exitDate)
        ]);
        
        const earliestTrip = new Date(Math.min(...tripDates.map(d => d.getTime())));
        const latestTrip = new Date(Math.max(...tripDates.map(d => d.getTime())));
        
        // Extend range to include 180 days before and after for complete analysis
        const analysisStart = startDate || new Date(earliestTrip.getTime() - (this.PERIOD_LENGTH_DAYS * 24 * 60 * 60 * 1000));
        const analysisEnd = endDate || new Date(Math.max(latestTrip.getTime(), Date.now()) + (this.PERIOD_LENGTH_DAYS * 24 * 60 * 60 * 1000));
        
        const totalDays = Math.ceil((analysisEnd.getTime() - analysisStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        
        // Initialize arrays
        const dailyPresence = new Array(totalDays).fill(0); // hist[] equivalent
        const cumulativeDays = new Array(totalDays).fill(0); // histdager[] equivalent
        
        // Fill daily presence array
        trips.forEach(trip => {
            const tripStart = this.parseDate(trip.entryDate);
            const tripEnd = this.parseDate(trip.exitDate);
            
            for (let date = new Date(tripStart); date <= tripEnd; date.setDate(date.getDate() + 1)) {
                const dayIndex = Math.floor((date.getTime() - analysisStart.getTime()) / (24 * 60 * 60 * 1000));
                if (dayIndex >= 0 && dayIndex < totalDays) {
                    dailyPresence[dayIndex] = 1;
                }
            }
        });
        
        // Calculate cumulative days in rolling 180-day window
        for (let i = 0; i < totalDays; i++) {
            if (i === 0) {
                cumulativeDays[i] = dailyPresence[i];
            } else if (i < this.PERIOD_LENGTH_DAYS) {
                cumulativeDays[i] = cumulativeDays[i - 1] + dailyPresence[i];
            } else {
                cumulativeDays[i] = cumulativeDays[i - 1] + dailyPresence[i] - dailyPresence[i - this.PERIOD_LENGTH_DAYS];
            }
        }
        
        return {
            dailyPresence,
            cumulativeDays,
            dateRange: { start: analysisStart, end: analysisEnd },
            totalDays
        };
    }

    // Get days used in 180-day period ending on specified date
    getDaysInPeriod(checkDate, trips = null) {
        const tripsToUse = trips || window.trips || [];
        const dateKey = this.dateToString(checkDate);
        const cacheKey = `${dateKey}:${JSON.stringify(tripsToUse.map(t => `${t.entryDate}-${t.exitDate}`))}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (!this.historyArrays || this.historyArrays.trips !== tripsToUse) {
            this.historyArrays = {
                ...this.buildDailyHistory(tripsToUse),
                trips: tripsToUse
            };
        }

        const dayIndex = Math.floor((checkDate.getTime() - this.historyArrays.dateRange.start.getTime()) / (24 * 60 * 60 * 1000));
        const result = (dayIndex >= 0 && dayIndex < this.historyArrays.totalDays) ? 
            this.historyArrays.cumulativeDays[dayIndex] : 0;
        
        this.cache.set(cacheKey, result);
        return result;
    }

    // Find comprehensive violation periods with start/end dates
    findViolationPeriods(trips = null) {
        const tripsToUse = trips || window.trips || [];
        if (!tripsToUse || tripsToUse.length === 0) {
            return [];
        }

        const history = this.buildDailyHistory(tripsToUse);
        const violations = [];
        let currentViolation = null;

        for (let i = 0; i < history.totalDays; i++) {
            const currentDate = new Date(history.dateRange.start.getTime() + (i * 24 * 60 * 60 * 1000));
            const daysInPeriod = history.cumulativeDays[i];
            const isViolation = daysInPeriod > this.MAX_DAYS_IN_PERIOD;

            if (isViolation && !currentViolation) {
                // Start of new violation period
                currentViolation = {
                    startDate: new Date(currentDate),
                    endDate: new Date(currentDate),
                    maxDays: daysInPeriod,
                    daysOver: daysInPeriod - this.MAX_DAYS_IN_PERIOD
                };
            } else if (isViolation && currentViolation) {
                // Continue current violation period
                currentViolation.endDate = new Date(currentDate);
                currentViolation.maxDays = Math.max(currentViolation.maxDays, daysInPeriod);
                currentViolation.daysOver = Math.max(currentViolation.daysOver, daysInPeriod - this.MAX_DAYS_IN_PERIOD);
            } else if (!isViolation && currentViolation) {
                // End of violation period
                violations.push(currentViolation);
                currentViolation = null;
            }
        }

        // Handle case where violation period extends to end of analysis
        if (currentViolation) {
            violations.push(currentViolation);
        }

        return violations;
    }

    // Calculate rollover dates - when trips will no longer count in 180-day window
    calculateRolloverDates(trips = null) {
        const tripsToUse = trips || window.trips || [];
        const rollovers = [];

        tripsToUse.forEach(trip => {
            const tripEnd = this.parseDate(trip.exitDate);
            const rolloverDate = new Date(tripEnd.getTime() + (this.PERIOD_LENGTH_DAYS * 24 * 60 * 60 * 1000));
            
            rollovers.push({
                tripId: trip.id,
                tripStart: this.parseDate(trip.entryDate),
                tripEnd: tripEnd,
                rolloverDate: rolloverDate,
                daysInTrip: this.daysBetween(this.parseDate(trip.entryDate), tripEnd)
            });
        });

        return rollovers.sort((a, b) => a.rolloverDate.getTime() - b.rolloverDate.getTime());
    }

    // Find next safe entry date
    findNextSafeEntry(fromDate = new Date(), trips = null) {
        const tripsToUse = trips || window.trips || [];
        const checkDate = new Date(fromDate);
        checkDate.setDate(checkDate.getDate() + 1); // Start from next day

        for (let i = 0; i < 730; i++) { // Check up to 2 years
            const daysInPeriod = this.getDaysInPeriod(checkDate, tripsToUse);
            if (daysInPeriod < this.MAX_DAYS_IN_PERIOD) {
                return {
                    date: new Date(checkDate),
                    daysUsed: daysInPeriod,
                    daysAvailable: this.MAX_DAYS_IN_PERIOD - daysInPeriod
                };
            }
            checkDate.setDate(checkDate.getDate() + 1);
        }

        return null; // No safe entry found within 2 years
    }

    // Calculate maximum stay duration from a given date
    calculateMaxStayFromDate(startDate, trips = null) {
        const tripsToUse = trips || window.trips || [];
        let maxDays = 0;
        const testDate = new Date(startDate);

        for (let days = 1; days <= this.MAX_DAYS_IN_PERIOD; days++) {
            testDate.setTime(startDate.getTime() + ((days - 1) * 24 * 60 * 60 * 1000));
            
            // Create hypothetical trip for testing
            const testTrips = [...tripsToUse, {
                id: 'test',
                entryDate: this.dateToString(startDate),
                exitDate: this.dateToString(testDate)
            }];

            const daysInPeriod = this.getDaysInPeriod(testDate, testTrips);
            if (daysInPeriod <= this.MAX_DAYS_IN_PERIOD) {
                maxDays = days;
            } else {
                break;
            }
        }

        return maxDays;
    }

    // Find optimal travel windows (safe periods for travel)
    findSafeTravelWindows(daysNeeded, fromDate = new Date(), trips = null) {
        const tripsToUse = trips || window.trips || [];
        const windows = [];
        const checkDate = new Date(fromDate);
        const maxCheckDate = new Date(fromDate.getTime() + (365 * 2 * 24 * 60 * 60 * 1000)); // 2 years ahead

        while (checkDate <= maxCheckDate) {
            const maxStay = this.calculateMaxStayFromDate(checkDate, tripsToUse);
            
            if (maxStay >= daysNeeded) {
                const endDate = new Date(checkDate.getTime() + ((daysNeeded - 1) * 24 * 60 * 60 * 1000));
                windows.push({
                    startDate: new Date(checkDate),
                    endDate: endDate,
                    daysRequested: daysNeeded,
                    maxPossibleDays: maxStay,
                    daysUsedBefore: this.getDaysInPeriod(checkDate, tripsToUse)
                });
                
                // Skip ahead to avoid overlapping windows
                checkDate.setDate(checkDate.getDate() + Math.max(7, Math.floor(daysNeeded / 2)));
            } else {
                checkDate.setDate(checkDate.getDate() + 1);
            }
            
            // Limit number of windows to prevent performance issues
            if (windows.length >= 10) break;
        }

        return windows;
    }

    // Get detailed status for a specific date (for calendar display)
    getDateStatus(date, trips = null) {
        const tripsToUse = trips || window.trips || [];
        const daysInPeriod = this.getDaysInPeriod(date, tripsToUse);
        const isViolation = daysInPeriod > this.MAX_DAYS_IN_PERIOD;
        
        // Check if date is in a trip
        const dateStr = this.dateToString(date);
        const activeTrip = tripsToUse.find(trip => 
            dateStr >= trip.entryDate && dateStr <= trip.exitDate
        );

        // Check rollover dates
        const rollovers = this.calculateRolloverDates(tripsToUse);
        const isRolloverDate = rollovers.some(r => 
            this.dateToString(r.rolloverDate) === dateStr
        );

        return {
            date: new Date(date),
            daysInPeriod,
            isViolation,
            daysOver: Math.max(0, daysInPeriod - this.MAX_DAYS_IN_PERIOD),
            activeTrip,
            isRolloverDate,
            isEntryDate: activeTrip && dateStr === activeTrip.entryDate,
            isExitDate: activeTrip && dateStr === activeTrip.exitDate,
            maxStayFromDate: this.calculateMaxStayFromDate(date, tripsToUse)
        };
    }

    // Utility functions
    parseDate(dateStr) {
        if (dateStr instanceof Date) return dateStr;
        return parseISODateLocal(dateStr); // Use existing function
    }

    dateToString(date) {
        return dateToISOString(date); // Use existing function
    }

    daysBetween(startDate, endDate) {
        return daysBetweenDates(startDate, endDate); // Use existing function
    }

    clearCache() {
        this.cache.clear();
        this.historyArrays = null;
    }
}

// Global instance of the calculation engine
const schengenEngine = new SchengenCalculationEngine();

// Memoization cache for expensive calculations with improved efficiency
const calculationCache = new Map();
let tripsModificationCounter = 0;

// Performance optimization: Improved memoized getDaysInPeriod using new engine
const memoizedGetDaysInPeriod = (() => {
    return function(date) {
        return schengenEngine.getDaysInPeriod(date, trips);
    };
})();

// Calculate days spent in Schengen area in the 180-day period ending on checkDate
function getDaysInPeriod(checkDate) {
    return schengenEngine.getDaysInPeriod(checkDate, trips);
}

// Helper function to calculate days between dates
function daysBetweenDates(startDate, endDate) {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    const timeDifference = end.getTime() - start.getTime();
    return Math.floor(timeDifference / (1000 * 60 * 60 * 24)) + 1;
}

// Increment counter when trips change (more efficient than clearing entire cache)
function invalidateCalculationCache() {
    tripsModificationCounter++;
    schengenEngine.clearCache();
    // Optionally clear old cache entries to prevent memory bloat
    if (tripsModificationCounter % 100 === 0) {
        calculationCache.clear();
    }
}

// Legacy function name for compatibility
function clearCalculationCache() {
    invalidateCalculationCache();
}

// Safe localStorage operations with error handling
function safeLoadTrips() {
    try {
        const storedTrips = localStorage.getItem('schengen-trips');
        if (storedTrips) {
            trips = JSON.parse(storedTrips);
        } else {
            trips = [];
        }
    } catch (error) {
        console.warn('Error loading trips from localStorage:', error);
        trips = [];
        showError('Failed to load saved trips. Starting with empty trip list.');
    }
}

function safeSaveTrips() {
    try {
        localStorage.setItem('schengen-trips', JSON.stringify(trips));
        invalidateCalculationCache(); // Invalidate cache when data changes
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            showError('Storage quota exceeded. Please export your data and clear some trips.');
        } else {
            console.error('Error saving trips:', error);
            showError('Failed to save trips. Your changes may be lost.');
        }
        return false;
    }
}

// Error display function
function showError(message) {
    console.error('Schengen Calculator Error:', message);
    // Show error in browser console since status panel was removed
    alert(`Error: ${message}`);
}

// Comprehensive input sanitization function
function sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>\"'&]/g, function(match) {
        const entityMap = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '&': '&amp;'
        };
        return entityMap[match];
    });
}

// Sanitize and validate numeric input
function sanitizeNumericInput(input, min = 1, max = 90) {
    const num = parseInt(input, 10);
    if (isNaN(num) || num < min || num > max) {
        return null;
    }
    return num;
}

// Theme management
function initializeTheme() {
    // Load saved theme preference, default to dark
    const savedTheme = localStorage.getItem('schengen-theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeToggle(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('schengen-theme', newTheme);
    updateThemeToggle(newTheme);
}

function updateThemeToggle(theme) {
    const themeIcon = document.getElementById('theme-icon');
    const themeText = document.getElementById('theme-text');
    
    if (theme === 'dark') {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Light Mode';
    } else {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Dark Mode';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Check browser support first
    if (!checkBrowserSupport()) {
        return; // Don't continue if browser is unsupported
    }
    
    // Initialize theme first
    initializeTheme();
    
    // Load trips safely
    safeLoadTrips();
    
    // Load saved state or set defaults
    const stateLoaded = loadAppState();
    
    // Always set displayDate to current month, regardless of saved state
    // This ensures the first month shown is always the one containing today's date
    const today = new Date();
    displayDate = new Date(today.getFullYear(), today.getMonth(), 1);
    
    renderTrips();
    renderCalendar();
    updateStatus();
    
    // If we have selected dates, update the selection info
    if (selectedStartDate) {
        const startDate = parseISODateLocal(selectedStartDate);
        const endDate = selectedEndDate ? parseISODateLocal(selectedEndDate) : null;
        updateSelectionInfo(startDate, endDate);
    }
    
    // Set up form handler
    document.getElementById('trip-form').addEventListener('submit', handleAddTrip);
    
    // Set up button event listeners
    setupEventListeners();
    
    // Set up date input formatting
    setupDateInputs();
    
    // Set up keyboard navigation
    setupKeyboardNavigation();
});

// Browser support detection
function checkBrowserSupport() {
    const features = {
        localStorage: 'localStorage' in window && window.localStorage !== null,
        cssGrid: CSS && CSS.supports && CSS.supports('display', 'grid'),
        customProperties: CSS && CSS.supports && CSS.supports('--test', 'value'),
        es6Features: typeof Map !== 'undefined' && typeof Set !== 'undefined'
    };
    
    const unsupportedFeatures = Object.keys(features).filter(key => !features[key]);
    
    if (unsupportedFeatures.length > 0) {
        showUnsupportedBrowserMessage(unsupportedFeatures);
        return false;
    }
    
    return true;
}

function showUnsupportedBrowserMessage(unsupportedFeatures) {
    const message = `
        <div style="background: var(--color-danger-bg, #f8d7da); border: 1px solid var(--color-danger, #dc3545); color: var(--text-primary, #721c24); padding: 20px; margin: 20px; border-radius: 8px; text-align: center;">
            <h2>🚫 Unsupported Browser</h2>
            <p>Your browser doesn't support some features required by this application:</p>
            <ul style="text-align: left; display: inline-block;">
                ${unsupportedFeatures.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            <p><strong>Please update your browser or use a modern browser like Chrome, Firefox, Safari, or Edge.</strong></p>
        </div>
    `;
    document.body.innerHTML = message;
}

// Setup date input formatting and validation
function setupDateInputs() {
    const entryInput = document.getElementById('entry-date');
    const exitInput = document.getElementById('exit-date');
    const arrivalInput = document.getElementById('arrival-date');
    
    [entryInput, exitInput, arrivalInput].forEach(input => {
        input.addEventListener('input', formatDateInput);
        input.addEventListener('keydown', handleDateKeydown);
        input.addEventListener('blur', validateDateInput);
    });
}

// Handle keydown events for date inputs
function handleDateKeydown(e) {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const value = input.value;
    
    // Allow natural backspace behavior - no special handling
    // Let the formatDateInput function handle formatting after the character is removed
}

// Format date input as user types
function formatDateInput(e) {
    const input = e.target;
    const cursorPos = input.selectionStart;
    const oldValue = input.value;
    
    // Sanitize input first
    const sanitizedValue = sanitizeInput(input.value);
    
    // Allow digits and slashes only, remove other characters
    let value = sanitizedValue.replace(/[^\d\/]/g, '');
    
    // Smart formatting that preserves partial segments
    let formattedValue = '';
    let digitCount = 0;
    let slashCount = 0;
    
    for (let i = 0; i < value.length; i++) {
        const char = value[i];
        
        if (char === '/') {
            slashCount++;
            // Only add slash if:
            // 1. It's the first slash and we have exactly 2 digits before it
            // 2. It's the second slash and we have exactly 2 digits in the month position
            if ((slashCount === 1 && digitCount === 2 && formattedValue.length === 2) ||
                (slashCount === 2 && digitCount === 4 && formattedValue.length === 5)) {
                formattedValue += char;
            } else if (slashCount > 2) {
                // Skip extra slashes
                slashCount = 2;
            }
        } else if (/\d/.test(char)) {
            digitCount++;
            
            // Auto-insert first slash after day (when typing 3rd digit)
            if (digitCount === 3 && !formattedValue.includes('/')) {
                formattedValue += '/' + char;
            }
            // Auto-insert second slash after month (when typing 5th digit)
            else if (digitCount === 5 && formattedValue.split('/').length === 2) {
                formattedValue += '/' + char;
            }
            // Add digit normally
            else if (digitCount <= 6) {
                formattedValue += char;
            }
            
            // Stop at 6 digits total (dd/mm/yy)
            if (digitCount > 6) {
                break;
            }
        }
    }
    
    // Limit total length to 8 characters (dd/mm/yy)
    if (formattedValue.length > 8) {
        formattedValue = formattedValue.substring(0, 8);
    }
    
    // Only update if the value actually changed to avoid cursor jumping
    if (formattedValue !== oldValue) {
        input.value = formattedValue;
        
        // Intelligent cursor positioning
        let newCursorPos = cursorPos;
        
        // Handle different scenarios
        if (formattedValue.length > oldValue.length) {
            // Value got longer (auto-formatting happened)
            const addedChars = formattedValue.length - oldValue.length;
            
            if (cursorPos >= oldValue.length) {
                // Cursor was at end, move to new end
                newCursorPos = formattedValue.length;
            } else if (addedChars === 2 && (cursorPos === 2 || cursorPos === 5)) {
                // Auto-inserted slash + digit, move cursor past both
                newCursorPos = cursorPos + 2;
            } else {
                newCursorPos = cursorPos + addedChars;
            }
        } else if (formattedValue.length < oldValue.length) {
            // Value got shorter (backspace/delete happened)
            // Try to maintain cursor position relative to content
            newCursorPos = Math.min(cursorPos, formattedValue.length);
        }
        
        // Ensure cursor position is valid
        newCursorPos = Math.max(0, Math.min(newCursorPos, formattedValue.length));
        
        input.setSelectionRange(newCursorPos, newCursorPos);
    }
}

// Validate date input on blur
function validateDateInput(e) {
    const input = e.target;
    const value = input.value;
    
    if (value && !isValidDateFormat(value)) {
        input.setCustomValidity('Please enter a valid date in dd/mm/yy format');
    } else {
        input.setCustomValidity('');
    }
}

// Check if date format is valid with comprehensive validation
function isValidDateFormat(dateStr) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{2})$/;
    const match = dateStr.match(regex);
    
    if (!match) return false;
    
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    // Comprehensive validation
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    // Check days per month (including leap year February)
    const fullYear = convertTwoDigitYear(year);
    const daysInMonth = new Date(fullYear, month, 0).getDate();
    if (day > daysInMonth) return false;
    
    // Final validation by creating date and checking if it matches input
    const date = new Date(fullYear, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === fullYear;
}

// Convert 2-digit year to 4-digit year with dynamic cutoff
function convertTwoDigitYear(twoDigitYear) {
    const currentYear = new Date().getFullYear();
    const currentCentury = Math.floor(currentYear / 100) * 100;
    const cutoff = (currentYear + 10) % 100; // 10-year forward window
    
    if (twoDigitYear <= cutoff) {
        return currentCentury + twoDigitYear;
    } else {
        return currentCentury - 100 + twoDigitYear;
    }
}

// Parse ISO date string to local Date object (timezone-agnostic)
function parseISODateLocal(isoDateString) {
    const parts = isoDateString.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
}

// Convert Date object to ISO date string (timezone-agnostic)
function dateToISOString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Calculate duration between two dates (inclusive of both entry and exit dates)
function calculateStayDuration(startDate, endDate) {
    // If dates are strings (ISO format), parse them timezone-agnostically
    let start, end;
    if (typeof startDate === 'string') {
        start = parseISODateLocal(startDate);
    } else {
        start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    }
    
    if (typeof endDate === 'string') {
        end = parseISODateLocal(endDate);
    } else {
        end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    }
    
    const timeDifference = end.getTime() - start.getTime();
    return Math.floor(timeDifference / (1000 * 60 * 60 * 24)) + 1;
}

// Convert dd/mm/yy format to ISO date string (yyyy-mm-dd)
function convertToISODate(ddmmyy) {
    const regex = /^(\d{2})\/(\d{2})\/(\d{2})$/;
    const match = ddmmyy.match(regex);
    
    if (!match) return null;
    
    const day = match[1];
    const month = match[2];
    const year = convertTwoDigitYear(parseInt(match[3], 10));
    
    return `${year}-${month}-${day}`;
}

// Convert ISO date string to dd/mm/yy format
function convertFromISODate(isoDate) {
    const date = parseISODateLocal(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    
    return `${day}/${month}/${year}`;
}

function handleAddTrip(e) {
    e.preventDefault();
    
    const entryDateInput = document.getElementById('entry-date').value;
    const exitDateInput = document.getElementById('exit-date').value;
    
    if (!entryDateInput || !exitDateInput) {
        alert('Please fill in both entry and exit dates.');
        return;
    }
    
    // Validate date formats
    if (!isValidDateFormat(entryDateInput)) {
        alert('Please enter a valid entry date in dd/mm/yy format.');
        return;
    }
    
    if (!isValidDateFormat(exitDateInput)) {
        alert('Please enter a valid exit date in dd/mm/yy format.');
        return;
    }
    
    // Convert to ISO format for internal storage
    const date1 = convertToISODate(entryDateInput);
    const date2 = convertToISODate(exitDateInput);
    
    if (!date1 || !date2) {
        alert('Invalid date format. Please use dd/mm/yy format.');
        return;
    }
    
    // Automatically determine which date is start and which is end
    let entryDate, exitDate;
    if (date1 <= date2) {
        entryDate = date1;
        exitDate = date2;
    } else {
        entryDate = date2;
        exitDate = date1;
    }
    
    const trip = {
        id: Date.now(),
        entryDate: entryDate,
        exitDate: exitDate
    };
    
    trips.push(trip);
    if (saveAppState()) {
        renderTrips();
        updateStatus();
        
        // Auto-navigate calendar to show the new trip
        autoNavigateToTrip(trip.entryDate, trip.exitDate);
        
        // Clear form
        document.getElementById('trip-form').reset();
    }
}

function removeTrip(id) {
    trips = trips.filter(trip => trip.id !== id);
    if (saveAppState()) {
        renderTrips();
        renderCalendar();
        updateStatus();
    }
}

// Save all application state to localStorage (consolidated state saving)
function saveAppState() {
    try {
        const state = {
            trips: trips,
            displayDate: displayDate.toISOString(),
            selectedStartDate: selectedStartDate,
            selectedEndDate: selectedEndDate,
            selectionMode: selectionMode,
            lastUpdated: new Date().toISOString()
        };
        
        // Save both legacy trips format and full state for compatibility
        localStorage.setItem('schengen-trips', JSON.stringify(trips));
        localStorage.setItem('schengen-app-state', JSON.stringify(state));
        
        // Invalidate calculation cache when trips change
        invalidateCalculationCache();
        
        // Show brief save confirmation
        showSaveStatus();
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            showError('Storage quota exceeded. Please export your data and clear some trips.');
        } else {
            console.error('Error saving application state:', error);
            showError('Failed to save application state. Your changes may be lost.');
        }
        return false;
    }
}

// Show save status feedback
function showSaveStatus() {
    // Save status feedback removed since data panel was removed
    // Data is still saved automatically to localStorage
    console.log('Data saved automatically');
}

// Load application state from localStorage
function loadAppState() {
    try {
        const savedState = localStorage.getItem('schengen-app-state');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Load trips (keep existing functionality)
            if (state.trips && Array.isArray(state.trips)) {
                trips = state.trips;
            }
            
            // Skip loading display date - we always want to start with current month
            // if (state.displayDate) {
            //     displayDate = new Date(state.displayDate);
            // }
            
            // Load selected dates
            selectedStartDate = state.selectedStartDate || null;
            selectedEndDate = state.selectedEndDate || null;
            selectionMode = state.selectionMode || false;
            
            return true;
        }
    } catch (error) {
        console.warn('Error loading app state:', error);
        // Fall back to legacy trips storage
        const legacyTrips = localStorage.getItem('schengen-trips');
        if (legacyTrips) {
            try {
                trips = JSON.parse(legacyTrips);
            } catch (e) {
                console.warn('Error loading legacy trips:', e);
            }
        }
    }
    return false;
}

// Clear all saved state
function clearAppState() {
    localStorage.removeItem('schengen-app-state');
    localStorage.removeItem('schengen-trips'); // Legacy cleanup
}

function renderTrips() {
    const container = document.getElementById('trips-container');
    
    if (trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3em; margin-bottom: 10px;">✈️</div>
                <p>No trips added yet.<br>Add your first trip above!</p>
            </div>
        `;
        return;
    }
    
    const sortedTrips = [...trips].sort((a, b) => parseISODateLocal(a.entryDate) - parseISODateLocal(b.entryDate));
    
    container.innerHTML = sortedTrips.map(trip => {
        const entryDate = parseISODateLocal(trip.entryDate);
        const exitDate = parseISODateLocal(trip.exitDate);
        const duration = calculateStayDuration(trip.entryDate, trip.exitDate);
        
        return `
            <div class="trip-item">
                <div>
                    <div class="trip-dates">
                        ${formatDate(entryDate)} → ${formatDate(exitDate)}
                    </div>
                    <div class="trip-duration">${duration} days</div>
                </div>
                <button class="btn btn-danger" onclick="removeTrip(${trip.id})" style="padding: 6px 12px; font-size: 14px;">
                    🗑️ Remove
                </button>
            </div>
        `;
    }).join('');
}

function renderCalendar() {
    const container = document.getElementById('six-month-container');
    
    // Clear existing calendar
    container.innerHTML = '';
    
    // Create six consecutive months
    const startMonth = new Date(displayDate);
    const months = [];
    
    for (let i = 0; i < 6; i++) {
        const monthDate = new Date(startMonth);
        monthDate.setMonth(monthDate.getMonth() + i);
        months.push(monthDate);
    }
    
    // Generate each month
    months.forEach((monthDate, monthIndex) => {
        const monthContainer = document.createElement('div');
        monthContainer.className = 'month-calendar';
        
        // Month title
        const monthTitle = document.createElement('div');
        monthTitle.className = 'month-title';
        
        // Create month number element
        const monthNumber = monthDate.getMonth() + 1;
        const monthNumberEl = document.createElement('span');
        monthNumberEl.className = 'month-number';
        monthNumberEl.textContent = monthNumber;
        
        // Set month name without number
        monthTitle.textContent = monthDate.toLocaleDateString('en-US', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        // Add the number element to the title
        monthTitle.appendChild(monthNumberEl);
        monthContainer.appendChild(monthTitle);
        
        // Calendar grid for this month
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        
        // Add day headers (Monday first)
        const dayHeaders = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        dayHeaders.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-header';
            dayHeader.textContent = day;
            dayHeader.style.fontSize = '0.8em';
            dayHeader.style.padding = '8px 3px';
            grid.appendChild(dayHeader);
        });
        
        // Get month info
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        
        // Add empty slots for days before the first day of the month
        const startDayOfWeek = (firstDay.getDay() + 6) % 7;
        for (let i = 0; i < startDayOfWeek; i++) {
            const emptyElement = document.createElement('div');
            emptyElement.className = 'calendar-day empty-day';
            emptyElement.style.visibility = 'hidden';
            grid.appendChild(emptyElement);
        }
        
        // Generate calendar days (only for the current month)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;
            dayElement.style.fontSize = '0.8em';
            dayElement.style.cursor = 'pointer';
            
            // Add accessibility attributes
            dayElement.setAttribute('role', 'button');
            dayElement.setAttribute('tabindex', '0');
            dayElement.setAttribute('data-date', dateToISOString(date));
            
            // Add click handler
            dayElement.addEventListener('click', () => handleDateClick(date));
            
            // Add keyboard handler
            dayElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleDateClick(date);
                }
            });
            
            // Check if date is selected
            const dateStr = dateToISOString(date);
            if (selectedStartDate && selectedEndDate && dateStr > selectedStartDate && dateStr < selectedEndDate) {
                dayElement.classList.add('selected-range');
            }
            
            // Check if this is a selected anchor point
            const isSelectedAnchor = (selectedStartDate && !selectedEndDate && dateStr === selectedStartDate) ||
                                   (!selectedStartDate && selectedEndDate && dateStr === selectedEndDate);
            
            if (isSelectedAnchor) {
                dayElement.classList.add('entry-exit');
                
                const daysInPeriod = memoizedGetDaysInPeriod(date);
                const anchorType = selectedStartDate && !selectedEndDate ? 'Fixed Start Date' : 'Fixed End Date';
                const tooltip = document.createElement('div');
                tooltip.className = 'tooltip';
                const tooltipText = `${anchorType} (${daysInPeriod}/90 days in 180-day period)`;
                tooltip.textContent = tooltipText;
                dayElement.appendChild(tooltip);
                
                const ariaLabel = `${formatDate(date)}: ${tooltipText}`;
                dayElement.setAttribute('aria-label', ariaLabel);
            } else {
                // Check preview status first
                let previewStatus = null;
                if (selectedStartDate && !selectedEndDate) {
                    const selectedDate = parseISODateLocal(selectedStartDate);
                    previewStatus = getBidirectionalPreviewStatus(date, selectedDate);
                } else if (!selectedStartDate && selectedEndDate) {
                    const selectedDate = parseISODateLocal(selectedEndDate);
                    previewStatus = getBidirectionalPreviewStatus(date, selectedDate);
                }
                
                if (previewStatus && !dayElement.classList.contains('selected-range')) {
                    dayElement.classList.add(previewStatus.class);
                    
                    const daysInPeriod = memoizedGetDaysInPeriod(date);
                    const tooltip = document.createElement('div');
                    tooltip.className = 'tooltip';
                    const tooltipText = `${previewStatus.tooltip} (${daysInPeriod}/90 days in 180-day period)`;
                    tooltip.textContent = tooltipText;
                    dayElement.appendChild(tooltip);
                    
                    const ariaLabel = `${formatDate(date)}: ${tooltipText}`;
                    dayElement.setAttribute('aria-label', ariaLabel);
                } else {
                    // Check trip status for this date
                    const status = getDateStatus(date);
                    if (status.class && !dayElement.classList.contains('selected-range')) {
                        dayElement.classList.add(status.class);
                    }
                    
                    // Add tooltip with 180-day period information
                    const daysInPeriod = memoizedGetDaysInPeriod(date);
                    let tooltipText = status.tooltip || 'Outside Schengen Area';
                    
                    tooltipText += ` (${daysInPeriod}/90 days in 180-day period)`;
                    
                    if (tooltipText) {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'tooltip';
                        tooltip.textContent = tooltipText;
                        dayElement.appendChild(tooltip);
                        
                        const ariaLabel = `${formatDate(date)}: ${tooltipText}`;
                        dayElement.setAttribute('aria-label', ariaLabel);
                    }
                }
            }
            
            // Apply today class last to ensure it overrides other styling but works with them
            if (date.getTime() === today.getTime()) {
                dayElement.classList.add('today');
            }
            
            grid.appendChild(dayElement);
        }
        
        monthContainer.appendChild(grid);
        container.appendChild(monthContainer);
    });
    
    // Update navigation buttons (both top and bottom)
    const today = new Date();
    const eightMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 8, 1);
    const oneYearForward = new Date(today.getFullYear(), today.getMonth() + 12, 1);
    
    const isPrevDisabled = displayDate <= eightMonthsAgo;
    const isNextDisabled = displayDate >= oneYearForward;
    
    document.getElementById('prev-btn').disabled = isPrevDisabled;
    document.getElementById('next-btn').disabled = isNextDisabled;
}

function updateStatus() {
    const today = new Date();
    const daysUsed = memoizedGetDaysInPeriod(today);
    const daysRemaining = Math.max(0, 90 - daysUsed);
    
    document.getElementById('days-used').textContent = daysUsed;
    document.getElementById('days-remaining').textContent = daysRemaining;
    
    const daysUsedEl = document.getElementById('days-used');
    const daysRemainingEl = document.getElementById('days-remaining');
    
    if (daysUsed > 90) {
        daysUsedEl.className = 'status-value warning';
        daysRemainingEl.className = 'status-value warning';
        daysUsedEl.title = '⚠️ VIOLATION: Over 90-day limit! Risk of fines and entry bans.';
        daysRemainingEl.title = '⚠️ VIOLATION: Must leave Schengen immediately!';
    } else {
        daysUsedEl.className = 'status-value good';
        daysRemainingEl.className = 'status-value good';
        daysUsedEl.title = 'Days used in current 180-day period';
        daysRemainingEl.title = 'Days remaining in current 180-day period';
    }
    
    calculateNextSafeEntry();
    
    // Use new engine for comprehensive violation detection
    const violations = schengenEngine.findViolationPeriods(trips);
    const violationCount = violations.length;
    
    document.getElementById('violations').textContent = violationCount;
    const violationsEl = document.getElementById('violations');
    
    if (violationCount > 0) {
        violationsEl.className = 'status-value warning';
        const violationDetails = violations.map(v => 
            `${formatDate(v.startDate)} - ${formatDate(v.endDate)} (${v.daysOver} days over)`
        ).join('\n');
        violationsEl.title = `⚠️ Violation periods:\n${violationDetails}`;
    } else {
        violationsEl.className = 'status-value good';
        violationsEl.title = 'No violations detected';
    }
}

function calculateNextSafeEntry() {
    const today = new Date();
    const currentDaysUsed = memoizedGetDaysInPeriod(today);
    
    // If we can enter today (not exceeding 90 days), show "Now"
    if (currentDaysUsed < 90) {
        document.getElementById('next-safe-entry').textContent = 'Now';
        document.getElementById('next-safe-entry').className = 'status-value good';
        document.getElementById('next-safe-entry').title = `Currently using ${currentDaysUsed}/90 days in 180-day period`;
        return;
    }
    
    // Use new engine to find next safe entry
    const safeEntry = schengenEngine.findNextSafeEntry(today, trips);
    
    if (safeEntry) {
        document.getElementById('next-safe-entry').textContent = formatDate(safeEntry.date);
        document.getElementById('next-safe-entry').className = 'status-value';
        document.getElementById('next-safe-entry').title = `Can enter on this date - would use ${safeEntry.daysUsed}/90 days in 180-day period (${safeEntry.daysAvailable} days available)`;
    } else {
        document.getElementById('next-safe-entry').textContent = 'Unable to calculate';
        document.getElementById('next-safe-entry').className = 'status-value warning';
        document.getElementById('next-safe-entry').title = 'No safe entry date found within 2 years';
    }
}

// Helper function to calculate days for a potential entry date
function calculateDaysInPeriodForEntry(entryDate) {
    const periodStart = new Date(entryDate);
    periodStart.setDate(periodStart.getDate() - 179); // 180 days before entry date
    
    let daysCount = 0;
    
    trips.forEach(trip => {
        const tripStart = parseISODateLocal(trip.entryDate);
        const tripEnd = parseISODateLocal(trip.exitDate);
        
        // Find overlap between trip and the 180-day period ending on entry date
        const overlapStart = new Date(Math.max(tripStart.getTime(), periodStart.getTime()));
        const overlapEnd = new Date(Math.min(tripEnd.getTime(), entryDate.getTime()));
        
        if (overlapStart <= overlapEnd) {
            const overlapDays = daysBetweenDates(overlapStart, overlapEnd);
            daysCount += overlapDays;
        }
    });
    
    return daysCount;
}

function changeMonth(direction) {
    displayDate.setMonth(displayDate.getMonth() + direction);
    saveAppState();
    renderCalendar();
}

// New function to automatically adjust calendar to show the entire trip
function autoNavigateToTrip(entryDate, exitDate) {
    const entryDateObj = parseISODateLocal(entryDate);
    const exitDateObj = parseISODateLocal(exitDate);
    
    // Calculate the optimal start month to show the entire trip
    // We want to show at least the entry month and possibly more if the trip spans multiple months
    const tripStartMonth = new Date(entryDateObj.getFullYear(), entryDateObj.getMonth(), 1);
    const tripEndMonth = new Date(exitDateObj.getFullYear(), exitDateObj.getMonth(), 1);
    
    // Calculate months difference between trip start and end
    const monthsDiff = (tripEndMonth.getFullYear() - tripStartMonth.getFullYear()) * 12 + 
                      (tripEndMonth.getMonth() - tripStartMonth.getMonth());
    
    // If the trip spans more than 6 months, start from entry month
    // Otherwise, try to center the trip in the 6-month view
    let targetDisplayMonth;
    if (monthsDiff >= 5) {
        // Trip spans 6+ months, start from entry month
        targetDisplayMonth = new Date(tripStartMonth);
    } else {
        // Try to center the trip in the 6-month view
        const centerOffset = Math.floor((5 - monthsDiff) / 2);
        targetDisplayMonth = new Date(tripStartMonth);
        targetDisplayMonth.setMonth(targetDisplayMonth.getMonth() - centerOffset);
    }
    
    // Set the display date and re-render calendar
    displayDate = targetDisplayMonth;
    saveAppState();
    renderCalendar();
}

function getDateStatus(date) {
    const dateStr = dateToISOString(date);
    const result = { class: '', tooltip: '' };
    
    // Use new engine for comprehensive date status
    const engineStatus = schengenEngine.getDateStatus(date, trips);
    
    const tripForDate = trips.find(trip => 
        dateStr >= trip.entryDate && dateStr <= trip.exitDate
    );
    
    const inSelectedRange = selectedStartDate && selectedEndDate && 
        dateStr >= selectedStartDate && dateStr <= selectedEndDate;
    
    if (tripForDate || inSelectedRange) {
        let isEntryOrExit = false;
        let tooltipPrefix = '';
        
        if (tripForDate) {
            isEntryOrExit = dateStr === tripForDate.entryDate || dateStr === tripForDate.exitDate;
            tooltipPrefix = dateStr === tripForDate.entryDate ? 'Entry Day' : 
                           dateStr === tripForDate.exitDate ? 'Exit Day' : 'In Schengen Area';
        } else if (inSelectedRange) {
            isEntryOrExit = dateStr === selectedStartDate || dateStr === selectedEndDate;
            tooltipPrefix = dateStr === selectedStartDate ? 'Selected Entry' : 
                           dateStr === selectedEndDate ? 'Selected Exit' : 'Selected Range';
        }
        
        if (isEntryOrExit) {
            result.class = inSelectedRange ? (dateStr === selectedStartDate ? 'selected-start' : 'selected-end') : 'entry-exit';
            result.tooltip = tooltipPrefix;
        } else {
            result.class = inSelectedRange ? 'selected-range' : 'in-schengen';
            result.tooltip = tooltipPrefix;
        }
        
        // Enhanced violation detection with detailed info
        if (engineStatus.isViolation) {
            result.class = 'violation';
            result.tooltip = `⚠️ VIOLATION! ${engineStatus.daysInPeriod} days in 180-day period (${engineStatus.daysOver} over limit)`;
        } else {
            // Add days info to tooltip
            result.tooltip += ` • ${engineStatus.daysInPeriod}/90 days used`;
        }
    } else {
        // Check for rollover dates only if not in a trip or selected range
        if (engineStatus.isRolloverDate) {
            result.class = 'rollover-date';
            result.tooltip = `📅 Rollover Date - Old trips stop counting in 180-day window`;
        } else {
            result.class = 'outside';
            result.tooltip = 'Outside Schengen Area';
        }
    }
    
    return result;
}

function handleDateClick(date) {
    const dateStr = dateToISOString(date);
    
    // Check for existing trips
    const overlappingTrips = trips.filter(trip => 
        dateStr >= trip.entryDate && dateStr <= trip.exitDate
    );
    
    let existingTrip = null;
    if (overlappingTrips.length === 1) {
        existingTrip = overlappingTrips[0];
    } else if (overlappingTrips.length > 1) {
        const priorityTrip = overlappingTrips.find(trip => 
            dateStr === trip.entryDate || dateStr === trip.exitDate
        );
        existingTrip = priorityTrip || overlappingTrips[0];
    }
    
    if (existingTrip) {
        // Check if it's a 1-day trip (entry and exit are the same)
        if (existingTrip.entryDate === existingTrip.exitDate) {
            // Remove 1-day trip immediately
            trips = trips.filter(trip => trip.id !== existingTrip.id);
            if (saveAppState()) {
                renderTrips();
                renderCalendar();
                updateStatus();
            }
            return;
        }
        
        if (dateStr === existingTrip.entryDate) {
            trips = trips.filter(trip => trip.id !== existingTrip.id);
            selectedStartDate = null;
            selectedEndDate = existingTrip.exitDate;
            selectionMode = true;
            updateSelectionInfo(null, parseISODateLocal(existingTrip.exitDate));
            if (saveAppState()) {
                renderTrips();
                renderCalendar();
                updateStatus();
            }
            return;
        } else if (dateStr === existingTrip.exitDate) {
            trips = trips.filter(trip => trip.id !== existingTrip.id);
            selectedStartDate = existingTrip.entryDate;
            selectedEndDate = null;
            selectionMode = true;
            updateSelectionInfo(parseISODateLocal(existingTrip.entryDate), null);
            if (saveAppState()) {
                renderTrips();
                renderCalendar();
                updateStatus();
            }
            return;
        } else {
            trips = trips.filter(trip => trip.id !== existingTrip.id);
            if (saveAppState()) {
                renderTrips();
                renderCalendar();
                updateStatus();
            }
            return;
        }
    }
    
    if (selectedStartDate && selectedEndDate) {
        if (dateStr === selectedStartDate) {
            selectedStartDate = dateStr;
            selectedEndDate = null;
            selectionMode = true;
            updateSelectionInfo(date, null);
            saveAppState();
            renderCalendar();
            return;
        }
        
        if (dateStr === selectedEndDate) {
            selectedEndDate = null;
            updateSelectionInfo(parseISODateLocal(selectedStartDate), null);
            saveAppState();
            renderCalendar();
            return;
        }
        
        if (dateStr > selectedStartDate && dateStr < selectedEndDate) {
            clearSelection();
            return;
        }
        
        selectedStartDate = dateStr;
        selectedEndDate = null;
        updateSelectionInfo(date, null);
    } else if (selectedStartDate && !selectedEndDate) {
        if (selectedStartDate === dateStr) {
            // Show modal for same day clicked
            showOneDayModal(date);
            return;
        }
        
        let tripStartDate, tripEndDate;
        if (dateStr < selectedStartDate) {
            tripStartDate = dateStr;
            tripEndDate = selectedStartDate;
        } else {
            tripStartDate = selectedStartDate;
            tripEndDate = dateStr;
        }
        
        const trip = {
            id: Date.now(),
            entryDate: tripStartDate,
            exitDate: tripEndDate
        };
        
        trips.push(trip);
        if (saveAppState()) {
            clearSelection();
            renderTrips();
            renderCalendar();
            updateStatus();
        }
        return;
    } else if (!selectedStartDate && selectedEndDate) {
        if (selectedEndDate === dateStr) {
            // Show modal for same day clicked
            showOneDayModal(date);
            return;
        }
        
        let tripStartDate, tripEndDate;
        if (dateStr < selectedEndDate) {
            tripStartDate = dateStr;
            tripEndDate = selectedEndDate;
        } else {
            tripStartDate = selectedEndDate;
            tripEndDate = dateStr;
        }
        
        const trip = {
            id: Date.now(),
            entryDate: tripStartDate,
            exitDate: tripEndDate
        };
        
        trips.push(trip);
        if (saveAppState()) {
            clearSelection();
            renderTrips();
            updateStatus();
            
            // Auto-navigate calendar to show the new trip
            autoNavigateToTrip(trip.entryDate, trip.exitDate);
        }
        return;
    } else {
        selectedStartDate = dateStr;
        selectedEndDate = null;
        selectionMode = true;
        updateSelectionInfo(date, null);
    }
    
    saveAppState();
    renderCalendar();
}

function updateSelectionInfo(startDate, endDate) {
    const selectionInfo = document.getElementById('selection-info');
    const selectionDetails = document.getElementById('selection-details');
    
    if (!startDate && !endDate) {
        selectionInfo.style.display = 'none';
        return;
    }
    
    selectionInfo.style.display = 'block';
    const today = new Date();
    
    if (startDate && !endDate) {
        const isPastTrip = startDate < today;
        if (isPastTrip) {
            selectionDetails.innerHTML = `
                <strong>Entry:</strong> ${formatDate(startDate)}<br>
                <em>Click another date to complete trip</em><br>
                <small style="color: var(--text-secondary);">📝 Past trip</small>
            `;
        } else {
            const maxStayDays = calculateMaxStayFromDate(startDate);
            const suggestedEndDate = new Date(startDate);
            suggestedEndDate.setDate(suggestedEndDate.getDate() + Math.min(maxStayDays, 90) - 1);
            
            const actualStayDays = Math.ceil((suggestedEndDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const isConsistent = actualStayDays === maxStayDays;
            
            selectionDetails.innerHTML = `
                <strong>Entry:</strong> ${formatDate(startDate)}<br>
                <strong>Max Stay:</strong> ${maxStayDays} days<br>
                <strong>Suggested Exit:</strong> ${formatDate(suggestedEndDate)} <span style="color: ${isConsistent ? 'var(--color-success)' : 'var(--color-danger)'};">(${actualStayDays} days)</span><br>
                <em>Click another date to complete trip</em><br>
                <small style="color: var(--text-secondary);">🔮 Future trip</small>
            `;
        }
    } else if (!startDate && endDate) {
        const isPastTrip = endDate < today;
        if (isPastTrip) {
            selectionDetails.innerHTML = `
                <strong>Exit:</strong> ${formatDate(endDate)}<br>
                <em>Click earlier date to complete trip</em><br>
                <small style="color: var(--text-secondary);">📝 Past trip</small>
            `;
        } else {
            const maxDaysBack = calculateMaxDaysBackFromEnd(endDate);
            const suggestedStartDate = new Date(endDate);
            suggestedStartDate.setDate(suggestedStartDate.getDate() - Math.min(maxDaysBack, 90) + 1);
            
            const actualStayDays = Math.ceil((endDate - suggestedStartDate) / (1000 * 60 * 60 * 24)) + 1;
            const isConsistent = actualStayDays === maxDaysBack;
            
            selectionDetails.innerHTML = `
                <strong>Exit:</strong> ${formatDate(endDate)}<br>
                <strong>Max Days Back:</strong> ${maxDaysBack} days<br>
                <strong>Suggested Entry:</strong> ${formatDate(suggestedStartDate)} <span style="color: ${isConsistent ? 'var(--color-success)' : 'var(--color-danger)'};">(${actualStayDays} days)</span><br>
                <em>Click earlier date to complete trip</em><br>
                <small style="color: var(--text-secondary);">🔮 Future trip</small>
            `;
        }
    }
}

function calculateMaxStayFromDate(startDate) {
    return schengenEngine.calculateMaxStayFromDate(startDate, trips);
}

function calculateMaxDaysBackFromEnd(endDate) {
    let maxDays = 0;
    for (let testDays = 1; testDays <= 90; testDays++) {
        const testStartDate = new Date(endDate);
        testStartDate.setDate(testStartDate.getDate() - testDays + 1);
        
        const theoreticalTrip = {
            entryDate: dateToISOString(testStartDate),
            exitDate: dateToISOString(endDate)
        };
        
        const tempTrips = [...trips, theoreticalTrip];
        
        if (getDaysInPeriodWithTrips(endDate, tempTrips) > 90) {
            break;
        }
        maxDays = testDays;
    }
    
    return maxDays;
}

function getDaysInPeriodWithTrips(checkDate, tripsArray) {
    const periodStart = new Date(checkDate);
    periodStart.setDate(periodStart.getDate() - 179);
    
    let daysCount = 0;
    
    tripsArray.forEach(trip => {
        const tripStart = parseISODateLocal(trip.entryDate);
        const tripEnd = parseISODateLocal(trip.exitDate);
        
        const overlapStart = new Date(Math.max(tripStart.getTime(), periodStart.getTime()));
        const overlapEnd = new Date(Math.min(tripEnd.getTime(), checkDate.getTime()));
        
        if (overlapStart <= overlapEnd) {
            const overlapDays = daysBetweenDates(overlapStart, overlapEnd);
            daysCount += overlapDays;
        }
    });
    
    return daysCount;
}

function getBidirectionalPreviewStatus(date, anchorDate) {
    const dateStr = dateToISOString(date);
    const anchorDateStr = dateToISOString(anchorDate);
    
    if (dateStr === anchorDateStr) {
        return null;
    }
    
    let theoreticalTrip, checkDate, direction;
    
    if (dateStr > anchorDateStr) {
        theoreticalTrip = {
            entryDate: anchorDateStr,
            exitDate: dateStr
        };
        checkDate = date;
        direction = 'forward';
    } else {
        theoreticalTrip = {
            entryDate: dateStr,
            exitDate: anchorDateStr
        };
        checkDate = anchorDate;
        direction = 'backward';
    }
    
    const wouldOverlap = trips.some(existingTrip => {
        const existingStart = existingTrip.entryDate;
        const existingEnd = existingTrip.exitDate;
        const theoreticalStart = theoreticalTrip.entryDate;
        const theoreticalEnd = theoreticalTrip.exitDate;
        
        return (theoreticalStart <= existingEnd && theoreticalEnd >= existingStart);
    });
    
    if (wouldOverlap) {
        return null;
    }
    
    const tempTrips = [...trips, theoreticalTrip];
    const daysInPeriod = getDaysInPeriodWithTrips(checkDate, tempTrips);
    
    const tripDuration = Math.ceil((parseISODateLocal(theoreticalTrip.exitDate) - parseISODateLocal(theoreticalTrip.entryDate)) / (1000 * 60 * 60 * 24)) + 1;
    
    let tooltipText;
    if (direction === 'forward') {
        tooltipText = `Preview ${tripDuration}d trip ending here`;
    } else {
        tooltipText = `Preview ${tripDuration}d trip starting here`;
    }
    
    if (daysInPeriod > 90) {
        return { 
            class: 'preview-violation', 
            tooltip: `${tooltipText} - Violation (${daysInPeriod}/90 days)` 
        };
    }
    
    const previewClass = direction === 'backward' ? 'preview-available-past' : 'preview-available';
    return { 
        class: previewClass, 
        tooltip: `${tooltipText} - Available (${daysInPeriod}/90 days)` 
    };
}

function clearSelection() {
    selectedStartDate = null;
    selectedEndDate = null;
    selectionMode = false;
    document.getElementById('selection-info').style.display = 'none';
    saveAppState();
    renderCalendar();
}

function showOneDayModal(date) {
    const modal = document.getElementById('oneday-modal');
    const modalDate = document.getElementById('modal-date');
    
    modal.dataset.selectedDate = dateToISOString(date);
    modalDate.textContent = formatDate(date);
    modal.classList.add('active');
    
    setTimeout(() => {
        document.getElementById('confirm-btn').focus();
    }, 300);
    
    document.addEventListener('keydown', handleModalEscape);
}

function closeOneDayModal(createTrip) {
    const modal = document.getElementById('oneday-modal');
    const selectedDateStr = modal.dataset.selectedDate;
    
    modal.classList.remove('active');
    document.removeEventListener('keydown', handleModalEscape);
    
    if (createTrip && selectedDateStr) {
        const trip = {
            id: Date.now(),
            entryDate: selectedDateStr,
            exitDate: selectedDateStr
        };
        
        trips.push(trip);
        if (saveAppState()) {
            clearSelection();
            renderTrips();
            updateStatus();
            
            // Auto-navigate calendar to show the new trip
            autoNavigateToTrip(trip.entryDate, trip.exitDate);
        }
    } else {
        clearSelection();
    }
    
    delete modal.dataset.selectedDate;
}

function handleModalEscape(e) {
    if (e.key === 'Escape') {
        closeOneDayModal(false);
    }
}

function findNextAvailableStay() {
    const inputValue = document.getElementById('stay-duration').value;
    const desiredDays = sanitizeNumericInput(inputValue, 1, 90);
    const resultDiv = document.getElementById('planning-result');
    
    if (desiredDays === null) {
        resultDiv.innerHTML = '<div class="planning-error">Please enter a valid number of days (1-90).</div>';
        resultDiv.style.display = 'block';
        return;
    }
    
    // Use new engine's enhanced planning capability
    const today = new Date();
    const travelWindows = schengenEngine.findSafeTravelWindows(desiredDays, today, trips);
    
    if (travelWindows.length > 0) {
        const firstWindow = travelWindows[0];
        const suggestedEndDate = new Date(firstWindow.startDate);
        suggestedEndDate.setDate(suggestedEndDate.getDate() + desiredDays - 1);
        
        // Show additional windows if available
        let additionalInfo = '';
        if (travelWindows.length > 1) {
            const nextWindow = travelWindows[1];
            additionalInfo = `<br><small>💡 Next option: ${formatDate(nextWindow.startDate)} (${travelWindows.length} total options found)</small>`;
        }
        
        resultDiv.innerHTML = `<strong>✅ Available:</strong> ${formatDate(firstWindow.startDate)} to ${formatDate(suggestedEndDate)} (${desiredDays} days)<br><small>Days used before trip: ${firstWindow.daysUsedBefore}/90</small>${additionalInfo}<br><button class="btn planning-btn" data-start-date="${dateToISOString(firstWindow.startDate)}" data-end-date="${dateToISOString(suggestedEndDate)}">✅ Add Trip (${desiredDays} days)</button>`;
        
        // Add event listener to the newly created button
        const addTripBtn = resultDiv.querySelector('.btn');
        addTripBtn.addEventListener('click', function() {
            selectDatesFromPlanning(this.dataset.startDate, this.dataset.endDate);
        });
    } else {
        resultDiv.innerHTML = '<div class="planning-error"><strong>❌ Not Available</strong><br>No availability found for requested duration in next 2 years.</div>';
    }
    
    resultDiv.style.display = 'block';
}

function createTripFromPlanning(startDateStr, endDateStr, resultElementId, clearInputId = null) {
    const trip = {
        id: Date.now(),
        entryDate: startDateStr,
        exitDate: endDateStr
    };
    
    trips.push(trip);
    if (saveAppState()) {
        renderTrips();
        updateStatus();
        
        // Auto-navigate calendar to show the new trip
        autoNavigateToTrip(trip.entryDate, trip.exitDate);
        
        document.getElementById(resultElementId).style.display = 'none';
        
        if (clearInputId) {
            document.getElementById(clearInputId).value = '';
        }
    }
}

function selectDatesFromPlanning(startDateStr, endDateStr) {
    createTripFromPlanning(startDateStr, endDateStr, 'planning-result');
}

function calculateStayFromDate() {
    const arrivalDateInput = document.getElementById('arrival-date').value;
    const resultDiv = document.getElementById('arrival-planning-result');
    
    if (!arrivalDateInput) {
        resultDiv.innerHTML = '<div class="planning-error">Please enter an arrival date.</div>';
        resultDiv.style.display = 'block';
        return;
    }
    
    if (!isValidDateFormat(arrivalDateInput)) {
        resultDiv.innerHTML = '<div class="planning-error">Please enter a valid date in dd/mm/yy format.</div>';
        resultDiv.style.display = 'block';
        return;
    }
    
    const arrivalDateISO = convertToISODate(arrivalDateInput);
    if (!arrivalDateISO) {
        resultDiv.innerHTML = '<div class="planning-error">Invalid date format. Please use dd/mm/yy format.</div>';
        resultDiv.style.display = 'block';
        return;
    }
    
    const arrivalDate = new Date(arrivalDateISO);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const oneDayAgo = new Date(today);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    if (arrivalDate < oneDayAgo) {
        resultDiv.innerHTML = '<div class="planning-error">❌ Cannot calculate for dates more than 1 day in the past.</div>';
        resultDiv.style.display = 'block';
        return;
    }
    
    const maxStayDays = calculateMaxStayFromDate(arrivalDate);
    
    if (maxStayDays === 0) {
        resultDiv.innerHTML = `<div class="planning-error"><strong>❌ No availability</strong><br>${formatDate(arrivalDate)}: 0 days possible (90/180 rule violation)</div>`;
    } else {
        const suggestedExitDate = new Date(arrivalDate);
        suggestedExitDate.setDate(suggestedExitDate.getDate() + maxStayDays - 1);
        
        resultDiv.innerHTML = `<strong>Available:</strong> ${formatDate(arrivalDate)} to ${formatDate(suggestedExitDate)} (${maxStayDays} days)<br><button class="btn planning-btn" data-start-date="${dateToISOString(arrivalDate)}" data-end-date="${dateToISOString(suggestedExitDate)}">✅ Add Trip (${maxStayDays} days)</button>`;
        
        // Add event listener to the newly created button
        const addTripBtn = resultDiv.querySelector('.btn');
        addTripBtn.addEventListener('click', function() {
            selectDatesFromArrivalPlanning(this.dataset.startDate, this.dataset.endDate);
        });
    }
    
    resultDiv.style.display = 'block';
}

function selectDatesFromArrivalPlanning(startDateStr, endDateStr) {
    createTripFromPlanning(startDateStr, endDateStr, 'arrival-planning-result', 'arrival-date');
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Test function to show rolling 90/180 calculation from first trip to full reset
function showRollingCalculation() {
    const testOutput = document.getElementById('test-output');
    
    if (trips.length === 0) {
        testOutput.innerHTML = 'No trips to analyze. Add some trips first.';
        testOutput.style.display = 'block';
        return;
    }
    
    // Find the date range to analyze
    const tripDates = trips.flatMap(trip => [
        parseISODateLocal(trip.entryDate),
        parseISODateLocal(trip.exitDate)
    ]);
    
    const earliestDate = new Date(Math.min(...tripDates.map(d => d.getTime())));
    const latestDate = new Date(Math.max(...tripDates.map(d => d.getTime())));
    
    // Calculate from first trip start to 180 days after last trip end (full reset)
    const startDate = new Date(earliestDate);
    const endDate = new Date(latestDate.getTime() + (180 * 24 * 60 * 60 * 1000));
    
    let output = `Rolling 90/180 Day Calculation\n`;
    output += `From: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}\n`;
    output += `Trips: ${trips.length} | Total analysis days: ${Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000))}\n\n`;
    
    // Show compact format - only key dates and changes
    let previousDayCount = -1;
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const daysInPeriod = schengenEngine.getDaysInPeriod(currentDate, trips);
        
        // Only show when count changes or it's a significant date
        const dateStr = currentDate.toISOString().split('T')[0];
        const isInTrip = trips.some(trip => dateStr >= trip.entryDate && dateStr <= trip.exitDate);
        const isStartOfTrip = trips.some(trip => dateStr === trip.entryDate);
        const isEndOfTrip = trips.some(trip => dateStr === trip.exitDate);
        const isViolation = daysInPeriod > 90;
        
        // Show if count changed or it's a trip boundary
        if (daysInPeriod !== previousDayCount || isStartOfTrip || isEndOfTrip) {
            let status = '';
            if (isViolation) status = ' [VIOLATION]';
            else if (daysInPeriod >= 85) status = ' [WARNING]';
            
            let tripInfo = '';
            if (isStartOfTrip) tripInfo = ' (Entry)';
            else if (isEndOfTrip) tripInfo = ' (Exit)';
            else if (isInTrip) tripInfo = ' (In trip)';
            
            output += `${dateStr}: ${daysInPeriod.toString().padStart(2, ' ')}/90${status}${tripInfo}\n`;
            
            previousDayCount = daysInPeriod;
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
        
        // Safety limit - stop if too many days to prevent browser hang
        if ((currentDate - startDate) / (24 * 60 * 60 * 1000) > 1000) {
            output += '\n[Analysis truncated at 1000 days for performance]';
            break;
        }
    }
    
    output += `\nSummary:\n`;
    const violations = schengenEngine.findViolationPeriods(trips);
    if (violations.length > 0) {
        output += `Violations: ${violations.length}\n`;
        violations.forEach((v, i) => {
            output += `  ${i+1}: ${v.startDate.toISOString().split('T')[0]} to ${v.endDate.toISOString().split('T')[0]} (max ${v.maxDays} days)\n`;
        });
    } else {
        output += `Violations: None ✓\n`;
    }
    
    testOutput.innerHTML = output;
    testOutput.style.display = 'block';
}

// Set up all event listeners for buttons
function setupEventListeners() {
    // Theme toggle button
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    
    // Calendar navigation buttons (top)
    document.getElementById('prev-btn').addEventListener('click', function() {
        changeMonth(-1);
    });
    document.getElementById('next-btn').addEventListener('click', function() {
        changeMonth(1);
    });
    

    
    // Planning buttons
    document.getElementById('find-stay-btn').addEventListener('click', findNextAvailableStay);
    document.getElementById('calculate-stay-btn').addEventListener('click', calculateStayFromDate);
    
    // Test button
    document.getElementById('test-calculation-btn').addEventListener('click', showRollingCalculation);
    
    // Modal buttons
    document.getElementById('cancel-btn').addEventListener('click', function() {
        closeOneDayModal(false);
    });
    document.getElementById('confirm-btn').addEventListener('click', function() {
        closeOneDayModal(true);
    });
}

function setupKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        // Escape key closes modal
        if (e.key === 'Escape') {
            handleModalEscape(e);
        }
        
        // Arrow keys for calendar navigation
        if (e.key === 'ArrowLeft' && e.ctrlKey) {
            e.preventDefault();
            changeMonth(-1);
        }
        if (e.key === 'ArrowRight' && e.ctrlKey) {
            e.preventDefault();
            changeMonth(1);
        }
        
        // Calendar keyboard navigation
        const focusedElement = document.activeElement;
        if (focusedElement && focusedElement.classList.contains('calendar-day')) {
            const currentDate = focusedElement.getAttribute('data-date');
            if (!currentDate) return;
            
            let targetDate = new Date(currentDate);
            let handled = false;
            
            switch(e.key) {
                case 'ArrowLeft':
                    targetDate.setDate(targetDate.getDate() - 1);
                    handled = true;
                    break;
                case 'ArrowRight':
                    targetDate.setDate(targetDate.getDate() + 1);
                    handled = true;
                    break;
                case 'ArrowUp':
                    targetDate.setDate(targetDate.getDate() - 7);
                    handled = true;
                    break;
                case 'ArrowDown':
                    targetDate.setDate(targetDate.getDate() + 7);
                    handled = true;
                    break;
                case 'Home':
                    targetDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
                    handled = true;
                    break;
                case 'End':
                    targetDate = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
                    handled = true;
                    break;
            }
            
            if (handled) {
                e.preventDefault();
                const targetDateStr = dateToISOString(targetDate);
                const targetElement = document.querySelector(`[data-date="${targetDateStr}"]`);
                if (targetElement) {
                    targetElement.focus();
                }
            }
        }
    });
} 