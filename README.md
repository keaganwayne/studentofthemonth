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
- `GET /api/student-vote/winners`
- `POST /api/student-vote/winners`
- `DELETE /api/student-vote/winners/{winner_id}`
- `GET /api/student-vote/settings`
- `POST /api/student-vote/settings`
- `GET /api/student-vote/alerts`
- `POST /api/student-vote/alerts`
- `PATCH /api/student-vote/alerts/{alert_id}`
- `PATCH /api/student-vote/nominations/{nomination_id}`
- `DELETE /api/student-vote/nominations/{nomination_id}`
- `GET /api/student-vote/admin-check`
- `POST /api/student-vote/nominate`
- `POST /api/student-vote/react`
- `POST /api/student-vote/reason`

## Core Mechanics

- Teacher selects their name from a dropdown loaded from the Pi API.
- Students, current nominations, previous winners, settings, and alert notes load from the Pi API.
- If a teacher nominates a student already on the active list, the app adds a reason and records support once.
- Each teacher has one reaction per nominated student.
- Original nomination counts as one base upvote in the frontend display.
- Downvotes remain visible because the existing UI supports them.
- Admin teachers can update voting-window settings, alert notes, winners, and nominations through protected Pi API routes.

## Admin Code

Admin teachers are identified by the `is_admin` value from `/api/student-vote/teachers`. When an admin teacher opens admin controls, the app asks for the school admin code at runtime. The entered code is stored only in `sessionStorage` for the current browser session and is sent only on protected admin write requests using the `X-School-Admin-Code` header.

The admin code is not stored in frontend files.

## Demo Fallback

Live API data is preferred whenever `window.SCLS_API_CONFIG.apiBase` exists. If the Pi API cannot load, the app shows a visible demo fallback warning and uses local browser data only for that session.

## Security Note

This frontend uses a teacher-name dropdown, not real user authentication. Treat it as a trusted internal staff voting link unless the backend adds authentication.
