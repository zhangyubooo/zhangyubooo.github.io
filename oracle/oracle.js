/* ============================================================
   World Oracle — oracle.js

   The whole idea in one sentence:
   a hexagram is normally cast with coins or yarrow stalks, which are just
   physical processes nobody can predict. This replaces them with three live
   readings of the planet. Nothing here calls Math.random(). If the world
   cannot be reached, the page refuses to cast rather than faking it.

   Structure: ① Config ② Utilities ③ Entropy sources ④ Casting engine
              ⑤ Hexagram lookup ⑥ The ritual ⑦ Errors ⑧ Init

   AI disclosure: Claude wrote this file and then walked me through it section
   by section; the timings, the copy and the failure behaviour are decisions I
   made. See prompt_log.md
   ============================================================ */

(function () {
  "use strict";

  /* ① CONFIG -------------------------------------------------
     Everything tunable in one place, so adjusting the pace of the ritual
     never means hunting through the logic.
     ---------------------------------------------------------- */
  const CONFIG = {
    // Carnegie Mellon. The sun and the weather have to be somewhere, and a
    // fixed place means the page works for a visitor who declines location.
    lat: 40.4443,
    lng: -79.9436,
    placeName: "Pittsburgh, PA",

    netTimeout: 8000,      // ms before a source is called unreachable
    sourceStagger: 450,    // ms between one source appearing and the next
    lineDelay: 700,        // ms between one yao and the next — the heartbeat
    revealDelay: 900,      // ms after the sixth yao before the name appears

    maxQuestion: 140
  };


  /* ② UTILITIES ----------------------------------------------*/

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* FNV-1a, 32-bit. A hash, not a cipher: the job is only to fold an
     arbitrary string and a pile of floats down to one well-mixed integer so
     that a one-character change in the question moves every line. */
  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /* mulberry32 — a small seeded PRNG.
     Worth being precise about what this is doing, because it is the one place
     someone could accuse the piece of cheating: the RANDOMNESS comes from the
     world, in the seed. This function only *expands* that seed deterministically
     into the eighteen coin throws a cast needs. Same seed, same hexagram,
     forever. That reproducibility is the point. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* fetch with a real timeout. Without AbortController a dropped connection
     can leave a request hanging for a minute and the page just sits there —
     this is what makes "turn the wifi off" fail fast and legibly. */
  async function fetchJSON(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CONFIG.netTimeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /* "6:58:12 AM" or "12:23:45" -> seconds. Returns null on anything else,
     rather than NaN, so a format change upstream is caught instead of
     silently poisoning the seed. */
  function clockToSeconds(value) {
    if (typeof value !== "string") return null;
    const m = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseInt(m[3], 10);
    const ampm = m[4] ? m[4].toUpperCase() : null;
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return h * 3600 + min * 60 + sec;
  }

  const isNum = (v) => typeof v === "number" && isFinite(v);


  /* ③ ENTROPY SOURCES ----------------------------------------
     Each source returns the same shape so the rest of the code never has to
     know which API it came from:

       { ok: true,  name, values: [Number], display: [{ label, value }] }
       { ok: false, name, error: "..." }

     `values` feeds the seed. `display` is what the visitor reads.
     All three are keyless — no API key exists in this repo, because none is
     needed. That was a selection criterion, not a coincidence: a key in
     front-end JavaScript is visible to every visitor who opens DevTools.
     ---------------------------------------------------------- */

  /* Seismic. USGS publishes every earthquake of the last hour as GeoJSON,
     refreshed continuously. The most recent event is the reading. */
  async function readSeismic() {
    const name = "Seismic";
    try {
      const data = await fetchJSON(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
      );
      const features = (data && data.features) || [];
      if (!features.length) {
        // A genuinely quiet hour is possible and is not an error — the count
        // itself is still a reading of the world.
        return {
          ok: true, name,
          values: [0, data.metadata ? data.metadata.count : 0],
          display: [{ label: "No recorded quake in the past hour", value: "" }]
        };
      }
      const f = features[0];
      const p = f.properties || {};
      // GeoJSON coordinate order is [longitude, latitude, depth] — not lat/lng.
      const c = (f.geometry && f.geometry.coordinates) || [0, 0, 0];
      const mag = isNum(p.mag) ? p.mag : 0;
      const depth = isNum(c[2]) ? c[2] : 0;

      return {
        ok: true, name,
        values: [mag, depth, c[0], c[1], p.time || 0, features.length],
        display: [
          { label: "M" + mag.toFixed(1) + " · " + (p.place || "unknown location"), value: "" },
          { label: "depth", value: depth.toFixed(1) + " km" },
          { label: "in the past hour", value: features.length + " events" }
        ]
      };
    } catch (err) {
      return { ok: false, name, error: describe(err) };
    }
  }

  /* Solar and lunar. sunrisesunset.io returns the sun's and moon's day for a
     given point — day length, solar noon, moon illumination. Slower-moving
     than the seismic feed, and that is the intent: a cast should be made of
     both the fast world and the slow one. */
  async function readSolar() {
    const name = "Solar & lunar";
    try {
      const data = await fetchJSON(
        "https://api.sunrisesunset.io/json?lat=" + CONFIG.lat + "&lng=" + CONFIG.lng
      );
      const r = (data && data.results) || {};

      const dayLen = clockToSeconds(r.day_length);
      const noon = clockToSeconds(r.solar_noon);
      const moonIllum = parseFloat(r.moon_illumination);

      const values = [];
      const display = [];

      if (dayLen !== null) {
        values.push(dayLen);
        display.push({ label: "day length", value: r.day_length });
      }
      if (noon !== null) {
        values.push(noon);
        display.push({ label: "solar noon", value: r.solar_noon });
      }
      if (isFinite(moonIllum)) {
        values.push(moonIllum);
        display.push({ label: "moon illumination", value: moonIllum + "%" });
      }
      if (r.moon_phase) {
        display.push({ label: "moon phase", value: String(r.moon_phase) });
      }

      // If the response arrived but contained nothing usable, that is a
      // failure — better to say so than to seed the cast with an empty array.
      if (!values.length) throw new Error("no usable fields in response");

      return { ok: true, name, values, display };
    } catch (err) {
      return { ok: false, name, error: describe(err) };
    }
  }

  /* Atmospheric. Open-Meteo, current conditions over the same point.
     Pressure is the interesting one — it is the number a barometer has been
     used to read the near future with for three hundred years. */
  async function readAtmospheric() {
    const name = "Atmospheric";
    try {
      const url =
        "https://api.open-meteo.com/v1/forecast" +
        "?latitude=" + CONFIG.lat +
        "&longitude=" + CONFIG.lng +
        "&current=temperature_2m,pressure_msl,cloud_cover,wind_direction_10m,wind_speed_10m";
      const data = await fetchJSON(url);
      const c = (data && data.current) || {};

      const fields = [
        ["pressure_msl", "pressure", " hPa"],
        ["cloud_cover", "cloud cover", "%"],
        ["wind_direction_10m", "wind from", "°"],
        ["wind_speed_10m", "wind speed", " km/h"],
        ["temperature_2m", "temperature", " °C"]
      ];

      const values = [];
      const display = [];
      fields.forEach(function (f) {
        const v = c[f[0]];
        if (isNum(v)) {
          values.push(v);
          display.push({ label: f[1], value: v + f[2] });
        }
      });

      if (!values.length) throw new Error("no usable fields in response");
      return { ok: true, name, values, display };
    } catch (err) {
      return { ok: false, name, error: describe(err) };
    }
  }

  /* Turn an exception into something a visitor can read. Three distinct
     causes matter here and they need different words: we gave up waiting,
     the browser could not connect at all, or the server answered badly. */
  function describe(err) {
    if (err && err.name === "AbortError") return "no reply in time";
    if (err instanceof TypeError) return "could not be reached";
    return (err && err.message) || "unknown error";
  }

  const SOURCES = [readSeismic, readSolar, readAtmospheric];


  /* ④ CASTING ENGINE -----------------------------------------*/

  /* Fold question + world into one 32-bit seed.
     The question is normalised first — trimmed, lower-cased, inner runs of
     whitespace collapsed — so "Should I go?" and "  should i go? " are the
     same question. Numbers are fixed to 4 decimals so a floating-point tail
     that differs between browsers cannot change the hexagram. */
  function makeSeed(question, worldValues) {
    const q = question.trim().toLowerCase().replace(/\s+/g, " ");
    const w = worldValues.map((v) => Number(v).toFixed(4)).join("|");
    return hash32(q + "::" + w);
  }

  /* Six lines, bottom to top, by the three-coin method.
     Each coin is 2 (tails) or 3 (heads); three coins sum to 6, 7, 8 or 9:

        6  old yin    ▬ ▬  changing, becomes yang   p = 1/8
        7  young yang ▬▬▬  stable                   p = 3/8
        8  young yin  ▬ ▬  stable                   p = 3/8
        9  old yang   ▬▬▬  changing, becomes yin    p = 1/8

     Summing three fair coins reproduces that 1:3:3:1 distribution for free —
     which is why the traditional method is modelled directly instead of
     picking 6..9 with weights. */
  function castLines(seed) {
    const rand = mulberry32(seed);
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const coins = [0, 0, 0].map(() => (rand() < 0.5 ? 2 : 3));
      const value = coins[0] + coins[1] + coins[2];
      lines.push({
        value: value,
        coins: coins,
        yang: value === 7 || value === 9,
        changing: value === 6 || value === 9
      });
    }
    return lines;
  }

  const primaryBits = (lines) => lines.map((l) => (l.yang ? 1 : 0));

  /* The relating hexagram: every changing line becomes its opposite. This is
     the part people forget the I Ching is actually about — it does not
     describe a state, it describes a state turning into another one. */
  const relatingBits = (lines) =>
    lines.map((l) => (l.changing ? (l.yang ? 0 : 1) : l.yang ? 1 : 0));


  /* ⑤ HEXAGRAM LOOKUP ----------------------------------------*/

  let BY_BITS = null;

  async function loadHexagrams() {
    const list = await fetchJSON("hexagrams.json");
    BY_BITS = {};
    list.forEach((h) => { BY_BITS[h.lines.join("")] = h; });
    if (Object.keys(BY_BITS).length !== 64) {
      throw new Error("expected 64 hexagrams, got " + Object.keys(BY_BITS).length);
    }
  }

  const lookup = (bits) => BY_BITS[bits.join("")];


  /* ⑥ THE RITUAL ---------------------------------------------
     The pacing below is the actual design work in this project. An oracle
     that returns its answer in 200ms is a lookup table; the pauses are what
     make it something you wait for.
     ---------------------------------------------------------- */

  const els = {};
  let busy = false;

  async function run(question) {
    busy = true;
    els.submit.disabled = true;
    hideError();
    resetStages();

    // --- Stage 1: read the world ---
    els.world.hidden = false;

    // All three go out at once — no reason to make the visitor wait for them
    // in series — but they are REVEALED one at a time, in a fixed order, so
    // the sequence reads the same every time regardless of which is fastest.
    const results = await Promise.all(SOURCES.map((fn) => fn()));

    for (const r of results) {
      renderSource(r);
      await sleep(CONFIG.sourceStagger);
    }

    const live = results.filter((r) => r.ok);

    // The one refusal in the piece. With nothing live, a cast would be a
    // random number wearing a costume — so there is no cast.
    if (!live.length) {
      showError(
        "The world is unreachable right now, so there is nothing to cast from. " +
        "No hexagram has been drawn — this page will not substitute a random " +
        "number for a reading. Check your connection and ask again."
      );
      finish();
      return;
    }

    // --- Stage 2: cast ---
    const worldValues = live.reduce((acc, r) => acc.concat(r.values), []);
    const seed = makeSeed(question, worldValues);
    const lines = castLines(seed);

    els.cast.hidden = false;
    for (let i = 0; i < 6; i++) {
      els.hexagram.appendChild(renderYao(lines[i]));
      await sleep(CONFIG.lineDelay);
    }

    // --- Stage 3: reveal ---
    await sleep(CONFIG.revealDelay);

    const primary = lookup(primaryBits(lines));
    if (!primary) {                       // cannot happen with valid data; says so if it does
      showError("The cast produced a figure that is not in the data file.");
      finish();
      return;
    }
    renderPrimary(primary);

    const changing = lines.filter((l) => l.changing);
    if (changing.length) {
      const relating = lookup(relatingBits(lines));
      if (relating) renderRelating(relating);
    }

    els.result.hidden = false;
    renderTrace(results, lines, seed);
    els.trace.hidden = false;

    finish();
  }

  function finish() {
    busy = false;
    els.submit.disabled = false;
  }

  function resetStages() {
    els.worldList.innerHTML = "";
    els.hexagram.innerHTML = "";
    els.traceList.innerHTML = "";
    els.world.hidden = true;
    els.cast.hidden = true;
    els.result.hidden = true;
    els.relating.hidden = true;
    els.trace.hidden = true;
    els.trace.open = false;
  }

  /* ---- rendering ---- */

  function renderSource(r) {
    const li = document.createElement("li");
    li.className = "world__item" + (r.ok ? "" : " world__item--failed");

    const name = document.createElement("span");
    name.className = "world__name";
    name.textContent = r.name;

    const vals = document.createElement("span");
    vals.className = "world__values";

    if (r.ok) {
      r.display.forEach(function (d) {
        const line = document.createElement("span");
        line.className = "world__value";
        if (d.value) {
          line.innerHTML = "";
          line.appendChild(document.createTextNode(d.label + " "));
          const b = document.createElement("b");
          b.textContent = d.value;
          line.appendChild(b);
        } else {
          line.textContent = d.label;
        }
        vals.appendChild(line);
      });
    } else {
      const line = document.createElement("span");
      line.className = "world__value";
      line.textContent = r.error + " — this source is not part of the cast";
      vals.appendChild(line);
    }

    li.appendChild(name);
    li.appendChild(vals);
    els.worldList.appendChild(li);
  }

  function renderYao(line) {
    const div = document.createElement("div");
    div.className =
      "yao " + (line.yang ? "yao--yang" : "yao--yin") +
      (line.changing ? " yao--changing" : "");
    // Stated for screen readers, which otherwise get six empty boxes.
    div.setAttribute("role", "presentation");
    div.title =
      (line.yang ? "yang" : "yin") + " " + line.value +
      (line.changing ? " (changing)" : "");
    return div;
  }

  function renderPrimary(h) {
    els.pNum.textContent = "Hexagram " + h.n + "  " + h.glyph;
    els.pCn.textContent = h.cn;
    els.pEn.textContent = h.pinyin + " · " + h.en;
    els.pTrigrams.textContent =
      h.lower.en + " below, " + h.upper.en + " above  ·  " +
      h.lower.cn + "下 " + h.upper.cn + "上";
    els.pJudgment.textContent = h.judgment;
    els.pReading.textContent = h.reading;
    els.hexagram.setAttribute(
      "aria-label",
      "Hexagram " + h.n + ", " + h.cn + ", " + h.en
    );
  }

  function renderRelating(h) {
    els.rNum.textContent = "Hexagram " + h.n + "  " + h.glyph;
    els.rCn.textContent = h.cn;
    els.rEn.textContent = h.pinyin + " · " + h.en;
    els.rReading.textContent = h.reading;
    els.relating.hidden = false;
  }

  function renderTrace(results, lines, seed) {
    results.forEach(function (r) {
      const dt = document.createElement("dt");
      dt.textContent = r.name;
      const dd = document.createElement("dd");
      dd.textContent = r.ok
        ? r.values.map((v) => Number(v).toFixed(4)).join(", ")
        : "unavailable (" + r.error + ") — excluded from the seed";
      els.traceList.appendChild(dt);
      els.traceList.appendChild(dd);
    });

    const dt = document.createElement("dt");
    dt.textContent = "Coin throws, bottom line first";
    const dd = document.createElement("dd");
    dd.textContent = lines
      .map((l, i) => (i + 1) + ": " + l.coins.join("+") + " = " + l.value)
      .join("   ");
    els.traceList.appendChild(dt);
    els.traceList.appendChild(dd);

    els.traceSeed.textContent = "0x" + seed.toString(16).padStart(8, "0");
  }


  /* ⑦ ERRORS -------------------------------------------------*/

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = false;
  }
  function hideError() {
    els.error.hidden = true;
    els.error.textContent = "";
  }


  /* ⑧ INIT ---------------------------------------------------*/

  function init() {
    [
      "form", "question", "submit", "error",
      "world", "worldList", "cast", "hexagram",
      "result", "primary", "pNum", "pCn", "pEn", "pTrigrams", "pJudgment", "pReading",
      "relating", "rNum", "rCn", "rEn", "rReading",
      "reset", "trace", "traceList", "traceSeed"
    ].forEach((id) => { els[id] = $(id); });

    els.form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;                       // double-submit while a cast runs

      const q = els.question.value.trim();

      if (!q) {
        showError("Ask something first. The question is part of the cast — it goes into the seed alongside the world.");
        els.question.focus();
        return;
      }
      if (q.length > CONFIG.maxQuestion) {    // belt and braces; maxlength also caps it
        showError("Keep it under " + CONFIG.maxQuestion + " characters.");
        return;
      }
      if (!BY_BITS) {
        showError("The hexagram data has not loaded, so nothing can be cast yet. Reload the page.");
        return;
      }

      run(q);
    });

    els.reset.addEventListener("click", function () {
      resetStages();
      hideError();
      els.question.value = "";
      els.question.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // The data file is fetched, not inlined, so the 64 hexagrams stay editable
    // as data. The cost is that fetch() cannot read a file:// URL — opening
    // index.html by double-clicking it will land here. Say exactly that
    // rather than failing silently.
    loadHexagrams().catch(function (err) {
      showError(
        "Could not load the hexagram data (" + describe(err) + "). " +
        "If you opened this file directly from disk, serve the folder over http instead — " +
        "see the README."
      );
      els.submit.disabled = true;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
