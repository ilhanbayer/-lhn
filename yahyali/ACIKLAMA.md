# Yahyalı — 1 dakikalık tanıtım videosu

**Dosyalar**
- `yahyali.mp4` — 1920×1080, 30 fps, 60 sn, H.264 + AAC (YouTube için −14 LUFS)
- `yahyali.srt` — Türkçe altyazı (YouTube'a ayrıca yüklenebilir)
- `video/` — videoyu üreten kaynak kodu (render motoru, sahneler, müzik/ses sentezi)

## YouTube için öneri

**Başlık:** Yahyalı: Kayseri'nin Saklı Cenneti | Kapuzbaşı Şelaleleri · Aladağlar · Zamantı

**Açıklama:**
> Dağın kalbinden fışkıran yedi şelale, 3.700 metreyi aşan zirveler, kanyonlarda akan Zamantı ve ilmek ilmek dokunan tescilli Yahyalı halısı. Kayseri'nin 80 km güneyindeki Yahyalı'yı bir dakikada keşfedin.
>
> #Yahyalı #Kayseri #Kapuzbaşı #Aladağlar #Zamantı #Türkiye

## Akış

| Süre | Sahne | Seslendirme |
|---|---|---|
| 0:00 | Şelaleler (kanca) | Dağın kalbinden fışkıran yedi şelale… Toros Dağları'nın eteğinde, saklı bir cennet. |
| 0:07 | Harita: Türkiye → Kayseri → Yahyalı | Kayseri'nin seksen kilometre güneyinde… Yahyalı. |
| 0:11 | Başlık: YAHYALI | |
| 0:15 | Aladağlar, 3.700+ m sayacı | Toroslar'ın en görkemli sıradağlarından biri… Zirveleri 3.700 metreyi aşar. |
| 0:22 | Kıştan bahara Derebağ | Kışın biriken kar, baharda suya dönüşür. |
| 0:25 | Kapuzbaşı Şelaleleri | Bu sular kaya duvarlarının arasından fışkırarak Kapuzbaşı Şelaleleri'ni oluşturur. |
| 0:31 | Zamantı kanyonu ve vadisi | Seyhan'ın en büyük kolu Zamantı Irmağı… |
| 0:37 | Derebağ, yaylalar, kıl çadırlar | Derebağ'ın serin vadileri… yaylalarda kurulan kıl çadırlar… |
| 0:41 | Halı dokuma animasyonu | İlmek ilmek, tamamen yünden dokunan Yahyalı halısı… |
| 0:48 | DAĞ · SU · EMEK | Dağ. Su. Ve emek. |
| 0:52 | Gün batımı, kapanış | Yahyalı… keşfedilmeyi bekliyor. |

## Künye
- **Görseller:** Özgün dijital illüstrasyon ve animasyon (kodla üretildi; fotoğraf kullanılmadı)
- **Harita verisi:** [turkey-map-react](https://github.com/erdigokce/turkey-map-react), © 2020 Erdi Gökçe (MIT lisansı)
- **Seslendirme:** [Piper TTS](https://github.com/rhasspy/piper), `tr_TR-fahrettin-medium` sesi (veri seti CC0)
- **Müzik ve ses efektleri:** Özgün sentez (hazır örnek/ses dosyası kullanılmadı)
- **Yazı tipleri:** Playfair Display, Montserrat, Bebas Neue (SIL Open Font License)

## Bilgi kaynakları
- Kapuzbaşı (7 şelale, Aladağlar'ın kar ve buzullarından beslenir, Zamantı'ya karışır): [NTV](https://www.ntv.com.tr/yasam/kayserideki-kapuzbasi-selaleleri-yogun-ilgi-goruyor-1700291), [Küre Ansiklopedi](https://kureansiklopedi.com/tr/detay/kapuzbasi-selaleleri-c317f)
- Aladağlar'ın en yüksek zirvesi Demirkazık, 3.756 m: [Küre Ansiklopedi – Aladağlar Milli Parkı](https://kureansiklopedi.com/tr/detay/aladaglar-milli-parki-23aa8)
- Zamantı, Seyhan'ın en büyük kolu: [Küre Ansiklopedi – Develi](https://kureansiklopedi.com/tr/detay/develi-ilce-8c14b), [Zamantı Irmağı](https://kureansiklopedi.com/tr/detay/zamanti-irmagi-ff982)
- Yahyalı el halısı, tescilli mahreç işareti (1996), tamamen yün: [TÜRKPATENT tescil belgesi](https://ci.turkpatent.gov.tr/Files/GeographicalSigns/d5eb505f-4530-4534-9d4c-5ea557b3447f.pdf), [Küre Ansiklopedi](https://kureansiklopedi.com/tr/detay/yahyali-el-halisi-dfa99)
- Kayseri merkeze yaklaşık 80 km: turizm haberleri ([haber.aero](https://mail.haber.aero/?p=106063))

## Yeniden üretmek için
`video/` klasöründe:
1. `npm install` (harita verisi ve yazı tipleri)
2. `python3 scripts/tts.py fahrettin 1.2 audio/fahrettin narration.json` (seslendirme; Piper ses modeli gerekir)
3. `python3 scripts/music.py` (müzik, efektler ve miksaj)
4. Klasörde `python3 -m http.server 8765` çalıştırın, ardından `node scripts/render.js out.mp4`
