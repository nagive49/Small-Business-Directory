# Small-Business-Directory

A directory for all types of small businesses that do not show up on Google — the bakeries, repair shops, groomers and farm stands you can only find on Facebook.

It's a simple website with no server, database, or monthly cost. The whole business list is one spreadsheet file.

## Business accounts

Owners can sign in, update their own listing (photos, hours, prices, details) and submit new businesses for your approval. To turn this on, follow **[SETUP-ACCOUNTS.md](SETUP-ACCOUNTS.md)**. Until then, the site uses the spreadsheet list described below.

## How it works

| File | What it's for |
| --- | --- |
| `data/businesses.csv` | **The business list.** One row per business. Open it in Excel or Google Sheets. |
| `config.js` | Site name, your area, tagline, and where "Add your business" goes. |
| `account.html`, `account.js` | Business owner sign-in and listing editor, plus your admin review area. |
| `supabase/setup.sql` | Database setup for business accounts. |
| `index.html`, `styles.css`, `app.js` | The website itself. You shouldn't need to touch these. |

Visitors can search by keyword, filter by category or town, and tap through to each business's Facebook page, call them, or get directions. Filtered views can be shared (the URL remembers the search).

## Adding businesses

Each row in `data/businesses.csv` has these columns. Only `name` is required, but `category`, `town` and `facebook` make the directory useful.

| Column | Example |
| --- | --- |
| `name` | Rosie's Home Bakery |
| `category` | Food & Drink |
| `description` | Custom cakes and weekend cinnamon rolls. |
| `town` | Maple Springs |
| `address` | 18 Main St (leave blank for home-based businesses) |
| `phone` | 555-0101 |
| `email` | (optional) shown on the listing |
| `facebook` | https://www.facebook.com/rosieshomebakery |
| `instagram` | (optional) |
| `website` | (optional) |
| `hours` | Fri–Sun 8am–2pm |
| `logo` | `mad-batter-logo.jpg` — round profile picture (optional) |
| `cover` | `mad-batter-cover.jpg` — wide banner photo (optional) |

Add one row per business; the site picks up new rows automatically.

Tips:
- Keep category names consistent (e.g. always "Food & Drink", not sometimes "Food"). The category buttons are built from whatever you type.
- If you edit in Google Sheets, use **File → Download → Comma-separated values (.csv)** and replace the file.
- Get the business owner's OK before listing them, especially for home-based businesses — don't list a home address unless they want it shown.

## Photos

Put image files in the `images/` folder and type just the file name in the `logo` or `cover` column. A full web address also works, but avoid links copied from Facebook images — they expire.

- **Logo:** square, at least 300×300 pixels. It's shown in a circle, so keep anything important away from the corners.
- **Cover:** wide, roughly 1200×525 pixels (16:7). The edges may be trimmed on some screens.

Businesses without photos get a colored banner and their initials automatically.

## Letting businesses sign up

Create a free Google Form asking for the same fields as the columns above, then paste its link into `submitFormUrl` in `config.js`. Or just set `contactEmail` and the button opens a pre-filled email.

## Preview it on your computer

Opening `index.html` by double-clicking won't load the list (browsers block that). Instead, from this folder run:

```
python3 -m http.server 8000
```

and visit http://localhost:8000.

## Put it online (free)

On GitHub: **Settings → Pages → Source: Deploy from a branch**, pick the branch and `/ (root)`, and save. Your site will be at `https://<your-username>.github.io/Small-Business-Directory/` within a minute or two. It also works on Netlify, Cloudflare Pages, or any plain web host.
