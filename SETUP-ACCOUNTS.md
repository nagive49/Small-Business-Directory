# Setting up business accounts

Business owners sign in at `account.html` with a code sent to their email (no passwords). They can update their photos, hours, prices and details at any time. New listings wait for your approval.

Everything is stored in **Supabase**, a free hosted database. It takes about 20–30 minutes to set up, and all of it can be done on a phone.

Until these steps are done, the website keeps using the backup list in `data/businesses.csv`.

---

## 1. Create the Supabase project

1. Go to **supabase.com** and tap **Start your project**. Sign up (signing in with GitHub is easiest).
2. Tap **New project**.
   - **Name:** `elkhart-directory`
   - **Database password:** tap **Generate a password**, then save it somewhere safe. You won't need it often.
   - **Region:** *East US* or *Central US*
   - Plan: **Free**
3. Tap **Create new project** and wait a minute or two while it sets up.

## 2. Create the database

1. Open the setup file and copy **all** of it:
   https://raw.githubusercontent.com/nagive49/Small-Business-Directory/claude/local-business-directory-wgzmuw/supabase/setup.sql
2. In Supabase, open **SQL Editor** in the left menu (on a phone, it's under the ☰ menu), then **New query**.
3. Paste and tap **Run**. You should see "Success. No rows returned."
4. Make yourself the admin: start another **New query**, paste this line with **your** email, and tap **Run**:

   ```sql
   insert into public.admins (email) values ('your-email@gmail.com');
   ```

## 3. Tell Supabase where your website is

**Authentication → URL Configuration**:

- **Site URL:** `https://nagive49.github.io/Small-Business-Directory/account.html`
- **Redirect URLs:** tap **Add URL** and add the same address.

## 4. Send sign-in emails from your Gmail

Supabase's built-in email only sends to members of your Supabase team, so business owners wouldn't get their codes. Sending through your Gmail fixes that (up to about 500 emails a day).

**a. Get a Gmail app password**

1. Go to **myaccount.google.com** → **Security**. Turn on **2-Step Verification** if it isn't on already.
2. Search the account page for **App passwords**. Create one named `Supabase`.
3. Copy the 16-letter password it shows.

**b. Enter it in Supabase:** **Authentication → Emails → SMTP Settings** → turn on **Enable custom SMTP**:

| Field | Value |
| --- | --- |
| Sender email | your Gmail address |
| Sender name | Elkhart County Small Business Directory |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | your Gmail address |
| Password | the 16-letter app password |

Save.

**c. Put the sign-in code in the email:** **Authentication → Emails → Templates → Magic Link**. Replace the message with:

```html
<h2>Sign in to the Elkhart County Small Business Directory</h2>
<p>Your sign-in code is: <strong>{{ .Token }}</strong></p>
<p>Or tap this link: <a href="{{ .ConfirmationURL }}">Sign in</a></p>
```

Save. The code is handy on phones, where tapping the link sometimes opens a different browser.

## 5. Connect the website

Open **Project Settings → API** (or **Data API**) and copy:

- **Project URL**, which looks like `https://abcdxyz.supabase.co`
- The **anon / public** key (a long string starting with `eyJ…`, or `sb_publishable_…`)

Both are meant to be public. **Never** share the `service_role` / secret key.

Paste them into `supabaseUrl` and `supabaseAnonKey` in `config.js`, or send them to Claude to do it.

---

## Day-to-day

- **New listing requests:** sign in at `account.html`. Your admin section shows **Waiting for review**. Tap **Approve** to publish a listing, or **Edit** to fix it first.
- **Adding a business yourself:** tap **+ Add a business**, fill it in, and put the owner's email in **Owner's login email**. When they sign in with that email, they can edit their own listing.
- **The Mad Batter** is already in the database. Edit it and add the owner's email so they can manage it.
- **Hiding a listing:** edit it and set **Status** to *Hidden*.

## Good to know

- Free Supabase projects pause after a week with no activity. Regular visitors keep it awake. If it ever pauses, open the Supabase dashboard and tap **Restore**.
- The free plan includes 500 MB of data and 1 GB of photos. That's thousands of listings, since photos are shrunk before upload.
