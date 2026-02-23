# ⚖️ Guthaben-Schulden-Spiel — Pro Edition

> **Pozitif ve negatif sayıları öğreten interaktif oyun — Firebase çevrimiçi, PWA çevrimdışı destekli**

[![Version](https://img.shields.io/badge/version-3.0.0--fixed-cyan)](#)
[![License](https://img.shields.io/badge/license-MIT-purple)](#)
[![PWA](https://img.shields.io/badge/PWA-ready-green)](#)
[![Bugs Fixed](https://img.shields.io/badge/bugs%20fixed-21%2B-red)](#bug-fixes)

---

## 🚀 Özellikler

- **6 Seviye** — Anfänger'den Meister'a ilerleme sistemi
- **Streak & Başarımlar** — 9 farklı rozet
- **Bilgisayar Rakip** — AI karşı oyuncu
- **İstatistik Dashboard** — Chart.js grafikler + heatmap
- **Firebase Auth** — kullanıcı adı/şifre ile giriş
- **PWA** — çevrimdışı oynanabilir (Service Worker)
- **DE/TR** — Almanca/Türkçe dil desteği
- **Lehrermodus** — öğretmen modu (timer, level kilitleme, spickzettel)
- **Leaderboard** — küresel sıralama
- **Admin Panel** — kullanıcı yönetimi, toplu mesaj

---

## 📁 Dosya Yapısı

```
gss-pro/
├── index.html          # Ana HTML (tüm UI)
├── css/
│   └── styles.css      # Özel stiller (glassmorphism, animasyonlar)
├── js/
│   ├── app.js          # ⭐ Ana giriş noktası — tüm oyun mantığı
│   ├── gameLogic.js    # Saf oyun mantığı (DOM'suz, test edilebilir)
│   ├── ui.js           # DOM ve animasyon katmanı
│   ├── stats.js        # İstatistik & grafik motoru
│   ├── i18n.js         # Çok dil desteği (DE/TR)
│   ├── audio.js        # Web Audio API ses sentezi
│   ├── storage.js      # LocalStorage + Firebase senkronizasyonu
│   ├── admin.js        # Admin paneli (kullanıcı yönetimi)
│   ├── auth.js         # Kimlik doğrulama
│   ├── social.js       # Leaderboard, arkadaşlar
│   └── firebase-config.js  # Firebase wrapper (GÜVENLİ)
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (çevrimdışı)
└── README.md           # Bu dosya
```

---

## ⚙️ Kurulum

### 1. Firebase Projesi Oluştur

1. [Firebase Console](https://console.firebase.google.com) → Yeni proje
2. **Realtime Database** → Oluştur → Test modda başlat
3. Proje Ayarları → Web app ekle → Config kopyala

### 2. firebase-config.js Güncelle

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIza...",
  authDomain:        "proje-id.firebaseapp.com",
  databaseURL:       "https://proje-id-default-rtdb.firebaseio.com",
  projectId:         "proje-id",
  storageBucket:     "proje-id.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123:web:abc",
};
```

### 3. Firebase Security Rules

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read":  "$uid === auth.uid || root.child('users').child(auth.uid).child('profile/isAdmin').val() === true",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('profile/isAdmin').val() === true"
      }
    },
    "users_by_username": {
      ".read":  true,
      ".write": "auth != null"
    },
    "leaderboard": {
      ".read":  true,
      ".write": "auth != null"
    }
  }
}
```

### 4. Web Sunucusu

```bash
# Python ile lokal çalıştırma
python3 -m http.server 8080
# veya
npx serve .
```

Tarayıcı: `http://localhost:8080`

---

## 🐛 Düzeltilen Hatalar

Bu sürüm, **21 kritik/orta ve 10+ ek** hatayı düzeltiyor:

### 🔴 Kritik Düzeltmeler (Oyun Çöküşü)

| # | Dosya | Hata | Düzeltme |
|---|-------|------|----------|
| 1 | app.js | `generateInstruction` yanlış çağrı | `generateInstruction(levelIndex, balance)` |
| 2 | app.js | `validateAnswer` parametre sırası | `(expression, balance, instruction)` |
| 3 | app.js | `computerPlay` yanlış argüman | `computerPlay(levelIndex, computerBalance)` |
| 4 | app.js | `calculateScore` parametre sırası | `(levelIndex, streak)` |
| 5 | app.js | `renderDashboard` argümansız | `renderDashboard(state)` |
| 11 | gameLogic.js | `validateAnswer` null crash | Null guard eklendi |
| 13 | ui.js | `renderInstruction` null crash | Null guard eklendi |
| 15 | stats.js | `updateStatCards` state undefined | `safeState` ile guard |
| 17 | admin.js | Firebase try-catch yok | Tüm async fonksiyonlar sarıldı |

### 🟡 Orta Düzeltmeler

| # | Hata | Düzeltme |
|---|------|----------|
| 6 | EN dili → 3 yönlü toggle | Sadece DE/TR |
| 7 | `recordAttempt` yanlış parametre | Tam `instruction` objesi |
| 8 | `recordSession` yanlış format | `{ correct, total, streak }` objesi |
| 9 | `isNegNeg` tracking yanlış | `.isNegNeg` property kullanımı |
| 10 | Event listener duplikasyonu | `replaceWith(clone)` pattern |
| 12 | `computerBalance` güncellenmez | `state.computerBalance = compResult.newComputerBal` |
| 14 | i18n dil desteği eksik | `t()` ile action/itemType metinleri |
| 16 | `renderHeatmap` argümansız | `loadStats()` fallback |
| 18 | Body scroll kilidi | `openAdminPanel`/`closeAdminPanel` |
| 19 | Admin pane ID uyumsuzluğu | `getElementById` ile seçim |
| 20 | `initAudio` return değeri | `boolean` döndürüyor |
| 21 | `document.documentElement.lang` | `initI18n()` ve `setLang()` set ediyor |

### 🔒 Güvenlik Düzeltmeleri

- **XSS Koruması**: Tüm user-input innerHTML'e `sanitize()` ile yazılıyor
- **getUserByUsername**: `users_by_username` index (tüm DB indirmeme)
- **Global window._fb\***: Modül scope'a taşındı

### 🐛 Ek Bug Düzeltmeleri

- `totalGamesPlayed` artık `createInitialState()`'de tanımlı
- Timer duplikasyonu: `startTimer()` önce `stopTimer()` çağırıyor
- `getInbox(uid) ?? {}` null guard
- `profileOverlay` flex class temizleniyor
- Crash screen `localStorage.removeItem('gss_save_v3')` ile yeniden başlıyor
- Offline banner duplikasyon koruması

---

## 🎮 Oyun Kuralları

Oyun dört işlem kombinasyonu üretir:

| İşlem | Matematiksel Anlam |
|-------|-------------------|
| `+(+n)` — Nehmen Positiv | `+n` |
| `+(-n)` — Nehmen Negativ | `-n` |
| `-(+n)` — Abgeben Positiv | `-n` |
| `-(-n)` — Abgeben Negativ | `+n` ✨ |

Oyuncular hem **matematiksel ifadeyi** (`-(-5)`) hem de **yeni bakiyeyi** (`7`) doğru girmeli.

---

## 🔐 Güvenlik Notları

> ⚠️ **Prodüksiyona almadan önce:**

1. `auth.js`'teki admin şifresini environment variable'a taşı
2. Firebase Security Rules'u ayarla (yukarıdaki örneği kullan)
3. Şifre hash'leme: bu sürümde SHA-256 kullanılıyor — prodüksiyon için **bcrypt** öner
4. HTTPS zorunlu (PWA ve Firebase gerektiriyor)

---

## 📊 Teknik Mimari

```
index.html
    │
    └── js/app.js (ES Module, type="module")
           ├── gameLogic.js  (saf logic, DOM'suz)
           ├── ui.js          (DOM + RAF animasyonlar)
           ├── stats.js       (Chart.js dashboard)
           ├── i18n.js        (DE/TR çeviri)
           ├── audio.js       (Web Audio API)
           ├── storage.js     (LocalStorage + Firebase)
           ├── auth.js        (giriş/kayıt)
           ├── admin.js       (admin paneli)
           ├── social.js      (leaderboard/arkadaşlar)
           └── firebase-config.js (DB wrapper)
```

---

## 🛠️ Geliştirici Notları

### Yeni Seviye Eklemek

`gameLogic.js` → `LEVELS` dizisine ekle:
```js
{ level: 7, name: 'Grand Master', range: [1, 50], streakRequired: 30, scorePerCorrect: 75 }
```

### Yeni Başarım Eklemek

`gameLogic.js` → `ACHIEVEMENTS` dizisine ekle:
```js
{ id: 'score_1000', name: '1000 Punkte', icon: '💯', description: '1000 Punkte!',
  condition: (s) => s.score >= 1000 }
```

### Yeni Dil Eklemek

`i18n.js` → `TRANSLATIONS` objesine ekle:
```js
fr: { nehmen: 'PRENDRE', abgeben: 'DONNER', ... }
```
`app.js` lang toggle'ı güncelle: `curr === 'de' ? 'tr' : curr === 'tr' ? 'fr' : 'de'`

---

## 📝 Lisans

MIT License — Özgürce kullanın, değiştirin, dağıtın.

---

*Made with ❤️ by Higer · Firebase Pro Edition · 2025*
