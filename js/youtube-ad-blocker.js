/*******************************************************************************
 * YouTube Ad Blocker — ISOLATED world content script
 * Runs at document_start on YouTube pages.
 *
 * This script handles CSS-only ad hiding. All ad skipping logic is in the
 * MAIN world script which has access to YouTube's player API.
 ******************************************************************************/

(function () {
  "use strict";

  // =========================================================================
  // CSS injection — hide ad overlays, banners, and companion ads
  // =========================================================================
  const css = `
    /* Pre-roll / mid-roll ad UI elements */
    .ytp-ad-module,
    .ytp-ad-overlay-container,
    .ytp-ad-overlay-slot,
    .ytp-ad-text-overlay,
    .ytp-ad-image-overlay,
    .ytp-ad-player-overlay,
    .ytp-ad-player-overlay-instream-info,
    .ytp-ad-action-interstitial,
    .ytp-ad-action-interstitial-slot,
    .ytp-ad-survey,
    .ytp-ad-feedback-dialog-container,
    .ytp-ad-visit-advertiser-button,
    .ytp-ad-persistent-progress-bar-container,
    .ytp-ad-timed-pie-countdown-container,
    .ytp-ad-overlay-close-container,
    .ytp-ad-overlay-ad-info-button-container,
    .ytp-suggested-action,
    .ytp-featured-product,
    .ytp-ad-skip-button-slot,
    .video-ads,
    /* Companion banners & feed ads */
    #player-ads,
    #masthead-ad,
    ytd-ad-slot-renderer,
    ytd-banner-promo-renderer,
    ytd-in-feed-ad-layout-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-promoted-video-renderer,
    ytd-display-ad-renderer,
    ytd-video-masthead-ad-v3-renderer,
    ytd-primetime-promo-renderer,
    ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"],
    ytd-merch-shelf-renderer {
      display: none !important;
    }

    /* Remove the ad-showing progress bar yellow color */
    .ad-showing .ytp-play-progress {
      background-color: red !important;
    }
  `;

  const injectCSS = () => {
    if (document.getElementById("yt-ad-blocker-css")) return;
    const style = document.createElement("style");
    style.id = "yt-ad-blocker-css";
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  };

  if (document.head) {
    injectCSS();
  } else {
    const headObserver = new MutationObserver(() => {
      if (document.head) {
        headObserver.disconnect();
        injectCSS();
      }
    });
    headObserver.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }
})();
