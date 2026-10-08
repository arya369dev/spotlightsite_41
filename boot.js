/* Decides before first paint whether the intro film should show,
   so returning visitors and ad clicks never see a black flash. */
(function () {
  try {
    var q = location.search, seen = sessionStorage.getItem("sl-intro-seen");
    var ad = /[?&](utm_|fbclid|gclid)/.test(q);
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!seen && !ad && !calm && !location.hash) document.documentElement.classList.add("intro-pending");
  } catch (e) {}
})();
