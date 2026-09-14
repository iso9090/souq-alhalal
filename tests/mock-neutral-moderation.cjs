// Browser-test-only deterministic classifier. Production always loads its vendored model.
// Register after catch-all routes so this exact module route takes precedence.
module.exports=async function mockNeutralModeration(page){
 await page.route('**/melkak/vendor/moderation/runtime.js',route=>route.fulfill({contentType:'text/javascript',body:`export async function loadLocalModel(){return {async classify(){return [{className:'Neutral',probability:1},{className:'Drawing',probability:0},{className:'Sexy',probability:0},{className:'Porn',probability:0},{className:'Hentai',probability:0}]}}}`}));
};
