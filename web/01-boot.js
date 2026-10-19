
/* ===== MAYA DEBUG EYES: console errors bhi badge par ===== */
window.__errLog = [];
window.__consoleErr = function(m){
  try {
    var t = String(m);
    /* v5.10.1 — Chrome ka apna be-noor shor badge par NAHI aana chahiye.
       "Ignored attempt to cancel a touchstart/touchmove event with
       cancelable=false" WebView ka internal warning hai, Maya ka bug nahi.
       Ye badge ko ⚠1 kar ke ghalat khauf dikhata tha (video review, 2026-10-19). */
    if (/Ignored attempt to cancel a (touchstart|touchmove|touchend|mousewheel|wheel) event with cancelable\s*=\s*false/i.test(t)) return;
    window.__errLog.push(t.slice(0, 300));
    if (window.__errLog.length > 30) window.__errLog.shift();
    /* v4.2.0: poora raw error user ke munh par nahi maarte — sirf chhota nishan.
       Tafseel Settings -> DOCTOR mein milti hai (aur badge tap karne par). */
    var b = document.getElementById("dbgBadge");
    if (b) { b.textContent = "\u26A0 " + window.__errLog.length; b.style.color = "#FFC24B"; b.title = t.slice(0, 200); }
  } catch (x) {}
};
/* ===== MAYA BOOT-GUARD (Doctor Build) — ye script sab se pehle chalti hai =====
   Agar main app script crash ho jaye to error screen par dikhta hai + FORCE ENTRY milti hai */
window.__mayaErr = null;
window.__mayaJSOK = false;
/* v4.1.0: WebView ke Chrome major version ka detect — old WebView = inset/color-mix support nahi */
window.__webviewMajor = (function(){
  var m = String(navigator.userAgent || "").match(/Chrome\/(\d+)\./);
  return m ? parseInt(m[1], 10) : 0;
})();
window.__oldWebview = window.__webviewMajor > 0 && window.__webviewMajor < 87;
/* v4.1.0: seedha feature-detect (UA se zyada bharosa mand) — jo CSS support na ho
   uske liye <html> par class lag jati hai, taake plain-CSS fallback chal sake. */
window.__cssOK = function(prop, val){
  try { return !!(window.CSS && window.CSS.supports && window.CSS.supports(prop, val)); }
  catch (e) { return false; }
};
window.__noColorMix  = !window.__cssOK("background-color", "color-mix(in srgb,red 50%,blue)");
window.__noAccentCol = !window.__cssOK("accent-color", "red");
window.__noFlexGap   = !window.__cssOK("row-gap", "1px");
window.__compatClass =
  (window.__noColorMix  ? " nocm"  : "") +
  (window.__noAccentCol ? " noacc" : "") +
  (window.__noFlexGap   ? " nogap" : "") +
  (window.__oldWebview  ? " oldwv" : "");
try { document.documentElement.className += window.__compatClass; } catch (e) {}
window.onerror = function(m, s, l, c, e){
  window.__mayaErr = (m || "unknown error") + " (line " + (l || "?") + ")";
  try {
    var p = document.getElementById("errPanel");
    if (p) { p.style.display = "block"; var t = document.getElementById("errText"); if (t) t.textContent = window.__mayaErr; }
  } catch (x) {}
  return false;
};
function __mayaForceEnter(){
  try {
    document.getElementById("splash").classList.add("gone");
    document.getElementById("app").classList.add("on");
  } catch (x) {}
}
setTimeout(function(){ try { __mayaForceEnter(); } catch (x) {} }, 4000);
setTimeout(function(){
  if (!window.__mayaJSOK) {
    var p = document.getElementById("errPanel");
    if (p) { p.style.display = "block"; var t = document.getElementById("errText"); if (t) t.textContent = window.__mayaErr || "App ka main script load nahi hua. 99% wajah: PURANA WebView. Hal: Play Store kholo -> 'Android System WebView' update karo -> phone restart -> MAYA kholo"; }
  }
}, 7000);
