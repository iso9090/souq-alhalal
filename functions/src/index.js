import {onRequest} from 'firebase-functions/v2/https';
import {defineSecret} from 'firebase-functions/params';
import {createHandler} from './handler.js';
import {localEnvironmentAllowed,createLocalEmulatorHandler} from './local-emulator.js';

export const cloudName=defineSecret('CLOUDINARY_CLOUD_NAME');
export const apiKey=defineSecret('CLOUDINARY_API_KEY');
export const apiSecret=defineSecret('CLOUDINARY_API_SECRET');
// Future names only. Not attached to a function; no Stripe calls or secret reads.
export const stripeKey=defineSecret('STRIPE_SECRET_KEY');
export const stripeWebhookSecret=defineSecret('STRIPE_WEBHOOK_SECRET');

// Fail closed, including accidental deployment. No ADC initialization or secret access.
// Local executable mock server exercises the same handler with injected dependencies.
const disabled=createHandler({});let local;
export const api=onRequest({minInstances:0,maxInstances:2,timeoutSeconds:30,memory:'256MiB',invoker:'private',secrets:[cloudName,apiKey,apiSecret]},async(req,res)=>{
 if(!localEnvironmentAllowed(process.env))return disabled(req,res);
 local??=createLocalEmulatorHandler(process.env,{cloudName:cloudName.value(),apiKey:apiKey.value(),apiSecret:apiSecret.value()});
 return local(req,res);
});
