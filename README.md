# Hytech Hotel & Bistro

## Local development

Run the root React app and the Express backend. On Windows, the VS Code launch task runs `scripts/start-local.ps1`. It expects XAMPP MySQL on port 3307 and the backend on port 8080. The Vite server forwards `/api` to the backend. For a LAN layout check, run `npm run dev -- --host 0.0.0.0` and open the displayed network URL from the phone.

## Netlify deployment

1. Deploy the Express backend separately on a host that runs Node.js 24 and provides a public HTTPS URL. From the repository root the backend install command is `npm ci --prefix backend` and the start command is `npm start --prefix backend`. Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` there. Set `DB_SSL=true` if required by the database provider. Set `CORS_ORIGINS` to the Netlify site origin, with comma-separated origins if you also use a custom domain.
2. For an empty MySQL or MariaDB database, apply `backend/schema.sql` to the selected database before starting the backend. The backend creates the supporting tables and seeds the dining menu. Add room inventory in the admin dashboard or migrate the existing hotel database if you intend to carry its data forward.
3. In Netlify, use the repository root as the base directory. The checked-in configuration builds with `npm run build` and publishes `dist`. Set the Netlify build variable `VITE_API_BASE_URL` to the public HTTPS backend URL including `/api`, such as `https://api.example-hotel.com/api`. If uploading `dist` manually, set this variable in your local build environment before building.
4. Add the Netlify hostname and any custom domain to the Firebase Authentication **Authorized domains** list. Keep the existing Firebase project to retain guest accounts and Google sign-in. If you use a different project's backend configuration, align `FIREBASE_PROJECT_ID` and `FIREBASE_WEB_API_KEY` on the backend with the frontend Firebase configuration.
5. If the hotel sends email, set `GMAIL_USER` and `GMAIL_APP_PASSWORD` on the backend only. Revoke the old app password previously stored in source and use a replacement before sharing or publishing the repository.

After deploying, check the menu and room calendar, sign in as a guest and as an admin, and verify a test booking from the deployed URL.
