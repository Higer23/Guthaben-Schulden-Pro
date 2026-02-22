/**
 * i18n.js
 * =======
 * Lightweight Internationalization Engine
 * Supports: de (Deutsch), tr (Türkçe) — EN kaldırıldı (HATA 6)
 * FIXES:
 *   HATA 6  : EN dil desteği kaldırıldı — sadece DE/TR
 *   HATA 21 : initI18n() ve setLang() — document.documentElement.lang set ediliyor
 */

const TRANSLATIONS = {
  de: {
    // Header
    streak:    'Streak',
    highscore: 'Highscore',
    rules:     'Regeln',
    points:    'Punkte',
    // Tabs
    tab_game:     'Spiel',
    tab_stats:    'Statistik',
    tab_tickets:  'Ticket-Stack',
    tab_leaderboard: 'Rangliste',
    tab_friends:  'Freunde',
    // Game UI
    your_account:   'Dein Konto',
    balance:        'Kontostand',
    your_turn:      '● DEIN ZUG',
    computer:       'Computer',
    comp_turn:      '● AM ZUG',
    current_task:   'Aktuelle Aufgabe',
    your_turn_badge:'Dein Zug',
    instruction:    'Anweisung',
    expression_label:'Mathematischer Ausdruck',
    expression_hint: 'Schreibe den Ausdruck wie: <code>-(-5)</code>',
    balance_label:  'Neuer Kontostand',
    balance_hint:   'Dein neues Guthaben',
    check_btn:      'Prüfen',
    thinking:       'Computer denkt nach...',
    game_log:       'Spielverlauf',
    no_moves:       'Noch keine Züge gespielt.',
    achievements:   'Abzeichen',
    quick_ref:      'Schnellreferenz',
    new_game:       'Neues Spiel',
    // FIX HATA 14 — action/itemType keys
    nehmen:         'NEHMEN',
    abgeben:        'ABGEBEN',
    positiv:        'POSITIV',
    negativ:        'NEGATIV',
    action_take:    'Nehmen',
    action_give:    'Abgeben',
    item_positive:  'Positive',
    item_negative:  'Negative',
    // Rules
    rules_title:         'Spielregeln',
    rules_subtitle:      'Verstehe die Magie hinter positiven und negativen Zahlen.',
    rules_concept:       'Das Grundprinzip',
    rules_concept_text:  'Stell dir vor, du hast zwei Arten von Tickets: Positive Tickets (+1€) und Negative Tickets (-1€). Dein Kontostand bestimmt sich durch die Summe aller Tickets.',
    rules_scenarios:     'Die vier Szenarien',
    rules_math_rule:     'Die Mathematische Regel',
    start_game:          'Spiel starten!',
    // Stats
    stat_correct:    'Richtige Antworten',
    stat_accuracy:   'Genauigkeit',
    stat_max_streak: 'Bester Streak',
    accuracy_chart:  'Fortschritt',
    ops_chart:       'Operationsverteilung',
    heatmap:         'Schwierigkeits-Heatmap',
    heatmap_desc:    'Zeigt, welche Kombinationen du am häufigsten falsch beantwortest',
    reset_stats:     'Statistiken zurücksetzen',
    // Ticket Stack
    ticket_stack_title: 'Visueller Ticket-Stack',
    ticket_stack_desc:  'Beobachte, wie Tickets in dein Konto fließen oder abgehen.',
    your_stack:    'Dein Ticket-Stack',
    stack_empty:   'Noch keine Tickets',
    simulate:      'Simulation',
    last_op:       'Letzte Operation',
    op_legend:     'Legende',
    positive_ticket: 'Positive Tickets',
    negative_ticket: 'Negative Tickets',
    // Feedback
    correct_title:   'Richtig! 🎉',
    incorrect_title: 'Nicht ganz...',
    // Misc
    level_up_msg:    'Level {{n}} erreicht!',
    new_high_score:  'Neuer Highscore!',
  },

  tr: {
    streak:    'Seri',
    highscore: 'En Yüksek',
    rules:     'Kurallar',
    points:    'Puan',
    tab_game:     'Oyun',
    tab_stats:    'İstatistik',
    tab_tickets:  'Bilet Yığını',
    tab_leaderboard: 'Sıralama',
    tab_friends:  'Arkadaşlar',
    your_account:   'Hesabın',
    balance:        'Bakiye',
    your_turn:      '● SENİN SIRAN',
    computer:       'Bilgisayar',
    comp_turn:      '● OYNUYOR',
    current_task:   'Mevcut Görev',
    your_turn_badge:'Senin Sıran',
    instruction:    'Talimat',
    expression_label:'Matematiksel İfade',
    expression_hint: 'İfadeyi şöyle yaz: <code>-(-5)</code>',
    balance_label:  'Yeni Bakiye',
    balance_hint:   'Yeni bakiyen',
    check_btn:      'Kontrol Et',
    thinking:       'Bilgisayar düşünüyor...',
    game_log:       'Oyun Kaydı',
    no_moves:       'Henüz hamle yok.',
    achievements:   'Rozetler',
    quick_ref:      'Hızlı Başvuru',
    new_game:       'Yeni Oyun',
    // FIX HATA 14
    nehmen:         'AL',
    abgeben:        'VER',
    positiv:        'POZİTİF',
    negativ:        'NEGATİF',
    action_take:    'Almak',
    action_give:    'Vermek',
    item_positive:  'Pozitif',
    item_negative:  'Negatif',
    // Rules
    rules_title:        'Oyun Kuralları',
    rules_subtitle:     'Pozitif ve negatif sayıların büyüsünü anla.',
    rules_concept:      'Temel Kavram',
    rules_concept_text: 'İki tür biletiniz olduğunu hayal edin: Pozitif Biletler (+1€) ve Negatif Biletler (-1€). Bakiyeniz, sahip olduğunuz tüm biletlerin toplamına göre belirlenir.',
    rules_scenarios:    'Dört Senaryo',
    rules_math_rule:    'Matematiksel Kural',
    start_game:         'Oyunu Başlat!',
    // Stats
    stat_correct:    'Doğru Cevaplar',
    stat_accuracy:   'Doğruluk',
    stat_max_streak: 'En İyi Seri',
    accuracy_chart:  'İlerleme',
    ops_chart:       'İşlem Dağılımı',
    heatmap:         'Zorluk Isı Haritası',
    heatmap_desc:    'En çok yanlış yaptığın kombinasyonları gösterir',
    reset_stats:     'İstatistikleri Sıfırla',
    // Ticket Stack
    ticket_stack_title: 'Görsel Bilet Yığını',
    ticket_stack_desc:  'Biletlerin hesabına nasıl girip çıktığını izle.',
    your_stack:    'Bilet Yığınınız',
    stack_empty:   'Henüz bilet yok',
    simulate:      'Simülasyon',
    last_op:       'Son İşlem',
    op_legend:     'Açıklama',
    positive_ticket: 'Pozitif Biletler',
    negative_ticket: 'Negatif Biletler',
    // Feedback
    correct_title:   'Doğru! 🎉',
    incorrect_title: 'Tam değil...',
    // Misc
    level_up_msg:    'Seviye {{n}} ulaşıldı!',
    new_high_score:  'Yeni En Yüksek Puan!',
  },
};

let _currentLang = 'de';

/**
 * @param {string} key
 * @param {Object} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const dict = TRANSLATIONS[_currentLang] ?? TRANSLATIONS.de;
  let str = dict[key] ?? TRANSLATIONS.de[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return str;
}

export function getLang() { return _currentLang; }

/**
 * FIX HATA 21: document.documentElement.lang set ediliyor.
 * FIX HATA 6: only 'de' and 'tr' are valid.
 * @param {'de'|'tr'} lang
 */
export function setLang(lang) {
  // FIX HATA 6 — only de/tr
  if (!TRANSLATIONS[lang]) lang = 'de';
  _currentLang = lang;
  localStorage.setItem('gleichgewicht_lang', lang);
  // FIX HATA 21
  document.documentElement.lang = lang;
  applyTranslations();
  updateLangButtons();
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

/**
 * FIX HATA 21: initI18n — document.documentElement.lang set ediliyor.
 */
export function initI18n() {
  const saved    = localStorage.getItem('gleichgewicht_lang');
  const browser  = navigator.language?.slice(0, 2)?.toLowerCase();
  // FIX HATA 6 — only allow de/tr, default de
  const detected = (saved && TRANSLATIONS[saved]) ? saved
                 : (browser === 'tr' ? 'tr' : 'de');
  _currentLang   = detected;
  // FIX HATA 21
  document.documentElement.lang = _currentLang;
  applyTranslations();
  updateLangButtons();
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.innerHTML = t(key);
  });
  // Update lang toggle button text
  const btn = document.getElementById('langToggle');
  if (btn) btn.textContent = _currentLang === 'tr' ? 'DE/TR 🇹🇷' : 'TR/DE 🇩🇪';
}

function updateLangButtons() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === _currentLang);
  });
}
