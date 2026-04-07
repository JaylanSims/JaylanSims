/**
 * Global sound manager: Howler.js when available, Web Audio fallbacks for SFX/loops.
 * Place audio files under /public/sounds/ (see SOUND_URLS). Missing files fall back to synthesized cues.
 */
(function (global) {
    "use strict";

    var STORAGE_MUTED = "bitbalance_audio_muted";
    var STORAGE_VOL = "bitbalance_audio_volume";

    var SOUND_URLS = {
        ui_click: ["/sounds/ui_click.mp3", "/sounds/ui_click.ogg"],
        money_gain: ["/sounds/money_gain.mp3", "/sounds/money_gain.ogg"],
        money_loss: ["/sounds/money_loss.mp3", "/sounds/money_loss.ogg"],
        heart_beat: ["/sounds/heart_beat.mp3", "/sounds/heart_beat.ogg"],
        heart_attack: ["/sounds/heart_attack.mp3", "/sounds/heart_attack.ogg"],
        intro_ambience: ["/sounds/intro_ambience.mp3", "/sounds/intro_ambience.ogg"]
    };

    var muted = false;
    var masterVolume = 1;
    var howls = {};
    var howlLoadFailed = {};
    var ctx = null;
    var heartbeatTimer = null;
    var introHowl = null;
    var introSoundId = null;
    var introFadeTimer = null;

    function readStorage() {
        try {
            muted = global.localStorage.getItem(STORAGE_MUTED) === "1";
            var v = parseFloat(global.localStorage.getItem(STORAGE_VOL) || "1");
            if (!isNaN(v) && v >= 0 && v <= 1) masterVolume = v;
        } catch (e) {
            muted = false;
        }
    }

    function persistMuted() {
        try {
            global.localStorage.setItem(STORAGE_MUTED, muted ? "1" : "0");
        } catch (e) { /* ignore */ }
    }

    function persistVolume() {
        try {
            global.localStorage.setItem(STORAGE_VOL, String(masterVolume));
        } catch (e) { /* ignore */ }
    }

    function getAudioContext() {
        if (ctx) return ctx;
        var AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        return ctx;
    }

    function unlockAudio() {
        var c = getAudioContext();
        if (c && c.state === "suspended") {
            c.resume().catch(function () {});
        }
    }

    function hasHowler() {
        return typeof global.Howl === "function";
    }

    function ensureHowl(id) {
        if (!hasHowler() || howlLoadFailed[id]) return null;
        if (howls[id]) return howls[id];
        var urls = SOUND_URLS[id];
        if (!urls || !urls.length) return null;
        try {
            var h = new global.Howl({
                src: urls,
                preload: true,
                volume: effectiveVolume(1),
                onloaderror: function () {
                    howlLoadFailed[id] = true;
                }
            });
            howls[id] = h;
            return h;
        } catch (e) {
            howlLoadFailed[id] = true;
            return null;
        }
    }

    function effectiveVolume(v) {
        if (muted) return 0;
        return Math.max(0, Math.min(1, v * masterVolume));
    }

    function synthFallback(id, opts) {
        var c = getAudioContext();
        if (!c || muted) return;
        if (id === "ui_click") {
            playClickSynth(c, effectiveVolume(0.35));
        } else if (id === "money_gain") {
            playChimeSynth(c, effectiveVolume(0.25));
        } else if (id === "money_loss") {
            playNoiseBurst(c, effectiveVolume(0.2), 0.12);
        } else if (id === "heart_attack") {
            playFlatlineSynth(c, effectiveVolume(0.4));
        }
    }

    function playClickSynth(c, g) {
        var t = c.currentTime;
        var osc = c.createOscillator();
        var gain = c.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.02);
        gain.gain.setValueAtTime(g, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        osc.connect(gain);
        gain.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.06);
    }

    function playChimeSynth(c, g) {
        var t = c.currentTime;
        [523.25, 659.25, 783.99].forEach(function (freq, i) {
            var osc = c.createOscillator();
            var gn = c.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            var start = t + i * 0.05;
            gn.gain.setValueAtTime(0, start);
            gn.gain.linearRampToValueAtTime(g, start + 0.02);
            gn.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
            osc.connect(gn);
            gn.connect(c.destination);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    }

    function playNoiseBurst(c, g, dur) {
        var t = c.currentTime;
        var len = Math.floor(c.sampleRate * dur);
        var buf = c.createBuffer(1, len, c.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        var src = c.createBufferSource();
        src.buffer = buf;
        var filter = c.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 800;
        var gn = c.createGain();
        gn.gain.value = g;
        src.connect(filter);
        filter.connect(gn);
        gn.connect(c.destination);
        src.start(t);
    }

    function playFlatlineSynth(c, g) {
        var t = c.currentTime;
        var tone = c.createOscillator();
        var gn = c.createGain();
        tone.type = "sine";
        tone.frequency.value = 880;
        gn.gain.setValueAtTime(g * 0.6, t);
        gn.gain.setValueAtTime(g * 0.6, t + 1.2);
        gn.gain.exponentialRampToValueAtTime(0.001, t + 1.35);
        tone.connect(gn);
        gn.connect(c.destination);
        tone.start(t);
        tone.stop(t + 1.4);
        for (var b = 0; b < 4; b++) {
            (function (bi) {
                var start = t + 1.4 + bi * 0.35;
                var o = c.createOscillator();
                var g2 = c.createGain();
                o.type = "square";
                o.frequency.value = 200;
                g2.gain.setValueAtTime(0, start);
                g2.gain.linearRampToValueAtTime(g * 0.15, start + 0.02);
                g2.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
                o.connect(g2);
                g2.connect(c.destination);
                o.start(start);
                o.stop(start + 0.1);
            })(b);
        }
    }

    function playThump(c, gainVal) {
        var t = c.currentTime;
        var osc = c.createOscillator();
        var gn = c.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(55, t);
        osc.frequency.exponentialRampToValueAtTime(38, t + 0.08);
        gn.gain.setValueAtTime(gainVal, t);
        gn.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gn);
        gn.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.16);
    }

    function stopHeartbeatLoop() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        var h = howls.heart_beat;
        if (h) {
            h.stop();
        }
    }

    function startHeartbeatWebLoop(intervalMs, gainVal) {
        stopHeartbeatLoop();
        var c = getAudioContext();
        if (!c || muted) return;
        heartbeatTimer = setInterval(function () {
            if (muted) return;
            playThump(c, effectiveVolume(gainVal));
        }, intervalMs);
    }

    readStorage();

    var SoundManager = {
        play: function (id, opts) {
            unlockAudio();
            opts = opts || {};
            if (id === "heart_beat") {
                this.updateStressHeartbeat(opts.stressLevel != null ? opts.stressLevel : 85);
                return;
            }
            if (id === "intro_ambience") {
                this.startIntroAmbience(opts);
                return;
            }
            var loop = !!opts.loop;
            var h = ensureHowl(id);
            if (h) {
                h.loop(loop);
                h.volume(effectiveVolume(typeof opts.volume === "number" ? opts.volume : 1));
                var sid = h.play();
                return { howl: h, soundId: sid };
            }
            synthFallback(id, opts);
            return null;
        },

        stop: function (id) {
            if (id === "heart_beat") {
                stopHeartbeatLoop();
                var hb = howls.heart_beat;
                if (hb) hb.stop();
                return;
            }
            if (id === "intro_ambience") {
                this.stopIntroAmbienceFade(0);
                return;
            }
            var h = howls[id];
            if (h) {
                try {
                    h.stop();
                } catch (e) {}
            }
        },

        setMuted: function (m) {
            muted = !!m;
            persistMuted();
            if (muted) {
                stopHeartbeatLoop();
                Object.keys(howls).forEach(function (k) {
                    try {
                        howls[k].stop();
                    } catch (e) {}
                });
                this.stopIntroAmbienceFade(0);
            } else {
                unlockAudio();
            }
            if (typeof global.onSoundManagerMuteChange === "function") {
                global.onSoundManagerMuteChange(muted);
            }
        },

        isMuted: function () {
            return muted;
        },

        setMasterVolume: function (v) {
            masterVolume = Math.max(0, Math.min(1, v));
            persistVolume();
            Object.keys(howls).forEach(function (k) {
                try {
                    howls[k].volume(effectiveVolume(1));
                } catch (e) {}
            });
        },

        getMasterVolume: function () {
            return masterVolume;
        },

        toggleMute: function () {
            this.setMuted(!muted);
            return muted;
        },

        updateStressHeartbeat: function (stressLevel) {
            unlockAudio();
            if (muted || stressLevel == null || stressLevel <= 80) {
                stopHeartbeatLoop();
                var hh = howls.heart_beat;
                if (hh) hh.stop();
                return;
            }
            var highStress = stressLevel >= 95;
            var interval = highStress ? 400 : 600;
            var gainBase = highStress ? 0.55 : 0.35;
            var h = ensureHowl("heart_beat");
            if (h && !howlLoadFailed.heart_beat) {
                stopHeartbeatLoop();
                h.stop();
                h.loop(true);
                h.rate(highStress ? 1.25 : 1);
                h.volume(effectiveVolume(highStress ? 0.85 : 0.55));
                h.play();
                return;
            }
            startHeartbeatWebLoop(interval, gainBase);
        },

        startIntroAmbience: function (opts) {
            unlockAudio();
            opts = opts || {};
            if (muted) return;
            this.stopIntroAmbienceFade(0);
            var h = ensureHowl("intro_ambience");
            if (h && !howlLoadFailed.intro_ambience) {
                h.loop(true);
                var targetVol = effectiveVolume(typeof opts.volume === "number" ? opts.volume : 0.35);
                h.volume(0);
                introSoundId = h.play();
                if (introSoundId != null && typeof h.fade === "function") {
                    h.fade(0, targetVol, opts.fadeInMs || 800, introSoundId);
                } else {
                    h.volume(targetVol);
                }
                introHowl = h;
                return;
            }
            introAmbienceSynthLoop();
        },

        stopIntroAmbienceFade: function (durationMs) {
            durationMs = durationMs == null ? 1200 : durationMs;
            if (introFadeTimer) {
                clearTimeout(introFadeTimer);
                introFadeTimer = null;
            }
            stopIntroSynthLoop();
            if (introHowl) {
                try {
                    var sid = introSoundId;
                    if (durationMs <= 0) {
                        if (sid != null) introHowl.stop(sid);
                        else introHowl.stop();
                        introHowl = null;
                        introSoundId = null;
                        return;
                    }
                    var v = introHowl.volume();
                    if (typeof introHowl.fade === "function" && sid != null) {
                        introHowl.fade(v, 0, durationMs, sid);
                    } else if (typeof introHowl.fade === "function") {
                        introHowl.fade(v, 0, durationMs);
                    } else {
                        introHowl.volume(0);
                    }
                    introFadeTimer = setTimeout(function () {
                        if (sid != null) introHowl.stop(sid);
                        else introHowl.stop();
                        introHowl = null;
                        introSoundId = null;
                        introFadeTimer = null;
                    }, durationMs + 100);
                } catch (e) {
                    introHowl.stop();
                    introHowl = null;
                    introSoundId = null;
                }
                return;
            }
        }
    };

    var introSynthTimer = null;
    function stopIntroSynthLoop() {
        if (introSynthTimer) {
            clearInterval(introSynthTimer);
            introSynthTimer = null;
        }
    }

    function introAmbienceSynthLoop() {
        stopIntroSynthLoop();
        var c = getAudioContext();
        if (!c || muted) return;
        function tick() {
            if (muted) return;
            var t = c.currentTime;
            var osc = c.createOscillator();
            var gn = c.createGain();
            osc.type = "sine";
            osc.frequency.value = 60 + Math.random() * 20;
            gn.gain.setValueAtTime(effectiveVolume(0.04), t);
            gn.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gn);
            gn.connect(c.destination);
            osc.start(t);
            osc.stop(t + 0.16);
        }
        tick();
        introSynthTimer = setInterval(tick, 280 + Math.random() * 120);
    }

    global.SoundManager = SoundManager;
    global.addEventListener("click", unlockAudio, { once: true });
    global.addEventListener("keydown", unlockAudio, { once: true });
})(typeof window !== "undefined" ? window : this);
