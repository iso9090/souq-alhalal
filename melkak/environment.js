export function environmentAllowed(config,location) {
 if (!config || config.datasource !== 'demo') return false;
 if (config.mode === 'local') return ['localhost','127.0.0.1'].includes(location.hostname);
 if (config.mode !== 'review') return false;
 try { const u=new URL(config.reviewOrigin); return u.protocol==='https:' && !u.username && !u.password && u.origin===config.reviewOrigin && !['iso9090.github.io','souq-al-halal-9e3e8.web.app','souq-al-halal-9e3e8.firebaseapp.com'].includes(u.hostname) && location.origin===u.origin; } catch { return false; }
}
