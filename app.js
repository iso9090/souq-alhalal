import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

// إعدادات Firebase لمشروع سوق الحلال
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


// ===============================
// أدوات مساعدة
// ===============================

function money(value) {
  return Number(value || 0).toLocaleString("en-US") + " AED";
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


// ===============================
// إنشاء مكان عرض البيانات
// ===============================

function createFirebaseArea() {

  let area = document.getElementById("firebase-market");

  if (area) return area;

  area = document.createElement("section");
  area.id = "firebase-market";

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
        color:#0b5d3b;
        font-size:30px;
      ">
        سوق الحلال المباشر
      </h2>

      <p id="firebase-status" style="
        text-align:center;
        color:#777;
      ">
        جاري الاتصال بقاعدة البيانات...
      </p>


      <h2 style="
        margin-top:40px;
        color:#0b5d3b;
      ">
        🛒 البيع المباشر
      </h2>

      <div id="direct-sales" style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
        gap:20px;
      ">
      </div>


      <h2 style="
        margin-top:50px;
        color:#0b5d3b;
      ">
        🔨 المزاد الإلكتروني
      </h2>

      <div id="auction-list" style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
        gap:20px;
      ">
      </div>

    </div>
  `;

  const target =
    document.querySelector("main") ||
    document.body;

  target.appendChild(area);

  return area;
}


// ===============================
// تحميل الحيوانات والمزادات
// ===============================

async function loadMarket() {

  createFirebaseArea();

  const status =
    document.getElementById("firebase-status");

  const directContainer =
    document.getElementById("direct-sales");

  const auctionContainer =
    document.getElementById("auction-list");

  try {

    // الحيوانات
    const animalSnapshot =
      await getDocs(collection(db, "animals"));

    const animals = {};

    animalSnapshot.forEach(doc => {

      animals[doc.id] = {
        id: doc.id,
        ...doc.data()
      };

    });


    // ===============================
    // البيع المباشر
    // ===============================

    const directAnimals =
      Object.values(animals).filter(animal =>
        animal.saleType === "direct" &&
        animal.status === "available"
      );


    if (directAnimals.length === 0) {

      directContainer.innerHTML = `
        <div style="
          background:white;
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
            background:white;
            padding:20px;
            border-radius:18px;
            box-shadow:0 5px 20px rgba(0,0,0,.08);
          ">

            <div style="
              font-size:90px;
              text-align:center;
              background:#eef4ef;
              border-radius:14px;
              padding:20px;
            ">
              ${animalIcon(animal.type)}
            </div>

            <h3>
              ${animal.name || "حلال للبيع"}
            </h3>

            <p>
              النوع:
              ${animal.type || "-"}
            </p>

            <p>
              📍 ${animal.location || "الذيد - الشارقة"}
            </p>

            <div style="
              font-size:25px;
              font-weight:bold;
              color:#0b5d3b;
              margin:15px 0;
            ">
              ${money(animal.price)}
            </div>

            <button
              onclick="requestPurchase('${animal.id}')"
              style="
                width:100%;
                background:#0b5d3b;
                color:white;
                border:0;
                padding:14px;
                border-radius:10px;
                font-size:17px;
              ">
              طلب شراء
            </button>

          </div>

        `).join("");

    }


    // ===============================
    // المزادات
    // ===============================

    const auctionSnapshot =
      await getDocs(collection(db, "auctions"));

    const auctions = [];

    auctionSnapshot.forEach(doc => {

      auctions.push({
        id: doc.id,
        ...doc.data()
      });

    });


    const activeAuctions =
      auctions.filter(auction =>
        auction.status === "active"
      );


    if (activeAuctions.length === 0) {

      auctionContainer.innerHTML = `
        <div style="
          background:white;
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

          return `

            <div style="
              background:white;
              padding:20px;
              border-radius:18px;
              box-shadow:0 5px 20px rgba(0,0,0,.08);
            ">

              <div style="
                font-size:90px;
                text-align:center;
                background:#eef4ef;
                border-radius:14px;
                padding:20px;
              ">
                ${animalIcon(animal.type)}
              </div>

              <div style="
                display:inline-block;
                background:#0b5d3b;
                color:white;
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
                <b>${money(auction.minIncrement)}</b>
              </p>

              <div style="
                font-size:27px;
                color:#0b5d3b;
                font-weight:bold;
                margin:15px 0;
              ">
                السعر الحالي:
                ${money(auction.currentPrice)}
              </div>

              <p>
                ⏱ ينتهي:
                ${formatDate(auction.endTime)}
              </p>

              <button
                onclick="placeBid('${auction.id}', ${auction.currentPrice || 0}, ${auction.minIncrement || 0})"
                style="
                  width:100%;
                  background:#c38b2c;
                  color:white;
                  border:0;
                  padding:14px;
                  border-radius:10px;
                  font-size:17px;
                ">
                زايد الآن
              </button>

            </div>

          `;

        }).join("");

    }


    status.innerHTML =
      `✅ تم الاتصال بـ Firebase بنجاح — الحيوانات: ${Object.keys(animals).length} — المزادات: ${auctions.length}`;


  } catch (error) {

    console.error(error);

    status.innerHTML =
      "❌ حدث خطأ أثناء الاتصال بقاعدة البيانات";

  }

}


// ===============================
// أزرار النسخة التجريبية
// ===============================

window.requestPurchase = function(animalId) {

  alert(
    "تم اختيار الحيوان: " +
    animalId +
    "\\nسيتم تفعيل طلب الشراء بعد ربط حساب المستخدم."
  );

};


window.placeBid = function(
  auctionId,
  currentPrice,
  increment
) {

  const minimum =
    Number(currentPrice) +
    Number(increment);

  alert(
    "المزاد: " +
    auctionId +
    "\\nالحد الأدنى للمزايدة القادمة: " +
    money(minimum) +
    "\\nسنفعّل المزايدة الحقيقية في المرحلة التالية."
  );

};


// تشغيل السوق
loadMarket();