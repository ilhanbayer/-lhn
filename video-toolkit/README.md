# Video araç takımı

Shorts, Reels ve tanıtım videolarında kullanılan efekt, ses, grafik ve karakter araçları. Hepsi açık kaynak ya da serbest lisanslı.

**Kurulum:** `video-toolkit/install.sh` (yaklaşık 30 saniye). Şunları kurar:
- npm paketleri;
- Python paketleri (ayrı ortamda: `vendor/venv`);
- Rhubarb Lip Sync programı;
- referans depolar (`vendor/`).

Depoya doğrudan konanlar, kurulum gerektirmez:
- `sfx/`: 320 profesyonel ses efekti, CC0.
- `emoji/`: 148 Noto emoji, SVG.

## Referans Short'un anatomisi ve karşılıkları

Referans: [SPESİFİKKAYSERİ: "Tüm Kayseri Bizi Takip Etse Ne Olurdu? 😳"](https://youtube.com/shorts/gKhrzU_iMA0). Tarz, dikey 1080×1920 bir çizgi film Short.

| Videodaki öğe | Bizdeki karşılığı |
|---|---|
| Lacivert zemin + dönen ışık hüzmeleri (sunburst), kalın sıkışık büyük harf başlık | Canvas/HyperFrames çizimi; font `@fontsource/anton` veya `bebas-neue`; `hyperframes-registry` başlık blokları |
| Düz renkli (flat) vektör sahneler: tramvay içi, kahvehane, Erciyes tablosu, çay bardağı | `yahyali/video/render/land.js` tarzı prosedürel SVG/canvas çizim; emoji görselleri (`emoji/`) |
| Yuvarlak kafalı karakterler, kasketli bıyıklı kızgın amca | DiceBear (`@dicebear/collection`: avataaars, open-peeps CC0 …) veya elle SVG kukla |
| Konuşan karakterin ağız hareketi | Rhubarb Lip Sync (`vendor/rhubarb/rhubarb -r phonetic -f json ses.wav`): 9 ağız şekli (A–H, X) zaman çizelgesi |
| Konuşma balonu + emoji ("😤") | SVG balon ve `emoji/emoji_u1f624.svg` |
| Alt yazılar: beyaz, kalın, anahtar kelime turuncu | Kelime zamanlaması (TTS süreleri veya Whisper) + canvas çizimi; font `@fontsource/poppins` ExtraBold / `baloo-2`; referans `vendor/ai-video-captions`, `vendor/captacity` |
| "TAKİP ET" butonu, yağan konfeti, emojili çağrılar | `canvas-confetti`, `@tsparticles/slim`; GSAP veya anime.js ile "pop" giriş; `emoji/` |
| Geçişler | `gl-transitions` (60+ GLSL geçiş), ffmpeg `xfade`, `cut-the-curve` skill'i |
| Whoosh, pop, kutlama, bildirim, riser sesleri | `sfx/` (sfx-kit, CC0): her sesin `sync` noktası `sfx/catalogue.md` ve `sfx/sounds.json` içinde |
| Seslendirme | Kullanıcı kaydı; Piper (çevrimdışı); Edge TTS `tr-TR-AhmetNeural` / `EmelNeural` (resmî olmayan servis, `speech.platform.bing.com` ağ izni ister); Azure Speech'in ücretsiz katmanı (aynı sesler, resmî, anahtar ister); ElevenLabs |
| Fon müziği | `yahyali/video/scripts/music.py` özgün sentez; `acestep` |
| Logo filigranı | Basit yazı katmanı |

## İçerik

| Klasör / paket | Ne işe yarar | Lisans |
|---|---|---|
| `sfx/` ([wyzowl/sfx-kit](https://github.com/wyzowl/sfx-kit) `92780e7`, OGG'ye dönüştürüldü) | 28 kategoride 320 ses efekti | CC0 |
| `emoji/` ([googlefonts/noto-emoji](https://github.com/googlefonts/noto-emoji) `99701e0`, 2D SVG) | 148 sık kullanılan emoji; tamamı `vendor/noto-emoji` | Apache 2.0 / OFL (`emoji/LICENSE`) |
| `@dicebear/core` + `collection` | Tohumdan (isimden) karakter SVG'si: avataaars, open-peeps, lorelei, notionists … | Kod MIT; stiller kendi lisansıyla (open-peeps CC0, avataaars serbest) |
| `canvas-confetti`, `@tsparticles/*` | Konfeti ve parçacık efektleri | ISC / MIT |
| `gsap`, `animejs`, `lottie-web` | Animasyon zamanlaması, Lottie (After Effects/Bodymovin) oynatma | GSAP ücretsiz lisans; MIT |
| `gl-transitions` | GLSL sahne geçişleri | MIT |
| Fontlar: Anton, Poppins, Baloo 2, Bebas Neue, Montserrat, Noto Color Emoji | Shorts başlık ve altyazı yazıları | OFL |
| Rhubarb Lip Sync 1.14.0 | Sesten 2D ağız animasyonu | MIT |
| `moviepy`, `edge-tts`, `piper-tts`, `sherpa-onnx`, `yt-dlp` (venv) | Kurgu, TTS, konuşmayı yazıya çevirme, referans video bilgisi | MIT / LGPL-GPL / Apache / Unlicense |
| `vendor/MoneyPrinterTurbo` | Konudan otomatik Shorts: stok görüntü, TTS, altyazı | MIT |
| `vendor/ShortGPT` | Shorts otomasyon çatısı | MIT |
| `vendor/ai-video-captions` | Kelime zamanlamalı Hormozi/MrBeast/karaoke altyazı | MIT |
| `vendor/captacity` | Whisper + MoviePy ile Shorts altyazısı (moviepy 1.x ister) | MIT |
| `vendor/lottie` (diffusionstudio) | Ajanla Lottie animasyonu üretme | MIT |
| `vendor/uisfx` | 1872 arayüz sesi | Kod MIT, sesler CC0 |
| `vendor/sfx-kit` | sfx-kit'in orijinal WAV sürümü | CC0 |

## Notlar
- **Emoji:** Chromium bu ortamda renkli emoji fontunu (COLRv1) çizmiyor. Emoji'leri `emoji/*.svg` görselleriyle kullan; dosya adı `emoji_u<kod>.svg` (örnek: 😤 = `emoji_u1f624.svg`).
- **Python:** araç takımı için `video-toolkit/vendor/venv/bin/python`. Sistem Python'ı ayrı kalır; moviepy, Pillow 12 ile çakışıyor.
- **Ağ izni gerekenler:** Edge TTS, Pexels/Pixabay API ve YouTube. YouTube bu ortamda bot doğrulaması istediği için video indirilemiyor; yalnızca başlık ve kare önizlemeleri alınabiliyor.
