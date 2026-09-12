import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {getFirestore,collection,doc,getDoc,getDocs,query,where,orderBy,startAfter,limit,setDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {installCommercialPublic} from './commercial-public.js';
const app=initializeApp({apiKey:'AIzaSyDZhP6Kzoqchfmm5tj3EsBi8vt3m8EBC3k',projectId:'souq-al-halal-9e3e8',appId:'1:227281181881:web:4ff800571b52a461bd8f68'},'commercial-telemetry');
installCommercialPublic({db:getFirestore(app),collection,doc,getDoc,getDocs,query,where,orderBy,startAfter,limit,setDoc,serverTimestamp}).catch(()=>{});
