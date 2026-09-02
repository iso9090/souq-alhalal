import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
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


// =====================================
// أدوات مساعدة
// =====================================

function money(value) {

  return Number(value || 0)
    .toLocaleString("en-US") +
    " AED";
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

  if (type.includes("ماعز")) {
    return "🐐";
  }

  if (
    type.includes("بقر") ||
    type.includes("بقرة") ||
    type.includes("أبقار")
  ) {
    return "🐄";
  }

  if (type.includes("دجاج")) {
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

  if (type.includes("نعام")) {
    return "🐦";
  }

  if (type.includes("حمام")) {
    return "🕊️";
  }

  return "🐾";
}


// =====================================
// تحويل التاريخ
// =====================================

function timestampToDate(timestamp) {

  if (!timestamp) {
    return null;
  }

  if (timestamp.toDate) {
    return timestamp.toDate();
  }

  if (timestamp instanceof Date) {
    return timestamp;
  }

  const date =
    new Date(timestamp);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}


function timestampToMillis(timestamp) {

  const date =
    timestampToDate(timestamp);

  if (!date) {
    return 0;
  }

  return date.getTime();
}


function formatDate(timestamp) {

  const date =
    timestampToDate(timestamp);

  if (!date) {
    return "غير محدد";
  }

  return date.toLocaleString(
    "ar-AE",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}


// =====================================
// العداد التنازلي
// =====================================

function getCountdownText(endTime) {

  const end =
    timestampToMillis(endTime);

  if (!end) {
    return "غير محدد";
  }

  const now =
    Date.now();

  const difference =
    end - now;


  if (difference <= 0) {
    return "انتهى المزاد";
  }


  const totalSeconds =
    Math.floor(
      difference / 1000
    );


  const days =
    Math.floor(
      totalSeconds / 86400
    );


  const hours =
    Math.floor(
      (totalSeconds % 86400) /
      3600
    );


  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
      60
    );


  const seconds =
    totalSeconds % 60;


  const hh =
    String(hours)
      .padStart(2, "0");

  const mm =
    String(minutes)
      .padStart(2, "0");

  const ss =
    String(seconds)
      .padStart(2, "0");


  if (days > 0) {

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

  if (auctionTimerInterval) {

    clearInterval(
      auctionTimerInterval
    );

    auctionTimerInterval = null;
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
            timer.dataset.auctionEnd ||
            0
          );


        const auctionId =
          timer.dataset.auctionId;


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
          end - Date.now();


        if (
          !end ||
          difference <= 0
        ) {

          timer.innerHTML =
            "⛔ انتهى المزاد";

          timer.style.color =
            "#ff8d8d";


          if (button) {

            button.disabled =
              true;

            button.textContent =
              "انتهى المزاد";

            button.style.background =
              "#555";

            button.style.cursor =
              "not-allowed";
          }


          if (tag) {

            tag.textContent =
              "مزاد منتهي";

            tag.style.background =
              "#6d2929";
          }


          return;
        }


        const totalSeconds =
          Math.floor(
            difference / 1000
          );


        const days =
          Math.floor(
            totalSeconds / 86400
          );


        const hours =
          Math.floor(
            (totalSeconds % 86400) /
            3600
          );


        const minutes =
          Math.floor(
            (totalSeconds % 3600) /
            60
          );


        const seconds =
          totalSeconds % 60;


        const hh =
          String(hours)
            .padStart(2, "0");

        const mm =
          String(minutes)
            .padStart(2, "0");

        const ss =
          String(seconds)
            .padStart(2, "0");


        if (days > 0) {

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

function escapeHtml(value = "") {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function accountTypeText(type) {

  if (type === "seller") {
    return "بائع";
  }

  if (type === "both") {
    return "بائع ومشتري";
  }

  return "مشتري";
}


// =====================================
// إنشاء / تحديث حساب المستخدم
// =====================================

async function ensureUserProfile(user) {

  if (!user) {
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


    if (!userSnap.exists()) {

      await setDoc(
        userRef,
        {
          uid:
            user.uid,

          phoneNumber:
            user.phoneNumber || "",

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
            user.phoneNumber || "",

          lastLoginAt:
            serverTimestamp()
        },
        {
          merge: true
        }
      );
    }

  } catch (error) {

    console.error(
      "USER PROFILE ERROR:",
      error
    );
  }
}


// =====================================
// جلب بيانات الحساب
// =====================================

async function getUserProfile() {

  const user =
    auth.currentUser;


  if (!user) {
    return null;
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


    if (!userSnap.exists()) {
      return null;
    }


    return {
      id:
        userSnap.id,

      ...userSnap.data()
    };

  } catch (error) {

    console.error(
      "GET PROFILE ERROR:",
      error
    );

    return null;
  }
}


// =====================================
// النافذة المنبثقة
// =====================================

function showModal(html) {

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
}


window.closeModal =
function () {

  const modal =
    document.getElementById(
      "modal"
    );


  if (modal) {

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


  if (!user) {
    return;
  }


  showModal(`

    <div style="
      direction:rtl;
      text-align:center;
      color:white;
      padding:20px;
    ">

      <div style="font-size:55px;">
        👤
      </div>

      <h2 style="color:#68e6b0;">
        حسابي
      </h2>

      <p style="color:#aaa;">
        جاري تحميل بيانات الحساب...
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


  showModal(`

    <div style="
      direction:rtl;
      color:white;
      padding:12px;
    ">

      <div style="
        text-align:center;
        margin-bottom:20px;
      ">

        <div style="
          width:75px;
          height:75px;
          border-radius:50%;
          background:#00643e;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:40px;
          margin:0 auto 10px;
        ">
          👤
        </div>

        <h2 style="color:#68e6b0;">
          حسابي
        </h2>

        <p style="color:#aaa;">
          سوق الحلال الإلكتروني
        </p>

      </div>


      <label style="
        display:block;
        margin-bottom:7px;
        font-weight:bold;
      ">
        الاسم
      </label>

      <input
        id="profileName"
        type="text"
        maxlength="50"
        value="${escapeHtml(displayName)}"
        placeholder="أدخل اسمك"
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          margin-bottom:16px;
          border-radius:10px;
          border:1px solid #555;
          background:#171717;
          color:white;
          font-size:17px;
        "
      >


      <label style="
        display:block;
        margin-bottom:7px;
        font-weight:bold;
      ">
        رقم الهاتف
      </label>

      <input
        type="text"
        value="${escapeHtml(phone)}"
        disabled
        style="
          width:100%;
          box-sizing:border-box;
          padding:14px;
          margin-bottom:16px;
          border-radius:10px;
          border:1px solid #444;
          background:#292929;
          color:#aaa;
          font-size:17px;
          direction:ltr;
          text-align:left;
        "
      >


      <label style="
        display:block;
        margin-bottom:7px;
        font-weight:bold;
      ">
        استخدام الحساب
      </label>

      <select
        id="profileAccountType"
        style="
          width:100%;
          padding:14px;
          box-sizing:border-box;
          margin-bottom:18px;
          border-radius:10px;
          background:#171717;
          color:white;
          font-size:17px;
        "
      >

        <option
          value="buyer"
          ${accountType === "buyer" ? "selected" : ""}
        >
          مشتري
        </option>

        <option
          value="seller"
          ${accountType === "seller" ? "selected" : ""}
        >
          بائع
        </option>

        <option
          value="both"
          ${accountType === "both" ? "selected" : ""}
        >
          بائع ومشتري
        </option>

      </select>


      <div style="
        background:#10271c;
        padding:14px;
        border-radius:10px;
        margin-bottom:18px;
      ">

        حالة الحساب:
        <b style="color:#68e6b0;">
          ✅ نشط
        </b>

        <br><br>

        نوع الحساب الحالي:
        <b style="color:#68e6b0;">
          ${accountTypeText(accountType)}
        </b>

      </div>


      <p
        id="profileStatus"
        style="
          text-align:center;
          min-height:25px;
        "
      ></p>


      <button
        onclick="saveProfile()"
        style="
          width:100%;
          padding:15px;
          border:0;
          border-radius:10px;
          background:#00643e;
          color:white;
          font-size:18px;
          margin-bottom:12px;
        "
      >
        💾 حفظ بيانات الحساب
      </button>


      <button
        onclick="logoutUser()"
        style="
          width:100%;
          padding:14px;
          border:0;
          border-radius:10px;
          background:#8b2929;
          color:white;
          font-size:17px;
        "
      >
        تسجيل الخروج
      </button>

    </div>

  `);
}


// =====================================
// حفظ بيانات الحساب
// =====================================

window.saveProfile =
async function () {

  const user =
    auth.currentUser;


  if (!user) {

    alert(
      "يجب تسجيل الدخول أولاً."
    );

    return;
  }


  const nameInput =
    document.getElementById(
      "profileName"
    );


  const accountTypeInput =
    document.getElementById(
      "profileAccountType"
    );


  const status =
    document.getElementById(
      "profileStatus"
    );


  if (
    !nameInput ||
    !accountTypeInput ||
    !status
  ) {
    return;
  }


  const displayName =
    nameInput.value.trim();


  const accountType =
    accountTypeInput.value;


  if (
    displayName.length < 2
  ) {

    status.innerHTML =
      "❌ أدخل الاسم بشكل صحيح.";

    return;
  }


  if (
    ![
      "buyer",
      "seller",
      "both"
    ].includes(accountType)
  ) {

    status.innerHTML =
      "❌ نوع الحساب غير صحيح.";

    return;
  }


  try {

    status.innerHTML =
      "جاري حفظ البيانات...";


    await setDoc(
      doc(
        db,
        "users",
        user.uid
      ),
      {
        displayName:
          displayName,

        accountType:
          accountType,

        phoneNumber:
          user.phoneNumber || "",

        updatedAt:
          serverTimestamp()
      },
      {
        merge: true
      }
    );


    status.innerHTML =
      "✅ تم حفظ بيانات الحساب بنجاح";


    const loginButton =
      document.querySelector(
        ".login"
      );


    if (loginButton) {

      loginButton.textContent =
        "✅ حسابي";
    }

  } catch (error) {

    console.error(
      "SAVE PROFILE ERROR:",
      error
    );


    status.innerHTML =
      "❌ تعذر حفظ بيانات الحساب.";
  }
};


// =====================================
// تسجيل الدخول
// =====================================

window.openLogin =
async function () {

  if (auth.currentUser) {

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

      <p style="text-align:center;">
        أدخل رقم الهاتف الإماراتي
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
          border-radius:10px;
          border:1px solid #555;
          margin:10px 0;
          font-size:18px;
          direction:ltr;
        "
      >

      <div id="recaptcha-container"></div>

      <button
        onclick="sendPhoneCode()"
        style="
          width:100%;
          padding:15px;
          border:0;
          border-radius:10px;
          background:#00643e;
          color:white;
          font-size:18px;
        "
      >
        إرسال رمز التحقق
      </button>

      <p
        id="loginStatus"
        style="
          text-align:center;
          margin-top:15px;
          color:#ddd;
          word-break:break-word;
        "
      ></p>

    </div>

  `);
};


// =====================================
// إرسال رمز SMS
// =====================================

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
      .replace(/\s+/g, "")
      .replace(/-/g, "");


  if (
    phone.startsWith("05")
  ) {

    phone =
      "+971" +
      phone.substring(1);
  }


  if (
    phone.startsWith("971")
  ) {

    phone =
      "+" +
      phone;
  }


  if (
    !phone.startsWith("+9715")
  ) {

    status.innerHTML =
      "❌ أدخل رقم إماراتي صحيح مثل +971501234567";

    return;
  }


  try {

    status.innerHTML =
      "جاري إرسال رمز التحقق...";


    if (recaptchaVerifier) {

      try {
        recaptchaVerifier.clear();
      } catch (e) {}

      recaptchaVerifier = null;
    }


    recaptchaVerifier =
      new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        {
          size: "invisible"
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

  } catch (error) {

    console.error(
      "PHONE AUTH ERROR:",
      error
    );


    if (recaptchaVerifier) {

      try {
        recaptchaVerifier.clear();
      } catch (e) {}

      recaptchaVerifier = null;
    }


    if (
      error.code ===
      "auth/unauthorized-domain"
    ) {

      status.innerHTML =
        "❌ نطاق الموقع غير مصرح به في Firebase.";

      return;
    }


    if (
      error.code ===
      "auth/too-many-requests"
    ) {

      status.innerHTML =
        "❌ تم إرسال محاولات كثيرة. حاول لاحقاً.";

      return;
    }


    if (
      error.code ===
      "auth/quota-exceeded"
    ) {

      status.innerHTML =
        "❌ تم الوصول إلى الحد المتاح لرسائل SMS.";

      return;
    }


    if (
      error.code ===
      "auth/operation-not-allowed"
    ) {

      status.innerHTML =
        "❌ تسجيل الدخول برقم الهاتف غير مفعل.";

      return;
    }


    if (
      error.code ===
      "auth/invalid-phone-number"
    ) {

      status.innerHTML =
        "❌ رقم الهاتف غير صحيح.";

      return;
    }


    status.innerHTML =
      "❌ " +
      (
        error.code ||
        "UNKNOWN"
      ) +
      "<br><br>" +
      (
        error.message ||
        "تعذر إرسال رمز التحقق."
      );
  }
};


// =====================================
// شاشة رمز SMS
// =====================================

function showCodeScreen(phone) {

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
        رمز التحقق
      </h2>

      <p style="text-align:center;">
        تم إرسال رمز SMS إلى
        <br>
        <b>
          ${escapeHtml(phone)}
        </b>
      </p>

      <input
        id="verificationCode"
        inputmode="numeric"
        maxlength="6"
        placeholder="أدخل الرمز"
        style="
          width:100%;
          box-sizing:border-box;
          padding:15px;
          border-radius:10px;
          border:1px solid #555;
          margin:10px 0;
          font-size:22px;
          text-align:center;
          direction:ltr;
        "
      >

      <button
        onclick="verifyPhoneCode()"
        style="
          width:100%;
          padding:15px;
          border:0;
          border-radius:10px;
          background:#00643e;
          color:white;
          font-size:18px;
        "
      >
        تأكيد الرمز
      </button>

      <p
        id="verifyStatus"
        style="
          text-align:center;
          margin-top:15px;
        "
      ></p>

    </div>

  `);
}


// =====================================
// تأكيد رمز SMS
// =====================================

window.verifyPhoneCode =
async function () {

  const codeInput =
    document.getElementById(
      "verificationCode"
    );


  const status =
    document.getElementById(
      "verifyStatus"
    );


  if (
    !codeInput ||
    !status
  ) {
    return;
  }


  if (!confirmationResult) {

    status.innerHTML =
      "❌ أعد إرسال رمز التحقق.";

    return;
  }


  const code =
    codeInput.value.trim();


  if (
    code.length !== 6
  ) {

    status.innerHTML =
      "❌ أدخل رمز التحقق المكون من 6 أرقام.";

    return;
  }


  try {

    status.innerHTML =
      "جاري التحقق...";


    const result =
      await confirmationResult
        .confirm(code);


    await ensureUserProfile(
      result.user
    );


    status.innerHTML =
      "✅ تم تسجيل الدخول بنجاح";


    setTimeout(
      async () => {

        await showAccount();

      },
      700
    );

  } catch (error) {

    console.error(
      "VERIFY CODE ERROR:",
      error
    );


    status.innerHTML =
      "❌ رمز التحقق غير صحيح أو انتهت صلاحيته.";
  }
};


// =====================================
// تسجيل الخروج
// =====================================

window.logoutUser =
async function () {

  try {

    await signOut(auth);


    window.closeModal();


    alert(
      "تم تسجيل الخروج."
    );

  } catch (error) {

    console.error(
      error
    );


    alert(
      "تعذر تسجيل الخروج."
    );
  }
};


// =====================================
// متابعة حالة المستخدم
// =====================================

onAuthStateChanged(
  auth,
  async user => {

    const loginButton =
      document.querySelector(
        ".login"
      );


    if (user) {

      await ensureUserProfile(
        user
      );


      if (loginButton) {

        loginButton.textContent =
          "✅ حسابي";
      }

    } else {

      if (loginButton) {

        loginButton.textContent =
          "تسجيل الدخول";
      }
    }
  }
);


// =====================================
// إنشاء قسم Firebase
// =====================================

function createFirebaseArea() {

  let area =
    document.getElementById(
      "firebase-market"
    );


  if (area) {
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
        font-size:30px;
      ">
        سوق الحلال المباشر
      </h2>

      <p
        id="firebase-status"
        style="
          text-align:center;
          color:#aaa;
        "
      >
        جاري الاتصال بقاعدة البيانات...
      </p>


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


  const target =
    document.querySelector(
      "main"
    ) ||
    document.body;


  target.appendChild(
    area
  );


  return area;
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
    "جاري تحديث بيانات السوق...";


  try {

    // =====================================
    // الحيوانات
    // =====================================

    const animalSnapshot =
      await getDocs(
        collection(
          db,
          "animals"
        )
      );


    const animals = {};


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
    // البيع المباشر
    // =====================================

    const directAnimals =
      Object.values(
        animals
      )
      .filter(
        animal =>
          animal.saleType ===
          "direct"
      );


    if (
      directAnimals.length === 0
    ) {

      directContainer.innerHTML = `

        <div style="
          background:#222;
          color:white;
          padding:20px;
          border-radius:15px;
          text-align:center;
        ">
          لا توجد عروض بيع مباشر حالياً
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

            <div style="
              font-size:90px;
              text-align:center;
              background:#10271c;
              border-radius:14px;
              padding:20px;
            ">
              ${animalIcon(animal.type)}
            </div>

            <h3>
              ${escapeHtml(
                animal.name ||
                animal.type ||
                "حلال للبيع"
              )}
            </h3>

            ${
              animal.breed
                ? `
                  <p>
                    السلالة:
                    ${escapeHtml(animal.breed)}
                  </p>
                `
                : ""
            }

            ${
              animal.age
                ? `
                  <p>
                    العمر:
                    ${escapeHtml(animal.age)}
                  </p>
                `
                : ""
            }

            <p>
              📍
              ${escapeHtml(
                animal.location ||
                "الذيد"
              )}
            </p>

            <div style="
              font-size:25px;
              font-weight:bold;
              color:#68e6b0;
              margin:15px 0;
            ">
              ${money(animal.price)}
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
                font-size:17px;
              "
            >
              طلب شراء
            </button>

          </div>

        `)
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


    const auctions = [];


    auctionSnapshot.forEach(
      auctionDoc => {

        auctions.push({

          id:
            auctionDoc.id,

          ...auctionDoc.data()
        });
      }
    );


    const activeAuctions =
      auctions.filter(
        auction =>
          auction.status ===
          "active"
      );


    if (
      activeAuctions.length === 0
    ) {

      auctionContainer.innerHTML = `

        <div style="
          background:#222;
          color:white;
          padding:20px;
          border-radius:15px;
          text-align:center;
        ">
          لا توجد مزادات حالياً
        </div>

      `;

    } else {

      auctionContainer.innerHTML =
        activeAuctions
          .map(
            auction => {

              const animal =
                animals[
                  auction.animalId
                ] || {};


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
                !endMillis ||
                endMillis <=
                Date.now();


              const timerText =
                getCountdownText(
                  auction.endTime
                );


              return `

                <div style="
                  background:#222;
                  color:white;
                  padding:20px;
                  border-radius:18px;
                ">

                  <div style="
                    font-size:90px;
                    text-align:center;
                    background:#10271c;
                    border-radius:14px;
                    padding:20px;
                  ">
                    ${animalIcon(animal.type)}
                  </div>


                  <div
                    id="auction-tag-${auction.id}"
                    style="
                      display:inline-block;
                      background:${expired ? "#6d2929" : "#00643e"};
                      padding:6px 12px;
                      border-radius:20px;
                      margin-top:12px;
                    "
                  >
                    ${
                      expired
                        ? "مزاد منتهي"
                        : "مزاد نشط"
                    }
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
                      ? `
                        <p>
                          السلالة:
                          ${escapeHtml(animal.breed)}
                        </p>
                      `
                      : ""
                  }


                  ${
                    animal.age
                      ? `
                        <p>
                          العمر:
                          ${escapeHtml(animal.age)}
                        </p>
                      `
                      : ""
                  }


                  <p>
                    📍
                    ${escapeHtml(
                      animal.location ||
                      "الذيد - الشارقة"
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
                    !expired
                      ? `
                        <p>
                          الحد الأدنى للمزايدة القادمة:
                          <b>
                            ${money(
                              minimumNextBid
                            )}
                          </b>
                        </p>
                      `
                      : `
                        <p style="
                          color:#ffb0b0;
                          font-weight:bold;
                        ">
                          تم إغلاق استقبال المزايدات
                        </p>
                      `
                  }


                  <div
                    data-auction-end="${endMillis}"
                    data-auction-id="${auction.id}"
                    style="
                      font-size:20px;
                      font-weight:bold;
                      margin:18px 0;
                      color:${expired ? "#ff8d8d" : "#ffd66b"};
                      text-align:center;
                    "
                  >
                    ${
                      expired
                        ? "⛔ انتهى المزاد"
                        : "⏱ " + timerText
                    }
                  </div>


                  <p style="
                    font-size:14px;
                    color:#aaa;
                    text-align:center;
                  ">
                    موعد الانتهاء:
                    ${formatDate(
                      auction.endTime
                    )}
                  </p>


                  <button
                    id="bid-button-${auction.id}"
                    onclick="placeBid('${auction.id}')"
                    ${expired ? "disabled" : ""}
                    style="
                      width:100%;
                      background:${expired ? "#555" : "#984d00"};
                      color:white;
                      border:0;
                      padding:16px;
                      border-radius:10px;
                      font-size:19px;
                      font-weight:bold;
                    "
                  >
                    ${
                      expired
                        ? "انتهى المزاد"
                        : "زايد الآن"
                    }
                  </button>

                </div>

              `;
            }
          )
          .join("");
    }


    status.innerHTML =
      `✅ متصل بالسوق — الحيوانات: ${
        Object.keys(
          animals
        ).length
      } — المزادات: ${
        auctions.length
      }`;


    // تشغيل العداد بعد إنشاء البطاقات

    startAuctionTimers();

  } catch (error) {

    console.error(
      "LOAD MARKET ERROR:",
      error
    );


    status.innerHTML =
      "❌ حدث خطأ أثناء تحميل بيانات السوق";
  }
}


// =====================================
// طلب شراء
// =====================================

window.requestPurchase =
function (animalId) {

  if (!auth.currentUser) {

    alert(
      "يجب تسجيل الدخول أولاً لإرسال طلب شراء."
    );


    window.openLogin();

    return;
  }


  alert(
    "✅ تم تسجيل طلبك المبدئي.\n\n" +
    "رقم الحيوان: " +
    animalId
  );
};


// =====================================
// المزايدة
// =====================================

window.placeBid =
async function (auctionId) {

  if (!auth.currentUser) {

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


    // =====================================
    // قراءة أحدث سعر قبل فتح نافذة المزايدة
    // =====================================

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


    // =====================================
    // إدخال المبلغ
    // =====================================

    const enteredValue =
      prompt(
        "أدخل مبلغ المزايدة الجديدة بالدرهم\n\n" +
        "الحد الأدنى المقبول: " +
        money(minimumBid),

        minimumBid
      );


    if (
      enteredValue === null
    ) {
      return;
    }


    const bidAmount =
      Number(
        String(
          enteredValue
        )
          .replace(/,/g, "")
          .trim()
      );


    if (
      !Number.isFinite(
        bidAmount
      ) ||
      bidAmount <= 0
    ) {

      alert(
        "يرجى إدخال مبلغ صحيح."
      );

      return;
    }


    // =====================================
    // تنفيذ المزايدة
    // =====================================

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
          auction.status !==
          "active"
        ) {

          throw new Error(
            "AUCTION_NOT_ACTIVE"
          );
        }


        // التحقق من انتهاء الوقت مرة ثانية
        // قبل حفظ المزايدة فعلياً

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

  } catch (error) {

    console.error(
      "BID ERROR:",
      error
    );


    if (
      error.message &&
      error.message.startsWith(
        "BID_TOO_LOW:"
      )
    ) {

      const required =
        error.message
          .split(":")[1];


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
        "⛔ انتهى وقت المزاد ولا يمكن تسجيل مزايدات جديدة."
      );


      await loadMarket();

      return;
    }


    if (
      error.message ===
      "AUCTION_NOT_ACTIVE"
    ) {

      alert(
        "هذا المزاد غير نشط حالياً."
      );

      return;
    }


    if (
      error.message ===
      "AUCTION_NOT_FOUND"
    ) {

      alert(
        "لم يتم العثور على المزاد."
      );

      return;
    }


    alert(
      "❌ لم يتم حفظ المزايدة."
    );
  }
};


// =====================================
// إضافة حلال جديد
// بيع مباشر أو مزاد إلكتروني
// =====================================

window.saveListing =
async function (event) {

  event.preventDefault();


  const user =
    auth.currentUser;


  if (!user) {

    alert(
      "يجب تسجيل الدخول أولاً لإضافة الحلال."
    );


    window.openLogin();

    return;
  }


  try {

    const profile =
      await getUserProfile();


    if (!profile) {

      alert(
        "تعذر قراءة بيانات الحساب."
      );

      return;
    }


    // =====================================
    // صلاحية البائع
    // =====================================

    if (
      profile.accountType !==
        "seller" &&
      profile.accountType !==
        "both"
    ) {

      alert(
        "لإضافة الحلال يجب تغيير استخدام الحساب إلى بائع أو بائع ومشتري من صفحة حسابي."
      );


      await showAccount();

      return;
    }


    // =====================================
    // قراءة البيانات
    // =====================================

    const type =
      document
        .getElementById(
          "animalType"
        )
        ?.value ||
      "";


    const breed =
      document
        .getElementById(
          "animalBreed"
        )
        ?.value
        .trim() ||
      "";


    const age =
      document
        .getElementById(
          "animalAge"
        )
        ?.value
        .trim() ||
      "";


    const location =
      document
        .getElementById(
          "animalLocation"
        )
        ?.value
        .trim() ||
      "الذيد";


    const method =
      document
        .getElementById(
          "method"
        )
        ?.value ||
      "";


    const price =
      Number(
        document
          .getElementById(
            "animalPrice"
          )
          ?.value
      );


    const description =
      document
        .getElementById(
          "animalDescription"
        )
        ?.value
        .trim() ||
      "";


    // =====================================
    // أنواع الحيوانات
    // =====================================

    const allowedTypes = [
      "ناقة",
      "غنم",
      "ماعز",
      "بقر",
      "دجاج",
      "صقور",
      "غزال",
      "نعام",
      "حمام"
    ];


    if (
      !type ||
      !allowedTypes.includes(
        type
      )
    ) {

      alert(
        "يرجى اختيار نوع الحيوان."
      );

      return;
    }


    // =====================================
    // التحقق من السعر
    // =====================================

    if (
      !Number.isFinite(
        price
      ) ||
      price <= 0
    ) {

      alert(
        method ===
          "مزاد إلكتروني"
          ?
          "يرجى إدخال سعر بداية صحيح للمزاد."
          :
          "يرجى إدخال سعر بيع صحيح."
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

      const animalData = {

        name:
          type,

        type:
          type,

        breed:
          breed,

        age:
          age,

        location:
          location,

        saleType:
          "direct",

        price:
          price,

        description:
          description,

        sellerId:
          user.uid,

        sellerName:
          profile.displayName ||
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
      };


      const animalRef =
        await addDoc(
          collection(
            db,
            "animals"
          ),
          animalData
        );


      alert(
        "✅ تم إضافة الحلال بنجاح\n\n" +
        "طريقة البيع: بيع مباشر\n\n" +
        "نوع الحيوان: " +
        type +
        "\n\nالسعر: " +
        money(price) +
        "\n\nرقم العرض:\n" +
        animalRef.id
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
          document
            .getElementById(
              "auctionIncrement"
            )
            ?.value
        );


      const endTimeValue =
        document
          .getElementById(
            "auctionEndTime"
          )
          ?.value ||
        "";


      // أقل زيادة

      if (
        !Number.isFinite(
          increment
        ) ||
        increment <= 0
      ) {

        alert(
          "يرجى إدخال أقل زيادة صحيحة للمزايدة."
        );

        return;
      }


      // تاريخ الانتهاء

      if (!endTimeValue) {

        alert(
          "يرجى تحديد تاريخ ووقت انتهاء المزاد."
        );

        return;
      }


      const endTime =
        new Date(
          endTimeValue
        );


      if (
        Number.isNaN(
          endTime.getTime()
        )
      ) {

        alert(
          "تاريخ انتهاء المزاد غير صحيح."
        );

        return;
      }


      if (
        endTime.getTime() <=
        Date.now()
      ) {

        alert(
          "يجب أن يكون وقت انتهاء المزاد في المستقبل."
        );

        return;
      }


      // =====================================
      // إنشاء معرفات المستندات
      // =====================================

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


      // =====================================
      // بيانات الحيوان
      // =====================================

      const animalData = {

        name:
          type,

        type:
          type,

        breed:
          breed,

        age:
          age,

        location:
          location,

        saleType:
          "auction",

        price:
          price,

        description:
          description,

        sellerId:
          user.uid,

        sellerName:
          profile.displayName ||
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
      };


      // =====================================
      // بيانات المزاد
      // =====================================

      const auctionData = {

        animalId:
          animalRef.id,

        sellerId:
          user.uid,

        sellerName:
          profile.displayName ||
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

        endTime:
          endTime,

        status:
          "active",

        createdAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp()
      };


      // =====================================
      // حفظ الحيوان والمزاد معاً
      // =====================================

      const batch =
        writeBatch(
          db
        );


      batch.set(
        animalRef,
        animalData
      );


      batch.set(
        auctionRef,
        auctionData
      );


      await batch.commit();


      alert(
        "✅ تم إنشاء المزاد الإلكتروني بنجاح\n\n" +
        "نوع الحيوان: " +
        type +
        "\n\nسعر البداية: " +
        money(price) +
        "\n\nأقل زيادة: " +
        money(increment) +
        "\n\nينتهي: " +
        endTime.toLocaleString(
          "ar-AE"
        ) +
        "\n\nرقم المزاد:\n" +
        auctionRef.id
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

  } catch (error) {

    console.error(
      "SAVE LISTING ERROR:",
      error
    );


    if (
      error.code ===
      "permission-denied"
    ) {

      alert(
        "❌ Firebase رفض إنشاء العرض.\n\n" +
        "تحقق من صلاحيات الحساب وقواعد Firestore."
      );

      return;
    }


    alert(
      "❌ تعذر إضافة الحلال.\n\n" +
      (
        error.message ||
        "حدث خطأ غير معروف."
      )
    );
  }
};


// =====================================
// تنظيف نموذج إضافة الحلال
// =====================================

function resetListingForm(form) {

  if (form) {

    form.reset();
  }


  const locationInput =
    document.getElementById(
      "animalLocation"
    );


  if (locationInput) {

    locationInput.value =
      "الذيد";
  }


  const auctionFields =
    document.getElementById(
      "auctionFields"
    );


  if (auctionFields) {

    auctionFields.style.display =
      "none";
  }


  const priceInput =
    document.getElementById(
      "animalPrice"
    );


  if (priceInput) {

    priceInput.placeholder =
      "السعر بالدرهم";
  }


  const incrementInput =
    document.getElementById(
      "auctionIncrement"
    );


  if (incrementInput) {

    incrementInput.required =
      false;
  }


  const endTimeInput =
    document.getElementById(
      "auctionEndTime"
    );


  if (endTimeInput) {

    endTimeInput.required =
      false;
  }
}


// =====================================
// الانتقال إلى السوق
// =====================================

function scrollToMarket() {

  const market =
    document.getElementById(
      "firebase-market"
    );


  if (market) {

    market.scrollIntoView({
      behavior:
        "smooth"
    });
  }
}


// =====================================
// أزرار النسخة القديمة
// =====================================

window.bid =
function () {

  alert(
    "استخدم المزاد الحقيقي الموجود في قسم سوق الحلال المباشر."
  );
};


window.details =
function (name, price) {

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