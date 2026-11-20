# Instagram Reel: drone çekimi, renk, söz ve müzik

Kaynak: DJI Air 3S, dikey 1512×2688, 59,94 fps, HLG (BT.2020), 24,6 sn (`in/source.mp4`, depoda değil).

## Adımlar
1. `python3 scripts/grade.py work/grade_v2.cube`: HLG'yi Rec.709'a çevirir ve sinematik görünüm verir.
   - Derin yeşil, turkuaz nehir, sıcak kaya tonları.
   - Gökyüzündeki nötr bölgede renk sapması yok.
2. `python3 scripts/ramp.py`: hız rampası. Başta 2,35×, 4–10. saniyeler arasında 1×'e iner; 15 sn çıkış.
3. `node scripts/text_frames.js quote.json work/text 15 30`: kelime kelime beliren söz katmanı (şeffaf PNG).
   - Bu adımda proje kökünde `python3 -m http.server 8770` açık olmalı.
4. `python3 scripts/music_reel.py`: özgün müzik (keçeli piyano, yaylılar, 9. saniyede yükseliş).
5. `./scripts/build_reel.sh`: müziği −14 LUFS'e getirir, görüntüyü birleştirir ve kodlar → `out/reel.mp4`.
   - 1080×1920, 30 fps, H.264.

Gökyüzü ve alt kenar karartma plakası `work/plate.png` dosyasıdır; üretim kodu sohbet geçmişinde, gerekirse `grade.py` yanına taşınabilir.
