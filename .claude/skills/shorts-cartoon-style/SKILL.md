---
name: shorts-cartoon-style
description: Recipe for vertical 9:16 cartoon Shorts/Reels in the "Spesifik Kayseri" style - sunburst title card, flat vector scenes, talking characters with lip-sync and speech bubbles, keyword-highlighted captions, whoosh/pop SFX and a confetti "TAKİP ET" end card - using video-toolkit/ (DiceBear, Rhubarb, sfx-kit, Noto emoji, confetti). Use for any Short, Reel, TikTok or "ne olurdu?" style humor clip.
---

# Çizgi film tarzı Shorts tarifi

Önce `video-toolkit/install.sh` çalıştır (yaklaşık 30 sn). Katalog: `video-toolkit/README.md`. Genel akış ve kalite ölçütü `tr-video-production` skill'inde.

## Format
- **Görüntü:** 1080×1920, 30 fps, 20–45 sn.
- **Güvenli alan:** başlıklar üst 1/3'te. Altyazılar alttan yaklaşık %25 yukarıda (YouTube arayüzü altta yer kaplar).
- **Filigran:** kanal adı, üstte küçük ve yarı saydam.

## Sahne yapısı
1. **Kanca (0–3 sn):** lacivert zemin, dönen ışık hüzmeleri (radyal üçgenler, yavaş dönüş).
   - Başlık: büyük harf, Anton/Bebas, beyaz; bir kelime vurgulu olabilir.
   - Kelimeler sırayla "pop" ile girer: ölçek 1.3'ten 1'e, ease-out-back.
   - Her kelimede `sfx/sounds/pops/` veya `swishes-and-zips/` sesi.
2. **Hikâye sahneleri (her biri 2–4 sn):** düz renkli vektör mekânlar (tramvay, kahvehane, çarşı, Erciyes).
   - Gölgesiz, sınırlı palet: lacivert, turuncu, krem ve 1–2 vurgu rengi.
   - Kamerada hafif zoom veya pan.
   - Geçişte `whooshes/whoosh-fast-*` sesi. Sesin `sync` değeri, hareketin en hızlı anına denk gelmeli (`sfx/sounds.json`).
3. **Karakterler:**
   - Hızlı yol: DiceBear `avataaars` veya `open-peeps` (CC0), tohum = karakter adı.
   - Hikâyeye özel karakter (kasketli amca vb.): katmanlı SVG kukla. Gövde, kafa, kaş, göz ve ağız ayrı parçalar.
   - Ağız: `vendor/rhubarb/rhubarb -r phonetic -f json ses.wav` çıktısındaki A–H ve X şekilleri, zamanına göre değiştirilir.
   - Hareket: göz kırpma (3–5 sn'de bir, 0,12 sn), konuşurken hafif kafa sallanması. Kızgınlıkta kaşlar içe eğik.
4. **Konuşma balonu:** krem renk, yuvarlak köşe, kuyruğu karaktere bakar.
   - "Pop" ile açılır: ölçek 0'dan 1'e, ease-out-back, 0,25 sn. Yanında `appear-and-vanish` veya `pops` sesi.
   - Metnin son kelimesi turuncu. Sonuna emoji: `video-toolkit/emoji/emoji_u<kod>.svg`.
5. **Altyazı:**
   - Kalın beyaz (Poppins ExtraBold / Baloo 2), ince koyu kontur ve gölge, iki satıra kadar.
   - Her cümlede 1 anahtar kelime turuncu (#FF8A1F).
   - Kelime zamanlaması: TTS'te cümle süresinden; gerçek seste Whisper (sherpa-onnx) ile cümle zamanı alınır, kelimelere harf sayısına göre bölünür.
6. **Kapanış (son 3–4 sn):** turuncu yuvarlak "👤+ TAKİP ET" butonu.
   - Buton pop + nefes alma animasyonu yapar; arkada ışık hüzmeleri, üstten yağan konfeti (`canvas-confetti` mantığı).
   - İki emojili çağrı satırı: "Bir Kayseriliye gönder 📤", "Mahalleni yorumlara yaz 👇".
   - Sesler: `celebration/` ve `notifications/`.

## Ses
- **Seslendirme:**
  - Varsa kullanıcı kaydı; görüntü `build_warp.py` ile hizalanır.
  - Yoksa TTS: Piper (çevrimdışı) ya da kullanıcı onayıyla Edge TTS / Azure. Ses tonu samimi, hızlı.
- **Müzik:** neşeli, kısa döngülü (`music.py` ile pluck + def, 100–120 BPM). Konuşma sırasında yaklaşık 8 dB kısılır.
- **Efektler:**
  - Her kesmede whoosh, her yazı veya balon girişinde pop, finalde kutlama.
  - Konuşmanın üstüne sert ses gelmesin (sfx-kit'in `avoid_for` notlarına bak).
- **Mastering:** −14 LUFS (`yahyali/video/scripts/master.sh`).

## Teknik notlar
- **Render:** `yahyali/video/render/` canvas motoru 1080×1920'ye uyarlanır ya da HyperFrames kullanılır (`hyperframes` skill'i).
- **Emoji:** font yerine `emoji/*.svg` görsellerini çiz; bu ortamda Chromium renkli emoji fontunu çizmiyor.
- **Python:** `video-toolkit/vendor/venv/bin/python` (moviepy, edge-tts, piper).
- **Telif:** referans videoların karakterlerini, logosunu ya da senaryosunu kopyalama. Yalnızca tarz ve teknikleri örnek al.
