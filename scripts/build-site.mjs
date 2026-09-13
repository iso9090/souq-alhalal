const args=process.argv.slice(2),i=args.indexOf('--mode');
const mode=i<0?(process.env.MELKAK_ENV||'production'):args[i+1];
if(mode==='review')await import('./build-review.mjs');
else if(mode==='production')await import('./build-production.mjs');
else throw Error('Unsupported build mode');
