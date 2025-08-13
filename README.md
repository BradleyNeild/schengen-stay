# Schengen Stay Calculator

## Project Overview

This project is a comprehensive Schengen short-stay visa planner and calculator. It is a web-based tool designed to help travelers to the Schengen Area track their stays and ensure compliance with the 90/180-day rule. The application allows users to add past and planned trips, and it provides a clear overview of their stay history, remaining allowance, and potential violations.

## Key Features

*   **Trip Management:** Add, edit, and remove trips with specific entry and exit dates.
*   **Interactive Calendar:** A multi-month calendar that visually represents trips, highlighting days within the Schengen area, entry/exit days, and potential violations.
*   **Status Dashboard:** A real-time dashboard showing the total number of days used, days remaining, and the next safe entry date.
*   **Stay Planning Tools:**
    *   Find out the earliest date a user can start a trip of a certain duration.
    *   Calculate the maximum allowed stay from a planned arrival date.
*   **Violation Alerts:** The tool identifies and flags any periods that violate the 90/180-day rule.
*   **Data Persistence:** Trip data is saved in the browser's local storage, so users' data is preserved between sessions.
*   **Dark/Light Mode:** A theme toggle for user preference.
*   **Responsive Design:** The layout is optimized for both desktop and mobile devices.
*   **Accessibility:** The design is colorblind-accessible and provides high-contrast modes.

## Technical Overview

The application is built with vanilla HTML, CSS, and JavaScript, with no external frameworks or libraries.

*   **`index.html`**: Defines the structure of the application, including the calendar, control panels, and informational sections.
*   **`styles.css`**: Provides the styling for the application. It includes a modern design with a focus on user experience, accessibility (colorblind-friendly), and responsiveness. It features a light and dark theme.
*   **`script.js`**: Contains all the application logic.
    *   A powerful `SchengenCalculationEngine` class handles all date-related calculations, including the complex rolling 180-day window. It is designed to be timezone-safe.
    *   Functions for managing application state (saving/loading trips to local storage).
    *   UI rendering and event handling for all user interactions.

## SEO and Monetization

- Google Tag Manager is integrated and Google Consent Mode defaults to denied until the user accepts via the on-site banner. When accepted, consent is updated and AdSense auto ads are loaded dynamically.
- `ads.txt` is present with the correct publisher ID.
- `robots.txt` allows crawling and points to `https://schengen-stay.com/sitemap.xml`.
- Open Graph/Twitter meta tags and JSON-LD structured data are included. Social preview image and Organization schema added. Favicons and PWA icons provided as SVG placeholders in `/icons`.
- CSP allows the required Google/DoubleClick hosts for GTM and AdSense.

## Usage

To use the calculator, simply open the `index.html` file in a web browser.

1.  **Add Trips:** Use the "Add Trip" form or click on the calendar to add your travel dates.
2.  **View Status:** The dashboard on the right will automatically update with your stay details.
3.  **Plan Future Stays:** Use the planning tools to find the best dates for your upcoming trips.
4.  **Review Calendar:** The calendar will show your travel history and highlight important dates. 