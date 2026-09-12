# المرحلة الثانية — تجهيز الخدمات الحقيقية دون نشر

تاريخ الفحص: 9 سبتمبر 2026. هذا دليل إعداد لاحق، وليس تصريحًا بالتفعيل. لم يتغير Production أو main أو Android أو Billing، ولم يُربط حساب المالك بالبريد.

## ما تأكد فعليًا

استُخدم اعتماد Google موجود مسبقًا من نوع `authorized_user` عبر ADC. لم يُستخدم مفتاح Service Account، ولم تُطبع credentials أو تُنسخ إلى المشروع. الطلبات إلى خدمات المشروع كانت GET فقط؛ استُخدم طلب OAuth لتجديد اعتماد القراءة في الذاكرة. تقرير القراءة المحفوظ منفصل عن Git، ويحتوي نتائج مختصرة وبصمات، دون UID كامل أو هاتف أو بريد أو tokens.

| العنصر | النتيجة |
|---|---|
| Firebase project | `souq-al-halal-9e3e8` |
| Email/Password وPhone | مفعّلان فعليًا |
| Google / Facebook / Twitter | قائمة إعدادات المزودين فارغة، والقراءة الفردية لكل مزود أعادت 404: غير مهيأة |
| Authorized domains | `localhost`، `iso9090.github.io`، `souq-al-halal-9e3e8.firebaseapp.com`، `souq-al-halal-9e3e8.web.app` |
| authDomain في الكود | `souq-al-halal-9e3e8.firebaseapp.com` |
| Owner | مالك واحد يحمل `admin:true`، غير معطل في Auth، مزوده `phone` فقط، ملفه `active` |
| سجل المالك | `adminSecurity/config` موجود؛ UID المالك ضمن `superAdminUids`؛ `enabled:true` |
| Admin V2 | `adminAccess/{uid}.role` للمالك هو `super_admin` |
| Hosting | موقع Firebase الافتراضي موجود لنفس مشروع Production؛ لا يعني وجود بيئة بيانات اختبار مستقلة |
| Cloud Functions / Cloud Run / Billing | طلبات الفحص أعادت 403؛ الحالة غير متحققة، وليست دليلًا على عدم وجود خدمة أو عدم وجود Billing |

لا توجد خدمة توقيع أو مجلد Functions أو إعداد Cloud Run أو إعداد Hosting preview في المصدر. `firebase.json` يحدد Firestore Rules فقط، ولا يوجد مسار نشر تجريبي جاهز في workflows. لم تُعثر على إعدادات Cloudinary في أسماء متغيرات Process/User/Machine أو مسارات إعداداته المعتادة، أو ملفات الإعداد المسماة في المشروع وDesktop وDownloads ونسخ المشروع الاحتياطية. هذا وصف لنطاق الفحص، وليس إثباتًا لعدم امتلاك حساب خارجي.

## الصور: القرار المقترح

**التوصية: الإبقاء على Signed Upload مع خدمة موثوقة قبل الإطلاق العام.** محوّل المتصفح موجود، لكن `imageProvider.signingEndpoint` فارغ؛ لا يوجد رفع حقيقي الآن. لا يوجد API Secret في JavaScript أو Git. عدم توفر خدمة موثوقة يمنع تفعيل الرفع، ولا يبرر إنشاء Billing تلقائيًا.

| المقارنة | Signed عبر خادم موثوق | Unsigned preset مقيد |
|---|---|---|
| الأمان | يتحقق الخادم من Firebase UID والحساب النشط والمالك لصور Hero، ثم يوقع معاملات محددة | اسم preset ظاهر؛ من يعرفه يستطيع الرفع مباشرة دون المرور بتسجيل دخول الموقع |
| GitHub Pages | مناسب، لكنه يحتاج HTTPS backend منفصلًا وCORS مضبوطًا | أسهل، رفع مباشر من المتصفح دون backend |
| منع الإساءة | حصص ومعدل طلبات لكل UID، تحقق توكن من المشروع الصحيح، ومساحة رفع محددة | لا يوفر وحده حصة موثوقة لكل UID أو لكل إعلان؛ إخفاء preset وCORS لا يحلان ذلك |
| folder / public_id | يختارهما الخادم فقط، باسم عشوائي ونطاق المستخدم؛ يمنع المسارات التي يختارها العميل | preset يحدد folder/asset_folder بحسب نمط الحساب، و`disallow_public_id:true`؛ لا يثبت ملكية Firebase |
| النوع والحجم | preset موقّع يفرض `allowed_formats` و`max_file_size`؛ الخادم لا يقبل تجاوزهما من طلب العميل | القيود نفسها في preset؛ أولوية قيم preset للحقول أحادية القيمة تدعم تثبيتها |
| transformations | تحويل وارد يحد الأبعاد مثل `c_limit,w_1600,h_1600`، وفحص فعلي عند الحاجة | تحويل وارد ثابت في preset؛ يتحمل الحساب تكلفة المعالجة وفق استهلاكه |
| overwrite | يوقع الخادم `overwrite:false` ومعرّفًا عشوائيًا | Cloudinary يفرض `overwrite:false` في الرفع unsigned |
| التكلفة | تكلفة Cloudinary حسب الاستخدام، إضافة إلى تشغيل backend؛ المجانية تعتمد على الخدمة والحصة | لا تكلفة backend، لكن استهلاك Cloudinary قابل للإساءة |

مراجع المقارنة: [Upload presets](https://cloudinary.com/documentation/upload_presets)، [Client-side uploading](https://cloudinary.com/documentation/client_side_uploading)، [Upload API](https://cloudinary.com/documentation/image_upload_api_reference). الخطة المجانية المعروضة تتضمن 25 credit شهريًا؛ ليست 25 GB لكل نوع من الاستهلاك منفصلًا. تُجمع موارد التخزين والتحويل والتسليم ضمن نظام credits. [التسعير](https://cloudinary.com/pricing)، [احتساب الاستهلاك](https://cloudinary.com/documentation/billing_and_plans).

Firebase Functions يتطلب Blaze للنشر، حتى لو وقع الاستهلاك ضمن حصة مجانية. لم تتأكد حالة Billing الحالية ولم يُغير شيء. لا نختار هذا المسار قبل قرار صريح. [متطلبات Functions](https://firebase.google.com/docs/functions/get-started).

العمل اليدوي لاحقًا: تحديد حساب Cloudinary وبيئة اختبار، ثم اختيار backend معتمد وتكلفته. ضبط preset موقّع يقبل JPEG/WebP فقط بحجم أقصى `307200` بايت وأبعاد 1600؛ العميل يقبل PNG أيضًا كمدخل ويفكها ويحولها إلى JPEG قبل الرفع. حفظ السر في بيئة الخادم فقط، وتحديد عنوان HTTPS الفعلي في `signingEndpoint` بعد اختبار الخدمة. لا تُرسل الأسرار في المحادثة.

الخادم المقترح يتحقق من ID token وإلغائه عند الحاجة، `users/{uid}.status`، وسجل المالك لصور Hero. يطبق حصصًا على UID ومسودة الإعلان ويحجز حتى ثلاث فتحات رفع، ولا يثق بـ`bytes` أو `contentType` التي يرسلها العميل. preset يفحص الحجم والنوع من جهة المزود. التوقيع لا يغطي بايتات الملف ذاتها، وتوقيع Cloudinary صالح لمدة محددة من المزود؛ لا يُوصف بأنه token أحادي الاستخدام. الربط الموثوق بين الأصل المرفوع وUID/الإعلان يحتاج سجل أصول أو تحقق خادم عند اعتماد الصور. [توثيق التوقيع](https://cloudinary.com/documentation/upload_images#authenticated_requests).

حماية هذه النسخة: 1–3 صور، رفض MIME غير المدعوم والتلف، حد إدخال 30 MiB و80 مليون بكسل، تطبيق اتجاه EXIF، الحفاظ على النسبة وحد 1600، وJPEG لا يتجاوز 300 KiB أو رفض الملف. منع التكرار عبر بصمة المحتوى بعد الضغط، لا اسم الملف فقط. الإضافة التي تحتوي تكرارًا تُرفض كاملة، واستبدال الصورة بنفسها مسموح؛ تكرار صورة أخرى مرفوض. المعاينة والترتيب والحذف والرئيسية محفوظة. الحد والروابط المكررة مفروضان في **القواعد المحلية** أيضًا، مع الحفاظ على البيانات القديمة دون إعادة كتابتها. لا تدّعي هذه القواعد التحقق من محتوى ملف Cloudinary أو ملكيته أو حصته؛ ولا تسري على Production قبل نشر معتمد.

## Google: الخطوات بعد موافقة التفعيل

1. افتح [Firebase Authentication للمشروع](https://console.firebase.google.com/project/souq-al-halal-9e3e8/authentication/providers)، ثم Sign-in method → Google. المزود غير مهيأ في الفحص الحالي.
2. اختر Enable وحدد اسم المشروع الظاهر وبريد الدعم الصحيح ثم Save. هذه كتابة Production مؤجلة، وليست خطوة نفذناها.
3. في Settings → Authorized domains راجع النطاقات المذكورة أعلاه. `localhost` موجود؛ `127.0.0.1` غير موجود في القائمة الحالية. لا تضف منفذًا أو مسارًا في حقل النطاق. إن اختير اختبار OAuth محلي لاحقًا فاستعمل أصلًا معتمدًا أو اعتمد إضافة العنوان المطلوب أولًا.
4. راجع إعداد OAuth client/consent الذي يخص المشروع إذا طلبت Console ذلك؛ لا تخترع client ID. عند ضبط callback يدويًا استخدم القيمة التي تعرضها Firebase.
5. بعد توفير بيئة اختبار مستقلة، اختبر حساب Google تجريبيًا فعليًا على الكمبيوتر ومتصفح Samsung، ثم إعادة الدخول والتأكد من UID نفسه. نجاح المحاكاة الحالية لا يثبت OAuth الحقيقي.

المسار المتوقع مع الإعداد الحالي لكل المزودين هو:

```text
https://souq-al-halal-9e3e8.firebaseapp.com/__/auth/handler
```

هذا callback لـFirebase، وليس الصفحة الرئيسية في GitHub Pages. تحقق من مطابقته للقيمة المعروضة في Console قبل حفظه لدى المزود. [إعداد Google الرسمي](https://firebase.google.com/docs/auth/web/google-signin).

فحص HTTP فقط أعاد 200 لهذا العنوان وصفحتي الخصوصية والحذف على GitHub Pages. هذا يثبت الوصول إلى الملفات، ولا يثبت تسجيل callback لدى Google/Meta/X أو نجاح OAuth.

الكود يبدأ بـpopup في متصفح الكمبيوتر والهاتف، ثم redirect عند منع popup. وجود Authorized domain لا يصلح قيود التخزين بين `iso9090.github.io` و`firebaseapp.com`. إكمال redirect يحتاج أحد حلول Firebase الرسمية أو الاستمرار في popup على المتصفحات التي تسمح به. لا تغيّر authDomain إلى GitHub Pages لأنه لا يخدم ملفات المساعد `/__/auth/*`. فشل redirect يعرض رسالة ويزيل علامة المحاولة. [إرشادات Redirect، بما فيها بديل Popup](https://firebase.google.com/docs/auth/web/redirect-best-practices?hl=en).

تحديث السوق الناتج عن تغيّر جلسة Auth يحافظ الآن على النافذة المفتوحة عند غياب بلد مختار، حتى لا يمحو رسالة نتيجة الدخول بنافذة اختيار البلد. اختُبرت العودة مع تأخير متعمد لمراقب الجلسة. الحساب blocked/suspended لا تُحدّث بياناته أثناء الدخول، وتظهر رسالة التقييد دون تغيير حالته أو صلاحياته أو إلغاء جلسة Firebase قسرًا؛ القواعد القائمة تبقى مسؤولة عن منع العمليات غير المسموحة.

## Facebook: Firebase وMeta

الكود يستخدم `FacebookAuthProvider`؛ الإعداد الحقيقي غير موجود. بعد موافقة إنشاء/تهيئة التطبيق:

1. في Meta for Developers اختر تطبيقًا مناسبًا لحالة استخدام تسجيل الدخول، أو أنشئه يدويًا. لا نفترض وجود App ID أو Secret.
2. فعّل/خصص Facebook Login للويب. في إعداداته ابحث عن **Valid OAuth Redirect URIs**؛ ضع callback أعلاه حرفيًا، وراجع Client OAuth Login وWeb OAuth Login. ترتيب قوائم Use cases/Products قد يختلف حسب التطبيق.
3. راجع App Settings → Basic: اسم التطبيق، بيانات الاتصال، Website URL، وApp Domains المستخدمة فعليًا: `iso9090.github.io` و`souq-al-halal-9e3e8.firebaseapp.com`. أضف أي نطاق اختبار مستقل فقط إن استُخدم واعتمدته لوحة Meta؛ لا تضع المسار `/souq-alhalal/` في حقل App Domains.
4. راجع سياسة الخصوصية العامة `https://iso9090.github.io/souq-alhalal/privacy.html` وتعليمات الحذف `https://iso9090.github.io/souq-alhalal/delete-account.html`. الصفحتان موجودتان في المصدر؛ يلزم التأكد من وصول Meta إليهما ومطابقتهما للبيانات المعالجة قبل اعتماد التطبيق. صفحة التعليمات ليست Data Deletion Callback؛ إذا اختير callback بدل التعليمات يلزم endpoint يعالج `signed_request` ويرجع رابط حالة ورمز تأكيد وفق Meta.
5. في Firebase Authentication → Sign-in method → Facebook ضع App ID وApp Secret في Console فقط، وراجع callback ثم Save بعد الموافقة.
6. Development مناسب لاختبارات الأدوار/المختبرين المسموحين. الوصول العام يتطلب استكمال متطلبات النشر التي تعرضها لوحة التطبيق والتحويل إلى Live. قد تلزم مراجعة الصلاحيات أو التحقق التجاري بحسب حالة الاستخدام ومستوى الوصول؛ لا نَعِد بأن Live وحده يكفي. لا نطلب صلاحيات نشر أو قراءة صفحات أو رسائل لهذا الدخول.

[دليل Firebase Facebook](https://firebase.google.com/docs/auth/web/facebook-login) يدعم خطوات التكامل الأساسية. تعذر جلب صفحات Meta التفصيلية وقت الفحص بسبب 429؛ لا توجد جلسة Meta متاحة، لذلك متطلبات المراجعة الخاصة بحسابك وأسماء القوائم الحالية غير متحققة. راجع [إعدادات التطبيق](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings/)، [أوضاع التطبيق](https://developers.facebook.com/docs/development/build-and-test/app-modes/)، [حذف البيانات](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/) داخل حسابك قبل التفعيل. لم يُنشأ تطبيق ولم يُدخل Secret.

## X: إعداد الدخول والتكلفة

الكود يسمي الزر X ويستخدم `TwitterAuthProvider`، أي تكامل Firebase مع OAuth 1.0a. في X Developer Console يلزم تطبيق يدعم **Sign in with X**، وتفعيل user authentication، وتحديد نوع تطبيق ويب وWebsite URL وقيمة callback أعلاه. المطلوب **API Key وAPI Key Secret/Consumer Secret**، وليس Bearer token ولا OAuth 2 Client ID بديلًا عنهما. نوصي بصلاحية **Read فقط** للدخول؛ لا حاجة إلى Write أو Direct Messages. إن طُلب الوصول للبريد فراجع احتياجه ومتطلباته بدل إضافته افتراضيًا. أدخل المفتاح والسر في Firebase → Twitter بعد الموافقة، دون وضعهما في الموقع. [Firebase Twitter](https://firebase.google.com/docs/auth/web/twitter-login?hl=en)، [تسجيل الدخول لدى X](https://docs.x.com/fundamentals/authentication/guides/log-in-with-x)، [معنى صلاحيات X](https://help.x.com/en/managing-your-account/connect-or-revoke-access-to-third-party-apps).

الوثيقة الحالية لـX تعرض **دفعًا حسب الاستخدام بأرصدة مسبقة، دون اشتراك إلزامي عام**. هذا لا يثبت أن مسار Firebase Twitter في حسابك مجاني، ولا يحدد تكلفة تسجيل دخول واحدة. يجب مراجعة إتاحة OAuth 1.0a، endpoints المطلوبة وحصصها وأسعارها في حساب المطور قبل الموافقة. لم تتوفر جلسة X Developer ولم نفحص تطبيقًا حقيقيًا؛ متطلبات حسابك المالية غير محسومة. لا اشتراك ولا شراء أرصدة ولا تغيير Billing في هذه الجولة. [التسعير الحالي الرسمي](https://docs.x.com/x-api/getting-started/pricing).

## المالك: الاعتماد على UID والخطة المستقبلية

الصلاحية في الكود والقواعد تعتمد على UID و`admin:true` وحالة `users/{uid}` النشطة. مع وجود `adminSecurity/config` يلزم أن يكون UID مسجلًا في `superAdminUids`؛ `enabled` يتحكم بالتفويض، ولا يجعل claim غير المسجل مالكًا. `adminAccess/{uid}` يحدد أدوار المساعدين؛ حقل role في users أو بريد معين ليس بديلًا عن هذا التحقق.

تبقى هذه الروابط بنفس UID عند الربط الصحيح: `users/{uid}`، `adminAccess/{uid}`، سجل المالكين، `animals.sellerId`، `auctions.sellerId/lastBidderId`، `auctionParticipations.bidderId/sellerId` ومعرّف المشاركة المشتق من المزاد وUID، `purchaseRequests.buyerId/sellerId`، `serviceRequests.userId` وحقول القرار، `conversations.participants/buyerId/sellerId` ومعرفاتها وقراءات الرسائل و`messages.senderId` و`contacts/{uid}`، `accountDeletionRequests/{uid}`، `reports.reporterId/reportedUserId/reviewedBy`، `adminAuditLogs.adminUid`، وحقول التحقق والمراجعة و`homePage.updatedBy`. المرجع الدقيق للحقول هو القواعد والكود الحاليان؛ لم نحصر كل السجلات التجارية الإنتاجية أو ننسخها في هذه الجولة.

`planVerifiedOwnerEmailLink` أصبح فحصًا نقيًا أكثر صرامة: يرفض Auth معطلًا أو مجهول الحالة، غياب دليل الملف/السجل، UID مختلفًا، صاحب claim خارج السجل، الحساب الموقوف والبريد المشغول. الفحص الحقيقي الأولي للمالك الحالي **PASS مع صفر كتابة**، لكنه يعيد `readyForProductionLink:false`؛ البريد المستهدف غير مقدم ولم تُفحص إتاحته، ولم تُختبر إعادة المصادقة أو إرسال التحقق أو تسجيل الدخول الجديد. نتيجة الفحص لا تعني موافقة تنفيذ.

| الخطوة | التنفيذ لاحقًا ومعيار النجاح |
|---|---|
| A | Snapshot محمي لمعلومات Auth غير السرية وclaims وusers والسجل والصلاحيات والسجلات المرتبطة. لا كلمات مرور أو tokens. |
| B | حفظ UID الحالي ومقارنته بالمالك المسجل قبل العملية؛ التأكد من Auth غير معطل والحساب نشط. |
| C | موافقة منفصلة؛ دخول المالك الحالي، ثم `linkWithCredential(currentUser, EmailAuthProvider.credential(email,password))` في واجهة موثوقة. إعادة مصادقة الهاتف عند الحاجة؛ التوقف عند تعارض البريد دون إنشاء حساب أو نقل بيانات. |
| D | `sendEmailVerification(currentUser)` ثم فتح رابط التحقق وإعادة تحميل المستخدم والتحقق من `emailVerified`. |
| E | تسجيل الخروج بعد حفظ نتيجة الربط وUID؛ لا فصل للهاتف. |
| F | دخول بالبريد وكلمة المرور في متصفح نظيف منفصل. |
| G | UID بعد الدخول يساوي UID المسجل في B حرفيًا؛ أي اختلاف يوقف الخطة. |
| H | مراجعة users/{uid} وحالة الحساب والحقول المحمية؛ lastLoginAt قد يتغير طبيعيًا بسبب الدخول. |
| I | تحديث ID token ومراجعة claims والوصول إلى Admin بنفس المالك. |
| J | قراءة الإعلانات والتأكد من sellerId والملكية دون إنشاء إعلان إنتاجي للاختبار. |
| K | قراءة المزادات والمزايدات وسجل المشاركة بالـUID نفسه؛ لا مزايدة إنتاجية تجريبية. |
| L | قراءة طلبات الشراء كطرفي البيع/الشراء دون طلب إنتاجي تجريبي. |
| M | فتح Admin V2 وإدارة الصفحة الرئيسية بصلاحيات المالك. |
| N | مقارنة مصفوفة الصلاحيات والحقول المحمية بالنسخة السابقة؛ اختبارات الكتابة في بيئة معزولة. |
| O | بعد PASS لجميع الخطوات: قرار وموافقة مستقلان بشأن إبقاء phone أو فصله. |

طريقة كلمة المرور: يدخلها المالك بنفسه في حقول password لواجهة موثوقة، في الذاكرة مؤقتًا، دون command line أو ملف JSON أو .env أو console.log أو analytics. لا تُرسل إلى Codex. لا يوجد نموذج ربط حي أو أداة كتابة منشورة الآن. إذا تعذر دخول الهاتف لإعادة المصادقة، تُوقف الخطة؛ لا يُستبدل المالك ولا يُطلب reset عشوائي. Firebase يدعم الحفاظ على UID عند الربط، لكن وثيقته تنبه إلى مشكلة ربط في بعض المشاريع؛ يلزم التحقق من الإصدار والحالة واختبار الحساب التجريبي قبل لمس المالك. [ربط المزودين](https://firebase.google.com/docs/auth/web/account-linking).

## Preview وAndroid

المعاينة المتاحة `http://127.0.0.1:4174/` ما زالت **Mock** معزولة؛ لا تدخل بياناتها Firebase Production. الاختبارات تستخدم Firestore Emulator على loopback بمشروع `demo-`، ومزودي Auth مصطنعين. لا يوجد مشروع اختبار مستقل موثّق ضمن إعداد المشروع.

موقع Firebase Hosting الافتراضي موجود، لكن preview channel لا يعزل Auth/Firestore تلقائيًا. نشر الكود الحالي إليه ثم إجراء دخول حقيقي قد ينشئ مستخدمًا ويحدّث users في Production. لذلك لم ننشئ channel أو Hosting جديدًا. المسار التالي المقترح بعد اعتماده: بيئة Firebase اختبار مستقلة + حسابات غير إنتاجية، أو معاينة محلية متصلة بمحاكيات Auth وFirestore معًا وقيود تمنع الاتصال بالإنتاج. Emulator لا يثبت قبول Google/Meta/X الحقيقي. [حدود Preview channels](https://firebase.google.com/docs/hosting/test-preview-deploy).

مراجعة Android كانت قراءة فقط لـMainActivity وNavigationPolicy: WebView يسمح بنطاق السوق وبمساعد Firebase، يفتح النطاقات الخارجية عبر ACTION_VIEW، ولا يطبق مسارًا واضحًا لإرجاع OAuth إلى جلسة Firebase داخل WebView، ولا `onCreateWindow` لنوافذ OAuth. السماح بكوكيز الطرف الثالث لا يجعل جلسة المتصفح الخارجي هي جلسة WebView. الكود الجديد يرشد WebView إلى المتصفح أو البريد؛ لذا **OAuth داخل الغلاف الحالي غير معتمد**.

لاحقًا: أبسط مسار ويب متماسك هو إكمال تجربة الدخول والسوق في متصفح النظام/Custom Tab. إذا لزم البقاء كتطبيق ذي جلسة أصلية، يُصمم تكامل Firebase Android والمزود المدعوم، مع عودة آمنة وتجربة الحساب نفسه؛ Google يدعم Credential Manager، وX يدعم مسار Firebase Android. لا تمرر tokens في URL أو عبر جسر JavaScript عام، ولا تفترض انتقال جلسة Firebase Android تلقائيًا إلى WebView. اختبر Samsung/Chrome وSamsung Internet والإلغاء والعودة وتبديل الحساب قبل AAB جديد. لم تتغير ملفات Android أو الشهادات أو build. [سياسة Google للمتصفحات المضمنة](https://developers.google.com/identity/protocols/oauth2/policies)، [Google Android](https://firebase.google.com/docs/auth/android/google-signin)، [X Android](https://firebase.google.com/docs/auth/android/twitter-login).

## إعادة التحقق المحلية

`npm test`، ثم `npm run test:rules` مع Firestore Emulator محلي، ثم `npm run test:browser` و`npm run test:v2-browser` و`npm run test:live-browser`، ثم `npm run lint` و`npm run build` و`git diff --check`. اختبارات الخدمات الإضافية لا ترسل أي اتصال حي. يمكن تشغيل المتصفح والمحاكي بالتتابع على الأجهزة محدودة الذاكرة. فشل تشغيل سابق لنفاد الذاكرة أُعيد بنجاح بعد تحديد الذاكرة وعدد خيوط المحاكي.

بوابات التفعيل المتبقية: حساب الصور وخدمة التوقيع وحصصها؛ موافقة وإعداد مزودي Auth؛ callbacks واختبارات فعلية في بيئة معزولة؛ ربط المالك بعد موافقة منفصلة؛ Samsung؛ ثم قرار نشر وإصدار منفصل. لا توجد موافقة تلقائية بسبب نجاح الاختبارات.
