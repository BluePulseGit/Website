/* ============================================================
   pitch-decks.js — baked pitch-deck registry (read by the viewer)
   ------------------------------------------------------------
   Recipients open the viewer with an empty browser, so deck data
   must live here (committed), NOT only in the admin's localStorage.

   The admin "Pitch Decks" tab edits a live copy in localStorage for
   preview, then "Export for launch" regenerates this file's contents
   for you to paste in and commit. Same pattern as Copy Editor / Social Links.

   SECURITY NOTE: the `password` field below is client-side obscurity only
   (anyone can view-source). Real protection is Cloudflare Access on the
   viewer path — see ADMIN-ACCESS.md.

   Deck fields:
     slug        unique, random — used as ?d=<slug> in the viewer link
     title       shown in the viewer + browser tab
     mode        'canva'  → live Canva embed (Canva's own arrows + click-to-play audio)
                 'video'  → hosted MP4 in our player (our arrows + audio-on at entry)
     canvaUrl    the Canva /view URL (for mode 'canva')
     videoUrl    path/URL to the MP4 (for mode 'video'), e.g. assets/decks/stay-home.mp4
     poster      optional poster image for video mode
     companies   array of production-company names listed on the page
     logline     one-line description under the title
     visibility  'unlisted' (link-only, noindex) | 'password' (blurred gate)
     password    client-side gate value (obscurity; pair with Cloudflare Access)
     ambient     optional path/URL to an ambient background loop (mp3), e.g. assets/decks/stay-home-amb.mp3
     ambientVol  0..1 starting volume for the ambient loop
   ============================================================ */
window.BPS_PITCH_DECKS = [
  {
    slug: "stay-home-9f3x2k",
    title: "Stay Home",
    mode: "canva",
    canvaUrl: "https://www.canva.com/design/DAE9zdsIcsw/l6fiHom7Au4ruq2kDvTFlg/view?embed",
    videoUrl: "",
    poster: "",
    companies: ["Blue Pulse Studios"],
    logline: "A feature pitch — patient dread, handmade horror.",
    visibility: "password",
    password: "stayhome2026",
    ambient: "",
    ambientVol: 0.35
  }
];
