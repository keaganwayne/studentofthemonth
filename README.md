# SCLS Grade 6 Student of the Month Voting App

Small static frontend for Grade 6 Student of the Month nominations and voting.

## What Is Included

- `index.html` - the single-page app shell.
- `styles.css` - the existing dark SCLS Awards styling.
- `app.js` - voting logic, teacher selection, nomination cards, local fallback, and Pi API data calls.
- `config.js` - the public Pi API base URL.

## API Config

`config.js` should only contain the public API base:

```js
window.SCLS_API_CONFIG = {
  apiBase: "https://pi-cturethis.tail3dfdd6.ts.net:10000"
};
```

Do not put private credentials in the frontend.

## Fast Local Test

Open `index.html` in a browser, or serve the folder with any static web server.

If `window.SCLS_API_CONFIG.apiBase` is present, the app uses the Pi API. If the API config is removed, the app can still use any existing localStorage demo data in that browser.

## Browser Console API Test

```js
fetch("https://pi-cturethis.tail3dfdd6.ts.net:10000/api/student-vote/students")
  .then(r => r.json())
  .then(console.log)
```

## Pi API Routes Used

- `GET /api/student-vote/students`
- `GET /api/student-vote/teachers`
- `GET /api/student-vote/nominations`
- `GET /api/student-vote/results`
- `POST /api/student-vote/nominate`
- `POST /api/student-vote/react`
- `POST /api/student-vote/reason`

## Core Mechanics

- Teacher selects their name from a dropdown loaded from the Pi API.
- Students and current nominations load from the Pi API.
- If a teacher nominates a student already on the active list, the app adds a reason and records support once.
- Each teacher has one reaction per nominated student.
- Original nomination counts as one base upvote in the frontend display.
- Downvotes remain visible because the existing UI supports them.

## Current Live API Limits

The old admin screens are still visible to preserve the UI, but winner recording, alert notes, voting-window settings, and edit/delete admin actions need matching Pi API routes before they can save in live API mode.

## Security Note

This frontend uses a teacher-name dropdown, not real user authentication. Treat it as a trusted internal staff voting link unless the backend adds authentication.
