/* ============================================================
   Yubo Zhang — Portfolio
   script.js

   Three features:
   ① the nav appears once you scroll past the intro
   ② multi-image carousels on the project covers
   ③ videos only play once they scroll into the viewport

   All three are built on the same API: IntersectionObserver.
   It has the browser watch "has this element entered the viewport" for us,
   far more efficiently than listening to scroll events ourselves — see the note at the bottom of this file.

   AI disclosure: the implementation approach for all three, and the comments, were proposed and explained by Claude;
   the timing values (carousel interval, trigger thresholds) I settled myself after trying them out in the browser.
   See prompt-log.md
   ============================================================ */


/* ---- Tunable parameters. Change the pacing here, no need to dig through the code ---- */
const CAROUSEL_INTERVAL = 3200;   // milliseconds each carousel slide stays up
const NAV_THRESHOLD     = 0.4;    // the nav appears once under 40% of the intro is visible
const MEDIA_THRESHOLD   = 0.3;    // start playing once 30% of the cover is showing

/* Has the user switched on "reduce motion" in their system settings?
   If so, neither the carousel nor the videos autoplay — a WCAG requirement, not optional politeness. */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ① NAV REVEAL ----------------------------------------------
   Once most of the intro (#intro) has left the viewport, add .is-visible to the nav.
   CSS handles the fade and slide animation, JS only toggles this class —
   animation to CSS, state to JS, the usual division of labour.
   ------------------------------------------------------------ */
const nav = document.querySelector('[data-nav]');
const intro = document.querySelector('#intro');

if (nav && intro) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      const introIsVisible = entries[0].isIntersecting;
      // intro visible → hide the nav; intro scrolled away → show the nav
      nav.classList.toggle('is-visible', !introIsVisible);
    },
    { threshold: NAV_THRESHOLD }
  );

  navObserver.observe(intro);
}

/* ①b Hard intro ↔ Projects switch ---------------------------
   Design intent: no half-intro, half-projects in-between state is allowed.
   Only this one jump is taken over; scrolling inside the Projects section is left entirely alone —
   a precision that pure CSS scroll-snap: mandatory cannot achieve.
   ------------------------------------------------------------ */
const projectsSection = document.querySelector('#projects');

if (intro && projectsSection && !reduceMotion) {
  let lastY = window.scrollY;
  let locked = false;   // while the script is scrolling, don't let it trigger itself

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const goingDown = y > lastY;
    lastY = y;

    if (locked) return;

    const introHeight = intro.offsetHeight;
    const inBetween = y > 8 && y < introHeight * 0.9;   // sitting in the "in-between state"

    if (!inBetween) return;

    locked = true;
    if (goingDown) {
      projectsSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // smooth scrolling takes about 600ms, so leave some margin before unlocking
    setTimeout(() => { locked = false; lastY = window.scrollY; }, 900);
  }, { passive: true });
}
// Note: info.html and the detail pages have no #intro, so the if above is simply skipped,
// and the nav on those pages stays visible via a hard-coded class="nav is-visible" in the HTML.


/* ② COVER CAROUSEL ------------------------------------------
   In the HTML every image is stacked on the others, and only the one carrying .is-active is opaque (CSS does that).
   All this does is move .is-active from one image to the next, in turn.
   ------------------------------------------------------------ */
const carousels = document.querySelectorAll('[data-carousel]');

carousels.forEach((carousel) => {
  const slides = carousel.querySelectorAll('img');

  // with only one image there is nothing to rotate, so skip it
  if (slides.length < 2) return;

  let index = 0;
  let timer = null;

  function advance() {
    slides[index].classList.remove('is-active');
    // % modulo: after the last slide it wraps back to 0, forming a loop
    index = (index + 1) % slides.length;
    slides[index].classList.add('is-active');
  }

  function start() {
    if (timer === null) {
      timer = setInterval(advance, CAROUSEL_INTERVAL);
    }
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  if (reduceMotion) return;   // with reduced motion, only ever show the first image

  // Only run the timer once it has scrolled into view. No point spending performance where nothing is visible.
  const carouselObserver = new IntersectionObserver(
    (entries) => {
      entries[0].isIntersecting ? start() : stop();
    },
    { threshold: MEDIA_THRESHOLD }
  );

  carouselObserver.observe(carousel);
});


/* ③ VIDEO ON DEMAND ------------------------------------------
   If all four cover videos autoplayed at once, laptop fans would spin up and phones would get hot and lose charge.
   So only the one the user is actually looking at plays.
   ------------------------------------------------------------ */
/* data-autoplay is the hook: any video on any page that should "only play once in view" just gets this attribute.
   A data attribute rather than a class, because classes belong to CSS, and restyling shouldn't accidentally break behaviour. */
const videos = document.querySelectorAll('video[data-autoplay]');

videos.forEach((video) => {
  if (reduceMotion) return;   // with reduced motion, show only the poster still frame

  const videoObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // play() returns a Promise, which the browser may reject
        // (an iPhone in low power mode, for instance). Uncaught, it throws an error in the console.
        video.play().catch(() => { /* if it can't play, keep the poster; that's not an error */ });
      } else {
        video.pause();
      }
    },
    { threshold: MEDIA_THRESHOLD }
  );

  videoObserver.observe(video);
});


/* ④ PAUSE WHEN THE TAB IS HIDDEN -----------------------------
   IntersectionObserver only knows "is it in the viewport", not "has the user switched tabs".
   Left unhandled, a video keeps playing in a background tab, wasting battery.
   ------------------------------------------------------------ */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    videos.forEach((video) => video.pause());
  }
  // Coming back does not actively resume playback — that call is left to IntersectionObserver,
  // because the user may no longer be at the same position when they switch back.
});


/* ============================================================
   Appendix: why IntersectionObserver rather than scroll events

   The traditional way is to listen to window's scroll event and work out the element's position by hand on every fire:

     window.addEventListener('scroll', () => {
       const rect = el.getBoundingClientRect();
       if (rect.top < window.innerHeight) { ... }
     });

   Two problems:
   1. The scroll event fires extremely often — one flick can be dozens or hundreds of times. Running
      JS calculations on each of them drops frames easily.
   2. getBoundingClientRect() forces the browser to recalculate layout
      (this is called layout thrashing), which is a performance killer.

   IntersectionObserver hands the job down to the browser internals, deciding asynchronously on
   the compositor thread, never blocking the main thread, notifying you once and only when the state really changes.

   This has been the standard approach since 2019, but a great many tutorials online are still stuck on scroll events.
   ============================================================ */