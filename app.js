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
     