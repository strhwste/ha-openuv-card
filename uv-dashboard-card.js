/*
Required hacs.json content:
{
  "name": "UV Dashboard Card",
  "render_readme": true,
  "homeassistant": "2026.3.0"
}
*/

class UvDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._stateSnapshot = {};
    this._clockTimer = null;
    this._rendered = false;
    this._timeText = null;
    this._detectedEntities = null;
  }

  connectedCallback() {
    this._startClock();
    if (!this._rendered) {
      this._render();
    }
  }

  disconnectedCallback() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = null;
    }
  }

  // Card config with optional title, language, entities override, and custom UV sensor.
  setConfig(config) {
    if (config && config.title !== undefined && typeof config.title !== "string") {
      throw new Error("The title option must be a string.");
    }

    if (
      config &&
      config.language !== undefined &&
      !["auto", "de", "en"].includes(config.language)
    ) {
      throw new Error("The language option must be one of: auto, de, en.");
    }

    if (
      config &&
      config.custom_uv_sensor !== undefined &&
      typeof config.custom_uv_sensor !== "string"
    ) {
      throw new Error("The custom_uv_sensor option must be a string.");
    }

    if (config && config.entities !== undefined && typeof config.entities !== "object") {
      throw new Error("The entities option must be an object.");
    }

    this._config = {
      title: "",
      language: "auto",
      ...config,
    };

    this._render();
  }

  // Home Assistant state updates with targeted re-rendering.
  set hass(hass) {
    const hadHass = Boolean(this._hass);
    const previousLanguage = hadHass ? this._getLanguage(this._hass) : null;
    const nextLanguage = this._getLanguage(hass);
    this._detectedEntities = null;
    const relevantChanged = !hadHass || this._haveRelevantStatesChanged(hass);
    this._hass = hass;

    if (!this.isConnected) {
      return;
    }

    if (!this._rendered || relevantChanged || previousLanguage !== nextLanguage) {
      this._render();
      return;
    }

    this._updateClock();
  }

  getCardSize() {
    return 5;
  }

  static getStubConfig() {
    return {
      type: "custom:uv-dashboard-card",
      title: "",
      language: "auto",
    };
  }

  static getConfigElement() {
    return document.createElement("uv-dashboard-card-editor");
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  // Auto-detect OpenUV integration entities from hass.states.
  _autoDetectEntities(hass = this._hass) {
    if (!hass?.states) {
      return {};
    }

    const allEntityIds = Object.keys(hass.states);
    const detected = {};

    const roles = {
      current_uv: {
        patterns: [/current.*uv.*index/i, /aktuell.*uv.*index/i],
        exclude: /max/i,
        domains: ["sensor"],
      },
      max_uv: {
        patterns: [/max.*uv.*index/i, /maximal.*uv.*index/i],
        domains: ["sensor"],
      },
      uv_level: {
        patterns: [/current.*uv.*level/i, /aktuell.*uv.*wert/i],
        domains: ["sensor"],
      },
      ozone: {
        patterns: [/ozon/i, /ozone.*level/i],
        domains: ["sensor"],
      },
      protection_window: {
        patterns: [/protection.*window/i, /schutzfenster/i],
        domains: ["sensor", "binary_sensor"],
      },
      skin_type_1: {
        patterns: [/skin.*type.*1/i, /hauttyp.*1/i],
        domains: ["sensor"],
      },
      skin_type_2: {
        patterns: [/skin.*type.*2/i, /hauttyp.*2/i],
        domains: ["sensor"],
      },
      skin_type_3: {
        patterns: [/skin.*type.*3/i, /hauttyp.*3/i],
        domains: ["sensor"],
      },
      skin_type_4: {
        patterns: [/skin.*type.*4/i, /hauttyp.*4/i],
        domains: ["sensor"],
      },
      skin_type_5: {
        patterns: [/skin.*type.*5/i, /hauttyp.*5/i],
        domains: ["sensor"],
      },
      skin_type_6: {
        patterns: [/skin.*type.*6/i, /hauttyp.*6/i],
        domains: ["sensor"],
      },
    };

    for (const [role, def] of Object.entries(roles)) {
      for (const entityId of allEntityIds) {
        if (detected[role]) {
          break;
        }

        const domain = entityId.split(".")[0];
        if (!def.domains.includes(domain)) {
          continue;
        }

        const matches = def.patterns.some((p) => p.test(entityId));
        if (!matches) {
          continue;
        }

        if (def.exclude && def.exclude.test(entityId)) {
          continue;
        }

        detected[role] = entityId;
      }
    }

    return detected;
  }

  // Resolve entity ID for a given role: config override → auto-detect → null.
  _resolveEntity(role, hass = this._hass) {
    if (this._config.entities && this._config.entities[role]) {
      return this._config.entities[role];
    }

    if (!this._detectedEntities) {
      this._detectedEntities = this._autoDetectEntities(hass);
    }

    return this._detectedEntities[role] || null;
  }

  _getEntities() {
    const roles = [
      "current_uv",
      "max_uv",
      "uv_level",
      "ozone",
      "protection_window",
      "skin_type_1",
      "skin_type_2",
      "skin_type_3",
      "skin_type_4",
      "skin_type_5",
      "skin_type_6",
    ];
    const entities = roles.map((r) => this._resolveEntity(r)).filter(Boolean);

    if (this._config.custom_uv_sensor) {
      entities.push(this._config.custom_uv_sensor);
    }

    return entities;
  }

  _haveRelevantStatesChanged(hass) {
    const nextSnapshot = {};
    let changed = false;

    // Temporarily use the new hass for auto-detection.
    const oldDetected = this._detectedEntities;
    this._detectedEntities = null;
    const oldHass = this._hass;
    this._hass = hass;

    const entities = this._getEntities();

    this._hass = oldHass;
    this._detectedEntities = oldDetected;

    entities.forEach((entityId) => {
      const stateObj = hass?.states?.[entityId];
      const nextValue = stateObj ? String(stateObj.state) : "__missing__";
      nextSnapshot[entityId] = nextValue;

      if (this._stateSnapshot[entityId] !== nextValue) {
        changed = true;
      }
    });

    this._stateSnapshot = nextSnapshot;
    return changed;
  }

  _startClock() {
    if (this._clockTimer) {
      return;
    }

    this._clockTimer = setInterval(() => this._updateClock(), 30000);
    this._updateClock();
  }

  _updateClock() {
    if (this._timeText) {
      this._timeText.textContent = this._formatTime();
    }
  }

  _getLanguage(hass = this._hass) {
    if (this._config.language && this._config.language !== "auto") {
      return this._config.language;
    }

    const language =
      hass?.locale?.language ||
      hass?.language ||
      document.documentElement.lang ||
      navigator.language ||
      "de";

    return String(language).toLowerCase().startsWith("de") ? "de" : "en";
  }

  _getTranslations() {
    const language = this._getLanguage();
    const translations = {
      de: {
        title: "UV & Sonnenschutz",
        currentUv: "Aktueller UV-Index",
        dailyMax: "Tagesmaximum",
        ozone: "Ozonwert",
        protection: "Schutzfenster",
        active: "Aktiv",
        inactive: "Inaktiv",
        skinType: "Typ",
        minutes: "Min.",
        scale: "UV-Skala",
        recommendation: "Empfehlung",
        unavailable: "–",
        spfLabel: "LSF",
        reapplyAdvice: "Nachcremen alle 2 Std.",
        uvLevels: ["Niedrig", "Mäßig", "Hoch", "Sehr hoch", "Extrem"],
        alerts: [
          "Geringe UV-Belastung. Kein besonderer Schutz notwendig.",
          "Mäßige UV-Belastung. Sonnencreme LSF 15+, Kopfbedeckung empfohlen. Alle 2 Stunden nachcremen.",
          "Hohe UV-Belastung. LSF 30+, Schatten aufsuchen zwischen 11–15 Uhr. Alle 2 Stunden nachcremen.",
          "Sehr hohe UV-Belastung. LSF 50+, Aufenthalt im Freien minimieren. Alle 1–2 Stunden nachcremen.",
          "Extreme UV-Belastung! Möglichst drinnen bleiben. Falls draußen: LSF 50+ und stündlich nachcremen.",
        ],
        protectionPrefix: "⚠ Schutzfenster aktiv – ",
        editorTitle: "Titel",
        editorLanguage: "Sprache",
        editorAuto: "Automatisch",
        editorGerman: "Deutsch",
        editorEnglish: "Englisch",
        editorEntities: "Entitäten",
        editorAutoDetected: "(automatisch erkannt)",
        editorNone: "Keine",
        editorCustomUv: "Eigener UV-Sensor",
        editorCustomUvHelp: "Optionaler eigener UV-Sensor für aktuellen UV-Wert",
        editorEntityLabels: {
          current_uv: "Aktueller UV-Index",
          max_uv: "Max. UV-Index",
          uv_level: "UV-Wert",
          ozone: "Ozonwert",
          protection_window: "Schutzfenster",
          skin_type_1: "Hauttyp 1",
          skin_type_2: "Hauttyp 2",
          skin_type_3: "Hauttyp 3",
          skin_type_4: "Hauttyp 4",
          skin_type_5: "Hauttyp 5",
          skin_type_6: "Hauttyp 6",
        },
      },
      en: {
        title: "UV & Sun Protection",
        currentUv: "Current UV Index",
        dailyMax: "Daily maximum",
        ozone: "Ozone",
        protection: "Protection window",
        active: "Active",
        inactive: "Inactive",
        skinType: "Type",
        minutes: "min",
        scale: "UV scale",
        recommendation: "Recommendation",
        unavailable: "–",
        spfLabel: "SPF",
        reapplyAdvice: "Reapply every 2 hrs",
        uvLevels: ["Low", "Moderate", "High", "Very high", "Extreme"],
        alerts: [
          "Low UV exposure. No special protection required.",
          "Moderate UV exposure. Sunscreen SPF 15+ and a hat are recommended. Reapply every 2 hours.",
          "High UV exposure. SPF 30+ and seek shade between 11 a.m. and 3 p.m. Reapply every 2 hours.",
          "Very high UV exposure. SPF 50+ and limit time outdoors. Reapply every 1–2 hours.",
          "Extreme UV exposure! Stay indoors whenever possible. If outside, use SPF 50+ and reapply every hour.",
        ],
        protectionPrefix: "⚠ Protection window active – ",
        editorTitle: "Title",
        editorLanguage: "Language",
        editorAuto: "Automatic",
        editorGerman: "German",
        editorEnglish: "English",
        editorEntities: "Entities",
        editorAutoDetected: "(auto-detected)",
        editorNone: "None",
        editorCustomUv: "Custom UV Sensor",
        editorCustomUvHelp: "Optional personal UV sensor for current UV reading",
        editorEntityLabels: {
          current_uv: "Current UV Index",
          max_uv: "Max UV Index",
          uv_level: "UV Level",
          ozone: "Ozone",
          protection_window: "Protection Window",
          skin_type_1: "Skin Type 1",
          skin_type_2: "Skin Type 2",
          skin_type_3: "Skin Type 3",
          skin_type_4: "Skin Type 4",
          skin_type_5: "Skin Type 5",
          skin_type_6: "Skin Type 6",
        },
      },
    };

    return translations[language] || translations.de;
  }

  _getStateObject(entityId) {
    return this._hass?.states?.[entityId];
  }

  _isUnavailable(stateObj) {
    const state = stateObj?.state;
    return (
      state === undefined ||
      state === null ||
      state === "unknown" ||
      state === "unavailable" ||
      state === ""
    );
  }

  _formatEntityState(entityId) {
    const translations = this._getTranslations();
    const stateObj = this._getStateObject(entityId);

    if (!stateObj || this._isUnavailable(stateObj)) {
      return translations.unavailable;
    }

    if (this._hass && typeof this._hass.formatEntityState === "function") {
      try {
        const formatted = this._hass.formatEntityState(stateObj);
        return formatted || stateObj.state;
      } catch (_error) {
        return stateObj.state;
      }
    }

    return stateObj.state;
  }

  _getNumericState(entityId) {
    const stateObj = this._getStateObject(entityId);
    if (!stateObj || this._isUnavailable(stateObj)) {
      return null;
    }

    const numeric = Number.parseFloat(stateObj.state);
    return Number.isFinite(numeric) ? numeric : null;
  }

  _formatMetricValue(entityId, decimals = 0, suffix = "") {
    const value = this._getNumericState(entityId);
    const translations = this._getTranslations();

    if (value === null) {
      return translations.unavailable;
    }

    return `${value.toFixed(decimals)}${suffix}`;
  }

  _formatTime() {
    return new Intl.DateTimeFormat(this._getLanguage(), {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
  }

  _getUvMeta(uvValue) {
    const translations = this._getTranslations();
    const value = Number.isFinite(uvValue) ? uvValue : null;

    if (value === null) {
      return {
        color: "var(--disabled-text-color, #9e9e9e)",
        label: translations.unavailable,
        advice: translations.alerts[0],
      };
    }

    if (value < 3) {
      return {
        color: "#4CAF50",
        label: translations.uvLevels[0],
        advice: translations.alerts[0],
      };
    }

    if (value < 6) {
      return {
        color: "#FFC107",
        label: translations.uvLevels[1],
        advice: translations.alerts[1],
      };
    }

    if (value < 8) {
      return {
        color: "#FF9800",
        label: translations.uvLevels[2],
        advice: translations.alerts[2],
      };
    }

    if (value < 11) {
      return {
        color: "#F44336",
        label: translations.uvLevels[3],
        advice: translations.alerts[3],
      };
    }

    return {
      color: "#9C27B0",
      label: translations.uvLevels[4],
      advice: translations.alerts[4],
    };
  }

  _isProtectionWindowActive() {
    const entity = this._resolveEntity("protection_window");
    const state = this._formatEntityState(entity);
    return ["ein", "on", "active", "aktiv"].includes(String(state).toLowerCase());
  }

  _getAdvice(uvValue) {
    const uvMeta = this._getUvMeta(uvValue);
    return this._isProtectionWindowActive()
      ? `${this._getTranslations().protectionPrefix}${uvMeta.advice}`
      : uvMeta.advice;
  }

  // SPF recommendation based on skin type (1–6) and current UV index.
  _getSpfForSkinType(skinType, uvValue) {
    if (uvValue === null) {
      return null;
    }

    if (uvValue < 3) {
      return skinType <= 2 ? "15" : null;
    }

    if (uvValue < 6) {
      return skinType <= 2 ? "30+" : "15";
    }

    if (uvValue < 8) {
      return skinType <= 2 ? "50+" : skinType <= 4 ? "30+" : "15+";
    }

    if (uvValue < 11) {
      return skinType <= 3 ? "50+" : skinType <= 5 ? "30+" : "30";
    }

    // UV 11+
    return skinType <= 5 ? "50+" : "50";
  }

  _renderSkinTypes() {
    const translations = this._getTranslations();
    const colors = ["#F4DFC6", "#E7C59C", "#CD9B6A", "#A76B41", "#70452B", "#3E2618"];
    const currentUvEntity =
      this._config.custom_uv_sensor || this._resolveEntity("current_uv");
    const uvValue = this._getNumericState(currentUvEntity);

    return colors
      .map((color, index) => {
        const entity = this._resolveEntity(`skin_type_${index + 1}`);
        const minutes = this._formatMetricValue(entity, 0, "");
        const spf = this._getSpfForSkinType(index + 1, uvValue);
        const spfHtml = spf
          ? `<div class="skin-spf">${translations.spfLabel} ${spf}</div>`
          : "";

        return `
          <div class="skin-card">
            <span class="skin-dot" style="background:${color};"></span>
            <div class="skin-label">${translations.skinType} ${index + 1}</div>
            <div class="skin-value">${minutes}</div>
            <div class="skin-unit">${translations.minutes}</div>
            ${spfHtml}
          </div>
        `;
      })
      .join("");
  }

  // Render method for the full dashboard UI.
  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const translations = this._getTranslations();
    const currentUvEntity =
      this._config.custom_uv_sensor || this._resolveEntity("current_uv");
    const uvValue = this._getNumericState(currentUvEntity);
    const dailyMax = this._formatMetricValue(this._resolveEntity("max_uv"), 1);
    const ozone = this._formatMetricValue(
      this._resolveEntity("ozone"),
      0,
      " DU"
    );
    const currentUv = this._formatMetricValue(currentUvEntity, 1);
    const uvMeta = this._getUvMeta(uvValue);
    const scalePosition =
      uvValue === null
        ? 0
        : (Math.max(0, Math.min(uvValue, 11)) / 11) * 100;
    const title = this._escapeHtml(this._config.title || translations.title);
    const protectionLabel = this._isProtectionWindowActive()
      ? translations.active
      : translations.inactive;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
          font-family: var(
            --paper-font-common-base_-_font-family,
            "Inter",
            "Segoe UI",
            system-ui,
            sans-serif
          );
        }

        ha-card {
          display: block;
          background: var(--card-background-color, #fff);
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 12px;
          overflow: hidden;
        }

        .wrap {
          padding: 20px;
          background: linear-gradient(
            180deg,
            var(--card-background-color, #fff),
            var(--primary-background-color, #f7f7f7)
          );
        }

        .header,
        .metrics,
        .footer-meta {
          display: grid;
          gap: 12px;
        }

        .header {
          grid-template-columns: 1fr auto;
          align-items: center;
          margin-bottom: 18px;
        }

        .headline {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .headline-text {
          font-size: 21px;
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        .clock {
          font-size: 18px;
          font-weight: 600;
          color: var(--secondary-text-color);
          white-space: nowrap;
        }

        .sun-icon {
          width: 26px;
          height: 26px;
          color: var(--accent-color, #ffb300);
          flex: 0 0 auto;
        }

        .metrics {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-bottom: 18px;
        }

        .metric-card,
        .scale-card,
        .skin-grid,
        .alert-card {
          border: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.52);
        }

        .metric-card {
          padding: 14px 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 104px;
          justify-content: space-between;
        }

        .metric-label,
        .section-label,
        .skin-label,
        .footer-label {
          font-size: 13px;
          color: var(--secondary-text-color);
          letter-spacing: 0.02em;
        }

        .metric-value {
          font-size: 28px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.03em;
        }

        .badge-row,
        .footer-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }

        .uv-badge,
        .protection-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .uv-badge {
          color: #fff;
        }

        .protection-pill {
          background: rgba(0, 0, 0, 0.06);
          color: var(--primary-text-color);
        }

        .metric-subvalue {
          font-size: 11px;
          color: var(--secondary-text-color);
        }

        .scale-card,
        .alert-card {
          padding: 14px;
          margin-bottom: 14px;
        }

        .scale-bar {
          position: relative;
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            #4CAF50 0%,
            #8BC34A 18%,
            #FFC107 40%,
            #FF9800 58%,
            #F44336 80%,
            #9C27B0 100%
          );
          margin-top: 12px;
        }

        .scale-marker {
          position: absolute;
          top: 50%;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 3px solid #fff;
          background: ${uvMeta.color};
          transform: translate(-50%, -50%);
          left: ${scalePosition}%;
        }

        .scale-labels {
          margin-top: 10px;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--secondary-text-color);
        }

        .skin-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px;
          padding: 12px;
          margin-bottom: 14px;
        }

        .skin-card {
          text-align: center;
          padding: 10px 6px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.42);
        }

        .skin-dot {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid rgba(0, 0, 0, 0.18);
          margin-bottom: 8px;
        }

        .skin-value {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.1;
          margin-top: 6px;
        }

        .skin-unit,
        .alert-copy,
        .help-text {
          font-size: 11px;
          color: var(--secondary-text-color);
        }

        .skin-spf {
          font-size: 10px;
          font-weight: 600;
          color: var(--accent-color, #ff9800);
          margin-top: 4px;
        }

        .alert-card {
          background: rgba(255, 255, 255, 0.52);
        }

        .alert-copy {
          color: var(--primary-text-color);
          font-size: 14px;
          line-height: 1.45;
          margin-top: 8px;
        }

        @media (max-width: 900px) {
          .metrics {
            grid-template-columns: 1fr;
          }

          .skin-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .header {
            grid-template-columns: 1fr;
          }

          .skin-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 901px) {
          .metric-value {
            font-size: 32px;
          }

          .headline-text {
            font-size: 24px;
          }

          .clock {
            font-size: 20px;
          }
        }
      </style>
      <ha-card>
        <div class="wrap">
          <div class="header">
            <div class="headline">
              <svg class="sun-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.76 4.84 5.35 3.43 3.93 4.85l1.41 1.41zm10.48 14.31 1.41 1.41 1.42-1.42-1.41-1.41zM12 5a1 1 0 0 0 1-1V2a1 1 0 1 0-2 0v2a1 1 0 0 0 1 1zm0 14a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1zM5 11H3a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2zm16 0h-2a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2zm-2.76-6.16 1.41-1.41-1.42-1.42-1.41 1.41zm-12.48 14.3-1.41 1.42 1.41 1.41 1.42-1.41zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>
              </svg>
              <div class="headline-text">${title}</div>
            </div>
            <div class="clock" id="clock">${this._formatTime()}</div>
          </div>

          <div class="metrics">
            <div class="metric-card">
              <div class="metric-label">${translations.currentUv}</div>
              <div class="metric-value">${currentUv}</div>
              <div class="badge-row">
                <span class="uv-badge" style="background:${uvMeta.color};">${uvMeta.label}</span>
                <span class="metric-subvalue">${this._formatEntityState(this._resolveEntity("uv_level"))}</span>
              </div>
            </div>

            <div class="metric-card">
              <div class="metric-label">${translations.dailyMax}</div>
              <div class="metric-value">${dailyMax}</div>
              <div class="metric-subvalue">${translations.scale} 0–11+</div>
            </div>

            <div class="metric-card">
              <div class="metric-label">${translations.ozone}</div>
              <div class="metric-value">${ozone}</div>
              <div class="footer-meta">
                <span class="footer-label">${translations.protection}</span>
                <span class="protection-pill">${protectionLabel}</span>
              </div>
            </div>
          </div>

          <div class="scale-card">
            <div class="section-label">${translations.scale}</div>
            <div class="scale-bar">
              <div class="scale-marker" aria-hidden="true"></div>
            </div>
            <div class="scale-labels">
              <span>0</span>
              <span>3</span>
              <span>6</span>
              <span>8</span>
              <span>11+</span>
            </div>
          </div>

          <div class="skin-grid">
            ${this._renderSkinTypes()}
          </div>

          <div class="alert-card">
            <div class="section-label">${translations.recommendation}</div>
            <div class="alert-copy">${this._getAdvice(uvValue)}</div>
          </div>
        </div>
      </ha-card>
    `;

    this._timeText = this.shadowRoot.getElementById("clock");
    this._rendered = true;
  }
}

class UvDashboardCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _getLanguage() {
    const configured = this._config?.language;
    if (configured && configured !== "auto") {
      return configured;
    }

    const language =
      this._hass?.locale?.language ||
      document.documentElement.lang ||
      navigator.language ||
      "de";

    return String(language).toLowerCase().startsWith("de") ? "de" : "en";
  }

  _getTranslations() {
    const card = new UvDashboardCard();
    card._config = this._config || {};
    card._hass = this._hass;
    return card._getTranslations();
  }

  _escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text);
    return div.innerHTML;
  }

  // Get auto-detected entities for display in editor.
  _getDetectedEntities() {
    const card = new UvDashboardCard();
    card._config = {};
    card._hass = this._hass;
    return card._autoDetectEntities();
  }

  // Get available sensor entities for dropdown options.
  _getSensorEntities() {
    if (!this._hass?.states) {
      return [];
    }

    return Object.keys(this._hass.states)
      .filter((e) => e.startsWith("sensor.") || e.startsWith("binary_sensor."))
      .sort();
  }

  _onInputChanged(event) {
    const target = event.target;
    const key = target?.dataset?.field;
    if (!key) {
      return;
    }

    const nextConfig = { ...this._config };
    const value = target.value;

    if (key === "title") {
      if (value) {
        nextConfig.title = value;
      } else {
        delete nextConfig.title;
      }
    }

    if (key === "language") {
      nextConfig.language = value || "auto";
    }

    if (key === "custom_uv_sensor") {
      if (value) {
        nextConfig.custom_uv_sensor = value;
      } else {
        delete nextConfig.custom_uv_sensor;
      }
    }

    // Handle entity overrides.
    if (key.startsWith("entity_")) {
      const role = key.replace("entity_", "");
      if (!nextConfig.entities) {
        nextConfig.entities = {};
      }
      if (value) {
        nextConfig.entities[role] = value;
      } else {
        delete nextConfig.entities[role];
      }
      if (Object.keys(nextConfig.entities).length === 0) {
        delete nextConfig.entities;
      }
    }

    this._config = nextConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: nextConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  _render() {
    if (!this.shadowRoot) {
      return;
    }

    const translations = this._getTranslations();
    const lang = this._getLanguage();
    const detected = this._getDetectedEntities();
    const sensorEntities = this._getSensorEntities();
    const configEntities = this._config.entities || {};

    const entityRoles = [
      "current_uv",
      "max_uv",
      "uv_level",
      "ozone",
      "protection_window",
      "skin_type_1",
      "skin_type_2",
      "skin_type_3",
      "skin_type_4",
      "skin_type_5",
      "skin_type_6",
    ];

    const entitySelects = entityRoles
      .map((role) => {
        const label = translations.editorEntityLabels[role] || role;
        const detectedId = detected[role] || "";
        const configuredId = configEntities[role] || "";
        const autoLabel = detectedId
          ? `${translations.editorAuto} (${detectedId})`
          : translations.editorNone;

        const options = sensorEntities
          .map(
            (e) =>
              `<option value="${this._escapeHtml(e)}" ${configuredId === e ? "selected" : ""}>${this._escapeHtml(e)}</option>`
          )
          .join("");

        return `
          <label>
            ${label}
            <select data-field="entity_${role}">
              <option value="" ${!configuredId ? "selected" : ""}>${autoLabel}</option>
              ${options}
            </select>
          </label>
        `;
      })
      .join("");

    const customUvOptions = sensorEntities
      .map(
        (e) =>
          `<option value="${this._escapeHtml(e)}" ${this._config.custom_uv_sensor === e ? "selected" : ""}>${this._escapeHtml(e)}</option>`
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
          font-family: var(
            --paper-font-common-base_-_font-family,
            "Inter",
            "Segoe UI",
            system-ui,
            sans-serif
          );
        }

        .editor {
          display: grid;
          gap: 16px;
          padding: 12px 0;
        }

        label {
          display: grid;
          gap: 6px;
          font-size: 13px;
          color: var(--secondary-text-color);
        }

        input,
        select {
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.16);
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          font: inherit;
        }

        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-text-color);
          margin-top: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .help-text {
          font-size: 11px;
          color: var(--secondary-text-color);
          margin-top: -8px;
        }

        details {
          margin-top: 4px;
        }

        summary {
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-text-color);
          padding: 8px 0;
        }

        .entity-grid {
          display: grid;
          gap: 12px;
          padding-top: 8px;
        }
      </style>
      <div class="editor" lang="${lang}">
        <label>
          ${translations.editorTitle}
          <input
            type="text"
            data-field="title"
            placeholder="${translations.title}"
          />
        </label>
        <label>
          ${translations.editorLanguage}
          <select data-field="language">
            <option value="auto" ${(this._config.language || "auto") === "auto" ? "selected" : ""}>${translations.editorAuto}</option>
            <option value="de" ${this._config.language === "de" ? "selected" : ""}>${translations.editorGerman}</option>
            <option value="en" ${this._config.language === "en" ? "selected" : ""}>${translations.editorEnglish}</option>
          </select>
        </label>

        <label>
          ${translations.editorCustomUv}
          <select data-field="custom_uv_sensor">
            <option value="" ${!this._config.custom_uv_sensor ? "selected" : ""}>${translations.editorNone}</option>
            ${customUvOptions}
          </select>
        </label>
        <div class="help-text">${translations.editorCustomUvHelp}</div>

        <details>
          <summary>${translations.editorEntities}</summary>
          <div class="entity-grid">
            ${entitySelects}
          </div>
        </details>
      </div>
    `;

    const titleInput = this.shadowRoot.querySelector('input[data-field="title"]');
    if (titleInput) {
      titleInput.value = this._config.title || "";
    }

    this.shadowRoot.querySelectorAll("input, select").forEach((element) => {
      element.addEventListener("change", (event) => this._onInputChanged(event));
      element.addEventListener("input", (event) => this._onInputChanged(event));
    });
  }
}

if (!customElements.get("uv-dashboard-card")) {
  customElements.define("uv-dashboard-card", UvDashboardCard);
}

if (!customElements.get("uv-dashboard-card-editor")) {
  customElements.define("uv-dashboard-card-editor", UvDashboardCardEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "uv-dashboard-card",
  name: "UV Dashboard Card",
  description: "Minimalist UV and sun protection dashboard for Home Assistant.",
  preview: true,
  documentationURL: "https://github.com/strhwste/ha-openuv-card",
});
