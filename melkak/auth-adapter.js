import {accessModel} from '../admin-permissions.js';

// Public web configuration of the existing application, not a second Firebase project.
const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyDZhP6Kzoqchfmm5tj3EsBi8vt3m8EBC3k',
  authDomain: 'souq-al-halal-9e3e8.firebaseapp.com',
  projectId: 'souq-al-halal-9e3e8',
  storageBucket: 'souq-al-halal-9e3e8.firebasestorage.app',
  messagingSenderId: '227281181881',
  appId: '1:227281181881:web:4ff800571b52a461bd8f68'
});
export async function loadFirebaseSdk() {
  const modules = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
  ]);
  return Object.assign({}, ...modules);
}
const guest = () => ({uid:null, role:null, permissions:[], protectedUids:[], ready:false, name:'', status:null, active:false});

/** Read-only account resolution; Firebase Rules remain authoritative for every data operation. */
export async function createFirebaseAuthAdapter({sdk} = {}) {
  sdk ||= await loadFirebaseSdk();
  const app = sdk.getApps().some(app => app.name === '[DEFAULT]') ? sdk.getApp() : sdk.initializeApp(firebaseConfig);
  if (app.options.projectId !== firebaseConfig.projectId) throw new Error('AUTH_PROJECT_MISMATCH');
  const auth = sdk.getAuth(app), db = sdk.getFirestore(app), listeners = new Set();
  let state = {status:'loading', user:null, actor:guest(), error:null}, version = 0, disposed = false;
  function publish(next) { state = next; for (const listener of listeners) listener(state); }
  async function resolve(user, forceRefresh = false) {
    const request = ++version;
    if (disposed) return;
    publish({status:user ? 'loading' : 'signed_out', user, actor:guest(), error:null});
    if (!user) return;
    try {
      const [token, profileSnapshot, record, config] = await Promise.all([
        sdk.getIdTokenResult(user, forceRefresh),
        sdk.getDoc(sdk.doc(db, 'users', user.uid)),
        sdk.getDoc(sdk.doc(db, 'adminAccess', user.uid)).then(s => s.data()).catch(() => null),
        sdk.getDoc(sdk.doc(db, 'adminSecurity', 'config')).then(s => s.data()).catch(() => null)
      ]);
      if (disposed || request !== version || auth.currentUser?.uid !== user.uid) return;
      const profile = profileSnapshot.data();
      const status = profile ? (profile.status ?? 'unknown_status') : 'missing_profile';
      const active = status === 'active';
      // Never use accessModel's historical null-config claim fallback after a failed read.
      const access = accessModel(user.uid, token.claims, {status}, record, config || {enabled:false, superAdminUids:[]});
      publish({status:'authenticated', user, profile:profile || null, actor:{...access, name:profile?.displayName || profile?.name || user.displayName || '', status, active}, error:null});
    } catch (error) {
      if (!disposed && request === version) publish({status:'error', user, actor:guest(), error});
    }
  }
  const unsubscribe = sdk.onAuthStateChanged(auth, user => resolve(user), error => {
    ++version;
    if (!disposed) publish({status:'error', user:null, actor:guest(), error});
  });
  return {
    get state() { return state; },
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    signInGoogle() { return sdk.signInWithPopup(auth, new sdk.GoogleAuthProvider()); },
    signOut() { return sdk.signOut(auth); },
    refresh() { return resolve(auth.currentUser, true); },
    dispose() { disposed = true; ++version; unsubscribe(); listeners.clear(); }
  };
}
