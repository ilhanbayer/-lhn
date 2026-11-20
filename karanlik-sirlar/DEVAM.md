# Yahyalı'nın Karanlık Sırları: Kanlı Ardıç (çalışma notları)

Sinematik Anadolu korku belgeseli, yaklaşık 2 dk 27 sn. Metin `narration.json` içinde; anlatılanlar **rivayet** olarak sunulur, tarihî gerçek gibi değil.

## Hat (sırasıyla)
1. **Seslendirme:** `scripts/tts_lines.py` (Chatterbox Multilingual, Türkçe).
   - Seçilen sürümler `voice/*.flac`, liste `voice/manifest.json`.
   - Fazlalık kuyruklar `scripts/smart_trim.py` ile kesildi (`voice/trim.json`).
2. **Anlatım izi:** `scripts/voice_post.py` → `out/narration.wav` ve `timeline.json` (her cümlenin başlangıç ve bitişi).
3. **Görüntü:** `render/` (three.js; tarayıcıda SwiftShader ile).
   - `world.js`: yayla, yükseklik sisi, ardıçlar, makam, çadır, ateş, odun yığını, gökyüzü.
   - `person.js`: oduncu (siluet ağırlıklı).
   - `shots.js`: çekim listesi, `timeline.json` zamanlarına bağlı.
   - `main.js`: renk düzeltme, film greni, başlıklar.
   - Kontrol kareleri: `node scripts/stills.js <klasör> 0.5 <saniye...>` ve `python3 scripts/sheet.py`.
   - Tam render: `node scripts/render_frames.js out/frames 0.8 0 4404` (kaldığı yerden devam eder).
   - Not: render sırasında `python3 -m http.server 8767` proje klasöründe açık olmalı.
4. **Ses tasarımı:** `scripts/sound.py` → `out/audio/{ambience,music,sfx,premix}.wav`.
   - Rüzgâr, ateş, köpek uluması, dal çıtırtısı, balta, ayak sesleri ve gerilim müziği sentezle üretilir.
   - Vurgular `video-toolkit/sfx` (CC0) kitinden gelir.
   - Kritik cümlelerden önce kısa sessizlikler var.
5. **Mastering:** `scripts/master.py` → `out/audio/master.wav` (−14 LUFS, tepe en fazla −1,8 dBTP).
6. **Altyazı:** `scripts/srt.py` → `out/yahyalinin-karanlik-sirlari.srt`.
7. **Birleştirme:** kareler ve ses ffmpeg ile birleştirilir; altyazı ayrıca kapatılabilir iz olarak eklenir.

Açıklama metni ve künye: `ACIKLAMA.md`.

## Ortamı yeniden kurma (yeni oturumda)
```bash
pip install uv && uv venv --python 3.11 /home/user/cb-venv
VIRTUAL_ENV=/home/user/cb-venv uv pip install chatterbox-tts "setuptools<81"
apt-get install -y rubberband-cli
# Model indirmesi için: HF_HUB_DISABLE_XET=1 (izinli HTTP yolunu kullanır)
cd karanlik-sirlar/render && npm install
```
