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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


// =====================================
// Firebase
// =====================================

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

const handledExpiredAuctions =
  new Set();


// =====================================
// مناطق الإمارات - فلترة السوق
// =====================================

const MARKET_EMIRATE_LOCATIONS = {

  "الشارقة": [
    "الذيد",
    "مدينة الشارقة",
    "مليحة",
    "البطائح",
    "المدام",
    "الحمرية",
    "خورفكان",
    "كلباء",
    "دبا الحصن"
  ],

  "دبي": [
    "دبي",
    "حتا",
    "الخوانيج",
    "العوير",
    "الليسيلي",
    "مرغم",
    "لهباب"
  ],

  "أبوظبي": [
    "أبوظبي",
    "العين",
    "مدينة زايد",
    "ليوا",
    "غياثي",
    "المرفأ",
    "الرويس",
    "السلع",
    "جزيرة دلما"
  ],

  "عجمان": [
    "عجمان",
    "مصفوت",
    "المنامة"
  ],

  "رأس الخيمة": [
    "رأس الخيمة",
    "الرمس",
    "شعم",
    "غليلة",
    "الجزيرة الحمراء",
    "خت"
  ],

  "أم القيوين": [
    "أم القيوين",
    "فلج المعلا"
  ],

  "الفجيرة": [
    "الفجيرة",
    "دبا الفجيرة",
    "مسافي",
    "مربح",
    "قدفع",
    "البدية",
    "الطويين"
  ]
};


// =====================================
// أدوات مساعدة
// =====================================

function money(value) {

  return (
    Number(
      value || 0
    ).toLocaleString(
      "en-US"
    ) +
    " AED"
  );
}


function animalIcon(type = "") {

  if (
    type.includes("ناقة") ||
    type.includes("جمل") ||
    type.includes("إبل")
  ) {
    return "🐫";
  }

  if (
    type.includes("خروف") ||
    type.includes("غنم")
  ) {
    return "🐑";
  }

  if (
    type.includes("ماعز")
  ) {
    return "🐐";
  }

  if (
    type.includes("بقر") ||
    type.includes("بقرة") ||
    type.includes("أبقار")
  ) {
    return "🐄";
  }

  if (
    type.includes("دجاج")
  ) {
    return "🐔";
  }

  if (
    type.includes("صقر") ||
    type.includes("صقور")
  ) {
    return "🦅";
  }

  if (
    type.includes("غزال") ||
    type.includes("غزلان")
  ) {
    return "🦌";
  }

  if (
    type.includes("نعام")
  ) {
    return "🐦";
  }

  if (
    type.includes("حمام")
  ) {
    return "🕊️";
  }

  return "🐾";
}


// =====================================
// التاريخ
// =====================================

function timestampToDate(
  timestamp
) {

  if (!timestamp) {
    return null;
  }

  if (
    timestamp.toDate
  ) {
    return timestamp.toDate();
  }

  if (
    timestamp instanceof Date
  ) {
    return timestamp;
  }

  const date =
    new Date(
      timestamp
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}


function timestampToMillis(
  timestamp
) {

  const date =
    timestampToDate(
      timestamp
    );

  if (!date) {
    return 0;
  }

  return date.getTime();
}


function formatDate(
  timestamp
) {

  const date =
    timestampToDate(
      timestamp
    );

  if (!date) {
    return "غير محدد";
  }

  return date.toLocaleString(
    "ar-AE",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short"
    }
  );
}


// =====================================
// العد التنازلي
// =====================================

function getCountdownText(
  endTime
) {

  const end =
    timestampToMillis(
      endTime
    );

  if (!end) {
    return "غير محدد";
  }

  const difference =
    end -
    Date.now();

  if (
    difference <= 0
  ) {
    return "انتهى المزاد";
  }

  const totalSeconds =
    Math.floor(
      difference /
      1000
    );

  const days =
    Math.floor(
      totalSeconds /
      86400
    );

  const hours =
    Math.floor(
      (
        totalSeconds %
        86400
      ) /
      3600
    );

  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) /
      60
    );

  const seconds =
    totalSeconds %
    60;

  const hh =
    String(
      hours
    ).padStart(
      2,
      "0"
    );

  const mm =
    String(
      minutes
    ).padStart(
      2,
      "0"
    );

  const ss =
    String(
      seconds
    ).padStart(
      2,
      "0"
    );

  if (
    days > 0
  ) {

    return (
      "متبقي " +
      days +
      " يوم و " +
      hh +
      ":" +
      mm +
      ":" +
      ss
    );
  }

  return (
    "متبقي " +
    hh +
    ":" +
    mm +
    ":" +
    ss
  );
}


// =====================================
// تشغيل العدادات
// =====================================

function startAuctionTimers() {

  if (
    auctionTimerInterval
  ) {

    clearInterval(
      auctionTimerInterval
    );

    auctionTimerInterval =
      null;
  }

  function updateTimers() {

    const timers =
      document.querySelectorAll(
        "[data-auction-end]"
      );

    timers.forEach(
      timer => {

        const end =
          Number(
            timer.dataset
              .auctionEnd ||
            0
          );

        const auctionId =
          timer.dataset
            .auctionId;

        const button =
          document.getElementById(
            "bid-button-" +
            auctionId
          );

        const tag =
          document.getElementById(
            "auction-tag-" +
            auctionId
          );

        const difference =
          end -
          Date.now();

        if (
          !end ||
          difference <= 0
        ) {

          timer.innerHTML =
            "⛔ انتهى المزاد";

          timer.style.color =
            "#ff8d8d";

          if (
            button
          ) {

            button.disabled =
              true;

            button.textContent =
              "انتهى المزاد";

            button.style.background =
              "#555";
          }

          if (
            tag
          ) {

            tag.textContent =
              "مزاد منتهي";

            tag.style.background =
              "#6d2929";
          }

          if (
            auctionId &&
            !handledExpiredAuctions
              .has(
                auctionId
              )
          ) {

            handledExpiredAuctions
              .add(
                auctionId
              );

            setTimeout(
              () => {

                loadMarket();

              },
              500
            );
          }

          return;
        }

        const totalSeconds =
          Math.floor(
            difference /
            1000
          );

        const days =
          Math.floor(
            totalSeconds /
            86400
          );

        const hours =
          Math.floor(
            (
              totalSeconds %
              86400
            ) /
            3600
          );

        const minutes =
          Math.floor(
            (
              totalSeconds %
              3600
            ) /
            60
          );

        const seconds =
          totalSeconds %
          60;

        const hh =
          String(
            hours
          ).padStart(
            2,
            "0"
          );

        const mm =
          String(
            minutes
          ).padStart(
            2,
            "0"
          );

        const ss =
          String(
            seconds
          ).padStart(
            2,
            "0"
          );

        if (
          days > 0
        ) {

          timer.innerHTML =
            "⏱ متبقي: " +
            days +
            " يوم و " +
            hh +
            ":" +
            mm +
            ":" +
            ss;

        } else {

          timer.innerHTML =
            "⏱ متبقي: " +
            hh +
            ":" +
            mm +
            ":" +
            ss;
        }
      }
    );
  }

  updateTimers();

  auctionTimerInterval =
    setInterval(
      updateTimers,
      1000
    );
}


// =====================================
// حماية النصوص
// =====================================

function escapeHtml(
  value = ""
) {

  return String(
    value
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


function accountTypeText(
  type
) {

  if (
    type ===
    "seller"
  ) {
    return "بائع";
  }

  if (
    type ===
    "both"
  ) {
    return "بائع ومشتري";
  }

  return "مشتري";
}


// =====================================
// فحص اشتراك البائع
// =====================================

function hasActiveSellerSubscription(
  profile
) {

  if (
    !profile
  ) {
    return false;
  }

  if (
    profile.accountType !==
      "seller" &&
    profile.accountType !==
      "both"
  ) {
    return false;
  }

  if (
    profile.subscriptionStatus !==
    "active"
  ) {
    return false;
  }

  const endDate =
    timestampToDate(
      profile
        .subscriptionEnd
    );

  if (
    !endDate
  ) {
    return false;
  }

  return (
    endDate.getTime() >
    Date.now()
  );
}


// =====================================
// قراءة موقع الإعلان للفلترة
// =====================================

function getAnimalLocationInfo(
  location = ""
) {

  const cleanLocation =
    String(
      location || ""
    ).trim();

  let city =
    cleanLocation;

  let emirate =
    "";

  if (
    cleanLocation.includes(
      " - "
    )
  ) {

    const parts =
      cleanLocation
        .split(" - ");

    city =
      (
        parts[0] ||
        ""
      ).trim();

    emirate =
      (
        parts[1] ||
        ""
      ).trim();
  }

  if (
    !emirate
  ) {

    for (
      const [
        emirateName,
        cities
      ]
      of Object.entries(
        MARKET_EMIRATE_LOCATIONS
      )
    ) {

      if (
        cities.includes(
          city
        )
      ) {

        emirate =
          emirateName;

        break;
      }
    }
  }

  return {
    city,
    emirate
  };
}


// =====================================
// قراءة الفلاتر
// =====================================

function getMarketFilters() {

  const emirate =
    document.getElementById(
      "marketEmirateFilter"
    )?.value ||
    "all";

  const city =
    document.getElementById(
      "marketCityFilter"
    )?.value ||
    "all";

  const animalType =
    document.getElementById(
      "marketAnimalFilter"
    )?.value ||
    "all";

  const saleType =
    document.getElementById(
      "marketSaleTypeFilter"
    )?.value ||
    "all";

  return {
    emirate,
    city,
    animalType,
    saleType
  };
}


// =====================================
// هل الإعلان مطابق للفلاتر؟
// =====================================

function animalMatchesMarketFilters(
  animal,
  forcedSaleType = ""
) {

  if (
    !animal
  ) {
    return false;
  }

  const filters =
    getMarketFilters();

  const locationInfo =
    getAnimalLocationInfo(
      animal.location ||
      ""
    );

  if (
    filters.emirate !==
      "all" &&
    locationInfo.emirate !==
      filters.emirate
  ) {

    return false;
  }

  if (
    filters.city !==
      "all" &&
    locationInfo.city !==
      filters.city
  ) {

    return false;
  }

  if (
    filters.animalType !==
      "all" &&
    animal.type !==
      filters.animalType
  ) {

    return false;
  }

  const actualSaleType =
    forcedSaleType ||
    animal.saleType ||
    "";

  if (
    filters.saleType !==
      "all" &&
    actualSaleType !==
      filters.saleType
  ) {

    return false;
  }

  return true;
}


// =====================================
// تحديث قائمة المدن داخل فلتر السوق
// =====================================

window.updateMarketCityFilter =
function () {

  const emirateSelect =
    document.getElementById(
      "marketEmirateFilter"
    );

  const citySelect =
    document.getElementById(
      "marketCityFilter"
    );

  if (
    !emirateSelect ||
    !citySelect
  ) {
    return;
  }

  const emirate =
    emirateSelect.value;

  citySelect.innerHTML = `

    <option value="all">
      جميع المدن والمناطق
    </option>
  `;

  if (
    emirate !==
    "all"
  ) {

    const locations =
      MARKET_EMIRATE_LOCATIONS[
        emirate
      ] || [];

    locations.forEach(
      locationName => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          locationName;

        option.textContent =
          locationName;

        citySelect.appendChild(
          option
        );
      }
    );
  }

  loadMarket();
};


// =====================================
// تطبيق الفلاتر
// =====================================

window.applyMarketFilters =
function () {

  loadMarket();
};


// =====================================
// إعادة ضبط الفلاتر
// =====================================

window.resetMarketFilters =
function () {

  const emirate =
    document.getElementById(
      "marketEmirateFilter"
    );

  const city =
    document.getElementById(
      "marketCityFilter"
    );

  const animal =
    document.getElementById(
      "marketAnimalFilter"
    );

  const saleType =
    document.getElementById(
      "marketSaleTypeFilter"
    );

  if (
    emirate
  ) {
    emirate.value =
      "all";
  }

  if (
    city
  ) {

    city.innerHTML = `

      <option value="all">
        جميع المدن والمناطق
      </option>
    `;
  }

  if (
    animal
  ) {
    animal.value =
      "all";
  }

  if (
    saleType
  ) {
    saleType.value =
      "all";
  }

  loadMarket();
};


// =====================================
// ضغط الصور
// =====================================

function compressImageFile(
  file
) {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        !file ||
        !file.type ||
        !file.type
          .startsWith(
            "image/"
          )
      ) {

        reject(
          new Error(
            "INVALID_IMAGE"
          )
        );

        return;
      }

      const reader =
        new FileReader();

      reader.onerror =
        function () {

          reject(
            new Error(
              "IMAGE_READ_ERROR"
            )
          );
        };

      reader.onload =
        function (
          event
        ) {

          const img =
            new Image();

          img.onerror =
            function () {

              reject(
                new Error(
                  "IMAGE_LOAD_ERROR"
                )
              );
            };

          img.onload =
            function () {

              const maxSize =
                640;

              let width =
                img.width;

              let height =
                img.height;

              if (
                width >
                  maxSize ||
                height >
                  maxSize
              ) {

                const ratio =
                  Math.min(
                    maxSize /
                      width,
                    maxSize /
                      height
                  );

                width =
                  Math.round(
                    width *
                    ratio
                  );

                height =
                  Math.round(
                    height *
                    ratio
                  );
              }

              const canvas =
                document.createElement(
                  "canvas"
                );

              canvas.width =
                width;

              canvas.height =
                height;

              const ctx =
                canvas.getContext(
                  "2d"
                );

              if (
                !ctx
              ) {

                reject(
                  new Error(
                    "CANVAS_ERROR"
                  )
                );

                return;
              }

              ctx.fillStyle =
                "#ffffff";

              ctx.fillRect(
                0,
                0,
                width,
                height
              );

              ctx.drawImage(
                img,
                0,
                0,
                width,
                height
              );

              resolve(
                canvas.toDataURL(
                  "image/jpeg",
                  0.48
                )
              );
            };

          img.src =
            event.target
              .result;
        };

      reader.readAsDataURL(
        file
      );
    }
  );
}


// =====================================
// قراءة صور الإضافة
// =====================================

async function getListingImages() {

  const input =
    document.getElementById(
      "animalImages"
    );

  if (
    !input ||
    !input.files ||
    input.files.length ===
      0
  ) {

    return [];
  }

  const files =
    Array.from(
      input.files
    );

  if (
    files.length >
    5
  ) {

    throw new Error(
      "TOO_MANY_IMAGES"
    );
  }

  const images =
    [];

  let totalSize =
    0;

  for (
    const file
    of files
  ) {

    const imageData =
      await compressImageFile(
        file
      );

    totalSize +=
      imageData.length;

    if (
      totalSize >
      650000
    ) {

      throw new Error(
        "IMAGES_TOO_LARGE"
      );
    }

    images.push(
      imageData
    );
  }

  return images;
}


// =====================================
// صورة آمنة
// =====================================

function safeImageData(
  value
) {

  if (
    typeof value !==
    "string"
  ) {

    return "";
  }

  if (
    !value.startsWith(
      "data:image/jpeg;base64,"
    )
  ) {

    return "";
  }

  return value;
}


// =====================================
// عرض صورة الحيوان
// =====================================

function animalPhotoHtml(
  animal = {}
) {

  const images =
    Array.isArray(
      animal.images
    )
      ?
      animal.images
      :
      [];

  const firstImage =
    safeImageData(
      images[0]
    );

  if (
    firstImage
  ) {

    return `

      <div style="
        position:relative;
        width:100%;
        height:230px;
        overflow:hidden;
        border-radius:14px;
        background:#10271c;
      ">

        <img
          src="${firstImage}"
          alt="صورة الحيوان"
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
          "
        >

        ${
          images.length >
          1
            ?
            `
              <div style="
                position:absolute;
                bottom:10px;
                left:10px;
                background:rgba(0,0,0,.75);
                color:white;
                padding:6px 10px;
                border-radius:20px;
              ">
                📷 ${images.length} صور
              </div>
            `
            :
            ""
        }

      </div>
    `;
  }

  return `

    <div style="
      font-size:90px;
      text-align:center;
      background:#10271c;
      border-radius:14px;
      padding:20px;
    ">

      ${animalIcon(
        animal.type ||
        ""
      )}

    </div>
  `;
}


// =====================================
// زر إدارة الإعلان
// =====================================

function ownerManagementButton(
  animal
) {

  const user =
    auth.currentUser;

  if (
    !user ||
    !animal ||
    animal.sellerId !==
      user.uid
  ) {

    return "";
  }

  return `

    <button
      onclick="manageListing('${animal.id}')"
      style="
        width:100%;
        background:#28566f;
        color:white;
        border:0;
        padding:14px;
        border-radius:10px;
        font-size:17px;
        margin-top:10px;
        font-weight:bold;
      "
    >
      ⚙️ إدارة إعلاني
    </button>
  `;
}


// =====================================
// حساب المستخدم
// =====================================

async function ensureUserProfile(
  user
) {

  if (
    !user
  ) {
    return;
  }

  try {

    const userRef =
      doc(
        db,
        "users",
        user.uid
      );

    const userSnap =
      await getDoc(
        userRef
      );

    if (
      !userSnap.exists()
    ) {

      await setDoc(
        userRef,
        {
          uid:
            user.uid,

          phoneNumber:
            user.phoneNumber ||
            "",

          displayName:
            "",

          accountType:
            "buyer",

          status:
            "active",

          createdAt:
            serverTimestamp(),

          lastLoginAt:
            serverTimestamp()
        }
      );

    } else {

      await setDoc(
        userRef,
        {
          phoneNumber:
            user.phoneNumber ||
            "",

          lastLoginAt:
            serverTimestamp()
        },
        {
          merge:
            true
        }
      );
    }

  } catch (
    error
  ) {

    console.error(
      "USER PROFILE ERROR:",
      error
    );
  }
}


async function getUserProfile() {

  const user =
    auth.currentUser;

  if (
    !user
  ) {
    return null;
  }

  try {

    const userSnap =
      await getDoc(
        doc(
          db,
          "users",
          user.uid
        )
      );

    if (
      !userSnap.exists()
    ) {
      return null;
    }

    return {
      id:
        userSnap.id,

      ...userSnap.data()
    };

  } catch (
    error
  ) {

    console.error(
      "GET PROFILE ERROR:",
      error
    );

    return null;
  }
}


// =====================================
// Modal
// =====================================

function showModal(
  html
) {

  const modal =
    document.getElementById(
      "modal"
    );

  const content =
    document.getElementById(
      "modalContent"
    );

  if (
    !modal ||
    !content
  ) {
    return;
  }

  content.innerHTML =
    html;

  modal.style.display =
    "flex";

  modal.style.alignItems =
    "flex-start";

  modal.style.justifyContent =
    "center";

  modal.style.overflowY =
    "auto";

  modal.style.overflowX =
    "hidden";

  modal.style.paddingTop =
    "20px";

  modal.style.paddingBottom =
    "30px";

  modal.style.boxSizing =
    "border-box";

  modal.scrollTop =
    0;

  content.scrollTop =
    0;

  const closeButton =
    modal.querySelector(
      ".close"
    );

  if (
    closeButton
  ) {

    closeButton.style.position =
      "fixed";

    closeButton.style.top =
      "18px";

    closeButton.style.left =
      "18px";

    closeButton.style.zIndex =
      "999999";

    closeButton.style.width =
      "42px";

    closeButton.style.height =
      "42px";

    closeButton.style.display =
      "flex";

    closeButton.style.alignItems =
      "center";

    closeButton.style.justifyContent =
      "center";

    closeButton.style.background =
      "#8b2929";

    closeButton.style.color =
      "#ffffff";

    closeButton.style.borderRadius =
      "50%";

    closeButton.style.fontSize =
      "26px";

    closeButton.style.cursor =
      "pointer";

    closeButton.style.boxShadow =
      "0 3px 12px rgba(0,0,0,.45)";
  }

  setTimeout(
    () => {

      modal.scrollTop =
        0;

      content.scrollTop =
        0;

    },
    0
  );
}


window.closeModal =
function () {

  const modal =
    document.getElementById(
      "modal"
    );

  if (
    modal
  ) {

    modal.style.display =
      "none";
  }
};


// =====================================
// حسابي
// =====================================

async function showAccount() {

  const user =
    auth.currentUser;

  if (
    !user
  ) {
    return;
  }

  showModal(`

    <div style="
      direction:rtl;
      text-align:center;
      color:white;
      padding:20px;
    ">

      <div style="
        font-size:55px;
      ">
        👤
      </div>

      <h2 style="
        color:#68e6b0;
      ">
        حسابي
      </h2>

      <p style="
        color:#aaa;
      ">
        جاري تحميل البيانات...
      </p>

    </div>
  `);

  await ensureUserProfile(
    user
  );

  const profile =
    await getUserProfile();

  const displayName =
    profile?.displayName ||
    "";

  const accountType =
    profile?.accountType ||
    "buyer";

  const phone =
    user.phoneNumber ||
    profile?.phoneNumber ||
    "";

  const buyerButtons =
    (
      accountType ===
        "buyer" ||
      accountType ===
        "both"
    )
      ?
      `
        <button
          onclick="showMyPurchaseRequests()"
          style="
            width:100%;
            padding:15px;
            background:#28566f;
            color:white;
            border:0;
            border-radius:10px;
            margin-bottom:10px;
            font-size:17px;
            font-weight:bold;
          "
        >
          📋 طلباتي
        </button>
      `
      :
      "";

  const sellerButtons =
    (
      accountType ===
        "seller" ||
      accountType ===
        "both"
    )
      ?
      `
        <button
          onclick="showPurchaseRequests()"
          style="
            width:100%;
            padding:15px;
            background:#28566f;
            color:white;
            border:0;
            border-radius:10px;
            margin-bottom:10px;
            font-size:17px;
            font-weight:bold;
          "
        >
          📩 طلبات الشراء
        </button>
      `
      :
      "";

  let subscriptionHtml =
    "";

  if (
    accountType ===
      "seller" ||
    accountType ===
      "both"
  ) {

    const subscriptionActive =
      hasActiveSellerSubscription(
        profile
      );

    const subscriptionEnd =
      timestampToDate(
        profile
          ?.subscriptionEnd
      );

    if (
      subscriptionActive
    ) {

      subscriptionHtml = `

        <div style="
          background:#123c2c;
          color:#68e6b0;
          padding:14px;
          border-radius:10px;
          margin-bottom:15px;
          text-align:center;
          font-weight:bold;
        ">

          ✅ اشتراك البائع فعال

          ${
            subscriptionEnd
              ?
              `
                <br>

                <span style="
                  color:white;
                  font-size:14px;
                ">
                  ينتهي:
                  ${formatDate(
                    profile.subscriptionEnd
                  )}
                </span>
              `
              :
              ""
          }

        </div>
      `;

    } else {

      subscriptionHtml = `

        <div style="
          background:#421d1d;
          color:#ff8d8d;
          padding:14px;
          border-radius:10px;
          margin-bottom:15px;
          text-align:center;
          font-weight:bold;
        ">

          ⛔ اشتراك البائع غير فعال

          <br>

          <span style="
            color:white;
            font-size:14px;
          ">
            يجب تجديد الاشتراك حتى تتمكن من إضافة إعلان أو مزاد.
          </span>

        </div>
      `;
    }
  }

  showModal(`

    <div style="
      direction:rtl;
      color:white;
      padding:12px;
    ">

      <div style="
        text-align:center;
      ">

        <div style="
          font-size:55px;
        ">
          👤
        </div>

        <h2 style="
          color:#68e6b0;
        ">
          حسابي
        </h2>

      </div>

      <label>
        الاسم
      </label>

      <input
        id="profileName"
        type="text"
        maxlength="50"
        value="${escapeHtml(
          displayName
        )}"
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          margin:8px 0 16px;
          border-radius:10px;
        "
      >

      <label>
        رقم الهاتف
      </label>

      <input
        value="${escapeHtml(
          phone
        )}"
        disabled
        dir="ltr"
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          margin:8px 0 16px;
          border-radius:10px;
          text-align:left;
        "
      >

      <label>
        استخدام الحساب
      </label>

      <select
        id="profileAccountType"
        style="
          width:100%;
          padding:14px;
          margin:8px 0 18px;
        "
      >

        <option
          value="buyer"
          ${
            accountType ===
            "buyer"
              ?
              "selected"
              :
              ""
          }
        >
          مشتري
        </option>

        <option
          value="seller"
          ${
            accountType ===
            "seller"
              ?
              "selected"
              :
              ""
          }
        >
          بائع
        </option>

        <option
          value="both"
          ${
            accountType ===
            "both"
              ?
              "selected"
              :
              ""
          }
        >
          بائع ومشتري
        </option>

      </select>

      <p>
        نوع الحساب:

        <b style="
          color:#68e6b0;
        ">
          ${accountTypeText(
            accountType
          )}
        </b>
      </p>

      ${subscriptionHtml}

      <p id="profileStatus"></p>

      <button
        onclick="saveProfile()"
        style="
          width:100%;
          padding:15px;
          background:#00643e;
          color:white;
          border:0;
          border-radius:10px;
          margin-bottom:10px;
        "
      >
        💾 حفظ بيانات الحساب
      </button>

      ${buyerButtons}

      ${sellerButtons}

      <button
        onclick="logoutUser()"
        style="
          width:100%;
          padding:15px;
          background:#8b2929;
          color:white;
          border:0;
          border-radius:10px;
        "
      >
        تسجيل الخروج
      </button>

    </div>
  `);
}


window.saveProfile =
async function () {

  const user =
    auth.currentUser;

  if (
    !user
  ) {
    return;
  }

  const nameInput =
    document.getElementById(
      "profileName"
    );

  const typeInput =
    document.getElementById(
      "profileAccountType"
    );

  const status =
    document.getElementById(
      "profileStatus"
    );

  if (
    !nameInput ||
    !typeInput ||
    !status
  ) {
    return;
  }

  const displayName =
    nameInput.value
      .trim();

  const accountType =
    typeInput.value;

  if (
    displayName.length <
    2
  ) {

    status.innerHTML =
      "❌ أدخل الاسم.";

    return;
  }

  try {

    await setDoc(
      doc(
        db,
        "users",
        user.uid
      ),
      {
        displayName,

        accountType,

        phoneNumber:
          user.phoneNumber ||
          "",

        updatedAt:
          serverTimestamp()
      },
      {
        merge:
          true
      }
    );

    status.innerHTML =
      "✅ تم الحفظ";

    await loadMarket();

    setTimeout(
      () => {

        showAccount();

      },
      300
    );

  } catch (
    error
  ) {

    console.error(
      error
    );

    status.innerHTML =
      "❌ تعذر الحفظ";
  }
};


// =====================================
// طلباتي - للمشتري
// =====================================

window.showMyPurchaseRequests =
async function () {

  const user =
    auth.currentUser;

  if (
    !user
  ) {

    window.openLogin();

    return;
  }

  showModal(`

    <div style="
      direction:rtl;
      color:white;
      padding:12px;
      text-align:center;
    ">

      <h2 style="
        color:#68e6b0;
      ">
        📋 طلباتي
      </h2>

      <p style="
        color:#aaa;
      ">
        جاري تحميل طلباتك...
      </p>

    </div>
  `);

  try {

    const requestsQuery =
      query(
        collection(
          db,
          "purchaseRequests"
        ),
        where(
          "buyerId",
          "==",
          user.uid
        )
      );

    const snapshot =
      await getDocs(
        requestsQuery
      );

    const requests =
      [];

    snapshot.forEach(
      requestDoc => {

        requests.push({
          id:
            requestDoc.id,

          ...requestDoc.data()
        });
      }
    );

    requests.sort(
      (
        a,
        b
      ) =>

        timestampToMillis(
          b.createdAt
        ) -

        timestampToMillis(
          a.createdAt
        )
    );

    if (
      requests.length ===
      0
    ) {

      showModal(`

        <div style="
          direction:rtl;
          color:white;
          padding:15px;
          text-align:center;
        ">

          <h2 style="
            color:#68e6b0;
          ">
            📋 طلباتي
          </h2>

          <div style="
            background:#222;
            padding:22px;
            border-radius:14px;
            margin:20px 0;
          ">
            لم ترسل أي طلب شراء حتى الآن.
          </div>

          <button
            onclick="openLogin()"
            style="
              width:100%;
              padding:14px;
              background:#28566f;
              color:white;
              border:0;
              border-radius:10px;
            "
          >
            الرجوع إلى حسابي
          </button>

        </div>
      `);

      return;
    }

    const cards =
      requests
        .map(
          request => {

            let statusText =
              "⏳ بانتظار رد البائع";

            let statusColor =
              "#ffd66b";

            let statusBackground =
              "#302a16";

            let acceptedDetails =
              "";

            if (
              request.status ===
              "accepted"
            ) {

              statusText =
                "✅ وافق البائع على طلبك";

              statusColor =
                "#68e6b0";

              statusBackground =
                "#123c2c";

              acceptedDetails = `

                <div style="
                  background:#10271c;
                  padding:15px;
                  border-radius:10px;
                  margin-top:15px;
                ">

                  <div style="
                    color:#68e6b0;
                    font-weight:bold;
                    margin-bottom:10px;
                  ">
                    🎉 تم قبول طلب الشراء
                  </div>

                  ${
                    request.sellerName
                      ?
                      `
                        <p>
                          👤 البائع:

                          <b>
                            ${escapeHtml(
                              request.sellerName
                            )}
                          </b>
                        </p>
                      `
                      :
                      ""
                  }

                  ${
                    request.sellerPhone
                      ?
                      `
                        <p>
                          📱 رقم البائع:

                          <b dir="ltr">
                            ${escapeHtml(
                              request.sellerPhone
                            )}
                          </b>
                        </p>
                      `
                      :
                      ""
                  }

                  <p style="
                    color:#aaa;
                    font-size:14px;
                  ">
                    يمكنك التواصل مع البائع لإكمال إجراءات البيع والاستلام والدفع شخصياً.
                  </p>

                </div>
              `;
            }

            if (
              request.status ===
              "rejected"
            ) {

              statusText =
                "❌ لم يوافق البائع على الطلب";

              statusColor =
                "#ff8d8d";

              statusBackground =
                "#421d1d";
            }

            return `

              <div style="
                background:#222;
                padding:18px;
                border-radius:15px;
                margin-bottom:15px;
                text-align:right;
              ">

                <h3 style="
                  color:#68e6b0;
                  margin-top:0;
                  font-size:22px;
                ">

                  ${animalIcon(
                    request.animalType ||
                    ""
                  )}

                  ${escapeHtml(
                    request.animalType ||
                    "حلال"
                  )}

                </h3>

                ${
                  request.animalBreed
                    ?
                    `
                      <p>
                        السلالة:

                        <b>
                          ${escapeHtml(
                            request.animalBreed
                          )}
                        </b>
                      </p>
                    `
                    :
                    ""
                }

                <p>
                  💰 السعر:

                  <b>
                    ${money(
                      request.price
                    )}
                  </b>
                </p>

                ${
                  request.sellerName
                    ?
                    `
                      <p>
                        👤 البائع:

                        <b>
                          ${escapeHtml(
                            request.sellerName
                          )}
                        </b>
                      </p>
                    `
                    :
                    ""
                }

                <p>
                  🕒 تاريخ إرسال الطلب:

                  <b>
                    ${formatDate(
                      request.createdAt
                    )}
                  </b>
                </p>

                <div style="
                  background:${statusBackground};
                  color:${statusColor};
                  padding:14px;
                  border-radius:10px;
                  font-size:18px;
                  font-weight:bold;
                  text-align:center;
                  margin-top:14px;
                ">
                  ${statusText}
                </div>

                ${acceptedDetails}

              </div>
            `;
          }
        )
        .join("");

    showModal(`

      <div style="
        direction:rtl;
        color:white;
        padding:12px;
      ">

        <h2 style="
          color:#68e6b0;
          text-align:center;
        ">
          📋 طلباتي
        </h2>

        <p style="
          color:#aaa;
          text-align:center;
          margin-bottom:20px;
        ">
          متابعة طلبات الشراء التي أرسلتها
        </p>

        ${cards}

        <button
          onclick="openLogin()"
          style="
            width:100%;
            padding:14px;
            background:#28566f;
            color:white;
            border:0;
            border-radius:10px;
            margin-top:10px;
          "
        >
          الرجوع إلى حسابي
        </button>

        <div style="
          height:30px;
        "></div>

      </div>
    `);

  } catch (
    error
  ) {

    console.error(
      "LOAD MY PURCHASE REQUESTS ERROR:",
      error
    );

    alert(
      "❌ تعذر تحميل طلباتك."
    );
  }
};


// =====================================
// طلبات الشراء للبائع
// =====================================

window.showPurchaseRequests =
async function () {

  const user =
    auth.currentUser;

  if (
    !user
  ) {

    window.openLogin();

    return;
  }

  showModal(`

    <div style="
      direction:rtl;
      color:white;
      padding:12px;
      text-align:center;
    ">

      <h2 style="
        color:#68e6b0;
      ">
        📩 طلبات الشراء
      </h2>

      <p style="
        color:#aaa;
      ">
        جاري تحميل الطلبات...
      </p>

    </div>
  `);

  try {

    const requestsQuery =
      query(
        collection(
          db,
          "purchaseRequests"
        ),
        where(
          "sellerId",
          "==",
          user.uid
        )
      );

    const snapshot =
      await getDocs(
        requestsQuery
      );

    const requests =
      [];

    snapshot.forEach(
      requestDoc => {

        requests.push({
          id:
            requestDoc.id,

          ...requestDoc.data()
        });
      }
    );

    requests.sort(
      (
        a,
        b
      ) =>

        timestampToMillis(
          b.createdAt
        ) -

        timestampToMillis(
          a.createdAt
        )
    );

    if (
      requests.length ===
      0
    ) {

      showModal(`

        <div style="
          direction:rtl;
          color:white;
          padding:15px;
          text-align:center;
        ">

          <h2 style="
            color:#68e6b0;
          ">
            📩 طلبات الشراء
          </h2>

          <div style="
            background:#222;
            padding:22px;
            border-radius:14px;
            margin:20px 0;
          ">
            لا توجد طلبات شراء حالياً.
          </div>

        </div>
      `);

      return;
    }

    const cards =
      requests
        .map(
          request => {

            let statusText =
              "⏳ بانتظار الرد";

            let statusColor =
              "#ffd66b";

            if (
              request.status ===
              "accepted"
            ) {

              statusText =
                "✅ تم القبول";

              statusColor =
                "#68e6b0";
            }

            if (
              request.status ===
              "rejected"
            ) {

              statusText =
                "❌ تم الرفض";

              statusColor =
                "#ff8d8d";
            }

            const actionButtons =
              request.status ===
              "pending"
                ?
                `

                  <button
                    onclick="updatePurchaseRequest('${request.id}','accepted')"
                    style="
                      width:100%;
                      padding:13px;
                      margin-top:10px;
                      background:#00643e;
                      color:white;
                      border:0;
                      border-radius:9px;
                    "
                  >
                    ✅ قبول طلب الشراء
                  </button>

                  <button
                    onclick="updatePurchaseRequest('${request.id}','rejected')"
                    style="
                      width:100%;
                      padding:13px;
                      margin-top:8px;
                      background:#8b2929;
                      color:white;
                      border:0;
                      border-radius:9px;
                    "
                  >
                    ❌ رفض الطلب
                  </button>

                `
                :
                "";

            return `

              <div style="
                background:#222;
                padding:18px;
                border-radius:15px;
                margin-bottom:15px;
                text-align:right;
              ">

                <h3 style="
                  color:#68e6b0;
                  margin-top:0;
                ">
                  ${escapeHtml(
                    request.animalType ||
                    "حلال"
                  )}
                </h3>

                ${
                  request.animalBreed
                    ?
                    `
                      <p>
                        السلالة:
                        <b>
                          ${escapeHtml(
                            request.animalBreed
                          )}
                        </b>
                      </p>
                    `
                    :
                    ""
                }

                <p>
                  💰 السعر:

                  <b>
                    ${money(
                      request.price
                    )}
                  </b>
                </p>

                <p>
                  👤 المشتري:

                  <b>
                    ${escapeHtml(
                      request.buyerName ||
                      "مستخدم"
                    )}
                  </b>
                </p>

                <p>
                  📱 رقم المشتري:

                  <b dir="ltr">
                    ${escapeHtml(
                      request.buyerPhone ||
                      "غير متوفر"
                    )}
                  </b>
                </p>

                <p>
                  🕒 تاريخ الطلب:

                  <b>
                    ${formatDate(
                      request.createdAt
                    )}
                  </b>
                </p>

                <div style="
                  color:${statusColor};
                  font-size:18px;
                  font-weight:bold;
                  margin-top:12px;
                ">
                  ${statusText}
                </div>

                ${actionButtons}

              </div>
            `;
          }
        )
        .join("");

    showModal(`

      <div style="
        direction:rtl;
        color:white;
        padding:12px;
      ">

        <h2 style="
          color:#68e6b0;
          text-align:center;
        ">
          📩 طلبات الشراء
        </h2>

        ${cards}

      </div>
    `);

  } catch (
    error
  ) {

    console.error(
      "LOAD PURCHASE REQUESTS ERROR:",
      error
    );

    alert(
      "❌ تعذر تحميل طلبات الشراء."
    );
  }
};


// =====================================
// قبول أو رفض طلب شراء
// =====================================

window.updatePurchaseRequest =
async function (
  requestId,
  newStatus
) {

  const user =
    auth.currentUser;

  if (
    !user
  ) {
    return;
  }

  if (
    ![
      "accepted",
      "rejected"
    ].includes(
      newStatus
    )
  ) {

    return;
  }

  try {

    const requestRef =
      doc(
        db,
        "purchaseRequests",
        requestId
      );

    const requestSnap =
      await getDoc(
        requestRef
      );

    if (
      !requestSnap.exists()
    ) {

      alert(
        "طلب الشراء غير موجود."
      );

      return;
    }

    const requestData =
      requestSnap.data();

    if (
      requestData.sellerId !==
      user.uid
    ) {

      alert(
        "غير مصرح لك بتعديل هذا الطلب."
      );

      return;
    }

    if (
      requestData.status !==
      "pending"
    ) {

      alert(
        "تم التعامل مع هذا الطلب مسبقاً."
      );

      await window
        .showPurchaseRequests();

      return;
    }

    await setDoc(
      requestRef,
      {
        status:
          newStatus,

        updatedAt:
          serverTimestamp()
      },
      {
        merge:
          true
      }
    );

    if (
      newStatus ===
      "accepted"
    ) {

      alert(
        "✅ تم قبول طلب الشراء."
      );

    } else {

      alert(
        "❌ تم رفض طلب الشراء."
      );
    }

    await window
      .showPurchaseRequests();

  } catch (
    error
  ) {

    console.error(
      "UPDATE PURCHASE REQUEST ERROR:",
      error
    );

    if (
      error.code ===
      "permission-denied"
    ) {

      alert(
        "❌ Firebase رفض تحديث الطلب."
      );

      return;
    }

    alert(
      "❌ تعذر تحديث طلب الشراء."
    );
  }
};


// =====================================
// تسجيل الدخول
// =====================================

window.openLogin =
async function () {

  if (
    auth.currentUser
  ) {

    await showAccount();

    return;
  }

  showModal(`

    <div style="
      direction:rtl;
      color:white;
      padding:10px;
    ">

      <h2 style="
        text-align:center;
        color:#68e6b0;
      ">
        تسجيل الدخول
      </h2>

      <p style="
        text-align:center;
        color:#aaa;
      ">
        أدخل رقم هاتفك الإماراتي
      </p>

      <input
        id="phoneNumber"
        type="tel"
        value="+971"
        placeholder="+971501234567"
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          margin:10px 0;
        "
      >

      <div
        id="recaptcha-container"
      ></div>

      <button
        onclick="sendPhoneCode()"
        style="
          width:100%;
          padding:15px;
          background:#00643e;
          color:white;
          border:0;
          border-radius:10px;
        "
      >
        إرسال رمز التحقق
      </button>

      <p id="loginStatus"></p>

    </div>
  `);
};


window.sendPhoneCode =
async function () {

  const input =
    document.getElementById(
      "phoneNumber"
    );

  const status =
    document.getElementById(
      "loginStatus"
    );

  if (
    !input ||
    !status
  ) {
    return;
  }

  let phone =
    input.value
      .replace(
        /\s+/g,
        ""
      )
      .replace(
        /-/g,
        ""
      );

  if (
    phone.startsWith(
      "05"
    )
  ) {

    phone =
      "+971" +
      phone.substring(
        1
      );
  }

  if (
    phone.startsWith(
      "971"
    )
  ) {

    phone =
      "+" +
      phone;
  }

  if (
    !phone.startsWith(
      "+9715"
    )
  ) {

    status.innerHTML =
      "❌ رقم الهاتف غير صحيح.";

    return;
  }

  try {

    status.innerHTML =
      "جاري إرسال رمز التحقق...";

    if (
      recaptchaVerifier
    ) {

      try {

        recaptchaVerifier
          .clear();

      } catch (
        e
      ) {}

      recaptchaVerifier =
        null;
    }

    recaptchaVerifier =
      new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size:
            "invisible"
        }
      );

    confirmationResult =
      await signInWithPhoneNumber(
        auth,
        phone,
        recaptchaVerifier
      );

    showCodeScreen(
      phone
    );

  } catch (
    error
  ) {

    console.error(
      "SEND PHONE CODE ERROR:",
      error
    );

    status.innerHTML =
      "❌ تعذر إرسال رمز التحقق.<br><br>" +
      "رمز الخطأ: " +
      escapeHtml(
        error.code ||
        "غير معروف"
      ) +
      "<br><br>" +
      "التفاصيل: " +
      escapeHtml(
        error.message ||
        ""
      );
  }
};


function showCodeScreen(
  phone
) {

  showModal(`

    <div style="
      direction:rtl;
      color:white;
      padding:10px;
    ">

      <h2 style="
        color:#68e6b0;
        text-align:center;
      ">
        رمز التحقق
      </h2>

      <p style="
        text-align:center;
      ">
        تم إرسال الرمز إلى
      </p>

      <p
        dir="ltr"
        style="
          text-align:center;
          color:#68e6b0;
          font-weight:bold;
        "
      >
        ${escapeHtml(
          phone
        )}
      </p>

      <input
        id="verificationCode"
        maxlength="6"
        inputmode="numeric"
        placeholder="أدخل الرمز"
        style="
          width:100%;
          box-sizing:border-box;
          padding:15px;
          margin-bottom:10px;
          text-align:center;
        "
      >

      <button
        onclick="verifyPhoneCode()"
        style="
          width:100%;
          padding:15px;
          background:#00643e;
          color:white;
          border:0;
          border-radius:10px;
        "
      >
        تأكيد الرمز
      </button>

      <p id="verifyStatus"></p>

    </div>
  `);
}


window.verifyPhoneCode =
async function () {

  const code =
    document.getElementById(
      "verificationCode"
    );

  const status =
    document.getElementById(
      "verifyStatus"
    );

  if (
    !code ||
    !status ||
    !confirmationResult
  ) {

    return;
  }

  try {

    const result =
      await confirmationResult
        .confirm(
          code.value
            .trim()
        );

    await ensureUserProfile(
      result.user
    );

    await showAccount();

  } catch (
    error
  ) {

    console.error(
      error
    );

    status.innerHTML =
      "❌ رمز التحقق غير صحيح.";
  }
};


window.logoutUser =
async function () {

  await signOut(
    auth
  );

  window.closeModal();

  await loadMarket();
};


// =====================================
// متابعة تسجيل الدخول
// =====================================

onAuthStateChanged(
  auth,
  async user => {

    const loginButton =
      document.querySelector(
        ".login"
      );

    if (
      user
    ) {

      await ensureUserProfile(
        user
      );

      if (
        loginButton
      ) {

        loginButton.textContent =
          "✅ حسابي";
      }

    } else {

      if (
        loginButton
      ) {

        loginButton.textContent =
          "تسجيل الدخول";
      }
    }

    await loadMarket();
  }
);


// =====================================
// إنشاء قسم السوق
// =====================================

function createFirebaseArea() {

  let area =
    document.getElementById(
      "firebase-market"
    );

  if (
    area
  ) {
    return area;
  }

  area =
    document.createElement(
      "section"
    );

  area.id =
    "firebase-market";

  area.innerHTML = `

    <div style="
      max-width:1100px;
      margin:35px auto;
      padding:20px;
      direction:rtl;
    ">

      <h2 style="
        text-align:center;
        color:#68e6b0;
        margin-bottom:7px;
      ">
        🐪 سوق الحلال
      </h2>

      <p style="
        text-align:center;
        color:#aaa;
        margin-top:0;
      ">
        ابحث عن الحلال حسب الإمارة والمنطقة
      </p>


      <!-- ===================================== -->
      <!-- فلترة السوق -->
      <!-- ===================================== -->

      <div
        id="market-filters"
        style="
          background:#1d2521;
          border:1px solid #35443d;
          border-radius:16px;
          padding:16px;
          margin:22px 0 25px;
          display:grid;
          grid-template-columns:
            repeat(auto-fit,minmax(150px,1fr));
          gap:10px;
        "
      >

        <select
          id="marketEmirateFilter"
          onchange="updateMarketCityFilter()"
          style="
            width:100%;
            padding:13px;
            border-radius:10px;
            border:1px solid #45564e;
          "
        >

          <option value="all">
            📍 جميع الإمارات
          </option>

          <option value="الشارقة">
            الشارقة
          </option>

          <option value="دبي">
            دبي
          </option>

          <option value="أبوظبي">
            أبوظبي
          </option>

          <option value="عجمان">
            عجمان
          </option>

          <option value="رأس الخيمة">
            رأس الخيمة
          </option>

          <option value="أم القيوين">
            أم القيوين
          </option>

          <option value="الفجيرة">
            الفجيرة
          </option>

        </select>


        <select
          id="marketCityFilter"
          onchange="applyMarketFilters()"
          style="
            width:100%;
            padding:13px;
            border-radius:10px;
            border:1px solid #45564e;
          "
        >

          <option value="all">
            جميع المدن والمناطق
          </option>

        </select>


        <select
          id="marketAnimalFilter"
          onchange="applyMarketFilters()"
          style="
            width:100%;
            padding:13px;
            border-radius:10px;
            border:1px solid #45564e;
          "
        >

          <option value="all">
            🐾 جميع أنواع الحلال
          </option>

          <option value="ناقة">
            🐫 ناقة
          </option>

          <option value="غنم">
            🐑 غنم
          </option>

          <option value="ماعز">
            🐐 ماعز
          </option>

          <option value="بقر">
            🐄 بقر
          </option>

          <option value="دجاج">
            🐔 دجاج
          </option>

          <option value="صقور">
            🦅 صقور
          </option>

          <option value="غزال">
            🦌 غزال
          </option>

          <option value="نعام">
            🐦 نعام
          </option>

          <option value="حمام">
            🕊️ حمام
          </option>

        </select>


        <select
          id="marketSaleTypeFilter"
          onchange="applyMarketFilters()"
          style="
            width:100%;
            padding:13px;
            border-radius:10px;
            border:1px solid #45564e;
          "
        >

          <option value="all">
            جميع طرق البيع
          </option>

          <option value="direct">
            🛒 بيع مباشر
          </option>

          <option value="auction">
            🔨 مزاد إلكتروني
          </option>

        </select>


        <button
          onclick="resetMarketFilters()"
          style="
            width:100%;
            background:#5c635f;
            color:white;
            border:0;
            padding:13px;
            border-radius:10px;
          "
        >
          🔄 إظهار الكل
        </button>

      </div>


      <p
        id="firebase-status"
        style="
          text-align:center;
          color:#aaa;
        "
      ></p>


      <h2 style="
        margin-top:40px;
        color:#68e6b0;
      ">
        🛒 البيع المباشر
      </h2>

      <div
        id="direct-sales"
        style="
          display:grid;
          grid-template-columns:
          repeat(auto-fit,minmax(250px,1fr));
          gap:20px;
        "
      ></div>


      <h2 style="
        margin-top:50px;
        color:#68e6b0;
      ">
        🔨 المزاد الإلكتروني
      </h2>

      <div
        id="auction-list"
        style="
          display:grid;
          grid-template-columns:
          repeat(auto-fit,minmax(250px,1fr));
          gap:20px;
        "
      ></div>

    </div>
  `;

  (
    document.querySelector(
      "main"
    ) ||
    document.body
  ).appendChild(
    area
  );

  return area;
}


// =====================================
// واجهة حالة المزاد
// =====================================

function auctionActionHtml(
  auction,
  expired,
  isOwner
) {

  const user =
    auth.currentUser;

  const hasBid =
    !!auction
      .lastBidderId;

  const isHighestBidder =
    !!user &&
    auction.lastBidderId ===
      user.uid;

  if (
    auction.status ===
    "sold"
  ) {

    if (
      isOwner
    ) {

      return `

        <div style="
          background:#123c2c;
          color:#68e6b0;
          padding:16px;
          border-radius:12px;
          text-align:center;
          margin-top:15px;
        ">

          <div style="
            font-size:20px;
            font-weight:bold;
          ">
            ✅ تم اعتماد البيع
          </div>

          <p>
            السعر النهائي:

            <b>
              ${money(
                auction.currentPrice
              )}
            </b>
          </p>

          ${
            auction.lastBidderPhone
              ?
              `
                <p>
                  📱 رقم الفائز:

                  <b dir="ltr">
                    ${escapeHtml(
                      auction.lastBidderPhone
                    )}
                  </b>
                </p>
              `
              :
              ""
          }

          <p style="
            color:white;
            font-size:14px;
          ">
            يتم التواصل مع الفائز لإتمام المعاينة والاستلام والدفع شخصياً.
          </p>

        </div>
      `;
    }

    if (
      isHighestBidder
    ) {

      return `

        <div style="
          background:#123c2c;
          color:#68e6b0;
          padding:16px;
          border-radius:12px;
          text-align:center;
          margin-top:15px;
        ">

          <div style="
            font-size:21px;
            font-weight:bold;
          ">
            🎉 مبروك، فزت بالمزاد
          </div>

          <p style="
            color:white;
          ">
            اعتمد البائع أعلى مزايدة.
          </p>

          <p>
            السعر النهائي:

            <b>
              ${money(
                auction.currentPrice
              )}
            </b>
          </p>

          ${
            auction.sellerName
              ?
              `
                <p>
                  👤 البائع:

                  <b>
                    ${escapeHtml(
                      auction.sellerName
                    )}
                  </b>
                </p>
              `
              :
              ""
          }

          ${
            auction.sellerPhone
              ?
              `
                <p>
                  📱 رقم البائع:

                  <b dir="ltr">
                    ${escapeHtml(
                      auction.sellerPhone
                    )}
                  </b>
                </p>
              `
              :
              ""
          }

          <p style="
            color:white;
            font-size:14px;
          ">
            تواصل مع البائع لإتمام المعاينة والاستلام والدفع شخصياً.
          </p>

        </div>
      `;
    }

    return `

      <div style="
        background:#123c2c;
        color:#68e6b0;
        padding:15px;
        border-radius:10px;
        text-align:center;
        margin-top:15px;
        font-weight:bold;
      ">

        ✅ انتهى المزاد وتم اعتماد البيع

        <br>

        السعر النهائي:

        ${money(
          auction.currentPrice
        )}

      </div>
    `;
  }


  if (
    auction.status ===
    "not_approved"
  ) {

    return `

      <div style="
        background:#421d1d;
        color:#ff8d8d;
        padding:15px;
        border-radius:10px;
        text-align:center;
        margin-top:15px;
        font-weight:bold;
      ">
        ❌ انتهى المزاد ولم يعتمد البائع البيع
      </div>
    `;
  }


  if (
    !expired
  ) {

    if (
      isOwner
    ) {

      return `

        <div style="
          width:100%;
          box-sizing:border-box;
          background:#302a16;
          color:#ffd66b;
          padding:14px;
          border-radius:10px;
          text-align:center;
          font-weight:bold;
        ">
          🔒 هذا مزادك — لا يمكنك المزايدة عليه
        </div>
      `;
    }

    return `

      <button
        id="bid-button-${auction.id}"
        onclick="placeBid('${auction.id}')"
        style="
          width:100%;
          background:#984d00;
          color:white;
          border:0;
          padding:16px;
          border-radius:10px;
        "
      >
        زايد الآن
      </button>
    `;
  }


  if (
    !hasBid
  ) {

    return `

      <div style="
        background:#333;
        color:#ddd;
        padding:15px;
        border-radius:10px;
        text-align:center;
        font-weight:bold;
      ">
        ⛔ انتهى المزاد بدون مزايدات
      </div>
    `;
  }


  if (
    isOwner
  ) {

    return `

      <div style="
        background:#302a16;
        color:#ffd66b;
        padding:16px;
        border-radius:12px;
        text-align:center;
        margin-bottom:10px;
      ">

        <div style="
          font-size:19px;
          font-weight:bold;
        ">
          🏆 أعلى مزايدة
        </div>

        <div style="
          color:#68e6b0;
          font-size:25px;
          font-weight:bold;
          margin:10px 0;
        ">
          ${money(
            auction.currentPrice
          )}
        </div>

        <div>
          ⏳ المزاد انتهى — بانتظار قرارك
        </div>

      </div>

      <button
        onclick="finalizeAuction('${auction.id}','accept')"
        style="
          width:100%;
          background:#00643e;
          color:white;
          border:0;
          padding:16px;
          border-radius:10px;
          margin-bottom:10px;
          font-size:17px;
          font-weight:bold;
        "
      >
        ✅ اعتماد البيع لأعلى مزايد
      </button>

      <button
        onclick="finalizeAuction('${auction.id}','reject')"
        style="
          width:100%;
          background:#8b2929;
          color:white;
          border:0;
          padding:16px;
          border-radius:10px;
          font-size:17px;
          font-weight:bold;
        "
      >
        ❌ عدم اعتماد البيع
      </button>
    `;
  }


  if (
    isHighestBidder
  ) {

    return `

      <div style="
        background:#302a16;
        color:#ffd66b;
        padding:16px;
        border-radius:12px;
        text-align:center;
        font-weight:bold;
      ">

        🏆 أنت صاحب أعلى مزايدة

        <div style="
          color:#68e6b0;
          font-size:24px;
          margin:10px 0;
        ">
          ${money(
            auction.currentPrice
          )}
        </div>

        ⏳ بانتظار اعتماد البائع للنتيجة

      </div>
    `;
  }

  return `

    <div style="
      background:#302a16;
      color:#ffd66b;
      padding:16px;
      border-radius:12px;
      text-align:center;
      font-weight:bold;
    ">

      ⏳ انتهى المزاد

      <br><br>

      أعلى مزايدة:

      <span style="
        color:#68e6b0;
      ">
        ${money(
          auction.currentPrice
        )}
      </span>

      <br><br>

      بانتظار اعتماد البائع

    </div>
  `;
}


// =====================================
// تحميل السوق
// =====================================

async function loadMarket() {

  createFirebaseArea();

  const status =
    document.getElementById(
      "firebase-status"
    );

  const directContainer =
    document.getElementById(
      "direct-sales"
    );

  const auctionContainer =
    document.getElementById(
      "auction-list"
    );

  if (
    !status ||
    !directContainer ||
    !auctionContainer
  ) {

    return;
  }

  status.innerHTML =
    "جاري تحديث السوق...";

  try {

    const animalSnapshot =
      await getDocs(
        collection(
          db,
          "animals"
        )
      );

    const animals =
      {};

    animalSnapshot.forEach(
      animalDoc => {

        animals[
          animalDoc.id
        ] = {
          id:
            animalDoc.id,

          ...animalDoc.data()
        };
      }
    );


    // =====================================
    // البيع المباشر + الفلترة
    // =====================================

    const directAnimals =
      Object.values(
        animals
      )
        .filter(
          animal =>
            animal.saleType ===
              "direct" &&
            (
              !animal.status ||
              animal.status ===
                "active"
            )
        )
        .filter(
          animal =>
            animalMatchesMarketFilters(
              animal,
              "direct"
            )
        );


    if (
      directAnimals.length ===
      0
    ) {

      directContainer.innerHTML = `

        <div style="
          background:#222;
          color:white;
          padding:20px;
          border-radius:15px;
          text-align:center;
        ">
          لا توجد عروض بيع مباشر مطابقة للبحث
        </div>
      `;

    } else {

      directContainer.innerHTML =
        directAnimals
          .map(
            animal => `

              <div style="
                background:#222;
                color:white;
                padding:20px;
                border-radius:18px;
              ">

                ${animalPhotoHtml(
                  animal
                )}

                <h3>
                  ${escapeHtml(
                    animal.name ||
                    animal.type ||
                    "حلال للبيع"
                  )}
                </h3>

                ${
                  animal.breed
                    ?
                    `
                      <p>
                        السلالة:
                        ${escapeHtml(
                          animal.breed
                        )}
                      </p>
                    `
                    :
                    ""
                }

                ${
                  animal.age
                    ?
                    `
                      <p>
                        العمر:
                        ${escapeHtml(
                          animal.age
                        )}
                      </p>
                    `
                    :
                    ""
                }

                <p>
                  📍
                  ${escapeHtml(
                    animal.location ||
                    "غير محدد"
                  )}
                </p>

                <div style="
                  font-size:25px;
                  color:#68e6b0;
                  font-weight:bold;
                  margin:15px 0;
                ">
                  ${money(
                    animal.price
                  )}
                </div>

                <button
                  onclick="requestPurchase('${animal.id}')"
                  style="
                    width:100%;
                    background:#00643e;
                    color:white;
                    border:0;
                    padding:14px;
                    border-radius:10px;
                  "
                >
                  طلب شراء
                </button>

                ${ownerManagementButton(
                  animal
                )}

              </div>
            `
          )
          .join("");
    }


    // =====================================
    // المزادات
    // =====================================

    const auctionSnapshot =
      await getDocs(
        collection(
          db,
          "auctions"
        )
      );

    const auctions =
      [];

    auctionSnapshot.forEach(
      auctionDoc => {

        auctions.push({
          id:
            auctionDoc.id,

          ...auctionDoc.data()
        });
      }
    );


    // =====================================
    // إبقاء المزاد المباع 24 ساعة
    // =====================================

    const AUCTION_RESULT_VISIBLE_TIME =
      24 *
      60 *
      60 *
      1000;


    const visibleAuctions =
      auctions
        .filter(
          auction => {

            if (
              auction.status ===
              "active"
            ) {

              return true;
            }

            if (
              auction.status ===
              "not_approved"
            ) {

              return true;
            }

            if (
              auction.status ===
              "sold"
            ) {

              const approvedAt =
                timestampToMillis(
                  auction.updatedAt
                );

              if (
                !approvedAt
              ) {

                return true;
              }

              const elapsed =
                Date.now() -
                approvedAt;

              return (
                elapsed <
                AUCTION_RESULT_VISIBLE_TIME
              );
            }

            return false;
          }
        )
        .filter(
          auction => {

            const animal =
              animals[
                auction.animalId
              ];

            if (
              !animal
            ) {

              return false;
            }

            return animalMatchesMarketFilters(
              animal,
              "auction"
            );
          }
        );


    if (
      visibleAuctions.length ===
      0
    ) {

      auctionContainer.innerHTML = `

        <div style="
          background:#222;
          color:white;
          padding:20px;
          border-radius:15px;
          text-align:center;
        ">
          لا توجد مزادات مطابقة للبحث
        </div>
      `;

    } else {

      auctionContainer.innerHTML =
        visibleAuctions
          .map(
            auction => {

              const animal =
                animals[
                  auction.animalId
                ] ||
                {};

              const currentPrice =
                Number(
                  auction.currentPrice ||
                  auction.startPrice ||
                  0
                );

              const increment =
                Number(
                  auction.minIncrement ||
                  0
                );

              const minimumNextBid =
                currentPrice +
                increment;

              const endMillis =
                timestampToMillis(
                  auction.endTime
                );

              const expired =
                auction.status !==
                  "active" ||
                !endMillis ||
                endMillis <=
                  Date.now();

              const isOwner =
                !!auth.currentUser &&
                auction.sellerId ===
                  auth.currentUser.uid;

              let tagText =
                "مزاد نشط";

              let tagColor =
                "#00643e";

              if (
                auction.status ===
                "sold"
              ) {

                tagText =
                  "تم اعتماد البيع";

                tagColor =
                  "#00643e";

              } else if (
                auction.status ===
                "not_approved"
              ) {

                tagText =
                  "لم يعتمد البيع";

                tagColor =
                  "#6d2929";

              } else if (
                expired
              ) {

                tagText =
                  "مزاد منتهي";

                tagColor =
                  "#6d2929";
              }

              return `

                <div style="
                  background:#222;
                  color:white;
                  padding:20px;
                  border-radius:18px;
                ">

                  ${animalPhotoHtml(
                    animal
                  )}

                  <div
                    id="auction-tag-${auction.id}"
                    style="
                      display:inline-block;
                      background:${tagColor};
                      padding:6px 12px;
                      border-radius:20px;
                      margin-top:12px;
                    "
                  >
                    ${tagText}
                  </div>

                  <h3>
                    ${escapeHtml(
                      animal.name ||
                      animal.type ||
                      "مزاد حلال"
                    )}
                  </h3>

                  ${
                    animal.breed
                      ?
                      `
                        <p>
                          السلالة:
                          ${escapeHtml(
                            animal.breed
                          )}
                        </p>
                      `
                      :
                      ""
                  }

                  ${
                    animal.age
                      ?
                      `
                        <p>
                          العمر:
                          ${escapeHtml(
                            animal.age
                          )}
                        </p>
                      `
                      :
                      ""
                  }

                  <p>
                    📍
                    ${escapeHtml(
                      animal.location ||
                      "غير محدد"
                    )}
                  </p>

                  <p>
                    سعر البداية:

                    <b>
                      ${money(
                        auction.startPrice
                      )}
                    </b>
                  </p>

                  <p>
                    أقل زيادة:

                    <b>
                      ${money(
                        increment
                      )}
                    </b>
                  </p>

                  <div style="
                    font-size:27px;
                    color:#68e6b0;
                    font-weight:bold;
                    margin:15px 0;
                  ">

                    السعر الحالي:

                    <br>

                    ${money(
                      currentPrice
                    )}

                  </div>

                  ${
                    auction.status ===
                      "active" &&
                    !expired
                      ?
                      `
                        <p>
                          الحد الأدنى للمزايدة القادمة:

                          <b>
                            ${money(
                              minimumNextBid
                            )}
                          </b>
                        </p>
                      `
                      :
                      ""
                  }

                  ${
                    auction.status ===
                    "active"
                      ?
                      `
                        <div
                          data-auction-end="${endMillis}"
                          data-auction-id="${auction.id}"
                          style="
                            color:#ffd66b;
                            font-size:20px;
                            font-weight:bold;
                            text-align:center;
                            margin:18px 0;
                          "
                        >

                          ${
                            expired
                              ?
                              "⛔ انتهى المزاد"
                              :
                              "⏱ " +
                              getCountdownText(
                                auction.endTime
                              )
                          }

                        </div>
                      `
                      :
                      `
                        <div style="
                          text-align:center;
                          color:#aaa;
                          margin:18px 0;
                        ">
                          ⛔ انتهى المزاد
                        </div>
                      `
                  }

                  <p style="
                    color:#aaa;
                    text-align:center;
                  ">

                    موعد الانتهاء:

                    ${formatDate(
                      auction.endTime
                    )}

                  </p>

                  ${auctionActionHtml(
                    auction,
                    expired,
                    isOwner
                  )}

                  ${
                    isOwner
                      ?
                      ownerManagementButton(
                        animal
                      )
                      :
                      ""
                  }

                </div>
              `;
            }
          )
          .join("");
    }


    // =====================================
    // عدد النتائج
    // =====================================

    const totalResults =
      directAnimals.length +
      visibleAuctions.length;

    status.innerHTML =
      "✅ متصل بالسوق • " +
      totalResults +
      " نتيجة";


    startAuctionTimers();

  } catch (
    error
  ) {

    console.error(
      "LOAD MARKET ERROR:",
      error
    );

    status.innerHTML =
      "❌ حدث خطأ أثناء تحميل السوق";
  }
}


// =====================================
// إدارة الإعلان
// =====================================

window.manageListing =
async function (
  animalId
) {

  const user =
    auth.currentUser;

  if (
    !user
  ) {

    window.openLogin();

    return;
  }

  try {

    const animalRef =
      doc(
        db,
        "animals",
        animalId
      );

    const animalSnap =
      await getDoc(
        animalRef
      );

    if (
      !animalSnap.exists()
    ) {

      alert(
        "لم يتم العثور على الإعلان."
      );

      return;
    }

    const animal = {
      id:
        animalSnap.id,

      ...animalSnap.data()
    };

    if (
      animal.sellerId !==
      user.uid
    ) {

      alert(
        "لا يمكنك إدارة إعلان مستخدم آخر."
      );

      return;
    }

    const images =
      Array.isArray(
        animal.images
      )
        ?
        animal.images
        :
        [];

    const imageHtml =
      images.length >
      0
        ?
        images
          .map(
            (
              image,
              index
            ) => {

              const safe =
                safeImageData(
                  image
                );

              if (
                !safe
              ) {

                return "";
              }

              return `

                <div style="
                  position:relative;
                  margin-bottom:12px;
                ">

                  <img
                    src="${safe}"
                    style="
                      width:100%;
                      max-height:250px;
                      object-fit:cover;
                      border-radius:12px;
                    "
                  >

                  <button
                    onclick="removeAnimalImage('${animal.id}', ${index})"
                    style="
                      width:100%;
                      padding:10px;
                      margin-top:6px;
                      border:0;
                      border-radius:8px;
                      background:#8b2929;
                      color:white;
                    "
                  >
                    ❌ حذف هذه الصورة
                  </button>

                </div>
              `;
            }
          )
          .join("")
        :
        `
          <p style="
            text-align:center;
            color:#aaa;
          ">
            لا توجد صور حالياً
          </p>
        `;


    const directPriceField =
      animal.saleType ===
      "direct"
        ?
        `
          <label>
            السعر بالدرهم
          </label>

          <input
            id="editAnimalPrice"
            type="number"
            min="1"
            value="${Number(
              animal.price ||
              0
            )}"
            style="
              width:100%;
              box-sizing:border-box;
              padding:13px;
              margin-bottom:14px;
              border-radius:9px;
            "
          >
        `
        :
        `
          <div style="
            background:#302a16;
            color:#ffd66b;
            padding:12px;
            border-radius:10px;
            margin-bottom:15px;
          ">
            🔨 بيانات سعر المزاد ومدة المزاد لا يتم تعديلها بعد بدء المزاد.
          </div>
        `;


    let saleActionHtml =
      "";


    if (
      animal.saleType ===
        "auction" &&
      animal.auctionId
    ) {

      const auctionSnap =
        await getDoc(
          doc(
            db,
            "auctions",
            animal.auctionId
          )
        );

      if (
        auctionSnap.exists()
      ) {

        const auction = {
          id:
            auctionSnap.id,

          ...auctionSnap.data()
        };

        const endMillis =
          timestampToMillis(
            auction.endTime
          );

        const expired =
          !endMillis ||
          endMillis <=
            Date.now();

        const hasBid =
          !!auction
            .lastBidderId;


        if (
          auction.status ===
          "sold"
        ) {

          saleActionHtml = `

            <div style="
              background:#123c2c;
              color:#68e6b0;
              padding:18px;
              border-radius:12px;
              text-align:center;
              margin-bottom:15px;
            ">

              <h3>
                ✅ تم اعتماد البيع
              </h3>

              <p>
                السعر النهائي:

                <b>
                  ${money(
                    auction.currentPrice
                  )}
                </b>
              </p>

              ${
                auction.lastBidderPhone
                  ?
                  `
                    <p>
                      📱 رقم الفائز:

                      <b dir="ltr">
                        ${escapeHtml(
                          auction.lastBidderPhone
                        )}
                      </b>
                    </p>
                  `
                  :
                  ""
              }

            </div>
          `;

        } else if (
          auction.status ===
          "not_approved"
        ) {

          saleActionHtml = `

            <div style="
              background:#421d1d;
              color:#ff8d8d;
              padding:18px;
              border-radius:12px;
              text-align:center;
              margin-bottom:15px;
              font-weight:bold;
            ">
              ❌ تم إغلاق المزاد دون اعتماد البيع
            </div>
          `;

        } else if (
          !expired
        ) {

          saleActionHtml = `

            <div style="
              background:#302a16;
              color:#ffd66b;
              padding:18px;
              border-radius:12px;
              text-align:center;
              margin-bottom:15px;
            ">

              🔨 المزاد ما زال نشطاً

              <br><br>

              السعر الحالي:

              <b style="
                color:#68e6b0;
              ">
                ${money(
                  auction.currentPrice
                )}
              </b>

              <br><br>

              ⏱
              ${getCountdownText(
                auction.endTime
              )}

            </div>
          `;

        } else if (
          !hasBid
        ) {

          saleActionHtml = `

            <div style="
              background:#333;
              color:#ddd;
              padding:18px;
              border-radius:12px;
              text-align:center;
              margin-bottom:15px;
              font-weight:bold;
            ">
              ⛔ انتهى المزاد بدون أي مزايدات
            </div>
          `;

        } else {

          saleActionHtml = `

            <div style="
              background:#302a16;
              color:#ffd66b;
              padding:18px;
              border-radius:12px;
              text-align:center;
              margin-bottom:12px;
            ">

              <h3>
                🏆 نتيجة المزاد
              </h3>

              أعلى مزايدة:

              <div style="
                color:#68e6b0;
                font-size:28px;
                font-weight:bold;
                margin:10px 0;
              ">
                ${money(
                  auction.currentPrice
                )}
              </div>

              ⏳ بانتظار اعتمادك للنتيجة

            </div>

            <button
              onclick="finalizeAuction('${auction.id}','accept')"
              style="
                width:100%;
                background:#00643e;
                color:white;
                border:0;
                padding:16px;
                border-radius:10px;
                margin-bottom:10px;
              "
            >
              ✅ اعتماد البيع لأعلى مزايد
            </button>

            <button
              onclick="finalizeAuction('${auction.id}','reject')"
              style="
                width:100%;
                background:#8b2929;
                color:white;
                border:0;
                padding:16px;
                border-radius:10px;
                margin-bottom:15px;
              "
            >
              ❌ عدم اعتماد البيع
            </button>
          `;
        }
      }

    } else {

      saleActionHtml = `

        <button
          onclick="markListingSold('${animal.id}')"
          style="
            width:100%;
            background:#00643e;
            color:white;
            border:0;
            padding:16px;
            border-radius:10px;
            margin-bottom:10px;
          "
        >
          ✅ تم البيع
        </button>
      `;
    }


    showModal(`

      <div style="
        direction:rtl;
        color:white;
        padding:10px;
      ">

        <h2 style="
          color:#68e6b0;
          text-align:center;
        ">
          ⚙️ إدارة إعلاني
        </h2>

        <label>
          نوع الحيوان
        </label>

        <select
          id="editAnimalType"
          style="
            width:100%;
            padding:13px;
            margin-bottom:14px;
          "
        >

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

        <label>
          السلالة
        </label>

        <input
          id="editAnimalBreed"
          value="${escapeHtml(
            animal.breed ||
            ""
          )}"
        >

        <label>
          العمر
        </label>

        <input
          id="editAnimalAge"
          value="${escapeHtml(
            animal.age ||
            ""
          )}"
        >

        <label>
          الموقع
        </label>

        <input
          id="editAnimalLocation"
          value="${escapeHtml(
            animal.location ||
            ""
          )}"
        >

        ${directPriceField}

        <label>
          الوصف
        </label>

        <textarea
          id="editAnimalDescription"
          rows="4"
        >${escapeHtml(
          animal.description ||
          ""
        )}</textarea>

        <button
          onclick="saveListingEdits('${animal.id}')"
          style="
            width:100%;
            margin:15px 0;
          "
        >
          💾 حفظ التعديلات
        </button>

        <hr>

        ${imageHtml}

        <input
          id="manageImages"
          type="file"
          accept="image/*"
          multiple
        >

        <button
          onclick="replaceAnimalImages('${animal.id}')"
          style="
            width:100%;
            margin:10px 0;
          "
        >
          🖼️ حفظ الصور الجديدة
        </button>

        <button
          onclick="removeAllAnimalImages('${animal.id}')"
          style="
            width:100%;
            margin-bottom:15px;
          "
        >
          🧹 حذف جميع الصور
        </button>

        ${saleActionHtml}

        <button
          onclick="deleteListing('${animal.id}')"
          style="
            width:100%;
            background:#8b2929;
            margin-top:10px;
          "
        >
          🗑️ حذف الإعلان نهائياً
        </button>

        <div style="
          height:40px;
        "></div>

      </div>
    `);

  } catch (
    error
  ) {

    console.error(
      "MANAGE LISTING ERROR:",
      error
    );

    alert(
      "تعذر فتح إدارة الإعلان."
    );
  }
};


// =====================================
// اعتماد أو رفض نتيجة المزاد
// =====================================

window.finalizeAuction =
async function (
  auctionId,
  decision
) {

  const user =
    auth.currentUser;

  if (
    !user
  ) {

    window.openLogin();

    return;
  }

  if (
    decision !==
      "accept" &&
    decision !==
      "reject"
  ) {
    return;
  }

  try {

    const auctionRef =
      doc(
        db,
        "auctions",
        auctionId
      );

    const auctionSnap =
      await getDoc(
        auctionRef
      );

    if (
      !auctionSnap.exists()
    ) {

      alert(
        "المزاد غير موجود."
      );

      return;
    }

    const auction =
      auctionSnap.data();

    if (
      auction.sellerId !==
      user.uid
    ) {

      alert(
        "غير مصرح لك باعتماد هذا المزاد."
      );

      return;
    }

    if (
      auction.status !==
      "active"
    ) {

      alert(
        "تم التعامل مع نتيجة هذا المزاد مسبقاً."
      );

      await loadMarket();

      return;
    }

    const endMillis =
      timestampToMillis(
        auction.endTime
      );

    if (
      !endMillis ||
      Date.now() <
        endMillis
    ) {

      alert(
        "⏳ لا يمكن اعتماد نتيجة المزاد قبل انتهاء الوقت."
      );

      return;
    }

    if (
      decision ===
        "accept" &&
      !auction.lastBidderId
    ) {

      alert(
        "لا توجد مزايدات يمكن اعتمادها."
      );

      return;
    }

    let confirmationMessage =
      "";

    if (
      decision ===
      "accept"
    ) {

      confirmationMessage =
        "هل تؤكد اعتماد أعلى مزايدة؟\n\n" +
        "السعر النهائي: " +
        money(
          auction.currentPrice
        );

    } else {

      confirmationMessage =
        "هل تؤكد عدم اعتماد البيع؟\n\nسيتم إغلاق المزاد بدون بيع.";
    }

    const ok =
      confirm(
        confirmationMessage
      );

    if (
      !ok
    ) {
      return;
    }

    const animalRef =
      doc(
        db,
        "animals",
        auction.animalId
      );

    const batch =
      writeBatch(
        db
      );

    if (
      decision ===
      "accept"
    ) {

      batch.set(
        auctionRef,
        {
          status:
            "sold",

          updatedAt:
            serverTimestamp()
        },
        {
          merge:
            true
        }
      );

      batch.set(
        animalRef,
        {
          status:
            "sold",

          soldAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        },
        {
          merge:
            true
        }
      );

    } else {

      batch.set(
        auctionRef,
        {
          status:
            "not_approved",

          updatedAt:
            serverTimestamp()
        },
        {
          merge:
            true
        }
      );

      batch.set(
        animalRef,
        {
          status:
            "not_approved",

          updatedAt:
            serverTimestamp()
        },
        {
          merge:
            true
        }
      );
    }

    await batch.commit();

    if (
      decision ===
      "accept"
    ) {

      alert(
        "✅ تم اعتماد البيع بنجاح."
      );

    } else {

      alert(
        "✅ تم إغلاق المزاد بدون اعتماد البيع."
      );
    }

    window.closeModal();

    await loadMarket();

  } catch (
    error
  ) {

    console.error(
      "FINALIZE AUCTION ERROR:",
      error
    );

    alert(
      "❌ تعذر اعتماد نتيجة المزاد."
    );
  }
};


// =====================================
// حفظ تعديل الإعلان
// =====================================

window.saveListingEdits =
async function (
  animalId
) {

  const user =
    auth.currentUser;

  if (
    !user
  ) {
    return;
  }

  try {

    const animalRef =
      doc(
        db,
        "animals",
        animalId
      );

    const animalSnap =
      await getDoc(
        animalRef
      );

    if (
      !animalSnap.exists()
    ) {
      return;
    }

    const animal =
      animalSnap.data();

    if (
      animal.sellerId !==
      user.uid
    ) {
      return;
    }

    const type =
      document.getElementById(
        "editAnimalType"
      )?.value ||
      "";

    const breed =
      document.getElementById(
        "editAnimalBreed"
      )?.value.trim() ||
      "";

    const age =
      document.getElementById(
        "editAnimalAge"
      )?.value.trim() ||
      "";

    const location =
      document.getElementById(
        "editAnimalLocation"
      )?.value.trim() ||
      "";

    const description =
      document.getElementById(
        "editAnimalDescription"
      )?.value.trim() ||
      "";

    const updateData = {
      name:
        type,

      type,

      breed,

      age,

      location,

      description,

      updatedAt:
        serverTimestamp()
    };

    if (
      animal.saleType ===
      "direct"
    ) {

      const price =
        Number(
          document.getElementById(
            "editAnimalPrice"
          )?.value
        );

      if (
        !Number.isFinite(
          price
        ) ||
        price <=
          0
      ) {

        alert(
          "أدخل سعر بيع صحيح."
        );

        return;
      }

      updateData.price =
        price;
    }

    await setDoc(
      animalRef,
      updateData,
      {
        merge:
          true
      }
    );

    alert(
      "✅ تم حفظ تعديلات الإعلان بنجاح."
    );

    await loadMarket();

    await window
      .manageListing(
        animalId
      );

  } catch (
    error
  ) {

    console.error(
      "SAVE LISTING EDIT ERROR:",
      error
    );

    alert(
      "❌ تعذر حفظ التعديلات."
    );
  }
};


// =====================================
// حذف صورة واحدة
// =====================================

window.removeAnimalImage =
async function (
  animalId,
  imageIndex
) {

  const user =
    auth.currentUser;

  if (
    !user
  ) {
    return;
  }

  const ok =
    confirm(
      "هل تريد حذف هذه الصورة؟"
    );

  if (
    !ok
  ) {
    return;
  }

  try {

    const animalRef =
      doc(
        db,
        "animals",
        animalId
      );

    const snap =
      await getDoc(
        animalRef
      );

    if (
      !snap.exists()
    ) {
      return;
    }

    const animal =
      snap.data();

    if (
      animal.sellerId !==
      user.uid
    ) {
      return;
    }

    const images =
      Array.isArray(
        animal.images
      )
        ?
        [
          ...animal.images
        ]
        :
        [];

    images.splice(
      imageIndex,
      1
    );

    await setDoc(
      animalRef,
      {
        images,

        updatedAt:
          serverTimestamp()
      },
      {
        merge:
          true
      }
    );

    alert(
      "✅ تم حذف الصورة."
    );

    await loadMarket();

    await window
      .manageListing(
        animalId
      );

  } catch (
    error
  ) {

    console.error(
      error
    );

    alert(
      "❌ تعذر حذف الصورة."
    );
  }
};


// =====================================
// حذف جميع الصور
// =====================================

window.removeAllAnimalImages =
async function (
  animalId
) {

  const ok =
    confirm(
      "هل تريد حذف جميع صور الإعلان؟"
    );

  if (
    !ok
  ) {
    return;
  }

  try {

    const animalRef =
      doc(
        db,
        "animals",
        animalId
      );

    const snap =
      await getDoc(
        animalRef
      );

    if (
      !snap.exists() ||
      snap.data()
        .sellerId !==
        auth.currentUser
          ?.uid
    ) {

      alert(
        "غير مصرح."
      );

      return;
    }

    await setDoc(
      animalRef,
      {
        images:
          [],

        updatedAt:
          serverTimestamp()
      },
      {
        merge:
          true
      }
    );

    alert(
      "✅ تم حذف جميع الصور."
    );

    await loadMarket();

    await window
      .manageListing(
        animalId
      );

  } catch (
    error
  ) {

    console.error(
      error
    );

    alert(
      "❌ تعذر حذف الصور."
    );
  }
};


// =====================================
// استبدال الصور
// =====================================

window.replaceAnimalImages =
async function (
  animalId
) {

  const input =
    document.getElementById(
      "manageImages"
    );

  if (
    !input ||
    !input.files ||
    input.files.length ===
      0
  ) {

    alert(
      "اختر صورة واحدة على الأقل."
    );

    return;
  }

  if (
    input.files.length >
    5
  ) {

    alert(
      "يمكن اختيار 5 صور كحد أقصى."
    );

    return;
  }

  try {

    const animalRef =
      doc(
        db,
        "animals",
        animalId
      );

    const snap =
      await getDoc(
        animalRef
      );

    if (
      !snap.exists() ||
      snap.data()
        .sellerId !==
        auth.currentUser
          ?.uid
    ) {

      alert(
        "غير مصرح."
      );

      return;
    }

    const files =
      Array.from(
        input.files
      );

    const images =
      [];

    let totalSize =
      0;

    for (
      const file
      of files
    ) {

      const imageData =
        await compressImageFile(
          file
        );

      totalSize +=
        imageData.length;

      if (
        totalSize >
        650000
      ) {

        alert(
          "حجم الصور كبير جداً."
        );

        return;
      }

      images.push(
        imageData
      );
    }

    await setDoc(
      animalRef,
      {
        images,

        updatedAt:
          serverTimestamp()
      },
      {
        merge:
          true
      }
    );

    alert(
      "✅ تم استبدال الصور بنجاح."
    );

    await loadMarket();

    await window
      .manageListing(
        animalId
      );

  } catch (
    error
  ) {

    console.error(
      error
    );

    alert(
      "❌ تعذر استبدال الصور."
    );
  }
};


// =====================================
// تم البيع - البيع المباشر
// =====================================

window.markListingSold =
async function (
  animalId
) {

  try {

    const animalRef =
      doc(
        db,
        "animals",
        animalId
      );

    const animalSnap =
      await getDoc(
        animalRef
      );

    if (
      !animalSnap.exists()
    ) {
      return;
    }

    const animal =
      animalSnap.data();

    if (
      animal.sellerId !==
      auth.currentUser
        ?.uid
    ) {

      alert(
        "غير مصرح."
      );

      return;
    }

    if (
      animal.saleType ===
      "auction"
    ) {

      alert(
        "🔨 لا يمكن استخدام زر تم البيع للمزاد."
      );

      return;
    }

    const ok =
      confirm(
        "هل تؤكد أن الحلال تم بيعه؟"
      );

    if (
      !ok
    ) {
      return;
    }

    await setDoc(
      animalRef,
      {
        status:
          "sold",

        soldAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      },
      {
        merge:
          true
      }
    );

    window.closeModal();

    alert(
      "✅ تم تسجيل الحلال كمباع."
    );

    await loadMarket();

  } catch (
    error
  ) {

    console.error(
      "MARK SOLD ERROR:",
      error
    );

    alert(
      "❌ تعذر تسجيل البيع."
    );
  }
};


// =====================================
// حذف الإعلان
// =====================================

window.deleteListing =
async function (
  animalId
) {

  const ok =
    confirm(
      "⚠️ هل أنت متأكد من حذف الإعلان نهائياً؟"
    );

  if (
    !ok
  ) {
    return;
  }

  try {

    const animalRef =
      doc(
        db,
        "animals",
        animalId
      );

    const animalSnap =
      await getDoc(
        animalRef
      );

    if (
      !animalSnap.exists()
    ) {
      return;
    }

    const animal =
      animalSnap.data();

    if (
      animal.sellerId !==
      auth.currentUser
        ?.uid
    ) {
      return;
    }

    const batch =
      writeBatch(
        db
      );

    batch.delete(
      animalRef
    );

    if (
      animal.saleType ===
        "auction" &&
      animal.auctionId
    ) {

      batch.delete(
        doc(
          db,
          "auctions",
          animal.auctionId
        )
      );
    }

    await batch.commit();

    window.closeModal();

    alert(
      "✅ تم حذف الإعلان نهائياً."
    );

    await loadMarket();

  } catch (
    error
  ) {

    console.error(
      "DELETE LISTING ERROR:",
      error
    );

    alert(
      "❌ تعذر حذف الإعلان."
    );
  }
};


// =====================================
// طلب شراء
// =====================================

window.requestPurchase =
async function (
  animalId
) {

  const user =
    auth.currentUser;

  if (
    !user
  ) {

    alert(
      "يجب تسجيل الدخول أولاً لإرسال طلب شراء."
    );

    window.openLogin();

    return;
  }

  try {

    const animalSnap =
      await getDoc(
        doc(
          db,
          "animals",
          animalId
        )
      );

    if (
      !animalSnap.exists()
    ) {

      alert(
        "الإعلان غير موجود."
      );

      return;
    }

    const animal =
      animalSnap.data();

    if (
      animal.saleType !==
      "direct"
    ) {

      alert(
        "طلب الشراء متاح للبيع المباشر فقط."
      );

      return;
    }

    if (
      animal.status &&
      animal.status !==
        "active"
    ) {

      alert(
        "هذا الإعلان غير متاح للشراء."
      );

      return;
    }

    if (
      animal.sellerId ===
      user.uid
    ) {

      alert(
        "لا يمكنك إرسال طلب شراء لإعلانك."
      );

      return;
    }

    const profile =
      await getUserProfile();

    const existingQuery =
      query(
        collection(
          db,
          "purchaseRequests"
        ),
        where(
          "buyerId",
          "==",
          user.uid
        )
      );

    const existingSnapshot =
      await getDocs(
        existingQuery
      );

    let duplicateRequest =
      false;

    existingSnapshot.forEach(
      requestDoc => {

        const request =
          requestDoc.data();

        if (
          request.animalId ===
            animalId &&
          (
            request.status ===
              "pending" ||
            request.status ===
              "accepted"
          )
        ) {

          duplicateRequest =
            true;
        }
      }
    );

    if (
      duplicateRequest
    ) {

      alert(
        "⚠️ لديك طلب شراء سابق لهذا الإعلان."
      );

      return;
    }

    const ok =
      confirm(
        "هل تريد إرسال طلب شراء؟\n\n" +
        "النوع: " +
        (
          animal.type ||
          "حلال"
        ) +
        "\nالسعر: " +
        money(
          animal.price
        )
      );

    if (
      !ok
    ) {
      return;
    }

    await addDoc(
      collection(
        db,
        "purchaseRequests"
      ),
      {
        animalId,

        animalType:
          animal.type ||
          "",

        animalBreed:
          animal.breed ||
          "",

        price:
          Number(
            animal.price ||
            0
          ),

        sellerId:
          animal.sellerId,

        sellerName:
          animal.sellerName ||
          "",

        sellerPhone:
          animal.sellerPhone ||
          "",

        buyerId:
          user.uid,

        buyerName:
          profile
            ?.displayName ||
          "",

        buyerPhone:
          user.phoneNumber ||
          "",

        status:
          "pending",

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      }
    );

    alert(
      "✅ تم إرسال طلب الشراء إلى البائع."
    );

  } catch (
    error
  ) {

    console.error(
      "PURCHASE REQUEST ERROR:",
      error
    );

    alert(
      "❌ تعذر إرسال طلب الشراء."
    );
  }
};


// =====================================
// المزايدة
// =====================================

window.placeBid =
async function (
  auctionId
) {

  if (
    !auth.currentUser
  ) {

    alert(
      "يجب تسجيل الدخول برقم الهاتف قبل المزايدة."
    );

    window.openLogin();

    return;
  }

  try {

    const auctionRef =
      doc(
        db,
        "auctions",
        auctionId
      );

    let minimumBid =
      0;


    await runTransaction(
      db,
      async transaction => {

        const auctionSnap =
          await transaction.get(
            auctionRef
          );

        if (
          !auctionSnap.exists()
        ) {

          throw new Error(
            "AUCTION_NOT_FOUND"
          );
        }

        const auction =
          auctionSnap.data();

        if (
          auction.sellerId ===
          auth.currentUser.uid
        ) {

          throw new Error(
            "OWNER_CANNOT_BID"
          );
        }

        if (
          auction.status !==
          "active"
        ) {

          throw new Error(
            "AUCTION_NOT_ACTIVE"
          );
        }

        const endMillis =
          timestampToMillis(
            auction.endTime
          );

        if (
          !endMillis ||
          Date.now() >=
            endMillis
        ) {

          throw new Error(
            "AUCTION_ENDED"
          );
        }

        const currentPrice =
          Number(
            auction.currentPrice ||
            auction.startPrice ||
            0
          );

        const increment =
          Number(
            auction.minIncrement ||
            0
          );

        minimumBid =
          currentPrice +
          increment;
      }
    );


    const enteredValue =
      prompt(
        "أدخل مبلغ المزايدة الجديدة بالدرهم\n\n" +
        "الحد الأدنى المقبول: " +
        money(
          minimumBid
        ),

        minimumBid
      );

    if (
      enteredValue ===
      null
    ) {
      return;
    }

    const bidAmount =
      Number(
        String(
          enteredValue
        )
          .replace(
            /,/g,
            ""
          )
          .trim()
      );

    if (
      !Number.isFinite(
        bidAmount
      ) ||
      bidAmount <=
        0
    ) {

      alert(
        "يرجى إدخال مبلغ صحيح."
      );

      return;
    }


    await runTransaction(
      db,
      async transaction => {

        const auctionSnap =
          await transaction.get(
            auctionRef
          );

        if (
          !auctionSnap.exists()
        ) {

          throw new Error(
            "AUCTION_NOT_FOUND"
          );
        }

        const auction =
          auctionSnap.data();

        if (
          auction.sellerId ===
          auth.currentUser.uid
        ) {

          throw new Error(
            "OWNER_CANNOT_BID"
          );
        }

        if (
          auction.status !==
          "active"
        ) {

          throw new Error(
            "AUCTION_NOT_ACTIVE"
          );
        }

        const endMillis =
          timestampToMillis(
            auction.endTime
          );

        if (
          !endMillis ||
          Date.now() >=
            endMillis
        ) {

          throw new Error(
            "AUCTION_ENDED"
          );
        }

        const currentPrice =
          Number(
            auction.currentPrice ||
            auction.startPrice ||
            0
          );

        const increment =
          Number(
            auction.minIncrement ||
            0
          );

        const requiredBid =
          currentPrice +
          increment;

        if (
          bidAmount <
          requiredBid
        ) {

          throw new Error(
            "BID_TOO_LOW:" +
            requiredBid
          );
        }

        transaction.update(
          auctionRef,
          {
            currentPrice:
              bidAmount,

            lastBidAt:
              serverTimestamp(),

            lastBidderId:
              auth.currentUser.uid,

            lastBidderPhone:
              auth.currentUser
                .phoneNumber ||
              ""
          }
        );
      }
    );

    alert(
      "✅ تمت المزايدة بنجاح\n\n" +
      "السعر الجديد: " +
      money(
        bidAmount
      )
    );

    await loadMarket();

  } catch (
    error
  ) {

    console.error(
      "BID ERROR:",
      error
    );

    if (
      error.message ===
      "OWNER_CANNOT_BID"
    ) {

      alert(
        "⛔ لا يمكنك المزايدة على مزادك الخاص."
      );

      return;
    }

    if (
      error.message &&
      error.message
        .startsWith(
          "BID_TOO_LOW:"
        )
    ) {

      const required =
        error.message
          .split(
            ":"
          )[1];

      alert(
        "❌ تم تسجيل مزايدة أعلى قبلك.\n\n" +
        "الحد الأدنى الجديد: " +
        money(
          required
        )
      );

      await loadMarket();

      return;
    }

    if (
      error.message ===
      "AUCTION_ENDED"
    ) {

      alert(
        "⛔ انتهى وقت المزاد."
      );

      await loadMarket();

      return;
    }

    if (
      error.message ===
      "AUCTION_NOT_ACTIVE"
    ) {

      alert(
        "⛔ هذا المزاد لم يعد متاحاً للمزايدة."
      );

      await loadMarket();

      return;
    }

    alert(
      "❌ لم يتم حفظ المزايدة."
    );
  }
};


// =====================================
// إضافة حلال جديد
// =====================================

window.saveListing =
async function (
  event
) {

  event.preventDefault();

  const user =
    auth.currentUser;

  if (
    !user
  ) {

    alert(
      "يجب تسجيل الدخول أولاً لإضافة الحلال."
    );

    window.openLogin();

    return;
  }

  try {

    const profile =
      await getUserProfile();

    if (
      !profile ||
      (
        profile.accountType !==
          "seller" &&
        profile.accountType !==
          "both"
      )
    ) {

      alert(
        "يجب أن يكون الحساب بائع أو بائع ومشتري."
      );

      return;
    }


    if (
      !hasActiveSellerSubscription(
        profile
      )
    ) {

      const endDate =
        timestampToDate(
          profile
            .subscriptionEnd
        );

      let message =
        "⛔ لا يمكنك نشر إعلان أو إنشاء مزاد حالياً.\n\n";

      if (
        profile.subscriptionStatus !==
        "active"
      ) {

        message +=
          "اشتراك البائع غير فعال.";

      } else if (
        endDate &&
        endDate.getTime() <=
          Date.now()
      ) {

        message +=
          "انتهى اشتراك البائع بتاريخ:\n" +
          formatDate(
            profile.subscriptionEnd
          );

      } else {

        message +=
          "لا يوجد اشتراك بائع فعال.";
      }

      message +=
        "\n\nيرجى تجديد الاشتراك الشهري للمتابعة.";

      alert(
        message
      );

      return;
    }


    const type =
      document.getElementById(
        "animalType"
      )?.value ||
      "";

    const breed =
      document.getElementById(
        "animalBreed"
      )?.value.trim() ||
      "";

    const age =
      document.getElementById(
        "animalAge"
      )?.value.trim() ||
      "";

    const location =
      document.getElementById(
        "animalLocation"
      )?.value.trim() ||
      "الذيد - الشارقة";

    const method =
      document.getElementById(
        "method"
      )?.value ||
      "";

    const price =
      Number(
        document.getElementById(
          "animalPrice"
        )?.value
      );

    const description =
      document.getElementById(
        "animalDescription"
      )?.value.trim() ||
      "";


    if (
      !type ||
      !Number.isFinite(
        price
      ) ||
      price <=
        0
    ) {

      alert(
        "تأكد من نوع الحيوان والسعر."
      );

      return;
    }


    let images =
      [];

    try {

      images =
        await getListingImages();

    } catch (
      error
    ) {

      alert(
        "تعذر تجهيز الصور أو حجم الصور كبير."
      );

      return;
    }


    // =====================================
    // البيع المباشر
    // =====================================

    if (
      method ===
      "بيع مباشر"
    ) {

      await addDoc(
        collection(
          db,
          "animals"
        ),
        {
          name:
            type,

          type,

          breed,

          age,

          location,

          saleType:
            "direct",

          price,

          description,

          images,

          sellerId:
            user.uid,

          sellerName:
            profile
              .displayName ||
            "",

          sellerPhone:
            user.phoneNumber ||
            "",

          status:
            "active",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        }
      );

      alert(
        "✅ تم إضافة الحلال بنجاح."
      );

      resetListingForm(
        event.target
      );

      await loadMarket();

      scrollToMarket();

      return;
    }


    // =====================================
    // المزاد الإلكتروني
    // =====================================

    if (
      method ===
      "مزاد إلكتروني"
    ) {

      const increment =
        Number(
          document.getElementById(
            "auctionIncrement"
          )?.value
        );

      const endTimeValue =
        document.getElementById(
          "auctionEndTime"
        )?.value ||
        "";

      const endTime =
        new Date(
          endTimeValue
        );

      if (
        !Number.isFinite(
          increment
        ) ||
        increment <=
          0 ||
        !endTimeValue ||
        Number.isNaN(
          endTime.getTime()
        ) ||
        endTime.getTime() <=
          Date.now()
      ) {

        alert(
          "تحقق من بيانات المزاد."
        );

        return;
      }

      const animalRef =
        doc(
          collection(
            db,
            "animals"
          )
        );

      const auctionRef =
        doc(
          collection(
            db,
            "auctions"
          )
        );

      const batch =
        writeBatch(
          db
        );

      batch.set(
        animalRef,
        {
          name:
            type,

          type,

          breed,

          age,

          location,

          saleType:
            "auction",

          price,

          description,

          images,

          sellerId:
            user.uid,

          sellerName:
            profile
              .displayName ||
            "",

          sellerPhone:
            user.phoneNumber ||
            "",

          status:
            "active",

          auctionId:
            auctionRef.id,

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        }
      );

      batch.set(
        auctionRef,
        {
          animalId:
            animalRef.id,

          sellerId:
            user.uid,

          sellerName:
            profile
              .displayName ||
            "",

          sellerPhone:
            user.phoneNumber ||
            "",

          startPrice:
            price,

          currentPrice:
            price,

          minIncrement:
            increment,

          endTime,

          status:
            "active",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp()
        }
      );

      await batch.commit();

      alert(
        "✅ تم إنشاء المزاد الإلكتروني بنجاح."
      );

      resetListingForm(
        event.target
      );

      await loadMarket();

      scrollToMarket();

      return;
    }


    alert(
      "يرجى اختيار طريقة البيع."
    );

  } catch (
    error
  ) {

    console.error(
      "SAVE LISTING ERROR:",
      error
    );

    alert(
      "❌ تعذر إضافة الحلال."
    );
  }
};


// =====================================
// تنظيف النموذج
// =====================================

function resetListingForm(
  form
) {

  if (
    form
  ) {

    form.reset();
  }

  const preview =
    document.getElementById(
      "imagePreview"
    );

  if (
    preview
  ) {

    preview.innerHTML =
      "";
  }

  const auctionFields =
    document.getElementById(
      "auctionFields"
    );

  if (
    auctionFields
  ) {

    auctionFields.style.display =
      "none";
  }
}


// =====================================
// الانتقال للسوق
// =====================================

function scrollToMarket() {

  const market =
    document.getElementById(
      "firebase-market"
    );

  if (
    market
  ) {

    market.scrollIntoView({
      behavior:
        "smooth"
    });
  }
}


// =====================================
// أزرار قديمة
// =====================================

window.bid =
function () {

  alert(
    "استخدم المزاد الحقيقي في سوق الحلال."
  );
};


window.details =
function (
  name,
  price
) {

  alert(
    name +
    "\nالسعر: " +
    price +
    " AED"
  );
};


// =====================================
// تشغيل السوق
// =====================================

loadMarket();