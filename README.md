# Guthaben-Schulden-Spiel · Pro Edition (Firebase)

## 🔥 Firebase Kurulum Talimatları (ÜCRETSİZ)

### 1. Firebase Hesabı Oluştur
1. https://console.firebase.google.com adresine git
2. Google hesabınla giriş yap
3. **"Proje Ekle"** butonuna tıkla
4. Proje adı gir: `guthaben-schulden-spiel`
5. Google Analytics'i devre dışı bırakabilirsin (isteğe bağlı)
6. **"Projeyi Oluştur"** tıkla

---

### 2. Realtime Database Oluştur (ÜCRETSİZ)
1. Sol menüden **Build → Realtime Database** seç
2. **"Veritabanı Oluştur"** tıkla
3. Konum seç: **Europe-West1** (Avrupa)
4. **Test Modu**nda başla (sonra güvenli yapacağız)
5. **"Etkinleştir"** tıkla

> ⚠️ Firebase Storage KULLANILMIYOR — sadece Realtime Database (tamamen ücretsiz Spark planında çalışır)

---

### 3. Web Uygulaması Ekle
1. Proje ana sayfasında **`</>`** (Web) ikonuna tıkla
2. Uygulama takma adı: `gss-web`
3. Firebase Hosting'i **İŞARETLEME** (gerek yok, ücretsiz değil)
4. **"Uygulama Kaydet"** tıkla
5. Gösterilen `firebaseConfig` nesnesini kopyala:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "proje-id.firebaseapp.com",
  databaseURL: "https://proje-id-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "proje-id",
  storageBucket: "",   // BOŞ BIRAK
  messagingSenderId: "123456789",
  appId: "1:123:web:abc..."
};
```

---

### 4. Config Dosyasını Güncelle

`js/firebase-config.js` dosyasını aç ve **kendi değerlerinle değiştir**:

```javascript
export const FIREBASE_CONFIG = {
  apiKey:            "buraya_kendi_apiKey_yaz",
  authDomain:        "buraya_kendi_authDomain_yaz",
  databaseURL:       "buraya_kendi_databaseURL_yaz",  // ÖNEMLİ!
  projectId:         "buraya_kendi_projectId_yaz",
  storageBucket:     "",   // BOŞ BIRAK — Storage ücretli
  messagingSenderId: "buraya_kendi_messagingSenderId_yaz",
  appId:             "buraya_kendi_appId_yaz",
};
```

---

### 5. Database Güvenlik Kuralları

Firebase Console → Realtime Database → **Kurallar** sekmesine git ve yapıştır:

```json
{
  "rules": {
    "guthaben-schulden-spiel-db": {
      "users": {
        "$uid": {
          ".read": "$uid === auth.uid || root.child('guthaben-schulden-spiel-db/users').child(auth.uid).child('profile/isAdmin').val() === true",
          ".write": "$uid === auth.uid || root.child('guthaben-schulden-spiel-db/users').child(auth.uid).child('profile/isAdmin').val() === true"
        }
      },
      "admin": {
        ".read": "root.child('guthaben-schulden-spiel-db/users').child(auth.uid).child('profile/isAdmin').val() === true",
        ".write": "root.child('guthaben-schulden-spiel-db/users').child(auth.uid).child('profile/isAdmin').val() === true"
      }
    }
  }
}
```

> **Not:** Bu proje Firebase Authentication KULLANMIYORa (ücretli değil). Kullanıcılar Realtime Database üzerinden kendi şifrelerini saklar. Güvenlik kuralları şimdilik test modunda açık.

---

### 6. Uygulamayı Çalıştır

**CORS nedeniyle doğrudan `index.html` açamazsın!** Yerel sunucu gerekir:

#### Seçenek A: VS Code Live Server
- VS Code'da `index.html`'e sağ tıkla → **"Open with Live Server"**

#### Seçenek B: Python HTTP Server
```bash
cd /proje-klasoru
python3 -m http.server 8080
# Sonra: http://localhost:8080
```

#### Seçenek C: Node.js
```bash
npx serve .
```

---

### 7. Admin Girişi

| Kullanıcı Adı | Şifre         |
|---------------|---------------|
| `Halil`       | `19105887638` |

Admin ile giriş yapınca sağ üstte **"Admin"** butonu görünür.

---

## 📁 Dosya Yapısı

```
Guthaben-Schulden-Spiel/
├── index.html              # Ana sayfa (Auth + Oyun)
├── css/
│   └── styles.css          # Stiller (Dark/Light mode)
├── js/
│   ├── firebase-config.js  # 🔴 Firebase config + DB işlemleri
│   ├── auth.js             # Login/Signup/Device detection
│   ├── admin.js            # Admin paneli
│   ├── social.js           # Leaderboard/Arkadaşlar/Bildirimler
│   ├── storage.js          # Local + Firebase sync
│   ├── app.js              # Ana oyun mantığı
│   ├── gameLogic.js        # Oyun algoritması
│   ├── ui.js               # UI render
│   ├── i18n.js             # Çoklu dil
│   ├── audio.js            # Ses sistemi
│   └── stats.js            # İstatistikler
├── icons/                  # PWA ikonları
├── manifest.json           # PWA manifest
└── sw.js                   # Service Worker
```

---

## ✨ Özellikler

- 🔐 **Kullanıcı Auth** — Login/Signup (Firebase Realtime DB)
- 📱 **Akıllı Cihaz Tespiti** — Browser, OS, IP, %50 eşik uyarısı
- 👑 **Admin Paneli** — Tam kullanıcı yönetimi
- 🏆 **Leaderboard** — Puan/Streak/Seviye sıralaması
- 👫 **Arkadaş Sistemi** — Ekle, meydan oku
- 🔔 **Bildirim Sistemi** — In-app gerçek zamanlı
- 👤 **Profil Sayfası** — Avatar, biyografi, tema
- 🌙☀️ **Dark/Light Mode** — Firebase'e kaydedilir
- 📊 **Gelişmiş İstatistikler** — Chart.js grafikler
- 📤 **Veri Dışa Aktarma** — GDPR uyumlu JSON
- ✉️ **Admin Mesajlaşma** — Login'de gelen kutusunu göster
- 🎮 **Çevrimdışı Mod** — Firebase olmadan oynanabilir

---

## 💰 Ücretli mi?

**HAYIR!** Firebase Spark (ücretsiz) planı yeterlidir:
- Realtime Database: 1GB depolama, 10GB/ay transfer ✅
- Firebase Storage: **KULLANILMIYOR** ❌
- Firebase Authentication: **KULLANILMIYOR** ❌
- Hosting: **KULLANILMIYOR** ❌

---

*Guthaben-Schulden-Spiel · Pro Edition — Made by Higer*
