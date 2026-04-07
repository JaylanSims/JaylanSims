/**
 * Global AudioManager / SoundManager: Howler.js + Web Audio fallbacks.
 * Place files in /public/sounds/ (see SOUND_URLS). Missing files use synth fallbacks where implemented.
 */
(function (global) {
    "use strict";

    var STORAGE_MUTED = "bitbalance_audio_muted";
    var STORAGE_VOL = "bitbalance_audio_volume";

    var SOUND_URLS = {
        ui_click: ["/sounds/ui_click.mp3", "/sounds/ui_click.ogg"],
        money_gain: ["/sounds/money_gain.mp3", "/sounds/money_gain.ogg"],
        money_loss: ["/sounds/money_loss.mp3", "/sounds/money_loss.ogg"],
        heart_attack: ["/sounds/EKG_Flatline.mp3", "/sounds/heart_attack.mp3", "/sounds/heart_attack.ogg"],
        heart_beat: ["/sounds/Heartbeat_Fast.wav", "/sounds/heart_beat.mp3", "/sounds/heart_beat.ogg"],
        cash_register_subtract: ["/sounds/Cash_Register_Subtract.mp3", "/sounds/cash_register_subtract.mp3"],
        stamp_thud: ["/sounds/Stamp_Thud.wav", "/sounds/stamp_thud.wav", "/sounds/stamp_thud.mp3"],
        metal_creak: ["/sounds/Metal_Creak.mp3", "/sounds/metal_creak.mp3"],
        junkyard_crush: ["/sounds/Junkyard_Crush.wav", "/sounds/junkyard_crush.wav", "/sounds/junkyard_crush.mp3"],
        intro_ambience: [
            "/sounds/Intro_Cinematic_Ambient.mp3",
            "/sounds/intro_cinematic_ambient.mp3",
            "/sounds/intro_ambience.mp3",
            "/sounds/intro_ambience.ogg"
        ]
    };

    var muted = false;
    var masterVolume = 1;
    var howls = {};
    var howlLoadFailed = {};
    var ctx = null;
    var heartbeatTimer = null;
    var lastStressHeartbeatLevel = null;
    var lastWebHeartbeatInterval = null;
    var lastWebHeartbeatVolKey = null;
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

    function stressToHeartbeatVolume(stressLevel) {
        var s = Math.max(81, Math.min(100, stressLevel));
        return 0.22 + ((s - 81) / 19) * 0.78;
    }

    function stressToPlaybackRate(stressLevel) {
        var s = Math.max(81, Math.min(100, stressLevel));
        return 1 + ((s - 81) / 19) * 0.35;
    }

    function synthFallback(id) {
        var c = getAudioContext();
        if (!c || muted) return;
        if (id === "ui_click") {
            playClickSynth(c, effectiveVolume(0.35));
        } else if (id === "money_gain") {
            playChimeSynth(c, effectiveVolume(0.25));
        } else if (id === "money_loss" || id === "cash_register_subtract") {
            playNoiseBurst(c, effectiveVolume(0.18), 0.1);
        } else if (id === "stamp_thud") {
            playThump(c, effectiveVolume(0.45));
        } else if (id === "heart_attack") {
            playFlatlineSynth(c, effectiveVolume(0.4));
        } else if (id === "metal_creak") {
            playCreakSynth(c, effectiveVolume(0.35));
        } else if (id === "junkyard_crush") {
            playThump(c, effectiveVolume(0.55));
            setTimeout(function () {
                playNoiseBurst(c, effectiveVolume(0.25), 0.2);
            }, 80);
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

    function playCreakSynth(c, g) {
        var t = c.currentTime;
        var osc = c.createOscillator();
        var gn = c.createGain();
        var filter = c.createBiquadFilter();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.linearRampToValueAtTime(85, t + 0.35);
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.35);
        filter.Q.value = 6;
        gn.gain.setValueAtTime(0, t);
        gn.gain.linearRampToValueAtTime(g, t + 0.05);
        gn.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(filter);
        filter.connect(gn);
        gn.connect(c.destination);
        osc.start(t);
        osc.stop(t + 0.42);
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

    function clearWebHeartbeatTimer() {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        lastWebHeartbeatInterval = null;
        lastWebHeartbeatVolKey = null;
    }

    function stopStressHeartbeatFull() {
        clearWebHeartbeatTimer();
        var h = howls.heart_beat;
        if (h) {
            try {
                h.stop();
            } catch (e) {}
        }
    }

    function startHeartbeatWebLoop(intervalMs, gainVal) {
        clearWebHeartbeatTimer();
        var c = getAudioContext();
        if (!c || muted) return;
        heartbeatTimer = setInterval(function () {
            if (muted) return;
            playThump(c, effectiveVolume(gainVal));
        }, intervalMs);
    }

    function playOneShot(id, volMult) {
        unlockAudio();
        volMult = typeof volMult === "number" ? volMult : 1;
        var h = ensureHowl(id);
        if (h && !howlLoadFailed[id]) {
            h.loop(false);
            h.volume(effectiveVolume(volMult));
            h.play();
            return;
        }
        synthFallback(id);
    }

    readStorage();

    var api = {
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
            if (id === "tax_reaper") {
                this.playTaxReaperSequence();
                return;
            }
            var loop = !!opts.loop;
            var h = ensureHowl(id);
            if (h && !howlLoadFailed[id]) {
                h.loop(loop);
                h.volume(effectiveVolume(typeof opts.volume === "number" ? opts.volume : 1));
                h.play();
                return;
            }
            synthFallback(id);
        },

        playTaxReaperSequence: function () {
            unlockAudio();
            if (muted) return;
            var playedStamp = false;
            function doStamp() {
                if (playedStamp) return;
                playedStamp = true;
                var hs = ensureHowl("stamp_thud");
                if (hs && !howlLoadFailed.stamp_thud) {
                    hs.loop(false);
                    hs.volume(effectiveVolume(0.92));
                    hs.play();
                } else {
                    synthFallback("stamp_thud");
                }
            }
            var reg = ensureHowl("cash_register_subtract");
            if (reg && !howlLoadFailed.cash_register_subtract) {
                reg.loop(false);
                reg.volume(effectiveVolume(0.88));
                reg.play();
                global.setTimeout(doStamp, 420);
                return;
            }
            synthFallback("cash_register_subtract");
            global.setTimeout(doStamp, 180);
        },

        stop: function (id) {
            if (id === "heart_beat") {
                lastStressHeartbeatLevel = null;
                stopStressHeartbeatFull();
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
                lastStressHeartbeatLevel = null;
                stopStressHeartbeatFull();
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
            if (typeof global.onAudioManagerMuteChange === "function") {
                global.onAudioManagerMuteChange(muted);
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
                    if (k === "heart_beat" && lastStressHeartbeatLevel != null) {
                        api.updateStressHeartbeat(lastStressHeartbeatLevel);
                    } else {
                        howls[k].volume(effectiveVolume(1));
                    }
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
                lastStressHeartbeatLevel = null;
                stopStressHeartbeatFull();
                return;
            }
            lastStressHeartbeatLevel = stressLevel;
            var vol = stressToHeartbeatVolume(stressLevel);
            var rate = stressToPlaybackRate(stressLevel);
            var h = ensureHowl("heart_beat");
            if (h && !howlLoadFailed.heart_beat) {
                clearWebHeartbeatTimer();
                var alreadyPlaying = false;
                try {
                    alreadyPlaying = typeof h.playing === "function" && h.playing();
                } catch (e2) {}
                if (alreadyPlaying) {
                    h.rate(rate);
                    h.volume(effectiveVolume(vol));
                    return;
                }
                h.loop(true);
                h.rate(rate);
                h.volume(effectiveVolume(vol));
                h.play();
                return;
            }
            var interval = Math.max(280, Math.round(520 - (stressLevel - 80) * 12));
            var volKey = Math.round(vol * 100) + ":" + interval;
            if (heartbeatTimer && lastWebHeartbeatInterval === interval && lastWebHeartbeatVolKey === volKey) {
                return;
            }
            lastWebHeartbeatInterval = interval;
            lastWebHeartbeatVolKey = volKey;
            startHeartbeatWebLoop(interval, vol);
        },

        startIntroAmbience: function (opts) {
            unlockAudio();
            opts = opts || {};
            if (muted) return;
            this.stopIntroAmbienceFade(0);
            var h = ensureHowl("intro_ambience");
            if (h && !howlLoadFailed.intro_ambience) {
                h.loop(true);
                var targetVol = effectiveVolume(typeof opts.volume === "number" ? opts.volume : 0.38);
                h.volume(0);
                introSoundId = h.play();
                if (introSoundId != null && typeof h.fade === "function") {
                    h.fade(0, targetVol, opts.fadeInMs || 900, introSoundId);
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
        },

        playVehicleDegrade: function () {
            playOneShot("metal_creak", 0.85);
        },

        playVehicleScrapped: function () {
            playOneShot("junkyard_crush", 1);
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

    global.SoundManager = api;
    global.AudioManager = api;
    global.addEventListener("click", unlockAudio, { once: true });
    global.addEventListener("keydown", unlockAudio, { once: true });
})(typeof window !== "undefined" ? window : this);
