import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyDZhP6Kzoqchfmm5tj3EsBi8vt3m8EBC3k",
  authDomain: "souq-al-halal-9e3e8.firebaseapp.com",
  projectId: "souq-al-halal-9e3e8",
  storageBucket: "souq-al-halal-9e3e8.firebasestorage.app",
  messagingSenderId: "227281181881",
  appId: "1:227281181881:web:4ff800571b52a461bd8f68"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const status = document.getElementById("payment-status");
const requests = document.getElementById("payment-requests");
const names = { featured: "تمييز الإعلان", bump: "رفع الإعلان للأعلى", verification: "توثيق الحيوان" };
let revision = 0;
onAuthStateChanged(auth, async user => {
  const current = ++revision;
  requests.replaceChildren();
  if (!user) {
    status.textContent = "يرجى تسجيل الدخول من سوق الحلال الإلكتروني أولًا.";
    return;
  }
  status.textContent = "جاري تحميل طلباتك…";
  try {
    const snapshot = await getDocs(query(collection(db, "serviceRequests"), where("userId", "==", user.uid)));
    if (current !== revision || auth.currentUser?.uid !== user.uid) return;
    const pending = snapshot.docs.map(item => item.data()).filter(item =>
      item.status === "pending" && (!Object.hasOwn(item, "paymentStatus") || item.paymentStatus === "unpaid"));
    status.textContent = pending.length ? "طلبات خدماتك المعلقة وغير المدفوعة" : "لا توجد طلبات معلقة غير مدفوعة.";
    for (const request of pending) {
      const card = document.createElement("article");
      card.className = "demo-request";
      const heading = document.createElement("h2");
      heading.textContent = names[request.serviceType] || "خدمة اختيارية";
      const details = document.createElement("dl");
      for (const [label, value] of [["الإعلان / الهدف", request.targetName || request.targetId || "غير متاح"],
        ["الدولة", request.country === "EG" ? "مصر" : request.country === "AE" || !request.country ? "الإمارات" : "غير محددة"],
        ["السعر", Number.isFinite(request.amount) ? request.amount : "غير متاح"], ["العملة", request.currency || "غير متاحة"],
        ["الحالة", "قيد المراجعة"], ["حالة الدفع", "غير مدفوع"]]) {
        const term = document.createElement("dt"); term.textContent = label;
        const definition = document.createElement("dd"); definition.textContent = String(value);
        details.append(term, definition);
      }
      const button = document.createElement("button");
      button.type = "button"; button.textContent = "محاكاة الدفع";
      const result = document.createElement("p"); result.setAttribute("role", "status");
      button.addEventListener("click", () => {
        button.disabled = true;
        result.textContent = "نجحت محاكاة واجهة الدفع. لم يتم خصم أي مبلغ ولم تتغير حالة الدفع. عند تشغيل الدفع الحقيقي سيؤكد الخادم الموثوق العملية.";
      });
      card.append(heading, details, button, result); requests.append(card);
    }
  } catch (error) {
    if (current !== revision) return;
    console.error("DEMO READ ERROR", error);
    status.textContent = "تعذر تحميل الطلبات. تحقق من اتصالك وتسجيل دخولك ثم أعد تحميل الصفحة.";
  }
}, () => { requests.replaceChildren(); status.textContent = "تعذر التحقق من تسجيل الدخول. عد إلى الموقع وحاول مجددًا."; });
