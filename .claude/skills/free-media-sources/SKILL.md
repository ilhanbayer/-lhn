---
name: free-media-sources
description: Free, properly licensed stock footage, photos, music, sound effects and Turkish voice options for videos, with each source's license rules, the API key or network access it needs, and how to credit it. Use when a video needs footage, photos, music, SFX or a voiceover.
---

# Ücretsiz medya kaynakları

Her varlığın kaynağını, yazarını ve lisansını künyeye (`ACIKLAMA.md`) yaz. Kullanıcı ticari olmayacağını söylemedikçe NC (ticari olmayan) lisansları kullanma. Gerçek bir yeri anlatırken yapay zekâ üretimi görüntüyü gerçek fotoğraf gibi sunma.

## Video ve fotoğraf
| Kaynak | Lisans | Erişim |
|---|---|---|
| Pexels | Ticari kullanım serbest, atıf gerekmez. Değiştirilmemiş kopyalar satılamaz; kişi ve markalar onay ima edecek biçimde kullanılamaz. | API ücretsiz anahtarla. Hostlar: `api.pexels.com`, `videos.pexels.com`, `images.pexels.com` |
| Pixabay | Pixabay İçerik Lisansı: ticari kullanım serbest, atıf gerekmez. Her öğenin lisans rozetine bak. | API ücretsiz anahtarla. Hostlar: `pixabay.com`, `cdn.pixabay.com` |
| Wikimedia Commons | CC BY, CC BY-SA veya kamu malı; atıf zorunlu (öğe bazında). | API: `commons.wikimedia.org`, dosyalar: `upload.wikimedia.org`. Paylaşılan IP'lerde sıkı hız sınırı var; `Retry-After`'a uy. |
| Openverse | CC içerik toplayıcısı; lisans öğe bazında. | `api.openverse.org` |
| NASA, kamu kurumları | Çoğunlukla kamu malı. | Kurumun sitesi |

## Müzik
- **Özgün sentez:** `yahyali/video/scripts/music.py` (pad, bağlama, def, vuruş, riser). Telifsiz, varsayılan seçenek.
- **Pixabay Music:** Pixabay lisansı.
- **Incompetech (Kevin MacLeod):** CC BY 4.0, atıf zorunlu.
- **Free Music Archive:** parça bazında CC; NC/ND etiketlerine dikkat.
- **ElevenLabs Music** (`elevenlabs`, API anahtarı ve plan şartları) ile **ACE-Step** (`acestep`, açık model, GPU gerekir).

## Ses efektleri
- **`video-toolkit/sfx/`:** sfx-kit, 320 ses, CC0, atıf gerekmez. Kategoriler: whoosh, pop, kutlama, belirme, bildirim, riser, darbe vb. Her sesin eşleme noktası (`sync`) `sounds.json` içinde; kataloğu `catalogue.md`'de.
- **`video-toolkit/vendor/uisfx`:** 1872 arayüz sesi, CC0.
- **Sentez:** `music.py` içinde whoosh, riser, boom, su, rüzgâr ve ping hazır.
- **Freesound:** API anahtarı gerekir; ses başına CC0, CC BY veya CC BY-NC.
- **Pixabay ses efektleri.**

## Türkçe seslendirme
| Seçenek | Not |
|---|---|
| Kullanıcının kendi kaydı | En iyisi. `build_warp.py` ile görüntüyü sese hizala. |
| Piper `tr_TR-fahrettin-medium` / `fettah` | Çevrimdışı, ücretsiz, veri seti CC0. Model: `github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-tr_TR-fahrettin-medium.tar.bz2`; çalıştırma `pip install piper-tts`. |
| Chatterbox Multilingual (Resemble AI) | MIT, Türkçe destekli, daha doğal. Ağırlıklar Hugging Face'te, ağ izni gerekir. |
| F5-TTS Türkçe ince ayarları | Lisans modele göre değişir (MIT olan var, CC-BY-NC olan var); kontrol et. |
| XTTS-v2 | CPML lisansı, ticari kullanım yok. |
| ElevenLabs (`elevenlabs`, `elevenlabs-automation`) | En doğal ses. Ücretsiz kotası sınırlı, API anahtarı gerekir. |
| Azure AI Speech, ücretsiz F0 katmanı | Resmî servis. `tr-TR-AhmetNeural` ve `tr-TR-EmelNeural` sesleri; ayda belirli bir karakter kotası ücretsiz. Azure hesabı ve anahtar gerekir. |
| Edge TTS (`edge-tts`, venv'de kurulu) | Azure ile aynı Türkçe sesler, anahtarsız. Ancak Microsoft'un resmî olmayan servisini kullanır; ticari işte Azure'u tercih et. `speech.platform.bing.com` ağ izni gerekir. |

## OmniRoute (isteğe bağlı ağ geçidi)
[OmniRoute](https://github.com/cheaper-inference/OmniRoute), kullanıcının kendi sunucusunda çalışan bir yapay zekâ ağ geçidi.
- **Ne sağlar:** bağlanan sağlayıcı hesaplarıyla (ElevenLabs, fal.ai vb.) şu uçları tek bir adresten sunar:
  - `/v1/audio/speech`
  - `/v1/music/generations`
  - `/v1/videos/generations`
  - `/v1/images/generations`
- **Ücretsiz kotalar:** sağlayıcıya bağlıdır.
- **Uyarı:** kataloğunda şartlara aykırı ("avoid") diye işaretlenmiş sağlayıcılar var; onları kullanma.
- **Kurulum:** sunucu kurmak, sağlayıcı anahtarı eklemek ve ağ izni açmak kullanıcı onayı gerektirir.
