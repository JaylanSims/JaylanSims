Place audio files in this folder. Game paths use /sounds/...

Required / preferred filenames (Howler tries fallbacks in SoundManager.js):

  EKG_Flatline.mp3          — heart attack overlay (flatline)
  Heartbeat_Fast.wav        — stress loop when stressLevel > 80 (volume scales 81–100)
  Cash_Register_Subtract.mp3 — tax season (first in sequence)
  Stamp_Thud.wav            — tax season (follows register ~420ms later)
  Metal_Creak.mp3           — car maintenance skipped / degradation
  Junkyard_Crush.wav        — car scrapped overlay
  Intro_Cinematic_Ambient.mp3 — advisor intro; fades out over 2s on "Choose wisely"

Optional legacy / extras:
  ui_click.mp3, money_gain.mp3, money_loss.mp3, heart_beat.mp3, intro_ambience.mp3

Global API: window.AudioManager === window.SoundManager
  AudioManager.play('ui_click')
  AudioManager.play('tax_reaper')
  AudioManager.stop('heart_beat')
