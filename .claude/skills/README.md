# Proje skill'leri

Bu klasördeki skill'ler [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) deposundan (commit `be2a406`) kopyalandı. Lisans Apache 2.0'dır (`LICENSE-Apache-2.0.txt`); kendi `LICENSE.txt` dosyası olan skill'lerde o dosya geçerlidir. Claude Code bu klasördeki skill'leri depo açıldığında kendiliğinden yükler.

| Alan | Skill'ler |
|---|---|
| Video ve görsel | `video-downloader`, `image-enhancer`, `canvas-design`, `slack-gif-creator`, `theme-factory`, `artifacts-builder`, `brand-guidelines` |
| İçerik ve araştırma | `content-research-writer`, `competitive-ads-extractor`, `lead-research-assistant`, `twitter-algorithm-optimizer`, `domain-name-brainstormer`, `internal-comms`, `tailored-resume-generator` |
| Dosya ve düzen | `file-organizer`, `invoice-organizer`, `meeting-insights-analyzer`, `raffle-winner-picker` |
| Geliştirme | `webapp-testing`, `mcp-builder`, `changelog-generator`, `langsmith-fetch`, `developer-growth-analysis`, `skill-creator`, `skill-share` |
| Uygulama bağlantıları (Composio hesabı ve API anahtarı gerekir) | `connect`, `connect-apps`, `elevenlabs-automation`, `pexels-automation`, `heygen-automation`, `cloudinary-automation`, `facebook-automation` |

## Profesyonel video araç takımı
Video işlerinde önce `tr-video-production` okunur (araç seçimi, ses, mastering, kalite kontrolü). Medya kaynakları ve lisanslar için `free-media-sources` kullanılır. Bu iki skill bu depo için yazıldı.

| Skill'ler | Kaynak | Lisans |
|---|---|---|
| `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `style-sampling`, `reverse-any-video`, `remotion-to-hyperframes`, `slideshow`, `figma`, `motion-doctrine`, `cut-the-curve`, `seam-craft`, `captions-overlay` | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) `98f5484` | Apache 2.0 |
| `ffmpeg`, `moviepy`, `video-design`, `blender`, `elevenlabs`, `acestep`, `ltx2`, `playwright-recording`, `runpod` | [digitalsamba/claude-code-video-toolkit](https://github.com/digitalsamba/claude-code-video-toolkit) `a89a320` | MIT |
| `ffmpeg-skill` | [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill) `364f2d5` | MIT |
| `manim-skill` | [Yusuke710/manim-skill](https://github.com/Yusuke710/manim-skill) `a0048d9` | MIT |
| `manimce-best-practices`, `manim-composer` | [adithya-s-k/manim_skill](https://github.com/adithya-s-k/manim_skill) `cef0450` | MIT |

Her klasördeki `LICENSE*` dosyası o skill'in lisansıdır.

**Kurulu değil, gerektiğinde eklenir:**
- **Remotion'ın resmî skill'leri:** depoda lisans dosyası yok, bu yüzden kopyalanmadı. Kurulum: `npx skills add remotion-dev/skills`. Remotion, şirketlerde ücretli lisans isteyebilir.
- **OpenMontage** (calesthio/openmontage): AGPL lisanslı tam bir video ajanı sistemi.
- **OmniRoute:** yapay zekâ ağ geçidi; ayrıntısı `free-media-sources` içinde.

**Eklenmeyenler:**
- `document-skills` (docx, pdf, pptx, xlsx): Anthropic lisansı yeniden dağıtımı kısıtlıyor. Bu skill'ler Claude'da zaten yerleşik olarak var.
- `template-skill`: boş bir şablon.
- Diğer 827 Composio uygulama otomasyonu: her oturumun bağlamını şişirir ve Composio hesabı gerektirir. Gerektiğinde tek tek eklenebilir.

Güncellemek için kaynak depoyu yeniden klonlayıp ilgili klasörleri buraya kopyalayın.
