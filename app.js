import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ===============================
// إعدادات Firebase
// ===============================

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

  return timestamp.toDate().toLocaleString("ar-AE", {
    dateStyle: "medium",
    timeStyle: "short"
  });

}


// ===============================
// إنشاء قسم Firebase
// ===============================

function createFirebaseArea() {

  let area =
    document.getElementById("firebase-market");

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
        color:#68e6b0;
        font-size:30px;
      ">
        سوق الحلال المباشر
      </h2>


      <p id="firebase-status" style="
        text-align:center;
        color:#aaa;
      ">
        جاري الاتصال بقاعدة البيانات...
      </p>


      <h2 style="
        margin-top:40px;
        color:#68e6b0;
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
        color:#68e6b0;
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
// تحميل السوق
// ===============================

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


    // ===============================
    // تحميل الحيوانات
    // ===============================

    const animalSnapshot =
      await getDocs(
        collection(db, "animals")
      );


    const animals = {};


    animalSnapshot.forEach((animalDoc) => {

      animals[animalDoc.id] = {

        id: animalDoc.id,

        ...animalDoc.data()

      };

    });


    // ===============================
    // البيع المباشر
    // ===============================

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

    }

    else {

      directContainer.innerHTML =
        directAnimals.map(animal => `

          <div style="
            background:#222;
            color:white;
            padding:20px;
            border-radius:18px;
            box-shadow:0 5px 20px rgba(0,0,0,.25);
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
              النوع:
              ${animal.type || "-"}
            </p>


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



    // ===============================
    // تحميل المزادات
    // ===============================

    const auctionSnapshot =
      await getDocs(
        collection(db, "auctions")
      );


    const auctions = [];


    auctionSnapshot.forEach((auctionDoc) => {

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

    }

    else {

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
              auction.minIncrement || 0
            );


          const minimumNextBid =
            currentPrice + increment;


          return `

            <div style="
              background:#222;
              color:white;
              padding:20px;
              border-radius:18px;
              box-shadow:0 5px 20px rgba(0,0,0,.25);
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
                <b>
                  ${money(auction.startPrice)}
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

      `✅ تم الاتصال بـ Firebase بنجاح — الحيوانات: ${Object.keys(animals).length} — المزادات: ${auctions.length}`;


  }

  catch (error) {

    console.error(error);


    status.innerHTML =

      "❌ حدث خطأ أثناء الاتصال بقاعدة البيانات";

  }

}



// ===============================
// طلب شراء
// ===============================

window.requestPurchase = function(animalId) {

  alert(

    "تم اختيار الحيوان: " +

    animalId +

    "\n\nسيتم تفعيل طلب الشراء بعد إضافة تسجيل المستخدمين."

  );

};



// ===============================
// المزايدة الحقيقية
// ===============================

window.placeBid = async function(auctionId) {


  try {


    const auctionRef =
      doc(
        db,
        "auctions",
        auctionId
      );


    // ===============================
    // قراءة المزاد قبل إدخال السعر
    // ===============================

    let minimumBid = 0;


    await runTransaction(
      db,
      async (transaction) => {


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


        if (auction.status !== "active") {

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


    // ===============================
    // طلب مبلغ المزايدة
    // ===============================

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



    // ===============================
    // حفظ المزايدة
    // ===============================

    await runTransaction(
      db,
      async (transaction) => {


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


        if (auction.status !== "active") {

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

            lastBidAt:
              serverTimestamp()

          }
        );

      }
    );



    alert(

      "✅ تمت المزايدة بنجاح\n\n" +

      "السعر الجديد: " +

      money(bidAmount)

    );


    // تحديث الموقع مباشرة

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

        "الحد الأدنى الجديد هو: " +

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

      "❌ لم يتم حفظ المزايدة.\n\n" +

      "سنراجع إعدادات Firebase إذا استمرت المشكلة."

    );

  }

};



// ===============================
// تشغيل السوق
// ===============================

loadMarket();