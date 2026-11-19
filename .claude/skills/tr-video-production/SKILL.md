---
name: tr-video-production
description: Read FIRST for any video, animation, film, promo, documentary or explainer request (Türkçe tanıtım/belgesel/animasyon/kısa film). Picks the right engine (HyperFrames motion graphics, Remotion, Manim, Blender, FFmpeg, or this repo's yahyali/video parallax pipeline), then runs script, voice, music, sync, mastering, subtitles and QA to a professional delivery standard.
---

# Türkçe profesyonel video üretimi

## 1. Brief ve plan
- **Format:** varsayılan YouTube 16:9, 1920×1080, 30 fps. Shorts/Reels için 9:16, 1080×1920. Süreyi ve dili netleştir.
- **Senaryo:** `content-research-writer` ile kaynaklı yaz.
  - İlk 3 saniye kanca, ardından konum/harita, 3–5 bölüm ve kapanış kartı.
  - Rakamları kaynakla doğrula. Kaynaklar çelişiyorsa aralık ver.
- **Çekim listesi:** her cümleye bir görsel ve bir hareket. Ekran yazıları kısa: başlık, rakam, yer adı.

## 2. Görsel motoru seç

| İhtiyaç | Kullan |
|---|---|
| After Effects tarzı motion graphics, kinetik tipografi, geçişler, hazır bloklar | `hyperframes`; yanında `motion-doctrine`, `cut-the-curve`, `seam-craft`, `captions-overlay`, `hyperframes-registry` (≈450 blok), `media-use`, `style-sampling` |
| React ile şablonlu veya veri odaklı video | Remotion: `npx skills add remotion-dev/skills` (şirket kullanımında remotion.dev/license) |
| Matematik, bilim, teknik anlatım | `manim-skill`, `manimce-best-practices`, `manim-composer` |
| 3B sahne, ürün, karakter | `blender` |
| Parallax illüstrasyon, harita animasyonu, halı dokuma gibi özel sahneler | depodaki `yahyali/video/` hattı (`render/land.js`, `render/scene.js`) |
| Gerçek görüntüyle kurgu: kesme, birleştirme, hız, çerçeve, altyazı yakma | `ffmpeg-skill`, `ffmpeg`, `moviepy` |
| Ekran kaydı veya demo | `playwright-recording` |
| Hazır bir videoyu düzenlenebilir projeye çevirme | `reverse-any-video` |
| Renk, tipografi ve düzen kuralları | `video-design`, `theme-factory` |
| Yapay zekâ ile video veya müzik üretimi (GPU gerekir) | `ltx2`, `acestep`, `runpod` (ücretli GPU) |

## 3. Ses
- **Kullanıcı kaydı varsa** onu kullan. `yahyali/video/scripts/build_warp.py` ile görüntüyü sese hizala.
  - Konuşma hızını değiştirme.
  - Başlık gibi nefes gereken yerlere cümle arası kısa duraklama eklenebilir; eklediğini kullanıcıya söyle.
- **Kayıt yoksa** ücretsiz TTS seçeneklerini `free-media-sources` skill'inde bul.
- **Müzik ve efektler:** `yahyali/video/scripts/music.py` ile özgün sentezle (telifsiz). Alternatifleri `media-use`, `acestep`, ElevenLabs müzik.
- **Miks:**
  - Konuşma sırasında ses, müziğin en az 6 dB üstünde olsun.
  - Vuruşları kelimelerin tam üstüne koyma.
  - `yahyali/video/scripts/master.sh` ile −14 LUFS ve en fazla −2 dBTP'ye getir.

## 4. Teslim öncesi kontrol
- **Senkron:** her cümlede doğru sahne ve yazı var mı? Kareleri çıkarıp bak.
- **Yazım:** Türkçe karakterler (İ ı Ş ş Ğ ğ) fontta doğru görünüyor mu? Özel isimlerde kesme işareti (Kapuzbaşı Şelaleleri'ni) var mı?
- **Ses:** `ffmpeg -af ebur128` ile −14 LUFS, kırpma yok.
- **Ekler:** `.srt` altyazı ve künye/kaynak dosyası (görsel, müzik, ses, font lisansları).
- **Dosya boyutu:** 1080p30 için yaklaşık 5–8 Mbps (CRF 18–20). Her kare değişen yoğun grain bit oranını şişirir.

## 5. Bulut ortamı notları
- **Ağ:** npm, PyPI ve GitHub açık. YouTube, Hugging Face ve stok sitesi API'leri ağ izni ister. Ortam aracıyla, kullanıcı onayıyla ekle; API anahtarlarını kimlik bilgisi isteme aracıyla al, sohbete yazdırma.
- **Chromium:** `/opt/pw-browsers/chromium`. HyperFrames bunu `HYPERFRAMES_BROWSER_PATH` değişkeninden okur.
- **HyperFrames telemetrisi:** HyperFrames kullanım verisi gönderir. Kapatıp kapatmamayı (`HYPERFRAMES_NO_TELEMETRY=1`) kullanıcıya sor, kendiliğinden değiştirme.
