"use strict";
const app=document.getElementById("app");
const CHAPTERS=[
 ["🏙️","المدينة الممنوعة"],["🌃","الليلة الأولى"],["🕶️","شبكة الأشباح"],["💎","سرقة القلوب"],
 ["🪩","حفلة تحت الغطاء"],["🚂","قطار منتصف الليل"],["🌙","أسرار القمر"],["🗝️","قصر الألغاز"],
 ["🎭","ليلة الأقنعة"],["🌊","مطاردة الشاطئ"],["🔥","المهمة الساخنة"],["👑","عملية العمر"]
];
const HEATS=[{name:"ضحك ومغامرات 😄",short:"خفيف",icon:"🎮"},{name:"رومانسية ودلع 💕",short:"رومانسي",icon:"💗"},{name:"جرأة الكبار 😘",short:"جريء",icon:"🔥"}];
const FUN=[
 ["لو اتقفشنا وإحنا بنهرب، مين هيتصرف أسرع؟",["أنا","إنت","هنجري مع بعض"]],
 ["اختار مغامرة دلوقتي",["سينما متأخر","رحلة مفاجأة","قعدة في البيت"]],
 ["مين فينا بينام أسرع؟",["أنا","إنت","حسب اليوم"]],
 ["لو بقينا أغنياء فجأة، أول حاجة نعملها؟",["نسافر","نشتري بيت","نحتفل"]],
 ["مين ممكن يكسب في مسابقة طبخ؟",["أنا","إنت","نطلب أكل أحسن"]],
 ["هتخطفني فين لو عندك طيارة؟",["باريس","البحر","مكان محدش يعرفه"]],
 ["أسرع حاجة تضحكك؟",["تقليد الأصوات","هزار سخيف","موقف عفوي"]],
 ["لو عندنا يوم أجازة كامل، نعمل إيه؟",["نخرج طول اليوم","ننام ونرتاح","مغامرة غريبة"]],
 ["مين فينا يفهم التاني من نظرة؟",["أنا","إنت","إحنا الاتنين"]],
 ["لو حياتنا فيلم، هيكون إيه؟",["أكشن","كوميدي","رومانسي"]],
 ["هتختار حيوان أليف إيه؟",["قطة","كلب","سمكة"]],
 ["الموعد المثالي يبدأ بإيه؟",["قهوة","أكلة حلوة","مشوار مفاجئ"]],
 ["مين بيقول خمس دقايق ويتأخر؟",["أنا","إنت","الاتنين"]],
 ["لو عايز تفاجئني، تختار إيه؟",["هدية صغيرة","خروجة","رسالة مكتوبة"]],
 ["أجمل وقت للكلام؟",["الفجر","بعد العشا","في العربية"]],
 ["مين ملك التصوير في البيت؟",["أنا","إنت","ولا واحد"]],
 ["لو عملنا تحدي رقص، مين يفوز؟",["أنا","إنت","نرقص سوا"]],
 ["تحب عيد ميلادك إزاي؟",["حفلة","عشا هادي","مفاجأة"]],
 ["مغامرة فيها لغز ولا مطاردة؟",["لغز","مطاردة","الاتنين"]],
 ["أول اسم تدلعني بيه في فيلم جاسوسية؟",["القائد","الشريك السري","العميل الخطير"]],
 ["مين ممكن ينسى هو دخل الأوضة ليه؟",["أنا","إنت","الاتنين"]],
 ["اختار قوة خارقة لينا",["نوقف الوقت","نقرأ الأفكار","ننتقل في ثانية"]],
 ["لو هنصوّر فيديو مضحك، نعمل إيه؟",["مقلب لطيف","تمثيلية","رقصة"]],
 ["أحلى أكلة نتشاركها؟",["بيتزا","كشري","حلويات"]],
 ["مين بيضحك قبل ما يخلص النكتة؟",["أنا","إنت","إحنا الاتنين"]],
 ["لو الموبايل فصل ساعة، نعمل إيه؟",["نلعب","نتكلم","نخرج"]],
 ["لو عندنا تذكرة سفر واحدة، نروح فين؟",["مدينة جديدة","جزيرة","جبال"]],
 ["أي تحدي أصعب علينا؟",["مانضحكش","مانتكلمش","مانمسكش الموبايل"]],
 ["مين أحسن في حفظ الأسرار؟",["أنا","إنت","إحنا الاتنين"]],
 ["لو خرجنا من غير خطة، أول محطة؟",["مطعم","شارع جديد","مكان مفتوح"]]
];
const ROMANCE=[
 ["أحلى حاجة في وقتنا سوا؟",["الضحك","الكلام","الهدوء"]],
 ["تختار مفاجأة رومانسية إيه؟",["رسالة حب","عشا على شموع","مشوار ليل"]],
 ["متى تحس إننا على نفس الموجة؟",["لما نضحك","لما نتفاهم","لما نسكت"]],
 ["لو أكتبلك رسالة من 3 كلمات، تبدأ بإيه؟",["بحبك","وحشتني","إنت الأمان"]],
 ["اللحظة اللي تحب نعيدها؟",["أول مقابلة","أول خروجة","موقف مضحك"]],
 ["عايز سهرة بكرة تكون إزاي؟",["سينما","قعدة رواق","تمشية"]],
 ["أحلى تعبير عن الحب؟",["كلمة حلوة","حضن","اهتمام"]],
 ["لو أهديلك أغنية، تحبها إيه؟",["هادية","مبهجة","قديمة"]],
 ["إيه أحلى مفاجأة من غير فلوس؟",["رسالة ورق","فطار جاهز","وقت من غير موبايل"]],
 ["عايز تسمع مني إيه آخر اليوم؟",["فخور بيك","وحشتني","بحبك"]],
 ["مين فينا أكثر رومانسية؟",["أنا","إنت","المفروض الاتنين"]],
 ["لو نعمل تقليد أسبوعي لينا، يكون إيه؟",["سهرة","لعبة","فطار مخصوص"]],
 ["أكتر وقت بتحب تسمع فيه كلمة حلوة؟",["الصبح","بالليل","في نص اليوم"]],
 ["اختار ذكرى نعلّق صورتها",["أول سفر","أجمل خروجة","صورة عفوية"]],
 ["الرسالة اللي تفرحك فجأة؟",["فاكرك","مستنيك","يا أجمل حاجة"]],
 ["لو إنت مخرج فيلم حبنا، النهاية؟",["ضحك","سفر","حضن طويل"]],
 ["تحب الخروجة المفاجئة تبقى فين؟",["مطعم جديد","جنب البحر","مكان هادي"]],
 ["أقرب حاجة لقلبك لما أعملها؟",["أسمعك","أضحكك","أساندك"]],
 ["أجمل طريقة نتصالح بيها؟",["نتكلم بهدوء","نتمشى","نهزر"]],
 ["لو عندنا دقيقة نوقف فيها الزمن، نعمل إيه؟",["نتحضن","نضحك","نبص لبعض"]],
 ["أفضل موعد في البيت؟",["فيلم","طبخة سوا","لعبة"]],
 ["أول حاجة تلفت نظرك في شريكك؟",["الابتسامة","الصوت","العيون"]],
 ["تحب تاخد مفاجأة في أي وقت؟",["الصبح","بعد الشغل","قبل النوم"]],
 ["جملة مننا تستحق تتكتب على الحيطة؟",["إحنا فريق","يومنا حلو","سوا أحلى"]],
 ["تحب تكون رحلتنا الجاية إيه؟",["استرخاء","مغامرة","رومانسية"]],
 ["أكتر حاجة تخلي البيت دافي؟",["الضحكة","الاهتمام","الذكريات"]],
 ["إيه أحلى حاجة نتعلمها سوا؟",["رقصة","أكلة","لغة"]],
 ["لو هتختار لون لليلتنا، إيه؟",["أحمر","أزرق","بنفسجي"]],
 ["الحب عندك يتوصف بإيه؟",["طمأنينة","شقاوة","مغامرة"]],
 ["في يوم صعب، محتاج مني إيه؟",["أسمعك","أهزر معاك","أقعد جنبك"]]
];
const SPICY=[
 ["لو عندنا ميعاد سري الليلة، تختار؟",["عشا خافت","رقصة بطيئة","سهرة تحت النجوم"]],
 ["إيه أكتر حركة دلع تفرحك؟",["غمزة","بوسة على الخد","همسة في الودن"]],
 ["اختار تحدي جرأة لطيف",["نظرة 20 ثانية","رقصة قريبة","اعتراف حلو"]],
 ["لو هنسرق بوسة في فيلم، فين؟",["تحت المطر","عند الباب","وقت الوداع"]],
 ["تحب المفاجأة تبدأ بإيه؟",["رسالة غامضة","وردة","همسة"]],
 ["مين فينا بيبدأ الدلع؟",["أنا","إنت","حسب المزاج"]],
 ["إيه أكثر حاجة بتكسفك بطريقة حلوة؟",["مدح مفاجئ","نظرة طويلة","كلمة في الودن"]],
 ["لو فيه دقيقة من غير كلام، تختار؟",["حضن","نظرات","رقصة"]],
 ["إيه الأجمل قبل النوم؟",["كلمتين حلوين","حضن دافي","بوسة"]],
 ["منافسة شقاوة الليلة تكون إيه؟",["مين يضحك التاني","مين يكسف التاني","مين يبدأ الدلع"]],
 ["لو نعمل موعد كله مفاجآت، تختار؟",["شموع","موسيقى هادية","لعبة سرية"]],
 ["لو سمعت كلمة وحشتني، هتعمل إيه؟",["أبتسم","أحضن","أقولها كمان"]],
 ["إيه أكثر تفصيلة بتلفت نظرك؟",["العطر","الضحكة","طريقة الكلام"]],
 ["لو هتختار مكان لبوسة سينمائية؟",["تحت المطر","على السطح","جنب البحر"]],
 ["تحب الكلام الرومانسي يبقى؟",["صريح","غامض","بالهمس"]],
 ["لو هنعمل تحدي ممنوع الضحك، إيه أسلحتك؟",["نظرة","تقليد","كلمة دلع"]],
 ["أقرب مشهد لقلبك؟",["رقصة بطيئة","حضن طويل","إيد في إيد"]],
 ["لو ليك أمنية رومانسية دلوقتي؟",["ساعة لوحدنا","مشوار ليل","مفاجأة"]],
 ["مين ممكن يكسف التاني الأول؟",["أنا","إنت","اتحداك"]],
 ["لو هنبدل الأدوار في الغزل، مين يبدأ؟",["أنا","إنت","بالحظ"]],
 ["تحب المفاجآت اللطيفة قد إيه؟",["كل يوم","كل أسبوع","من وقت للتاني"]],
 ["لو هتختار كلمة سر للدلع؟",["غمزة","ضحكة","يا قمري"]],
 ["أحلى طريقة تقول بيها بحبك؟",["بصوت واطي","مكتوبة","بعينيك"]],
 ["لو هنتفرج على النجوم، أعمل إيه؟",["أحكي حكاية","أمسك إيدك","أغنيلك"]],
 ["إيه أكثر حاجة رومانسية ومضحكة؟",["غزل فاشل","رقصة عشوائية","رسالة غلط"]],
 ["لو نتمشى وقت المطر، تحب؟",["نجري","نمشي بهدوء","نقف تحت مظلة"]],
 ["لو الشريك قال اختار عقاب دلع، تختار؟",["مدح دقيقة","بوسة على الخد","حضن"]],
 ["لو هنخترع إشارة سرية بينا؟",["غمزة","لمسة إيد","ابتسامة"]],
 ["اختار ليلة كلها رومانسية، فيها؟",["لعبة وأسئلة","أغاني هادية","حكايات"]],
 ["لو فيه تحدي همس، هتقول؟",["وحشتني","إنت خطير","أنا مبسوط بيك"]]
];
const DARES_FUN=[
 "قلّد شخصية مشهورة وخلي شريكك يخمّنها خلال 10 ثواني",
 "اعمل إعلان مضحك عن شريكك كأنه منتج خارق",
 "قول نكتة وحاول تخليه يضحك من غير ما تضحك",
 "قول 3 حاجات مضحكة حصلت لكم مع بعض",
 "ارقص رقصة عشوائية 10 ثواني",
 "قل جملة رومانسية بصوت روبوت",
 "اتكلم 10 ثواني كأنك مذيع بيعلن عن مغامرتكم",
 "اختر اسم فيلم مضحك لحكايتكم النهارده",
 "اعمل وش مضحك لحد ما شريكك يضحك",
 "مدح شريكك 15 ثانية بس من غير كلمة بحبك",
 "اقترح خروجة غير تقليدية لآخر الأسبوع",
 "قل 3 صفات حلوة في شريكك بسرعة",
 "قلّد رد فعل شريكك لما بيجيله خبر حلو",
 "احكي أغرب حلم شفته بدون مبالغة",
 "اختر لقب جاسوسي مضحك لشريكك",
 "مثّل فرحتك لما خلصتوا آخر مهمة"
];
const DARES_ROMANCE=[
 "بصوا في عيون بعض 15 ثانية من غير كلام",
 "قول لشريكك حاجة محدش يعرف إنك بتحبها فيه",
 "امسكوا إيد بعض 15 ثانية لو مرتاحين",
 "قول أحلى ذكرى عندك معاهم في 20 ثانية",
 "اختر أغنية تكون موسيقى المشهد ده",
 "همس جملة لطيفة في ودن شريكك لو حابين",
 "ادّيه مجاملة مبتكرة من غير كلمة جميل",
 "قول له إيه اللي بيخليك تحس بالأمان معاه",
 "اختار موعد رومانسي صغير ونفّذوا فكرته قريب",
 "احكي أول انطباع كان عندك عن شريكك",
 "قول 3 أسباب إن وجوده في حياتك فارق",
 "اقترح مفاجأة من غير أي مصاريف",
 "اقربوا من بعض واحكوا موقف يضحككم",
 "اكتبوا اسم علاقتكم كعنوان لفيلم",
 "قول حاجة حلوة نفسك تعملوها مع بعض",
 "ابعتله بوسة في الهوا كأنكم أبطال فيلم"
];
const DARES_SPICY=[
 "اعمل غمزة سينمائية وخلي شريكك يقيّمها من 10",
 "قول جملة غزل جريئة لكن لطيفة بصوت واطي",
 "لو الاتنين موافقين: بوسة على الخد أو بديلها كلمة دلع",
 "اختاروا أغنية وارقصوا جنب بعض 15 ثانية لو حابين",
 "اتحدّى شريكك مين يكسّف التاني بمجاملة أول",
 "همس كلمة سر رومانسية واخترعوا ليها معنى",
 "اعمل نظرة غرامية 10 ثواني من غير ما تضحك",
 "قول إيه أكتر تفصيلة صغيرة بتشدك في شريكك",
 "لو مرتاحين: حضن دافي 15 ثانية أو استبدلوه بكلام حلو",
 "قل لشريكك أحلى موعد رومانسي نفسك تعيشه معاه",
 "اطلب طلب دلع خفيف والشريك حر يوافق أو يرفض",
 "قول جملة عاطفية كأنك في مشهد فيلم رومانسي",
 "وصف شعورك لما شريكك بيقول لك كلام حلو",
 "اعملوا مصافحة سرية تنتهي بابتسامة أو حضن لو حابين",
 "احكوا لبعض أكثر موقف رومانسي مضحك مر عليكم",
 "اختاروا لقب دلع جديد للتحدي ده بس"
];
const ACTS=[
 ["حبيب نسي الذكرى السنوية",["بيستنى مفاجأة","نسي ذكرى مهمة","بيصور سيلفي"],1],
 ["أول مقابلة فيها توتر",["أول مقابلة متوترة","حد بيطلب أكل","حد ضايع"],0],
 ["عرض زواج في فيلم قديم",["رقصة","عرض زواج","مطاردة"],1],
 ["حد بيدوّر على المفتاح",["بيفتش عن مفتاح","بيرسم","بيطبخ"],0],
 ["راقص مش عارف يرقص",["شخص بيجري","شخص بينام","راقص متلخبط"],2],
 ["حد بيحاول يكتم ضحكته",["بيكتم ضحك","بيغني","بيفكر"],0],
 ["رسالة حب مكتوبة",["تذكرة طيران","رسالة حب","كشف حساب"],1],
 ["شخص مستني مكالمة",["مستني مكالمة","بيجري","بيقرأ كتاب"],0],
 ["فيلم رعب تحول لرومانسية",["فيلم رعب رومانسي","ماتش كورة","مسابقة طبخ"],0],
 ["حد بيختار لبس الخروجة",["بينضف","بيختار لبس","بيذاكر"],1],
 ["مصور زفاف متوتر",["مصور زفاف","لعيب كورة","مذيع"],0],
 ["حد بيحاول يعمل قلب بإيده",["بيشرب","بيعمل قلب بإيده","بيكتب"],1],
 ["شخص بيفاجئ حبيبه",["بيفاجئ شريكه","بيزعل","بينظف"],0],
 ["حد بيمدح نفسه في المراية",["بيمدح نفسه","بيصلح عربية","بيجري"],0],
 ["اعتذار بطريقة مضحكة",["بيحتفل","بيعتذر","بيصور"],1],
 ["حد شاف مفاجأة عمره",["شاف مفاجأة","جعان","مستعجل"],0],
 ["بيكسب تحدي رقص",["بيطبخ","بيجري","فاز في رقص"],2],
 ["حد بيسرق شوكولاتة",["بيسوق","بيسرق شوكولاتة","بيقرأ"],1],
 ["حد بيحاول يصحّي شريكه",["بيصحي حد","بيصلح تكييف","بيغني"],0],
 ["شخص بيختار هدية",["بيسبح","بيختار هدية","بيكتب"],1],
 ["بيعمل سيلفي رومانسي",["بيعمل سيلفي","بيرسم","بيلعب"],0],
 ["شخص خجول بيتغزل",["خجول بيتغزل","بيستقبل ضيف","بيتحاسب"],0],
 ["حد وقع في حب أول نظرة",["زعلان","مستغرب","حب من أول نظرة"],2],
 ["بيحتفل بهروب ناجح",["بيتحرك في الظلام","بيحتفل","بيتناول العشا"],1]
];
const RIDDLES=[
 ["إيه اللي ليه مفاتيح بس مبيفتحش أبواب؟",["البيانو","السيارة","الشنطة"],0],
 ["إيه اللي كل ما تاخد منه يكبر؟",["الساعة","الحفرة","الكتاب"],1],
 ["إيه اللي بيجري من غير رجلين؟",["المية","الشباك","الكرسي"],0],
 ["حاجة ليها أسنان ومبتعضّش؟",["السمكة","المشط","المفتاح"],1],
 ["إيه اللي بيدخل المية ومبيتبلّش؟",["الظل","الورق","القطن"],0],
 ["إيه اللي كل ما زاد نقص؟",["الوقت اللي باقي","الطول","العمر على الورق"],0],
 ["إيه اللي بيسمع من غير ودان ويتكلم من غير لسان؟",["الكتاب","الصدى","النجمة"],1],
 ["أيه اللي قدامك دايمًا ومش بتشوفه؟",["المستقبل","المرآة","باب البيت"],0],
 ["إيه اللي ليه رقبة من غير راس؟",["الزجاجة","القط","القلم"],0],
 ["إيه اللي بيتكسر من غير ما نلمسه؟",["الخشب","الوعد","الزجاج"],1],
 ["إيه اللي لازم نكسره عشان نستخدمه؟",["البيضة","القلم","الحذاء"],0],
 ["إيه اللي بينزل ومبيطلعش تاني؟",["الشتا","المطر","السلم"],1],
 ["إيه اللي يملا المكان ومبياخدش مساحة؟",["الضوء","السرير","الدولاب"],0],
 ["إيه اللي بتشوفه مرة في دقيقة ومرتين في لحظة؟",["حرف اللام","حرف الميم","حرف الحاء"],0],
 ["إيه اللي بيكتب ومبيعرفش يقرأ؟",["القلم","البحر","الشباك"],0],
 ["إيه اللي له عين ومبيشوفش؟",["الإبرة","الساعة","الباب"],0],
 ["إيه اللي قد الفيل ومالوش وزن؟",["ظله","شنطته","صورته الورق"],0],
 ["إيه اللي لو نطقنا اسمه بيتكسر؟",["الصمت","المطر","المفتاح"],0],
 ["إيه اللي ممكن تسند عليه لكن مش تلبسه؟",["الحيطة","المية","الهوا"],0],
 ["إيه اللي كل الناس عندها منه بصمة مختلفة؟",["الأصابع","المخدة","الشعر"],0],
 ["إيه اللي بيعدي من الزجاج من غير ما يكسره؟",["الضوء","الحجر","الرياح"],0],
 ["إيه اللي بيقوى كل ما نتشاركه؟",["المعرفة","السر اللي بنخبيه","التعب"],0],
 ["إيه اللي لازم تفتحه قبل ما تقرا اللي جواه؟",["الكتاب","الباب","الحزام"],0],
 ["إيه اللي بيطلع لما الحر يزيد وبيختفي مع البرد؟",["العرق","الثلج","النجوم"],0]
];
const SYMBOLS=["⬆️","➡️","⬇️","⬅️"];
const STAGE_META={
 laser:["🚪","ممر الليزر"],code:["🔐","شفرة القفل"],sequence:["🧠","خريطة الإشارات"],riddle:["🧩","لغز العميل"],
 match:["💞","على نفس الموجة"],predict:["🔮","توقّع الإجابة"],truth:["💬","اعتراف لطيف"],gift:["🎁","اختار المفاجأة"],
 dare:["😘","تحدي الجرأة"],pulse:["⚡","اشحنوا الطاقة"],act:["🎭","مثّل وخمّن"],sync:["🚀","الهروب المزدوج"]
};
let connected=false,host=false,devices=[],pending=null,game=null,localHeat=Number(localStorage.getItem("he_level")||1),lastVersion=-1,selectedLevel=1,toast="",hasError=false;
function safe(t){return String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function nativeCall(name,arg){try{if(!window.Native||typeof Native[name]!=="function")throw Error("التطبيق مش متاح");if(arg===undefined)Native[name]();else Native[name](arg);}catch(e){showError("تعذر تشغيل "+name+": "+e.message);}}
function dispatch(p){try{Native.send(JSON.stringify(p));}catch(e){showError("فقدنا الاتصال بالموبايل التاني");}}
function label(t){return safe(t).replace(/\n/g," ");}
function buzz(){try{Native.vibrate();}catch(e){}}
function tone(good=true){try{const a=new(window.AudioContext||window.webkitAudioContext)(),o=a.createOscillator(),v=a.createGain();o.frequency.value=good?720:220;v.gain.value=.045;o.connect(v);v.connect(a.destination);o.start();v.gain.exponentialRampToValueAtTime(.001,a.currentTime+.14);o.stop(a.currentTime+.15);o.onended=()=>a.close();}catch(e){}}
function head(){return `<header class="top"><div><div class="eyebrow">MISSION: TWO HEARTS</div><div class="logo">الهروب <span class="accent">سوا</span> 💘</div></div><div class="pill">الإصدار 2.0</div></header>`;}
function chooseHeat(v){localHeat=Number(v);localStorage.setItem("he_level",String(localHeat));menu();}
function progress(){return Math.min(120,Math.max(1,Number(localStorage.getItem("he_unlock")||1)));}
function chapters(){let m=progress();return CHAPTERS.map((c,i)=>`<div class="world ${m<(i*10+1)?"locked":""}"><span class="worldicon">${c[0]}</span><div><b>${c[1]}</b><small>المراحل ${i*10+1}–${(i+1)*10}</small></div><span class="worldstar">${m>(i+1)*10?"✅":m>=i*10+1?"🔓":"🔒"}</span></div>`).join("");}
function menu(){
  game=null;lastVersion=-1;
  app.innerHTML=head()+`<div class="hero newhero"><div class="orb">💌</div><div class="tagline">جاسوسية، أسرار، ضحك ... ورومانسية</div><h1>مغامرة <span class="accent">الكبار</span> بدأت 🔥</h1><p class="desc">120 مرحلة في 12 عالَم، و4 تحديات في كل مهمة. اتفقوا على مستوى الجرأة، والباقي علينا!</p></div>
  <div class="panel"><div class="step">اختاروا المود قبل ما تبدأوا</div><div class="heatgrid">${HEATS.map((h,i)=>`<button class="heat ${localHeat===i?"selected":""}" onclick="chooseHeat(${i})">${h.icon}<span>${h.short}</span></button>`).join("")}</div><p class="hint">${localHeat===2?"🔥 جرأة ودلع وبوسات خفيفة، وكل حاجة بالتراضي":"💕 التحديات بتتكيّف مع المود اللي تختاروه"}</p><button class="btn" onclick="makeRoom()">🕹️ أنشئ غرفة لعب</button><button class="btn cyanbg" onclick="listDevices()">🔗 انضم من موبايل تاني</button><button class="btn alt" onclick="showHow()">🎲 تعرف على طريقة اللعب</button></div>
  <div class="sectiontitle">🗺️ خريطة المغامرة <span>12 عالم • 120 مرحلة</span></div><div class="worlds">${chapters()}</div>
  <p class="note">بلوتوث من غير إنترنت • للكبار • أي تحدي ممكن يتتخطّى من غير خصم</p>`;
}
function showHow(){app.innerHTML=head()+`<section class="panel"><h2>🎮 التعليمات</h2><div class="how"><p><b>١.</b> أول مرة اعملوا اقتران بين الموبايلين من إعدادات Bluetooth.</p><p><b>٢.</b> واحد يعمل غرفة والتاني ينضم ليها، ويوافق على مستوى الجرأة.</p><p><b>٣.</b> كل مهمة فيها 4 تحديات مختلفة: أبواب ليزر، شفرات، ألغاز، أسئلة تكشف شبهكم ببعض، وتمثيل وتحديات لطيفة.</p><p><b>٤.</b> أسئلة التخمين: كل واحد يختار سرًّا، والإجابات بتظهر بعد ما الاتنين يجاوبوا.</p><p><b>٥.</b> التحديات الرومانسية اختيارية؛ تقدروا تخطّوا أي سؤال أو حركة من غير عقوبة أو ضغط.</p><p><b>٦.</b> نقاطكم بتزيد مع التفاهم والسرعة، وبعد كل 10 مراحل بتدخلوا عالم جديد.</p></div><button class="btn" onclick="menu()">يلا نلعب 💘</button></section>`;}
function showError(message){hasError=true;app.innerHTML=head()+`<section class="panel center"><div style="font-size:60px">⚠️</div><h2>في مشكلة بالاتصال</h2><p class="desc">${safe(message)}</p><button class="btn" onclick="menu()">رجوع للبداية</button><button class="btn alt" onclick="nativeCall('settings')">إعدادات البلوتوث</button></section>`;}
function waiting(t){app.innerHTML=head()+`<div class="panel waiting"><div class="spinner"></div><h2>جاري الاتصال 👀</h2><p class="desc">${safe(t)}</p><button class="btn alt" onclick="menu()">رجوع</button></div>`;}
function makeRoom(){pending="host";waiting("بنطلب صلاحية البلوتوث ...");nativeCall("permission");}
function listDevices(){pending="paired";waiting("بنجيب الأجهزة المقترنة ...");nativeCall("permission");}
function showDevices(){app.innerHTML=head()+`<section class="panel"><h2>📱 اختار الموبايل</h2><p class="desc">لو موبايل مراتك مش ظاهر، اعملوا Pairing من إعدادات Bluetooth الأول.</p>${devices.length?devices.map((d,i)=>`<button class="device" onclick="connectTo(${i})"><span><strong>${safe(d.name)}</strong><small>${safe(d.addr)}</small></span><span>اتصل ←</span></button>`).join(""):`<p class="desc">مفيش موبايلات مقترنة لسه.</p>`}<button class="btn alt" onclick="nativeCall('settings')">⚙️ إعدادات البلوتوث</button><button class="btn alt" onclick="nativeCall('paired')">تحديث الأجهزة</button><button class="btn alt" onclick="menu()">رجوع</button></section>`;}
function connectTo(i){let d=devices[i];if(!d)return;waiting("بنتصل بـ "+d.name+" ...");nativeCall("join",d.addr);}
window.onNative=(type,detail)=>{
 if(type==="ready"){if(pending==="host"){pending=null;nativeCall("host");}else if(pending==="paired"){pending=null;nativeCall("paired");}return;}
 if(type==="waiting"){waiting(detail);return;}
 if(type==="paired"){try{devices=JSON.parse(detail);}catch(e){devices=[];}showDevices();return;}
 if(type==="error"){showError(detail);return;}
 if(type==="disconnected"){connected=false;game=null;showError(detail);return;}
 if(type==="connected"){connected=true;host=detail==="host";waiting("اتصلنا! بنجهّز غرفة اللعب ...");if(host)setTimeout(startLobby,350);return;}
 if(type==="message"){let p;try{p=JSON.parse(detail);}catch(e){return;}
   if(p.t==="S"&&!host){let refresh=!game||game.version!==p.g.version;game=p.g;lastVersion=game.version;if(refresh)render();else updateClock();}
   if(p.t==="A"&&host)execute(p.a,p.v,"guest");
 }
};
function levelChapter(n){return CHAPTERS[Math.floor((n-1)/10)%CHAPTERS.length];}
function whoHacker(){return game&&game.level%2?"host":"guest";}
function me(){return host?"host":"guest";}
function other(){return host?"guest":"host";}
function rand(n){return Math.floor(Math.random()*n);}
function makeStages(n){
 let puzzles=["laser","code","sequence","riddle"];
 let socials=["match","predict","truth","gift"];
 let actions=["dare","act","pulse","dare"];
 return [puzzles[(n-1)%4],socials[Math.floor((n-1)/4)%4],actions[Math.floor((n-1)/3)%4],"sync"];
}
function selectQuestion(level,heat,offset){
 let p=[...FUN,...(heat>=1?ROMANCE:[]),...(heat>=2?SPICY:[])];
 return p[((level-1)*7+offset*17+Math.floor(level/5)*3)%p.length];
}
function selectDare(level,heat){
 let p=[...DARES_FUN,...(heat>=1?DARES_ROMANCE:[]),...(heat>=2?DARES_SPICY:[])];
 return p[(level*11+Math.floor(level/6)*3)%p.length];
}
function startLobby(){
 if(!host)return;
 game={status:"lobby",level:progress(),heat:localHeat,approved:{host:true,guest:false},version:1,score:0,last:"الغرفة جاهزة! مستنيين موافقة شريكك."};
 sync();
}
function sync(){if(!host||!connected||!game)return;lastVersion=game.version;dispatch({t:"S",g:game});render();}
function refresh(){if(!host)return;game.version++;sync();}
function beginLevel(n,score){
 if(!host)return;
 n=Math.max(1,Math.floor(Number(n)||1));
 game={status:"play",level:n,heat:game.heat,phase:0,stages:makeStages(n),hearts:5,score:score||0,version:game.version+1,last:"خلّينا نبدأ! كل ثانية بتفرق.",state:"ready"};
 setupStage();sync();
}
function setupStage(){
 let g=game,t=g.stages[g.phase],n=g.level;
 g.state="active";g.choices={host:null,guest:null};g.confirm={host:false,guest:false};g.presses={host:0,guest:0};g.taps={host:0,guest:0};g.step=0;
 g.last="اتكلموا، تعاونوا، واكسبوا سوا 💘";
 if(t==="laser")g.data={route:Array.from({length:3+n%4},()=>rand(3))};
 else if(t==="code")g.data={code:Array.from({length:4},()=>rand(10)).join("")};
 else if(t==="sequence")g.data={seq:Array.from({length:4+n%3},()=>rand(4))};
 else if(t==="riddle"){let i=(n*5+Math.floor(n/4))%RIDDLES.length;g.data={card:RIDDLES[i]};}
 else if(["match","predict","gift"].includes(t)){g.data={card:selectQuestion(n,g.heat,g.phase),target:n%2?"host":"guest"};}
 else if(t==="truth"){g.data={text:selectQuestion(n,g.heat,g.phase)[0],speaker:n%2?"host":"guest"};}
 else if(t==="dare"){g.data={text:selectDare(n,g.heat),speaker:n%2?"host":"guest"};}
 else if(t==="act"){g.data={card:ACTS[(n*7+Math.floor(n/10))%ACTS.length],speaker:n%2?"host":"guest"};}
 else g.data={};
 g.length=t==="pulse"?10+n%7:0;
 g.duration=["truth","dare"].includes(t)?120:150;
 g.endsAt=Date.now()+g.duration*1000;
 g.remaining=g.duration;
}
function action(a,v){if(!connected||!game)return;if(host)execute(a,v,"host");else dispatch({t:"A",a,v});}
function complete(msg,points=100,reveal=false){
 let g=game;g.score+=points;
 if(reveal){g.state="reveal";g.last=msg;}
 else advance(msg);
 tone(true);
}
function advance(msg){
 let g=game;g.phase++;
 if(g.phase>=g.stages.length){
  g.status="win";g.last=msg||"نجحتوا في المهمة!";
  let unlocked=progress();if(g.level>=unlocked){localStorage.setItem("he_unlock",String(Math.min(120,g.level+1)));}
 }else{setupStage();g.last=msg||"ممتاز! التحدي اللي بعده!";}
}
function incorrect(msg){game.hearts--;game.last=msg||"🚨 إجابة غلط! جرّبوا تاني.";buzz();tone(false);if(game.hearts<=0){game.status="fail";game.last="خلصت فرص الفريق! نعيد المهمة ونكسبها سوا؟";}}
function revealChoices(){
 let g=game,card=g.data.card;let first=card[1][g.choices.host],second=card[1][g.choices.guest];
 const same=g.choices.host===g.choices.guest;
 let msg=(same?"💞 نفس الموجة! ":"😄 اختلاف لطيف! ")+"الأول: "+first+" — التاني: "+second;
 complete(msg,same?200:60,true);
}
function execute(a,v,from){
 if(!host||!game||!connected)return;let g=game;
 if(g.status==="lobby"){
  if(a==="consent"&&from==="guest"){g.approved.guest=!!v;g.last=g.approved.guest?"حلو! الاتنين موافقين، ابدأوا!":"مستنيين الموافقة.";refresh();return;}
  if(a==="start"&&from==="host"&&g.approved.guest){beginLevel(g.level,0);return;}
  return;
 }
 if(g.status==="win"||g.status==="fail"){
  if(a==="next"){beginLevel(g.status==="win"?g.level+1:g.level,g.status==="win"?g.score:g.score);return;}
  return;
 }
 if(g.status!=="play")return;
 if(a==="skip"&&g.state!=="reveal"){complete("↪️ عديتوا التحدي براحتكم. اللي يريحكم أحلى!",0,true);refresh();return;}
 if(g.state==="reveal"){if(a==="proceed"){advance("🎉 يلا على التحدي اللي بعده!");refresh();}return;}
 let t=g.stages[g.phase],hacker=whoHacker(),runner=hacker==="host"?"guest":"host";
 if(a==="lane"&&t==="laser"&&from===runner){
  if(!Number.isInteger(v)||v<0||v>2)return;
  let correct=g.data.route[g.step]===v;
  g.step++;
  if(correct){g.score+=35;g.last="✅ ممتاز! فتحت باب آمن.";}
  else incorrect("🚨 ده باب عليه ليزر! اسمع الخريطة كويس.");
  if(g.status==="play"&&g.step>=g.data.route.length)complete("🔓 عديتوا ممر الليزر",120);
 }else if(a==="code"&&t==="code"&&from===hacker){
  let code=String(v).replace(/\D/g,"").slice(0,4);
  if(code.length!==4)return;
  if(code===g.data.code)complete("🔓 فكّيتوا الشفرة!",190);
  else incorrect("❌ الشفرة غلط. كل واحد يقول رقمينه بالترتيب!");
 }else if(a==="symbol"&&t==="sequence"&&from===runner){
  if(!Number.isInteger(v)||v<0||v>3)return;
  if(g.data.seq[g.step]===v){g.step++;g.score+=35;g.last="✅ إشارة صح!"}
  else {incorrect("🚨 إشارة مش هي دي! دورك لسه على نفس الرمز.");}
  if(g.status==="play"&&g.step>=g.data.seq.length)complete("📡 الإشارات وصلت كاملة!",110);
 }else if(a==="riddle"&&t==="riddle"&&from===runner){
  if(!Number.isInteger(v)||v<0||v>2)return;
  if(v===g.data.card[2])complete("🧩 الإجابة صح: "+g.data.card[1][v],170,true);
  else incorrect("🤔 مش دي الإجابة، فكّروا سوا.");
 }else if(a==="pick"&&["match","predict","gift"].includes(t)){
  if(!Number.isInteger(v)||v<0||v>2||g.choices[from]!==null)return;
  g.choices[from]=v;g.last="🔐 الإجابات مخفية لحد ما الاتنين يختاروا.";
  if(g.choices.host!==null&&g.choices.guest!==null){
   if(t==="predict"){
    let target=g.data.target,guesser=target==="host"?"guest":"host";
    let success=g.choices[target]===g.choices[guesser];
    complete((success?"🔮 عارفين بعض كويس! ":"😄 اتفاجئنا! ")+"الإجابة الحقيقية: "+g.data.card[1][g.choices[target]]+" — التوقع: "+g.data.card[1][g.choices[guesser]],success?220:60,true);
   }else revealChoices();
  }
 }else if(a==="confirm"&&["truth","dare"].includes(t)){
  g.confirm[from]=true;
  if(g.confirm.host&&g.confirm.guest)complete(t==="truth"?"💬 كلمة حلوة واتقالت، ونقطة لفريقكم!":"💘 التحدي خلّص... نجوم زيادة!",160,true);
  else g.last="💖 مستنيين تأكيد شريكك.";
 }else if(a==="act"&&t==="act"&&from!==g.data.speaker){
  if(!Number.isInteger(v)||v<0||v>2)return;
  if(v===g.data.card[2])complete("🎭 فهمتوا الإشارة! الإجابة: "+g.data.card[1][v],200,true);
  else incorrect("😅 مش دي الحركة... ادّيه فرصة يمثّل تاني!");
 }else if(a==="pulse"&&t==="pulse"){
  if(g.presses[from]>=g.length)return;
  g.presses[from]++;
  if(g.presses.host>=g.length&&g.presses.guest>=g.length)complete("⚡ البطارية اتشحنت بإيدكم الاتنين!",210);
 }else if(a==="tap"&&t==="sync"){
  if(g.taps[from]>0)return;
  let now=Date.now();
  if(!g.taps.host&&!g.taps.guest)g.firstTap=now;
  g.taps[from]=now;
  if(g.taps.host&&g.taps.guest){
   if(Math.abs(g.taps.host-g.taps.guest)<=2800)complete("🚀 فتحتوا بوابة الهروب في الوقت الصح!",300,true);
   else{g.taps={host:0,guest:0};g.firstTap=0;g.last="⏰ بعيد عن بعض! عدّوا ٣،٢،١ واضغطوا تاني.";}
  }else g.last="👀 واحد ضغط، مستنيين التاني بسرعة!";
 }else return;
 refresh();
}
function tick(){
 if(!host||!game||game.status!=="play"||game.state!=="active")return;
 let g=game;g.remaining=Math.max(0,Math.ceil((g.endsAt-Date.now())/1000));
 if(g.stages[g.phase]==="sync"&&g.firstTap&&(g.taps.host||g.taps.guest)&&Date.now()-g.firstTap>2800){
   g.taps={host:0,guest:0};g.firstTap=0;g.last="⌛ اتأخرتوا! حاولوا تاني مع بعض.";refresh();
 }
 if(g.remaining<=0){incorrect("⏰ انتهى الوقت!");if(g.status==="play")complete("⏭️ فاتكم الوقت في التحدي ده، كملوا!",0,true);refresh();}
 else dispatch({t:"S",g});
 updateClock();
}
setInterval(tick,1000);
function clockHead(){
 let g=game,chapter=levelChapter(g.level);
 return `<div class="worldline"><span>${chapter[0]} ${chapter[1]}</span><b>المهمة ${g.level}${g.level>120?"+":""}</b></div><div class="status"><span class="chip">🏅 <b>${g.score}</b></span><span class="chip">❤️ <b>${g.hearts}</b></span><span class="timer" id="timer">${g.remaining||0}ث</span></div><div class="track"><div class="fill" id="timefill" style="width:${Math.round((g.remaining||0)/(g.duration||150)*100)}%"></div></div>`;
}
function updateClock(){if(!game)return;let t=document.getElementById("timer"),f=document.getElementById("timefill");if(t){t.textContent=game.remaining+"ث";t.classList.toggle("danger",game.remaining<20);}if(f)f.style.width=Math.round(game.remaining/(game.duration||150)*100)+"%";}
function role(text){return `<div class="role"><div class="rolelabel">تلميح خاص لدورك</div><p>${text}</p></div>`;}
function stageNav(){
 let g=game;return `<div class="stagegrid">${g.stages.map((t,i)=>`<div class="stageitem ${i===g.phase?"current":""} ${i<g.phase?"past":""}">${i<g.phase?"✓":STAGE_META[t][0]}<small>${i+1}</small></div>`).join("")}</div>`;
}
function btn(txt,fn,kind=""){return `<button class="btn ${kind}" onclick="${fn}">${txt}</button>`;}
function choices(card,callback,disabled=false){
 return `<div class="options">${card[1].map((x,i)=>`<button class="option" ${disabled?"disabled":""} onclick="${callback}(${i})"><span>${["①","②","③"][i]}</span>${safe(x)}</button>`).join("")}</div>`;
}
function playScreen(){
 let g=game,t=g.stages[g.phase],d=g.data,meHacker=me()===whoHacker(),runner=me()!==whoHacker();
 let out=`${clockHead()}${stageNav()}<div class="step">التحدي ${g.phase+1} من 4 • ${STAGE_META[t][1]}</div><h2 class="missiontitle">${STAGE_META[t][0]} ${STAGE_META[t][1]}</h2>`;
 if(g.state==="reveal"){
   out+=`<section class="panel center"><div class="confetti">✨💖✨</div><h2>خلصتوا التحدي!</h2><p class="desc">${safe(g.last)}</p>${btn("التحدي اللي بعده ←","action('proceed',true)")}</section>`;
   return out;
 }
 if(t==="laser"){
   if(meHacker)out+=role("إنت شايف الأبواب الآمنة. قول لشريكك أي باب يختاره، 1 أو 2 أو 3.")+`<div class="panel"><div class="step">الخريطة السرّية</div><div class="route">${d.route.map((v,i)=>`<div class="dot ${i<g.step?"done":i===g.step?"current":""}">${v+1}</div>`).join("")}</div><p class="desc center">الاختيار الحالي <b class="cyan">${d.route[g.step]+1}</b></p></div>`;
   else out+=role("اسمع شريكك وافتح الباب الصحيح. هو الوحيد اللي شايف الخريطة.")+`<div class="route">${d.route.map((_,i)=>`<div class="dot ${i<g.step?"done":i===g.step?"current":""}">${i<g.step?"✓":i+1}</div>`).join("")}</div><div class="doors">${[0,1,2].map(i=>`<button class="door" onclick="action('lane',${i})"><span>باب ${i+1}</span><span class="symbol">🚪</span><span>افتح</span></button>`).join("")}</div>`;
 } else if(t==="code"){
   out+=role(meHacker?"إنت شايف الخانة 1 و3، شريكك شايف 2 و4. اسمع منه واكتب الشفرة.":"إنت شايف الرقم الثاني والرابع. بلّغهم لشريكك بالترتيب.")+`<div class="panel"><div class="step">كود سري من أربعة أرقام</div><div class="keypad">${d.code.split("").map((x,i)=>`<div class="digit ${((i%2===0)===meHacker)?"":"hidden"}">${((i%2===0)===meHacker)?x:"?"}</div>`).join("")}</div>${meHacker?`<input class="codeInput" id="code" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••"><button class="btn cyanbg" onclick="submitCode()">🔓 فتح القفل</button>`:"<p class='desc center'>🕵️ شريكك هو اللي هيدخل الكود</p>"}</div>`;
 }else if(t==="sequence"){
   out+=role(meHacker?"قول ترتيب الأسهم لشريكك بالراحة، خطوة بخطوة.":"اسمع ترتيب الأسهم واضغط كل رمز بالترتيب.")+`<div class="panel"><div class="step">الإشارات السرية</div>${meHacker?`<div class="route">${d.seq.map((x,i)=>`<div class="dot ${i<g.step?"done":i===g.step?"current":""}">${SYMBOLS[x]}</div>`).join("")}</div><p class="desc center">الإشارة الحالية ${SYMBOLS[d.seq[g.step]]}</p>`:`<div class="route">${d.seq.map((_,i)=>`<div class="dot ${i<g.step?"done":i===g.step?"current":""}">${i<g.step?"✓":"?"}</div>`).join("")}</div><div class="arrowgrid">${SYMBOLS.map((x,i)=>`<button onclick="action('symbol',${i})">${x}</button>`).join("")}</div>`}</div>`;
 }else if(t==="riddle"){
   out+=`<div class="panel"><div class="step">فكّروا سوا</div><h2>${safe(d.card[0])}</h2>${meHacker?role("إنت شايف الحل السرّي. قول تلميح من غير ما تقول الإجابة: "+safe(d.card[1][d.card[2]])):"<p class='desc'>شريكك عنده تلميح. اسمعه قبل ما تختار.</p>"}${runner?choices(d.card,"pickRiddle"):""}</div>`;
 }else if(["match","predict","gift"].includes(t)){
   let myPick=g.choices[me()];
   let title=t==="predict"?(me()===d.target?"إنت صاحب الاختيار الحقيقي 🎯":"توقّع اختيار شريكك 🔮"):(t==="gift"?"إيه المفاجأة اللي تختاروها؟ 🎁":"إنتوا شبه بعض قد إيه؟ 💞");
   out+=`<div class="panel"><div class="step">${title}</div><h2>${safe(d.card[0])}</h2><p class="desc">جاوب من غير ما تقول الإجابة. هنفتح اختياراتكم مع بعض لما الاتنين يخلصوا.</p>${myPick===null?choices(d.card,"pickOption"):`<div class="alert success">🔐 اختيارك اتحفظ سرًّا. مستنيين شريكك ...</div>`}</div>`;
 }else if(t==="truth"){
   out+=`<div class="panel"><div class="step">اعتراف خفيف ... أو تعدّوه 😌</div><h2>${safe(d.text)}</h2>${role(d.speaker===me()?"جاوب السؤال بصوتك وشريكك يسمعك.":"اسمع إجابة شريكك، وممكن تسأله سؤال متابعة لطيف.")}<div class="confirmgrid"><span>${g.confirm.host?"✅":"⏳"} الأول</span><span>${g.confirm.guest?"✅":"⏳"} التاني</span></div>${btn(g.confirm[me()]?"✔️ أكّدت":"💬 اتكلمنا وخلصنا","action('confirm',true)",g.confirm[me()]?"alt":"cyanbg")}</div>`;
 }else if(t==="dare"){
   out+=`<div class="panel"><div class="step">مهمة لطيفة مش إلزامية</div><h2>${safe(d.text)}</h2>${role(d.speaker===me()?"دورك تعمل التحدي لو مرتاح. قول لشريكك لما تخلص.":"شجّع شريكك، ومفيش أي مشكلة لو أي حد حابب يعدّي التحدي.")}<div class="confirmgrid"><span>${g.confirm.host?"✅":"⏳"} الأول</span><span>${g.confirm.guest?"✅":"⏳"} التاني</span></div>${btn(g.confirm[me()]?"✔️ تمام":"❤️ نفّذناه","action('confirm',true)",g.confirm[me()]?"alt":"cyanbg")}</div>`;
 }else if(t==="act"){
   out+=`<div class="panel"><div class="step">تمثيل من غير كلام ... لو تقدر 😄</div>${d.speaker===me()?`<h2>${safe(d.card[0])}</h2>${role("مثّل الكلام اللي فوق باستخدام وشك وإيدك. ممنوع تقول الاسم!")}<p class="desc">استنى شريكك يخمّن من موبايله.</p>`:`<h2>شريكك بيمثّل حاجة سرية... 👀</h2>${role("راقبه وخمّن هو بيقلد إيه من الاختيارات دي.")}${choices(d.card,"pickAct")}`}</div>`;
 }else if(t==="pulse"){
   let mine=g.presses[me()],theirs=g.presses[other()],size=g.length;
   out+=`<div class="panel center"><div class="step">كل واحد لازم يشحن نص الطاقة</div><h2>دوس بسرعة! ⚡</h2><div class="energy"><div class="energyfill" style="width:${Math.round((mine+theirs)/(size*2)*100)}%"></div></div><p class="desc">إنت ${mine}/${size} • شريكك ${theirs}/${size}</p><button class="bigTap ${mine>=size?"armed":""}" ${mine>=size?"disabled":""} onclick="action('pulse',1)">${mine>=size?"✅ نصك اتشحن":"⚡ اشحن!"}</button></div>`;
 }else if(t==="sync"){
   let mine=g.taps[me()]>0,otherTap=g.taps[other()]>0;
   out+=`<div class="panel center"><h2>بوابة الهروب المزدوج 🚀</h2><p class="desc">لازم كل واحد يدوس من موبايله خلال 2.8 ثانية. عدّوا بصوت عالي: 3 .. 2 .. 1!</p><button class="bigTap ${mine?"armed":""}" ${mine?"disabled":""} onclick="action('tap',1)">${mine?"✅ تم الضغط":"🚀 اهربوا!"}</button><p class="desc">${mine?(otherTap?"النجاح قرب!":"مستني شريكك!"): "دوس لما تتفقوا"}</p></div>`;
 }
 out+=`<div class="alert">${safe(g.last)}</div><button class="btn alt skip" onclick="action('skip',true)">⤼ تخطّي التحدي من غير عقوبة</button>`;
 return out;
}
function render(){
 if(!game){menu();return;}
 let g=game,out=head();
 if(g.status==="lobby"){
   out+=`<div class="hero"><div class="orb">🎲</div><h1>الغرفة جاهزة!</h1><p class="desc">مغامرة من 120 مرحلة، واتفاقكم على المود قبل البداية مهم 💘</p></div><div class="panel center"><div class="step">المود المختار</div><h2>${HEATS[g.heat].icon} ${HEATS[g.heat].name}</h2><p class="desc">أي تحدي جريء تقدروا تتخطوه في أي وقت بدون خصم.</p><div class="chip">${g.approved.guest?"✅ الطرفين موافقين":"⏳ مستنيين موافقة الطرف التاني"}</div>${host?`<p class="desc">مرحلتك الحالية: ${g.level}</p>${btn("🚨 ابدأوا المغامرة","action('start',true)",g.approved.guest?"":"")}`:btn(g.approved.guest?"✅ وافقت":"💞 موافق/موافقة على المود","action('consent',true)",g.approved.guest?"alt":"cyanbg")}</div>`;
   if(host&&!g.approved.guest)out=out.replace(/<button class="btn " onclick="action\('start',true\)">/,`<button class="btn " disabled onclick="action('start',true)">`);
 }else if(g.status==="win"||g.status==="fail"){
   const won=g.status==="win";
   out+=`<div class="panel center"><div class="confetti">${won?"🎉❤️✨":"🚨🙈💥"}</div><h1>${won?"نجحت المهمة!":"المهمة ما نجحتش"}</h1><p class="desc">${safe(g.last)}</p><div class="bigScore">${g.score}</div><div class="step">نقاط فريقكم</div><p class="desc">${won?"يلا نكمل! المفاجآت الجاية أكتر.":"جرّبوا مرة كمان، من غير أي إحباط."}</p>${btn(won?"🔥 ادخلوا المهمة اللي بعدها":"🔄 نعيد المهمة","action('next',true)")}</div>`;
 }else out+=playScreen();
 app.innerHTML=out;
}
function pickOption(i){action("pick",i);}
function pickAct(i){action("act",i);}
function pickRiddle(i){action("riddle",i);}
function submitCode(){let el=document.getElementById("code");if(!el)return;let val=el.value.trim().replace(/[^0-9]/g,"");if(val.length===4)action("code",val);else{el.value="";el.placeholder="٤ أرقام";el.focus();}}
window.addEventListener("error",e=>{console.log("Game error:",e.message);if(!hasError){let root=document.getElementById("app");if(root&&root.textContent.trim()===""){root.innerHTML="<div class='panel'>حصل خطأ في اللعبة، أقفلها وافتحها تاني. "+safe(e.message)+"</div>";}}});
menu();
