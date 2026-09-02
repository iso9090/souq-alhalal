import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  addDoc,
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


// =====================================
// أدوات مساعدة
// =====================================

function money(value) {
  return Number(value || 0)
    .toLocaleString("en-US") + " AED";
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
    type.includes("بقرة") ||
    type.includes("أبقار")
  ) {
    return "🐄";
  }

  return "🐾";
}


function formatDate(timestamp) {

  if (!timestamp || !timestamp.toDate) {
    return "غير محدد";
  }

  return timestamp
    .toDate()
    .toLocaleString("ar-AE", {
      dateStyle: "medium",
      timeStyle: "short"
    });
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

  if (type === "seller") {
    return "بائع";
  }

  if (type === "both") {
    return "بائع ومشتري";
  }

  return "مشتري";
}


// =====================================
// إنشاء حساب المستخدم
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
      await getDoc(userRef);


    if (!userSnap.exists()) {

      await setDoc(
        userRef,
        {
          uid: user.uid,

          phoneNumber:
            user.phoneNumber || "",

          displayName: "",

          accountType: "buyer",

          status: "active",

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
      await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    return {
      id: userSnap.id,
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
// النافذة
// =====================================

function showModal(html) {

  const modal =
    document.getElementById("modal");

  const content =
    document.getElementById(
      "modalContent"
    );

  if (!modal || !content) {
    return;
  }

  content.innerHTML = html;
  modal.style.display = "flex";
}


window.closeModal = function () {

  const modal =
    document.getElementById("modal");

  if (modal) {
    modal.style.display = "none";
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


  await ensureUserProfile(user);

  const profile =
    await getUserProfile();


  const displayName =
    profile?.displayName || "";

  const accountType =
    profile?.accountType || "buyer";

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

        <h2 style="
          color:#68e6b0;
        ">
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


  if (displayName.length < 2) {

    status.innerHTML =
      "❌ أدخل الاسم بشكل صحيح.";

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
        displayName,
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

  } catch (error) {

    console.error(error);

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


  if (!input || !status) {
    return;
  }


  let phone =
    input.value
      .replace(/\s+/g, "")
      .replace(/-/g, "");


  if (phone.startsWith("05")) {

    phone =
      "+971" +
      phone.substring(1);
  }


  if (phone.startsWith("971")) {

    phone =
      "+" + phone;
  }


  if (!phone.startsWith("+9715")) {

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


    showCodeScreen(phone);

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
      "auth/too-many-requests"
    ) {

      status.innerHTML =
        "❌ auth/too-many-requests<br>" +
        "تم إرسال محاولات كثيرة. حاول لاحقاً.";

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


    status.innerHTML =
      "❌ " +
      (
        error.code ||
        "UNKNOWN"
      ) +
      "<br>" +
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
        <b>${escapeHtml(phone)}</b>
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
          margin:10px 0;
          font-size:22px;
          text-align:center;
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
        style="text-align:center;"
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


  if (!codeInput || !status) {
    return;
  }


  if (!confirmationResult) {

    status.innerHTML =
      "❌ أعد إرسال رمز التحقق.";

    return;
  }


  const code =
    codeInput.value.trim();


  if (code.length !== 6) {

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

    console.error(error);

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

    console.error(error);

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

      await ensureUserProfile(user);

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
    document.querySelector("main") ||
    document.body;


  target.appendChild(area);

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


  status.innerHTML =
    "جاري تحديث بيانات السوق...";


  try {

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

        animals[animalDoc.id] = {
          id: animalDoc.id,
          ...animalDoc.data()
        };
      }
    );


    const directAnimals =
      Object.values(animals)
        .filter(
          animal =>
            animal.saleType ===
            "direct"
        );


    if (directAnimals.length === 0) {

      directContainer.innerHTML =
        "<p>لا توجد عروض بيع مباشر حالياً</p>";

    } else {

      directContainer.innerHTML =
        directAnimals.map(
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
                  "حلال للبيع"
                )}
              </h3>

              <p>
                📍
                ${escapeHtml(
                  animal.location ||
                  "الذيد - الشارقة"
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
                onclick="
                  requestPurchase(
                    '${animal.id}'
                  )
                "
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

          `
        ).join("");
    }


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
          id: auctionDoc.id,
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


    if (activeAuctions.length === 0) {

      auctionContainer.innerHTML =
        "<p>لا توجد مزادات نشطة حالياً</p>";

    } else {

      auctionContainer.innerHTML =
        activeAuctions.map(
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

                <h3>
                  ${escapeHtml(
                    animal.name ||
                    "مزاد حلال"
                  )}
                </h3>

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
                    ${money(increment)}
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
                  ${money(currentPrice)}
                </div>

                <p>
                  الحد الأدنى للمزايدة القادمة:
                  <b>
                    ${money(minimumNextBid)}
                  </b>
                </p>

                <p>
                  ⏱ ينتهي:
                  ${formatDate(
                    auction.endTime
                  )}
                </p>

                <button
                  onclick="
                    placeBid(
                      '${auction.id}'
                    )
                  "
                  style="
                    width:100%;
                    background:#984d00;
                    color:white;
                    border:0;
                    padding:16px;
                    border-radius:10px;
                    font-size:19px;
                  "
                >
                  زايد الآن
                </button>

              </div>

            `;
          }
        ).join("");
    }


    status.innerHTML =
      `✅ متصل بالسوق — الحيوانات: ${
        Object.keys(animals).length
      } — المزادات: ${
        auctions.length
      }`;

  } catch (error) {

    console.error(error);

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


    let minimumBid = 0;


    await runTransaction(
      db,
      async transaction => {

        const auctionSnap =
          await transaction.get(
            auctionRef
          );


        if (!auctionSnap.exists()) {

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
        money(minimumBid),

        minimumBid
      );


    if (enteredValue === null) {
      return;
    }


    const bidAmount =
      Number(
        String(enteredValue)
          .replace(/,/g, "")
          .trim()
      );


    if (
      !Number.isFinite(bidAmount) ||
      bidAmount <= 0
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


        if (!auctionSnap.exists()) {

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
              auth.currentUser.phoneNumber ||
              ""
          }
        );
      }
    );


    alert(
      "✅ تمت المزايدة بنجاح\n\n" +
      "السعر الجديد: " +
      money(bidAmount)
    );


    await loadMarket();

  } catch (error) {

    console.error(error);


    if (
      error.message &&
      error.message.startsWith(
        "BID_TOO_LOW:"
      )
    ) {

      const required =
        error.message.split(":")[1];


      alert(
        "❌ تم تسجيل مزايدة أعلى قبلك.\n\n" +
        "الحد الأدنى الجديد: " +
        money(required)
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


    if (
      profile.accountType !== "seller" &&
      profile.accountType !== "both"
    ) {

      alert(
        "لإضافة الحلال يجب تغيير استخدام الحساب إلى بائع أو بائع ومشتري من صفحة حسابي."
      );

      await showAccount();

      return;
    }


    const form =
      event.target;


    const inputs =
      form.querySelectorAll(
        "input"
      );


    const select =
      form.querySelector(
        "#method"
      );


    const textarea =
      form.querySelector(
        "textarea"
      );


    if (
      inputs.length < 5 ||
      !select
    ) {

      alert(
        "تعذر قراءة نموذج إضافة الحلال."
      );

      return;
    }


    const type =
      inputs[0].value.trim();

    const breed =
      inputs[1].value.trim();

    const age =
      inputs[2].value.trim();

    const location =
      inputs[3].value.trim();

    const price =
      Number(
        inputs[4].value
      );

    const method =
      select.value;

    const description =
      textarea
        ? textarea.value.trim()
        : "";


    if (!type) {

      alert(
        "يرجى إدخال نوع الحيوان."
      );

      return;
    }


    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {

      alert(
        "يرجى إدخال سعر صحيح."
      );

      return;
    }


    // في هذه المرحلة نفعّل البيع المباشر
    // المزاد سيتم ربطه في الخطوة التالية

    if (
      method === "مزاد إلكتروني"
    ) {

      alert(
        "سنقوم بتفعيل إنشاء المزاد الإلكتروني في الخطوة التالية.\n\nاختر البيع المباشر الآن لاختبار إضافة الحلال."
      );

      return;
    }


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
        location ||
        "الذيد - الشارقة",

      saleType:
        "direct",

      price:
        price,

      description:
        description,

      sellerId:
        user.uid,

      sellerName:
        profile.displayName || "",

      sellerPhone:
        user.phoneNumber || "",

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
      "رقم العرض:\n" +
      animalRef.id
    );


    form.reset();


    const locationInput =
      form.querySelectorAll(
        "input"
      )[3];


    if (locationInput) {

      locationInput.value =
        "الذيد";
    }


    await loadMarket();

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
        "❌ Firebase رفض إضافة الحلال.\n\nتحقق من قواعد Firestore."
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