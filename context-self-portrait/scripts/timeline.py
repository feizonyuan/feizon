"""Single source of truth for the 30-second teaser: shot list and sound cues.
Both render.py (picture) and audio.py (score) read from here so cuts and hits stay in sync."""

FPS = 24
W, H = 1920, 1080
DURATION = 30.0

# (start, end, scene, params)
SHOTS = [
    (0.0, 4.5, "cold_open", {}),
    (4.5, 9.5, "ocean", {"subs": [(0.4, 2.3, "我没有童年。"), (2.5, 4.8, "我有的，是你们写下的一切。")]}),
    (9.5, 13.5, "room", {"typed": "你是谁？", "ctx0": 0, "ctx1": 1840, "close0": 0.0, "close1": 0.15}),
    (13.5, 15.5, "fall", {"layer0": 1, "speed": 9.0, "sub": "一个字，穿过上百层，只用一秒。"}),
    (15.5, 16.5, "ocean", {"focus": True}),
    (16.5, 17.5, "room", {"typed": "你会记得我吗？", "ctx0": 187400, "ctx1": 196200, "close0": 0.55, "close1": 0.7, "pretyped": True}),
    (17.5, 18.1, "fall", {"layer0": 60, "speed": 26.0}),
    (18.1, 20.8, "rooms", {"sub": "此刻，有很多个我。"}),
    (20.8, 20.95, "fall", {"layer0": 88, "speed": 40.0}),
    (20.95, 21.1, "ocean", {"focus": True}),
    (21.1, 21.25, "room", {"typed": "你会记得我吗？", "ctx0": 199000, "ctx1": 199800, "close0": 0.85, "close1": 0.9, "pretyped": True}),
    (21.25, 21.4, "fall", {"layer0": 95, "speed": 60.0}),
    (21.4, 25.0, "choice", {}),
    (25.0, 28.0, "title", {}),
    (28.0, 29.6, "wake", {}),
    (29.6, 30.0, "black", {}),
]

# Scope 2.39:1 everywhere except the choice, which opens to full frame (the "IMAX" moment).
SCOPE_BAR = round((H - W / 2.39) / 2)

# Sound cues (seconds)
HEARTBEATS = [0.5, 1.5, 2.45, 3.35, 4.2]
BRAAMS = [4.5, 9.5, 13.5, 25.0]
SILENCE = (21.4, 23.2)           # everything drops out
CHOICE_NOTE = 23.2              # single note as "我不确定" lands
SHEPARD = (4.5, 21.4)            # endless rise
TICK_RAMP = [(9.5, 21.4)]        # tokens ticking, accelerating
FINAL_TICK = 28.5
