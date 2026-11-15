// Offline visual flag challenges. Every picture is a real local SVG file: flags/<ISO>.svg.
// Flag vectors are imported by GitHub Actions from lipis/flag-icons v7.3.2 (MIT).
const FLAG_QUESTION_IMAGES=Object.create(null);
const LEGACY_FLAG_CODES=["eg","sa","ma","dz","ae","qa","kw","jp","kr","cn","br","ar","fr","it","de","es","gb","ca"];
const FLAG_EMOJIS={"🇪🇬":"eg","🇸🇦":"sa","🇲🇦":"ma","🇩🇿":"dz","🇦🇪":"ae","🇶🇦":"qa","🇰🇼":"kw","🇯🇵":"jp","🇰🇷":"kr","🇨🇳":"cn","🇧🇷":"br","🇦🇷":"ar","🇫🇷":"fr","🇮🇹":"it","🇩🇪":"de","🇪🇸":"es","🇬🇧":"gb","🇨🇦":"ca"};
for(const [cat,rows] of Object.entries(QUESTIONS)){
 for(let i=0;i<rows.length;i++){
  const match=String(rows[i][0]).match(/^[\u{1F1E6}-\u{1F1FF}]{2}/u);
  if(match&&FLAG_EMOJIS[match[0]])FLAG_QUESTION_IMAGES[cat+"#"+i]=FLAG_EMOJIS[match[0]];
 }
}
const EXTRA_FLAG_DATA=[["br","البرازيل","easy"],["jp","اليابان","easy"],["gb","المملكة المتحدة","easy"],["ca","كندا","easy"],["au","أستراليا","easy"],["us","الولايات المتحدة","easy"],["in","الهند","easy"],["tr","تركيا","easy"],["gr","اليونان","medium"],["ch","سويسرا","medium"],["se","السويد","medium"],["dk","الدنمارك","medium"],["no","النرويج","medium"],["fi","فنلندا","medium"],["pt","البرتغال","medium"],["nl","هولندا","medium"],["be","بلجيكا","medium"],["at","النمسا","medium"],["pl","بولندا","medium"],["ua","أوكرانيا","medium"],["ru","روسيا","medium"],["mx","المكسيك","medium"],["co","كولومبيا","medium"],["pe","بيرو","medium"],["cl","تشيلي","medium"],["uy","أوروغواي","medium"],["ec","الإكوادور","medium"],["ve","فنزويلا","medium"],["za","جنوب إفريقيا","medium"],["ng","نيجيريا","medium"],["ke","كينيا","medium"],["et","إثيوبيا","hard"],["gh","غانا","medium"],["sn","السنغال","hard"],["ao","أنجولا","hard"],["cm","الكاميرون","hard"],["id","إندونيسيا","medium"],["my","ماليزيا","medium"],["sg","سنغافورة","medium"],["th","تايلاند","medium"],["vn","فيتنام","medium"],["ph","الفلبين","medium"],["bd","بنجلاديش","hard"],["lk","سريلانكا","hard"],["np","نيبال","hard"],["pk","باكستان","medium"],["ir","إيران","medium"],["iq","العراق","easy"],["jo","الأردن","easy"],["lb","لبنان","easy"],["om","عُمان","easy"],["bh","البحرين","easy"],["ly","ليبيا","easy"],["sd","السودان","medium"],["sy","سوريا","easy"],["ye","اليمن","easy"],["is","آيسلندا","hard"],["ie","أيرلندا","medium"],["hr","كرواتيا","hard"],["rs","صربيا","hard"],["hu","المجر","hard"],["cz","التشيك","hard"],["ro","رومانيا","hard"],["al","ألبانيا","hard"],["bo","بوليفيا","hard"],["cr","كوستاريكا","hard"],["cu","كوبا","hard"],["nz","نيوزيلندا","medium"]];
const FLAG_CAT="🚩 تحدي أعلام العالم";
QUESTIONS[FLAG_CAT]=[];
for(let i=0;i<EXTRA_FLAG_DATA.length;i++){
 const [code,name,tier]=EXTRA_FLAG_DATA[i];
 const wrong=[];
 for(let j=1;j<EXTRA_FLAG_DATA.length&&wrong.length<3;j++){
  const candidate=EXTRA_FLAG_DATA[(i+j*11)%EXTRA_FLAG_DATA.length][1];
  if(candidate!==name&&!wrong.includes(candidate))wrong.push(candidate);
 }
 const questionIndex=QUESTIONS[FLAG_CAT].length;
 QUESTIONS[FLAG_CAT].push(["لأي دولة هذا العلم؟",name,...wrong]);
 FLAG_QUESTION_IMAGES[FLAG_CAT+"#"+questionIndex]=code;
 QUESTION_LEVELS[FLAG_CAT+"#"+questionIndex]=tier;
}
