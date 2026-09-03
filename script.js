/* ============================================================
   Yubo Zhang — Portfolio
   script.js

   三个功能：
   ① 滚离首屏后导航浮现
   ② 项目封面多图轮播
   ③ 视频只在滚进视口时播放

   三个都建立在同一个 API 上：IntersectionObserver。
   它让浏览器替我们监视"某个元素是否进入了视口"，
   比自己监听 scroll 事件高效得多 —— 见文件底部说明。

   AI 使用说明：三个功能的实现方案与注释由 Claude 提议并解释；
   时间参数（轮播间隔、触发阈值）由我在浏览器中试出来后确定。
   详见 prompt-log.md
   ============================================================ */


/* ---- 可调参数。想改节奏改这里，不用翻代码 ---- */
const CAROUSEL_INTERVAL = 3200;   // 轮播每张停留毫秒数
const NAV_THRESHOLD     = 0.4;    // 首屏可见面积低于 40% 时，导航出现
const MEDIA_THRESHOLD   = 0.3;    // 封面露出 30% 时开始播放

/* 用户在系统设置里开了"减弱动态效果"吗？
   开了的话，轮播和视频都不自动播 —— WCAG 要求，不是可选的礼貌。 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ① 导航浮现 ------------------------------------------------
   首屏（#intro）大部分离开视口时，给导航加上 .is-visible。
   CSS 负责淡入和下滑动画，JS 只管切换这个 class ——
   动画交给 CSS、状态交给 JS，是常见的分工。
   ------------------------------------------------------------ */
const nav = document.querySelector('[data-nav]');
const intro = document.querySelector('#intro');

if (nav && intro) {
  const navObserver = new IntersectionObserver(
    (entries) => {
      const introIsVisible = entries[0].isIntersecting;
      // 首屏可见 → 隐藏导航；首屏滚走了 → 显示导航
      nav.classList.toggle('is-visible', !introIsVisible);
    },
    { threshold: NAV_THRESHOLD }
  );

  navObserver.observe(intro);
}
// 注意：info.html 和详情页没有 #intro，上面的 if 会直接跳过，
// 那些页面的导航靠 HTML 里写死的 class="nav is-visible" 常驻显示。


/* ② 封面轮播 ------------------------------------------------
   HTML 里所有图叠在一起，只有带 .is-active 的那张不透明（CSS 控制）。
   这里做的事就是轮流把 .is-active 从一张移到下一张。
   ------------------------------------------------------------ */
const carousels = document.querySelectorAll('[data-carousel]');

carousels.forEach((carousel) => {
  const slides = carousel.querySelectorAll('img');

  // 只有一张图就没什么可轮播的，直接跳过
  if (slides.length < 2) return;

  let index = 0;
  let timer = null;

  function advance() {
    slides[index].classList.remove('is-active');
    // % 取余：走到最后一张后回到 0，形成循环
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

  if (reduceMotion) return;   // 减弱动态效果时，永远只显示第一张

  // 只有滚进视口才跑定时器。看不见的地方没必要消耗性能。
  const carouselObserver = new IntersectionObserver(
    (entries) => {
      entries[0].isIntersecting ? start() : stop();
    },
    { threshold: MEDIA_THRESHOLD }
  );

  carouselObserver.observe(carousel);
});


/* ③ 视频按需播放 ---------------------------------------------
   如果四个封面视频同时自动播，笔记本风扇会响、手机会烫会掉电。
   所以只播用户正在看的那一个。
   ------------------------------------------------------------ */
const videos = document.querySelectorAll('.project__media video');

videos.forEach((video) => {
  if (reduceMotion) return;   // 减弱动态效果时只显示 poster 静帧

  const videoObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        // play() 返回一个 Promise，可能被浏览器拒绝
        // （比如 iPhone 开了低电量模式）。不接住就会在控制台报错。
        video.play().catch(() => { /* 播不了就保持 poster，不是错误 */ });
      } else {
        video.pause();
      }
    },
    { threshold: MEDIA_THRESHOLD }
  );

  videoObserver.observe(video);
});


/* ④ 切到别的标签页时暂停 -------------------------------------
   IntersectionObserver 只管"在不在视口里"，管不了"用户切走了标签页"。
   不处理的话，视频会在后台标签里一直播，白耗电。
   ------------------------------------------------------------ */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    videos.forEach((video) => video.pause());
  }
  // 切回来时不主动恢复播放 —— 交给 IntersectionObserver 判断，
  // 因为用户切回来时未必还停在原来的位置。
});


/* ============================================================
   附：为什么用 IntersectionObserver，不用 scroll 事件

   传统写法是监听 window 的 scroll 事件，每次触发时手动算元素位置：

     window.addEventListener('scroll', () => {
       const rect = el.getBoundingClientRect();
       if (rect.top < window.innerHeight) { ... }
     });

   两个问题：
   1. scroll 事件触发极其频繁 —— 滚一下可能几十上百次。每次都跑
      JS 计算，容易掉帧。
   2. getBoundingClientRect() 会强制浏览器重新计算布局
      （叫 layout thrashing），是性能杀手。

   IntersectionObserver 把这件事交给浏览器底层去做，在合成线程上
   异步判断，不阻塞主线程，只在状态真正变化时通知你一次。

   这是 2019 年之后的标准做法，但网上大量教程还停留在 scroll 事件。
   ============================================================ */