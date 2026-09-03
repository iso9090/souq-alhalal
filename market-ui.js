// market-ui-v35.js
// تحسين واجهة سوق الحلال فقط بدون تغيير منطق Firebase أو المزايدات.
// تم إصلاح مشكلة التكرار التي كانت تسبب تعليق الصفحة.

(function () {
  "use strict";

  const SVG = {
    market: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M6 7l1-3h10l1 3M5 7v13h14V7M9 11h6M9 15h6"/>
      </svg>`,
    location: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.4 6-11a6 6 0 1 0-12 0c0 5.6 6 11 6 11z"/>
        <circle cx="12" cy="10" r="2"/>
      </svg>`,
    direct: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h2l2 10h10l3-7H7"/>
        <circle cx="9" cy="19" r="1.3"/>
        <circle cx="17" cy="19" r="1.3"/>
      </svg>`,
    auction: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5l5 5m-3-7 7 7m-2-9 5 5-4 4-5-5zM12 10l-7 7M3 20h11"/>
      </svg>`,
    reset: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/>
        <path d="M4 4v4.6h4.6"/>
      </svg>`,
    check: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <path d="M8 12.3l2.6 2.6L16.5 9"/>
      </svg>`
  };

  const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

  function cleanText(value) {
    return String(value || "")
      .replace(emojiPattern, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function iconWrap(svg, className = "") {
    return `<span class="market-line-icon ${className}">${svg}</span>`;
  }

  function improveMarket() {
    const market = document.getElementById("firebase-market");
    if (!market) return;

    const content = market.firstElementChild;
    if (!content) return;

    const topHeading = content.querySelector(":scope > h2:first-of-type");
    if (topHeading && !topHeading.dataset.uiCleaned) {
      topHeading.innerHTML = `${iconWrap(SVG.market, "gold")}<span>سوق الحلال</span>`;
      topHeading.classList.add("market-heading", "market-heading-main");
      topHeading.dataset.uiCleaned = "1";
    }

    market.querySelectorAll("#market-filters option").forEach(option => {
      const cleaned = cleanText(option.textContent);
      if (option.textContent !== cleaned) option.textContent = cleaned;
    });

    const resetButton = market.querySelector('#market-filters button[onclick*="resetMarketFilters"]');
    if (resetButton && !resetButton.dataset.uiCleaned) {
      resetButton.innerHTML = `${iconWrap(SVG.reset)}<span>إظهار الكل</span>`;
      resetButton.classList.add("market-reset-button");
      resetButton.dataset.uiCleaned = "1";
    }

    const direct = document.getElementById("direct-sales");
    if (direct) {
      const heading = direct.previousElementSibling;
      if (heading && heading.tagName === "H2" && !heading.dataset.uiCleaned) {
        heading.innerHTML = `${iconWrap(SVG.direct, "gold")}<span>البيع المباشر</span>`;
        heading.classList.add("market-heading", "market-section-heading");
        heading.dataset.uiCleaned = "1";
      }
    }

    const auction = document.getElementById("auction-list");
    if (auction) {
      const heading = auction.previousElementSibling;
      if (heading && heading.tagName === "H2" && !heading.dataset.uiCleaned) {
        heading.innerHTML = `${iconWrap(SVG.auction, "gold")}<span>المزاد الإلكتروني</span>`;
        heading.classList.add("market-heading", "market-section-heading");
        heading.dataset.uiCleaned = "1";
      }
    }

    const status = document.getElementById("firebase-status");
    if (status) {
      const raw = cleanText(status.textContent);

      if (raw.includes("متصل بالسوق")) {
        if (
          status.dataset.uiStatus !== raw ||
          !status.classList.contains("market-status-clean")
        ) {
          status.innerHTML = `${iconWrap(SVG.check)}<span>${raw}</span>`;
          status.classList.add("market-status-clean");
          status.dataset.uiStatus = raw;
        }
      } else {
        status.classList.remove("market-status-clean");
        delete status.dataset.uiStatus;

        if (status.textContent !== raw) {
          status.textContent = raw;
        }
      }
    }

    market.querySelectorAll("#direct-sales p, #auction-list p").forEach(p => {
      if (p.dataset.locationCleaned) return;

      const text = p.textContent || "";
      if (text.includes("📍")) {
        p.innerHTML = `${iconWrap(SVG.location, "location")}<span>${cleanText(text)}</span>`;
        p.classList.add("market-location-row");
        p.dataset.locationCleaned = "1";
      }
    });
  }

  function installStyles() {
    if (document.getElementById("market-ui-v35-style")) return;

    const style = document.createElement("style");
    style.id = "market-ui-v35-style";
    style.textContent = `
      #firebase-market .market-heading{
        display:flex !important;
        align-items:center !important;
        gap:10px !important;
        color:#0b6847 !important;
      }

      #firebase-market .market-heading-main{
        justify-content:center !important;
      }

      #firebase-market .market-section-heading{
        justify-content:flex-start !important;
      }

      #firebase-market .market-line-icon{
        width:28px;
        height:28px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        flex:0 0 28px;
        color:#0b6847;
      }

      #firebase-market .market-line-icon.gold{
        color:#b88624;
      }

      #firebase-market .market-line-icon svg{
        width:100%;
        height:100%;
        fill:none;
        stroke:currentColor;
        stroke-width:1.8;
        stroke-linecap:round;
        stroke-linejoin:round;
      }

      #firebase-market .market-reset-button{
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        gap:8px !important;
      }

      #firebase-market .market-reset-button .market-line-icon{
        width:21px;
        height:21px;
        flex-basis:21px;
      }

      #firebase-market .market-status-clean{
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        gap:7px !important;
        color:#69746e !important;
      }

      #firebase-market .market-status-clean .market-line-icon{
        width:20px;
        height:20px;
        flex-basis:20px;
        color:#0b8057;
      }

      #firebase-market .market-location-row{
        display:flex !important;
        align-items:center !important;
        gap:7px !important;
      }

      #firebase-market .market-location-row .market-line-icon{
        width:20px;
        height:20px;
        flex-basis:20px;
        color:#b88624;
      }

      /* توحيد بطاقات البيع والمزاد */
      #firebase-market #direct-sales,
      #firebase-market #auction-list{
        align-items:stretch !important;
      }

      #firebase-market #direct-sales > div,
      #firebase-market #auction-list > div{
        display:flex !important;
        flex-direction:column !important;
        height:100% !important;
        box-sizing:border-box !important;
      }

      /* حاوية الصورة والصورة بنفس الارتفاع لمنع الفراغ الرمادي */
      #firebase-market #direct-sales > div > div:first-child,
      #firebase-market #auction-list > div > div:first-child{
        height:auto !important;
        min-height:0 !important;
        padding:0 !important;
        overflow:hidden !important;
        border-radius:16px !important;
        background:#eee9df !important;
      }

      #firebase-market #direct-sales > div > div:first-child img,
      #firebase-market #auction-list > div > div:first-child img{
        width:100% !important;
        height:auto !important;
        min-height:0 !important;
        max-height:none !important;
        object-fit:contain !important;
        object-position:center !important;
        display:block !important;
        border-radius:16px !important;
      }

      /* إعلان بدون صورة */
      #firebase-market #direct-sales > div > div:first-child:not(:has(img)),
      #firebase-market #auction-list > div > div:first-child:not(:has(img)){
        font-size:0 !important;
        display:flex !important;
        align-items:center !important;
        justify-content:center !important;
        background:linear-gradient(145deg,#eee8dc,#f8f4ec) !important;
      }

      #firebase-market #direct-sales > div > div:first-child:not(:has(img))::after,
      #firebase-market #auction-list > div > div:first-child:not(:has(img))::after{
        content:"لا توجد صورة";
        font-size:14px;
        font-weight:700;
        color:#7b827d;
      }

      /* مساحات ثابتة ومقروءة */
      #firebase-market #direct-sales h3,
      #firebase-market #auction-list h3{
        min-height:28px !important;
        margin-bottom:6px !important;
      }

      #firebase-market #direct-sales .market-location-row,
      #firebase-market #auction-list .market-location-row{
        min-height:28px !important;
      }

      /* دفع زر الشراء لأسفل لتتساوى البطاقات */
      #firebase-market #direct-sales button[onclick^="requestPurchase"]{
        margin-top:auto !important;
      }

      /* أزرار المزاد تبقى أسفل المحتوى قدر الإمكان */
      #firebase-market #auction-list button[id^="bid-button-"]{
        margin-top:auto !important;
      }

      /* بطاقة بدون صورة: مساحة ثابتة ونظيفة بدل الفراغ الكبير */
      #firebase-market #direct-sales > div > div:first-child:not(:has(img)),
      #firebase-market #auction-list > div > div:first-child:not(:has(img)){
        height:220px !important;
        min-height:220px !important;
        max-height:220px !important;
      }

      @media(min-width:769px){
        /* سطح المكتب: لا نفرض ارتفاعاً موحداً حتى لا تظهر فراغات كبيرة */
        #firebase-market #direct-sales,
        #firebase-market #auction-list{
          grid-auto-rows:auto !important;
          align-items:start !important;
        }

        #firebase-market #direct-sales > div,
        #firebase-market #auction-list > div{
          height:auto !important;
          min-height:0 !important;
          align-self:start !important;
        }

        #firebase-market #direct-sales button[onclick^="requestPurchase"],
        #firebase-market #auction-list button[id^="bid-button-"]{
          margin-top:14px !important;
        }
      }

      @media(max-width:768px){
        /* مساحة إضافية أسفل السوق حتى لا يغطي شريط التنقل السعر أو الأزرار */
        #firebase-market{
          padding-bottom:115px !important;
        }

        #firebase-market #direct-sales > div > div:first-child:not(:has(img)),
        #firebase-market #auction-list > div > div:first-child:not(:has(img)){
          height:170px !important;
          min-height:170px !important;
          max-height:170px !important;
        }
        #firebase-market .market-heading-main{
          font-size:25px !important;
        }

        #firebase-market .market-section-heading{
          font-size:23px !important;
          margin-top:34px !important;
        }

        #firebase-market .market-line-icon{
          width:25px;
          height:25px;
          flex-basis:25px;
        }

        /* ضغط المسافات داخل البطاقة على الهاتف */
        #firebase-market #direct-sales > div,
        #firebase-market #auction-list > div{
          padding:10px !important;
        }

        #firebase-market #direct-sales h3,
        #firebase-market #auction-list h3{
          margin-top:10px !important;
          margin-bottom:4px !important;
          min-height:0 !important;
        }

        #firebase-market #direct-sales p,
        #firebase-market #auction-list p{
          margin-top:5px !important;
          margin-bottom:5px !important;
          line-height:1.5 !important;
        }

        #firebase-market #direct-sales .market-location-row,
        #firebase-market #auction-list .market-location-row{
          min-height:0 !important;
        }
      }

      @media(max-width:480px){
        #firebase-market #direct-sales > div,
        #firebase-market #auction-list > div{
          padding:9px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  let scheduled = false;

  function scheduleImprove() {
    if (scheduled) return;
    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      improveMarket();
    });
  }

  function start() {
    installStyles();
    improveMarket();

    const marketObserver = new MutationObserver(() => {
      scheduleImprove();
    });

    marketObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
