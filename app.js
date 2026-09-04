import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  addDoc,
  writeBatch,
  runTransaction,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
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

const handledExpiredAuctions = new Set();

const MARKET_EMIRATE_LOCATIONS = {
  "الشارقة": ["الذيد","مدينة الشارقة","مليحة","البطائح","المدام","الحمرية","خورفكان","كلباء","دبا الحصن"],
  "دبي": ["دبي","حتا","الخوانيج","العوير","الليسيلي","مرغم","لهباب"],
  "أبوظبي": ["أبوظبي","العين","مدينة زايد","ليوا","غياثي","المرفأ","الرويس","السلع","جزيرة دلما"],
  "عجمان": ["عجمان","مصفوت","المنامة"],
  "رأس الخيمة": ["رأس الخيمة","الرمس","شعم","غليلة","الجزيرة الحمراء","خت"],
  "أم القيوين": ["أم القيوين","فلج المعلا"],
  "الفجيرة": ["الفجيرة","دبا الفجيرة","مسافي","مربح","قدفع","البدية","الطويين"]
};

function money(value) {
  return Number(value || 0).toLocaleString("en-US") + " AED";
}

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

function accountTypeText(type) {
  if (type === "seller") return "بائع";
  if (type === "both") return "بائع ومشتري";
  return "مشتري";
}

const SELLER_SUBSCRIPTION_PRICE_AED = 100;

// فترة الإطلاق المجانية: حتى نهاية 4 أكتوبر 2026 بتوقيت الإمارات.
const FREE_LAUNCH_END = new Date("2026-10-04T23:59:59+04:00");

function isLaunchFreePeriodActive() {
  return Date.now() <= FREE_LAUNCH_END.getTime();
}

function hasActiveSellerSubscription(profile) {
  if (!profile) return false;
  if (profile.accountType !== "seller" && profile.accountType !== "both") return false;

  // خلال فترة الإطلاق المجانية يستطيع البائع النشر وإنشاء المزادات بدون دفع.
  if (isLaunchFreePeriodActive()) return true;

  if (profile.subscriptionStatus !== "active") return false;
  const endDate = timestampToDate(profile.subscriptionEnd);
  if (!endDate) return false;
  return endDate.getTime() > Date.now();
}

function getAnimalLocationInfo(location = "") {
  const cleanLocation = String(location || "").trim();
  let city = cleanLocation;
  let emirate = "";

  if (cleanLocation.includes(" - ")) {
    const parts = cleanLocation.split(" - ");
    city = (parts[0] || "").trim();
    emirate = (parts[1] || "").trim();
  }

  if (!emirate) {
    for (const [emirateName, cities] of Object.entries(MARKET_EMIRATE_LOCATIONS)) {
      if (cities.includes(city)) {
        emirate = emirateName;
        break;
      }
    }
  }

  return { city, emirate };
}

function getMarketFilters() {
  const emirate = document.getElementById("marketEmirateFilter")?.value || "all";
  const city = document.getElementById("marketCityFilter")?.value || "all";
  const animalType = document.getElementById("marketAnimalFilter")?.value || "all";
  const saleType = document.getElementById("marketSaleTypeFilter")?.value || "all";
  return { emirate, city, animalType, saleType };
}

function animalMatchesMarketFilters(animal, forcedSaleType = "") {
  if (!animal) return false;

  const filters = getMarketFilters();
  const locationInfo = getAnimalLocationInfo(animal.location || "");

  if (filters.emirate !== "all" && locationInfo.emirate !== filters.emirate) return false;
  if (filters.city !== "all" && locationInfo.city !== filters.city) return false;
  if (filters.animalType !== "all" && animal.type !== filters.animalType) return false;

  const actualSaleType = forcedSaleType || animal.saleType || "";
  if (filters.saleType !== "all" && actualSaleType !== filters.saleType) return false;

  return true;
}

window.updateMarketCityFilter = function () {
  const emirateSelect = document.getElementById("marketEmirateFilter");
  const citySelect = document.getElementById("marketCityFilter");
  if (!emirateSelect || !citySelect) return;

  const emirate = emirateSelect.value;
  citySelect.innerHTML = `<option value="all">جميع المدن والمناطق</option>`;

  if (emirate !== "all") {
    const locations = MARKET_EMIRATE_LOCATIONS[emirate] || [];
    locations.forEach(locationName => {
      const option = document.createElement("option");
      option.value = locationName;
      option.textContent = locationName;
      citySelect.appendChild(option);
    });
  }

  loadMarket();
};

window.applyMarketFilters = function () {
  loadMarket();
};

window.resetMarketFilters = function () {
  const emirate = document.getElementById("marketEmirateFilter");
  const city = document.getElementById("marketCityFilter");
  const animal = document.getElementById("marketAnimalFilter");
  const saleType = document.getElementById("marketSaleTypeFilter");

  if (emirate) emirate.value = "all";
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
  if (!value.startsWith("data:image/jpeg;base64,")) return "";
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
    <button onclick="manageListing('${animal.id}')"
      style="width:100%;background:#28566f;color:white;border:0;padding:14px;border-radius:10px;font-size:17px;margin-top:10px;font-weight:bold;">
      ⚙️ إدارة إعلاني
    </button>
  `;
}

async function ensureUserProfile(user) {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        phoneNumber: user.phoneNumber || "",
        displayName: "",
        accountType: "buyer",
        status: "active",
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    } else {
      await setDoc(userRef, {
        phoneNumber: user.phoneNumber || "",
        lastLoginAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error("USER PROFILE ERROR:", error);
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

function showModal(html) {
  const modal = document.getElementById("modal");
  const content = document.getElementById("modalContent");

  if (!modal || !content) return;

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
  const modal = document.getElementById("modal");
  if (modal) modal.style.display = "none";
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

  await ensureUserProfile(user);
  const profile = await getUserProfile();
  const displayName = profile?.displayName || "";
  const accountType = profile?.accountType || "buyer";
  const phone = user.phoneNumber || profile?.phoneNumber || "";

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
      `
      : "";

  let subscriptionHtml = "";

  if (accountType === "seller" || accountType === "both") {
    const subscriptionActive = hasActiveSellerSubscription(profile);
    const subscriptionEnd = timestampToDate(profile?.subscriptionEnd);

    if (isLaunchFreePeriodActive()) {
      subscriptionHtml = `
        <div style="background:#123c2c;color:#68e6b0;padding:14px;border-radius:10px;margin-bottom:15px;text-align:center;font-weight:bold;">
          🎉 فترة الإطلاق المجانية
          <br>
          <span style="color:white;font-size:14px;font-weight:normal;">
            يمكنك إضافة الإعلانات والمزادات مجاناً حتى 4 أكتوبر 2026.
            <br>
            بعد انتهاء الفترة: اشتراك البائع ${SELLER_SUBSCRIPTION_PRICE_AED} درهم.
          </span>
        </div>
      `;
    } else if (subscriptionActive) {
      subscriptionHtml = `
        <div style="background:#123c2c;color:#68e6b0;padding:14px;border-radius:10px;margin-bottom:15px;text-align:center;font-weight:bold;">
          ✅ اشتراك البائع فعال
          ${subscriptionEnd ? `
            <br>
            <span style="color:white;font-size:14px;">
              ينتهي: ${formatDate(profile.subscriptionEnd)}
            </span>
          ` : ""}
        </div>
      `;
    } else {
      subscriptionHtml = `
        <div style="background:#421d1d;color:#ff8d8d;padding:14px;border-radius:10px;margin-bottom:15px;text-align:center;font-weight:bold;">
          ⛔ اشتراك البائع غير فعال
          <br>
          <span style="color:white;font-size:14px;">
            اشتراك البائع ${SELLER_SUBSCRIPTION_PRICE_AED} درهم.
            <br>
            يجب تفعيل الاشتراك حتى تتمكن من إضافة إعلان أو مزاد.
          </span>
        </div>
      `;
    }
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

      <label>رقم الهاتف</label>
      <input value="${escapeHtml(phone)}" disabled dir="ltr"
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

      ${subscriptionHtml}
      <p id="profileStatus"></p>

      <button onclick="saveProfile()"
        style="width:100%;padding:15px;background:#00643e;color:white;border:0;border-radius:10px;margin-bottom:10px;">
        💾 حفظ بيانات الحساب
      </button>

      ${buyerButtons}
      ${sellerButtons}

      <button onclick="logoutUser()"
        style="width:100%;padding:15px;background:#8b2929;color:white;border:0;border-radius:10px;">
        تسجيل الخروج
      </button>
    </div>
  `);
}

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
      phoneNumber: user.phoneNumber || "",
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
            <b style="color:#68e6b0;">${money(animal.price)}</b>
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
              <b>${money(auction.startPrice)}</b>
            </p>
            <p>
              🏆 السعر الحالي:
              <b style="color:#68e6b0;">${money(currentPrice)}</b>
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
                <b style="color:#68e6b0;">${money(currentPrice)}</b>
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
              <b>${money(animal.price)}</b>
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

          <button onclick="manageListing('${animal.id}')"
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
            <button onclick="updatePurchaseRequest('${request.id}','accepted')"
              style="width:100%;padding:13px;margin-top:10px;background:#00643e;color:white;border:0;border-radius:9px;">
              ✅ قبول طلب الشراء
            </button>

            <button onclick="updatePurchaseRequest('${request.id}','rejected')"
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
            📱 رقم المشتري:
            <b dir="ltr">${escapeHtml(request.buyerPhone || "غير متوفر")}</b>
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
      alert("❌ Firebase رفض تحديث الطلب.");
      return;
    }

    alert("❌ تعذر تحديث طلب الشراء.");
  }
};

window.openLogin = async function () {
  if (auth.currentUser) {
    await showAccount();
    return;
  }

  showModal(`
    <div style="direction:rtl;color:white;padding:10px;">
      <h2 style="text-align:center;color:#68e6b0;">تسجيل الدخول</h2>
      <p style="text-align:center;color:#aaa;">أدخل رقم هاتفك الإماراتي</p>

      <input id="phoneNumber" type="tel" value="+971" placeholder="+971501234567"
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

window.sendPhoneCode = async function () {
  const input = document.getElementById("phoneNumber");
  const status = document.getElementById("loginStatus");
  if (!input || !status) return;

  let phone = input.value.replace(/\s+/g, "").replace(/-/g, "");

  if (phone.startsWith("05")) {
    phone = "+971" + phone.substring(1);
  }

  if (phone.startsWith("971")) {
    phone = "+" + phone;
  }

  if (!phone.startsWith("+9715")) {
    status.innerHTML = "❌ رقم الهاتف غير صحيح.";
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
    console.error("SEND PHONE CODE ERROR:", error);

    status.innerHTML =
      "❌ تعذر إرسال رمز التحقق.<br><br>" +
      "رمز الخطأ: " +
      escapeHtml(error.code || "غير معروف") +
      "<br><br>" +
      "التفاصيل: " +
      escapeHtml(error.message || "");
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
    console.error(error);
    status.innerHTML = "❌ رمز التحقق غير صحيح.";
  }
};

window.logoutUser = async function () {
  await signOut(auth);
  window.closeModal();
  await loadMarket();
};

onAuthStateChanged(auth, async user => {
  const loginButton = document.querySelector(".login");

  if (user) {
    await ensureUserProfile(user);
    if (loginButton) loginButton.textContent = "✅ حسابي";
    startUnreadMessagesListener(user);
  } else {
    if (loginButton) loginButton.textContent = "تسجيل الدخول";
    stopUnreadMessagesListener();
  }

  await loadMarket();
});

function createFirebaseArea() {
  let area = document.getElementById("firebase-market");
  if (area) return area;

  area = document.createElement("section");
  area.id = "firebase-market";

  area.innerHTML = `
    <div style="max-width:1100px;margin:35px auto;padding:20px;direction:rtl;">
      <h2 style="text-align:center;color:#68e6b0;margin-bottom:7px;">🐪 سوق الحلال</h2>
      <p style="text-align:center;color:#aaa;margin-top:0;">
        ابحث عن الحلال حسب الإمارة والمنطقة
      </p>

      <div id="market-filters"
        style="background:#1d2521;border:1px solid #35443d;border-radius:16px;padding:16px;margin:22px 0 25px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">

        <select id="marketEmirateFilter" onchange="updateMarketCityFilter()"
          style="width:100%;padding:13px;border-radius:10px;border:1px solid #45564e;">
          <option value="all">📍 جميع الإمارات</option>
          <option value="الشارقة">الشارقة</option>
          <option value="دبي">دبي</option>
          <option value="أبوظبي">أبوظبي</option>
          <option value="عجمان">عجمان</option>
          <option value="رأس الخيمة">رأس الخيمة</option>
          <option value="أم القيوين">أم القيوين</option>
          <option value="الفجيرة">الفجيرة</option>
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
  return area;
}

window.goToDirectSales = async function (event) {
  if (event) event.preventDefault();

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
          <p>السعر النهائي: <b>${money(auction.currentPrice)}</b></p>

          ${auction.lastBidderPhone ? `
            <p>
              📱 رقم الفائز:
              <b dir="ltr">${escapeHtml(auction.lastBidderPhone)}</b>
            </p>
          ` : ""}

          <p style="color:white;font-size:14px;">
            يتم التواصل مع الفائز لإتمام المعاينة والاستلام والدفع شخصياً.
          </p>

          <button onclick="openAuctionConversation('${auction.id}')"
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
          <p>السعر النهائي: <b>${money(auction.currentPrice)}</b></p>

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

          <button onclick="openAuctionConversation('${auction.id}')"
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
        ${money(auction.currentPrice)}
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
      <button id="bid-button-${auction.id}" onclick="placeBid('${auction.id}')"
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
          ${money(auction.currentPrice)}
        </div>
        <div>⏳ المزاد انتهى — بانتظار قرارك</div>
      </div>

      <button onclick="finalizeAuction('${auction.id}','accept')"
        style="width:100%;background:#00643e;color:white;border:0;padding:16px;border-radius:10px;margin-bottom:10px;font-size:17px;font-weight:bold;">
        ✅ اعتماد البيع لأعلى مزايد
      </button>

      <button onclick="finalizeAuction('${auction.id}','reject')"
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
          ${money(auction.currentPrice)}
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
      <span style="color:#68e6b0;">${money(auction.currentPrice)}</span>
      <br><br>
      بانتظار اعتماد البائع
    </div>
  `;
}

async function loadMarket() {
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
      );

    if (directAnimals.length === 0) {
      directContainer.innerHTML = `
        <div style="background:#222;color:white;padding:20px;border-radius:15px;text-align:center;">
          لا توجد عروض بيع مباشر مطابقة للبحث
        </div>
      `;
    } else {
      directContainer.innerHTML = directAnimals.map(animal => `
        <div style="background:#222;color:white;padding:20px;border-radius:18px;">
          ${animalPhotoHtml(animal)}

          <h3>${escapeHtml(animal.name || animal.type || "حلال للبيع")}</h3>

          <div style="font-size:25px;color:#68e6b0;font-weight:bold;margin:15px 0;">
            ${money(animal.price)}
          </div>

          <p>📍 ${escapeHtml(animal.location || "غير محدد")}</p>

          ${listingAnimalDetailsHtml(animal)}
          ${listingDescriptionHtml(animal)}

          <p style="color:#aaa;font-size:13px;margin-top:14px;">
            📅 تاريخ الإعلان: ${formatListingDate(animal.createdAt)}
          </p>

          <button onclick="requestPurchase('${animal.id}')"
            style="width:100%;background:#00643e;color:white;border:0;padding:14px;border-radius:10px;">
            طلب شراء
          </button>

          ${(!auth.currentUser || animal.sellerId !== auth.currentUser.uid) ? `
            <button onclick="openDirectConversation('${animal.id}')"
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
      .filter(auction => {
        const animal = animals[auction.animalId];
        if (!animal) return false;
        return animalMatchesMarketFilters(animal, "auction");
      });

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
          <div style="background:#222;color:white;padding:20px;border-radius:18px;">
            ${animalPhotoHtml(animal)}

            <div id="auction-tag-${auction.id}"
              style="display:inline-block;background:${tagColor};padding:6px 12px;border-radius:20px;margin-top:12px;">
              ${tagText}
            </div>

            <h3>${escapeHtml(animal.name || animal.type || "مزاد حلال")}</h3>

            <div style="font-size:27px;color:#68e6b0;font-weight:bold;margin:15px 0;">
              السعر الحالي:
              <br>
              ${money(currentPrice)}
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

            <p>سعر البداية: <b>${money(auction.startPrice)}</b></p>
            <p>أقل زيادة: <b>${money(increment)}</b></p>
            ${auction.status === "active" && !expired ? `
              <p>
                الحد الأدنى للمزايدة القادمة:
                <b>${money(minimumNextBid)}</b>
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

    const images = Array.isArray(animal.images) ? animal.images : [];

    const imageHtml = images.length > 0
      ? images.map((image, index) => {
          const safe = safeImageData(image);
          if (!safe) return "";

          return `
            <div style="position:relative;margin-bottom:12px;">
              <img src="${safe}"
                style="width:100%;max-height:250px;object-fit:cover;border-radius:12px;">

              <button onclick="removeAnimalImage('${animal.id}', ${index})"
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
          <label>السعر بالدرهم</label>
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
                <b>${money(auction.currentPrice)}</b>
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
              <b style="color:#68e6b0;">${money(auction.currentPrice)}</b>
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
                ${money(auction.currentPrice)}
              </div>
              ⏳ بانتظار اعتمادك للنتيجة
            </div>

            <button onclick="finalizeAuction('${auction.id}','accept')"
              style="width:100%;background:#00643e;color:white;border:0;padding:16px;border-radius:10px;margin-bottom:10px;">
              ✅ اعتماد البيع لأعلى مزايد
            </button>

            <button onclick="finalizeAuction('${auction.id}','reject')"
              style="width:100%;background:#8b2929;color:white;border:0;padding:16px;border-radius:10px;margin-bottom:15px;">
              ❌ عدم اعتماد البيع
            </button>
          `;
        }
      }
    } else {
      saleActionHtml = `
        <button onclick="markListingSold('${animal.id}')"
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

        <button onclick="saveListingEdits('${animal.id}')"
          style="width:100%;margin:15px 0;">
          💾 حفظ التعديلات
        </button>

        <hr>

        ${imageHtml}

        <input id="manageImages" type="file" accept="image/*" multiple>

        <button onclick="replaceAnimalImages('${animal.id}')"
          style="width:100%;margin:10px 0;">
          🖼️ حفظ الصور الجديدة
        </button>

        <button onclick="removeAllAnimalImages('${animal.id}')"
          style="width:100%;margin-bottom:15px;">
          🧹 حذف جميع الصور
        </button>

        ${saleActionHtml}

        <button onclick="deleteListing('${animal.id}')"
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
        money(auction.currentPrice);
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
      "\nالسعر: " + money(animal.price)
    );

    if (!ok) return;

    await addDoc(collection(db, "purchaseRequests"), {
      animalId,
      animalType: animal.type || "",
      animalBreed: animal.breed || "",
      price: Number(animal.price || 0),
      sellerId: animal.sellerId,
      sellerName: animal.sellerName || "",
      sellerPhone: animal.sellerPhone || "",
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
      minimumBid = currentPrice + increment;
    });

    const enteredValue = prompt(
      "أدخل مبلغ المزايدة الجديدة بالدرهم\n\n" +
      "الحد الأدنى المقبول: " +
      money(minimumBid),
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
        lastBidderPhone: auth.currentUser.phoneNumber || ""
      });
    });

    alert(
      "✅ تمت المزايدة بنجاح\n\n" +
      "السعر الجديد: " +
      money(bidAmount)
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
        money(required)
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

    if (!hasActiveSellerSubscription(profile)) {
      const endDate = timestampToDate(profile.subscriptionEnd);
      let message = "⛔ لا يمكنك نشر إعلان أو إنشاء مزاد حالياً.\n\n";

      if (profile.subscriptionStatus !== "active") {
        message += "اشتراك البائع غير فعال.";
      } else if (endDate && endDate.getTime() <= Date.now()) {
        message +=
          "انتهى اشتراك البائع بتاريخ:\n" +
          formatDate(profile.subscriptionEnd);
      } else {
        message += "لا يوجد اشتراك بائع فعال.";
      }

      message += "\n\nاشتراك البائع: " + SELLER_SUBSCRIPTION_PRICE_AED + " درهم.\nيرجى تفعيل الاشتراك للمتابعة.";
      alert(message);
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
    const location = document.getElementById("animalLocation")?.value.trim() || "الذيد - الشارقة";
    const method = document.getElementById("method")?.value || "";
    const price = Number(document.getElementById("animalPrice")?.value);
    const description = document.getElementById("animalDescription")?.value.trim() || "";

    if (!type || !gender || !Number.isFinite(price) || price <= 0) {
      alert("تأكد من نوع الحيوان والجنس والسعر.");
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
        location,
        saleType: "direct",
        price,
        description,
        images,
        sellerId: user.uid,
        sellerName: profile.displayName || "",
        sellerPhone: user.phoneNumber || "",
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
        location,
        saleType: "auction",
        price,
        description,
        images,
        sellerId: user.uid,
        sellerName: profile.displayName || "",
        sellerPhone: user.phoneNumber || "",
        status: "active",
        auctionId: auctionRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      batch.set(auctionRef, {
        animalId: animalRef.id,
        sellerId: user.uid,
        sellerName: profile.displayName || "",
        sellerPhone: user.phoneNumber || "",
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
      alert("❌ Firebase رفض إنشاء المحادثة. تأكد من نشر قواعد الرسائل الجديدة.");
      return;
    }

    alert("❌ تعذر فتح المحادثة.");
  }
};

window.openAuctionConversation = async function (auctionId) {
  const user = auth.currentUser;

  if (!user) {
    alert("يجب تسجيل الدخول أولاً.");
    window.openLogin();
    return;
  }

  try {
    const auctionSnap = await getDoc(doc(db, "auctions", auctionId));

    if (!auctionSnap.exists()) {
      alert("المزاد غير موجود.");
      return;
    }

    const auction = {
      id: auctionSnap.id,
      ...auctionSnap.data()
    };

    if (auction.status !== "sold" || !auction.lastBidderId) {
      alert("تُفتح الرسائل بعد اعتماد الفائز بالمزاد فقط.");
      return;
    }

    const isSeller = auction.sellerId === user.uid;
    const isWinner = auction.lastBidderId === user.uid;

    if (!isSeller && !isWinner) {
      alert("هذه المحادثة متاحة فقط للبائع والفائز بالمزاد.");
      return;
    }

    const buyerId = auction.lastBidderId;
    const conversationId = auctionConversationId(auctionId, buyerId);
    const conversationRef = doc(db, "conversations", conversationId);
    const existing = await getDoc(conversationRef);

    if (!existing.exists()) {
      let animalName = "مزاد حلال";
      let animalType = "";

      if (auction.animalId) {
        const animalSnap = await getDoc(doc(db, "animals", auction.animalId));
        if (animalSnap.exists()) {
          const animal = animalSnap.data();
          animalName = animal.name || animal.type || animalName;
          animalType = animal.type || "";
        }
      }

      await setDoc(conversationRef, {
        contextType: "auction",
        auctionId,
        animalId: auction.animalId || "",
        animalName,
        animalType,
        finalPrice: Number(auction.currentPrice || auction.startPrice || 0),
        sellerId: auction.sellerId,
        sellerName: auction.sellerName || "البائع",
        buyerId,
        buyerName: "الفائز بالمزاد",
        participants: [auction.sellerId, buyerId],
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
    console.error("OPEN AUCTION CONVERSATION ERROR:", error);

    if (error.code === "permission-denied") {
      alert("❌ Firebase رفض فتح محادثة المزاد. تأكد من نشر قواعد الرسائل.");
      return;
    }

    alert("❌ تعذر فتح المحادثة.");
  }
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
      conversations.push({
        id: conversationDoc.id,
        ...conversationDoc.data()
      });
    });

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
            السعر المعلن: ${money(conversation.askingPrice)}
          </div>
        `;
      } else if (conversation.finalPrice) {
        priceLine = `
          <div style="color:#68e6b0;font-weight:bold;margin-top:6px;">
            السعر النهائي: ${money(conversation.finalPrice)}
          </div>
        `;
      }

      const lastMessage = conversation.lastMessage
        ? escapeHtml(conversation.lastMessage)
        : "ابدأ المحادثة الآن";

      return `
        <button onclick="showConversation('${conversation.id}')"
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

    if (!conversation) {
      alert("المحادثة غير موجودة.");
      return;
    }

    if (!Array.isArray(conversation.participants) ||
        !conversation.participants.includes(user.uid)) {
      alert("غير مصرح لك بفتح هذه المحادثة.");
      return;
    }

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

    const isSeller = conversation.sellerId === user.uid;
    const otherName = isSeller
      ? (conversation.buyerName || "المشتري")
      : (conversation.sellerName || "البائع");

    const canOffer = conversation.contextType === "direct";

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
            body = `
              <div style="font-size:12px;color:#f3e6b8 !important;margin-bottom:5px;font-weight:700;">
                💰 عرض سعر
              </div>
              <div style="font-size:22px;font-weight:800;color:#ffd66b !important;">
                ${money(message.offerAmount)}
              </div>
              ${message.text ? `
                <div style="margin-top:8px;color:#ffffff !important;font-size:15px;">
                  ${escapeHtml(message.text)}
                </div>
              ` : ""}
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
          placeholder="اكتب السعر المقترح بالدرهم"
          style="width:100%;box-sizing:border-box;padding:13px;border-radius:9px;margin-bottom:8px;">

        <input id="chatOfferText" maxlength="1000"
          placeholder="ملاحظة اختيارية، مثال: أستطيع الاستلام اليوم"
          style="width:100%;box-sizing:border-box;padding:13px;border-radius:9px;margin-bottom:8px;">

        <button onclick="sendConversationOffer('${conversationId}')"
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
            <b style="color:#68e6b0;">${money(conversation.askingPrice)}</b>
          </div>
        ` : `
          <div style="background:#123c2c;color:white;padding:11px;border-radius:10px;text-align:center;margin-bottom:12px;">
            السعر النهائي للمزاد:
            <b style="color:#68e6b0;">${money(conversation.finalPrice)}</b>
          </div>
        `}

        <div id="conversationMessages"
          style="background:#171c19;border-radius:14px;padding:12px;min-height:210px;max-height:42vh;overflow-y:auto;">
          ${messagesHtml}
        </div>

        <div style="margin-top:12px;">
          <textarea id="chatMessageText" maxlength="1000" rows="3"
            placeholder="اكتب رسالتك هنا..."
            style="width:100%;box-sizing:border-box;padding:13px;border-radius:10px;resize:vertical;"></textarea>

          <button onclick="sendConversationMessage('${conversationId}')"
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

        if (snapshot.docChanges().some(change => change.type === "added")) {
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
      alert("❌ Firebase رفض إرسال الرسالة.");
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

    const messageRef = doc(
      collection(db, "conversations", conversationId, "messages")
    );

    const conversationRef = doc(db, "conversations", conversationId);
    const batch = writeBatch(db);

    const messageData = {
      type: "offer",
      offerAmount,
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
      lastMessage: "عرض سعر: " + money(offerAmount),
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
      alert("❌ Firebase رفض إرسال عرض السعر.");
      return;
    }

    alert("❌ تعذر إرسال عرض السعر.");
  }
};


window.bid = function () {
  alert("استخدم المزاد الحقيقي في سوق الحلال.");
};

window.details = function (name, price) {
  alert(name + "\nالسعر: " + price + " AED");
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
