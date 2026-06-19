/*******************************************************************************
 * YouTube Ad Blocker — MAIN world script
 * Runs in MAIN world for:
 * 1. yAEB param injection (prevents server-side ads)
 * 2. Direct YouTube player API ad skipping (instant, no delay)
 ******************************************************************************/

(function () {
  "use strict";

  // =========================================================================
  // 1. Intercept JSON.stringify to modify playback context
  // =========================================================================
  try {
    const origStringify = JSON.stringify;
    JSON.stringify = function (value, replacer, space) {
      if (value && typeof value === "object") {
        try {
          const pbc = value?.playbackContext?.contentPlaybackContext;
          if (
            pbc &&
            !value?.attestationRequest &&
            !value?.captionsRequested &&
            !value?.settingItemIds
          ) {
            const graftUrl =
              value?.serviceIntegrityDimensions?.mainAppWebInfo?.graftUrl ||
              value?.context?.client?.mainAppWebInfo?.graftUrl ||
              "";
            if (
              !graftUrl.includes("&list=") &&
              !graftUrl.includes("/shorts/")
            ) {
              if (typeof value.params === "string") {
                if (!value.params.startsWith("yAEB")) {
                  value.params = "yAEB" + value.params;
                }
              } else if (!value.params) {
                value.params = "yAEB";
              }
            }
          }
        } catch (e) {}
      }
      return origStringify.call(this, value, replacer, space);
    };
    Object.keys(origStringify).forEach((key) => {
      JSON.stringify[key] = origStringify[key];
    });
  } catch (e) {}

  // =========================================================================
  // 2. Direct YouTube Player API ad skipping
  //    In MAIN world we have access to the actual player object and its
  //    internal methods: skipAd, seekTo, getDuration, getAdState, etc.
  // =========================================================================
  function getPlayer() {
    return document.getElementById("movie_player");
  }

  function isAdPlaying() {
    const p = getPlayer();
    if (!p) return false;
    // Class-based detection
    if (p.classList.contains("ad-showing") || p.classList.contains("ad-interrupting")) {
      return true;
    }
    // API-based detection
    try {
      // getAdState: 1 = ad playing
      if (typeof p.getAdState === "function" && p.getAdState() === 1) return true;
    } catch (e) {}
    return false;
  }

  function forceSkipAd() {
    const p = getPlayer();
    if (!p) return;

    // Mute ad audio immediately
    const video = p.querySelector("video");
    if (video) {
      video.muted = true;
      video.volume = 0;
    }

    // Method 1: Direct skipAd API call (most reliable)
    try {
      if (typeof p.skipAd === "function") {
        p.skipAd();
        return;
      }
    } catch (e) {}

    // Method 2: cancelPlayback + loadVideoById to reload the real video
    try {
      if (typeof p.getVideoData === "function" && typeof p.loadVideoById === "function") {
        const data = p.getVideoData();
        if (data && data.video_id) {
          const currentTime = (typeof p.getCurrentTime === "function") ? p.getCurrentTime() : 0;
          p.loadVideoById(data.video_id, currentTime);
          return;
        }
      }
    } catch (e) {}

    // Method 3: Seek to end of ad via player API
    try {
      if (typeof p.getDuration === "function" && typeof p.seekTo === "function") {
        const dur = p.getDuration();
        if (dur && isFinite(dur) && dur > 0) {
          p.seekTo(dur, true);
          return;
        }
      }
    } catch (e) {}

    // Method 4: Seek via video element as last resort
    if (video && video.duration && isFinite(video.duration) && video.duration > 0) {
      video.currentTime = video.duration;
    }
  }

  // Click any visible skip buttons
  function clickSkipButton() {
    const selectors = [
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button",
      ".ytp-ad-skip-button-modern",
      ".ytp-ad-skip-button-slot button",
      ".ytp-ad-skip-button-container button",
      ".ytp-ad-overlay-close-button",
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function handleAd() {
    if (!isAdPlaying()) return;
    if (!clickSkipButton()) {
      forceSkipAd();
    }
  }

  // =========================================================================
  // 3. Monitoring — MutationObserver on player + fast interval + video events
  // =========================================================================
  let started = false;

  function startMonitoring() {
    if (started) return;
    started = true;

    // Immediate check
    handleAd();

    // Watch player class changes
    const p = getPlayer();
    if (p) {
      const obs = new MutationObserver(() => handleAd());
      obs.observe(p, { attributes: true, attributeFilter: ["class"] });

      // Watch video events
      const video = p.querySelector("video");
      if (video) {
        video.addEventListener("playing", handleAd);
        video.addEventListener("loadeddata", handleAd);
        video.addEventListener("timeupdate", handleAd);
      }
    }

    // Fast fallback interval (50ms) — handleAd exits instantly when no ad
    setInterval(handleAd, 50);
  }

  // Wait for player to exist, then start
  function waitForPlayer() {
    if (getPlayer()) {
      startMonitoring();
    } else {
      const obs = new MutationObserver(() => {
        if (getPlayer()) {
          obs.disconnect();
          startMonitoring();
        }
      });
      obs.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });
      // Fallback
      setTimeout(waitForPlayer, 500);
    }
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    waitForPlayer();
  } else {
    document.addEventListener("DOMContentLoaded", waitForPlayer);
  }
})();
