# Claude için çalışma notları

## Skill'ler: her işte kullan
Kullanıcı, `.claude/skills/` altındaki skill'lerin **tüm video ve diğer işlerinde** kullanılmasını istiyor (liste: `.claude/skills/README.md`).
- Bir işe başlamadan önce işe uyan skill'i bul ve onun `SKILL.md` talimatlarını izle. Birden fazla skill uyuyorsa birlikte kullan.
- Harici hesap veya API anahtarı isteyen skill'lerde (Composio/Rube, ElevenLabs, HeyGen, Pexels, Cloudinary, LangSmith…) kullanıcıya sormadan kurulum yapma, anahtar isteme.
- `video-downloader` ile indirilen videoları yalnızca referans ve inceleme için kullan. Telifli içeriği izinsiz olarak videolara koyma.

## Video işleri
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
