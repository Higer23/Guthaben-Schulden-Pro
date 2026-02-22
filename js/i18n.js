/**
 * i18n.js
 * =======
 * Internationalisierungsmodul — Ausschließlich Deutsch (DE)
 * Alle anderen Sprachen wurden entfernt.
 */

const TRANSLATIONS = {
  // ─── Kopfzeile ────────────────────────────────────────────
  streak:         'Streak',
  highscore:      'Highscore',
  rules:          'Regeln',
  points:         'Punkte',
  you:            'DU',
  computer:       'COMPUTER',

  // ─── Navigation ───────────────────────────────────────────
  tab_game:        'Spiel',
  tab_stats:       'Statistik',
  tab_tickets:     'Tickets',
  tab_leaderboard: 'Rangliste',
  tab_friends:     'Freunde',
  tab_calculator:  'Rechner',
  tab_minigame:    'Mathe-Blitz',

  // ─── Spiel-UI ─────────────────────────────────────────────
  your_turn:         '● DEIN ZUG',
  comp_turn:         '● AM ZUG',
  your_turn_badge:   'DEIN ZUG',
  check:             'PRÜFEN',
  your_expression:   'DEIN AUSDRUCK',
  new_balance:       'NEUER STAND',
  thinking:          'Computer denkt nach…',
  game_log:          'Spielverlauf',
  no_moves:          'Noch keine Züge gespielt.',
  achievements:      'Abzeichen',
  new_game:          'Neues Spiel',

  // ─── Aktion / Typ ─────────────────────────────────────────
  nehmen:        'NEHMEN',
  abgeben:       'ABGEBEN',
  positiv:       'POSITIV',
  negativ:       'NEGATIV',
  action_take:   'Nehmen',
  action_give:   'Abgeben',
  item_positive: 'Positive',
  item_negative: 'Negative',

  // ─── Regeln ───────────────────────────────────────────────
  rules_title:        'Spielregeln',
  rules_subtitle:     'Verstehe die Magie hinter positiven und negativen Zahlen.',
  rules_concept:      'Das Grundprinzip',
  rules_concept_text: 'Stell dir vor, du hast zwei Arten von Tickets: Positive Tickets (+1€) und Negative Tickets (-1€). Dein Kontostand bestimmt sich durch die Summe aller Tickets, die du besitzt.',
  rules_scenarios:    'Die vier Szenarien',
  rules_math_rule:    'Die Mathematische Regel',
  start_game:         'Spiel starten!',

  // ─── Statistik ────────────────────────────────────────────
  stat_correct:    'Richtige Antworten',
  stat_accuracy:   'Genauigkeit',
  stat_max_streak: 'Bester Streak',
  stat_games:      'Spiele gespielt',
  accuracy_chart:  'Genauigkeitsverlauf',
  ops_chart:       'Operationsverteilung',
  heatmap:         'Schwierigkeits-Heatmap',
  heatmap_desc:    'Zeigt, welche Kombinationen am häufigsten falsch beantwortet werden',
  reset_stats:     'Statistiken zurücksetzen',

  // ─── Ticket-Stack ─────────────────────────────────────────
  ticket_stack_title: 'Visueller Ticket-Stack',
  ticket_stack_desc:  'Beobachte, wie Tickets in dein Konto fließen oder abgehen.',
  your_stack:         'Dein Ticket-Stack',
  stack_empty:        'Noch keine Tickets',
  positive_ticket:    'Positive Tickets',
  negative_ticket:    'Negative Tickets',

  // ─── Rückmeldung ──────────────────────────────────────────
  correct:      'Richtig!',
  wrong:        'Falsch!',
  great_job:    'Sehr gut!',
  almost:       'Fast!',
  perfect:      'Perfekt!',
  keep_going:   'Weiter so!',

  // ─── Auth ─────────────────────────────────────────────────
  login:         'Anmelden',
  register:      'Registrieren',
  username:      'Benutzername',
  password:      'Passwort',
  email:         'E-Mail',
  logout:        'Abmelden',
  guest:         'Als Gast spielen',
  no_account:    'Noch kein Konto?',
  has_account:   'Bereits ein Konto?',

  // ─── Allgemein ────────────────────────────────────────────
  loading:       'Wird geladen…',
  save:          'Speichern',
  cancel:        'Abbrechen',
  close:         'Schließen',
  send:          'Senden',
  edit:          'Bearbeiten',
  delete:        'Löschen',
  confirm:       'Bestätigen',
  back:          'Zurück',
  next:          'Weiter',
  done:          'Fertig',
  error:         'Fehler',
  success:       'Erfolg',
  warning:       'Warnung',
  info:          'Information',

  // ─── Rangliste ────────────────────────────────────────────
  rank:          'Rang',
  player:        'Spieler',
  score:         'Punkte',
  level:         'Level',
  games:         'Spiele',
  no_entries:    'Noch keine Einträge.',

  // ─── Freunde / Chat ───────────────────────────────────────
  friends:           'Freunde',
  add_friend:        'Freund hinzufügen',
  friend_requests:   'Freundschaftsanfragen',
  no_friends:        'Noch keine Freunde hinzugefügt.',
  send_message:      'Nachricht senden',
  type_message:      'Nachricht eingeben…',
  chat_with:         'Chat mit',
  online:            'Online',
  offline:           'Offline',

  // ─── Rechner ─────────────────────────────────────────────
  calculator:       'Taschenrechner',
  scientific:       'Wissenschaftlich',
  basic:            'Grundlegend',
  history:          'Verlauf',
  clear_history:    'Verlauf leeren',
  no_history:       'Kein Verlauf',

  // ─── Tägliche Belohnung ───────────────────────────────────
  daily_reward:      'Tagesbonus',
  daily_claim:       'Heute einloggen!',
  daily_claimed:     'Heute bereits beansprucht',
  reward_points:     'Bonuspunkte erhalten',
  login_streak:      'Login-Serie',
  come_back:         'Komm morgen wieder!',
};

// ─── Übersetzungsfunktion ────────────────────────────────────────────────────
export function t(key, fallback) {
  return TRANSLATIONS[key] ?? fallback ?? key;
}

// ─── Initialisierung ─────────────────────────────────────────────────────────
export function initI18n() {
  document.documentElement.lang = 'de';
  applyTranslations();
}

// ─── Dummy setLang (Kompatibilität, nur DE) ──────────────────────────────────
export function setLang(lang) {
  // Nur Deutsch unterstützt — keine Aktion nötig
  console.info('[i18n] Nur Deutsch (DE) wird unterstützt.');
}

// ─── Übersetzungen auf DOM anwenden ─────────────────────────────────────────
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (TRANSLATIONS[key]) el.textContent = TRANSLATIONS[key];
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (TRANSLATIONS[key]) el.placeholder = TRANSLATIONS[key];
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (TRANSLATIONS[key]) el.title = TRANSLATIONS[key];
  });
}
