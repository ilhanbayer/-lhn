# Yahyalı'nın Karanlık Sırları: Kanlı Ardıç (devam planı)

Sinematik Anadolu korku belgeseli. Metin `narration.json` içinde; anlatılanlar **rivayet** olarak sunulur, tarihî gerçek gibi değil.

## Bitenler
- **Seslendirme (49 cümle):** `voice/*.flac`. Seçilen sürümlerin listesi `voice/manifest.json`.
  - Toplam 2 dk 16 sn konuşma; aralardaki duraklamalarla video yaklaşık 3 dk 10 sn olacak.
  - Model: Chatterbox Multilingual (Resemble AI, MIT lisansı), Türkçe.
  - Ses tınısı: Piper `fahrettin` sesinden üretilip Rubber Band ile 2,5 yarım ton kalınlaştırılmış referans (`voice/_referans_ses.flac`, ortanca perde ≈ 91 Hz). Gerçek bir kişinin sesi kopyalanmadı.
  - Her cümle Whisper ile kontrol edildi (`sim` = metinle benzerlik).
  - `a03` ("Ama gecesi…", sim 0,86) dinlenip gerekirse yeniden üretilecek. `b22`'de tanıma sadece "3. kez" diye rakamla yazdı; ses doğru.
  - Cümle başına duygu yoğunluğu (`exag`), hız (`cfg`), işleme türü (`post`: normal, warm, dark, low, strong, lowbreath, nearwhisper, whisper) ve sonrasındaki sessizlik (`gap`) `narration.json` içinde.
- **Proje iskeleti:** `render/` (three.js 0.181, fontlar: Cinzel, Cormorant Garamond, Montserrat).
- **Ortam:** ağ izinleri eklendi: Hugging Face (`huggingface.co`, `us.aws.cdn.hf.co`, `cas-bridge.xethub.hf.co`, `cdn-lfs*.hf.co`) ve YouTube (bilgi ve kareler).

## Kalanlar
1. **Seslendirme işleme** (`scripts/voice_post.py`, yazılacak). İşleme türleri:
   - `lowbreath`, `nearwhisper`, `whisper`: harmonikleri düzleştirilmiş gürültü katmanıyla fısıltıya yaklaştırma, −3/−6 dB.
   - `strong`: hafif kompresyon.
   - `dark`: alçak geçiren süzgeç.
   - Hepsine hafif oda yankısı. Ardından cümleleri `gap` süreleriyle birleştirip zaman çizelgesini çıkar.
2. **3B dünya** (`render/world.js`, three.js, tarayıcıda WebGL; bu ortamda SwiftShader ile çalışıyor):
   - Arazi ve uzak Toros silsilesi (karlı zirveler).
   - Gökyüzü: yıldızlar, ay, güneş. Gün → altın saat → alacakaranlık → gece → şafak ışık geçişleri.
   - Üstel sis ve yer pusu.
   - Tepede beş yaşlı ardıç: burgulu gövde, koyu yeşil öbekler, rüzgârda sallanan dallar.
   - Makam (taş mezar), dallara bağlı renkli çaputlar.
   - Liken lekeli kayalar, kuru yayla otları.
   - Yörük kıl çadırı, kamp ateşi (titreşen ışık, kıvılcım, duman) ve odun yığını; "odunlar yok" hâli.
   - Oduncu: siluet ağırlıklı; yürüme, balta vurma, odun taşıma, korkuyla geri çekilme hareketleri.
   - Son işlem: bloom, renk düzeltme, vinyet, film greni, 2.39:1 sinema bantları.
3. **Çekim listesi** (her cümleye bir çekim, yavaş kamera):
   - **Açılış:** karanlık ekran → güneşli yayla ("Gündüzü cennet") → gece çöker ("Ama gecesi") → ay ışığı ve sis ("Bambaşka bir âlem!", vuruş) → başlık kartı "YAHYALI'NIN KARANLIK SIRLARI".
   - **Kanlı Ardıç:**
     - Bölüm kartı "KANLI ARDIÇ · Bir halk rivayeti".
     - Vinç çekimiyle beş ardıç ortaya çıkar; makam ve çaputlar görünür.
     - Altın saatte balta vuran siluet; odunları çadıra taşır.
     - Gece zaman atlaması; şafak.
     - "Odunlar yoktur!": boş yere ani yakınlaşma. Üç tekrar giderek gerilir.
     - Adam geri çekilir.
     - Uzun sessizlik ve birinci şahıs gece yürüyüşü; "Yok!".
     - Fısıltıyla "kim aldı?"; ay altında ardıçlarla final ve rivayet notu.
4. **Ses tasarımı:**
   - Düşük frekanslı gerilim müziği (dron, nabız, vuruşlar; "Şimdi bir düşünün…" anında müzik aniden hafifler).
   - Şiddetli dağ rüzgârı, uzak köpek uluması, dal çıtırtısı.
   - Balta, ateş çıtırtısı, adım sesleri.
   - Kritik cümlelerden önce kısa sessizlikler.
   - Kaynaklar: `video-toolkit/sfx` (CC0) ve sentez.
5. **Teslim:** render 1920×1080, 30 fps; −14 LUFS; `.srt`; açıklama ve künye (rivayet notu dahil); commit.

## Ortamı yeniden kurma (yeni oturumda)
```bash
pip install uv && uv venv --python 3.11 /home/user/cb-venv
VIRTUAL_ENV=/home/user/cb-venv uv pip install chatterbox-tts "setuptools<81"
apt-get install -y rubberband-cli
# Model indirmesi için: HF_HUB_DISABLE_XET=1 (izinli HTTP yolunu kullanır)
cd karanlik-sirlar/render && npm install
```
Not: yeniden üretilen bir cümle aynı tohum (`seed`) ve aynı referans sesle üretilirse tını tutarlı kalır.
