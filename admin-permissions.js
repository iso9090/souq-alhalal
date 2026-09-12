// Public permission names, never credentials. Firestore Rules remain authoritative.
export const GROUPS = [
  ['الرئيسية', [['dashboard_view','عرض الرئيسية']]],
  ['المستخدمون', [['users_view','عرض المستخدمين'],['users_suspend','تعليق الحساب'],['users_block','حظر الحساب'],['users_manage','إعادة التفعيل وطلب الحذف']]],
  ['الإعلانات', [['listings_view','عرض الإعلانات'],['listings_manage','إدارة الإعلانات والصور']]],
  ['المزادات', [['auctions_view','عرض المزادات'],['auctions_manage','إدارة حالة المزاد بعد انتهائه']]],
  ['طلبات الشراء', [['purchase_requests_view','عرض طلبات الشراء'],['purchase_requests_manage','إدارة حالات الطلبات']]],
  ['البلاغات', [['reports_view','عرض البلاغات'],['reports_manage','معالجة البلاغات']]],
  ['الخدمات', [['services_view','عرض الخدمات'],['services_manage','اعتماد ورفض الخدمات']]],
  ['سجل الإدارة', [['admin_log_view','عرض سجل الإدارة']]],
  ['المساعدون والصلاحيات', [['assistants_view','عرض المساعدين'],['assistants_create','إضافة مساعد'],['assistants_edit_permissions','تعديل الصلاحيات'],['assistants_suspend','إيقاف وإعادة التفعيل'],['assistants_remove_role','إزالة الدور الإداري']]]
];
export const PERMISSIONS=Object.freeze(GROUPS.flatMap(([,items])=>items.map(([key])=>key)));
export const VIEW={home:'dashboard_view',users:'users_view',animals:'listings_view',auctions:'auctions_view',purchaseRequests:'purchase_requests_view',reports:'reports_view',services:'services_view',serviceRequests:'services_view',adminAuditLogs:'admin_log_view',assistants:'assistants_view',adminAccess:'assistants_view'};
export function accessModel(uid,claims={},profile={},record=null,config=null){
  const active=profile.status===undefined||profile.status==='active';
  const registered=Array.isArray(config?.superAdminUids)&&config.superAdminUids.includes(uid);
  if(active&&claims.admin===true&&(config==null||registered))return {uid,role:'super_admin',permissions:[...PERMISSIONS],protectedUids:config?.superAdminUids||[],ready:config?.enabled===true&&registered};
  const enabled=active&&config?.enabled===true&&Array.isArray(config.superAdminUids)&&config.superAdminUids.length>0&&record?.role==='admin_assistant'&&record.adminStatus==='active';
  return {uid,role:enabled?'admin_assistant':null,permissions:enabled?(record.permissions||[]).filter(p=>PERMISSIONS.includes(p)):[],protectedUids:config?.superAdminUids||[],ready:config?.enabled===true};
}
export const can=(access,permission)=>access?.role==='super_admin'||access?.permissions?.includes(permission)===true;
export function canDelegate(access,targetUid,old,next,permission){
  if(access?.role!=='super_admin'||!access?.ready||!can(access,permission)||targetUid===access.uid||access.protectedUids.includes(targetUid)||old?.role==='super_admin')return false;
  if(next.some(p=>!PERMISSIONS.includes(p))||new Set(next).size!==next.length)return false;
  return true;
}
