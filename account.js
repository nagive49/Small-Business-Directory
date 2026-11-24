(function () {
  "use strict";

  const config = window.DIRECTORY_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const BUCKET = "business-photos";
  const FIELDS = ["name", "category", "description", "town", "facebook", "hours", "prices",
    "phone", "address", "email", "instagram", "website"];
  const STATUS_LABEL = { pending: "Waiting for review", approved: "Live", hidden: "Hidden" };

  let db = null;
  let user = null;
  let isAdmin = false;
  let all = [];            // every listing this user can see
  let adminFilter = "pending";
  let editing = null;      // listing being edited (null = new)
  let photos = {};         // { logo: {file, url} | {url}, cover: ... }

  // ---------- Small helpers ----------
  function show(id, on = true) { $(id).hidden = !on; }

  function notify(msg, kind = "ok") {
    const s = $("status");
    s.textContent = msg;
    s.className = "notice notice-" + kind;
    s.hidden = !msg;
    if (msg) s.scrollIntoView({ block: "nearest" });
  }

  function el(tag, props = {}, text) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    if (text != null) n.textContent = text;
    return n;
  }

  function initials(name) {
    const words = (name || "").replace(/^the\s+/i, "").split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
    return words.slice(0, 2).map((w) => w.match(/[a-z0-9]/i)[0].toUpperCase()).join("") || "?";
  }

  function friendlyError(err) {
    const m = (err && (err.message || err.error_description)) || String(err);
    if (/rate limit|too many/i.test(m)) return "Too many tries. Please wait a few minutes and try again.";
    if (/expired|invalid.*(token|otp)/i.test(m)) return "That code didn't work or has expired. Request a new one.";
    if (/network|fetch/i.test(m)) return "Couldn't reach the server. Check your connection and try again.";
    return m;
  }

  function cleanUrl(v) {
    v = (v || "").trim();
    if (v && !/^https?:\/\//i.test(v)) v = "https://" + v;
    return v;
  }

  // ---------- Start ----------
  async function init() {
    if (config.siteName) document.title = "Business Account · " + config.siteName;

    try {
      db = await window.getSupabase();
    } catch (err) {
      notify("Couldn't load business accounts right now. Please try again later.", "error");
      return;
    }
    if (!db) {
      if (config.submitFormUrl) $("fallback-form").href = config.submitFormUrl;
      show("not-configured");
      return;
    }

    bindEvents();
    const { data } = await db.auth.getSession();
    user = data.session ? data.session.user : null;
    // Clean sign-in tokens out of the address bar
    if (location.hash.includes("access_token") || location.search.includes("code=")) {
      history.replaceState(null, "", location.pathname);
    }

    // Re-draw when someone signs in (e.g. by code) or out
    db.auth.onAuthStateChange((_event, session) => {
      const next = session ? session.user : null;
      if ((next && next.id) !== (user && user.id)) {
        user = next;
        // Supabase recommends not awaiting other calls inside this callback
        setTimeout(render, 0);
      }
    });
    render();
  }

  async function render() {
    show("signin", false); show("check-email", false); show("dashboard", false); show("editor", false);
    if (!user) {
      show("whoami", false);
      show("signin");
      return;
    }
    $("whoami-email").textContent = user.email;
    show("whoami");

    const { data: adminFlag } = await db.rpc("is_admin");
    isAdmin = adminFlag === true;
    await loadListings();

    const mine = myListings();
    if (!mine.length && !isAdmin) {
      openEditor(null);
    } else {
      showDashboard();
    }
  }

  // ---------- Sign in ----------
  async function sendLink(e) {
    e.preventDefault();
    const email = $("signin-email").value.trim().toLowerCase();
    if (!email) return;
    const btn = e.submitter || e.target.querySelector("button");
    btn.disabled = true;
    notify("");
    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    btn.disabled = false;
    if (error) return notify(friendlyError(error), "error");
    $("sent-to").textContent = email;
    show("signin", false);
    show("check-email");
  }

  async function verifyCode(e) {
    e.preventDefault();
    const token = $("code").value.trim();
    const email = $("sent-to").textContent;
    if (!token) return;
    const { error } = await db.auth.verifyOtp({ email, token, type: "email" });
    if (error) return notify(friendlyError(error), "error");
    notify("");
  }

  async function signOut() {
    await db.auth.signOut();
    user = null;
    isAdmin = false;
    notify("You're signed out.");
    render();
  }

  // ---------- Listings ----------
  async function loadListings() {
    const { data, error } = await db.from("businesses").select("*").order("name");
    if (error) {
      notify("Couldn't load your listings: " + friendlyError(error), "error");
      all = [];
      return;
    }
    all = data;
  }

  function myListings() {
    const me = (user.email || "").toLowerCase();
    return all.filter((b) => (b.owner_email || "").toLowerCase() === me);
  }

  function listingRow(b) {
    const row = el("div", { className: "biz-row" });
    const avatar = el("div", { className: "biz-avatar" });
    if (b.logo_url) avatar.append(el("img", { src: b.logo_url, alt: "" }));
    else avatar.textContent = initials(b.name);

    const text = el("div", { className: "biz-text" });
    text.append(el("strong", {}, b.name));
    const meta = el("span", { className: "muted" }, [b.category, b.town].filter(Boolean).join(" · "));
    text.append(meta);
    if (isAdmin && b.owner_email) text.append(el("span", { className: "muted small" }, "Owner: " + b.owner_email));

    const pill = el("span", { className: "pill pill-" + b.status }, STATUS_LABEL[b.status] || b.status);
    const edit = el("button", { type: "button", className: "btn btn-outline" }, "Edit");
    edit.addEventListener("click", () => openEditor(b));

    row.append(avatar, text, pill, edit);
    if (isAdmin && b.status === "pending") {
      const approve = el("button", { type: "button", className: "btn btn-primary" }, "Approve");
      approve.addEventListener("click", () => setStatus(b, "approved"));
      row.append(approve);
    }
    return row;
  }

  function showDashboard() {
    show("editor", false);
    show("dashboard");
    const mine = myListings();
    $("mine-list").replaceChildren(...mine.map(listingRow));
    show("mine-empty", !mine.length && !isAdmin);
    show("mine-section", mine.length > 0 || !isAdmin);
    $("new-business").textContent = mine.length ? "+ Add another business" : "+ Add a business";
    $("mine-section").querySelector("h2").textContent = mine.length > 1 ? "Your businesses" : "Your business";

    show("admin-section", isAdmin);
    if (isAdmin) {
      const pending = all.filter((b) => b.status === "pending").length;
      $("pending-count").textContent = pending ? `(${pending})` : "";
      for (const tab of document.querySelectorAll("[data-filter]")) {
        tab.setAttribute("aria-pressed", String(tab.dataset.filter === adminFilter));
      }
      const list = all.filter((b) => b.status === adminFilter);
      $("admin-list").replaceChildren(...list.map(listingRow));
      show("admin-empty", !list.length);
      // Admins add listings for businesses from here
      $("admin-section").append($("new-business"));
    }
  }

  async function setStatus(b, status) {
    const { error } = await db.from("businesses").update({ status }).eq("id", b.id);
    if (error) return notify("Couldn't update: " + friendlyError(error), "error");
    notify(status === "approved" ? `${b.name} is now live on the directory.` : `${b.name} updated.`);
    await loadListings();
    showDashboard();
  }

  // ---------- Editor ----------
  function fillCategories(current) {
    const sel = $("editor-form").elements.category;
    const cats = [...(config.categories || [])];
    if (current && !cats.includes(current)) cats.push(current);
    sel.replaceChildren(el("option", { value: "" }, "Choose one…"), ...cats.map((c) => el("option", { value: c }, c)));
  }

  function openEditor(b) {
    editing = b;
    photos = { logo: { url: b ? b.logo_url || "" : "" }, cover: { url: b ? b.cover_url || "" : "" } };
    const f = $("editor-form");
    f.reset();
    fillCategories(b && b.category);
    for (const k of FIELDS) f.elements[k].value = (b && b[k]) || "";
    f.elements.status.value = (b && b.status) || "approved";
    f.elements.owner_email.value = (b && b.owner_email) || "";

    const isNew = !b;
    $("editor-title").textContent = isNew ? "Add your business" : "Edit " + b.name;
    $("editor-intro").textContent = isNew
      ? (isAdmin
        ? "As an admin, you can publish this right away and set the owner's email so they can edit it later."
        : "Fill this in and we'll review it. Once it's approved it appears on the directory, and you can come back any time to update it.")
      : b.status === "pending"
        ? "This listing is waiting for review. You can still make changes."
        : "Changes show on the directory as soon as you save.";
    show("admin-fields", isAdmin);
    show("delete", isAdmin && !isNew);
    show("cancel", !isNew || myListings().length > 0 || isAdmin);
    show("editor-error", false);
    updatePreviews();

    show("dashboard", false);
    show("editor");
    $("editor").scrollIntoView({ block: "start" });
  }

  function updatePreviews() {
    const name = $("editor-form").elements.name.value;
    for (const kind of ["logo", "cover"]) {
      const img = $(kind + "-img");
      const url = photos[kind].url;
      img.hidden = !url;
      if (url) img.src = url; else img.removeAttribute("src");
      show("remove-" + kind, !!url);
    }
    $("logo-initials").textContent = photos.logo.url ? "" : initials(name);
  }

  function pickPhoto(kind, input) {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) {
      return notify("Please choose a photo (JPG or PNG).", "error");
    }
    if (photos[kind].file) URL.revokeObjectURL(photos[kind].url);
    photos[kind] = { file, url: URL.createObjectURL(file) };
    updatePreviews();
  }

  // Shrink photos before upload so the directory stays fast on phones
  async function resizeImage(file, maxW, maxH) {
    let source;
    try {
      source = await createImageBitmap(file);
    } catch {
      source = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("That photo couldn't be read. Try a JPG or PNG."));
        img.src = URL.createObjectURL(file);
      });
    }
    const w = source.width, h = source.height;
    const scale = Math.min(1, maxW / w, maxH / h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    const png = file.type === "image/png";
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const type = png ? "image/png" : "image/jpeg";
    const blob = await new Promise((r) => canvas.toBlob(r, type, 0.85));
    if (!blob) throw new Error("That photo couldn't be processed. Try a different one.");
    return { blob, ext: png ? "png" : "jpg", type };
  }

  async function uploadPhoto(kind) {
    const p = photos[kind];
    if (!p.file) return p.url || null;
    const { blob, ext, type } = kind === "logo"
      ? await resizeImage(p.file, 600, 600)
      : await resizeImage(p.file, 1600, 1000);
    const path = `${user.id}/${Date.now()}-${kind}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, blob, { contentType: type, upsert: false });
    if (error) throw new Error("Photo upload failed: " + friendlyError(error));
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function save(e) {
    e.preventDefault();
    const f = $("editor-form");
    const errBox = $("editor-error");
    show("editor-error", false);

    const row = {};
    for (const k of FIELDS) row[k] = f.elements[k].value.trim();
    for (const k of ["facebook", "instagram", "website"]) row[k] = cleanUrl(row[k]);

    const missing = [["name", "business name"], ["category", "category"], ["description", "description"], ["town", "town"]]
      .filter(([k]) => !row[k]).map(([, label]) => label);
    if (missing.length) {
      errBox.textContent = "Please fill in: " + missing.join(", ") + ".";
      return show("editor-error");
    }
    if (row.facebook && !/facebook\.com|fb\.(com|me)/i.test(row.facebook)) {
      errBox.textContent = "The Facebook link should be a facebook.com address.";
      return show("editor-error");
    }

    const btn = $("save");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      row.logo_url = await uploadPhoto("logo");
      row.cover_url = await uploadPhoto("cover");
      if (isAdmin) {
        row.status = f.elements.status.value;
        row.owner_email = f.elements.owner_email.value.trim().toLowerCase() || null;
      }

      const query = editing
        ? db.from("businesses").update(row).eq("id", editing.id).select()
        : db.from("businesses").insert(row).select();
      const { data, error } = await query;
      if (error) throw error;
      if (!data || !data.length) throw new Error("You don't have permission to edit this listing.");

      const saved = data[0];
      notify(!editing && saved.status === "pending"
        ? "Thanks! Your listing was submitted. We'll review it soon, and you can come back here any time to update it."
        : `Saved. ${saved.status === "approved" ? "Your changes are live on the directory." : ""}`);
      await loadListings();
      showDashboard();
    } catch (err) {
      errBox.textContent = friendlyError(err);
      show("editor-error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save";
    }
  }

  async function remove() {
    if (!editing || !confirm(`Delete "${editing.name}" permanently? This can't be undone.`)) return;
    const { error } = await db.from("businesses").delete().eq("id", editing.id);
    if (error) return notify("Couldn't delete: " + friendlyError(error), "error");
    notify(`${editing.name} was deleted.`);
    await loadListings();
    showDashboard();
  }

  // ---------- Events ----------
  function bindEvents() {
    $("signin-form").addEventListener("submit", sendLink);
    $("code-form").addEventListener("submit", verifyCode);
    $("use-different-email").addEventListener("click", () => { show("check-email", false); show("signin"); });
    $("sign-out").addEventListener("click", signOut);
    $("new-business").addEventListener("click", () => openEditor(null));
    $("cancel").addEventListener("click", () => { notify(""); showDashboard(); });
    $("delete").addEventListener("click", remove);
    $("editor-form").addEventListener("submit", save);
    $("editor-form").elements.name.addEventListener("input", updatePreviews);
    $("logo-file").addEventListener("change", (e) => pickPhoto("logo", e.target));
    $("cover-file").addEventListener("change", (e) => pickPhoto("cover", e.target));
    $("remove-logo").addEventListener("click", () => { photos.logo = { url: "" }; updatePreviews(); });
    $("remove-cover").addEventListener("click", () => { photos.cover = { url: "" }; updatePreviews(); });
    for (const tab of document.querySelectorAll("[data-filter]")) {
      tab.addEventListener("click", () => { adminFilter = tab.dataset.filter; showDashboard(); });
    }
  }

  init();
})();
