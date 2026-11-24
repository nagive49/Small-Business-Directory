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
    const title = config.areaName ? `${name} · ${config.areaName}` : name;
    $("site-name").textContent = name;
    document.title = title;
    $("tagline").textContent = config.tagline || "";

    let addHref = "#add";
    if (config.submitFormUrl) {
      addHref = config.submitFormUrl;
    } else if (config.contactEmail) {
      addHref = `mailto:${config.contactEmail}?subject=${encodeURIComponent("Add my business to the directory")}` +
        `&body=${encodeURIComponent("Business name:\nWhat you do:\nTown:\nFacebook page link:\nPhone (optional):\nAddress (optional):\nHours (optional):\n")}`;
    }
    const external = /^https?:/.test(addHref);
    $("add-business-2").href = addHref;
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
    els.count.textContent = `Showing ${list.length} of ${businesses.length} businesses`;
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
