# Affiliate Hunter AI

Mobile-first Shopee affiliate product research workspace.

## Files
- `index.html` — mobile dashboard prototype
- `worker.js` — Cloudflare Workers API starter
- `schema.sql` — Cloudflare D1 products table
- `wrangler.toml` — Wrangler configuration template

## Current status
- Mobile dashboard with demo product cards, search and category filters
- Copy Google Flow prompt based on a product card
- Open Shopee search by keyword
- D1 API starter: health check, list products, add product, delete product

## Important limitations
Product cards are illustrative demo data. The app is not yet connected to Shopee product feeds or a verified affiliate API. Prices, sales, ratings, commission and scores must not be treated as live data. The image cards currently use sample image URLs; automatic authorized image downloading is not implemented yet.

## Cloudflare setup
1. Create a D1 database named `affiliate-hunter-db`.
2. Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with the database ID.
3. Run `npx wrangler d1 execute affiliate-hunter-db --remote --file=schema.sql`.
4. Deploy the Worker with `npx wrangler deploy`.
5. Test `https://YOUR-WORKER-DOMAIN/api/health`.

Keep API credentials and private tokens in Cloudflare Worker secrets, never in `index.html` or GitHub.
