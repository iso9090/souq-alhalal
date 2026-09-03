// market-ui-v30.js
// تحسين واجهة سوق الحلال فقط بدون تغيير منطق Firebase أو المزايدات.

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

    // عنوان السوق
    const topHeading = content.querySelector(":scope > h2:first-of-type");
    if (topHeading && !topHeading.dataset.uiCleaned) {
      topHeading.innerHTML = `${iconWrap(SVG.market, "gold")}<span>سوق الحلال</span>`;
      topHeading.classList.add("market-heading", "market-heading-main");
      topHeading.dataset.uiCleaned = "1";
    }

    // خيارات الفلاتر: إزالة الإيموجي فقط مع الحفاظ على القيم والأحداث.
    market.querySelectorAll("#market-filters option").forEach(option => {
      const cleaned = cleanText(option.textContent);
      if (option.textContent !== cleaned) option.textContent = cleaned;
    });

    // زر إظهار الكل
    const resetButton = market.querySelector('#market-filters button[onclick*="resetMarketFilters"]');
    if (resetButton && !resetButton.dataset.uiCleaned) {
      resetButton.innerHTML = `${iconWrap(SVG.reset)}<span>إظهار الكل</span>`;
      resetButton.classList.add("market-reset-button");
      resetButton.dataset.uiCleaned = "1";
    }

    // عنوان البيع المباشر والمزاد
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

    // حالة الاتصال
    const status = document.getElementById("firebase-status");
    if (status) {
      const raw = cleanText(status.textContent);
      if (raw.includes("متصل بالسوق")) {
        status.innerHTML = `${iconWrap(SVG.check)}<span>${raw}</span>`;
        status.classList.add("market-status-clean");
      } else if (raw) {
        status.textContent = raw;
      }
    }

    // إزالة دبوس الموقع من بطاقات السوق فقط.
    market.querySelectorAll("#direct-sales p, #auction-list p").forEach(p => {
      if (p.childElementCount === 0 || p.textContent.includes("📍")) {
        const text = p.textContent || "";
        if (text.includes("📍")) {
          p.innerHTML = `${iconWrap(SVG.location, "location")}<span>${cleanText(text)}</span>`;
          p.classList.add("market-location-row");
        }
      }
    });
  }

  function installStyles() {
    if (document.getElementById("market-ui-v30-style")) return;

    const style = document.createElement("style");
    style.id = "market-ui-v30-style";
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

      @media(max-width:768px){
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
      }
    `;

    document.head.appendChild(style);
  }

  function start() {
    installStyles();
    improveMarket();

    const observer = new MutationObserver(() => improveMarket());
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
