(function () {
  "use strict";

  const config = window.DIRECTORY_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const els = {
    search: $("search"),
    category: $("category-filter"),
    town: $("town-filter"),
    chips: $("category-chips"),
    results: $("results"),
    count: $("result-count"),
    empty: $("empty"),
    error: $("error"),
    template: $("card-template"),
  };

  let businesses = [];

  // ---------- Setup from config ----------
  function applyConfig() {
    const name = config.siteName || "Local Business Directory";
    const title = config.areaName && !name.includes(config.areaName) ? `${name} · ${config.areaName}` : name;
    $("site-name").textContent = name;
    document.title = title;
    $("tagline").textContent = config.tagline || "";

    let addHref = "";
    if (config.submitFormUrl) {
      addHref = config.submitFormUrl;
    } else if (config.contactEmail) {
      addHref = `mailto:${config.contactEmail}?subject=${encodeURIComponent("Add my business to the directory")}` +
        `&body=${encodeURIComponent("Business name:\nWhat you do:\nTown:\nFacebook page link:\nPhone (optional):\nAddress (optional):\nHours (optional):\n")}`;
    }
    if (!addHref) {
      // No way to collect requests yet: hide the buttons instead of linking nowhere
      $("add-business").hidden = true;
      $("add-business-2").hidden = true;
      $("add-note").textContent = "Listing requests are opening soon.";
    }
    const external = /^https?:/.test(addHref);
    if (addHref) $("add-business-2").href = addHref;
    if (external) {
      $("add-business").href = addHref;
      for (const id of ["add-business", "add-business-2"]) {
        $(id).target = "_blank";
        $(id).rel = "noopener";
      }
    }
    if (config.contactEmail) {
      $("corrections-link").href = `mailto:${config.contactEmail}?subject=${encodeURIComponent("Directory correction")}`;
    }
  }

  // ---------- CSV parsing (handles quotes, commas and line breaks in fields) ----------
  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    text = text.replace(/^﻿/, ""); // strip BOM that Excel adds

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }

    const header = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    return rows
      .filter((r) => r.some((v) => v.trim()))
      .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])))
      .filter((b) => b.name);
  }

  // ---------- Helpers ----------
  const uniqueSorted = (key) =>
    [...new Set(businesses.map((b) => b[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function safeUrl(url) {
    if (!url) return "";
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
    } catch { return ""; }
  }

  // Image columns can hold a file name from the images/ folder or a full web address
  function imageUrl(value) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return safeUrl(value);
    return "images/" + value.replace(/^\/+|^images\//g, "").split("/").map(encodeURIComponent).join("/");
  }

  function initials(name) {
    const words = name.replace(/^the\s+/i, "").split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
    return words.slice(0, 2).map((w) => w.match(/[a-z0-9]/i)[0].toUpperCase()).join("");
  }

  // Stable color per business, so placeholder banners differ from card to card
  function hueFor(name) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  }

  function el(tag, props = {}, text) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    if (text != null) node.textContent = text;
    return node;
  }

  function linkButton(href, label, cls) {
    return el("a", { href, className: `btn ${cls}`, target: "_blank", rel: "noopener" }, label);
  }

  // ---------- Rendering ----------
  function populateFilters() {
    for (const c of uniqueSorted("category")) els.category.append(el("option", { value: c }, c));
    for (const t of uniqueSorted("town")) els.town.append(el("option", { value: t }, t));

    for (const c of uniqueSorted("category")) {
      const chip = el("button", { type: "button", className: "chip" }, c);
      chip.setAttribute("aria-pressed", "false");
      chip.addEventListener("click", () => {
        els.category.value = els.category.value === c ? "" : c;
        update();
      });
      els.chips.append(chip);
    }
  }

  function renderCard(b) {
    const card = els.template.content.firstElementChild.cloneNode(true);
    card.querySelector(".card-name").textContent = b.name;
    card.style.setProperty("--hue", hueFor(b.name));

    // Cover photo: falls back to a colored banner
    const cover = card.querySelector(".card-cover-img");
    const coverSrc = imageUrl(b.cover);
    if (coverSrc) {
      cover.src = coverSrc;
      cover.alt = `${b.name} cover photo`;
      cover.addEventListener("error", () => cover.remove());
    } else cover.remove();

    // Profile picture / logo: falls back to the business's initials
    const avatar = card.querySelector(".card-avatar-img");
    card.querySelector(".card-initials").textContent = initials(b.name);
    const logoSrc = imageUrl(b.logo);
    if (logoSrc) {
      avatar.src = logoSrc;
      avatar.alt = `${b.name} logo`;
      avatar.addEventListener("error", () => avatar.remove());
    } else avatar.remove();

    const badge = card.querySelector(".card-category");
    if (b.category) badge.textContent = b.category; else badge.remove();

    const town = card.querySelector(".card-town");
    if (b.town) town.textContent = b.town; else town.remove();

    const desc = card.querySelector(".card-desc");
    if (b.description) desc.textContent = b.description; else desc.remove();

    const details = card.querySelector(".card-details");
    if (b.phone) {
      const li = el("li", {}, "📞 ");
      li.append(el("a", { href: "tel:" + b.phone.replace(/[^\d+]/g, "") }, b.phone));
      details.append(li);
    }
    if (b.email) {
      const li = el("li", {}, "✉️ ");
      li.append(el("a", { href: "mailto:" + b.email }, b.email));
      details.append(li);
    }
    if (b.address) {
      const li = el("li", {}, "📍 ");
      const q = [b.address, b.town].filter(Boolean).join(", ");
      li.append(el("a", {
        href: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q),
        target: "_blank", rel: "noopener",
      }, b.address));
      details.append(li);
    }
    if (b.hours) details.append(el("li", {}, "🕒 " + b.hours));
    if (!details.children.length) details.remove();

    const links = card.querySelector(".card-links");
    const fb = safeUrl(b.facebook), ig = safeUrl(b.instagram), web = safeUrl(b.website);
    if (fb) links.append(linkButton(fb, "Facebook", "btn-fb"));
    if (ig) links.append(linkButton(ig, "Instagram", "btn-outline"));
    if (web) links.append(linkButton(web, "Website", "btn-outline"));
    if (!links.children.length) links.remove();

    return card;
  }

  function matches(b, words, category, town) {
    if (category && b.category !== category) return false;
    if (town && b.town !== town) return false;
    if (!words.length) return true;
    const hay = [b.name, b.category, b.description, b.town, b.address, b.tags].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  }

  function update() {
    const words = els.search.value.toLowerCase().split(/\s+/).filter(Boolean);
    const category = els.category.value;
    const town = els.town.value;

    const list = businesses.filter((b) => matches(b, words, category, town));
    els.results.replaceChildren(...list.map(renderCard));
    els.count.textContent = `Showing ${list.length} of ${businesses.length} ${businesses.length === 1 ? "business" : "businesses"}`;
    els.empty.hidden = list.length > 0;

    for (const chip of els.chips.children) {
      chip.setAttribute("aria-pressed", String(chip.textContent === category));
    }
    saveToUrl(els.search.value, category, town);
  }

  // Keep filters in the URL so a filtered view can be shared
  function saveToUrl(q, category, town) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (town) p.set("town", town);
    const qs = p.toString();
    history.replaceState(null, "", qs ? "?" + qs : location.pathname);
  }

  function loadFromUrl() {
    const p = new URLSearchParams(location.search);
    els.search.value = p.get("q") || "";
    els.category.value = p.get("category") || "";
    els.town.value = p.get("town") || "";
  }

  // ---------- Start ----------
  async function init() {
    applyConfig();
    try {
      const res = await fetch(config.dataFile || "data/businesses.csv", { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      businesses = parseCSV(await res.text())
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      els.error.hidden = false;
      els.error.textContent = location.protocol === "file:"
        ? "The business list can't load when the page is opened straight from your computer. See the README for how to preview it."
        : "Sorry, the business list couldn't be loaded right now.";
      console.error(err);
      return;
    }

    populateFilters();
    loadFromUrl();
    els.search.addEventListener("input", update);
    els.category.addEventListener("change", update);
    els.town.addEventListener("change", update);
    update();
  }

  init();
})();
