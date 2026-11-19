import json,sys,os,wave
from piper import PiperVoice, SynthesisConfig
voice,ls,outdir=sys.argv[1],float(sys.argv[2]),sys.argv[3]
base=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','tts',f'vits-piper-tr_TR-{voice}-medium')
v=PiperVoice.load(f'{base}/tr_TR-{voice}-medium.onnx',config_path=f'{base}/tr_TR-{voice}-medium.onnx.json')
cfg=SynthesisConfig(length_scale=ls,noise_scale=0.6,noise_w_scale=0.7)
os.makedirs(outdir,exist_ok=True); tot=0
for s in json.load(open(sys.argv[4])):
    fn=f"{outdir}/{s['id']}.wav"
    with wave.open(fn,'wb') as wf: v.synthesize_wav(s['text'],wf,syn_config=cfg)
    with wave.open(fn) as wf: d=wf.getnframes()/wf.getframerate()
    tot+=d; print(f"{s['id']:4} {d:5.2f}s  {s['text']}")
print('total',round(tot,2))
