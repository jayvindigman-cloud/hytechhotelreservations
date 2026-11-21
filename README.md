# Hytech Hotel & Bistro

## Local development

Install dependencies with `npm ci`, then run `netlify dev --port 8889`. This starts the root Vite app and the Netlify server together. Use Vite's printed frontend URL for local frontend checks; its `/api` requests are forwarded to Netlify on port 8889. Node.js 24 is required. The old XAMPP backend is retained under `backend/` for reference and is not used by the deployed site.

## Netlify deployment

The root configuration publishes the Vite app and automatically detects `netlify/server/index.mjs` for `/api/*`. Reservations and the supporting catalog use Netlify Database with Drizzle. Database migrations in `netlify/database/migrations/` are applied automatically by Netlify during deployment; do not apply them manually. The API cannot save reservations until that first deployment has applied the schema.

The API seeds the existing public room descriptions and menu into the fresh database. Each room type starts with one unit, matching the site's previous default. Hotel staff can set the actual inventory, prices, extras, and discount codes in the admin dashboard. No legacy guest records are imported.

Existing Firebase customer and admin accounts continue to be used. The API verifies their sessions and admin roles on the server. Guests can submit a reservation request after signing in and can view saved bookings in Profile after verifying their email. Requests start as Pending; staff assign a room and confirm them in the dashboard. Pending and confirmed requests both count toward availability. Cash is payable at the hotel; GCash references require manual payment verification by staff.

Booking references and current status are available in the app. Automatic booking email and SMS notifications are not configured.

## Verification

Run `npm test` for booking validation, per-night availability, checkout boundaries, extras, and discount calculations. Run `npm run lint` for static checks. After deployment, verify a guest reservation, its saved receipt in Profile, and confirmation from an admin account. Database writes require the deployed schema.
