// Loads the Supabase library only when accounts are configured in config.js.
(function () {
  "use strict";
  const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js";
  let clientPromise = null;

  window.getSupabase = function () {
    const c = window.DIRECTORY_CONFIG || {};
    if (!c.supabaseUrl || !c.supabaseAnonKey) return Promise.resolve(null);
    if (!clientPromise) {
      clientPromise = new Promise((resolve, reject) => {
        if (window.supabase) return resolve();
        const s = document.createElement("script");
        s.src = LIB;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Couldn't load the accounts library"));
        document.head.append(s);
      }).then(() => window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey));
    }
    return clientPromise;
  };
})();
