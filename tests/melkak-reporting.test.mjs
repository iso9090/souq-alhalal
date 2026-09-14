import assert from 'node:assert/strict';
import * as reporting from '../melkak/reporting.js';
assert.equal(typeof reporting.serializeReportReason,'function','structured report serializer exists');
assert.equal(reporting.REPORT_REASONS.length,8);
for(const item of reporting.REPORT_REASONS){assert.ok(item.ar);assert.ok(item.en);assert.ok(reporting.serializeReportReason(item.id,'').includes(item.id));}
assert.equal(reporting.serializeReportReason('fraud','  Evidence  '),'[fraud] Evidence');
assert.throws(()=>reporting.serializeReportReason('unknown',''),{code:'REASON'});
assert.throws(()=>reporting.serializeReportReason('fraud','a'.repeat(351)),{code:'REASON'});
const opts={t:(_,en)=>en,esc:s=>String(s).replaceAll('<','&lt;').replaceAll('"','&quot;'),id:'listing-one'};
assert.ok(reporting.reportReasonFields(opts).includes('name="category"'));
assert.ok(!/name="detail"[^>]*required/.test(reporting.reportReasonFields(opts)));
assert.throws(()=>reporting.validatePermanentRemoval('wrong','listing-one','reason'),{code:'CONFIRMATION'});
assert.throws(()=>reporting.validatePermanentRemoval('listing-one','listing-one',' '),{code:'REASON'});
assert.equal(reporting.validatePermanentRemoval('listing-one','listing-one',' justified '),'justified');
console.log('PASS report reasons and destructive confirmation');
