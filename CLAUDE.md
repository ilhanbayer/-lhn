# Claude için çalışma notları

## Onay sorma
Kullanıcı ara onay istemiyor: kararları kendin ver, en iyi seçeneği seçip işi sonuna kadar götür, sonunda ne yaptığını kısaca bildir.
- İstisnalar:
  - Ücret doğurabilecek adımlar (ücretli hesap açma, API anahtarı isteme, ücretli servis kullanma)
  - Sistemin kendi izin pencereleri
- Ücretsiz ve açık lisanslı araçları tercih et.

## Hazır 3B hikâye hattı
`karanlik-sirlar/`: three.js ile gece/yayla dünyası, Chatterbox seslendirme, sentez ses tasarımı ve mastering. Adımlar `karanlik-sirlar/DEVAM.md` içinde. Yahyalı'nın başka rivayetleri için bu dünyayı ve hattı yeniden kullan.

## Skill'ler: her işte kullan
Kullanıcı, `.claude/skills/` altındaki skill'lerin **tüm video ve diğer işlerinde** kullanılmasını istiyor (liste: `.claude/skills/README.md`).
- Bir işe başlamadan önce işe uyan skill'i bul ve onun `SKILL.md` talimatlarını izle. Birden fazla skill uyuyorsa birlikte kullan.
- Harici hesap veya API anahtarı isteyen skill'lerde (Composio/Rube, ElevenLabs, HeyGen, Pexels, Cloudinary, LangSmith…) kullanıcıya sormadan kurulum yapma, anahtar isteme.
- `video-downloader` ile indirilen videoları yalnızca referans ve inceleme için kullan. Telifli içeriği izinsiz olarak videolara koyma.
- YouTube paketi (`/yt-script`, `/yt-package`, `/yt-seo`, `/yt-chapters`, `/yt-shorts`...): Türkçe puanlama destekli.
  - Kullanmadan önce kanalın ses profilini yerine koy: `mkdir -p ~/.claude/youtube && cp .claude/youtube/voice.md ~/.claude/youtube/`
  - Yeni videolardan öğrendiklerini `.claude/youtube/voice.md` dosyasına işle.
  - "Kanlı Ardıç" videosuna (`karanlik-sirlar/`) bu paketi uygulama; o video teslim edildiği hâliyle kalıyor (kullanıcı isteği).

## Video işleri
- **Her video, animasyon, film veya tanıtım işinde önce `tr-video-production` skill'ini oku.** Hangi işte hangi aracın kullanılacağını ve teslim standardını o belirler. Medya ve ses kaynakları için `free-media-sources` skill'ine bak.
- Profesyonel araçlar:
  - HyperFrames: After Effects tarzı motion graphics ve yaklaşık 450 hazır blok
  - Manim: teknik ve matematik anlatımı
  - Blender: 3B sahneler
  - FFmpeg ve MoviePy: kurgu
  - ElevenLabs, ACE-Step, LTX-2: yapay zekâ ile ses, müzik ve video; anahtar veya GPU gerekir
- **Shorts, Reels ve TikTok:** `shorts-cartoon-style` skill'ini izle. Araçlar `video-toolkit/` altında; önce `video-toolkit/install.sh` çalıştır. Hazır içerik:
  - `sfx/`: 320 CC0 ses efekti
  - `emoji/`: Noto emoji SVG'leri
  - DiceBear karakterler, Rhubarb dudak senkronu, konfeti/parçacık, GSAP, gl-transitions, fontlar
- Hazır video hattı `yahyali/video/` klasöründe:
  - `render/`: parallax illüstrasyon ve tipografi render motoru
  - `scripts/music.py`: müzik, efekt ve miksaj sentezi
  - `scripts/build_warp.py`: verilen seslendirmeye göre görüntüyü zamanlama
  - `scripts/master.sh`: −14 LUFS mastering ve birleştirme
  Yeni videoları bu hattın üzerine kur.
- Videolarda kullanılacak skill'ler:
  - `content-research-writer`: kaynaklı senaryo
  - `canvas-design` ve `image-enhancer`: görseller
  - `slack-gif-creator`: kısa animasyon ve GIF
  - `theme-factory`: renk ve yazı tipi temaları
  - `video-downloader`: referans videolar
  - Composio bağlantısıyla: `elevenlabs-automation` (seslendirme), `pexels-automation` (stok fotoğraf/video), `heygen-automation`, `cloudinary-automation`, `facebook-automation`
- Teslimat standardı: 1920×1080, 30 fps, YouTube için −14 LUFS ses, Türkçe altyazı (`.srt`), künye ve kaynakları içeren açıklama dosyası.
