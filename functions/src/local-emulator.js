import {initializeApp,getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {v2 as cloudinary} from 'cloudinary';
import {firestoreDependencies} from './adapters.js';
import {createSigner} from './upload.js';
import {createHandler} from './handler.js';
export function localEnvironmentAllowed(env){
 const project=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT||'';
 return env.FUNCTIONS_EMULATOR==='true'&&env.LOCAL_TRUSTED_BACKEND==='true'&&/^demo-[a-z0-9-]+$/.test(project)&&['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST'].every(k=>/^127\.0\.0\.1:\d+$/.test(env[k]||''));
}
export function createLocalEmulatorHandler(env,signerConfig){
 if(!localEnvironmentAllowed(env))throw Error('LOCAL_DEMO_EMULATORS_REQUIRED');
 const projectId=env.GCLOUD_PROJECT||env.GOOGLE_CLOUD_PROJECT;
 const app=getApps().find(a=>a.name==='trusted-local')||initializeApp({projectId},'trusted-local');
 return createHandler(firestoreDependencies(getFirestore(app),getAuth(app),createSigner(cloudinary,signerConfig)),{enabled:true,local:true});
}
