import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  addDoc,
  writeBatch,
  runTransaction,
  Timestamp,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getIdTokenResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDZhP6Kzoqchfmm5tj3EsBi8vt3m8EBC3k",
  authDomain: "souq-al-halal-9e3e8.firebaseapp.com",
  projectId: "souq-al-halal-9e3e8",
  storageBucket: "souq-al-halal-9e3e8.firebasestorage.app",
  messagingSenderId: "227281181881",
  appId: "1:227281181881:web:4ff800571b52a461bd8f68"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

auth.languageCode = "ar";

let confirmationResult = null;
let recaptchaVerifier = null;
let auctionTimerInterval = null;
let currentUserIsAdmin = false;
let adminServiceRequests = [];

const handledExpiredAuctions = new Set();

const ACTIVE_MARKET_COUNTRY_KEY = "souqActiveCountry";

function readActiveMarketCountry() {
  try {
    const saved = localStorage.getItem(ACTIVE_MARKET_COUNTRY_KEY);
    return saved === "AE" || saved === "EG" ? saved : null;
  } catch (error) {
    console.error("READ MARKET COUNTRY ERROR:", error);
    return null;
  }
}

let activeMarketCountry = readActiveMarketCountry();

const COUNTRIES = {
  AE: {
    name: "الإمارات العربية المتحدة",
    currency: "AED",
    locale: "ar-AE",
    defaultRegion: "الشارقة",
    defaultCity: "الذيد",
    regions: {
      "الشارقة": ["الذيد","مدينة الشارقة","مليحة","البطائح","المدام","الحمرية","خورفكان","كلباء","دبا الحصن"],
      "دبي": ["دبي","حتا","الخوانيج","العوير","الليسيلي","مرغم","لهباب"],
      "أبوظبي": ["أبوظبي","العين","مدينة زايد","ليوا","غياثي","المرفأ","الرويس","السلع","جزيرة دلما"],
      "عجمان": ["عجمان","مصفوت","المنامة"],
      "رأس الخيمة": ["رأس الخيمة","الرمس","شعم","غليلة","الجزيرة الحمراء","خت"],
      "أم القيوين": ["أم القيوين","فلج المعلا"],
      "الفجيرة": ["الفجيرة","دبا الفجيرة","مسافي","مربح","قدفع","البدية","الطويين"]
    }
  },
  EG: {
    name: "جمهورية مصر العربية",
    currency: "EGP",
    locale: "ar-EG",
    defaultRegion: "القاهرة",
    defaultCity: "القاهرة",
    regions: {
      "القاهرة": ["القاهرة","القاهرة الجديدة","مدينة نصر","حلوان"],
      "الجيزة": ["الجيزة","6 أكتوبر","الشيخ زايد","البدرشين"],
      "الإسكندرية": ["الإسكندرية","برج العرب","العامرية"],
      "القليوبية": ["بنها","شبرا الخيمة","قليوب"],
      "الشرقية": ["الزقازيق","العاشر من رمضان","بلبيس"],
      "الدقهلية": ["المنصورة","ميت غمر","بلقاس"],
      "البحيرة": ["دمنهور","كفر الدوار","وادي النطرون"],
      "الغربية": ["طنطا","المحلة الكبرى","زفتى"],
      "المنوفية": ["شبين الكوم","السادات","منوف"],
      "كفر الشيخ": ["كفر الشيخ","دسوق","بلطيم"],
      "دمياط": ["دمياط","دمياط الجديدة","رأس البر"],
      "بورسعيد": ["بورسعيد","بورفؤاد"],
      "الإسماعيلية": ["الإسماعيلية","فايد","القنطرة"],
      "السويس": ["السويس"],
      "الفيوم": ["الفيوم","سنورس","إطسا"],
      "بني سويف": ["بني سويف","الواسطى","الفشن"],
      "المنيا": ["المنيا","ملوي","سمالوط"],
      "أسيوط": ["أسيوط","ديروط","أبنوب"],
      "سوهاج": ["سوهاج","أخميم","جرجا"],
      "قنا": ["قنا","نجع حمادي","قفط"],
      "الأقصر": ["الأقصر","إسنا","أرمنت"],
      "أسوان": ["أسوان","إدفو","كوم أمبو"],
      "البحر الأحمر": ["الغردقة","سفاجا","القصير"],
      "الوادي الجديد": ["الخارجة","الداخلة","الفرافرة"],
      "مطروح": ["مرسى مطروح","الحمام","سيوة"],
      "شمال سيناء": ["العريش","بئر العبد","الشيخ زويد"],
      "جنوب سيناء": ["الطور","شرم الشيخ","دهب"]
    }
  }
};

const SERVICES = {
  featured: {
    label: "تمييز الإعلان",
    description: "إظهار الإعلان بلمسة ذهبية وترتيبه ضمن الإعلانات المميزة بعد الاعتماد.",
    durationDays: 7,
    AE: { price: 15, currency: "AED" },
    EG: { price: 200, currency: "EGP" }
  },
  bump: {
    label: "رفع الإعلان للأعلى",
    description: "رفع الإعلان فوق الإعلانات العادية بعد اعتماد الطلب دون تغيير تاريخ نشره.",
    AE: { price: 7, currency: "AED" },
    EG: { price: 100, currency: "EGP" }
  },
  verification: {
    label: "طلب توثيق الحيوان",
    description: "مراجعة بيانات الحيوان الصحية والتعريفية قبل منحه شارة موثق.",
    AE: { price: 25, currency: "AED" },
    EG: { price: 350, currency: "EGP" }
  }
};

function effectiveCountry(data) {
  return data?.country === "EG" ? "EG" : "AE";
}

function servicePricing(serviceType, country) {
  const effectiveCode = country === "EG" ? "EG" : "AE";
  return SERVICES[serviceType]?.[effectiveCode] || null;
}

function isServiceApproved(request) {
  return request?.status === "approved";
}

function isFeaturedListing(data, now = Date.now()) {
  return timestampToMillis(data?.featuredUntil) > now;
}

function isBumpedListing(data) {
  return timestampToMillis(data?.bumpedAt) > 0;
}

function isVerifiedListing(data) {
  return data?.verificationStatus === "verified";
}

function marketplaceSort(a, b) {
  const aFeatured = isFeaturedListing(a);
  const bFeatured = isFeaturedListing(b);
  if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

  if (aFeatured && bFeatured) {
    const featuredDifference = timestampToMillis(b.featuredAt) - timestampToMillis(a.featuredAt);
    if (featuredDifference) return featuredDifference;
  }

  const aBumped = isBumpedListing(a);
  const bBumped = isBumpedListing(b);
  if (aBumped !== bBumped) return aBumped ? -1 : 1;

  if (aBumped && bBumped) {
    const bumpDifference = timestampToMillis(b.bumpedAt) - timestampToMillis(a.bumpedAt);
    if (bumpDifference) return bumpDifference;
  }

  return timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt);
}

function listingServiceBadges(primary, animal = primary) {
  return `
    ${isFeaturedListing(primary) ? `<span style="display:inline-block;background:#b88624;color:white;padding:5px 9px;border-radius:16px;font-size:12px;font-weight:bold;margin:0 0 8px 6px;">⭐ مميز</span>` : ""}
    ${isVerifiedListing(animal) ? `<span style="display:inline-block;background:#176b52;color:white;padding:5px 9px;border-radius:16px;font-size:12px;font-weight:bold;margin:0 0 8px 6px;">✓ موثق</span>` : ""}
  `;
}

function updateMarketCountryIndicator() {
  const button = document.getElementById("marketCountryButton");
  if (!button) return;
  button.textContent = activeMarketCountry === "EG" ? "🇪🇬 مصر" : "🇦🇪 الإمارات";
  button.style.display = activeMarketCountry ? "inline-flex" : "none";
}

window.openMarketCountrySelector = function () {
  showModal(`
    <div style="direction:rtl;color:white;padding:12px;text-align:center;">
      <h2 style="color:#68e6b0;margin-bottom:8px;">اختر سوق الدولة</h2>
      <p style="color:#aaa;margin-bottom:18px;">يمكنك تغيير السوق لاحقًا من أعلى الصفحة.</p>
      <button onclick="selectMarketCountry('AE')"
        style="width:100%;padding:15px;margin-bottom:10px;background:#28566f;color:white;border:1px solid #68e6b0;border-radius:11px;font-weight:bold;">
        🇦🇪 الإمارات العربية المتحدة
      </button>
      <button onclick="selectMarketCountry('EG')"
        style="width:100%;padding:15px;background:#28566f;color:white;border:1px solid #d4a84f;border-radius:11px;font-weight:bold;">
        🇪🇬 جمهورية مصر العربية
      </button>
    </div>
  `);
};

window.selectMarketCountry = async function (country) {
  if (country !== "AE" && country !== "EG") return;
  activeMarketCountry = country;
  try {
    localStorage.setItem(ACTIVE_MARKET_COUNTRY_KEY, country);
  } catch (error) {
    console.error("SAVE MARKET COUNTRY ERROR:", error);
  }
  updateMarketCountryIndicator();

  const listingCountry = document.getElementById("animalCountry");
  if (listingCountry) {
    listingCountry.value = country;
    window.updateListingLocationOptions();
  }

  const marketArea = document.getElementById("firebase-market");
  if (marketArea) marketArea.remove();
  window.closeModal();
  await loadMarket();
};

function money(value, country = "AE") {
  const effectiveCode = country === "EG" ? "EG" : "AE";
  return Number(value || 0).toLocaleString("en-US") +
    " " + COUNTRIES[effectiveCode].currency;
}

function normalizePhoneNumber(value, country = "AE") {
  const compact = String(value || "").replace(/[\s()-]/g, "");
  if (country === "EG") {
    const normalized = compact.startsWith("01") ? "+20" + compact.substring(1)
      : compact.startsWith("201") ? "+" + compact : compact;
    return /^\+201[0125]\d{8}$/.test(normalized) ? normalized : null;
  }
  const normalized = compact.startsWith("05") ? "+971" + compact.substring(1)
    : compact.startsWith("971") ? "+" + compact : compact;
  return /^\+9715\d{8}$/.test(normalized) ? normalized : null;
}

window.getSelectedListingCurrency = function () {
  const country = document.getElementById("animalCountry")?.value || "AE";
  return COUNTRIES[country]?.currency || COUNTRIES.AE.currency;
};

window.updateListingLocationOptions = function () {
  const countrySelect = document.getElementById("animalCountry");
  const regionSelect = document.getElementById("animalRegion");
  if (!countrySelect || !regionSelect) return;

  const countryCode = countrySelect.value === "EG" ? "EG" : "AE";
  const countryConfig = COUNTRIES[countryCode];
  regionSelect.innerHTML = "";

  Object.keys(countryConfig.regions).forEach(regionName => {
    const option = document.createElement("option");
    option.value = regionName;
    option.textContent = regionName;
    regionSelect.appendChild(option);
  });

  regionSelect.value = countryConfig.defaultRegion;
  window.updateListingCityOptions();
  if (typeof window.toggleAuctionFields === "function") {
    window.toggleAuctionFields();
  }
};

window.updateListingCityOptions = function () {
  const countrySelect = document.getElementById("animalCountry");
  const regionSelect = document.getElementById("animalRegion");
  const citySelect = document.getElementById("animalCity");
  if (!countrySelect || !regionSelect || !citySelect) return;

  const countryCode = countrySelect.value === "EG" ? "EG" : "AE";
  const countryConfig = COUNTRIES[countryCode];
  const cities = countryConfig.regions[regionSelect.value] || [];
  citySelect.innerHTML = "";

  cities.forEach(cityName => {
    const option = document.createElement("option");
    option.value = cityName;
    option.textContent = cityName;
    citySelect.appendChild(option);
  });

  if (regionSelect.value === countryConfig.defaultRegion) {
    citySelect.value = countryConfig.defaultCity;
  }
  window.updateFullLocation();
};

window.updateFullLocation = function () {
  const regionSelect = document.getElementById("animalRegion");
  const citySelect = document.getElementById("animalCity");
  const fullLocation = document.getElementById("animalLocation");
  if (!regionSelect || !citySelect || !fullLocation) return;

  fullLocation.value = citySelect.value
    ? citySelect.value + " - " + regionSelect.value
    : regionSelect.value;
};

document.addEventListener("DOMContentLoaded", () => {
  updateMarketCountryIndicator();
  const countrySelect = document.getElementById("animalCountry");
  if (countrySelect) countrySelect.value = activeMarketCountry || "AE";
  window.updateListingLocationOptions();

  const form = document.getElementById("listingForm");
  if (!form) return;

  form.addEventListener("reset", () => {
    setTimeout(() => {
      const countrySelect = document.getElementById("animalCountry");
      if (countrySelect) countrySelect.value = activeMarketCountry || "AE";
      window.updateListingLocationOptions();
    }, 0);
  });
});

function animalIcon(type = "") {
  if (type.includes("ناقة") || type.includes("جمل") || type.includes("إبل")) return "🐫";
  if (type.includes("خروف") || type.includes("غنم")) return "🐑";
  if (type.includes("ماعز")) return "🐐";
  if (type.includes("بقر") || type.includes("بقرة") || type.includes("أبقار")) return "🐄";
  if (type.includes("دجاج")) return "🐔";
  if (type.includes("صقر") || type.includes("صقور")) return "🦅";
  if (type.includes("غزال") || type.includes("غزلان")) return "🦌";
  if (type.includes("نعام")) return "🐦";
  if (type.includes("حمام")) return "🕊️";
  return "🐾";
}

function timestampToDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function timestampToMillis(timestamp) {
  const date = timestampToDate(timestamp);
  if (!date) return 0;
  return date.getTime();
}

function formatDate(timestamp) {
  const date = timestampToDate(timestamp);
  if (!date) return "غير محدد";
  return date.toLocaleString("ar-AE", { dateStyle: "medium", timeStyle: "short" });
}

function formatListingDate(timestamp) {
  const date = timestampToDate(timestamp);
  if (!date) return "غير متوفر";

  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isToday) return "اليوم";

  return date.toLocaleDateString("ar-AE", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function vaccinationStatusLabel(status) {
  if (status === "vaccinated") return "مطعّم";
  if (status === "not_vaccinated") return "غير مطعّم";
  return "غير محدد";
}

window.toggleVaccinationDate = function (statusId, fieldId, dateId) {
  const status = document.getElementById(statusId)?.value || "unknown";
  const field = document.getElementById(fieldId);
  const dateInput = document.getElementById(dateId);
  const showDate = status === "vaccinated";

  if (field) field.style.display = showDate ? "block" : "none";
  if (!showDate && dateInput) dateInput.value = "";
};

function vetInspectionStatusLabel(status) {
  if (status === "inspected") return "تم الفحص";
  if (status === "not_inspected") return "لم يتم الفحص";
  return "غير محدد";
}

window.toggleVetInspectionDate = function (statusId, fieldId, dateId) {
  const status = document.getElementById(statusId)?.value || "unknown";
  const field = document.getElementById(fieldId);
  const dateInput = document.getElementById(dateId);
  const showDate = status === "inspected";

  if (field) field.style.display = showDate ? "block" : "none";
  if (!showDate && dateInput) dateInput.value = "";
};

function listingAnimalDetailsHtml(animal = {}) {
  const details = [
    animal.breed ? `السلالة: <b>${escapeHtml(animal.breed)}</b>` : "",
    animal.gender ? `الجنس: <b>${animal.gender === "male" ? "ذكر" : "أنثى"}</b>` : "",
    animal.age ? `العمر: <b>${escapeHtml(animal.age)}</b>` : "",
    animal.birthDate ? `تاريخ الميلاد: <b>${escapeHtml(animal.birthDate)}</b>` : "",
    animal.animalIdentifier ? `معرّف الحيوان: <b>${escapeHtml(animal.animalIdentifier)}</b>` : "",
    `حالة التطعيم: <b>${vaccinationStatusLabel(animal.vaccinationStatus)}</b>`,
    animal.vaccinationStatus === "vaccinated" && animal.vaccinationDate
      ? `آخر تطعيم: <b>${escapeHtml(animal.vaccinationDate)}</b>`
      : "",
    `الفحص البيطري: <b>${vetInspectionStatusLabel(animal.vetInspectionStatus)}</b>`,
    animal.vetInspectionStatus === "inspected" && animal.vetInspectionDate
      ? `تاريخ آخر فحص: <b>${escapeHtml(animal.vetInspectionDate)}</b>`
      : ""
  ].filter(Boolean);

  if (details.length === 0) return "";

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin:14px 0;">
      ${details.map(detail => `
        <div style="padding:9px 10px;border-radius:9px;background:rgba(255,255,255,.06);font-size:14px;">
          ${detail}
        </div>
      `).join("")}
    </div>
  `;
}

function listingDescriptionHtml(animal = {}) {
  if (!animal.description) return "";

  return `
    <p style="margin:12px 0;line-height:1.7;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
      📝 ${escapeHtml(animal.description)}
    </p>
  `;
}

function getCountdownText(endTime) {
  const end = timestampToMillis(endTime);
  if (!end) return "غير محدد";
  const difference = end - Date.now();
  if (difference <= 0) return "انتهى المزاد";

  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (days > 0) return "متبقي " + days + " يوم و " + hh + ":" + mm + ":" + ss;
  return "متبقي " + hh + ":" + mm + ":" + ss;
}

function startAuctionTimers() {
  if (auctionTimerInterval) {
    clearInterval(auctionTimerInterval);
    auctionTimerInterval = null;
  }

  function updateTimers() {
    const timers = document.querySelectorAll("[data-auction-end]");

    timers.forEach(timer => {
      const end = Number(timer.dataset.auctionEnd || 0);
      const auctionId = timer.dataset.auctionId;
      const button = document.getElementById("bid-button-" + auctionId);
      const tag = document.getElementById("auction-tag-" + auctionId);
      const difference = end - Date.now();

      if (!end || difference <= 0) {
        timer.innerHTML = "⛔ انتهى المزاد";
        timer.style.color = "#ff8d8d";

        if (button) {
          button.disabled = true;
          button.textContent = "انتهى المزاد";
          button.style.background = "#555";
        }

        if (tag) {
          tag.textContent = "مزاد منتهي";
          tag.style.background = "#6d2929";
        }

        if (auctionId && !handledExpiredAuctions.has(auctionId)) {
          handledExpiredAuctions.add(auctionId);
          setTimeout(() => loadMarket(), 500);
        }

        return;
      }

      const totalSeconds = Math.floor(difference / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");

      timer.innerHTML = days > 0
        ? "⏱ متبقي: " + days + " يوم و " + hh + ":" + mm + ":" + ss
        : "⏱ متبقي: " + hh + ":" + mm + ":" + ss;
    });
  }

  updateTimers();
  auctionTimerInterval = setInterval(updateTimers, 1000);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineArgument(value) {
  return escapeHtml(JSON.stringify(String(value)));
}

function accountTypeText(type) {
  if (type === "seller") return "بائع";
  if (type === "both") return "بائع ومشتري";
  return "مشتري";
}

function getAnimalLocationInfo(animal = {}) {
  const country = effectiveCountry(animal);
  const countryConfig = COUNTRIES[country];
  const cleanLocation = String(animal.location || "").trim();
  let city = cleanLocation;
  let region = String(animal.region || "").trim();

  if (animal.city) city = String(animal.city).trim();

  if ((!animal.city || !region) && cleanLocation.includes(" - ")) {
    const parts = cleanLocation.split(" - ");
    if (!animal.city) city = (parts[0] || "").trim();
    if (!region) region = (parts[1] || "").trim();
  }

  if (!region) {
    for (const [regionName, cities] of Object.entries(countryConfig.regions)) {
      if (cities.includes(city)) {
        region = regionName;
        break;
      }
    }
  }

  return { country, region, city };
}

function getMarketFilters() {
  const country = activeMarketCountry;
  const region = document.getElementById("marketRegionFilter")?.value || "all";
  const city = document.getElementById("marketCityFilter")?.value || "all";
  const animalType = document.getElementById("marketAnimalFilter")?.value || "all";
  const saleType = document.getElementById("marketSaleTypeFilter")?.value || "all";
  return { country, region, city, animalType, saleType };
}

function animalMatchesMarketFilters(animal, forcedSaleType = "") {
  if (!animal) return false;

  const filters = getMarketFilters();
  const locationInfo = getAnimalLocationInfo(animal);

  if (filters.country !== "all" && locationInfo.country !== filters.country) return false;
  if (filters.region !== "all" && locationInfo.region !== filters.region) return false;
  if (filters.city !== "all" && locationInfo.city !== filters.city) return false;
  if (filters.animalType !== "all" && animal.type !== filters.animalType) return false;

  const actualSaleType = forcedSaleType || animal.saleType || "";
  if (filters.saleType !== "all" && actualSaleType !== filters.saleType) return false;

  return true;
}

window.updateMarketRegionFilter = function (reload = true) {
  const regionSelect = document.getElementById("marketRegionFilter");
  if (!activeMarketCountry || !regionSelect) return;

  regionSelect.innerHTML = `<option value="all">جميع المناطق والمحافظات</option>`;

  Object.keys(COUNTRIES[activeMarketCountry]?.regions || {}).forEach(regionName => {
    const option = document.createElement("option");
    option.value = regionName;
    option.textContent = regionName;
    regionSelect.appendChild(option);
  });

  window.updateMarketCityFilter(reload);
};

window.updateMarketCityFilter = function (reload = true) {
  const regionSelect = document.getElementById("marketRegionFilter");
  const citySelect = document.getElementById("marketCityFilter");
  if (!activeMarketCountry || !regionSelect || !citySelect) return;

  citySelect.innerHTML = `<option value="all">جميع المدن والمناطق</option>`;

  if (regionSelect.value !== "all") {
    const cities = COUNTRIES[activeMarketCountry]?.regions[regionSelect.value] || [];
    cities.forEach(cityName => {
      const option = document.createElement("option");
      option.value = cityName;
      option.textContent = cityName;
      citySelect.appendChild(option);
    });
  }

  if (reload) loadMarket();
};

window.applyMarketFilters = function () {
  loadMarket();
};

window.resetMarketFilters = function () {
  const region = document.getElementById("marketRegionFilter");
  const city = document.getElementById("marketCityFilter");
  const animal = document.getElementById("marketAnimalFilter");
  const saleType = document.getElementById("marketSaleTypeFilter");

  if (region) region.value = "all";
  if (city) city.innerHTML = `<option value="all">جميع المدن والمناطق</option>`;
  if (animal) animal.value = "all";
  if (saleType) saleType.value = "all";

  loadMarket();
};

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("INVALID_IMAGE"));
      return;
    }

    const reader = new FileReader();

    reader.onerror = function () {
      reject(new Error("IMAGE_READ_ERROR"));
    };

    reader.onload = function (event) {
      const img = new Image();

      img.onerror = function () {
        reject(new Error("IMAGE_LOAD_ERROR"));
      };

      img.onload = function () {
        const maxSize = 640;
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("CANVAS_ERROR"));
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", 0.48));
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}

async function getListingImages() {
  const input = document.getElementById("animalImages");
  if (!input || !input.files || input.files.length === 0) return [];

  const files = Array.from(input.files);
  if (files.length > 5) throw new Error("TOO_MANY_IMAGES");

  const images = [];
  let totalSize = 0;

  for (const file of files) {
    const imageData = await compressImageFile(file);
    totalSize += imageData.length;

    if (totalSize > 650000) throw new Error("IMAGES_TOO_LARGE");
    images.push(imageData);
  }

  return images;
}

function safeImageData(value) {
  if (typeof value !== "string") return "";
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return "";
  return value;
}

function animalPhotoHtml(animal = {}) {
  const images = Array.isArray(animal.images) ? animal.images : [];
  const firstImage = safeImageData(images[0]);

  if (firstImage) {
    return `
      <div style="position:relative;width:100%;height:230px;overflow:hidden;border-radius:14px;background:#10271c;">
        <img src="${firstImage}" alt="صورة الحيوان" style="width:100%;height:100%;object-fit:cover;display:block;">
        ${images.length > 1 ? `
          <div style="position:absolute;bottom:10px;left:10px;background:rgba(0,0,0,.75);color:white;padding:6px 10px;border-radius:20px;">
            📷 ${images.length} صور
          </div>` : ""}
      </div>
    `;
  }

  return `
    <div style="font-size:90px;text-align:center;background:#10271c;border-radius:14px;padding:20px;">
      ${animalIcon(animal.type || "")}
    </div>
  `;
}

function ownerManagementButton(animal) {
  const user = auth.currentUser;
  if (!user || !animal || animal.sellerId !== user.uid) return "";

  return `
    <button onclick="manageListing(${inlineArgument(animal.id)})"
      style="width:100%;background:#28566f;color:white;border:0;padding:14px;border-radius:10px;font-size:17px;margin-top:10px;font-weight:bold;">
      ⚙️ إدارة إعلاني
    </button>
  `;
}

async function ensureUserProfile(user, initialDisplayName = "") {
  if (!user) return false;
  try {
    const userRef = doc(db, "users", user.uid);
    await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(userRef);
      const phone = typeof user.phoneNumber === "string" ? user.phoneNumber : "";
      const values = {
        ...(phone ? { phoneNumber: phone } : {}),
        lastLoginAt: serverTimestamp()
      };
      if (!snapshot.exists()) {
        transaction.set(userRef, {
          uid: user.uid, displayName: initialDisplayName,
          accountType: initialDisplayName ? "both" : "buyer", status: "active",
          createdAt: serverTimestamp(), ...values
        });
      } else {
        // Signup and the Auth observer may arrive in either order; never erase a name/phone.
        transaction.update(userRef, {
          ...values,
          ...(initialDisplayName ? { displayName: initialDisplayName, accountType: "both" } : {})
        });
      }
    });
    return true;
  } catch (error) {
    console.error("USER PROFILE ERROR:", error.code || "unknown");
    return false;
  }
}

async function getUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists()) return null;
    return { id: userSnap.id, ...userSnap.data() };
  } catch (error) {
    console.error("GET PROFILE ERROR:", error);
    return null;
  }
}

let modalRevision = 0;

function showModal(html) {
  const modal = document.getElementById("modal");
  const content = document.getElementById("modalContent");

  if (!modal || !content) return;

  modalRevision++;
  content.innerHTML = html;
  modal.style.display = "flex";
  modal.style.alignItems = "flex-start";
  modal.style.justifyContent = "center";
  modal.style.overflowY = "auto";
  modal.style.overflowX = "hidden";
  modal.style.paddingTop = "20px";
  modal.style.paddingBottom = "30px";
  modal.style.boxSizing = "border-box";
  modal.scrollTop = 0;
  content.scrollTop = 0;

  const closeButton = modal.querySelector(".close");

  if (closeButton) {
    closeButton.style.position = "fixed";
    closeButton.style.top = "18px";
    closeButton.style.left = "18px";
    closeButton.style.zIndex = "999999";
    closeButton.style.width = "42px";
    closeButton.style.height = "42px";
    closeButton.style.display = "flex";
    closeButton.style.alignItems = "center";
    closeButton.style.justifyContent = "center";
    closeButton.style.background = "#8b2929";
    closeButton.style.color = "#ffffff";
    closeButton.style.borderRadius = "50%";
    closeButton.style.fontSize = "26px";
    closeButton.style.cursor = "pointer";
    closeButton.style.boxShadow = "0 3px 12px rgba(0,0,0,.45)";
  }

  setTimeout(() => {
    modal.scrollTop = 0;
    content.scrollTop = 0;
  }, 0);
}

window.closeModal = function () {
  modalRevision++;
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";
};

// Narrow native Back contract: only this app's existing modal, no history mutation.
window.souqHandleAndroidBack = function () {
  const modal = document.getElementById("modal");
  if (!modal || getComputedStyle(modal).display === "none") return false;
  window.closeModal();
  return true;
};

async function showAccount() {
  const user = auth.currentUser;
  if (!user) return;

  showModal(`
    <div style="direction:rtl;text-align:center;color:white;padding:20px;">
      <div style="font-size:55px;">👤</div>
      <h2 style="color:#68e6b0;">حسابي</h2>
      <p style="color:#aaa;">جاري تحميل البيانات...</p>
    </div>
  `);

  const accountModalRevision = modalRevision;
  await ensureUserProfile(user);
  const deletion = await readOwnDeletionRequest(user);
  if (auth.currentUser?.uid !== user.uid) return;
  const profile = await getUserProfile();
  if (modalRevision !== accountModalRevision || auth.currentUser?.uid !== user.uid) return;
  const displayName = profile?.displayName || "";
  const accountType = profile?.accountType || "buyer";
  const phone = user.phoneNumber || profile?.phoneNumber || "";
  const emailMethod = user.providerData?.some(provider => provider.providerId === "password") || !!user.email;
  const ownerIdentity = emailMethod ? user.email || "" : phone;

  const buyerButtons =
    (accountType === "buyer" || accountType === "both")
      ? `
        <button onclick="showMyPurchaseRequests()"
          style="width:100%;padding:15px;background:#28566f;color:white;border:0;border-radius:10px;margin-bottom:10px;font-size:17px;font-weight:bold;">
          📋 طلباتي
        </button>
      `
      : "";

  const sellerButtons =
    (accountType === "seller" || accountType === "both")
      ? `
        <button onclick="showMyListings()"
          style="width:100%;padding:15px;background:#00643e;color:white;border:0;border-radius:10px;margin-bottom:10px;font-size:17px;font-weight:bold;">
          📦 إعلاناتي ومزاداتي
        </button>

        <button onclick="showPurchaseRequests()"
          style="width:100%;padding:15px;background:#28566f;color:white;border:0;border-radius:10px;margin-bottom:10px;font-size:17px;font-weight:bold;">
          📩 طلبات الشراء
        </button>

        <button onclick="showMyServices()"
          style="width:100%;padding:15px;background:#b88624;color:white;border:0;border-radius:10px;margin-bottom:10px;font-size:17px;font-weight:bold;">
          ⭐ خدماتي
        </button>
      `
      : "";

  let planHtml = "";

  if (accountType === "seller" || accountType === "both") {
    planHtml = `
      <div style="background:#123c2c;color:#68e6b0;padding:14px;border-radius:10px;margin-bottom:15px;text-align:center;font-weight:bold;">
        الباقة الحالية
        <div style="font-size:20px;margin:5px 0;">✅ الباقة المجانية</div>
        <span style="color:white;font-size:14px;font-weight:normal;">
          يمكنك البيع وإضافة الحلال والمشاركة في السوق مجانًا.
        </span>
        <div style="color:#ffd66b;font-size:13px;margin-top:9px;">البائع المحترف — قريبًا</div>
        <div style="color:#bbb;font-size:12px;margin-top:4px;font-weight:normal;">مزايا إضافية للبائعين النشطين ستتوفر لاحقًا.</div>
      </div>
    `;
  }

  showModal(`
    <div style="direction:rtl;color:white;padding:12px;">
      <div style="text-align:center;">
        <div style="font-size:55px;">👤</div>
        <h2 style="color:#68e6b0;">حسابي</h2>
      </div>

      <label>الاسم</label>
      <input id="profileName" type="text" maxlength="50"
        value="${escapeHtml(displayName)}"
        style="width:100%;box-sizing:border-box;padding:14px;margin:8px 0 16px;border-radius:10px;">

      <p>طريقة تسجيل الدخول: <b>${emailMethod ? "البريد الإلكتروني" : "رقم الهاتف"}</b></p>
      <label>${emailMethod ? "البريد الإلكتروني — يظهر لك فقط" : "رقم الهاتف"}</label>
      <input value="${escapeHtml(ownerIdentity)}" aria-label="هوية حسابك الخاصة" disabled dir="ltr"
        style="width:100%;box-sizing:border-box;padding:14px;margin:8px 0 16px;border-radius:10px;text-align:left;">

      <label>استخدام الحساب</label>
      <select id="profileAccountType" style="width:100%;padding:14px;margin:8px 0 18px;">
        <option value="buyer" ${accountType === "buyer" ? "selected" : ""}>مشتري</option>
        <option value="seller" ${accountType === "seller" ? "selected" : ""}>بائع</option>
        <option value="both" ${accountType === "both" ? "selected" : ""}>بائع ومشتري</option>
      </select>

      <p>
        نوع الحساب:
        <b style="color:#68e6b0;">${accountTypeText(accountType)}</b>
      </p>

      ${planHtml}
      <p id="profileStatus"></p>

      <button onclick="saveProfile()"
        style="width:100%;padding:15px;background:#00643e;color:white;border:0;border-radius:10px;margin-bottom:10px;">
        💾 حفظ بيانات الحساب
      </button>

      ${buyerButtons}
      ${sellerButtons}

      <div id="accountDeletionNotice" role="status">${deletion?.status === "pending" || deletion?.status === "in_review" ? "<p><b>طلب حذف حسابك قيد المراجعة.</b></p><p>تم استلام طلب حذف الحساب. سيبقى الحساب متاحًا مؤقتًا إلى حين اكتمال المعالجة.</p>" : deletion?.status === "completed" ? `<p>${deletionStatusText("completed")}</p>` : deletion?.unavailable ? "<p>تعذر التحقق من حالة طلب الحذف. حاول لاحقًا.</p>" : ""}</div>
      <button id="accountDeletionButton" type="button" onclick="openAccountDeletion()" style="width:100%;margin:12px 0;" ${deletion?.status ? "disabled" : ""}>${deletion?.status === "completed" ? "سُجّل اكتمال معالجة الطلب" : deletion?.status ? "طلب الحذف قيد المراجعة" : "حذف الحساب"}</button>
      <button onclick="logoutUser()"
        style="width:100%;padding:15px;background:#8b2929;color:white;border:0;border-radius:10px;">
        تسجيل الخروج
      </button>
    </div>
  `);
}

window.showMyServices = async function () {
  const user = auth.currentUser;
  if (!user) return window.openLogin();

  showModal(`<div style="direction:rtl;color:white;padding:16px;text-align:center;"><h2 style="color:#68e6b0;">⭐ خدماتي</h2><p>جاري التحميل...</p></div>`);
  try {
    const requestsQuery = query(
      collection(db, "serviceRequests"),
      where("userId", "==", user.uid)
    );
    const snapshot = await getDocs(requestsQuery);
    const requests = snapshot.docs.map(requestDoc => ({ id: requestDoc.id, ...requestDoc.data() }));
    requests.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));

    const cards = await Promise.all(requests.map(async request => {
      let targetName = request.targetId;
      try {
        if (request.targetType === "animal") {
          const targetSnap = await getDoc(doc(db, "animals", request.targetId));
          if (targetSnap.exists()) targetName = targetSnap.data().name || targetSnap.data().type || request.targetId;
        } else {
          const auctionSnap = await getDoc(doc(db, "auctions", request.targetId));
          if (auctionSnap.exists()) {
            const animalSnap = await getDoc(doc(db, "animals", auctionSnap.data().animalId));
            if (animalSnap.exists()) targetName = animalSnap.data().name || animalSnap.data().type || request.targetId;
          }
        }
      } catch (error) {
        console.error("SERVICE TARGET ERROR:", error);
      }
      const countryName = COUNTRIES[effectiveCountry(request)].name;
      const canCancel = request.status === "pending";
      return `
        <div style="background:#222;padding:14px;border-radius:12px;margin-bottom:11px;text-align:right;">
          <div style="display:flex;justify-content:space-between;gap:8px;">
            <b style="color:#68e6b0;">${SERVICES[request.serviceType]?.label || "خدمة"}</b>
            <b style="color:#ffd66b;">${Number(request.amount || 0).toLocaleString("en-US")} ${escapeHtml(request.currency || "")}</b>
          </div>
          <div style="margin-top:7px;">الإعلان: ${escapeHtml(targetName)}</div>
          <div>الدولة: ${escapeHtml(countryName)}</div>
          <div>الحالة: <b>${serviceStatusText(request.status)}</b></div>
          <div>الدفع: ${servicePaymentText(request)}</div>
          ${demoPaymentLink(request)}
          <div style="color:#888;font-size:12px;">${formatDate(request.createdAt)}</div>
          ${canCancel ? `<button onclick="cancelServiceRequest(${inlineArgument(request.id)})" style="width:100%;margin-top:9px;padding:9px;background:#6d2929;color:white;border:0;border-radius:8px;">إلغاء الطلب</button>` : ""}
        </div>
      `;
    }));

    showModal(`
      <div style="direction:rtl;color:white;padding:14px;">
        <h2 style="text-align:center;color:#68e6b0;">⭐ خدماتي</h2>
        ${cards.length ? cards.join("") : `<div style="background:#222;padding:20px;border-radius:12px;text-align:center;">لا توجد خدمات مطلوبة حتى الآن.</div>`}
      </div>
    `);
  } catch (error) {
    console.error("LOAD SERVICES ERROR:", error);
    alert("تعذر تحميل خدماتك.");
  }
};

window.cancelServiceRequest = async function (requestId) {
  const user = auth.currentUser;
  if (!user || !confirm("هل تريد إلغاء طلب الخدمة؟")) return;
  try {
    await updateDoc(doc(db, "serviceRequests", requestId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await window.showMyServices();
  } catch (error) {
    console.error("CANCEL SERVICE ERROR:", error);
    alert("تعذر إلغاء الطلب.");
  }
};

async function requireAdminClaim(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const tokenResult = await getIdTokenResult(user, forceRefresh);
    const allowed = tokenResult.claims.admin === true;
    currentUserIsAdmin = allowed;
    const button = document.getElementById("adminPanelButton");
    if (button) button.style.display = allowed ? "inline-flex" : "none";
    return allowed;
  } catch (error) {
    console.error("ADMIN TOKEN ERROR:", error);
    return false;
  }
}

async function enrichAdminServiceRequest(request) {
  let targetName = request.targetId;
  let sellerName = request.userId.slice(0, 10);
  try {
    const userSnap = await getDoc(doc(db, "users", request.userId));
    if (userSnap.exists()) sellerName = userSnap.data().displayName || sellerName;

    if (request.targetType === "animal") {
      const animalSnap = await getDoc(doc(db, "animals", request.targetId));
      if (animalSnap.exists()) targetName = animalSnap.data().name || animalSnap.data().type || targetName;
    } else {
      const auctionSnap = await getDoc(doc(db, "auctions", request.targetId));
      if (auctionSnap.exists()) {
        const animalSnap = await getDoc(doc(db, "animals", auctionSnap.data().animalId));
        if (animalSnap.exists()) targetName = animalSnap.data().name || animalSnap.data().type || targetName;
      }
    }
  } catch (error) {
    console.error("ADMIN REQUEST DETAILS ERROR:", error);
  }
  return { ...request, targetName, sellerName };
}

window.openAdminPanel = async function () {
  if (!await requireAdminClaim(true)) {
    alert("غير مصرح لك بفتح لوحة الإدارة.");
    return;
  }

  showModal(`<div style="direction:rtl;color:white;padding:16px;text-align:center;"><h2 style="color:#68e6b0;">لوحة الإدارة</h2><p>جاري تحميل طلبات الخدمات...</p></div>`);
  try {
    const snapshot = await getDocs(collection(db, "serviceRequests"));
    const requests = snapshot.docs.map(requestDoc => ({ id: requestDoc.id, ...requestDoc.data() }));
    adminServiceRequests = await Promise.all(requests.map(enrichAdminServiceRequest));
    adminServiceRequests.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));

    showModal(`
      <div style="direction:rtl;color:white;padding:12px;">
        <h2 style="text-align:center;color:#68e6b0;">لوحة الإدارة</h2>
        <h3 style="color:#ffd66b;">طلبات الخدمات</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:14px;">
          <select id="adminServiceStatusFilter" onchange="renderAdminServiceRequests()">
            <option value="all">كل الحالات</option>
            <option value="pending">قيد المراجعة</option>
            <option value="approved">تم الاعتماد</option>
            <option value="rejected">مرفوض</option>
            <option value="cancelled">ملغي</option>
          </select>
          <select id="adminServiceCountryFilter" onchange="renderAdminServiceRequests()">
            <option value="all">كل الدول</option>
            <option value="AE">الإمارات</option>
            <option value="EG">مصر</option>
          </select>
          <select id="adminServiceTypeFilter" onchange="renderAdminServiceRequests()">
            <option value="all">كل الخدمات</option>
            <option value="featured">تمييز الإعلان</option>
            <option value="bump">رفع الإعلان</option>
            <option value="verification">توثيق الحيوان</option>
          </select>
        </div>
        <div id="adminServiceRequestsList"></div>
        <section style="border-top:1px solid #b88a32;margin-top:24px;padding-top:16px;">
          <h3>طلبات حذف الحسابات</h3>
          <p>هذه الشاشة لمتابعة الحالة فقط. معالجة البيانات تتم خارجها وفق إجراءات الإدارة.</p>
          <label for="adminDeletionFilter">حالة طلب الحذف</label>
          <select id="adminDeletionFilter" onchange="renderAdminDeletionRequests()" style="width:100%;box-sizing:border-box;">
            <option value="all">كل الحالات</option><option value="active">قيد المراجعة</option><option value="completed">تم التنفيذ</option>
          </select>
          <div id="adminDeletionRequestsList" aria-live="polite"></div>
        </section>
      </div>
    `);
    window.renderAdminServiceRequests();
    await window.loadAdminDeletionRequests();
  } catch (error) {
    console.error("ADMIN PANEL ERROR:", error);
    alert(error.code === "permission-denied" ? "لا تملك صلاحية فتح لوحة الإدارة." : "تعذر تحميل لوحة الإدارة.");
  }
};

let adminDeletionRequests = [];
let adminDeletionBusy = false;
window.loadAdminDeletionRequests = async function () {
  const container = document.getElementById("adminDeletionRequestsList");
  if (!container || !await requireAdminClaim(true)) return;
  container.textContent = "جاري تحميل طلبات الحذف…";
  try {
    const snapshot = await getDocs(collection(db, "accountDeletionRequests"));
    adminDeletionRequests = snapshot.docs.map(item => {
      const data = item.data();
      return { id: item.id, userId: data.userId, status: data.status, createdAt: data.createdAt, processedAt: data.processedAt };
    }).sort((a,b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
    await Promise.all(adminDeletionRequests.map(async item => {
      try {
        const profile = await getDoc(doc(db, "users", item.userId));
        if (profile.exists()) item.displayName = profile.data().displayName || "";
      } catch { /* UID remains usable when a profile is unavailable. */ }
    }));
    window.renderAdminDeletionRequests();
  } catch { container.textContent = "تعذر تحميل طلبات الحذف. أعد فتح لوحة الإدارة للمحاولة مجددًا."; }
};
window.renderAdminDeletionRequests = function () {
  const container = document.getElementById("adminDeletionRequestsList");
  if (!container || !currentUserIsAdmin) return;
  const filter = document.getElementById("adminDeletionFilter")?.value || "all";
  const requests = adminDeletionRequests.filter(item => filter === "all" || (filter === "active" ? ["pending", "in_review"].includes(item.status) : item.status === "completed"));
  container.innerHTML = requests.length ? requests.map(item => `<article style="border:1px solid #b88a32;padding:12px;margin:12px 0;border-radius:12px;overflow-wrap:anywhere;">
    <p>معرّف الحساب: <b dir="ltr">${escapeHtml(item.userId || item.id)}</b></p>
    ${item.displayName ? `<p>الاسم: ${escapeHtml(item.displayName)}</p>` : ""}
    <p>تاريخ الطلب: ${escapeHtml(formatDate(item.createdAt))}</p>
    <p>الحالة: ${item.status === "pending" ? "بانتظار المراجعة" : item.status === "in_review" ? "قيد المراجعة" : item.status === "completed" ? "تم التنفيذ" : "حالة غير معروفة"}</p>
    ${item.processedAt ? `<p>آخر معالجة: ${escapeHtml(formatDate(item.processedAt))}</p>` : ""}
    ${["pending", "in_review"].includes(item.status) ? `<button type="button" style="width:100%;box-sizing:border-box;white-space:normal;" onclick="processDeletionRequest(${escapeHtml(JSON.stringify(item.id))}, ${escapeHtml(JSON.stringify(item.status === "pending" ? "in_review" : "completed"))})">${item.status === "pending" ? "بدء المراجعة" : "تم التنفيذ"}</button>` : ""}
  </article>`).join("") : "<p>لا توجد طلبات بهذه الحالة.</p>";
};
window.processDeletionRequest = async function (uid, nextStatus) {
  if (adminDeletionBusy || !["in_review", "completed"].includes(nextStatus) || !await requireAdminClaim(true)) return;
  if (adminDeletionBusy) return;
  if (nextStatus === "completed" && !confirm("لا تضغط تم التنفيذ إلا بعد إتمام معالجة حذف/إخفاء البيانات المطلوبة خارج هذه الشاشة وفق إجراءات الإدارة. هل تؤكد اكتمال المعالجة؟")) return;
  adminDeletionBusy = true;
  try {
    const user = auth.currentUser;
    const ref = doc(db, "accountDeletionRequests", uid);
    const changed = await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      const expected = nextStatus === "in_review" ? "pending" : "in_review";
      if (!snapshot.exists() || snapshot.data().status !== expected) return false;
      transaction.update(ref, { status: nextStatus, updatedAt: serverTimestamp(), processedAt: serverTimestamp(), processedBy: user.uid });
      return true;
    });
    if (!changed) alert("تغيّرت حالة الطلب. تم تحديث القائمة.");
    await window.loadAdminDeletionRequests();
  } catch { alert("تعذر تحديث حالة طلب الحذف. تحقق من صلاحياتك والاتصال ثم حاول مجددًا."); }
  finally { adminDeletionBusy = false; }
};

window.renderAdminServiceRequests = function () {
  const container = document.getElementById("adminServiceRequestsList");
  if (!container || !currentUserIsAdmin) return;
  const status = document.getElementById("adminServiceStatusFilter")?.value || "all";
  const country = document.getElementById("adminServiceCountryFilter")?.value || "all";
  const serviceType = document.getElementById("adminServiceTypeFilter")?.value || "all";
  const filtered = adminServiceRequests.filter(request =>
    (status === "all" || request.status === status) &&
    (country === "all" || effectiveCountry(request) === country) &&
    (serviceType === "all" || request.serviceType === serviceType)
  );

  container.innerHTML = filtered.length ? filtered.map(request => {
    const verificationHtml = request.serviceType === "verification" && request.details ? `
      <div style="background:#171c19;padding:9px;border-radius:8px;margin-top:8px;font-size:12px;">
        رقم الحيوان: ${escapeHtml(request.details.animalIdentifier || "غير محدد")}<br>
        التطعيم: ${escapeHtml(request.details.vaccinationStatus || "غير محدد")} — ${escapeHtml(request.details.vaccinationDate || "غير محدد")}<br>
        الفحص البيطري: ${escapeHtml(request.details.vetInspectionStatus || "غير محدد")} — ${escapeHtml(request.details.vetInspectionDate || "غير محدد")}<br>
        ${request.notes ? `ملاحظة: ${escapeHtml(request.notes)}` : ""}
      </div>
    ` : "";
    return `
      <div style="background:#222;padding:14px;border-radius:12px;margin-bottom:11px;">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <b style="color:#68e6b0;">${SERVICES[request.serviceType]?.label || "خدمة"}</b>
          <b style="color:#ffd66b;">${Number(request.amount || 0).toLocaleString("en-US")} ${escapeHtml(request.currency || "")}</b>
        </div>
        <div>الإعلان: ${escapeHtml(request.targetName)}</div>
        <div>البائع: ${escapeHtml(request.sellerName)} <small>(${escapeHtml(request.userId.slice(0, 10))}…)</small></div>
        <div>الدولة: ${effectiveCountry(request) === "EG" ? "مصر" : "الإمارات"}</div>
        <div>الحالة: <b>${serviceStatusText(request.status)}</b></div>
        <div>الدفع: <b>${servicePaymentText(request)}</b></div>
        ${request.paymentOverride === true ? `<div style="color:#ffd66b;font-size:12px;">سبب الاعتماد الاستثنائي: ${escapeHtml(request.paymentOverrideReason || "غير محدد")}</div>` : ""}
        <div style="color:#888;font-size:12px;">${formatDate(request.createdAt)}</div>
        ${verificationHtml}
        ${request.status === "pending" ? `
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button onclick="decideServiceRequest(${inlineArgument(request.id)},'approved')" ${effectivePaymentStatus(request) !== "paid" ? "disabled" : ""} title="${effectivePaymentStatus(request) !== "paid" ? "يتطلب دفعًا مؤكدًا" : "اعتماد طلب مدفوع"}" style="flex:1;padding:10px;background:${effectivePaymentStatus(request) === "paid" ? "#00643e" : "#555"};color:white;border:0;border-radius:8px;">اعتماد مدفوع</button>
            ${effectivePaymentStatus(request) === "unpaid" ? `<button onclick="decideServiceRequest(${inlineArgument(request.id)},'approved_override')" style="flex:1;padding:10px;background:#9a6813;color:white;border:0;border-radius:8px;">اعتماد بدون دفع</button>` : ""}
            <button onclick="decideServiceRequest(${inlineArgument(request.id)},'rejected')" style="flex:1;padding:10px;background:#8b2929;color:white;border:0;border-radius:8px;">رفض</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("") : `<div style="background:#222;padding:20px;border-radius:12px;text-align:center;">لا توجد طلبات مطابقة.</div>`;
};

window.decideServiceRequest = async function (requestId, decision) {
  if (!['approved', 'approved_override', 'rejected'].includes(decision)) return;
  if (!await requireAdminClaim(true)) {
    alert("غير مصرح لك بتنفيذ هذا الإجراء.");
    return;
  }
  const isPaymentOverride = decision === "approved_override";
  const adminNote = decision === "rejected"
    ? prompt("ملاحظة الرفض — اختيارية", "")
    : "";
  if (decision === "rejected" && adminNote === null) return;
  const allowedOverrideReasons = ['تجريبي', 'مجاني', 'تعويض', 'عرض ترويجي', 'قرار إداري', 'أخرى'];
  let paymentOverrideReason = "";
  if (isPaymentOverride) {
    if (!confirm("سيتم تفعيل الخدمة دون تسجيل دفعة مالية. هل تريد المتابعة باعتماد استثنائي؟")) return;
    paymentOverrideReason = (prompt("سبب الاعتماد بدون دفع (تجريبي، مجاني، تعويض، عرض ترويجي، قرار إداري، أخرى)", "قرار إداري") || "").trim();
    if (!allowedOverrideReasons.includes(paymentOverrideReason)) {
      alert("اختر سببًا صحيحًا من القائمة المحددة.");
      return;
    }
  }

  try {
    const requestRef = doc(db, "serviceRequests", requestId);
    await runTransaction(db, async transaction => {
      const requestSnap = await transaction.get(requestRef);
      if (!requestSnap.exists()) throw new Error("SERVICE_REQUEST_NOT_FOUND");
      const request = requestSnap.data();
      if (request.status !== "pending") throw new Error("SERVICE_REQUEST_NOT_PENDING");
      const paymentStatus = effectivePaymentStatus(request);

      if (decision === "rejected") {
        const rejection = {
          status: "rejected",
          rejectedAt: serverTimestamp(),
          rejectedBy: auth.currentUser.uid,
          updatedAt: serverTimestamp()
        };
        if (adminNote.trim()) rejection.adminNote = adminNote.trim().slice(0, 1000);
        transaction.update(requestRef, rejection);
        return;
      }

      if (!isPaymentOverride && paymentStatus !== "paid") throw new Error("SERVICE_PAYMENT_REQUIRED");
      if (isPaymentOverride && paymentStatus !== "unpaid") throw new Error("SERVICE_OVERRIDE_NOT_ALLOWED");

      const targetCollection = request.targetType === "auction" ? "auctions" : "animals";
      const targetRef = doc(db, targetCollection, request.targetId);
      const targetSnap = await transaction.get(targetRef);
      if (!targetSnap.exists()) throw new Error("SERVICE_TARGET_NOT_FOUND");
      const target = targetSnap.data();
      if (target.sellerId !== request.userId || effectiveCountry(target) !== effectiveCountry(request)) {
        throw new Error("SERVICE_TARGET_MISMATCH");
      }

      const targetUpdate = {};
      if (request.serviceType === "featured") {
        targetUpdate.featuredAt = serverTimestamp();
        targetUpdate.featuredUntil = Timestamp.fromMillis(
          Date.now() + SERVICES.featured.durationDays * 24 * 60 * 60 * 1000
        );
      } else if (request.serviceType === "bump") {
        targetUpdate.bumpedAt = serverTimestamp();
      } else if (request.serviceType === "verification" && request.targetType === "animal") {
        targetUpdate.verificationStatus = "verified";
        targetUpdate.verifiedAt = serverTimestamp();
        targetUpdate.verifiedBy = auth.currentUser.uid;
      } else {
        throw new Error("SERVICE_TARGET_MISMATCH");
      }

      transaction.update(targetRef, targetUpdate);
      const approval = {
        status: "approved",
        approvedAt: serverTimestamp(),
        approvedBy: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      };
      if (isPaymentOverride) {
        approval.paymentOverride = true;
        approval.paymentOverrideBy = auth.currentUser.uid;
        approval.paymentOverrideAt = serverTimestamp();
        approval.paymentOverrideReason = paymentOverrideReason;
      }
      transaction.update(requestRef, approval);
    });

    alert(decision === "rejected"
      ? "تم رفض الطلب."
      : isPaymentOverride
        ? "✅ تم اعتماد الطلب استثنائيًا بدون دفع."
        : "✅ تم اعتماد الطلب المدفوع.");
    await window.openAdminPanel();
    await loadMarket();
  } catch (error) {
    console.error("ADMIN SERVICE DECISION ERROR:", error);
    alert(error.message === "SERVICE_REQUEST_NOT_PENDING"
      ? "تم اتخاذ قرار على هذا الطلب مسبقًا."
      : error.message === "SERVICE_PAYMENT_REQUIRED"
        ? "لا يمكن الاعتماد العادي قبل تأكيد الدفع."
        : error.message === "SERVICE_OVERRIDE_NOT_ALLOWED"
          ? "الاعتماد بدون دفع متاح للطلبات غير المدفوعة فقط."
          : "تعذر تنفيذ قرار الطلب.");
  }
};

window.saveProfile = async function () {
  const user = auth.currentUser;
  if (!user) return;

  const nameInput = document.getElementById("profileName");
  const typeInput = document.getElementById("profileAccountType");
  const status = document.getElementById("profileStatus");
  if (!nameInput || !typeInput || !status) return;

  const displayName = nameInput.value.trim();
  const accountType = typeInput.value;

  if (displayName.length < 2) {
    status.innerHTML = "❌ أدخل الاسم.";
    return;
  }

  try {
    await setDoc(doc(db, "users", user.uid), {
      displayName,
      accountType,
      ...(user.phoneNumber ? { phoneNumber: user.phoneNumber } : {}),
      updatedAt: serverTimestamp()
    }, { merge: true });

    status.innerHTML = "✅ تم الحفظ";
    await loadMarket();

    closeModal();
    window.location.hash = "#home";
  } catch (error) {
    console.error(error);
    status.innerHTML = "❌ تعذر الحفظ";
  }
};

// =====================================
// إعلاناتي ومزاداتي - للبائع
// =====================================

window.showMyListings = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.openLogin();
    return;
  }

  showModal(`
    <div style="direction:rtl;color:white;padding:12px;text-align:center;">
      <h2 style="color:#68e6b0;">📦 إعلاناتي ومزاداتي</h2>
      <p style="color:#aaa;">جاري تحميل إعلاناتك...</p>
    </div>
  `);

  try {
    const animalsQuery = query(
      collection(db, "animals"),
      where("sellerId", "==", user.uid)
    );

    const animalsSnapshot = await getDocs(animalsQuery);
    const myAnimals = [];

    animalsSnapshot.forEach(animalDoc => {
      myAnimals.push({
        id: animalDoc.id,
        ...animalDoc.data()
      });
    });

    const auctionsQuery = query(
      collection(db, "auctions"),
      where("sellerId", "==", user.uid)
    );

    const auctionsSnapshot = await getDocs(auctionsQuery);
    const auctionsByAnimal = {};

    auctionsSnapshot.forEach(auctionDoc => {
      const auction = {
        id: auctionDoc.id,
        ...auctionDoc.data()
      };

      if (auction.animalId) {
        auctionsByAnimal[auction.animalId] = auction;
      }
    });

    myAnimals.sort((a, b) =>
      timestampToMillis(b.createdAt) -
      timestampToMillis(a.createdAt)
    );

    if (myAnimals.length === 0) {
      showModal(`
        <div style="direction:rtl;color:white;padding:15px;text-align:center;">
          <h2 style="color:#68e6b0;">📦 إعلاناتي ومزاداتي</h2>
          <div style="background:#222;padding:22px;border-radius:14px;margin:20px 0;">
            لا توجد لديك إعلانات أو مزادات حتى الآن.
          </div>
          <button onclick="openLogin()"
            style="width:100%;padding:14px;background:#28566f;color:white;border:0;border-radius:10px;">
            الرجوع إلى حسابي
          </button>
        </div>
      `);
      return;
    }

    let activeCount = 0;
    let soldCount = 0;
    let closedCount = 0;

    const cards = myAnimals.map(animal => {
      const auction = auctionsByAnimal[animal.id] || null;

      let statusText = "نشط";
      let statusColor = "#68e6b0";
      let statusBackground = "#123c2c";
      let priceHtml = "";
      let extraHtml = "";

      const saleTypeText =
        animal.saleType === "auction"
          ? "🔨 مزاد إلكتروني"
          : "🛒 بيع مباشر";

      if (animal.saleType === "direct") {
        priceHtml = `
          <p>
            💰 السعر:
            <b style="color:#68e6b0;">${money(animal.price, effectiveCountry(animal))}</b>
          </p>
        `;

        if (!animal.status || animal.status === "active") {
          statusText = "✅ إعلان نشط";
          activeCount++;
        } else if (animal.status === "sold") {
          statusText = "✅ تم البيع";
          statusColor = "#ffffff";
          statusBackground = "#00643e";
          soldCount++;
        } else {
          statusText = "⛔ غير نشط";
          statusColor = "#ff8d8d";
          statusBackground = "#421d1d";
          closedCount++;
        }
      }

      if (animal.saleType === "auction") {
        if (auction) {
          const endMillis = timestampToMillis(auction.endTime);
          const expired = !endMillis || endMillis <= Date.now();
          const currentPrice = Number(
            auction.currentPrice ||
            auction.startPrice ||
            animal.price ||
            0
          );

          priceHtml = `
            <p>
              💰 سعر البداية:
              <b>${money(auction.startPrice, effectiveCountry(auction))}</b>
            </p>
            <p>
              🏆 السعر الحالي:
              <b style="color:#68e6b0;">${money(currentPrice, effectiveCountry(auction))}</b>
            </p>
          `;

          if (auction.status === "sold") {
            statusText = "✅ تم اعتماد البيع";
            statusColor = "#ffffff";
            statusBackground = "#00643e";
            soldCount++;

            extraHtml = `
              <div style="background:#10271c;padding:12px;border-radius:10px;margin-top:10px;">
                السعر النهائي:
                <b style="color:#68e6b0;">${money(currentPrice, effectiveCountry(auction))}</b>
              </div>
            `;
          } else if (auction.status === "not_approved") {
            statusText = "❌ لم يتم اعتماد البيع";
            statusColor = "#ff8d8d";
            statusBackground = "#421d1d";
            closedCount++;
          } else if (!expired) {
            statusText = "🔨 مزاد نشط";
            activeCount++;

            extraHtml = `
              <div style="background:#302a16;color:#ffd66b;padding:12px;border-radius:10px;margin-top:10px;text-align:center;">
                ⏱ ${getCountdownText(auction.endTime)}
              </div>
            `;
          } else if (auction.lastBidderId) {
            statusText = "⏳ بانتظار اعتماد النتيجة";
            statusColor = "#ffd66b";
            statusBackground = "#302a16";
            activeCount++;

            extraHtml = `
              <div style="margin-top:10px;color:#ffd66b;">
                توجد مزايدة بانتظار قرارك
              </div>
            `;
          } else {
            statusText = "⛔ انتهى بدون مزايدات";
            statusColor = "#ddd";
            statusBackground = "#333";
            closedCount++;
          }
        } else {
          statusText = "⚠️ بيانات المزاد غير متوفرة";
          statusColor = "#ffd66b";
          statusBackground = "#302a16";
          closedCount++;

          priceHtml = `
            <p>
              💰 السعر:
              <b>${money(animal.price, effectiveCountry(animal))}</b>
            </p>
          `;
        }
      }

      return `
        <div style="background:#222;padding:18px;border-radius:16px;margin-bottom:15px;text-align:right;">
          ${animalPhotoHtml(animal)}

          <div style="margin-top:13px;display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;">
            <span style="background:#28566f;padding:6px 10px;border-radius:20px;font-size:14px;">
              ${saleTypeText}
            </span>

            <span style="background:${statusBackground};color:${statusColor};padding:6px 10px;border-radius:20px;font-size:14px;font-weight:bold;">
              ${statusText}
            </span>
          </div>

          <h3 style="color:#68e6b0;font-size:22px;margin-bottom:8px;">
            ${animalIcon(animal.type || "")}
            ${escapeHtml(animal.name || animal.type || "حلال")}
          </h3>

          ${priceHtml}
          ${extraHtml}

          <p>
            📍 ${escapeHtml(animal.location || "غير محدد")}
          </p>

          ${listingAnimalDetailsHtml(animal)}
          ${listingDescriptionHtml(animal)}

          <p style="color:#aaa;font-size:13px;margin-top:14px;">
            📅 تاريخ الإعلان:
            ${formatListingDate(animal.createdAt)}
          </p>

          <button onclick="manageListing(${inlineArgument(animal.id)})"
            style="width:100%;background:#28566f;color:white;border:0;padding:14px;border-radius:10px;margin-top:12px;font-size:16px;font-weight:bold;">
            ⚙️ إدارة الإعلان
          </button>
        </div>
      `;
    }).join("");

    showModal(`
      <div style="direction:rtl;color:white;padding:12px;">
        <h2 style="color:#68e6b0;text-align:center;margin-bottom:6px;">
          📦 إعلاناتي ومزاداتي
        </h2>

        <p style="text-align:center;color:#aaa;margin-top:0;">
          جميع إعلاناتك الحالية والسابقة
        </p>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:18px 0;">
          <div style="background:#123c2c;border-radius:10px;padding:10px 5px;text-align:center;">
            <div style="color:#68e6b0;font-size:22px;font-weight:bold;">${activeCount}</div>
            <div style="font-size:12px;">نشط</div>
          </div>

          <div style="background:#163529;border-radius:10px;padding:10px 5px;text-align:center;">
            <div style="color:#68e6b0;font-size:22px;font-weight:bold;">${soldCount}</div>
            <div style="font-size:12px;">تم البيع</div>
          </div>

          <div style="background:#421d1d;border-radius:10px;padding:10px 5px;text-align:center;">
            <div style="color:#ff8d8d;font-size:22px;font-weight:bold;">${closedCount}</div>
            <div style="font-size:12px;">منتهي</div>
          </div>
        </div>

        ${cards}

        <button onclick="openLogin()"
          style="width:100%;padding:14px;background:#00643e;color:white;border:0;border-radius:10px;margin-top:8px;font-weight:bold;">
          👤 الرجوع إلى حسابي
        </button>

        <div style="height:30px;"></div>
      </div>
    `);

  } catch (error) {
    console.error("MY LISTINGS ERROR:", error);

    showModal(`
      <div style="direction:rtl;color:white;padding:20px;text-align:center;">
        <h2 style="color:#68e6b0;">📦 إعلاناتي ومزاداتي</h2>
        <p style="color:#ff8d8d;">❌ تعذر تحميل إعلاناتك.</p>
        <button onclick="openLogin()"
          style="width:100%;padding:14px;background:#28566f;color:white;border:0;border-radius:10px;">
          الرجوع إلى حسابي
        </button>
      </div>
    `);
  }
};

window.showMyPurchaseRequests = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.openLogin();
    return;
  }

  showModal(`
    <div style="direction:rtl;color:white;padding:12px;text-align:center;">
      <h2 style="color:#68e6b0;">📋 طلباتي</h2>
      <p style="color:#aaa;">جاري تحميل طلباتك...</p>
    </div>
  `);

  try {
    const requestsQuery = query(
      collection(db, "purchaseRequests"),
      where("buyerId", "==", user.uid)
    );

    const snapshot = await getDocs(requestsQuery);
    const requests = [];

    snapshot.forEach(requestDoc => {
      requests.push({
        id: requestDoc.id,
        ...requestDoc.data()
      });
    });

    requests.sort((a, b) =>
      timestampToMillis(b.createdAt) -
      timestampToMillis(a.createdAt)
    );

    if (requests.length === 0) {
      showModal(`
        <div style="direction:rtl;color:white;padding:15px;text-align:center;">
          <h2 style="color:#68e6b0;">📋 طلباتي</h2>
          <div style="background:#222;padding:22px;border-radius:14px;margin:20px 0;">
            لم ترسل أي طلب شراء حتى الآن.
          </div>
          <button onclick="openLogin()"
            style="width:100%;padding:14px;background:#28566f;color:white;border:0;border-radius:10px;">
            الرجوع إلى حسابي
          </button>
        </div>
      `);
      return;
    }

    const cards = requests.map(request => {
      let statusText = "⏳ بانتظار رد البائع";
      let statusColor = "#ffd66b";
      let statusBackground = "#302a16";
      let acceptedDetails = "";

      if (request.status === "accepted") {
        statusText = "✅ وافق البائع على طلبك";
        statusColor = "#68e6b0";
        statusBackground = "#123c2c";

        acceptedDetails = `
          <div style="background:#10271c;padding:15px;border-radius:10px;margin-top:15px;">
            <div style="color:#68e6b0;font-weight:bold;margin-bottom:10px;">
              🎉 تم قبول طلب الشراء
            </div>

            ${request.sellerName ? `
              <p>
                👤 البائع:
                <b>${escapeHtml(request.sellerName)}</b>
              </p>
            ` : ""}

            ${request.sellerPhone ? `
              <p>
                📱 رقم البائع:
                <b dir="ltr">${escapeHtml(request.sellerPhone)}</b>
              </p>
            ` : ""}

            <p style="color:#aaa;font-size:14px;">
              يمكنك التواصل مع البائع لإكمال إجراءات البيع والاستلام والدفع شخصياً.
            </p>
          </div>
        `;
      }

      if (request.status === "rejected") {
        statusText = "❌ لم يوافق البائع على الطلب";
        statusColor = "#ff8d8d";
        statusBackground = "#421d1d";
      }

      return `
        <div style="background:#222;padding:18px;border-radius:15px;margin-bottom:15px;text-align:right;">
          <h3 style="color:#68e6b0;margin-top:0;font-size:22px;">
            ${animalIcon(request.animalType || "")}
            ${escapeHtml(request.animalType || "حلال")}
          </h3>

          ${request.animalBreed ? `
            <p>
              السلالة:
              <b>${escapeHtml(request.animalBreed)}</b>
            </p>
          ` : ""}

          <p>
            💰 السعر:
            <b>${money(request.price)}</b>
          </p>

          ${request.sellerName ? `
            <p>
              👤 البائع:
              <b>${escapeHtml(request.sellerName)}</b>
            </p>
          ` : ""}

          <p>
            🕒 تاريخ إرسال الطلب:
            <b>${formatDate(request.createdAt)}</b>
          </p>

          <div style="background:${statusBackground};color:${statusColor};padding:14px;border-radius:10px;font-size:18px;font-weight:bold;text-align:center;margin-top:14px;">
            ${statusText}
          </div>

          ${acceptedDetails}
        </div>
      `;
    }).join("");

    showModal(`
      <div style="direction:rtl;color:white;padding:12px;">
        <h2 style="color:#68e6b0;text-align:center;">📋 طلباتي</h2>
        <p style="color:#aaa;text-align:center;margin-bottom:20px;">
          متابعة طلبات الشراء التي أرسلتها
        </p>

        ${cards}

        <button onclick="openLogin()"
          style="width:100%;padding:14px;background:#28566f;color:white;border:0;border-radius:10px;margin-top:10px;">
          الرجوع إلى حسابي
        </button>

        <div style="height:30px;"></div>
      </div>
    `);
  } catch (error) {
    console.error("LOAD MY PURCHASE REQUESTS ERROR:", error);
    alert("❌ تعذر تحميل طلباتك.");
  }
};

window.showPurchaseRequests = async function () {
  const user = auth.currentUser;

  if (!user) {
    window.openLogin();
    return;
  }

  showModal(`
    <div style="direction:rtl;color:white;padding:12px;text-align:center;">
      <h2 style="color:#68e6b0;">📩 طلبات الشراء</h2>
      <p style="color:#aaa;">جاري تحميل الطلبات...</p>
    </div>
  `);

  try {
    const requestsQuery = query(
      collection(db, "purchaseRequests"),
      where("sellerId", "==", user.uid)
    );

    const snapshot = await getDocs(requestsQuery);
    const requests = [];

    snapshot.forEach(requestDoc => {
      requests.push({
        id: requestDoc.id,
        ...requestDoc.data()
      });
    });

    requests.sort((a, b) =>
      timestampToMillis(b.createdAt) -
      timestampToMillis(a.createdAt)
    );

    if (requests.length === 0) {
      showModal(`
        <div style="direction:rtl;color:white;padding:15px;text-align:center;">
          <h2 style="color:#68e6b0;">📩 طلبات الشراء</h2>
          <div style="background:#222;padding:22px;border-radius:14px;margin:20px 0;">
            لا توجد طلبات شراء حالياً.
          </div>
        </div>
      `);
      return;
    }

    const cards = requests.map(request => {
      let statusText = "⏳ بانتظار الرد";
      let statusColor = "#ffd66b";

      if (request.status === "accepted") {
        statusText = "✅ تم القبول";
        statusColor = "#68e6b0";
      }

      if (request.status === "rejected") {
        statusText = "❌ تم الرفض";
        statusColor = "#ff8d8d";
      }

      const actionButtons =
        request.status === "pending"
          ? `
            <button onclick="updatePurchaseRequest(${inlineArgument(request.id)},'accepted')"
              style="width:100%;padding:13px;margin-top:10px;background:#00643e;color:white;border:0;border-radius:9px;">
              ✅ قبول طلب الشراء
            </button>

            <button onclick="updatePurchaseRequest(${inlineArgument(request.id)},'rejected')"
              style="width:100%;padding:13px;margin-top:8px;background:#8b2929;color:white;border:0;border-radius:9px;">
              ❌ رفض الطلب
            </button>
          `
          : "";

      return `
        <div style="background:#222;padding:18px;border-radius:15px;margin-bottom:15px;text-align:right;">
          <h3 style="color:#68e6b0;margin-top:0;">
            ${escapeHtml(request.animalType || "حلال")}
          </h3>

          ${request.animalBreed ? `
            <p>
              السلالة:
              <b>${escapeHtml(request.animalBreed)}</b>
            </p>
          ` : ""}

          <p>
            💰 السعر:
            <b>${money(request.price)}</b>
          </p>

          <p>
            👤 المشتري:
            <b>${escapeHtml(request.buyerName || "مستخدم")}</b>
          </p>

          <p>
            ${request.buyerPhone ? `📱 رقم المشتري: <b dir="ltr">${escapeHtml(request.buyerPhone)}</b>` : "لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة."}
          </p>

          <p>
            🕒 تاريخ الطلب:
            <b>${formatDate(request.createdAt)}</b>
          </p>

          <div style="color:${statusColor};font-size:18px;font-weight:bold;margin-top:12px;">
            ${statusText}
          </div>

          ${actionButtons}
        </div>
      `;
    }).join("");

    showModal(`
      <div style="direction:rtl;color:white;padding:12px;">
        <h2 style="color:#68e6b0;text-align:center;">📩 طلبات الشراء</h2>
        ${cards}
      </div>
    `);
  } catch (error) {
    console.error("LOAD PURCHASE REQUESTS ERROR:", error);
    alert("❌ تعذر تحميل طلبات الشراء.");
  }
};

window.updatePurchaseRequest = async function (requestId, newStatus) {
  const user = auth.currentUser;
  if (!user) return;

  if (!["accepted", "rejected"].includes(newStatus)) return;

  try {
    const requestRef = doc(db, "purchaseRequests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      alert("طلب الشراء غير موجود.");
      return;
    }

    const requestData = requestSnap.data();

    if (requestData.sellerId !== user.uid) {
      alert("غير مصرح لك بتعديل هذا الطلب.");
      return;
    }

    if (requestData.status !== "pending") {
      alert("تم التعامل مع هذا الطلب مسبقاً.");
      await window.showPurchaseRequests();
      return;
    }

    await setDoc(requestRef, {
      status: newStatus,
      updatedAt: serverTimestamp()
    }, { merge: true });

    alert(newStatus === "accepted"
      ? "✅ تم قبول طلب الشراء."
      : "❌ تم رفض طلب الشراء.");

    await window.showPurchaseRequests();
  } catch (error) {
    console.error("UPDATE PURCHASE REQUEST ERROR:", error);

    if (error.code === "permission-denied") {
      alert("تعذر تحديث الطلب. تحقق من صلاحيتك وحالة الطلب.");
      return;
    }

    alert("❌ تعذر تحديث طلب الشراء.");
  }
};

function authMethodButtons(selected) {
  return `<div class="auth-methods" role="group" aria-label="طريقة تسجيل الدخول">
    <button type="button" aria-pressed="${selected === "phone"}" onclick="openLogin()">رقم الهاتف</button>
    <button type="button" aria-pressed="${selected === "email"}" onclick="openEmailAuth()">البريد الإلكتروني</button>
  </div>`;
}

function authErrorText(code) {
  const messages = {
    "auth/email-already-in-use": "هذا البريد الإلكتروني مسجل بالفعل.",
    "auth/invalid-email": "يرجى إدخال بريد إلكتروني صحيح.",
    "auth/weak-password": "كلمة المرور ضعيفة. استخدم كلمة مرور أقوى.",
    "auth/password-does-not-meet-requirements": "كلمة المرور ضعيفة. استخدم كلمة مرور أقوى.",
    "auth/wrong-password": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/user-not-found": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    "auth/too-many-requests": "تم إجراء محاولات كثيرة. يرجى المحاولة لاحقًا.",
    "auth/network-request-failed": "تعذر الاتصال بالشبكة. تحقق من الإنترنت وحاول مرة أخرى.",
    "auth/user-disabled": "هذا الحساب موقوف. يرجى التواصل مع الدعم.",
    "auth/operation-not-allowed": "تسجيل الدخول بهذه الطريقة غير متاح حاليًا. يرجى التواصل مع الدعم.",
    "auth/requires-recent-login": "يرجى تسجيل الدخول مجددًا ثم إعادة المحاولة."
  };
  return messages[code] || "تعذر إتمام الطلب. يرجى المحاولة مرة أخرى.";
}

function validateEmailForm(mode, email, password = "", confirmation = "", name = "") {
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "يرجى إدخال بريد إلكتروني صحيح.";
  if (mode === "reset") return "";
  if (!password || password.length > 4096) return "يرجى إدخال كلمة مرور صحيحة.";
  if (mode === "signup") {
    if (name.length < 2 || name.length > 50) return "يرجى إدخال اسم من حرفين إلى 50 حرفًا.";
    if (password.length < 6) return "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.";
    if (password !== confirmation) return "تأكيد كلمة المرور غير مطابق.";
  }
  return "";
}

let emailAuthBusy = false;
window.openEmailAuth = function (mode = "login") {
  if (emailAuthBusy) return;
  if (auth.currentUser) return showAccount();
  if (!["login", "signup", "reset"].includes(mode)) mode = "login";
  const title = mode === "signup" ? "إنشاء حساب جديد" : mode === "reset" ? "نسيت كلمة المرور؟" : "تسجيل الدخول";
  showModal(`<div class="email-auth" dir="rtl">
    <h2>${title}</h2>${authMethodButtons("email")}
    <form id="emailAuthForm" onsubmit="submitEmailAuth(event, '${mode}')" novalidate>
      ${mode === "signup" ? '<label for="emailDisplayName">الاسم</label><input id="emailDisplayName" autocomplete="name" maxlength="50" required>' : ""}
      <label for="authEmail">البريد الإلكتروني</label>
      <input id="authEmail" type="email" dir="ltr" autocomplete="username" maxlength="254" required>
      ${mode !== "reset" ? `<label for="authPassword">كلمة المرور</label>
        <input id="authPassword" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" maxlength="4096" required>` : ""}
      ${mode === "signup" ? '<label for="authPasswordConfirm">تأكيد كلمة المرور</label><input id="authPasswordConfirm" type="password" autocomplete="new-password" maxlength="4096" required><p>لا تحتاج رقم هاتف أو SMS. يمكنك استخدام حسابك للبيع والشراء.</p>' : ""}
      <p id="emailAuthStatus" role="status" aria-live="polite"></p>
      <button type="submit">${mode === "reset" ? "إرسال رابط إعادة التعيين" : title}</button>
      ${mode === "login" ? '<button type="button" onclick="openEmailAuth(\'signup\')">إنشاء حساب جديد</button><button type="button" onclick="openEmailAuth(\'reset\')">نسيت كلمة المرور؟</button>' : '<button type="button" onclick="openEmailAuth()">العودة لتسجيل الدخول</button>'}
    </form></div>`);
};

window.submitEmailAuth = async function (event, mode) {
  event.preventDefault();
  if (emailAuthBusy || !["login", "signup", "reset"].includes(mode)) return;
  const form = document.getElementById("emailAuthForm");
  const status = document.getElementById("emailAuthStatus");
  if (!form || !status) return;
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword")?.value || "";
  const confirmation = document.getElementById("authPasswordConfirm")?.value || "";
  const name = document.getElementById("emailDisplayName")?.value.trim() || "";
  const invalid = validateEmailForm(mode, email, password, confirmation, name);
  if (invalid) { status.textContent = invalid; return; }
  emailAuthBusy = true;
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach(button => { button.disabled = true; });
  status.textContent = "جاري تنفيذ الطلب…";
  const resetMessage = "تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني إذا كان الحساب مسجلاً لدينا.";
  try {
    if (mode === "reset") {
      await sendPasswordResetEmail(auth, email);
      status.textContent = resetMessage;
    } else {
      const result = mode === "signup"
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      const saved = await ensureUserProfile(result.user, mode === "signup" ? name : "");
      if (!saved) {
        status.textContent = "تم تسجيل الدخول، لكن تعذر حفظ بيانات الحساب. افتح حسابي وأكمل الاسم عند عودة الاتصال.";
      } else if (form.isConnected) {
        await showAccount();
      }
    }
  } catch (error) {
    // Never log Auth errors or credentials; some SDK error objects carry email details.
    status.textContent = mode === "reset" && error.code === "auth/user-not-found"
      ? resetMessage : authErrorText(error.code);
  } finally {
    form.querySelectorAll('input[type="password"]').forEach(input => { input.value = ""; });
    emailAuthBusy = false;
    buttons.forEach(button => { button.disabled = false; });
  }
};

async function readOwnDeletionRequest(user) {
  try {
    const snapshot = await getDoc(doc(db, "accountDeletionRequests", user.uid));
    return snapshot.exists() ? { status: snapshot.data().status } : null;
  } catch { return { unavailable: true }; }
}

let deletionRequestBusy = false;
window.openAccountDeletion = async function () {
  const user = auth.currentUser;
  if (!user) return window.openLogin();
  showModal(`<div class="email-auth" dir="rtl"><h2>حذف الحساب</h2>
    <p>يمكنك طلب حذف حسابك وبياناتك المرتبطة به من سوق الحلال الإلكتروني. قد يتم الاحتفاظ ببعض البيانات لفترة محدودة عندما يكون ذلك ضروريًا لأغراض أمنية أو لمنع الاحتيال أو معالجة النزاعات أو الالتزام بالمتطلبات القانونية.</p>
    <p>هذا طلب للمراجعة، ولا يحذف الحساب أو البيانات فورًا. يبقى حسابك متاحًا حتى إتمام المعالجة.</p>
    <p><a href="delete-account.html">سياسة طلب حذف الحساب</a> · <a href="mailto:soqalhalal9@gmail.com">التواصل مع الدعم</a></p>
    <p id="deletionStatus" role="status" aria-live="polite">جاري التحقق من حالة الطلب…</p>
    <button id="requestDeletionButton" type="button" onclick="confirmAccountDeletion()" disabled>طلب حذف حسابي</button>
    <button type="button" onclick="openLogin()">إلغاء</button></div>`);
  const status = document.getElementById("deletionStatus");
  const button = document.getElementById("requestDeletionButton");
  try {
    const snapshot = await getDoc(doc(db, "accountDeletionRequests", user.uid));
    if (snapshot.exists()) {
      status.textContent = deletionStatusText(snapshot.data().status);
    } else {
      status.textContent = "لم يتم إرسال طلب حذف بعد.";
      button.disabled = false;
    }
  } catch {
    status.textContent = "تعذر التحقق من الطلب. حاول لاحقًا أو تواصل مع الدعم.";
  }
};

function deletionStatusText(status) {
  if (status === "completed") return "تم تسجيل اكتمال معالجة طلب الحذف بواسطة الإدارة. تواصل مع الدعم للاستفسار عن البيانات المحتفظ بها.";
  if (status === "in_review") return "طلب حذف الحساب قيد المراجعة. لم تُؤكد عملية الحذف بعد.";
  return "تم إرسال طلب حذف الحساب بنجاح وسيتم التعامل معه وفق سياسة حذف الحساب. الطلب قيد الانتظار، ولم يُحذف الحساب بعد.";
}

window.confirmAccountDeletion = async function () {
  const user = auth.currentUser;
  if (!user || deletionRequestBusy) return;
  if (!confirm("هل أنت متأكد؟ سيؤدي حذف الحساب إلى فقدان إمكانية الوصول إلى حسابك وبياناتك المرتبطة به بعد إتمام عملية الحذف.")) return;
  const status = document.getElementById("deletionStatus");
  const button = document.getElementById("requestDeletionButton");
  if (!status || !button) return;
  deletionRequestBusy = true;
  button.disabled = true;
  try {
    const ref = doc(db, "accountDeletionRequests", user.uid);
    const result = await runTransaction(db, async transaction => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists()) return { created: false, status: snapshot.data().status };
      transaction.set(ref, { userId: user.uid, status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return { created: true, status: "pending" };
    });
    if (!result.created) {
      status.textContent = deletionStatusText(result.status);
      return;
    }
    window.closeModal();
    try {
      await window.logoutUser();
      alert("تم إرسال طلب حذف حسابك بنجاح.");
    }
    catch { alert("تم حفظ طلب الحذف، لكن تعذر تسجيل الخروج. يرجى تسجيل الخروج من حسابي."); }
  } catch {
    status.textContent = "تعذر إرسال طلب الحذف. حاول مرة أخرى أو تواصل مع الدعم.";
    button.disabled = false;
  } finally { deletionRequestBusy = false; }
};

window.openLogin = async function () {
  if (auth.currentUser) {
    await showAccount();
    return;
  }

  showModal(`
    <div style="direction:rtl;color:white;padding:10px;">
      <h2 style="text-align:center;color:#68e6b0;">تسجيل الدخول</h2>
      ${authMethodButtons("phone")}
      <p style="text-align:center;color:#aaa;">اختر الدولة ثم أدخل رقم هاتفك</p>
      <select aria-label="دولة رقم الهاتف" id="loginCountry" onchange="updateLoginPhoneCountry()"
        style="width:100%;box-sizing:border-box;padding:14px;margin:10px 0;">
        <option value="AE" selected>🇦🇪 الإمارات العربية المتحدة (+971)</option>
        <option value="EG">🇪🇬 جمهورية مصر العربية (+20)</option>
      </select>
      <input aria-label="رقم الهاتف" id="phoneNumber" type="tel" value="+971" placeholder="05xxxxxxxx"
        style="width:100%;box-sizing:border-box;padding:14px;margin:10px 0;">

      <div id="recaptcha-container"></div>

      <button onclick="sendPhoneCode()"
        style="width:100%;padding:15px;background:#00643e;color:white;border:0;border-radius:10px;">
        إرسال رمز التحقق
      </button>

      <p id="loginStatus"></p>
    </div>
  `);
};

window.updateLoginPhoneCountry = function () {
  const country = document.getElementById("loginCountry")?.value || "AE";
  const input = document.getElementById("phoneNumber");
  if (!input) return;
  input.placeholder = country === "EG" ? "01xxxxxxxxx" : "05xxxxxxxx";
  if (!input.value || input.value === "+971" || input.value === "+20") {
    input.value = country === "EG" ? "+20" : "+971";
  }
};

window.sendPhoneCode = async function () {
  const input = document.getElementById("phoneNumber");
  const status = document.getElementById("loginStatus");
  if (!input || !status) return;

  const country = document.getElementById("loginCountry")?.value || "AE";
  const phone = normalizePhoneNumber(input.value, country);

  if (!phone) {
    status.innerHTML = country === "EG"
      ? "❌ أدخل رقمًا مصريًا صحيحًا يبدأ بـ 01 ويتكون من 11 رقمًا."
      : "❌ أدخل رقمًا إماراتيًا صحيحًا يبدأ بـ 05 ويتكون من 10 أرقام.";
    return;
  }

  try {
    status.innerHTML = "جاري إرسال رمز التحقق...";

    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch (e) {}
      recaptchaVerifier = null;
    }

    recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      { size: "invisible" }
    );

    confirmationResult = await signInWithPhoneNumber(
      auth,
      phone,
      recaptchaVerifier
    );

    showCodeScreen(phone);
  } catch (error) {
    status.textContent = error.code === "auth/billing-not-enabled"
      ? "تسجيل الدخول برقم الهاتف غير متاح مؤقتًا. يمكنك استخدام البريد الإلكتروني بدلًا من ذلك."
      : authErrorText(error.code);
    if (error.code === "auth/billing-not-enabled") {
      const fallback = document.createElement("button");
      fallback.type = "button";
      fallback.textContent = "استخدم البريد الإلكتروني بدلًا من ذلك";
      fallback.addEventListener("click", () => window.openEmailAuth());
      status.append(document.createElement("br"), fallback);
    }
  }
};

function showCodeScreen(phone) {
  showModal(`
    <div style="direction:rtl;color:white;padding:10px;">
      <h2 style="color:#68e6b0;text-align:center;">رمز التحقق</h2>
      <p style="text-align:center;">تم إرسال الرمز إلى</p>

      <p dir="ltr" style="text-align:center;color:#68e6b0;font-weight:bold;">
        ${escapeHtml(phone)}
      </p>

      <input id="verificationCode" maxlength="6" inputmode="numeric" placeholder="أدخل الرمز"
        style="width:100%;box-sizing:border-box;padding:15px;margin-bottom:10px;text-align:center;">

      <button onclick="verifyPhoneCode()"
        style="width:100%;padding:15px;background:#00643e;color:white;border:0;border-radius:10px;">
        تأكيد الرمز
      </button>

      <p id="verifyStatus"></p>
    </div>
  `);
}

window.verifyPhoneCode = async function () {
  const code = document.getElementById("verificationCode");
  const status = document.getElementById("verifyStatus");

  if (!code || !status || !confirmationResult) return;

  try {
    const result = await confirmationResult.confirm(code.value.trim());
    await ensureUserProfile(result.user);
    closeModal();
    window.location.hash = "#home";
  } catch (error) {
    status.textContent = "❌ رمز التحقق غير صحيح.";
  }
};

window.logoutUser = async function () {
  await signOut(auth);
  window.closeModal();
  await loadMarket();
};

onAuthStateChanged(auth, async user => {
  const loginButton = document.querySelector(".login");
  const adminButton = document.getElementById("adminPanelButton");
  currentUserIsAdmin = false;

  if (user) {
    await ensureUserProfile(user);
    await readOwnDeletionRequest(user);
    if (auth.currentUser?.uid !== user.uid) return;
    try {
      const tokenResult = await getIdTokenResult(user);
      currentUserIsAdmin = tokenResult.claims.admin === true;
    } catch (error) {
      console.error("ADMIN CLAIM ERROR:", error);
    }
    if (loginButton) loginButton.textContent = "✅ حسابي";
    if (adminButton) adminButton.style.display = currentUserIsAdmin ? "inline-flex" : "none";
    startUnreadMessagesListener(user);
  } else {
    if (loginButton) loginButton.textContent = "تسجيل الدخول";
    if (adminButton) adminButton.style.display = "none";
    stopUnreadMessagesListener();
  }

  await loadMarket();
});

function createFirebaseArea() {
  let area = document.getElementById("firebase-market");
  if (area) return area;
  if (!activeMarketCountry) {
    window.openMarketCountrySelector();
    return null;
  }

  area = document.createElement("section");
  area.id = "firebase-market";

  area.innerHTML = `
    <div style="max-width:1100px;margin:35px auto;padding:20px;direction:rtl;">
      <h2 style="text-align:center;color:#68e6b0;margin-bottom:7px;">🐪 سوق الحلال</h2>
      <p style="text-align:center;color:#aaa;margin-top:0;">
        ابحث داخل سوق ${COUNTRIES[activeMarketCountry].name} حسب المنطقة والمدينة
      </p>

      <div id="market-filters"
        style="background:#1d2521;border:1px solid #35443d;border-radius:16px;padding:16px;margin:22px 0 25px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">

        <select id="marketRegionFilter" onchange="updateMarketCityFilter()"
          style="width:100%;padding:13px;border-radius:10px;border:1px solid #45564e;">
          <option value="all">جميع المناطق والمحافظات</option>
        </select>

        <select id="marketCityFilter" onchange="applyMarketFilters()"
          style="width:100%;padding:13px;border-radius:10px;border:1px solid #45564e;">
          <option value="all">جميع المدن والمناطق</option>
        </select>

        <select id="marketAnimalFilter" onchange="applyMarketFilters()"
          style="width:100%;padding:13px;border-radius:10px;border:1px solid #45564e;">
          <option value="all">🐾 جميع أنواع الحلال</option>
          <option value="ناقة">🐫 ناقة</option>
          <option value="غنم">🐑 غنم</option>
          <option value="ماعز">🐐 ماعز</option>
          <option value="بقر">🐄 بقر</option>
          <option value="دجاج">🐔 دجاج</option>
          <option value="صقور">🦅 صقور</option>
          <option value="غزال">🦌 غزال</option>
          <option value="نعام">🐦 نعام</option>
          <option value="حمام">🕊️ حمام</option>
        </select>

        <select id="marketSaleTypeFilter" onchange="applyMarketFilters()"
          style="width:100%;padding:13px;border-radius:10px;border:1px solid #45564e;">
          <option value="all">جميع طرق البيع</option>
          <option value="direct">🛒 بيع مباشر</option>
          <option value="auction">🔨 مزاد إلكتروني</option>
        </select>

        <button onclick="resetMarketFilters()"
          style="width:100%;background:#5c635f;color:white;border:0;padding:13px;border-radius:10px;">
          🔄 إظهار الكل
        </button>
      </div>

      <p id="firebase-status" style="text-align:center;color:#aaa;"></p>

      <div id="direct-sales-anchor" aria-hidden="true"></div>
      <h2 style="margin-top:40px;color:#68e6b0;">🛒 البيع المباشر</h2>
      <div id="direct-sales"
        style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;"></div>

      <h2 style="margin-top:50px;color:#68e6b0;">🔨 المزاد الإلكتروني</h2>
      <div id="auction-list"
        style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;"></div>
    </div>
  `;

  const main = document.querySelector("main");
  const sellSection = document.getElementById("sell");

  if (main && sellSection) {
    main.insertBefore(area, sellSection);
  } else {
    (main || document.body).appendChild(area);
  }
  window.updateMarketRegionFilter(false);
  return area;
}

function serviceStatusText(status) {
  if (status === "approved") return "تم الاعتماد";
  if (status === "rejected") return "مرفوض";
  if (status === "cancelled") return "ملغي";
  return "قيد المراجعة";
}

function effectivePaymentStatus(request) {
  return request?.paymentStatus || "unpaid";
}

function servicePaymentText(request) {
  if (request?.status === "approved" && request?.paymentOverride === true) {
    return "معتمد استثنائيًا بدون دفع";
  }
  if (effectivePaymentStatus(request) === "paid") return "مدفوع";
  if (effectivePaymentStatus(request) === "refunded") return "مسترد";
  return "غير مدفوع";
}

function demoPaymentLink(request) {
  return request?.status === "pending" &&
    (!Object.hasOwn(request, "paymentStatus") || request.paymentStatus === "unpaid")
    ? '<a href="payment-demo.html" style="display:inline-block;color:#b88624;padding:10px 0;">الدفع التجريبي</a>' : "";
}

function serviceRequestId(userId, serviceType, targetType, targetId) {
  return [userId, serviceType, targetType, targetId].join("_");
}

function listingServiceTarget(animal, serviceType) {
  if (serviceType === "verification" || animal.saleType !== "auction") {
    return { targetType: "animal", targetId: animal.id };
  }
  return { targetType: "auction", targetId: animal.auctionId || "" };
}

async function getUserServiceRequests(userId) {
  const requestsQuery = query(
    collection(db, "serviceRequests"),
    where("userId", "==", userId)
  );
  const snapshot = await getDocs(requestsQuery);
  return snapshot.docs.map(requestDoc => ({ id: requestDoc.id, ...requestDoc.data() }));
}

async function listingServiceRequest(animal, serviceType, userId, requests = null) {
  const target = listingServiceTarget(animal, serviceType);
  if (!target.targetId) return null;
  const requestId = serviceRequestId(userId, serviceType, target.targetType, target.targetId);
  const availableRequests = requests || await getUserServiceRequests(userId);
  return availableRequests.find(request => request.id === requestId) || null;
}

async function listingServicesHtml(animal, userId) {
  const country = effectiveCountry(animal);
  const userRequests = await getUserServiceRequests(userId);
  let promotion = animal;
  if (animal.saleType === "auction" && animal.auctionId) {
    const snapshot = await getDoc(doc(db, "auctions", animal.auctionId));
    if (snapshot.exists()) promotion = snapshot.data();
  }
  const promotionStatus = `<p>التمييز: ${isFeaturedListing(promotion) ? "نشط حتى " + formatDate(promotion.featuredUntil) : "غير نشط"}</p>
    <p>آخر رفع: ${promotion.bumpedAt ? formatDate(promotion.bumpedAt) : "لم يتم الرفع"}</p>
    <p>التوثيق: ${isVerifiedListing(animal) ? "معتمد" : "غير معتمد"}</p>`;
  const rows = await Promise.all(Object.keys(SERVICES).map(async serviceType => {
    const service = SERVICES[serviceType];
    const pricing = servicePricing(serviceType, country);
    const existing = await listingServiceRequest(animal, serviceType, userId, userRequests);
    const status = existing ? serviceStatusText(existing.status) : "متاح للطلب";
    const disabled = !!existing;
    return `
      <div style="background:#202925;border:1px solid #3b4a43;padding:12px;border-radius:11px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
          <b style="color:#68e6b0;">${service.label}</b>
          <b style="color:#ffd66b;">${money(pricing.price, country)}</b>
        </div>
        <div style="color:#bbb;font-size:13px;margin:7px 0;">${service.description}</div>
        <div style="font-size:13px;margin-bottom:8px;">الحالة: <b>${status}</b></div>
        ${existing ? `<div>الدفع: ${servicePaymentText(existing)}</div>${demoPaymentLink(existing)}` : ""}
        <button onclick="openListingService(${inlineArgument(animal.id)},${inlineArgument(serviceType)})" ${disabled ? "disabled" : ""}
          style="width:100%;padding:10px;border:0;border-radius:9px;background:${disabled ? "#555" : "#b88624"};color:white;font-weight:bold;">
          ${disabled ? status : "طلب الخدمة"}
        </button>
      </div>
    `;
  }));

  return `
    <div style="background:#171c19;padding:14px;border-radius:13px;margin:15px 0;">
      <h3 style="color:#ffd66b;margin-top:0;">خدمات الإعلان</h3>
      <p style="color:#aaa;font-size:13px;">الخدمات اختيارية، ولا تؤثر على البيع المجاني.</p>
      ${promotionStatus}
      ${rows.join("")}
    </div>
  `;
}

window.openListingService = async function (animalId, serviceType) {
  const user = auth.currentUser;
  const service = SERVICES[serviceType];
  if (!user || !service) return;

  const animalSnap = await getDoc(doc(db, "animals", animalId));
  if (!animalSnap.exists() || animalSnap.data().sellerId !== user.uid) {
    alert("غير مصرح لك بطلب خدمة لهذا الإعلان.");
    return;
  }
  const animal = { id: animalSnap.id, ...animalSnap.data() };
  const country = effectiveCountry(animal);
  const pricing = servicePricing(serviceType, country);
  const existing = await listingServiceRequest(animal, serviceType, user.uid);
  if (existing) {
    alert(existing.status === "pending"
      ? "لديك طلب لهذه الخدمة قيد المراجعة بالفعل."
      : "هذه الخدمة لديها طلب سابق ولا يمكن تكراره حاليًا.");
    return;
  }

  const verificationDetails = serviceType === "verification" ? `
    <div style="background:#202925;padding:11px;border-radius:9px;text-align:right;font-size:13px;margin:10px 0;">
      <div>رقم الحيوان: ${escapeHtml(animal.animalIdentifier || "غير محدد")}</div>
      <div>حالة التطعيم: ${escapeHtml(animal.vaccinationStatus || "غير محدد")}</div>
      <div>تاريخ التطعيم: ${escapeHtml(animal.vaccinationDate || "غير محدد")}</div>
      <div>الفحص البيطري: ${escapeHtml(animal.vetInspectionStatus || "غير محدد")}</div>
      <div>تاريخ الفحص: ${escapeHtml(animal.vetInspectionDate || "غير محدد")}</div>
    </div>
    <textarea aria-label="ملاحظة اختيارية للمراجعة" id="serviceRequestNotes" maxlength="1000" placeholder="ملاحظة اختيارية للمراجعة"
      style="width:100%;box-sizing:border-box;padding:12px;border-radius:9px;margin-bottom:10px;"></textarea>
  ` : "";

  showModal(`
    <div style="direction:rtl;color:white;padding:12px;text-align:center;">
      <h2 style="color:#68e6b0;">${service.label}</h2>
      <p><b>${escapeHtml(animal.name || animal.type || "حلال")}</b></p>
      <p style="color:#bbb;">${service.description}</p>
      <div style="font-size:23px;color:#ffd66b;font-weight:bold;margin:12px 0;">${money(pricing.price, country)}</div>
      <div style="color:#aaa;font-size:13px;">لا يوجد دفع إلكتروني الآن. سيُرسل الطلب للمراجعة فقط.</div>
      ${verificationDetails}
      <button onclick="submitListingService(${inlineArgument(animal.id)},${inlineArgument(serviceType)})"
        style="width:100%;padding:13px;background:#b88624;color:white;border:0;border-radius:10px;margin-top:12px;font-weight:bold;">
        ${serviceType === "featured" ? "طلب التمييز" : "إرسال الطلب"}
      </button>
    </div>
  `);
};

window.submitListingService = async function (animalId, serviceType) {
  const user = auth.currentUser;
  const service = SERVICES[serviceType];
  if (!user || !service) return;

  try {
    const animalSnap = await getDoc(doc(db, "animals", animalId));
    if (!animalSnap.exists() || animalSnap.data().sellerId !== user.uid) {
      alert("غير مصرح لك بطلب هذه الخدمة.");
      return;
    }
    const animal = { id: animalSnap.id, ...animalSnap.data() };
    const country = effectiveCountry(animal);
    const pricing = servicePricing(serviceType, country);
    const target = listingServiceTarget(animal, serviceType);
    if (!target.targetId) throw new Error("SERVICE_TARGET_NOT_FOUND");
    const requestId = serviceRequestId(user.uid, serviceType, target.targetType, target.targetId);
    const requestRef = doc(db, "serviceRequests", requestId);
    const existing = await listingServiceRequest(animal, serviceType, user.uid);
    if (existing) {
      alert(existing.status === "pending"
        ? "لديك طلب لهذه الخدمة قيد المراجعة بالفعل."
        : "لا يمكن تكرار هذا الطلب حاليًا.");
      return;
    }

    const requestData = {
      userId: user.uid,
      serviceType,
      targetType: target.targetType,
      targetId: target.targetId,
      country,
      amount: pricing.price,
      currency: pricing.currency,
      paymentStatus: "unpaid",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (serviceType === "verification") {
      requestData.notes = document.getElementById("serviceRequestNotes")?.value.trim() || "";
      requestData.details = {
        animalIdentifier: animal.animalIdentifier || "",
        vaccinationStatus: animal.vaccinationStatus || "unknown",
        vaccinationDate: animal.vaccinationDate || "",
        vetInspectionStatus: animal.vetInspectionStatus || "unknown",
        vetInspectionDate: animal.vetInspectionDate || ""
      };
    }

    await setDoc(requestRef, requestData);
    alert("✅ تم إرسال طلب الخدمة للمراجعة.");
    window.closeModal();
  } catch (error) {
    console.error("SERVICE REQUEST ERROR:", error);
    alert(error.code === "permission-denied" ? "تعذر إرسال الطلب. تحقق من صلاحية حسابك وعدم وجود طلب سابق." : "❌ تعذر إرسال طلب الخدمة.");
  }
};

window.goToDirectSales = async function (event) {
  if (event) event.preventDefault();

  if (!activeMarketCountry) {
    await loadMarket();
    return;
  }

  createFirebaseArea();

  const directContainer = document.getElementById("direct-sales");
  if (!directContainer || directContainer.childElementCount === 0) {
    await loadMarket();
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const anchor = document.getElementById("direct-sales-anchor");
      if (!anchor) return;

      anchor.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
};

window.goToMarketSearch = function (event) {
  if (event) event.preventDefault();

  if (!activeMarketCountry) {
    loadMarket();
    return;
  }

  createFirebaseArea();

  requestAnimationFrame(() => {
    const filters = document.getElementById("market-filters");
    if (!filters) return;

    filters.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
};

function auctionActionHtml(auction, expired, isOwner) {
  const user = auth.currentUser;
  const hasBid = !!auction.lastBidderId;
  const isHighestBidder = !!user && auction.lastBidderId === user.uid;

  if (auction.status === "sold") {
    if (isOwner) {
      return `
        <div style="background:#123c2c;color:#68e6b0;padding:16px;border-radius:12px;text-align:center;margin-top:15px;">
          <div style="font-size:20px;font-weight:bold;">✅ تم اعتماد البيع</div>
          <p>السعر النهائي: <b>${money(auction.currentPrice, effectiveCountry(auction))}</b></p>

          ${auction.lastBidderPhone ? `
            <p>
              📱 رقم الفائز:
              <b dir="ltr">${escapeHtml(auction.lastBidderPhone)}</b>
            </p>
          ` : ""}

          <p style="color:white;font-size:14px;">
            يتم التواصل مع الفائز لإتمام المعاينة والاستلام والدفع شخصياً.
          </p>

          <button onclick="openAuctionConversation(${inlineArgument(auction.id)})"
            style="width:100%;background:#b88624;color:white;border:0;padding:13px;border-radius:10px;margin-top:10px;font-weight:bold;">
            💬 مراسلة الفائز
          </button>
        </div>
      `;
    }

    if (isHighestBidder) {
      return `
        <div style="background:#123c2c;color:#68e6b0;padding:16px;border-radius:12px;text-align:center;margin-top:15px;">
          <div style="font-size:21px;font-weight:bold;">🎉 مبروك، فزت بالمزاد</div>
          <p style="color:white;">اعتمد البائع أعلى مزايدة.</p>
          <p>السعر النهائي: <b>${money(auction.currentPrice, effectiveCountry(auction))}</b></p>

          ${auction.sellerName ? `
            <p>👤 البائع: <b>${escapeHtml(auction.sellerName)}</b></p>
          ` : ""}

          ${auction.sellerPhone ? `
            <p>
              📱 رقم البائع:
              <b dir="ltr">${escapeHtml(auction.sellerPhone)}</b>
            </p>
          ` : ""}

          <p style="color:white;font-size:14px;">
            تواصل مع البائع لإتمام المعاينة والاستلام والدفع شخصياً.
          </p>

          <button onclick="openAuctionConversation(${inlineArgument(auction.id)})"
            style="width:100%;background:#b88624;color:white;border:0;padding:13px;border-radius:10px;margin-top:10px;font-weight:bold;">
            💬 مراسلة البائع
          </button>
        </div>
      `;
    }

    return `
      <div style="background:#123c2c;color:#68e6b0;padding:15px;border-radius:10px;text-align:center;margin-top:15px;font-weight:bold;">
        ✅ انتهى المزاد وتم اعتماد البيع
        <br>
        السعر النهائي:
        ${money(auction.currentPrice, effectiveCountry(auction))}
      </div>
    `;
  }

  if (auction.status === "not_approved") {
    return `
      <div style="background:#421d1d;color:#ff8d8d;padding:15px;border-radius:10px;text-align:center;margin-top:15px;font-weight:bold;">
        ❌ انتهى المزاد ولم يعتمد البائع البيع
      </div>
    `;
  }

  if (!expired) {
    if (isOwner) {
      return `
        <div style="width:100%;box-sizing:border-box;background:#302a16;color:#ffd66b;padding:14px;border-radius:10px;text-align:center;font-weight:bold;">
          🔒 هذا مزادك — لا يمكنك المزايدة عليه
        </div>
      `;
    }

    return `
      <button id="bid-button-${auction.id}" onclick="placeBid(${inlineArgument(auction.id)})"
        style="width:100%;background:#984d00;color:white;border:0;padding:16px;border-radius:10px;">
        زايد الآن
      </button>
    `;
  }

  if (!hasBid) {
    return `
      <div style="background:#333;color:#ddd;padding:15px;border-radius:10px;text-align:center;font-weight:bold;">
        ⛔ انتهى المزاد بدون مزايدات
      </div>
    `;
  }

  if (isOwner) {
    return `
      <div style="background:#302a16;color:#ffd66b;padding:16px;border-radius:12px;text-align:center;margin-bottom:10px;">
        <div style="font-size:19px;font-weight:bold;">🏆 أعلى مزايدة</div>
        <div style="color:#68e6b0;font-size:25px;font-weight:bold;margin:10px 0;">
          ${money(auction.currentPrice, effectiveCountry(auction))}
        </div>
        <div>⏳ المزاد انتهى — بانتظار قرارك</div>
      </div>

      <button onclick="finalizeAuction(${inlineArgument(auction.id)},'accept')"
        style="width:100%;background:#00643e;color:white;border:0;padding:16px;border-radius:10px;margin-bottom:10px;font-size:17px;font-weight:bold;">
        ✅ اعتماد البيع لأعلى مزايد
      </button>

      <button onclick="finalizeAuction(${inlineArgument(auction.id)},'reject')"
        style="width:100%;background:#8b2929;color:white;border:0;padding:16px;border-radius:10px;font-size:17px;font-weight:bold;">
        ❌ عدم اعتماد البيع
      </button>
    `;
  }

  if (isHighestBidder) {
    return `
      <div style="background:#302a16;color:#ffd66b;padding:16px;border-radius:12px;text-align:center;font-weight:bold;">
        🏆 أنت صاحب أعلى مزايدة
        <div style="color:#68e6b0;font-size:24px;margin:10px 0;">
          ${money(auction.currentPrice, effectiveCountry(auction))}
        </div>
        ⏳ بانتظار اعتماد البائع للنتيجة
      </div>
    `;
  }

  return `
    <div style="background:#302a16;color:#ffd66b;padding:16px;border-radius:12px;text-align:center;font-weight:bold;">
      ⏳ انتهى المزاد
      <br><br>
      أعلى مزايدة:
      <span style="color:#68e6b0;">${money(auction.currentPrice, effectiveCountry(auction))}</span>
      <br><br>
      بانتظار اعتماد البائع
    </div>
  `;
}

async function loadMarket() {
  if (!activeMarketCountry) {
    updateMarketCountryIndicator();
    window.openMarketCountrySelector();
    return;
  }

  createFirebaseArea();

  const status = document.getElementById("firebase-status");
  const directContainer = document.getElementById("direct-sales");
  const auctionContainer = document.getElementById("auction-list");

  if (!status || !directContainer || !auctionContainer) return;

  status.innerHTML = "جاري تحديث السوق...";

  try {
    const animalSnapshot = await getDocs(collection(db, "animals"));
    const animals = {};

    animalSnapshot.forEach(animalDoc => {
      animals[animalDoc.id] = {
        id: animalDoc.id,
        ...animalDoc.data()
      };
    });

    const directAnimals = Object.values(animals)
      .filter(animal =>
        animal.saleType === "direct" &&
        (!animal.status || animal.status === "active")
      )
      .filter(animal =>
        animalMatchesMarketFilters(animal, "direct")
      )
      .sort(marketplaceSort);

    if (directAnimals.length === 0) {
      directContainer.innerHTML = `
        <div style="background:#222;color:white;padding:20px;border-radius:15px;text-align:center;">
          لا توجد عروض بيع مباشر مطابقة للبحث
        </div>
      `;
    } else {
      directContainer.innerHTML = directAnimals.map(animal => `
        <div style="background:#222;color:white;padding:20px;border-radius:18px;${isFeaturedListing(animal) ? "border:1px solid #b88624;box-shadow:0 0 0 1px rgba(184,134,36,.18);" : ""}">
          ${listingServiceBadges(animal)}
          ${animalPhotoHtml(animal)}

          <h3>${escapeHtml(animal.name || animal.type || "حلال للبيع")}</h3>

          <div style="font-size:25px;color:#68e6b0;font-weight:bold;margin:15px 0;">
            ${money(animal.price, effectiveCountry(animal))}
          </div>

          <p>📍 ${escapeHtml(animal.location || "غير محدد")}</p>

          ${listingAnimalDetailsHtml(animal)}
          ${listingDescriptionHtml(animal)}

          <p style="color:#aaa;font-size:13px;margin-top:14px;">
            📅 تاريخ الإعلان: ${formatListingDate(animal.createdAt)}
          </p>

          <button onclick="requestPurchase(${inlineArgument(animal.id)})"
            style="width:100%;background:#00643e;color:white;border:0;padding:14px;border-radius:10px;">
            طلب شراء
          </button>

          ${(!auth.currentUser || animal.sellerId !== auth.currentUser.uid) ? `
            <button onclick="openDirectConversation(${inlineArgument(animal.id)})"
              style="width:100%;background:#b88624;color:white;border:0;padding:14px;border-radius:10px;margin-top:10px;font-weight:bold;">
              💬 مراسلة البائع / تقديم عرض
            </button>
          ` : ""}

          ${ownerManagementButton(animal)}
        </div>
      `).join("");
    }

    const auctionSnapshot = await getDocs(collection(db, "auctions"));
    const auctions = [];

    auctionSnapshot.forEach(auctionDoc => {
      auctions.push({
        id: auctionDoc.id,
        ...auctionDoc.data()
      });
    });

    const AUCTION_RESULT_VISIBLE_TIME = 24 * 60 * 60 * 1000;

    const visibleAuctions = auctions
      .filter(auction => {
        if (auction.status === "active") return true;
        if (auction.status === "not_approved") return true;

        if (auction.status === "sold") {
          const approvedAt = timestampToMillis(auction.updatedAt);
          if (!approvedAt) return true;

          const elapsed = Date.now() - approvedAt;
          return elapsed < AUCTION_RESULT_VISIBLE_TIME;
        }

        return false;
      })
      .filter(auction => effectiveCountry(auction) === activeMarketCountry)
      .filter(auction => {
        const animal = animals[auction.animalId];
        if (!animal) return false;
        return animalMatchesMarketFilters(animal, "auction");
      })
      .sort(marketplaceSort);

    if (visibleAuctions.length === 0) {
      auctionContainer.innerHTML = `
        <div style="background:#222;color:white;padding:20px;border-radius:15px;text-align:center;">
          لا توجد مزادات مطابقة للبحث
        </div>
      `;
    } else {
      auctionContainer.innerHTML = visibleAuctions.map(auction => {
        const animal = animals[auction.animalId] || {};
        const currentPrice = Number(auction.currentPrice || auction.startPrice || 0);
        const increment = Number(auction.minIncrement || 0);
        const minimumNextBid = currentPrice + increment;
        const endMillis = timestampToMillis(auction.endTime);

        const expired =
          auction.status !== "active" ||
          !endMillis ||
          endMillis <= Date.now();

        const isOwner =
          !!auth.currentUser &&
          auction.sellerId === auth.currentUser.uid;

        let tagText = "مزاد نشط";
        let tagColor = "#00643e";

        if (auction.status === "sold") {
          tagText = "تم اعتماد البيع";
          tagColor = "#00643e";
        } else if (auction.status === "not_approved") {
          tagText = "لم يعتمد البيع";
          tagColor = "#6d2929";
        } else if (expired) {
          tagText = "مزاد منتهي";
          tagColor = "#6d2929";
        }

        return `
          <div style="background:#222;color:white;padding:20px;border-radius:18px;${isFeaturedListing(auction) ? "border:1px solid #b88624;box-shadow:0 0 0 1px rgba(184,134,36,.18);" : ""}">
            ${listingServiceBadges(auction, animal)}
            ${animalPhotoHtml(animal)}

            <div id="auction-tag-${auction.id}"
              style="display:inline-block;background:${tagColor};padding:6px 12px;border-radius:20px;margin-top:12px;">
              ${tagText}
            </div>

            <h3>${escapeHtml(animal.name || animal.type || "مزاد حلال")}</h3>

            <div style="font-size:27px;color:#68e6b0;font-weight:bold;margin:15px 0;">
              السعر الحالي:
              <br>
              ${money(currentPrice, effectiveCountry(auction))}
            </div>

            ${auction.status === "active" ? `
              <div
                data-auction-end="${endMillis}"
                data-auction-id="${auction.id}"
                style="color:#ffd66b;font-size:20px;font-weight:bold;text-align:center;margin:18px 0;">
                ${expired ? "⛔ انتهى المزاد" : "⏱ " + getCountdownText(auction.endTime)}
              </div>
            ` : `
              <div style="text-align:center;color:#aaa;margin:18px 0;">
                ⛔ انتهى المزاد
              </div>
            `}

            <p>📍 ${escapeHtml(animal.location || "غير محدد")}</p>

            ${listingAnimalDetailsHtml(animal)}

            <p>سعر البداية: <b>${money(auction.startPrice, effectiveCountry(auction))}</b></p>
            <p>أقل زيادة: <b>${money(increment, effectiveCountry(auction))}</b></p>
            ${auction.status === "active" && !expired ? `
              <p>
                الحد الأدنى للمزايدة القادمة:
                <b>${money(minimumNextBid, effectiveCountry(auction))}</b>
              </p>
            ` : ""}

            <p style="color:#aaa;text-align:center;">
              موعد الانتهاء:
              ${formatDate(auction.endTime)}
            </p>

            ${listingDescriptionHtml(animal)}

            <p style="color:#aaa;font-size:13px;margin-top:14px;">
              📅 تاريخ الإعلان: ${formatListingDate(animal.createdAt)}
            </p>

            ${auctionActionHtml(auction, expired, isOwner)}

            ${isOwner ? ownerManagementButton(animal) : ""}
          </div>
        `;
      }).join("");
    }

    const totalResults = directAnimals.length + visibleAuctions.length;
    status.innerHTML = "✅ متصل بالسوق • " + totalResults + " نتيجة";

    startAuctionTimers();
  } catch (error) {
    console.error("LOAD MARKET ERROR:", error);
    status.innerHTML = "❌ حدث خطأ أثناء تحميل السوق";
  }
}

window.manageListing = async function (animalId) {
  const user = auth.currentUser;

  if (!user) {
    window.openLogin();
    return;
  }

  try {
    const animalRef = doc(db, "animals", animalId);
    const animalSnap = await getDoc(animalRef);

    if (!animalSnap.exists()) {
      alert("لم يتم العثور على الإعلان.");
      return;
    }

    const animal = {
      id: animalSnap.id,
      ...animalSnap.data()
    };

    if (animal.sellerId !== user.uid) {
      alert("لا يمكنك إدارة إعلان مستخدم آخر.");
      return;
    }

    const servicesHtml = await listingServicesHtml(animal, user.uid);

    const images = Array.isArray(animal.images) ? animal.images : [];

    const imageHtml = images.length > 0
      ? images.map((image, index) => {
          const safe = safeImageData(image);
          if (!safe) return "";

          return `
            <div style="position:relative;margin-bottom:12px;">
              <img src="${safe}"
                style="width:100%;max-height:250px;object-fit:cover;border-radius:12px;">

              <button onclick="removeAnimalImage(${inlineArgument(animal.id)}, ${index})"
                style="width:100%;padding:10px;margin-top:6px;border:0;border-radius:8px;background:#8b2929;color:white;">
                ❌ حذف هذه الصورة
              </button>
            </div>
          `;
        }).join("")
      : `
        <p style="text-align:center;color:#aaa;">
          لا توجد صور حالياً
        </p>
      `;

    const directPriceField =
      animal.saleType === "direct"
        ? `
          <label>السعر (${COUNTRIES[effectiveCountry(animal)].currency})</label>
          <input id="editAnimalPrice" type="number" min="1"
            value="${Number(animal.price || 0)}"
            style="width:100%;box-sizing:border-box;padding:13px;margin-bottom:14px;border-radius:9px;">
        `
        : `
          <div style="background:#302a16;color:#ffd66b;padding:12px;border-radius:10px;margin-bottom:15px;">
            🔨 بيانات سعر المزاد ومدة المزاد لا يتم تعديلها بعد بدء المزاد.
          </div>
        `;

    let saleActionHtml = "";

    if (animal.saleType === "auction" && animal.auctionId) {
      const auctionSnap = await getDoc(doc(db, "auctions", animal.auctionId));

      if (auctionSnap.exists()) {
        const auction = {
          id: auctionSnap.id,
          ...auctionSnap.data()
        };

        const endMillis = timestampToMillis(auction.endTime);
        const expired = !endMillis || endMillis <= Date.now();
        const hasBid = !!auction.lastBidderId;

        if (auction.status === "sold") {
          saleActionHtml = `
            <div style="background:#123c2c;color:#68e6b0;padding:18px;border-radius:12px;text-align:center;margin-bottom:15px;">
              <h3>✅ تم اعتماد البيع</h3>
              <p>
                السعر النهائي:
                <b>${money(auction.currentPrice, effectiveCountry(auction))}</b>
              </p>

              ${auction.lastBidderPhone ? `
                <p>
                  📱 رقم الفائز:
                  <b dir="ltr">${escapeHtml(auction.lastBidderPhone)}</b>
                </p>
              ` : ""}
            </div>
          `;
        } else if (auction.status === "not_approved") {
          saleActionHtml = `
            <div style="background:#421d1d;color:#ff8d8d;padding:18px;border-radius:12px;text-align:center;margin-bottom:15px;font-weight:bold;">
              ❌ تم إغلاق المزاد دون اعتماد البيع
            </div>
          `;
        } else if (!expired) {
          saleActionHtml = `
            <div style="background:#302a16;color:#ffd66b;padding:18px;border-radius:12px;text-align:center;margin-bottom:15px;">
              🔨 المزاد ما زال نشطاً
              <br><br>
              السعر الحالي:
              <b style="color:#68e6b0;">${money(auction.currentPrice, effectiveCountry(auction))}</b>
              <br><br>
              ⏱ ${getCountdownText(auction.endTime)}
            </div>
          `;
        } else if (!hasBid) {
          saleActionHtml = `
            <div style="background:#333;color:#ddd;padding:18px;border-radius:12px;text-align:center;margin-bottom:15px;font-weight:bold;">
              ⛔ انتهى المزاد بدون أي مزايدات
            </div>
          `;
        } else {
          saleActionHtml = `
            <div style="background:#302a16;color:#ffd66b;padding:18px;border-radius:12px;text-align:center;margin-bottom:12px;">
              <h3>🏆 نتيجة المزاد</h3>
              أعلى مزايدة:
              <div style="color:#68e6b0;font-size:28px;font-weight:bold;margin:10px 0;">
                ${money(auction.currentPrice, effectiveCountry(auction))}
              </div>
              ⏳ بانتظار اعتمادك للنتيجة
            </div>

            <button onclick="finalizeAuction(${inlineArgument(auction.id)},'accept')"
              style="width:100%;background:#00643e;color:white;border:0;padding:16px;border-radius:10px;margin-bottom:10px;">
              ✅ اعتماد البيع لأعلى مزايد
            </button>

            <button onclick="finalizeAuction(${inlineArgument(auction.id)},'reject')"
              style="width:100%;background:#8b2929;color:white;border:0;padding:16px;border-radius:10px;margin-bottom:15px;">
              ❌ عدم اعتماد البيع
            </button>
          `;
        }
      }
    } else {
      saleActionHtml = `
        <button onclick="markListingSold(${inlineArgument(animal.id)})"
          style="width:100%;background:#00643e;color:white;border:0;padding:16px;border-radius:10px;margin-bottom:10px;">
          ✅ تم البيع
        </button>
      `;
    }

    showModal(`
      <div style="direction:rtl;color:white;padding:10px;">
        <h2 style="color:#68e6b0;text-align:center;">⚙️ إدارة إعلاني</h2>

        <p style="text-align:center;margin-bottom:18px;">
          📅 تاريخ الإعلان: <b>${formatListingDate(animal.createdAt)}</b>
        </p>

        <label>نوع الحيوان</label>
        <select id="editAnimalType" style="width:100%;padding:13px;margin-bottom:14px;">
          <option value="ناقة" ${animal.type === "ناقة" ? "selected" : ""}>ناقة</option>
          <option value="غنم" ${animal.type === "غنم" ? "selected" : ""}>غنم</option>
          <option value="ماعز" ${animal.type === "ماعز" ? "selected" : ""}>ماعز</option>
          <option value="بقر" ${animal.type === "بقر" ? "selected" : ""}>بقر</option>
          <option value="دجاج" ${animal.type === "دجاج" ? "selected" : ""}>دجاج</option>
          <option value="صقور" ${animal.type === "صقور" ? "selected" : ""}>صقور</option>
          <option value="غزال" ${animal.type === "غزال" ? "selected" : ""}>غزال</option>
          <option value="نعام" ${animal.type === "نعام" ? "selected" : ""}>نعام</option>
          <option value="حمام" ${animal.type === "حمام" ? "selected" : ""}>حمام</option>
        </select>

        <label>السلالة</label>
        <input id="editAnimalBreed" value="${escapeHtml(animal.breed || "")}">

        <label>العمر</label>
        <input id="editAnimalAge" value="${escapeHtml(animal.age || "")}">

        <label>الجنس</label>
        <select id="editAnimalGender">
          <option value="" ${!animal.gender ? "selected" : ""}>غير محدد</option>
          <option value="male" ${animal.gender === "male" ? "selected" : ""}>ذكر</option>
          <option value="female" ${animal.gender === "female" ? "selected" : ""}>أنثى</option>
        </select>

        <label>تاريخ الميلاد — اختياري</label>
        <input id="editAnimalBirthDate" type="date" value="${escapeHtml(animal.birthDate || "")}">

        <label>رقم/معرّف الحيوان — اختياري</label>
        <input id="editAnimalIdentifier" value="${escapeHtml(animal.animalIdentifier || "")}">

        <label>حالة التطعيم</label>
        <select id="editAnimalVaccinationStatus"
          onchange="toggleVaccinationDate('editAnimalVaccinationStatus', 'editAnimalVaccinationDateField', 'editAnimalVaccinationDate')">
          <option value="unknown" ${!animal.vaccinationStatus || animal.vaccinationStatus === "unknown" ? "selected" : ""}>غير محدد</option>
          <option value="vaccinated" ${animal.vaccinationStatus === "vaccinated" ? "selected" : ""}>مطعّم</option>
          <option value="not_vaccinated" ${animal.vaccinationStatus === "not_vaccinated" ? "selected" : ""}>غير مطعّم</option>
        </select>

        <div id="editAnimalVaccinationDateField"
          style="display:${animal.vaccinationStatus === "vaccinated" ? "block" : "none"};width:100%;">
          <label>تاريخ آخر تطعيم — اختياري</label>
          <input id="editAnimalVaccinationDate" type="date"
            value="${animal.vaccinationStatus === "vaccinated" ? escapeHtml(animal.vaccinationDate || "") : ""}">
        </div>

        <label>الفحص البيطري</label>
        <select id="editAnimalVetInspectionStatus"
          onchange="toggleVetInspectionDate('editAnimalVetInspectionStatus', 'editAnimalVetInspectionDateField', 'editAnimalVetInspectionDate')">
          <option value="unknown" ${!animal.vetInspectionStatus || animal.vetInspectionStatus === "unknown" ? "selected" : ""}>غير محدد</option>
          <option value="inspected" ${animal.vetInspectionStatus === "inspected" ? "selected" : ""}>تم الفحص</option>
          <option value="not_inspected" ${animal.vetInspectionStatus === "not_inspected" ? "selected" : ""}>لم يتم الفحص</option>
        </select>

        <div id="editAnimalVetInspectionDateField"
          style="display:${animal.vetInspectionStatus === "inspected" ? "block" : "none"};width:100%;">
          <label>تاريخ آخر فحص — اختياري</label>
          <input id="editAnimalVetInspectionDate" type="date"
            value="${animal.vetInspectionStatus === "inspected" ? escapeHtml(animal.vetInspectionDate || "") : ""}">
        </div>

        <label>الموقع</label>
        <input id="editAnimalLocation" value="${escapeHtml(animal.location || "")}">

        ${directPriceField}

        <label>الوصف</label>
        <textarea id="editAnimalDescription" rows="4">${escapeHtml(animal.description || "")}</textarea>

        <button onclick="saveListingEdits(${inlineArgument(animal.id)})"
          style="width:100%;margin:15px 0;">
          💾 حفظ التعديلات
        </button>

        <hr>

        ${imageHtml}

        <input id="manageImages" type="file" accept="image/*" multiple>

        <button onclick="replaceAnimalImages(${inlineArgument(animal.id)})"
          style="width:100%;margin:10px 0;">
          🖼️ حفظ الصور الجديدة
        </button>

        <button onclick="removeAllAnimalImages(${inlineArgument(animal.id)})"
          style="width:100%;margin-bottom:15px;">
          🧹 حذف جميع الصور
        </button>

        ${servicesHtml}

        ${saleActionHtml}

        <button onclick="deleteListing(${inlineArgument(animal.id)})"
          style="width:100%;background:#8b2929;margin-top:10px;">
          🗑️ حذف الإعلان نهائياً
        </button>

        <div style="height:40px;"></div>
      </div>
    `);
  } catch (error) {
    console.error("MANAGE LISTING ERROR:", error);
    alert("تعذر فتح إدارة الإعلان.");
  }
};

window.finalizeAuction = async function (auctionId, decision) {
  const user = auth.currentUser;

  if (!user) {
    window.openLogin();
    return;
  }

  if (decision !== "accept" && decision !== "reject") return;

  try {
    const auctionRef = doc(db, "auctions", auctionId);
    const auctionSnap = await getDoc(auctionRef);

    if (!auctionSnap.exists()) {
      alert("المزاد غير موجود.");
      return;
    }

    const auction = auctionSnap.data();

    if (auction.sellerId !== user.uid) {
      alert("غير مصرح لك باعتماد هذا المزاد.");
      return;
    }

    if (auction.status !== "active") {
      alert("تم التعامل مع نتيجة هذا المزاد مسبقاً.");
      await loadMarket();
      return;
    }

    const endMillis = timestampToMillis(auction.endTime);

    if (!endMillis || Date.now() < endMillis) {
      alert("⏳ لا يمكن اعتماد نتيجة المزاد قبل انتهاء الوقت.");
      return;
    }

    if (decision === "accept" && !auction.lastBidderId) {
      alert("لا توجد مزايدات يمكن اعتمادها.");
      return;
    }

    let confirmationMessage = "";

    if (decision === "accept") {
      confirmationMessage =
        "هل تؤكد اعتماد أعلى مزايدة؟\n\n" +
        "السعر النهائي: " +
        money(auction.currentPrice, effectiveCountry(auction));
    } else {
      confirmationMessage =
        "هل تؤكد عدم اعتماد البيع؟\n\nسيتم إغلاق المزاد بدون بيع.";
    }

    const ok = confirm(confirmationMessage);
    if (!ok) return;

    const animalRef = doc(db, "animals", auction.animalId);
    const batch = writeBatch(db);

    if (decision === "accept") {
      batch.set(auctionRef, {
        status: "sold",
        updatedAt: serverTimestamp()
      }, { merge: true });

      batch.set(animalRef, {
        status: "sold",
        soldAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else {
      batch.set(auctionRef, {
        status: "not_approved",
        updatedAt: serverTimestamp()
      }, { merge: true });

      batch.set(animalRef, {
        status: "not_approved",
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();

    alert(decision === "accept"
      ? "✅ تم اعتماد البيع بنجاح."
      : "✅ تم إغلاق المزاد بدون اعتماد البيع.");

    window.closeModal();
    await loadMarket();
  } catch (error) {
    console.error("FINALIZE AUCTION ERROR:", error);
    alert("❌ تعذر اعتماد نتيجة المزاد.");
  }
};

window.saveListingEdits = async function (animalId) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const animalRef = doc(db, "animals", animalId);
    const animalSnap = await getDoc(animalRef);
    if (!animalSnap.exists()) return;

    const animal = animalSnap.data();
    if (animal.sellerId !== user.uid) return;

    const type = document.getElementById("editAnimalType")?.value || "";
    const breed = document.getElementById("editAnimalBreed")?.value.trim() || "";
    const age = document.getElementById("editAnimalAge")?.value.trim() || "";
    const gender = document.getElementById("editAnimalGender")?.value || "";
    const birthDate = document.getElementById("editAnimalBirthDate")?.value || "";
    const animalIdentifier = document.getElementById("editAnimalIdentifier")?.value.trim() || "";
    const vaccinationStatus = document.getElementById("editAnimalVaccinationStatus")?.value || "unknown";
    const vaccinationDate = vaccinationStatus === "vaccinated"
      ? document.getElementById("editAnimalVaccinationDate")?.value || ""
      : "";
    const vetInspectionStatus = document.getElementById("editAnimalVetInspectionStatus")?.value || "unknown";
    const vetInspectionDate = vetInspectionStatus === "inspected"
      ? document.getElementById("editAnimalVetInspectionDate")?.value || ""
      : "";
    const location = document.getElementById("editAnimalLocation")?.value.trim() || "";
    const description = document.getElementById("editAnimalDescription")?.value.trim() || "";

    if (breed.length > 120 || age.length > 80 || description.length > 2000 || location.length > 200 || animalIdentifier.length > 120) {
      alert("اختصر بيانات الإعلان والوصف (2000 حرف كحد أقصى).");
      return;
    }
    const updateData = {
      name: type,
      type,
      breed,
      age,
      gender,
      birthDate,
      animalIdentifier,
      vaccinationStatus,
      vaccinationDate,
      vetInspectionStatus,
      vetInspectionDate,
      location,
      description,
      updatedAt: serverTimestamp()
    };

    if (animal.saleType === "direct") {
      const price = Number(document.getElementById("editAnimalPrice")?.value);

      if (!Number.isFinite(price) || price <= 0) {
        alert("أدخل سعر بيع صحيح.");
        return;
      }

      updateData.price = price;
    }

    await setDoc(animalRef, updateData, { merge: true });

    alert("✅ تم حفظ تعديلات الإعلان بنجاح.");
    await loadMarket();
    await window.manageListing(animalId);
  } catch (error) {
    console.error("SAVE LISTING EDIT ERROR:", error);
    alert("❌ تعذر حفظ التعديلات.");
  }
};

window.removeAnimalImage = async function (animalId, imageIndex) {
  const user = auth.currentUser;
  if (!user) return;

  const ok = confirm("هل تريد حذف هذه الصورة؟");
  if (!ok) return;

  try {
    const animalRef = doc(db, "animals", animalId);
    const snap = await getDoc(animalRef);
    if (!snap.exists()) return;

    const animal = snap.data();
    if (animal.sellerId !== user.uid) return;

    const images = Array.isArray(animal.images) ? [...animal.images] : [];
    images.splice(imageIndex, 1);

    await setDoc(animalRef, {
      images,
      updatedAt: serverTimestamp()
    }, { merge: true });

    alert("✅ تم حذف الصورة.");
    await loadMarket();
    await window.manageListing(animalId);
  } catch (error) {
    console.error(error);
    alert("❌ تعذر حذف الصورة.");
  }
};

window.removeAllAnimalImages = async function (animalId) {
  const ok = confirm("هل تريد حذف جميع صور الإعلان؟");
  if (!ok) return;

  try {
    const animalRef = doc(db, "animals", animalId);
    const snap = await getDoc(animalRef);

    if (!snap.exists() || snap.data().sellerId !== auth.currentUser?.uid) {
      alert("غير مصرح.");
      return;
    }

    await setDoc(animalRef, {
      images: [],
      updatedAt: serverTimestamp()
    }, { merge: true });

    alert("✅ تم حذف جميع الصور.");
    await loadMarket();
    await window.manageListing(animalId);
  } catch (error) {
    console.error(error);
    alert("❌ تعذر حذف الصور.");
  }
};

window.replaceAnimalImages = async function (animalId) {
  const input = document.getElementById("manageImages");

  if (!input || !input.files || input.files.length === 0) {
    alert("اختر صورة واحدة على الأقل.");
    return;
  }

  if (input.files.length > 5) {
    alert("يمكن اختيار 5 صور كحد أقصى.");
    return;
  }

  try {
    const animalRef = doc(db, "animals", animalId);
    const snap = await getDoc(animalRef);

    if (!snap.exists() || snap.data().sellerId !== auth.currentUser?.uid) {
      alert("غير مصرح.");
      return;
    }

    const files = Array.from(input.files);
    const images = [];
    let totalSize = 0;

    for (const file of files) {
      const imageData = await compressImageFile(file);
      totalSize += imageData.length;

      if (totalSize > 650000) {
        alert("حجم الصور كبير جداً.");
        return;
      }

      images.push(imageData);
    }

    await setDoc(animalRef, {
      images,
      updatedAt: serverTimestamp()
    }, { merge: true });

    alert("✅ تم استبدال الصور بنجاح.");
    await loadMarket();
    await window.manageListing(animalId);
  } catch (error) {
    console.error(error);
    alert("❌ تعذر استبدال الصور.");
  }
};

window.markListingSold = async function (animalId) {
  try {
    const animalRef = doc(db, "animals", animalId);
    const animalSnap = await getDoc(animalRef);
    if (!animalSnap.exists()) return;

    const animal = animalSnap.data();

    if (animal.sellerId !== auth.currentUser?.uid) {
      alert("غير مصرح.");
      return;
    }

    if (animal.saleType === "auction") {
      alert("🔨 لا يمكن استخدام زر تم البيع للمزاد.");
      return;
    }

    const ok = confirm("هل تؤكد أن الحلال تم بيعه؟");
    if (!ok) return;

    await setDoc(animalRef, {
      status: "sold",
      soldAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    window.closeModal();
    alert("✅ تم تسجيل الحلال كمباع.");
    await loadMarket();
  } catch (error) {
    console.error("MARK SOLD ERROR:", error);
    alert("❌ تعذر تسجيل البيع.");
  }
};

window.deleteListing = async function (animalId) {
  const ok = confirm("⚠️ هل أنت متأكد من حذف الإعلان نهائياً؟");
  if (!ok) return;

  try {
    const animalRef = doc(db, "animals", animalId);
    const animalSnap = await getDoc(animalRef);
    if (!animalSnap.exists()) return;

    const animal = animalSnap.data();

    if (animal.sellerId !== auth.currentUser?.uid) return;

    const batch = writeBatch(db);
    batch.delete(animalRef);

    if (animal.saleType === "auction" && animal.auctionId) {
      batch.delete(doc(db, "auctions", animal.auctionId));
    }

    await batch.commit();

    window.closeModal();
    alert("✅ تم حذف الإعلان نهائياً.");
    await loadMarket();
  } catch (error) {
    console.error("DELETE LISTING ERROR:", error);
    alert("❌ تعذر حذف الإعلان.");
  }
};

window.requestPurchase = async function (animalId) {
  const user = auth.currentUser;

  if (!user) {
    alert("يجب تسجيل الدخول أولاً لإرسال طلب شراء.");
    window.openLogin();
    return;
  }

  try {
    const animalSnap = await getDoc(doc(db, "animals", animalId));

    if (!animalSnap.exists()) {
      alert("الإعلان غير موجود.");
      return;
    }

    const animal = animalSnap.data();

    if (animal.saleType !== "direct") {
      alert("طلب الشراء متاح للبيع المباشر فقط.");
      return;
    }

    if (animal.status && animal.status !== "active") {
      alert("هذا الإعلان غير متاح للشراء.");
      return;
    }

    if (animal.sellerId === user.uid) {
      alert("لا يمكنك إرسال طلب شراء لإعلانك.");
      return;
    }

    const profile = await getUserProfile();

    const existingQuery = query(
      collection(db, "purchaseRequests"),
      where("buyerId", "==", user.uid)
    );

    const existingSnapshot = await getDocs(existingQuery);
    let duplicateRequest = false;

    existingSnapshot.forEach(requestDoc => {
      const request = requestDoc.data();

      if (
        request.animalId === animalId &&
        (request.status === "pending" || request.status === "accepted")
      ) {
        duplicateRequest = true;
      }
    });

    if (duplicateRequest) {
      alert("⚠️ لديك طلب شراء سابق لهذا الإعلان.");
      return;
    }

    const ok = confirm(
      "هل تريد إرسال طلب شراء؟\n\n" +
      "النوع: " + (animal.type || "حلال") +
      "\nالسعر: " + money(animal.price, effectiveCountry(animal))
    );

    if (!ok) return;

    await addDoc(collection(db, "purchaseRequests"), {
      animalId,
      animalType: animal.type || "",
      animalBreed: animal.breed || "",
      price: Number(animal.price || 0),
      sellerId: animal.sellerId,
      sellerName: animal.sellerName || "",
      buyerId: user.uid,
      buyerName: profile?.displayName || "",
      buyerPhone: user.phoneNumber || "",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    alert("✅ تم إرسال طلب الشراء إلى البائع.");
  } catch (error) {
    console.error("PURCHASE REQUEST ERROR:", error);
    alert("❌ تعذر إرسال طلب الشراء.");
  }
};

window.placeBid = async function (auctionId) {
  if (!auth.currentUser) {
    alert("يجب تسجيل الدخول برقم الهاتف قبل المزايدة.");
    window.openLogin();
    return;
  }

  try {
    const auctionRef = doc(db, "auctions", auctionId);
    let minimumBid = 0;
    let auctionCountry = "AE";

    await runTransaction(db, async transaction => {
      const auctionSnap = await transaction.get(auctionRef);

      if (!auctionSnap.exists()) throw new Error("AUCTION_NOT_FOUND");

      const auction = auctionSnap.data();
      auctionCountry = effectiveCountry(auction);

      if (auction.sellerId === auth.currentUser.uid) {
        throw new Error("OWNER_CANNOT_BID");
      }

      if (auction.status !== "active") {
        throw new Error("AUCTION_NOT_ACTIVE");
      }

      const endMillis = timestampToMillis(auction.endTime);

      if (!endMillis || Date.now() >= endMillis) {
        throw new Error("AUCTION_ENDED");
      }

      const currentPrice = Number(
        auction.currentPrice ||
        auction.startPrice ||
        0
      );

      const increment = Number(auction.minIncrement || 0);
      minimumBid = currentPrice + increment;
    });

    const enteredValue = prompt(
      "أدخل مبلغ المزايدة الجديدة (" + COUNTRIES[auctionCountry].currency + ")\n\n" +
      "الحد الأدنى المقبول: " +
      money(minimumBid, auctionCountry),
      minimumBid
    );

    if (enteredValue === null) return;

    const bidAmount = Number(
      String(enteredValue)
        .replace(/,/g, "")
        .trim()
    );

    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      alert("يرجى إدخال مبلغ صحيح.");
      return;
    }

    await runTransaction(db, async transaction => {
      const auctionSnap = await transaction.get(auctionRef);

      if (!auctionSnap.exists()) throw new Error("AUCTION_NOT_FOUND");

      const auction = auctionSnap.data();

      if (auction.sellerId === auth.currentUser.uid) {
        throw new Error("OWNER_CANNOT_BID");
      }

      if (auction.status !== "active") {
        throw new Error("AUCTION_NOT_ACTIVE");
      }

      const endMillis = timestampToMillis(auction.endTime);

      if (!endMillis || Date.now() >= endMillis) {
        throw new Error("AUCTION_ENDED");
      }

      const currentPrice = Number(
        auction.currentPrice ||
        auction.startPrice ||
        0
      );

      const increment = Number(auction.minIncrement || 0);
      const requiredBid = currentPrice + increment;

      if (bidAmount < requiredBid) {
        throw new Error("BID_TOO_LOW:" + requiredBid);
      }

      transaction.update(auctionRef, {
        currentPrice: bidAmount,
        lastBidAt: serverTimestamp(),
        lastBidderId: auth.currentUser.uid,
        lastBidderPhone: ""
      });
    });

    alert(
      "✅ تمت المزايدة بنجاح\n\n" +
      "السعر الجديد: " +
      money(bidAmount, auctionCountry)
    );

    await loadMarket();
  } catch (error) {
    console.error("BID ERROR:", error);

    if (error.message === "OWNER_CANNOT_BID") {
      alert("⛔ لا يمكنك المزايدة على مزادك الخاص.");
      return;
    }

    if (error.message && error.message.startsWith("BID_TOO_LOW:")) {
      const required = error.message.split(":")[1];

      alert(
        "❌ تم تسجيل مزايدة أعلى قبلك.\n\n" +
        "الحد الأدنى الجديد: " +
        money(required, auctionCountry)
      );

      await loadMarket();
      return;
    }

    if (error.message === "AUCTION_ENDED") {
      alert("⛔ انتهى وقت المزاد.");
      await loadMarket();
      return;
    }

    if (error.message === "AUCTION_NOT_ACTIVE") {
      alert("⛔ هذا المزاد لم يعد متاحاً للمزايدة.");
      await loadMarket();
      return;
    }

    alert("❌ لم يتم حفظ المزايدة.");
  }
};

window.saveListing = async function (event) {
  event.preventDefault();

  const user = auth.currentUser;

  if (!user) {
    alert("يجب تسجيل الدخول أولاً لإضافة الحلال.");
    window.openLogin();
    return;
  }

  try {
    const profile = await getUserProfile();

    if (
      !profile ||
      (profile.accountType !== "seller" && profile.accountType !== "both")
    ) {
      alert("يجب أن يكون الحساب بائع أو بائع ومشتري.");
      return;
    }

    const type = document.getElementById("animalType")?.value || "";
    const breed = document.getElementById("animalBreed")?.value.trim() || "";
    const age = document.getElementById("animalAge")?.value.trim() || "";
    const gender = document.getElementById("animalGender")?.value || "";
    const birthDate = document.getElementById("animalBirthDate")?.value || "";
    const animalIdentifier = document.getElementById("animalIdentifier")?.value.trim() || "";
    const vaccinationStatus = document.getElementById("animalVaccinationStatus")?.value || "unknown";
    const vaccinationDate = vaccinationStatus === "vaccinated"
      ? document.getElementById("animalVaccinationDate")?.value || ""
      : "";
    const vetInspectionStatus = document.getElementById("animalVetInspectionStatus")?.value || "unknown";
    const vetInspectionDate = vetInspectionStatus === "inspected"
      ? document.getElementById("animalVetInspectionDate")?.value || ""
      : "";
    const country = document.getElementById("animalCountry")?.value || "AE";
    const region = document.getElementById("animalRegion")?.value || "";
    const city = document.getElementById("animalCity")?.value || "";
    const location = document.getElementById("animalLocation")?.value.trim() ||
      (city && region ? city + " - " + region : "");
    const method = document.getElementById("method")?.value || "";
    const price = Number(document.getElementById("animalPrice")?.value);
    const description = document.getElementById("animalDescription")?.value.trim() || "";

    if (!COUNTRIES[country] ||
        !region ||
        !city ||
        !type ||
        !gender ||
        !Number.isFinite(price) ||
        price <= 0) {
      alert("تأكد من نوع الحيوان والجنس والسعر.");
      return;
    }

    if (breed.length > 120 || age.length > 80 || description.length > 2000 ||
        location.length > 200 || animalIdentifier.length > 120 ||
        !COUNTRIES[country].regions[region]?.includes(city)) {
      alert("تحقق من المنطقة والمدينة، واختصر بيانات الإعلان والوصف (2000 حرف كحد أقصى).");
      return;
    }

    let images = [];

    try {
      images = await getListingImages();
    } catch (error) {
      alert("تعذر تجهيز الصور أو حجم الصور كبير.");
      return;
    }

    if (method === "بيع مباشر") {
      await addDoc(collection(db, "animals"), {
        name: type,
        type,
        breed,
        age,
        gender,
        birthDate,
        animalIdentifier,
        vaccinationStatus,
        vaccinationDate,
        vetInspectionStatus,
        vetInspectionDate,
        country,
        region,
        city,
        location,
        saleType: "direct",
        price,
        description,
        images,
        sellerId: user.uid,
        sellerName: profile.displayName || "",
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert("✅ تم إضافة الحلال بنجاح.");
      resetListingForm(event.target);
      await loadMarket();
      scrollToMarket();
      return;
    }

    if (method === "مزاد إلكتروني") {
      const increment = Number(
        document.getElementById("auctionIncrement")?.value
      );

      const endTimeValue =
        document.getElementById("auctionEndTime")?.value || "";

      const endTime = new Date(endTimeValue);

      if (
        !Number.isFinite(increment) ||
        increment <= 0 ||
        !endTimeValue ||
        Number.isNaN(endTime.getTime()) ||
        endTime.getTime() <= Date.now()
      ) {
        alert("تحقق من بيانات المزاد.");
        return;
      }

      const animalRef = doc(collection(db, "animals"));
      const auctionRef = doc(collection(db, "auctions"));
      const batch = writeBatch(db);

      batch.set(animalRef, {
        name: type,
        type,
        breed,
        age,
        gender,
        birthDate,
        animalIdentifier,
        vaccinationStatus,
        vaccinationDate,
        vetInspectionStatus,
        vetInspectionDate,
        country,
        region,
        city,
        location,
        saleType: "auction",
        price,
        description,
        images,
        sellerId: user.uid,
        sellerName: profile.displayName || "",
        status: "active",
        auctionId: auctionRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.set(auctionRef, {
        animalId: animalRef.id,
        country,
        sellerId: user.uid,
        sellerName: profile.displayName || "",
        startPrice: price,
        currentPrice: price,
        minIncrement: increment,
        endTime,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      alert("✅ تم إنشاء المزاد الإلكتروني بنجاح.");
      resetListingForm(event.target);
      await loadMarket();
      scrollToMarket();
      return;
    }

    alert("يرجى اختيار طريقة البيع.");
  } catch (error) {
    console.error("SAVE LISTING ERROR:", error);
    alert("❌ تعذر إضافة الحلال.");
  }
};

function resetListingForm(form) {
  if (form) form.reset();

  const preview = document.getElementById("imagePreview");
  if (preview) preview.innerHTML = "";

  const auctionFields = document.getElementById("auctionFields");
  if (auctionFields) auctionFields.style.display = "none";

  const vaccinationDateField = document.getElementById("animalVaccinationDateField");
  if (vaccinationDateField) vaccinationDateField.style.display = "none";

  const vetInspectionDateField = document.getElementById("animalVetInspectionDateField");
  if (vetInspectionDateField) vetInspectionDateField.style.display = "none";
}

function scrollToMarket() {
  const market = document.getElementById("firebase-market");

  if (market) {
    market.scrollIntoView({
      behavior: "smooth"
    });
  }
}


// =====================================
// 💬 نظام الرسائل والتفاوض
// =====================================

let activeConversationUnsubscribe = null;
let activeConversationId = null;
let unreadMessagesUnsubscribe = null;


function directConversationId(animalId, buyerId) {
  return "direct_" + animalId + "_" + buyerId;
}

function auctionConversationId(auctionId, buyerId) {
  return "auction_" + auctionId + "_" + buyerId;
}

async function getConversation(conversationId) {
  const snap = await getDoc(doc(db, "conversations", conversationId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function getConversationCountry(conversation) {
  if (!conversation) return "AE";
  try {
    if (conversation.contextType === "direct" && conversation.animalId) {
      const animalSnap = await getDoc(doc(db, "animals", conversation.animalId));
      return animalSnap.exists() ? effectiveCountry(animalSnap.data()) : "AE";
    }
    if (conversation.contextType === "auction" && conversation.auctionId) {
      const auctionSnap = await getDoc(doc(db, "auctions", conversation.auctionId));
      return auctionSnap.exists() ? effectiveCountry(auctionSnap.data()) : "AE";
    }
  } catch (error) {
    console.error("CONVERSATION COUNTRY ERROR:", error);
  }
  return "AE";
}

async function ensurePrivateConversationContact(conversationId, conversation) {
  const user = auth.currentUser;

  if (!user ||
      conversation.contextType !== "direct" ||
      !conversation.participants?.includes(user.uid)) {
    return;
  }

  const contactRef = doc(
    db,
    "conversations",
    conversationId,
    "privateContacts",
    user.uid
  );
  const contactSnap = await getDoc(contactRef);

  if (contactSnap.exists()) return;

  const profile = await getUserProfile();

  await setDoc(contactRef, {
    uid: user.uid,
    displayName: profile?.displayName || "",
    ...(profile?.phoneNumber ? { phoneNumber: profile.phoneNumber } : {}),
    createdAt: serverTimestamp()
  });
}

async function recoverLegacyDirectConversationContact(
  conversationId,
  conversation,
  messages
) {
  const user = auth.currentUser;

  if (!user ||
      conversation.contextType !== "direct" ||
      conversation.sellerId !== user.uid ||
      conversation.contactStatus === "unlocked") {
    return;
  }

  const acceptedOffer = [...messages].reverse().find(message =>
    message.type === "offer" &&
    message.senderId === conversation.buyerId &&
    message.status === "accepted" &&
    message.decidedBy === conversation.sellerId
  );

  if (!acceptedOffer) return;

  try {
    await setDoc(doc(db, "conversations", conversationId), {
      contactStatus: "unlocked",
      acceptedOfferId: acceptedOffer.id,
      contactUnlockedAt: serverTimestamp()
    }, { merge: true });

    conversation.contactStatus = "unlocked";
    conversation.acceptedOfferId = acceptedOffer.id;
  } catch (error) {
    console.error("RECOVER LEGACY CONTACT ERROR:", error);
  }
}

window.openDirectConversation = async function (animalId) {
  const user = auth.currentUser;

  if (!user) {
    alert("يجب تسجيل الدخول أولاً لمراسلة البائع.");
    window.openLogin();
    return;
  }

  try {
    const animalSnap = await getDoc(doc(db, "animals", animalId));

    if (!animalSnap.exists()) {
      alert("الإعلان غير موجود.");
      return;
    }

    const animal = {
      id: animalSnap.id,
      ...animalSnap.data()
    };

    if (animal.saleType !== "direct") {
      alert("المراسلة المباشرة متاحة لإعلانات البيع المباشر.");
      return;
    }

    if (animal.status && animal.status !== "active") {
      alert("هذا الإعلان لم يعد متاحاً للتفاوض.");
      return;
    }

    if (animal.sellerId === user.uid) {
      alert("هذا إعلانك. ستظهر رسائل المشترين في قسم الرسائل.");
      return;
    }

    const profile = await getUserProfile();
    const conversationId = directConversationId(animalId, user.uid);
    const conversationRef = doc(db, "conversations", conversationId);
    const existing = await getDoc(conversationRef);

    if (!existing.exists()) {
      await setDoc(conversationRef, {
        contextType: "direct",
        animalId,
        animalName: animal.name || animal.type || "حلال",
        animalType: animal.type || "",
        askingPrice: Number(animal.price || 0),
        sellerId: animal.sellerId,
        sellerName: animal.sellerName || "البائع",
        buyerId: user.uid,
        buyerName: profile?.displayName || "المشتري",
        participants: [animal.sellerId, user.uid],
        lastMessage: "",
        lastMessageType: "",
        lastMessageSenderId: "",
        sellerUnread: 0,
        buyerUnread: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    await window.showConversation(conversationId);
  } catch (error) {
    console.error("OPEN DIRECT CONVERSATION ERROR:", error);

    if (error.code === "permission-denied") {
      alert("تعذر فتح المحادثة. تحقق من تسجيل دخولك وتوفر الإعلان للبيع المباشر.");
      return;
    }

    alert("❌ تعذر فتح المحادثة.");
  }
};

window.openAuctionConversation = async function () {
  alert("الرسائل متاحة للبيع المباشر فقط.");
};


function ensureMessagesUnreadBadge() {
  let badge = document.getElementById("messagesUnreadBadge");
  if (badge) return badge;

  const navLinks = Array.from(document.querySelectorAll("a"));

  const messagesLink = navLinks.find(link =>
    link.textContent && link.textContent.includes("الرسائل")
  );

  if (!messagesLink) return null;

  messagesLink.style.position = "relative";

  badge = document.createElement("span");
  badge.id = "messagesUnreadBadge";
  badge.style.cssText = [
    "position:absolute",
    "top:2px",
    "left:18%",
    "min-width:18px",
    "height:18px",
    "padding:0 5px",
    "border-radius:999px",
    "background:#d62828",
    "color:#fff",
    "font-size:11px",
    "font-weight:800",
    "line-height:18px",
    "text-align:center",
    "display:none",
    "box-sizing:border-box",
    "z-index:5",
    "box-shadow:0 1px 4px rgba(0,0,0,.35)"
  ].join(";");

  messagesLink.appendChild(badge);
  return badge;
}

function updateMessagesUnreadBadge(count) {
  const badge = ensureMessagesUnreadBadge();
  if (!badge) return;

  const safeCount = Math.max(0, Number(count || 0));

  if (safeCount <= 0) {
    badge.style.display = "none";
    badge.textContent = "";
    return;
  }

  badge.textContent = safeCount > 99 ? "99+" : String(safeCount);
  badge.style.display = "block";
}

function stopUnreadMessagesListener() {
  if (unreadMessagesUnsubscribe) {
    unreadMessagesUnsubscribe();
    unreadMessagesUnsubscribe = null;
  }

  updateMessagesUnreadBadge(0);
}

function startUnreadMessagesListener(user) {
  stopUnreadMessagesListener();

  if (!user) return;

  const conversationsQuery = query(
    collection(db, "conversations"),
    where("participants", "array-contains", user.uid)
  );

  unreadMessagesUnsubscribe = onSnapshot(
    conversationsQuery,
    snapshot => {
      let totalUnread = 0;

      snapshot.forEach(conversationDoc => {
        const conversation = conversationDoc.data();

        if (conversation.sellerId === user.uid) {
          totalUnread += Number(conversation.sellerUnread || 0);
        } else if (conversation.buyerId === user.uid) {
          totalUnread += Number(conversation.buyerUnread || 0);
        }
      });

      updateMessagesUnreadBadge(totalUnread);
    },
    error => {
      console.error("UNREAD MESSAGES LISTENER ERROR:", error);
    }
  );
}

async function markConversationRead(conversation) {
  const user = auth.currentUser;
  if (!user || !conversation) return;

  const conversationRef = doc(db, "conversations", conversation.id);

  if (conversation.sellerId === user.uid) {
    const unread = Number(conversation.sellerUnread || 0);
    if (unread > 0) {
      await setDoc(
        conversationRef,
        { sellerUnread: 0 },
        { merge: true }
      );
      conversation.sellerUnread = 0;
    }
  } else if (conversation.buyerId === user.uid) {
    const unread = Number(conversation.buyerUnread || 0);
    if (unread > 0) {
      await setDoc(
        conversationRef,
        { buyerUnread: 0 },
        { merge: true }
      );
      conversation.buyerUnread = 0;
    }
  }
}

window.showMessages = async function () {
  if (activeConversationUnsubscribe) {
    activeConversationUnsubscribe();
    activeConversationUnsubscribe = null;
    activeConversationId = null;
  }

  const user = auth.currentUser;

  if (!user) {
    alert("يجب تسجيل الدخول أولاً لعرض الرسائل.");
    window.openLogin();
    return;
  }

  showModal(`
    <div style="direction:rtl;color:white;padding:14px;text-align:center;">
      <h2 style="color:#68e6b0;">💬 الرسائل</h2>
      <p style="color:#aaa;">جاري تحميل محادثاتك...</p>
    </div>
  `);

  try {
    const conversationsQuery = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid)
    );

    const snapshot = await getDocs(conversationsQuery);
    const conversations = [];

    snapshot.forEach(conversationDoc => {
      if (conversationDoc.data().contextType !== "direct") return;
      conversations.push({
        id: conversationDoc.id,
        ...conversationDoc.data()
      });
    });

    await Promise.all(conversations.map(async conversation => {
      conversation._country = await getConversationCountry(conversation);
    }));

    conversations.sort((a, b) =>
      timestampToMillis(b.updatedAt || b.createdAt) -
      timestampToMillis(a.updatedAt || a.createdAt)
    );

    if (conversations.length === 0) {
      showModal(`
        <div style="direction:rtl;color:white;padding:18px;text-align:center;">
          <h2 style="color:#68e6b0;">💬 الرسائل</h2>
          <div style="background:#222;padding:22px;border-radius:14px;margin:20px 0;">
            لا توجد محادثات حتى الآن.
            <br><br>
            في البيع المباشر يمكنك الضغط على
            <b style="color:#ffd66b;">مراسلة البائع / تقديم عرض</b>.
          </div>
        </div>
      `);
      return;
    }

    const cards = conversations.map(conversation => {
      const isSeller = conversation.sellerId === user.uid;
      const otherName = isSeller
        ? (conversation.buyerName || "المشتري")
        : (conversation.sellerName || "البائع");

      const contextLabel = conversation.contextType === "auction"
        ? "🔨 نتيجة مزاد"
        : "🛒 بيع مباشر";

      let priceLine = "";

      if (conversation.contextType === "direct") {
        priceLine = `
          <div style="color:#68e6b0;font-weight:bold;margin-top:6px;">
            السعر المعلن: ${money(conversation.askingPrice, conversation._country)}
          </div>
        `;
      } else if (conversation.finalPrice) {
        priceLine = `
          <div style="color:#68e6b0;font-weight:bold;margin-top:6px;">
            السعر النهائي: ${money(conversation.finalPrice, conversation._country)}
          </div>
        `;
      }

      const lastMessage = conversation.lastMessage
        ? escapeHtml(conversation.lastMessage)
        : "ابدأ المحادثة الآن";

      return `
        <button onclick="showConversation(${inlineArgument(conversation.id)})"
          style="width:100%;text-align:right;background:#222;color:white;border:1px solid #3b4a43;padding:16px;border-radius:15px;margin-bottom:12px;cursor:pointer;">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
            <b style="color:#68e6b0;font-size:18px;">
              💬 ${escapeHtml(otherName)}
            </b>
            <span style="font-size:12px;color:#ffd66b;">${contextLabel}</span>
          </div>

          <div style="margin-top:8px;font-weight:bold;">
            ${escapeHtml(conversation.animalName || "حلال")}
          </div>

          ${priceLine}

          <div style="margin-top:9px;color:#bbb;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${lastMessage}
          </div>

          <div style="margin-top:7px;color:#777;font-size:12px;">
            ${formatDate(conversation.lastMessageAt || conversation.updatedAt || conversation.createdAt)}
          </div>
        </button>
      `;
    }).join("");

    showModal(`
      <div style="direction:rtl;color:white;padding:12px;">
        <h2 style="color:#68e6b0;text-align:center;">💬 الرسائل</h2>
        <p style="color:#aaa;text-align:center;margin-bottom:18px;">
          محادثاتك الخاصة داخل سوق الحلال
        </p>
        ${cards}
        <div style="height:25px;"></div>
      </div>
    `);
  } catch (error) {
    console.error("SHOW MESSAGES ERROR:", error);

    if (error.code === "permission-denied") {
      alert("❌ قواعد Firebase لا تسمح بتحميل الرسائل. تأكد من نشر القواعد الجديدة.");
      return;
    }

    alert("❌ تعذر تحميل الرسائل.");
  }
};

window.showConversation = async function (conversationId) {
  const user = auth.currentUser;

  if (!user) {
    window.openLogin();
    return;
  }

  if (activeConversationUnsubscribe) {
    activeConversationUnsubscribe();
    activeConversationUnsubscribe = null;
  }
  activeConversationId = conversationId;

  try {
    const conversation = await getConversation(conversationId);

    if (!conversation || conversation.contextType !== "direct") {
      alert("الرسائل متاحة للبيع المباشر فقط.");
      return;
    }

    if (!Array.isArray(conversation.participants) ||
        !conversation.participants.includes(user.uid)) {
      alert("غير مصرح لك بفتح هذه المحادثة.");
      return;
    }

    const conversationCountry = await getConversationCountry(conversation);

    await ensurePrivateConversationContact(conversationId, conversation);

    await markConversationRead(conversation);

    const messagesSnapshot = await getDocs(
      collection(db, "conversations", conversationId, "messages")
    );

    const messages = [];

    messagesSnapshot.forEach(messageDoc => {
      messages.push({
        id: messageDoc.id,
        ...messageDoc.data()
      });
    });

    messages.sort((a, b) =>
      timestampToMillis(a.createdAt) -
      timestampToMillis(b.createdAt)
    );

    await recoverLegacyDirectConversationContact(
      conversationId,
      conversation,
      messages
    );

    const isSeller = conversation.sellerId === user.uid;
    const otherName = isSeller
      ? (conversation.buyerName || "المشتري")
      : (conversation.sellerName || "البائع");

    const canOffer =
      conversation.contextType === "direct" &&
      conversation.buyerId === user.uid;

    let contactDetailsHtml = "";

    if (conversation.contextType === "direct" &&
        conversation.contactStatus === "unlocked") {
      const otherUid = isSeller
        ? conversation.buyerId
        : conversation.sellerId;
      const contactSnap = await getDoc(doc(
        db,
        "conversations",
        conversationId,
        "privateContacts",
        otherUid
      ));

      if (contactSnap.exists()) {
        const contact = contactSnap.data();
        contactDetailsHtml = `
          <div style="background:#123c2c;border:1px solid #277657;padding:13px;border-radius:11px;margin-bottom:12px;">
            <div style="color:#68e6b0;font-weight:800;margin-bottom:7px;">
              ✅ بيانات التواصل بعد قبول العرض
            </div>
            <div>👤 ${escapeHtml(contact.displayName || "مستخدم")}</div>
            <div style="margin-top:5px;">
              ${contact.phoneNumber ? `📱 <b dir="ltr">${escapeHtml(contact.phoneNumber)}</b>` : "لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة."}
            </div>
          </div>
        `;
      } else {
        contactDetailsHtml = `
          <div style="background:#3b3219;border:1px solid #8a7430;padding:13px;border-radius:11px;margin-bottom:12px;color:#ffd66b;">
            لم يضف المستخدم رقم هاتف للتواصل. يمكنك متابعة التواصل عبر المحادثة داخل المنصة.
          </div>
        `;
      }
    }

    const messagesHtml = messages.length === 0
      ? `
        <div style="text-align:center;color:#aaa;padding:28px 8px;">
          لا توجد رسائل بعد.<br>
          ابدأ المحادثة من الأسفل.
        </div>
      `
      : messages.map(message => {
          const mine = message.senderId === user.uid;
          const bubbleBackground = mine ? "#0b6847" : "#2b332f";
          const align = mine ? "flex-start" : "flex-end";
          const label = mine ? "أنت" : escapeHtml(otherName);

          let body = "";

          if (message.type === "offer") {
            const offerStatus = message.status || "pending";
            let offerStatusHtml = `
              <div style="margin-top:9px;color:#ffd66b !important;font-weight:800;">
                ⏳ العرض قيد المراجعة
              </div>
            `;

            if (offerStatus === "accepted") {
              offerStatusHtml = `
                <div style="margin-top:9px;color:#68e6b0 !important;font-weight:800;">
                  ✅ تم قبول العرض بقيمة ${money(message.offerAmount, conversationCountry)}
                </div>
              `;
            } else if (offerStatus === "rejected") {
              offerStatusHtml = `
                <div style="margin-top:9px;color:#ff8d8d !important;font-weight:800;">
                  ❌ تم رفض العرض بقيمة ${money(message.offerAmount, conversationCountry)}
                </div>
              `;
            }

            const offerDecisionButtons =
              isSeller &&
              offerStatus === "pending" &&
              message.senderId === conversation.buyerId
                ? `
                  <div style="display:flex;gap:8px;margin-top:10px;">
                    <button onclick="decideConversationOffer(${inlineArgument(conversationId)}, ${inlineArgument(message.id)}, 'accepted')"
                      style="flex:1;background:#00643e;color:white;border:0;padding:10px;border-radius:9px;font-weight:bold;">
                      قبول العرض
                    </button>
                    <button onclick="decideConversationOffer(${inlineArgument(conversationId)}, ${inlineArgument(message.id)}, 'rejected')"
                      style="flex:1;background:#8b2929;color:white;border:0;padding:10px;border-radius:9px;font-weight:bold;">
                      رفض العرض
                    </button>
                  </div>
                `
                : "";

            body = `
              <div style="font-size:12px;color:#f3e6b8 !important;margin-bottom:5px;font-weight:700;">
                💰 عرض سعر
              </div>
              <div style="font-size:22px;font-weight:800;color:#ffd66b !important;">
                ${money(message.offerAmount, conversationCountry)}
              </div>
              ${message.text ? `
                <div style="margin-top:8px;color:#ffffff !important;font-size:15px;">
                  ${escapeHtml(message.text)}
                </div>
              ` : ""}
              ${offerStatusHtml}
              ${offerDecisionButtons}
            `;
          } else {
            body = `
              <div style="
                white-space:pre-wrap;
                word-break:break-word;
                color:#ffffff !important;
                font-size:16px;
                font-weight:600;
                line-height:1.7;
              ">
                ${escapeHtml(message.text || "")}
              </div>
            `;
          }

          return `
            <div style="display:flex;justify-content:${align};margin-bottom:10px;">
              <div style="
                max-width:82%;
                background:${bubbleBackground};
                padding:10px 12px;
                border-radius:14px;
                color:#ffffff !important;
                text-align:right;
                line-height:1.6;
                box-sizing:border-box;
              ">
                <div style="font-size:11px;color:#e7f0eb !important;margin-bottom:4px;font-weight:700;">
                  ${label}
                </div>
                <div style="color:#ffffff !important;font-size:16px;font-weight:600;min-height:0;">
                  ${body}
                </div>
                <div style="font-size:10px;color:#d7dfdb !important;margin-top:7px;">
                  ${formatDate(message.createdAt)}
                </div>
              </div>
            </div>
          `;
        }).join("");

    const offerSection = canOffer ? `
      <div style="background:#302a16;border:1px solid #6c5928;padding:12px;border-radius:12px;margin-top:12px;">
        <div style="color:#ffd66b;font-weight:bold;margin-bottom:8px;">
          💰 تقديم عرض سعر
        </div>

        <input id="chatOfferAmount" type="number" min="1"
          placeholder="اكتب السعر المقترح (${COUNTRIES[conversationCountry].currency})"
          style="width:100%;box-sizing:border-box;padding:13px;border-radius:9px;margin-bottom:8px;">

        <input id="chatOfferText" maxlength="1000"
          placeholder="ملاحظة اختيارية، مثال: أستطيع الاستلام اليوم"
          style="width:100%;box-sizing:border-box;padding:13px;border-radius:9px;margin-bottom:8px;">

        <button onclick="sendConversationOffer(${inlineArgument(conversationId)})"
          style="width:100%;background:#b88624;color:white;border:0;padding:13px;border-radius:9px;font-weight:bold;">
          إرسال عرض السعر
        </button>
      </div>
    ` : "";

    showModal(`
      <div style="direction:rtl;color:white;padding:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
          <button onclick="showMessages()"
            style="background:#28566f;color:white;border:0;padding:10px 12px;border-radius:9px;">
            ← الرسائل
          </button>

          <div style="text-align:center;flex:1;">
            <h2 style="color:#68e6b0;margin:0;">💬 ${escapeHtml(otherName)}</h2>
            <div style="color:#aaa;font-size:13px;margin-top:4px;">
              ${escapeHtml(conversation.animalName || "حلال")}
            </div>
          </div>
        </div>

        ${conversation.contextType === "direct" ? `
          <div style="background:#123c2c;color:white;padding:11px;border-radius:10px;text-align:center;margin-bottom:12px;">
            السعر المعلن:
            <b style="color:#68e6b0;">${money(conversation.askingPrice, conversationCountry)}</b>
          </div>
        ` : `
          <div style="background:#123c2c;color:white;padding:11px;border-radius:10px;text-align:center;margin-bottom:12px;">
            السعر النهائي للمزاد:
            <b style="color:#68e6b0;">${money(conversation.finalPrice, conversationCountry)}</b>
          </div>
        `}

        ${contactDetailsHtml}

        <div id="conversationMessages"
          style="background:#171c19;border-radius:14px;padding:12px;min-height:210px;max-height:42vh;overflow-y:auto;">
          ${messagesHtml}
        </div>

        <div style="margin-top:12px;">
          <textarea aria-label="نص الرسالة" id="chatMessageText" maxlength="1000" rows="3"
            placeholder="اكتب رسالتك هنا..."
            style="width:100%;box-sizing:border-box;padding:13px;border-radius:10px;resize:vertical;"></textarea>

          <button onclick="sendConversationMessage(${inlineArgument(conversationId)})"
            style="width:100%;background:#00643e;color:white;border:0;padding:14px;border-radius:10px;margin-top:8px;font-weight:bold;">
            إرسال الرسالة
          </button>
        </div>

        ${offerSection}

        <div style="height:30px;"></div>
      </div>
    `);

    setTimeout(() => {
      const box = document.getElementById("conversationMessages");
      if (box) box.scrollTop = box.scrollHeight;
    }, 0);

    // تحديث المحادثة تلقائياً عند وصول رسالة جديدة.
    let firstSnapshot = true;
    activeConversationUnsubscribe = onSnapshot(
      collection(db, "conversations", conversationId, "messages"),
      snapshot => {
        if (activeConversationId !== conversationId) return;

        if (firstSnapshot) {
          firstSnapshot = false;
          return;
        }

        if (snapshot.docChanges().some(change =>
          change.type === "added" || change.type === "modified"
        )) {
          window.showConversation(conversationId);
        }
      },
      error => {
        console.error("LIVE MESSAGES ERROR:", error);
      }
    );

  } catch (error) {
    console.error("SHOW CONVERSATION ERROR:", error);

    if (error.code === "permission-denied") {
      alert("❌ ليس لديك صلاحية لعرض هذه المحادثة.");
      return;
    }

    alert("❌ تعذر تحميل المحادثة.");
  }
};

window.sendConversationMessage = async function (conversationId) {
  const user = auth.currentUser;
  if (!user) return;

  const input = document.getElementById("chatMessageText");
  if (!input) return;

  const text = input.value.trim();

  if (!text) {
    alert("اكتب الرسالة أولاً.");
    return;
  }

  if (text.length > 1000) {
    alert("الرسالة طويلة جداً.");
    return;
  }

  try {
    const conversation = await getConversation(conversationId);

    if (!conversation ||
        conversation.contextType !== "direct" ||
        !Array.isArray(conversation.participants) ||
        !conversation.participants.includes(user.uid)) {
      alert("غير مصرح.");
      return;
    }

    const messageRef = doc(
      collection(db, "conversations", conversationId, "messages")
    );

    const conversationRef = doc(db, "conversations", conversationId);
    const batch = writeBatch(db);

    batch.set(messageRef, {
      type: "text",
      text,
      senderId: user.uid,
      createdAt: serverTimestamp()
    });

    const unreadPatch = {};

    if (user.uid === conversation.sellerId) {
      unreadPatch.buyerUnread = Number(conversation.buyerUnread || 0) + 1;
    } else if (user.uid === conversation.buyerId) {
      unreadPatch.sellerUnread = Number(conversation.sellerUnread || 0) + 1;
    }

    batch.set(conversationRef, {
      lastMessage: text,
      lastMessageType: "text",
      lastMessageSenderId: user.uid,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...unreadPatch
    }, { merge: true });

    await batch.commit();
    await window.showConversation(conversationId);
  } catch (error) {
    console.error("SEND MESSAGE ERROR:", error);

    if (error.code === "permission-denied") {
      alert("تعذر إرسال الرسالة. تحقق من صلاحيتك في المحادثة.");
      return;
    }

    alert("❌ تعذر إرسال الرسالة.");
  }
};

window.sendConversationOffer = async function (conversationId) {
  const user = auth.currentUser;
  if (!user) return;

  const amountInput = document.getElementById("chatOfferAmount");
  const textInput = document.getElementById("chatOfferText");

  const offerAmount = Number(amountInput?.value || 0);
  const text = textInput?.value.trim() || "";

  if (!Number.isFinite(offerAmount) || offerAmount <= 0) {
    alert("أدخل عرض سعر صحيح.");
    return;
  }

  if (text.length > 1000) {
    alert("الملاحظة طويلة جداً.");
    return;
  }

  try {
    const conversation = await getConversation(conversationId);

    if (!conversation ||
        conversation.contextType !== "direct" ||
        !Array.isArray(conversation.participants) ||
        !conversation.participants.includes(user.uid)) {
      alert("عرض السعر غير متاح لهذه المحادثة.");
      return;
    }

    const conversationCountry = await getConversationCountry(conversation);

    const messageRef = doc(
      collection(db, "conversations", conversationId, "messages")
    );

    const conversationRef = doc(db, "conversations", conversationId);
    const batch = writeBatch(db);

    const messageData = {
      type: "offer",
      offerAmount,
      status: "pending",
      senderId: user.uid,
      createdAt: serverTimestamp()
    };

    if (text) messageData.text = text;

    batch.set(messageRef, messageData);

    const unreadPatch = {};

    if (user.uid === conversation.sellerId) {
      unreadPatch.buyerUnread = Number(conversation.buyerUnread || 0) + 1;
    } else if (user.uid === conversation.buyerId) {
      unreadPatch.sellerUnread = Number(conversation.sellerUnread || 0) + 1;
    }

    batch.set(conversationRef, {
      lastMessage: "عرض سعر: " + money(offerAmount, conversationCountry),
      lastMessageType: "offer",
      lastOfferAmount: offerAmount,
      lastMessageSenderId: user.uid,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...unreadPatch
    }, { merge: true });

    await batch.commit();
    await window.showConversation(conversationId);
  } catch (error) {
    console.error("SEND OFFER ERROR:", error);

    if (error.code === "permission-denied") {
      alert("تعذر إرسال العرض. تحقق من صلاحيتك وحالة المحادثة.");
      return;
    }

    alert("❌ تعذر إرسال عرض السعر.");
  }
};

window.decideConversationOffer = async function (conversationId, messageId, decision) {
  const user = auth.currentUser;
  if (!user) return;

  if (decision !== "accepted" && decision !== "rejected") return;

  try {
    const conversation = await getConversation(conversationId);

    if (!conversation ||
        conversation.contextType !== "direct" ||
        conversation.sellerId !== user.uid) {
      alert("غير مصرح لك باتخاذ القرار على هذا العرض.");
      return;
    }

    await ensurePrivateConversationContact(conversationId, conversation);

    const messageRef = doc(
      db,
      "conversations",
      conversationId,
      "messages",
      messageId
    );
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      alert("عرض السعر غير موجود.");
      return;
    }

    const message = messageSnap.data();
    const offerStatus = message.status || "pending";

    if (message.type !== "offer" ||
        message.senderId !== conversation.buyerId ||
        offerStatus !== "pending") {
      alert("تم اتخاذ قرار على هذا العرض مسبقاً أو أنه غير صالح.");
      return;
    }

    const conversationCountry = await getConversationCountry(conversation);
    const amountText = money(message.offerAmount, conversationCountry);
    const summary = decision === "accepted"
      ? "تم قبول العرض بقيمة " + amountText
      : "تم رفض العرض بقيمة " + amountText;

    const batch = writeBatch(db);

    batch.update(messageRef, {
      status: decision,
      decidedBy: user.uid,
      decidedAt: serverTimestamp()
    });

    batch.set(doc(db, "conversations", conversationId), {
      lastMessage: summary,
      lastMessageType: "text",
      lastMessageSenderId: user.uid,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      buyerUnread: Number(conversation.buyerUnread || 0) + 1,
      ...(decision === "accepted" ? {
        contactStatus: "unlocked",
        acceptedOfferId: messageId,
        contactUnlockedAt: serverTimestamp()
      } : {})
    }, { merge: true });

    await batch.commit();
    await window.showConversation(conversationId);
  } catch (error) {
    console.error("DECIDE OFFER ERROR:", error);

    if (error.code === "permission-denied") {
      alert("تعذر تحديث العرض. تحقق من صلاحيتك وأنه لم يُعالج مسبقًا.");
      return;
    }

    alert("❌ تعذر تحديث حالة العرض.");
  }
};


window.bid = function () {
  alert("استخدم المزاد الحقيقي في سوق الحلال.");
};

window.details = function (name, price, country = "AE") {
  alert(name + "\nالسعر: " + money(price, country));
};

loadMarket();


// V36: وضوح أزرار اعتماد نتيجة المزاد
(function addAuctionDecisionButtonTextStyle() {
  if (document.getElementById("auction-decision-white-text-v36")) return;

  const style = document.createElement("style");
  style.id = "auction-decision-white-text-v36";
  style.textContent = `
    button[onclick*="approveAuctionSale"],
    button[onclick*="rejectAuctionSale"] {
      color: #ffffff !important;
      font-weight: 800 !important;
    }
  `;
  document.head.appendChild(style);
})();

// One in-flight submission per action; restored even when validation returns early.
for (const action of ["saveListing", "placeBid", "requestPurchase", "submitListingService",
  "sendConversationMessage", "sendConversationOffer", "decideConversationOffer",
  "decideServiceRequest", "finalizeAuction", "updatePurchaseRequest", "saveListingEdits", "sendPhoneCode", "verifyPhoneCode"]) {
  const original = window[action];
  if (typeof original !== "function") continue;
  let busy = false;
  window[action] = async function (...args) {
    args[0]?.preventDefault?.();
    if (busy) return;
    busy = true;
    const buttons = [...document.querySelectorAll(`button[onclick^="${action}("], form button[type="submit"]`)]
      .filter(button => !button.disabled);
    buttons.forEach(button => { button.disabled = true; });
    try { return await original.apply(this, args); }
    finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
  };
}
