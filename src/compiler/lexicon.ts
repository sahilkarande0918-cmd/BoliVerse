// Multilingual lexicon: English, Hindi and Marathi (Devanagari + common romanisations as heard in
// Hinglish / Minglish speech). Each concept lists its surface forms, space separated; multi-word
// forms use underscores. Keep this data-only so it is easy to extend.

const L: Record<string, string> = {
  // ---- objects ----
  'OBJ:house': 'house home hut cottage ghar gharon ghr makaan makan makaanon jhopdi jhonpdi jhopadi kutir घर घरों घरे मकान मकानों झोपड़ी झोपडी कुटीर',
  'OBJ:tree': 'tree ped pedh paed pedon vriksh vruksh jhad jhaad zaad jhaade jhaadi पेड़ पेड पेड़ों पेडों वृक्ष झाड झाडे झाड़ झाड़ी',
  'OBJ:bridge': 'bridge pul pull pool poolh setu brij पुल पूल पुलाला सेतु ब्रिज',
  'OBJ:river': 'river stream nadi nadee nadiya nala nahar canal darya नदी नदि नहर नाला दरिया ओढा',
  'OBJ:road': 'road street path sadak sarak rasta raasta marg सड़क सडक रास्ता रस्ता मार्ग',
  'OBJ:rock': 'rock boulder chattan chattaan dagad khadak चट्टान दगड खडक',
  'OBJ:temple': 'temple mandir devalay deul मंदिर देऊळ देवालय',
  'OBJ:well': 'well kuan kuaan kuwa kuva vihir कुआँ कुआं कुआ कुंआ विहीर',
  'OBJ:school': 'school vidyalaya shala shaala स्कूल शाळा शाला विद्यालय',
  'OBJ:lamp': 'lamp streetlight street_light lantern diya deepak batti लैंप दिया दिवा दीपक',
  'OBJ:cart': 'cart bullock_cart bailgadi bailgaadi gaadi gadi vehicle car truck बैलगाड़ी बैलगाडी गाड़ी गाडी',
  'OBJ:mansion': 'manson mansan menshan मंशन मैनशन मेंशन mansion villa bungalow haveli mahal palace bangla banglow luxury_house dream_house बंगला बंगले बंगल्यात बंगल्यामध्ये बंगल्याच्या हवेली महल बंगलो मैंशन मेंशन',
  'OBJ:sofa': 'sofa couch sofa_set सोफा सोफ़ा',
  'OBJ:bed': 'bed palang bistar पलंग बिस्तर बेड',
  'OBJ:table': 'table dining_table coffee_table mez मेज टेबल',
  'OBJ:chandelier': 'chandelier jhoomar jhumar jhumbar jumar झूमर झुंबर',
  'OBJ:plant': 'plant plants indoor_plant gamla paudha paudhe kundi पौधा पौधे गमला कुंडी',
  'OBJ:rug': 'calen kalin kaalin kaleen rug carpet galicha dari कालीन गालिचा दरी',
  'X:pool': 'swimming_pool pool_ke_saath with_pool स्विमिंग_पूल',
  'INTERIOR': 'interior walkthrough room rooms kamra kamre कमरा खोली',
  'SCENE:village': 'village gaon gaanv gaav gav gram basti town गाँव गांव गाव ग्राम बस्ती',
  'SCENE:forest': 'forest jungle jangal जंगल वन',
  'SCENE:blank': 'reset start_over new_scene clear_everything shuru_se naya_scene sab_saaf सब_साफ',

  // ---- verbs ----
  'V:create': 'make build create add construct place put plant generate spawn banao banaao bana banado banana banaye banaiye bnao banaa daalo dalo lagao rakho ugao ho hona chahiye bandho bandha banva banwa tayar taiyar lava ugva बनाओ बनाइए बना बनाना बनाएं डालो लगाओ रखो उगाओ हो होना चाहिए बांधो बांधा बनवा तयार लावा ठेवा theva rakh',
  'V:destroy': 'तो_दो to_do_do destroy break smash blow_up collapse demolish wreck tod todo todh tor toro todo_do tod_do tod_de gira girao gira_do uda_do ura_do nasht paada padun todun तोड़ो तोड़ तोडो तोड गिराओ गिरा नष्ट उड़ा उड़ाओ तोडा तोडून पाडा ध्वस्त',
  'V:delete': 'delete remove erase hatao hata hata_do nikalo nikaal mitao kadha kaadh kaadha हटाओ हटा निकालो मिटाओ काढा काढ',
  'V:repair': 'repair fix rebuild restore reconstruct theek thik sudhaar sudharo jod jodo ठीक सुधारो जोड़ो दुरुस्त',
  'V:bigger': 'bigger larger wider longer enlarge increase grow bada bara badha badhao bade badi chauda lamba mota motha mothe mothi vadhva बड़ा बडा बड़े बड़ी बढ़ाओ बढाओ चौड़ा लंबा मोठा मोठे वाढवा',
  'V:smaller': 'smaller shrink reduce narrow tiny chhota chota chhote choti chhoti patla lahan छोटा छोटे छोटी पतला लहान',
  'V:move': 'move shift slide khisko khiskao sarkao sarka halva खिसकाओ सरकाओ हलवा',
  'V:rotate': 'rotate turn spin ghumao ghuma phirva फिराओ घुमाओ फिरवा',
  'V:duplicate': 'duplicate copy clone nakal कॉपी नकल',
  'V:undo': 'undo revert wapas vapas waapas pichla_hatao वापस पूर्ववत अनडू',
  'V:redo': 'redo रीडू',
  'V:save': 'save sambhalo jatan सेव जतन',
  'V:load': 'load open kholo लोड खोलो',
  'V:push': 'push shove shake hit dhakka dhakelo hilao bhukamp earthquake explosion धक्का हिलाओ भूकंप',
  'V:stop': 'stop ruko roko band thamba बंद रुको रोको थांबा',
  'V:play': 'play preview chalao dikhao show dakhva चलाओ दिखाओ दाखवा',
  'V:paint': 'paint colour color rang rango रंग रंगो रंगवा',

  // ---- camera / film ----
  'CAM': 'camera cam view angle kaimra कैमरा कॅमेरा कैमरे',
  'REC': 'record recording video export download film shoot rikord रिकॉर्ड वीडियो व्हिडिओ फिल्म',
  'CINE': 'cinematic cinema shot flythrough fly_through sinematic सिनेमैटिक सिनेमॅटिक',
  'FLY': 'fly flying udo udao udaan udte उड़ो उड़ाओ उड़ान उडा',
  'LOW': 'neeche niche below under underneath low ground khali नीचे खाली',
  'HIGH': 'upar uper above over top high aerial overhead ऊपर उपर',
  'ORBIT': 'orbit around chakkar ghoom ghoomo circle चक्कर गोल',
  'REVEAL': 'reveal',
  'PANO': 'panorama panoramic pan wide_shot',
  'VERTICAL': 'vertical reel reels portrait instagram shorts 9:16',
  'CLOSE': 'close close_up closeup zoom paas_se',
  'OVERVIEW': 'overview whole poora pura pure sara',

  // ---- environment ----
  'TIME:sunset': 'सनसेट sunset evening dusk golden_hour shaam sham saanjh suryast sandhya sandhyakal शाम सूर्यास्त संध्याकाळ संध्या',
  'TIME:dawn': 'sunrise dawn suryoday pahat bhor सूर्योदय पहाट भोर',
  'TIME:morning': 'morning subah savera sakal सुबह सवेरा सकाळ',
  'TIME:noon': 'noon midday daytime day din dopahar dupar divas दिन दोपहर दुपार दिवस',
  'TIME:night': 'night midnight raat rat ratri andhera रात रात्री रात्र अंधेरा',
  'WEATHER:rain': 'rain raining rainy barish baarish baris varsha paus paaus बारिश वर्षा पाऊस',
  'WEATHER:storm': 'storm thunderstorm toofan tufan aandhi vadal तूफान आंधी वादळ',
  'WEATHER:fog': 'fog foggy mist misty kohra kohraa dhund dhuke कोहरा धुंध धुके',
  'WEATHER:clear': 'clear sunny dhoop saaf_mausam ऊन धूप',
  'LIGHT:dramatic': 'dramatic moody',
  'LIGHT:soft': 'soft gentle',

  // ---- qualifiers ----
  'COLOR:red': 'red laal lal लाल',
  'COLOR:blue': 'blue neela nila neeli निला नीला नीली निळा',
  'COLOR:green': 'green hara hari hare hirva हरा हरी हिरवा',
  'COLOR:yellow': 'yellow peela pila peeli pivla पीला पीली पिवळा',
  'COLOR:white': 'white safed safaid pandhra सफेद सफ़ेद पांढरा',
  'COLOR:black': 'black kaala kala kaali kali काला काली काळा',
  'COLOR:orange': 'orange narangi नारंगी',
  'COLOR:pink': 'pink gulabi गुलाबी',
  'COLOR:brown': 'brown bhura भूरा तपकिरी',
  'COLOR:purple': 'purple jamuni baingani बैंगनी जांभळा',
  'COLOR:saffron': 'saffron kesari bhagwa केसरी भगवा',
  'COLOR:indigo': 'indigo',
  'MAT:wood': 'wood wooden timber lakdi lakadi lakdi_ka lakdi_ki laakdi लकड़ी लकडी लाकडी लाकूड',
  'MAT:stone': 'stone pathar patthar dagdi पत्थर दगडी',
  'MAT:steel': 'steel iron metal loha lohe लोहा लोहे स्टील',
  'MAT:brick': 'brick eent int ईंट विटा',
  'MAT:mud': 'mud mitti kaccha मिट्टी माती',
  'MAT:glass': 'glass kaanch kanch काँच कांच',
  'MAT:gold': 'gold golden sona sone सोना सोने',
  'REL:inside': 'inside andar ke_andar ki_andar aat chya_aat के_अंदर अंदर च्या_आत आत',
  'REL:near': 'near beside next_to nearby paas pass ke_paas kareeb nazdeek jawal javal bagal पास नज़दीक नजदीक जवळ बगल करीब',
  'REL:across': 'across par paar ke_paar aar_paar palikade ke_upar ke_uper over_the के_ऊपर के_उपर पार पलीकडे',
  'REL:between': 'between ke_beech ke_bich के_बीच च्या_मध्ये',
  'REL:behind': 'behind peeche piche pichhe maage mage पीछे पिछे मागे',
  'REL:in_front': 'front in_front saamne samne samor aage सामने समोर आगे',
  'REL:left_of': 'left baayen bayen baaye baye baayi davi डावीकडे बाएं बाईं बायें',
  'REL:right_of': 'right daayen dayen daaye daye ujvi उजवीकडे दाएं दाईं दायें',
  'DIR:forward': 'forward ahead',
  'DIR:back': 'backward backwards back',
  'DIR:up': 'up upwards',
  'DIR:down': 'down downwards',
  'SIDE:west': 'west paschim पश्चिम',
  'SIDE:east': 'east purv poorv पूर्व',
  'PRON': 'it this that them these those isko isse ise usko use ye yeh woh wo vo iska uska usse इसे इसको उसे उसको ये यह वो वह त्याला ह्याला हा तो',
  'ALL': 'all every everything sab sabhi saare sare sagle sarva सब सारे सभी सगळे सर्व',
  'SAME': 'same wahi vahi usi tyach same_jagah same_place wahi_jagah usi_jagah उसी वही त्याच',
  'LITTLE': 'thoda thodi thode slightly little bit zara jara thodasa थोड़ा थोडा थोड़ी जरा ज़रा',
  'MUCH': 'very much bahut bohot zyada jyada jast khup lot बहुत ज़्यादा ज्यादा जास्त खूप',
  'DOUBLE': 'double twice dugna doguna दुगना दुप्पट',
  'HALF': 'half aadha adha आधा अर्धा',
  'FEW': 'some few kuch kahi couple कुछ काही',
  'MANY': 'many lots plenty dher ढेर bahut_saare bahut_sare bahut_se बहुत_सारे बहुत_से khup_sare khup_saari खूप_सारे lots_of',
  'SECONDS': 'second seconds sec secs sekand सेकंड सेकंद',
  'METERS': 'meter meters metre metres mtr मीटर',
  'DEGREES': 'degree degrees digri डिग्री',
  'AGAIN': 'again dobara dubara phir_se fir_se punha दोबारा फिर_से पुन्हा',
  'NEG': 'not no nahi nahin nai mat nako naka nahi_nahi नहीं नही नको नाही मत',
}

export const NUMBER_WORDS: Record<string, number> = {}
const NUMS: [number, string][] = [
  [1, 'one ek single एक'], [2, 'two do don दो दोन'], [3, 'three teen tin तीन'], [4, 'four char chaar चार'],
  [5, 'five paanch panch paach पांच पाँच पाच'], [6, 'six chhe chhah che saha छह छः सहा'], [7, 'seven saat सात'],
  [8, 'eight aath आठ'], [9, 'nine nau nav नौ नऊ'], [10, 'ten das daha दस दहा'], [12, 'twelve barah बारह बारा'],
  [15, 'fifteen pandrah पंद्रह पंधरा'], [20, 'twenty bees vees बीस वीस'], [25, 'pachees पच्चीस पंचवीस'],
  [30, 'thirty tees तीस'], [40, 'forty chaalis chalis चालीस चाळीस'], [50, 'fifty pachaas pachas pannas पचास पन्नास'],
]
for (const [n, words] of NUMS) for (const w of words.split(' ')) NUMBER_WORDS[w] = n

/** phrase (space-joined tokens) → concepts */
export const PHRASES = new Map<string, string[]>()
for (const [concept, forms] of Object.entries(L)) {
  for (const f of forms.split(' ')) {
    const key = f.replace(/_/g, ' ')
    PHRASES.set(key, [...(PHRASES.get(key) ?? []), concept])
  }
}
export const MAX_PHRASE = 3

/** Function words we tolerate without flagging the utterance as poorly understood. */
export const STOPWORDS = new Set(
  ('a an the of to in on at with and or for from by is are be please now then also just ab abhi ko ka ki ke se mein me mai main par pe hai hain kar karo kare karna kariye kardo kar_do de do dena diya hua hui ' +
   'beautiful sundar nice big small indian luxury luxurious aalishan alishan shaandar shandar modern premium आलीशान शानदार आलिशान bharatiya ek_aur aur ani aani ने को का की के से में पर है हैं करो कर करें करा करना दो दे दीजिए और आणि अब एक_और ला ची चा चे च्या मध्ये madhe beech bich बीच wala wali wale वाला वाली वाले jagah जगह jaga place one ' +
   'which let lets make_it let\'s get give ok okay hey bhai yaar its it\'s there here yahan wahan यहाँ वहाँ called named some much more le jao jao chalo ले जाओ जा चलो banaye ka_ek wali').split(' '),
)
