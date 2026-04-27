# SCLS Grade 6 Student of the Month Voting App

## What is included

- `index.html` — the full single-page app.
- `styles.css` — visual style based on the uploaded dark SCLS Awards skeletons.
- `app.js` — voting logic, nomination form, teacher selection, winner board, admin tools.
- `seed-data.js` — local demo data so the app works immediately without Supabase.
- `config.js` — where you paste your Supabase URL and anon key.
- `schema.sql` — creates the Supabase tables, view, constraints, and permissive prototype policies.
- `seed.sql` — inserts Grade 6 students, teachers, previous winners, existing nominations, and countdown setting.

## Fast local test

Open `index.html` in a browser.

While `config.js` is blank, the app runs in localStorage demo mode. This means:
- votes save only in your current browser;
- no Supabase project is needed;
- useful for checking the layout and mechanics.

## Supabase setup

1. Create a Supabase project.
2. Go to SQL Editor.
3. Run `schema.sql`.
4. Run `seed.sql`.
5. Open `config.js`.
6. Paste your project URL and anon key:

```js
window.SCLS_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_ANON_KEY"
};
```

7. Upload the folder to GitHub Pages, Netlify, or any static host.

## Core mechanics

- Teacher selects their name from a dropdown.
- Each student can have only one active nomination card.
- If a teacher nominates a student already on the active list, the reason is added to the existing card.
- If a teacher nominates a student who already won earlier in the year, the nomination still records but shows a warning.
- Each teacher has one reaction per nominated student.
- Changing from upvote to downvote updates the same reaction row. It does not stack duplicate votes.
- Original nomination counts as one base upvote.
- Keagan Wayne Appel has admin controls:
  - change the countdown deadline;
  - add warning/context notes to students;
  - record the four monthly winners.

## Important manual check

The `gender` field is needed because the system chooses two girls and two boys. I filled gender from names and previous winner patterns as a best-fit starting point. Before official use, scan the `students` table in Supabase and correct any gender mistakes.

## Security note

This version uses a teacher-name dropdown, not real user authentication. It is suitable for a trusted internal staff voting link. If you need tamper resistance later, use Supabase Auth with teacher email login and replace the permissive RLS policies.
