// Client half of @local/hero-decor.
//
// Customizes the new-conversation home ("hero"):
//   - headline text / color / font size
//   - composer card background color / max width / text size
//   - headline↔composer distance
//   - horizontal + vertical offset of the whole hero group
//
// Values persist in the browser's localStorage; named presets are kept in a
// separate localStorage key. The settings page applies a LIVE preview (via
// dsh-hero-decor:preview events) and persists on 保存.
//
// Structural selectors rely on the conversation package's CSS-module keys
// (`_HASH_headline`, `_HASH_stack`) and the official layout variables; if a
// future release renames the module keys, headline styling silently falls
// back to the shipped look.
window.__ModuleLoader__.load({
  id: '@local/hero-decor',
  factory(require) {
    const React = require('react');

    const STORAGE_KEY = 'dsh-hero-decor:v1';
    const PRESETS_KEY = 'dsh-hero-decor:presets:v1';
    const CHANGE_EVENT = 'dsh-hero-decor:change';
    const PREVIEW_EVENT = 'dsh-hero-decor:preview';
    const PREVIEW_END_EVENT = 'dsh-hero-decor:preview-end';

    const DEFAULTS = {
      headlineText: '',
      headlineColor: '',
      headlineSize: 26,
      cardColor: '',
      cardMaxWidth: 0,
      offsetX: 0,
      offsetY: 0,
      vAlign: 'center',
      headlineGap: null,      // null = shipped default; number = extra px between stack and composer
      composerHeight: null,   // null = shipped default; number = composer editor height px
      hideLogo: false         // hide the fish brand mark before the headline
    };

    // Curated palettes. Card colors are translucent tints that sit well on
    // both light and dark themes.
    const HEADLINE_PRESETS = ['#4f7cff', '#8b5cf6', '#14b8a6', '#f43f5e', '#f59e0b', '#ffffff', '#111827'];
    const CARD_PRESETS = [
      'rgba(79,124,255,0.12)', 'rgba(139,92,246,0.12)', 'rgba(20,184,166,0.12)',
      'rgba(244,63,94,0.12)', 'rgba(255,255,255,0.07)', 'rgba(0,0,0,0.28)'
    ];

    // Live preview draft (set while the settings page is open and edited;
    // cleared on save/reset/close). null = follow persisted config.
    let liveDraft = null;

    function readConfig() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULTS };
        const parsed = JSON.parse(raw);
        const merged = { ...DEFAULTS, ...(typeof parsed === 'object' && parsed !== null ? parsed : {}) };
        return sanitize(merged);
      } catch (error) {
        return { ...DEFAULTS };
      }
    }

    function effectiveConfig() {
      return liveDraft != null ? sanitize(liveDraft) : readConfig();
    }

    function clampNumber(value, min, max, fallback) {
      const n = Number(value);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(max, Math.max(min, Math.round(n)));
    }

    function sanitizeColor(value) {
      if (typeof value !== 'string') return '';
      const v = value.trim();
      if (v === '') return '';
      // Empty or a conservative color literal only: hex, rgb(a), hsl(a),
      // named colors. Blocks anything that could break out of a declaration.
      if (!/^[#a-zA-Z]([\w(),.\s%-]{0,63})$/.test(v)) return '';
      return v;
    }

    function sanitize(raw) {
      return {
        headlineText: typeof raw.headlineText === 'string' ? raw.headlineText.slice(0, 60) : '',
        headlineColor: sanitizeColor(raw.headlineColor),
        headlineSize: clampNumber(raw.headlineSize, 16, 72, DEFAULTS.headlineSize),
        cardColor: sanitizeColor(raw.cardColor),
        cardMaxWidth: clampNumber(raw.cardMaxWidth, 0, 2000, 0),
        offsetX: clampNumber(raw.offsetX, -300, 300, 0),
        offsetY: clampNumber(raw.offsetY, -400, 400, 0),
        vAlign: ['center', 'top', 'bottom'].indexOf(raw.vAlign) !== -1 ? raw.vAlign : 'center',
        headlineGap: raw.headlineGap == null ? null : clampNumber(raw.headlineGap, -40, 120, null),
        composerHeight: raw.composerHeight == null ? null : clampNumber(raw.composerHeight, 44, 160, null),
        hideLogo: raw.hideLogo === true
      };
    }

    function writeConfig(config) {
      const clean = sanitize(config);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
      liveDraft = null;
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
      return clean;
    }

    // ------------------------------------------------------------------
    // Named presets
    // ------------------------------------------------------------------

    function readPresets() {
      try {
        const raw = window.localStorage.getItem(PRESETS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list)) return [];
        return list
          .filter((p) => p && typeof p.name === 'string' && typeof p.config === 'object')
          .map((p) => ({ name: p.name.slice(0, 30), config: sanitize(p.config) }));
      } catch (error) {
        return [];
      }
    }

    function writePresets(presets) {
      window.localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    }

    // ------------------------------------------------------------------
    // Color helpers
    // ------------------------------------------------------------------

    function colorToHex(value) {
      if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
      const m = value.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1].split(',').map((s) => parseFloat(s));
        const h = (n) => ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
        return '#' + h(parts[0]) + h(parts[1]) + h(parts[2]);
      }
      return '#4f7cff';
    }

    function colorAlpha(value) {
      const m = value && value.match(/rgba?\([^)]*?,\s*([\d.]+)\s*\)/);
      if (m) return Math.round(parseFloat(m[1]) * 100);
      return 100;
    }

    function hexToRgba(hex, alpha) {
      const n = parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return `rgba(${r},${g},${b},${alpha})`;
    }

    // ------------------------------------------------------------------
    // Scoped stylesheet
    // ------------------------------------------------------------------

    const HERO_SCOPE = '.dshd-frame[data-dshd-hero="true"]';

    function buildCss(config) {
      const parts = [];
      const vars = [];
      if (config.cardColor) vars.push(`--dsw-specific-input-major:${config.cardColor}`);
      if (config.cardMaxWidth > 0) vars.push(`--dsh-composer-card-max-width:${config.cardMaxWidth}px`);
      if (vars.length > 0) parts.push(`${HERO_SCOPE}{${vars.join(';')}}`);
      // Vertical alignment: the shipped hero centers its content; switch
      // the flex containers to top/bottom so the group can reach the
      // screen edges, then fine-tune with offsetY.
      if (config.vAlign === 'top' || config.vAlign === 'bottom') {
        const jc = config.vAlign === 'top' ? 'flex-start' : 'flex-end';
        parts.push(`${HERO_SCOPE} [data-conversation-scroll]{justify-content:${jc}}`);
        parts.push(`${HERO_SCOPE} div[class*="_root"]{justify-content:${jc}}`);
      }
      // One transform on the hero scroll body moves headline + composer
      // (and anything else in the hero) together. A transform does not
      // affect layout or the scroll container's own scroll geometry, so
      // no scrollbars are introduced; ancestors with hidden overflow clip.
      if (config.offsetX !== 0 || config.offsetY !== 0) {
        const x = config.offsetX;
        const y = config.offsetY;
        parts.push(`${HERO_SCOPE} [data-conversation-scroll]{transform:translate(${x}px,${y}px)}`);
      }
      // Headline↔composer distance: margin under the whole stack (the
      // composer container follows it), negative values pull them closer.
      if (config.headlineGap != null) {
        parts.push(`${HERO_SCOPE} div[class*="_stack"]{margin-bottom:${config.headlineGap}px}`);
      }
      const headline = [];
      if (config.headlineColor) headline.push(`color:${config.headlineColor}`);
      if (config.headlineSize !== DEFAULTS.headlineSize) {
        headline.push(`font-size:${config.headlineSize}px`);
        headline.push('line-height:1.25');
      }
      if (headline.length > 0) parts.push(`${HERO_SCOPE} div[class*="_headline"]{${headline.join(';')}}`);
      // Slimmer composer: override the official height variable (in case a
      // rule consumes it) AND pin the editor root height directly, so the
      // card follows its content and becomes slimmer either way.
      if (config.composerHeight != null) {
        const h = config.composerHeight;
        parts.push(`${HERO_SCOPE}{--dsh-composer-height:${h}px}`);
        parts.push(`${HERO_SCOPE} [contenteditable="true"]{min-height:${h}px;height:${h}px}`);
      }
      // Hide the fish brand mark before the headline (scoped to the hero;
      // the same mark in the sidebar and on session pages is untouched).
      if (config.hideLogo) {
        parts.push(`${HERO_SCOPE} span[class*="fishHitbox"]{display:none}`);
      }
      return parts.join('\n');
    }

    const BASE_CSS = '.dshd-frame{display:contents}';

    // ------------------------------------------------------------------
    // Headline text observer
    // ------------------------------------------------------------------
    // The headline text span has no stable class of its own; it is the only
    // unclassed span inside the titleGroup module. React re-renders it when
    // the locale changes, so a MutationObserver keeps the custom text in
    // place without fighting the framework elsewhere.

    const activeFixups = new Set();

    function runFixups() {
      for (const fixup of activeFixups) fixup();
    }

    function headlineTextSpan(root) {
      const groups = root.querySelectorAll('span[class*="_titleGroup"]');
      for (const group of groups) {
        for (const child of group.children) {
          if (child.tagName === 'SPAN' && !child.hasAttribute('class')) return child;
        }
      }
      return null;
    }

    function fixupHeadline(root) {
      const config = effectiveConfig();
      const span = headlineTextSpan(root);
      if (span == null) return;
      const wanted = config.headlineText;
      if (wanted === '') {
        // Nothing custom: restore the locale text if we still hold it.
        if (span.dataset.dshdCustom === 'true' && span.dataset.dshdOriginal) {
          span.textContent = span.dataset.dshdOriginal;
        }
        delete span.dataset.dshdCustom;
        return;
      }
      if (span.dataset.dshdCustom !== 'true') {
        span.dataset.dshdOriginal = span.textContent;
      }
      if (span.textContent !== wanted) span.textContent = wanted;
      span.dataset.dshdCustom = 'true';
    }

    function observeHeadline(root) {
      let scheduled = false;
      const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        window.queueMicrotask(() => {
          scheduled = false;
          if (activeFixups.has(fixup)) fixup();
        });
      };
      const fixup = () => fixupHeadline(root);
      const observer = new MutationObserver(schedule);
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      fixup();
      activeFixups.add(fixup);
      return () => {
        activeFixups.delete(fixup);
        observer.disconnect();
      };
    }

    // ------------------------------------------------------------------
    // hero.frame wrapper layer
    // ------------------------------------------------------------------

    function HeroFrame(props) {
      const { hero, children } = props;
      const ref = React.useRef(null);
      React.useEffect(() => {
        if (ref.current == null) return undefined;
        return observeHeadline(ref.current);
      }, []);
      return React.createElement(
        'div',
        { ref, className: 'dshd-frame', 'data-dshd-hero': hero ? 'true' : 'false' },
        children
      );
    }

    // ------------------------------------------------------------------
    // Settings page building blocks
    // ------------------------------------------------------------------

    const columnStyle = { marginBottom: '18px' };
    const labelStyle = { fontSize: '13px', fontWeight: 500, marginBottom: '8px' };
    const inputStyle = {
      boxSizing: 'border-box', width: '100%', padding: '6px 10px',
      fontSize: '13px', borderRadius: '8px', border: '1px solid rgba(128,128,128,0.35)',
      background: 'transparent', color: 'inherit'
    };
    const hintStyle = { fontSize: '12px', opacity: 0.65, marginTop: '4px' };
    const buttonStyle = {
      padding: '6px 16px', fontSize: '13px', borderRadius: '8px',
      border: '1px solid rgba(128,128,128,0.35)', cursor: 'pointer',
      background: 'transparent', color: 'inherit'
    };
    const smallButtonStyle = { ...buttonStyle, padding: '4px 10px', fontSize: '12px', flex: 'none' };
    const swatchStyle = (color, active) => ({
      width: '24px', height: '24px', borderRadius: '8px', padding: 0, cursor: 'pointer',
      border: active ? '2px solid #4f7cff' : '1px solid rgba(128,128,128,0.4)',
      background: color || 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      color: 'inherit', fontSize: '10px'
    });
    const sliderStyle = { flex: 1, minWidth: '0', accentColor: '#4f7cff' };
    const selectStyle = {
      flex: 1, minWidth: '0', padding: '5px 8px', fontSize: '13px',
      borderRadius: '8px', border: '1px solid rgba(128,128,128,0.35)',
      background: 'transparent', color: 'inherit'
    };

    function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

    function Field(props) {
      const { label, hint, value, onInput, placeholder } = props;
      return React.createElement(
        'div',
        { style: columnStyle },
        React.createElement('div', { style: labelStyle }, label),
        React.createElement('input', {
          style: inputStyle, value, placeholder,
          onInput: (event) => onInput(event.target.value)
        }),
        hint ? React.createElement('div', { style: hintStyle }, hint) : null
      );
    }

    // Color picker: swatch presets + native color wheel + optional alpha.
    function ColorField(props) {
      const { label, hint, value, presets, allowAlpha, onChange } = props;
      const hex = colorToHex(value || '');
      const alpha = allowAlpha ? colorAlpha(value || '') : 100;

      const setColor = (h, a) => {
        const useAlpha = allowAlpha && a < 100;
        onChange(useAlpha ? hexToRgba(h, Math.round(a) / 100) : h);
      };

      const swatches = [
        React.createElement('button', {
          key: 'default', type: 'button', title: '跟随主题默认',
          style: swatchStyle('', value === ''),
          onClick: () => onChange('')
        }, '·')
      ].concat(presets.map((color) => React.createElement('button', {
        key: color, type: 'button', title: color,
        style: swatchStyle(color, value === color),
        onClick: () => onChange(color)
      })));

      return React.createElement(
        'div',
        { style: columnStyle },
        React.createElement('div', { style: labelStyle }, label),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
          swatches,
          React.createElement('input', {
            type: 'color', 'aria-label': '自定义颜色', title: '自定义颜色',
            value: hex,
            style: { width: '30px', height: '26px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' },
            onChange: (e) => setColor(e.target.value, alpha)
          })
        ),
        allowAlpha ? React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' } },
          React.createElement('span', { style: { fontSize: '12px', opacity: 0.75, flex: 'none' } }, '不透明度'),
          React.createElement('input', {
            type: 'range', min: 0, max: 100, step: 1, value: alpha, style: sliderStyle,
            onChange: (e) => setColor(hex, Number(e.target.value))
          }),
          React.createElement('span', { style: { fontSize: '12px', opacity: 0.75, width: '42px', textAlign: 'right', flex: 'none' } }, alpha + '%')
        ) : null,
        hint ? React.createElement('div', { style: hintStyle }, hint) : null
      );
    }

    function SliderRow(props) {
      const { label, value, min, max, step, onChange, suffix, onReset } = props;
      return React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
        React.createElement('span', { style: { fontSize: '13px', flex: 'none', width: '88px' } }, label),
        onReset ? React.createElement('button', {
          type: 'button', style: smallButtonStyle, onClick: onReset, title: '恢复默认'
        }, '默认') : null,
        React.createElement('input', {
          type: 'range', min, max, step, value, style: sliderStyle,
          onChange: (e) => onChange(Number(e.target.value))
        }),
        React.createElement('span', { style: { fontSize: '12px', opacity: 0.75, width: '64px', textAlign: 'right', flex: 'none' } }, String(value) + (suffix || ''))
      );
    }

    // Mini stage: drag the rounded rect (the hero group) to set offsets.
    const STAGE_W = 480;
    const STAGE_H = 260;
    const STAGE_SCALE = 0.45;

    function LayoutStage(props) {
      const { draft, onPatch } = props;
      const dragRef = React.useRef(null);

      const rectW = Math.min(STAGE_W * 0.92, (draft.cardMaxWidth > 0 ? draft.cardMaxWidth : 832) * STAGE_SCALE);
      const rectH = 64;
      const cx = STAGE_W / 2 + draft.offsetX * STAGE_SCALE;
      const cy = STAGE_H / 2 + draft.offsetY * STAGE_SCALE;
      const maxOffX = Math.max(0, Math.floor((STAGE_W - rectW) / 2 / STAGE_SCALE));
      const maxOffY = Math.max(0, Math.floor((STAGE_H - rectH) / 2 / STAGE_SCALE));

      const startDrag = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { px: e.clientX, py: e.clientY, ox: draft.offsetX, oy: draft.offsetY };
      };
      const moveDrag = (e) => {
        const d = dragRef.current;
        if (d == null) return;
        const nx = clamp(Math.round(d.ox + (e.clientX - d.px) / STAGE_SCALE), -maxOffX, maxOffX);
        const ny = clamp(Math.round(d.oy + (e.clientY - d.py) / STAGE_SCALE), -maxOffY, maxOffY);
        onPatch({ offsetX: nx, offsetY: ny });
      };
      const endDrag = () => { dragRef.current = null; };

      return React.createElement(
        'div',
        {
          style: {
            width: '100%', maxWidth: STAGE_W + 'px', height: STAGE_H + 'px',
            borderRadius: '12px', border: '1px solid rgba(128,128,128,0.3)',
            background: 'linear-gradient(135deg, rgba(127,127,127,0.10), rgba(127,127,127,0.02))',
            position: 'relative', overflow: 'hidden', touchAction: 'none', marginBottom: '12px'
          }
        },
        React.createElement('div', {
          style: {
            position: 'absolute', left: cx - rectW / 2 + 'px', top: cy - rectH / 2 + 'px',
            width: rectW + 'px', height: rectH + 'px', borderRadius: '14px',
            background: 'rgba(79,124,255,0.18)', border: '1.5px solid rgba(79,124,255,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: 'inherit', cursor: 'grab', userSelect: 'none',
            touchAction: 'none'
          },
          onPointerDown: startDrag, onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag
        }, '标题 + 输入框')
      );
    }

    // ------------------------------------------------------------------
    // Settings page
    // ------------------------------------------------------------------

    function SettingsSection() {
      const [draft, setDraft] = React.useState(readConfig);
      const [message, setMessage] = React.useState('');
      const [presets, setPresets] = React.useState(readPresets);
      const [presetName, setPresetName] = React.useState('');
      const [selectedPreset, setSelectedPreset] = React.useState('0');

      // Keep the live preview in sync while editing; clear it on unmount
      // (closing settings) so an unsaved draft does not linger.
      React.useEffect(() => {
        window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: draft }));
        return () => window.dispatchEvent(new CustomEvent(PREVIEW_END_EVENT));
      }, [draft]);

      const patch = (partial) => setDraft((current) => ({ ...current, ...partial }));

      const save = () => {
        const clean = writeConfig(draft);
        setDraft(clean);
        setMessage('已保存。');
      };

      const reset = () => {
        const clean = writeConfig({ ...DEFAULTS });
        setDraft(clean);
        setMessage('已恢复默认。');
      };

      const applyPreset = () => {
        const index = Number(selectedPreset);
        const config = index === 0 ? { ...DEFAULTS } : (presets[index - 1] ? presets[index - 1].config : null);
        if (config == null) return;
        const clean = writeConfig(config);
        setDraft(clean);
        setMessage('已应用预设「' + (index === 0 ? '官方默认' : presets[index - 1].name) + '」。');
      };

      const savePreset = () => {
        const name = presetName.trim() || ('预设 ' + (presets.length + 1));
        const next = presets.concat([{ name, config: sanitize(draft) }]);
        writePresets(next);
        setPresets(next);
        setPresetName('');
        setSelectedPreset(String(next.length));
        setMessage('已保存预设「' + name + '」。');
      };

      const deletePreset = () => {
        const index = Number(selectedPreset);
        if (index === 0 || !presets[index - 1]) return;
        const next = presets.filter((_, i) => i !== index - 1);
        writePresets(next);
        setPresets(next);
        setSelectedPreset('0');
        setMessage('已删除预设。');
      };

      const presetOptions = [{ value: '0', label: '官方默认' }].concat(
        presets.map((p, i) => ({ value: String(i + 1), label: p.name }))
      );

      return React.createElement(
        'div',
        { style: { padding: '4px 2px', maxWidth: '560px' } },
        React.createElement('h3', { style: { margin: '4px 0 16px', fontSize: '15px' } }, '主页美化'),

        React.createElement('div', { style: { ...labelStyle, fontSize: '12px', opacity: 0.7 } }, '预设'),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' } },
          React.createElement('select', {
            style: selectStyle, value: selectedPreset,
            onChange: (e) => setSelectedPreset(e.target.value)
          }, presetOptions.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label))),
          React.createElement('button', { style: smallButtonStyle, type: 'button', onClick: applyPreset }, '应用'),
          presets.length > 0 && Number(selectedPreset) > 0
            ? React.createElement('button', { style: smallButtonStyle, type: 'button', onClick: deletePreset }, '删除')
            : null
        ),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          React.createElement('input', {
            style: inputStyle, value: presetName, placeholder: '预设名称(留空自动编号)',
            onInput: (e) => setPresetName(e.target.value)
          }),
          React.createElement('button', { style: smallButtonStyle, type: 'button', onClick: savePreset }, '保存当前为预设')
        ),

        React.createElement('div', { style: { ...labelStyle, fontSize: '12px', opacity: 0.7, marginTop: '18px' } }, '文字'),
        React.createElement(Field, {
          label: '标题文字', value: draft.headlineText, placeholder: '留空 = 默认「探索未至之境」',
          onInput: (v) => patch({ headlineText: v })
        }),
        React.createElement(ColorField, {
          label: '标题颜色', value: draft.headlineColor, presets: HEADLINE_PRESETS,
          onChange: (v) => patch({ headlineColor: v })
        }),
        React.createElement(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '13px', cursor: 'pointer' } },
          React.createElement('input', {
            type: 'checkbox', checked: draft.hideLogo === true,
            onChange: (e) => patch({ hideLogo: e.target.checked })
          }),
          '隐藏标题前的小鱼 Logo'
        ),
        React.createElement(SliderRow, {
          label: '标题字号', value: draft.headlineSize, min: 16, max: 72, step: 1,
          suffix: 'px', onChange: (v) => patch({ headlineSize: v })
        }),
        React.createElement(SliderRow, {
          label: '输入框高度(调细长)', value: draft.composerHeight == null ? 88 : draft.composerHeight,
          min: 44, max: 160, step: 2, suffix: 'px',
          onReset: draft.composerHeight == null ? undefined : () => patch({ composerHeight: null }),
          onChange: (v) => patch({ composerHeight: v })
        }),

        React.createElement('div', { style: { ...labelStyle, fontSize: '12px', opacity: 0.7, marginTop: '18px' } }, '输入框'),
        React.createElement(ColorField, {
          label: '输入框颜色', value: draft.cardColor, presets: CARD_PRESETS, allowAlpha: true,
          hint: '色板是半透明色调,深浅色主题都合适;也可用色轮自定义。',
          onChange: (v) => patch({ cardColor: v })
        }),

        React.createElement('div', { style: { ...labelStyle, fontSize: '12px', opacity: 0.7, marginTop: '18px' } }, '布局(拖动方块实时预览)'),
        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' } },
          React.createElement('span', { style: { fontSize: '13px', flex: 'none', width: '88px' } }, '垂直对齐'),
          React.createElement('select', {
            style: selectStyle, value: draft.vAlign || 'center',
            onChange: (e) => patch({ vAlign: e.target.value })
          },
          React.createElement('option', { value: 'center' }, '居中'),
          React.createElement('option', { value: 'top' }, '靠上'),
          React.createElement('option', { value: 'bottom' }, '靠下(贴底)'))
        ),
        React.createElement(LayoutStage, { draft, onPatch: patch }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          React.createElement('button', {
            type: 'button', style: smallButtonStyle,
            onClick: () => patch({ cardMaxWidth: 0 }), title: '恢复默认宽度'
          }, '默认宽'),
          React.createElement(SliderRow, {
            label: '输入框宽度', value: draft.cardMaxWidth > 0 ? draft.cardMaxWidth : 832,
            min: 320, max: 2000, step: 10, suffix: 'px',
            onChange: (v) => patch({ cardMaxWidth: v })
          })
        ),
        React.createElement('div', { style: hintStyle }, '宽度「默认宽」= 官方默认;方块拖动范围表示舞台可见范围,更大偏移用滑杆。'),
        React.createElement(SliderRow, {
          label: '标题-输入框距离', value: draft.headlineGap == null ? 0 : draft.headlineGap,
          min: -40, max: 120, step: 2, suffix: 'px',
          onReset: draft.headlineGap == null ? undefined : () => patch({ headlineGap: null }),
          onChange: (v) => patch({ headlineGap: v })
        }),
        React.createElement(SliderRow, {
          label: '水平偏移', value: draft.offsetX, min: -300, max: 300, step: 2,
          suffix: 'px', onChange: (v) => patch({ offsetX: v })
        }),
        React.createElement(SliderRow, {
          label: '垂直偏移', value: draft.offsetY, min: -400, max: 400, step: 2,
          suffix: 'px', onChange: (v) => patch({ offsetY: v })
        }),

        React.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' } },
          React.createElement('button', { style: buttonStyle, type: 'button', onClick: save }, '保存'),
          React.createElement('button', { style: buttonStyle, type: 'button', onClick: reset }, '恢复默认'),
          message ? React.createElement('span', { style: hintStyle }, message) : null
        ),
        React.createElement('div', { style: { ...hintStyle, marginTop: '6px' } }, '提示:修改在主页实时预览,点「保存」才永久生效;关闭设置页会放弃未保存的修改。应用预设会直接保存生效。')
      );
    }

    // ------------------------------------------------------------------
    // apply
    // ------------------------------------------------------------------

    function apply(ctx) {
      // Scoped stylesheet via a plain <style> element (DOM access is
      // guaranteed; the `styles` builtin is not delivered to dynamic
      // client halves as a free symbol).
      let styleEl = null;
      const applyCss = () => {
        if (styleEl != null) styleEl.remove();
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-dshd-hero-decor', '');
        styleEl.textContent = `${BASE_CSS}\n${buildCss(effectiveConfig())}`;
        document.head.appendChild(styleEl);
      };
      ctx.effect(() => {
        applyCss();
        return () => {
          if (styleEl != null) styleEl.remove();
          styleEl = null;
        };
      }, 'hero-decor: stylesheet');

      ctx.effect(() => {
        const onPreview = (e) => {
          liveDraft = (e && e.detail) || null;
          applyCss();
          runFixups();
        };
        const onPreviewEnd = () => {
          liveDraft = null;
          applyCss();
          runFixups();
        };
        const reapply = () => {
          applyCss();
          runFixups();
        };
        window.addEventListener(PREVIEW_EVENT, onPreview);
        window.addEventListener(PREVIEW_END_EVENT, onPreviewEnd);
        window.addEventListener(CHANGE_EVENT, reapply);
        return () => {
          window.removeEventListener(PREVIEW_EVENT, onPreview);
          window.removeEventListener(PREVIEW_END_EVENT, onPreviewEnd);
          window.removeEventListener(CHANGE_EVENT, reapply);
        };
      }, 'hero-decor: change listeners');

      // Outermost wrapper layer around the conversation scroll body.
      ctx.effect(
        () => ctx.slots.inject('conversation.hero.frame', () => ctx.slots.register(
          { name: 'conversation.hero.frame', id: 'hero-decor-frame', order: 100 },
          HeroFrame
        )),
        'hero-decor: hero frame'
      );

      // Settings page.
      ctx.effect(
        () => ctx.slots.inject('settings.section', () => ctx.slots.register(
          { name: 'settings.section', id: 'hero-decor', order: 60, label: '主页美化' },
          SettingsSection
        )),
        'hero-decor: settings section'
      );
    }

    return {
      inject: ['slots'],
      apply
    };
  }
});
