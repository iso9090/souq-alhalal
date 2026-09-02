import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
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
  return Number(value || 0).toLocaleString("en-US") + " AED";
}

function animalIcon(type = "") {

  if (
    type.includes("ناقة") ||
    type.includes("جمل") ||
    type.includes("إبل")
  ) return "🐫";

  if (
    type.includes("خروف") ||
    type.includes("غنم")
  ) return "🐑";

  if (type.includes("ماعز")) return "🐐";

  if (
    type.includes("بقرة") ||
    type.includes("أبقار")
  ) return "🐄";

  return "🐾";
}

function formatDate(timestamp) {

  if (!timestamp || !timestamp.toDate) {
    return "غير محدد";
  }

  return timestamp.toDate().toLocaleString("ar-AE", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}


// =====================================
// النافذة
// =====================================

function showModal(html) {

  const modal = document.getElementById("modal");
  const content = document.getElementById("modalContent");

  if (!modal || !content) return;

  content.innerHTML = html;
  modal.style.display = "flex";
}

window.closeModal = function () {

  const modal = document.getElementById("modal");

  if (modal) {
    modal.style.display = "none";
  }
};


// =====================================
// تسجيل الدخول برقم الهاتف
// =====================================

window.openLogin = function () {

  if (auth.currentUser) {

    const phone =
      auth.currentUser.phoneNumber || "المستخدم";

    showModal(`
      <div style="
        direction:rtl;
        text-align:center;
        color:white;
        padding:10px;
      ">

        <h2 style="color:#68e6b0;">
          ✅ تم تسجيل الدخول
        </h2>

        <p>
          ${phone}
        </p>

        <button
          onclick="logoutUser()"
          style="
            width:100%;
            padding:14px;
            margin-top:15px;
            border:0;
            border-radius:10px;
            background:#9d2b2b;
            color:white;
            font-size:18px;
          "
        >
          تسجيل الخروج
        </button>

      </div>
    `);

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
        "
      ></p>

    </div>
  `);
};


window.sendPhoneCode = async function () {

  const input =
    document.getElementById("phoneNumber");

  const status =
    document.getElementById("loginStatus");

  if (!input) return;


  let phone =
    input.value
      .replace(/\s+/g, "")
      .replace(/-/g, "");


  // تحويل 05xxxxxxxx إلى +9715xxxxxxxx
  if (phone.startsWith("05")) {
    phone = "+971" + phone.substring(1);
  }

  if (phone.startsWith("971")) {
    phone = "+" + phone;
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

  }

  catch (error) {

    console.error(error);

    if (error.code === "auth/unauthorized-domain") {

      status.innerHTML =
        "❌ يجب إضافة نطاق GitHub Pages إلى Authorized domains في Firebase.";

      return;
    }

    if (error.code === "auth/too-many-requests") {

      status.innerHTML =
        "❌ تم إرسال محاولات كثيرة. حاول لاحقاً.";

      return;
    }

    if (error.code === "auth/quota-exceeded") {

      status.innerHTML =
        "❌ تم الوصول إلى الحد اليومي لرسائل SMS.";

      return;
    }

    status.innerHTML =
      "❌ تعذر إرسال رمز التحقق.";
  }
};


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
        <b>${phone}</b>
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


window.verifyPhoneCode = async function () {

  const codeInput =
    document.getElementById("verificationCode");

  const status =
    document.getElementById("verifyStatus");


  if (!confirmationResult) {

    status.innerHTML =
      "❌ أعد إرسال رمز التحقق.";

    return;
  }


  const code =
    codeInput.value.trim();


  if (code.length < 6) {

    status.innerHTML =
      "❌ أدخل رمز التحقق المكون من 6 أرقام.";

    return;
  }


  try {

    status.innerHTML =
      "جاري التحقق...";


    await confirmationResult.confirm(code);


    status.innerHTML =
      "✅ تم تسجيل الدخول بنجاح";


    setTimeout(() => {

      window.closeModal();

    }, 800);

  }

  catch (error) {

    console.error(error);

    status.innerHTML =
      "❌ رمز التحقق غير صحيح أو انتهت صلاحيته.";
  }
};


window.logoutUser = async function () {

  await signOut(auth);

  window.closeModal();

  alert("تم تسجيل الخروج.");
};


// =====================================
// متابعة حالة المستخدم
// =====================================

onAuthStateChanged(auth, user => {

  const loginButton =
    document.querySelector(".login");

  if (!loginButton) return;


  if (user) {

    loginButton.textContent =
      "✅ حسابي";

  } else {

    loginButton.textContent =
      "تسجيل الدخول";
  }
});


// =====================================
// إنشاء قسم Firebase
// =====================================

function createFirebaseArea() {

  let area =
    document.getElementById("firebase-market");

  if (area) return area;


  area =
    document.createElement("section");

  area.id =
    "firebase-market";


  area.innerHTML = `

    <div style="
      max-width:1100px;
      margin:35px auto;
      padding:20px;
      direction:rtl;
      font-family:Arial,Tahoma,sans-serif;
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
          grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
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
          grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
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
// تحميل الحيوانات والمزادات
// =====================================

async function loadMarket() {

  createFirebaseArea();


  const status =
    document.getElementById("firebase-status");

  const directContainer =
    document.getElementById("direct-sales");

  const auctionContainer =
    document.getElementById("auction-list");


  status.innerHTML =
    "جاري تحديث بيانات السوق...";


  try {

    const animalSnapshot =
      await getDocs(
        collection(db, "animals")
      );


    const animals = {};


    animalSnapshot.forEach(animalDoc => {

      animals[animalDoc.id] = {
        id: animalDoc.id,
        ...animalDoc.data()
      };

    });


    const directAnimals =
      Object.values(animals).filter(
        animal =>
          animal.saleType === "direct"
      );


    if (directAnimals.length === 0) {

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
        directAnimals.map(animal => `

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
              ${animal.name || "حلال للبيع"}
            </h3>

            <p>
              📍 ${animal.location || "الذيد - الشارقة"}
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

        `).join("");
    }


    const auctionSnapshot =
      await getDocs(
        collection(db, "auctions")
      );


    const auctions = [];


    auctionSnapshot.forEach(auctionDoc => {

      auctions.push({
        id: auctionDoc.id,
        ...auctionDoc.data()
      });

    });


    const activeAuctions =
      auctions.filter(
        auction =>
          auction.status === "active"
      );


    if (activeAuctions.length === 0) {

      auctionContainer.innerHTML = `

        <div style="
          background:#222;
          color:white;
          padding:20px;
          border-radius:15px;
          text-align:center;
        ">
          لا توجد مزادات نشطة حالياً
        </div>
      `;

    } else {

      auctionContainer.innerHTML =
        activeAuctions.map(auction => {

          const animal =
            animals[auction.animalId] || {};

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
            currentPrice + increment;


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

              <div style="
                display:inline-block;
                background:#00643e;
                padding:6px 12px;
                border-radius:20px;
                margin-top:12px;
              ">
                مزاد نشط
              </div>

              <h3>
                ${animal.name || "مزاد حلال"}
              </h3>

              <p>
                📍 ${animal.location || "الذيد - الشارقة"}
              </p>

              <p>
                سعر البداية:
                <b>${money(auction.startPrice)}</b>
              </p>

              <p>
                أقل زيادة:
                <b>${money(increment)}</b>
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
                <b>${money(minimumNextBid)}</b>
              </p>

              <p>
                ⏱ ينتهي:
                ${formatDate(auction.endTime)}
              </p>

              <button
                onclick="placeBid('${auction.id}')"
                style="
                  width:100%;
                  background:#984d00;
                  color:white;
                  border:0;
                  padding:16px;
                  border-radius:10px;
                  font-size:19px;
                  font-weight:bold;
                "
              >
                زايد الآن
              </button>

            </div>
          `;

        }).join("");
    }


    status.innerHTML =
      `✅ متصل بالسوق — الحيوانات: ${Object.keys(animals).length} — المزادات: ${auctions.length}`;

  }

  catch (error) {

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
          throw new Error("AUCTION_NOT_FOUND");
        }


        const auction =
          auctionSnap.data();


        if (auction.status !== "active") {
          throw new Error("AUCTION_NOT_ACTIVE");
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
          currentPrice + increment;
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
          throw new Error("AUCTION_NOT_FOUND");
        }


        const auction =
          auctionSnap.data();


        if (auction.status !== "active") {
          throw new Error("AUCTION_NOT_ACTIVE");
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
          currentPrice + increment;


        if (bidAmount < requiredBid) {

          throw new Error(
            "BID_TOO_LOW:" +
            requiredBid
          );
        }


        transaction.update(
          auctionRef,
          {
            currentPrice: bidAmount,
            lastBidAt: serverTimestamp(),
            lastBidderId: auth.currentUser.uid,
            lastBidderPhone:
              auth.currentUser.phoneNumber || ""
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

  }

  catch (error) {

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
// أزرار النسخة القديمة
// =====================================

window.bid = function () {
  alert(
    "استخدم المزاد الحقيقي الموجود في قسم سوق الحلال المباشر."
  );
};

window.details = function (name, price) {
  alert(
    name +
    "\nالسعر: " +
    price +
    " AED"
  );
};

window.saveListing = function (event) {

  event.preventDefault();

  alert(
    "سيتم ربط إضافة الحلال بحساب البائع في الخطوة القادمة."
  );
};


// =====================================
// تشغيل السوق
// =====================================

loadMarket();