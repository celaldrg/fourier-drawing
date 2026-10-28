/**
 * English and Turkish UI strings plus a tiny lookup helper. Pure data, no DOM access.
 */
export const LANGS = Object.freeze(['en', 'tr']);

const STRINGS = {
  en: {
    'app.title': 'Fourier Drawing',
    'app.tagline': 'Any closed shape, drawn by spinning circles',
    'header.reset': 'Reset',
    'header.resetAria': 'Restart the trace',
    'header.langAria': 'TR: switch to Turkish',
    'footer.source': 'Source on GitHub',
    'stage.aria': 'Epicycle canvas. In draw mode, draw a closed shape with your finger or the mouse.',
    'stage.drawHint': 'Draw a closed shape — lift to finish',
    'stage.drawShort': 'Too short — draw a bigger shape',
    'btn.play': 'Play',
    'btn.pause': 'Pause',
    'btn.draw': 'Draw',
    'btn.cancel': 'Cancel',
    'btn.controls': 'Controls',
    'terms.label': 'Terms (K)',
    'terms.value': '{k} of {n} · {energy}% energy',
    'stats.line': 'N = {n} · RMS error {rms}',
    'speed.label': 'Speed',
    'speed.value': '{v}×',
    'samples.label': 'Sample points (N)',
    'view.title': 'View',
    'view.circles': 'Circles and arms',
    'view.original': 'Original shape',
    'sort.title': 'Order of circles',
    'sort.amplitude': 'By size',
    'sort.frequency': 'By frequency',
    'presets.title': 'Shapes',
    'svg.title': 'Paste SVG path',
    'svg.placeholder': 'M10 10 L190 10 L100 180 Z',
    'svg.load': 'Load path',
    'svg.error': 'That path could not be read.',
    'svg.ok': 'Path loaded.',
    'chart.title': 'Amplitudes',
    'chart.aria': 'Bar chart of the largest circle radii; the ones in use are highlighted.',
    'share.title': 'Share and export',
    'share.link': 'Copy share link',
    'share.copied': 'Link copied to the clipboard.',
    'share.inUrl': 'Link is in the address bar.',
    'export.svg': 'Export SVG',
    'export.done': 'SVG downloaded.',
    'keys.title': 'Keyboard',
    'keys.text': 'Space play/pause · ←/→ terms (Shift ×10) · R reset · D draw',
    'shape.star': 'Star',
    'shape.heart': 'Heart',
    'shape.spiral': 'Spiral',
    'shape.fish': 'Fish',
    'shape.house': 'House',
    'shape.leaf': 'Leaf',
    'shape.cat': 'Cat',
    'shape.squiggle': 'Squiggle',
    'shape.note': 'Note',
    'shape.bolt': 'Bolt',
    'shape.custom': 'Custom',
    'doc.description': 'Draw any closed shape and watch a chain of rotating circles retrace it with the Fourier transform.',
  },
  tr: {
    'app.title': 'Fourier Çizimi',
    'app.tagline': 'Her kapalı şekil, dönen çemberlerle çizilir',
    'header.reset': 'Sıfırla',
    'header.resetAria': 'Çizimi baştan başlat',
    'header.langAria': 'EN: İngilizceye geç',
    'footer.source': "GitHub'da kaynak kod",
    'stage.aria': 'Episikl tuvali. Çizim modunda parmağınla ya da fareyle kapalı bir şekil çiz.',
    'stage.drawHint': 'Kapalı bir şekil çiz — bitirmek için bırak',
    'stage.drawShort': 'Çok kısa — daha büyük bir şekil çiz',
    'btn.play': 'Oynat',
    'btn.pause': 'Duraklat',
    'btn.draw': 'Çiz',
    'btn.cancel': 'Vazgeç',
    'btn.controls': 'Ayarlar',
    'terms.label': 'Terim sayısı (K)',
    'terms.value': '{k} / {n} · enerjinin %{energy}',
    'stats.line': 'N = {n} · RMS hata {rms}',
    'speed.label': 'Hız',
    'speed.value': '{v}×',
    'samples.label': 'Örnek nokta (N)',
    'view.title': 'Görünüm',
    'view.circles': 'Çemberler ve kollar',
    'view.original': 'Asıl şekil',
    'sort.title': 'Çember sırası',
    'sort.amplitude': 'Boyuta göre',
    'sort.frequency': 'Frekansa göre',
    'presets.title': 'Şekiller',
    'svg.title': 'SVG yolu yapıştır',
    'svg.placeholder': 'M10 10 L190 10 L100 180 Z',
    'svg.load': 'Yolu yükle',
    'svg.error': 'Bu yol okunamadı.',
    'svg.ok': 'Yol yüklendi.',
    'chart.title': 'Genlikler',
    'chart.aria': 'En büyük çember yarıçaplarının çubuk grafiği; kullanılanlar vurgulu.',
    'share.title': 'Paylaş ve dışa aktar',
    'share.link': 'Paylaşım bağlantısını kopyala',
    'share.copied': 'Bağlantı panoya kopyalandı.',
    'share.inUrl': 'Bağlantı adres çubuğunda.',
    'export.svg': 'SVG indir',
    'export.done': 'SVG indirildi.',
    'keys.title': 'Klavye',
    'keys.text': 'Boşluk oynat/duraklat · ←/→ terim (Shift ×10) · R sıfırla · D çiz',
    'shape.star': 'Yıldız',
    'shape.heart': 'Kalp',
    'shape.spiral': 'Sarmal',
    'shape.fish': 'Balık',
    'shape.house': 'Ev',
    'shape.leaf': 'Yaprak',
    'shape.cat': 'Kedi',
    'shape.squiggle': 'Dalga',
    'shape.note': 'Nota',
    'shape.bolt': 'Şimşek',
    'shape.custom': 'Özel',
    'doc.description': 'Kapalı bir şekil çiz, dönen çemberler zinciri onu Fourier dönüşümüyle yeniden çizsin.',
  },
};

/**
 * Normalise a language code to a supported one.
 * @param {string | null | undefined} lang
 * @returns {'en' | 'tr'}
 */
export function normalizeLang(lang) {
  return lang === 'tr' ? 'tr' : 'en';
}

/**
 * Translate a key, filling "{name}" placeholders from vars. Falls back to English, then to the key.
 * @param {string} lang
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 * @returns {string}
 */
export function translate(lang, key, vars = {}) {
  const table = STRINGS[normalizeLang(lang)];
  const text = table[key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/**
 * All keys of a language table (used by tests to check both languages match).
 * @param {string} lang
 * @returns {string[]}
 */
export function keysOf(lang) {
  return Object.keys(STRINGS[normalizeLang(lang)]);
}
