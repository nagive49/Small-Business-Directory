// ---------------------------------------------------------------
// Site settings — edit these to make the directory your own.
// ---------------------------------------------------------------
window.DIRECTORY_CONFIG = {
  // Shown in the header and browser tab
  siteName: "Elkhart County Small Business Directory",

  // Your area, e.g. "Greene County" or "the Tri-Town Area"
  areaName: "Elkhart County",

  // Short line under the title
  tagline: "Find the small businesses your neighbors already love — even the ones that aren't on Google.",

  // Where business owners go to ask to be listed.
  // Paste a Google Form (or similar) link here. If left blank, the
  // "Add your business" button uses the email address below instead.
  submitFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfCKcDG-KE5ebsmk4vQy31H0coYaQWHozvYn8VzgK0FCkK9tQ/viewform",

  // Contact email for listing requests and corrections (optional)
  contactEmail: "",

  // Backup business list, used only if the accounts database below isn't set up.
  dataFile: "data/businesses.csv",

  // ---- Business accounts (Supabase) ----
  // From Supabase: Project Settings → API. Both values are meant to be
  // public; your data is protected by the rules in supabase/setup.sql.
  // While these are blank, the site uses the backup list above.
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Categories owners can pick from
  categories: [
    "Food & Drink",
    "Beauty & Wellness",
    "Home & Garden",
    "Repair & Auto",
    "Farm & Produce",
    "Pets",
    "Events & Photography",
    "Crafts & Handmade",
    "Services",
    "Other",
  ],
};
