/**
 * Hand-crafted related-content i18n for MDGCSUNRISE (FAQ / choices / options / courses)
 * node scripts/apply-mdgc-related-i18n.mjs
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const L = ['ja', 'zh-CN', 'zh-TW', 'es', 'fr', 'de']

/** FAQ id → { question, answer } per locale */
const FAQS = {
  '1ca2ce30-09fe-4a9d-99a9-9629eaa06423': {
    question: {
      ja: 'ガイドは写真撮影を手伝ってくれますか？',
      'zh-CN': '导游会帮忙拍照吗？',
      'zh-TW': '導遊會幫忙拍照嗎？',
      es: '¿El guía ayuda a tomar fotos durante el tour?',
      fr: 'Le guide aide-t-il à prendre des photos pendant le circuit ?',
      de: 'Hilft der Guide beim Fotografieren während der Tour?',
    },
    answer: {
      ja: 'はい。ガイドはツアー中の大切な思い出を残せるよう、写真撮影を喜んでお手伝いします。各スポットのベストフォトポイントをご案内し、広角モードやポートレートモードなどスマートフォン撮影のコツもお伝えします。',
      'zh-CN': '会的。导游很乐意在行程中帮您留下美好回忆，推荐最佳拍照点，并提供广角、人像模式等手机拍摄小技巧，帮您拍出更棒的照片。',
      'zh-TW': '會的。導遊很樂意在行程中幫您留下美好回憶，推薦最佳拍照點，並提供廣角、人像模式等手機拍攝小技巧，幫您拍出更棒的照片。',
      es: 'Sí. Nuestros guías estarán encantados de ayudarle a capturar fotos memorables durante el tour. Pueden recomendar los mejores puntos fotográficos y dar consejos para usar el modo gran angular y el modo retrato.',
      fr: 'Oui. Nos guides sont heureux de vous aider à immortaliser le voyage. Ils indiquent les meilleurs spots photo et donnent des conseils pour le mode grand-angle et le mode portrait.',
      de: 'Ja. Unsere Guides helfen Ihnen gerne, schöne Erinnerungsfotos zu machen. Sie empfehlen die besten Fotospots und geben Tipps zu Weitwinkel- und Porträtmodus.',
    },
  },
  '10bc5161-c51a-4297-a2b5-90b1f2097ad4': {
    question: {
      ja: 'ツアー中に携帯電話やWi-Fiは使えますか？',
      'zh-CN': '行程中有手机信号或 Wi-Fi 吗？',
      'zh-TW': '行程中有手機訊號或 Wi-Fi 嗎？',
      es: '¿Habrá cobertura móvil o Wi-Fi durante el tour?',
      fr: 'Aurai-je du réseau mobile ou du Wi-Fi pendant le circuit ?',
      de: 'Habe ich während der Tour Mobilfunk oder WLAN?',
    },
    answer: {
      ja: '国立公園や砂漠エリアでは電波が弱い・圏外の区間が多くあります。緊急連絡が必要な場合は、電波が安定するエリアに到着した際にガイドがサポートします。',
      'zh-CN': '国家公园和沙漠地区经常信号较弱或无信号。如需紧急联络，导游会在到达信号稳定区域时协助您。',
      'zh-TW': '國家公園與沙漠地區經常訊號較弱或無訊號。如需緊急聯絡，導遊會在到達訊號穩定區域時協助您。',
      es: 'La cobertura móvil suele ser limitada o nula en parques nacionales y zonas desérticas. Si necesita una llamada o mensaje urgente, su guía le ayudará al llegar a una zona con señal estable.',
      fr: 'Le réseau est souvent limité ou indisponible dans les parcs nationaux et les zones désertiques. En cas d’urgence, votre guide vous aidera dès qu’une zone avec un signal fiable sera atteinte.',
      de: 'In Nationalparks und Wüstengebieten ist der Empfang oft schwach oder nicht vorhanden. Bei Notfällen hilft Ihnen Ihr Guide, sobald eine Zone mit stabilem Empfang erreicht ist.',
    },
  },
  '25116088-3ce6-46ab-88ea-9e35f7653317': {
    question: {
      ja: 'フライトが遅延した場合はどうなりますか？',
      'zh-CN': '航班延误怎么办？',
      'zh-TW': '航班延誤怎麼辦？',
      es: '¿Qué ocurre si mi vuelo se retrasa?',
      fr: 'Que se passe-t-il si mon vol est retardé ?',
      de: 'Was passiert, wenn mein Flug verspätet ist?',
    },
    answer: {
      ja: 'ご予約時にご入力いただいたフライト情報をもとに運航状況を確認します。遅延の場合は、可能な範囲でピックアップ時間を調整します。',
      'zh-CN': '我们会根据您预订时填写的航班信息实时关注航班动态。如有延误，会在可行范围内调整接送时间。',
      'zh-TW': '我們會根據您預訂時填寫的航班資訊即時關注航班動態。如有延誤，會在可行範圍內調整接送時間。',
      es: 'Supervisamos su vuelo en tiempo real con la información facilitada al reservar. Si hay retraso, ajustaremos la hora de recogida siempre que sea posible.',
      fr: 'Nous suivons votre vol en temps réel grâce aux informations fournies à la réservation. En cas de retard, nous ajustons l’heure de prise en charge dans la mesure du possible.',
      de: 'Wir überwachen Ihren Flug in Echtzeit anhand der bei der Buchung angegebenen Flugdaten. Bei Verspätung passen wir die Abholzeit nach Möglichkeit an.',
    },
  },
  '96fa2113-c751-4d06-ad35-659c03bdd5ba': {
    question: {
      ja: 'ツアー出発に必要な最少催行人数は何名ですか？',
      'zh-CN': '成团最少人数是多少？',
      'zh-TW': '成團最少人數是多少？',
      es: '¿Cuál es el mínimo de participantes para que salga el tour?',
      fr: 'Quel est le nombre minimum de participants pour que le circuit parte ?',
      de: 'Wie viele Teilnehmer sind mindestens für die Tour erforderlich?',
    },
    answer: {
      ja: '本ツアーは最少4名以上で出発するプレミアム少人数グループツアーです。出発72時間前まで追加参加者を募集し、人数が満たない場合は別日程や代替ツアーをご案内する場合があります。運営判断により最少人数未満でも催行することがあります。',
      'zh-CN': '本行程为最少 4 人成团的精品小团游。出发前 72 小时内持续招募同行客人；若未达人数，可能安排改期或替代行程。运营商也可视情况在未满员时照常出发。',
      'zh-TW': '本行程為最少 4 人成團的精品小團旅遊。出發前 72 小時內持續招募同行旅客；若未達人數，可能安排改期或替代行程。營運方可視情況在未滿員時照常出發。',
      es: 'Es un tour premium en grupo reducido que sale con un mínimo de 4 participantes. Seguimos reclutando hasta 72 horas antes de la salida. Si no se alcanza el mínimo, podemos ofrecer otra fecha o un tour alternativo. El operador también puede confirmar la salida con un grupo menor.',
      fr: 'Il s’agit d’un circuit premium en petit groupe au départ à partir de 4 participants. Nous recrutons jusqu’à 72 h avant le départ. Si le minimum n’est pas atteint, une autre date ou un circuit de remplacement peut être proposé. L’opérateur peut aussi confirmer le départ avec un groupe plus réduit.',
      de: 'Dies ist eine Premium-Kleingruppentour ab mindestens 4 Teilnehmern. Bis 72 Stunden vor Abfahrt werben wir weiter Teilnehmer. Wird die Mindestzahl nicht erreicht, können wir ein anderes Datum oder eine Alternativtour anbieten. Der Veranstalter kann die Tour auch mit einer kleineren Gruppe durchführen.',
    },
  },
  'c9c02546-69ee-40b8-a904-b69809e13312': {
    question: {
      ja: '最少催行人数の募集はいつまでですか？',
      'zh-CN': '最少成团人数招募截止到什么时候？',
      'zh-TW': '最少成團人數招募截止到什麼時候？',
      es: '¿Hasta cuándo se recluta para alcanzar el mínimo de grupo?',
      fr: 'Jusqu’à quand recrutez-vous pour atteindre la taille minimale du groupe ?',
      de: 'Bis wann wird für die Mindestteilnehmerzahl geworben?',
    },
    answer: {
      ja: '出発72時間前まで追加参加者を募集します。その時点で最少催行可否を最終確認し、ピックアップ時間・担当ガイド・車両情報を含む最終案内をお送りします。',
      'zh-CN': '出发前 72 小时内持续招募。届时最终确认是否成团，并发送包含接送时间、导游与车辆信息的最终通知。',
      'zh-TW': '出發前 72 小時內持續招募。屆時最終確認是否成團，並發送包含接送時間、導遊與車輛資訊的最終通知。',
      es: 'Seguimos reclutando participantes hasta 72 horas antes de la salida. Entonces le enviaremos la confirmación con hora de recogida, guía y vehículo.',
      fr: 'Nous recrutons jusqu’à 72 h avant le départ. Nous vous enverrons alors la confirmation avec l’heure de prise en charge, le guide et le véhicule.',
      de: 'Wir werben bis 72 Stunden vor Abfahrt weiter Teilnehmer. Danach senden wir die Bestätigung mit Abholzeit, Guide und Fahrzeuginformationen.',
    },
  },
  '1a0a891a-d71a-47a7-8d71-4b8e06066229': {
    question: {
      ja: 'ピックアップと降車はどこですか？',
      'zh-CN': '在哪里接送？',
      'zh-TW': '在哪裡接送？',
      es: '¿Dónde son la recogida y la bajada?',
      fr: 'Où ont lieu la prise en charge et la dépose ?',
      de: 'Wo sind Abholung und Rückfahrt?',
    },
    answer: {
      ja: 'ラスベガスの指定主要ホテルでピックアップ・降車が可能です。出発確定後、ご宿泊ホテルに合わせたピックアップ場所と時間を最終案内します。一部ホテルは館内指定場所での乗車となります。',
      'zh-CN': '可在拉斯维加斯指定主要酒店接送。行程确认后，我们会发送与您酒店对应的接送点与时间。部分酒店需在馆内指定上车点登车。',
      'zh-TW': '可在拉斯維加斯指定主要飯店接送。行程確認後，我們會發送與您飯店對應的接送點與時間。部分飯店需在館內指定上車點登車。',
      es: 'La recogida y la bajada están disponibles en hoteles principales seleccionados de Las Vegas. Tras confirmar el tour, le enviaremos el hotel, el punto de recogida designado y la hora.',
      fr: 'Prise en charge et dépose sont disponibles dans certains grands hôtels de Las Vegas. Une fois le circuit confirmé, nous indiquons votre hôtel, le point de rendez-vous et l’heure.',
      de: 'Abholung und Rückfahrt sind an ausgewählten großen Hotels in Las Vegas möglich. Nach Tourbestätigung erhalten Sie Hotel, Abholpunkt und Uhrzeit.',
    },
  },
  '06bf00c1-fda8-4144-9139-4929ed4a915b': {
    question: {
      ja: 'プライベート（貸切）ツアーも可能ですか？',
      'zh-CN': '可以包车／私人团吗？',
      'zh-TW': '可以包車／私人團嗎？',
      es: '¿Hay tours privados disponibles?',
      fr: 'Les circuits privés sont-ils disponibles ?',
      de: 'Sind Privattouren möglich?',
    },
    answer: {
      ja: 'はい。専用車両でのプライベートツアーをご利用いただけます。ご希望の日程・訪問地・滞在時間に合わせたカスタム行程が可能です。料金は日程と人数に応じたお見積りとなります。',
      'zh-CN': '可以。我们提供专车私人团，可按您希望的日程、景点与停留时间定制。费用按行程与人数单独报价。',
      'zh-TW': '可以。我們提供專車私人團，可依您希望的日程、景點與停留時間客製。費用依行程與人數另行報價。',
      es: 'Sí. Ofrecemos tours privados con vehículo dedicado, itinerario a medida y paradas personalizadas. **Presupuesto a medida bajo petición.**',
      fr: 'Oui. Nous proposons des circuits privés avec véhicule dédié, itinéraire sur mesure et arrêts personnalisés. **Tarif sur devis.**',
      de: 'Ja. Wir bieten Privattouren mit eigenem Fahrzeug, individuellem Ablauf und gewünschten Stopps. **Preis auf Anfrage.**',
    },
  },
  '3e1471cd-3873-4128-b6c4-f8a940d8cf77': {
    question: {
      ja: '朝昼晩の食事は含まれますか？',
      'zh-CN': '含早午晚餐吗？',
      'zh-TW': '含早午晚餐嗎？',
      es: '¿Incluye desayuno, almuerzo y cena?',
      fr: 'Le petit-déjeuner, le déjeuner et le dîner sont-ils inclus ?',
      de: 'Sind Frühstück, Mittag- und Abendessen inklusive?',
    },
    answer: {
      ja: '基本的に食事は含まれず、各自負担です。ご希望のメニューを自由に選べます。追加オプションでプルコギ・チキン・サーモンなどの事前注文弁当もご利用いただけます。',
      'zh-CN': '餐食一般不含，需自理，可自由选择用餐。如需加购，也可预订烤肉、鸡肉、三文鱼等便当。',
      'zh-TW': '餐食一般不含，需自理，可自由選擇用餐。如需加購，也可預訂烤肉、雞肉、鮭魚等便當。',
      es: 'Las comidas **no suelen estar incluidas** y corren por cuenta del viajero, para que elija libremente. Hay **bentos bajo pedido** (bulgogi, pollo o salmón) con cargo adicional.',
      fr: 'Les repas ne sont **généralement pas inclus** et sont à votre charge, afin de choisir librement. Des **bentos à précommander** (bulgogi, poulet ou saumon) sont disponibles en supplément.',
      de: 'Mahlzeiten sind in der Regel **nicht inklusive** und selbst zu zahlen. Optional gibt es **Vorbestell-Bentoboxen** (Bulgogi, Hähnchen oder Lachs) gegen Aufpreis.',
    },
  },
  'bea53ca1-deb1-4e1c-a885-97b1d6615914': {
    question: {
      ja: '主な訪問スポットはどこですか？',
      'zh-CN': '主要参观哪些景点？',
      'zh-TW': '主要參觀哪些景點？',
      es: '¿Cuáles son las principales atracciones del tour?',
      fr: 'Quelles sont les principales attractions du circuit ?',
      de: 'Welche Hauptattraktionen umfasst die Tour?',
    },
    answer: {
      ja: '行程により異なりますが、代表的にはグランドキャニオン・サウスリム、イーストリム、アンテロープキャニオン、ホースシューベンド、ザイオン国立公園、ブライスキャニオン国立公園などが含まれます。詳細は各商品の行程表をご確認ください。',
      'zh-CN': '视行程而定，常见亮点包括大峡谷南缘、东缘、羚羊峡谷、马蹄湾、锡安国家公园与布莱斯峡谷国家公园等。请查看对应产品的详细行程。',
      'zh-TW': '視行程而定，常見亮點包括大峽谷南緣、東緣、羚羊峽谷、馬蹄灣、錫安國家公園與布萊斯峽谷國家公園等。請查看對應產品的詳細行程。',
      es: 'Los highlights varían según el itinerario y pueden incluir el **South Rim** y **East Rim del Gran Cañón**, **Antelope Canyon**, **Horseshoe Bend**, **Zion** y **Bryce Canyon**. Consulte el itinerario detallado de su tour.',
      fr: 'Les temps forts varient selon l’itinéraire et peuvent inclure le **South Rim** et **East Rim du Grand Canyon**, **Antelope Canyon**, **Horseshoe Bend**, **Zion** et **Bryce Canyon**. Voir l’itinéraire détaillé.',
      de: 'Die Highlights variieren je nach Programm und können **Grand Canyon South Rim**, **East Rim**, **Antelope Canyon**, **Horseshoe Bend**, **Zion** und **Bryce Canyon** umfassen. Bitte prüfen Sie die detaillierte Route.',
    },
  },
  '47f68f32-b21a-4a33-a470-86bc9c3f0e06': {
    question: {
      ja: 'オプションツアーや追加アクティビティはありますか？',
      'zh-CN': '有可选加购活动吗？',
      'zh-TW': '有可選加購活動嗎？',
      es: '¿Hay actividades opcionales o tours adicionales?',
      fr: 'Y a-t-il des activités optionnelles ou des add-ons ?',
      de: 'Gibt es optionale Aktivitäten oder Zusatzangebote?',
    },
    answer: {
      ja: 'はい。行程によりヘリコプターや小型飛行機などのオプションがある場合があります。空席・天候・運航状況によります。',
      'zh-CN': '有的。视行程而定，可能提供直升机或轻型飞机等加购项目，具体取决于名额、天气与运营安排。',
      'zh-TW': '有的。視行程而定，可能提供直升機或輕航機等加購項目，具體取決於名額、天氣與營運安排。',
      es: 'Sí. Según el itinerario, puede haber **tours opcionales en helicóptero o avioneta**. Disponibilidad sujeta a plazas, clima y operación.',
      fr: 'Oui. Selon l’itinéraire, des **vols optionnels en hélicoptère ou avion** peuvent être proposés, sous réserve de disponibilité, météo et exploitation.',
      de: 'Ja. Je nach Programm können **optionale Hubschrauber- oder Flugzeugtours** verfügbar sein – abhängig von Verfügbarkeit, Wetter und Betrieb.',
    },
  },
  'e90a00bc-af51-4186-9fda-914d5d119ba1': {
    question: {
      ja: '車両とツアーの安全はどのように管理していますか？',
      'zh-CN': '车辆与行程安全如何保障？',
      'zh-TW': '車輛與行程安全如何保障？',
      es: '¿Cómo garantizan la seguridad del vehículo y del tour?',
      fr: 'Comment assurez-vous la sécurité des véhicules et du circuit ?',
      de: 'Wie stellen Sie Fahrzeugsicherheit und sicheren Tourbetrieb sicher?',
    },
    answer: {
      ja: 'すべてのツアーはDOT・MC・CUAなど関連規定に準拠した商業登録車両で運行します。経験豊富な専門ガイド／ドライバーが同行し、安全で快適な旅をサポートします。',
      'zh-CN': '所有行程均使用符合 DOT、MC、CUA 等相关规定的商业注册车辆运营，并由经验丰富的专业导游／司机带队，保障安全舒适。',
      'zh-TW': '所有行程均使用符合 DOT、MC、CUA 等相關規定的商業登記車輛營運，並由經驗豐富的專業導遊／司機帶隊，保障安全舒適。',
      es: 'Todos los tours operan con **vehículos comerciales con licencia** conforme a **DOT, MC y CUA**. Guías profesionales experimentados garantizan un viaje seguro y fiable.',
      fr: 'Tous les circuits utilisent des **véhicules commerciaux agréés** conformes aux exigences **DOT, MC et CUA**, avec des **guides professionnels expérimentés**.',
      de: 'Alle Touren fahren mit **lizenzierten Gewerbefahrzeugen** gemäß **DOT, MC und CUA**. Erfahrene Profi-Guides sorgen für eine sichere Reise.',
    },
  },
  '9aa9562c-6ff4-459e-9f80-086059736882': {
    question: {
      ja: '旅行保険に加入すべきですか？',
      'zh-CN': '需要买旅行保险吗？',
      'zh-TW': '需要買旅行保險嗎？',
      es: '¿Necesito un seguro de viaje?',
      fr: 'Ai-je besoin d’une assurance voyage ?',
      de: 'Brauche ich eine Reiseversicherung?',
    },
    answer: {
      ja: '必須ではありませんが、強くおすすめします。米国は医療費が高いため、万一の事故・病気・行程変更に備えて出発前のご加入をお願いします。',
      'zh-CN': '非强制，但强烈建议购买。美国医疗费用很高，请在出发前自行投保，以应对意外、疾病或行程变更。',
      'zh-TW': '非強制，但強烈建議購買。美國醫療費用很高，請在出發前自行投保，以應對意外、疾病或行程變更。',
      es: 'No es obligatorio, pero **sí muy recomendable** por el alto coste médico en EE. UU. Cada viajero debe contratar su propio seguro antes de salir.',
      fr: 'Ce n’est pas obligatoire, mais **fortement recommandé** en raison du coût élevé des soins aux États-Unis. Souscrivez votre assurance avant le départ.',
      de: 'Nicht Pflicht, aber **dringend empfohlen** wegen hoher medizinischer Kosten in den USA. Bitte schließen Sie vor Abreise selbst eine Versicherung ab.',
    },
  },
  '1dec8a23-eec0-4caa-9c62-4464236a6f46': {
    question: {
      ja: '荷物はどのくらい持てますか？',
      'zh-CN': '可以带多少行李？',
      'zh-TW': '可以帶多少行李？',
      es: '¿Cuánto equipaje puedo llevar?',
      fr: 'Combien de bagages puis-je emporter ?',
      de: 'Wie viel Gepäck darf ich mitnehmen?',
    },
    answer: {
      ja: 'お一人さま機内持込サイズのキャリー1つとバックパック1つを推奨します（車両積載量による）。大型荷物は事前にご連絡ください。アンテロープキャニオンでは荷物サイズ制限があり、車に置いて歩く場合があります。',
      'zh-CN': '建议每人携带 1 件登机箱与 1 个背包（视车辆空间而定）。大件行李请提前联系。羚羊峡谷可能限制包袋大小，或需将行李留在车上。',
      'zh-TW': '建議每人攜帶 1 件登機箱與 1 個背包（視車輛空間而定）。大件行李請提前聯繫。羚羊峽谷可能限制包袋大小，或需將行李留在車上。',
      es: 'Recomendamos **una maleta de cabina y una mochila por persona**, según el espacio del vehículo. Avísenos si trae equipaje grande. En Antelope Canyon puede haber límites de tamaño de bolso.',
      fr: 'Nous recommandons **une valise cabine et un sac à dos par personne**, selon l’espace véhicule. Prévenez-nous pour les grands bagages. À Antelope Canyon, la taille des sacs peut être limitée.',
      de: 'Empfohlen: **ein Handgepäckkoffer und ein Rucksack pro Person**, je nach Stauraum. Großes Gepäck bitte vorab melden. Im Antelope Canyon kann die Taschengröße begrenzt sein.',
    },
  },
  'b5b12001-a034-49d7-81f9-aba81ccbb692': {
    question: {
      ja: 'ツアーに何を持参すればよいですか？',
      'zh-CN': '行程需要准备什么？',
      'zh-TW': '行程需要準備什麼？',
      es: '¿Qué debo llevar al tour?',
      fr: 'Que dois-je apporter pour le circuit ?',
      de: 'Was sollte ich für die Tour mitbringen?',
    },
    answer: {
      ja: '現金、パスポートまたは公的身分証明書、動きやすい服装、スニーカー／ハイキングシューズ、帽子、サングラス、日焼け止め、常備薬、モバイルバッテリー、防風ジャケット、水筒などをおすすめします。寒い季節は防寒着、暑い季節は通気性の良い服装を。',
      'zh-CN': '建议携带现金、护照或政府证件、舒适衣物、运动鞋／徒步鞋、帽子、墨镜、防晒、常用药、充电宝、防风外套与可重复使用水瓶。冬季备保暖衣物，夏季备透气轻便衣物。',
      'zh-TW': '建議攜帶現金、護照或政府證件、舒適衣物、運動鞋／健行鞋、帽子、墨鏡、防曬、常用藥、行動電源、防風外套與可重複使用水瓶。冬季備保暖衣物，夏季備透氣輕便衣物。',
      es: 'Recomendamos **efectivo, pasaporte o ID oficial, ropa cómoda, calzado de marcha, gorra, gafas de sol, protector solar, medicación personal, power bank, chaqueta cortavientos y botella reutilizable**. En invierno, ropa abrigada; en verano, ropa ligera y transpirable.',
      fr: 'Prévoyez **espèces, passeport ou pièce d’identité, vêtements confortables, chaussures de marche, chapeau, lunettes de soleil, crème solaire, médicaments, batterie externe, veste coupe-vent et gourde**. Hiver : vêtements chauds ; été : tenues légères et respirantes.',
      de: 'Empfohlen: **Bargeld, Reisepass/Ausweis, bequeme Kleidung, Wanderschuhe, Hut, Sonnenbrille, Sonnencreme, Medikamente, Powerbank, winddichte Jacke und wiederverwendbare Flasche**. Im Winter warm, im Sommer leicht und atmungsaktiv.',
    },
  },
  '7be3c924-fe8f-4125-affb-bbe3f9b5cf5a': {
    question: {
      ja: 'ドローンや三脚は使えますか？',
      'zh-CN': '可以使用无人机或三脚架吗？',
      'zh-TW': '可以使用無人機或三腳架嗎？',
      es: '¿Puedo usar un dron o un trípode durante el tour?',
      fr: 'Puis-je utiliser un drone ou un trépied pendant le circuit ?',
      de: 'Darf ich Drohne oder Stativ während der Tour nutzen?',
    },
    answer: {
      ja: 'ほとんどの国立公園・保護区ではドローンは禁止です。三脚は一般的に使用可能ですが、現地規則や混雑・行程により制限される場合があります。ガイドの指示に従ってください。',
      'zh-CN': '多数国家公园与保护区禁止使用无人机。三脚架一般可用，但可能受当地规定、人流或行程限制。请听从导游指引。',
      'zh-TW': '多數國家公園與保護區禁止使用無人機。三腳架一般可用，但可能受當地規定、人流或行程限制。請聽從導遊指引。',
      es: '**El uso de drones está prohibido** en la mayoría de parques y áreas protegidas. Los trípodes suelen permitirse, pero pueden restringirse según normas y recorrido. Siga las indicaciones del guía.',
      fr: '**Les drones sont interdits** dans la plupart des parcs et zones protégées. Les trépieds sont généralement autorisés, mais peuvent être limités selon les règles et le parcours. Suivez les consignes du guide.',
      de: '**Drohnen sind in den meisten Parks und Schutzgebieten verboten.** Stative sind meist erlaubt, können aber je nach Regeln und Route eingeschränkt sein. Bitte den Anweisungen des Guides folgen.',
    },
  },
  '76bfc55f-dfae-4d75-abd3-817b5bf4cb20': {
    question: {
      ja: 'ツアーが遅延した場合はどうなりますか？',
      'zh-CN': '行程延误怎么办？',
      'zh-TW': '行程延誤怎麼辦？',
      es: '¿Qué ocurre si el tour se retrasa?',
      fr: 'Que se passe-t-il si le circuit est retardé ?',
      de: 'Was passiert bei Tourverzögerungen?',
    },
    answer: {
      ja: '道路規制・事故・渋滞・悪天候など当社の制御外の事由で遅延することがあります。安全を最優先し、ガイドが現場判断で行程や訪問順を調整する場合があります。ご理解をお願いします。',
      'zh-CN': '道路管制、事故、严重拥堵或恶劣天气等不可控因素可能导致延误。我们以安全为先，导游可能根据现场情况调整行程或参观顺序，敬请理解。',
      'zh-TW': '道路管制、事故、嚴重壅塞或惡劣天氣等不可控因素可能導致延誤。我們以安全為先，導遊可能依現場情況調整行程或參觀順序，敬請理解。',
      es: 'Puede haber retrasos por causas ajenas (cierres, accidentes, mal tiempo). Si es necesario, el guía ajustará el itinerario para operar con seguridad y la mayor fluidez posible.',
      fr: 'Des retards peuvent survenir pour des raisons indépendantes de notre volonté (fermetures, accidents, météo). Le guide peut ajuster l’itinéraire pour garantir sécurité et bon déroulement.',
      de: 'Verzögerungen können durch Umstände außerhalb unserer Kontrolle entstehen (Straßensperren, Unfälle, Wetter). Der Guide kann die Route anpassen, um Sicherheit und möglichst reibungslosen Ablauf zu gewährleisten.',
    },
  },
  'ffc2dc5a-8410-4723-b152-f75f7b1debbb': {
    question: {
      ja: '天候や公園都合で行程が変わった場合、返金はありますか？',
      'zh-CN': '因天气或公园原因改行程可以退款吗？',
      'zh-TW': '因天氣或公園原因改行程可以退款嗎？',
      es: '¿Hay reembolso si el itinerario cambia por clima o condiciones del parque?',
      fr: 'Serai-je remboursé si l’itinéraire change pour cause de météo ou de parc ?',
      de: 'Erhalte ich eine Erstattung, wenn sich die Route wegen Wetter oder Parkbedingungen ändert?',
    },
    answer: {
      ja: '安全と公園規則遵守を最優先します。天候や公園都合で入場不可の場合、同等の代替スポットへ変更することがあります（例：アンテロープ不可時はザイオン／ブライス等）。入場料差額と追加運航費を考慮し、返金または追加料金を合理的に適用する場合があります。',
      'zh-CN': '我们以安全与遵守公园规定为先。若因天气或公园原因无法进入某景点，可能改为同等价值的替代景点（例如羚羊峡谷不可入时改往锡安／布莱斯等）。将综合门票差额与额外运营成本，合理办理退款或补差。',
      'zh-TW': '我們以安全與遵守公園規定為先。若因天氣或公園原因無法進入某景點，可能改為同等價值的替代景點（例如羚羊峽谷不可入時改往錫安／布萊斯等）。將綜合門票差額與額外營運成本，合理辦理退款或補差。',
      es: 'La seguridad y las normas del parque son prioritarias. Si un destino cierra por clima o condiciones, el itinerario puede ajustarse a una atracción alternativa comparable. Cualquier ajuste de tarifa se calculará de forma razonable (diferencia de entradas y costes operativos extra).',
      fr: 'Sécurité et règles des parcs sont prioritaires. En cas de fermeture pour météo ou conditions, l’itinéraire peut être ajusté vers une attraction de valeur comparable. Tout ajustement tarifaire sera déterminé raisonnablement (différence d’entrées et coûts d’exploitation supplémentaires).',
      de: 'Sicherheit und Parkregeln haben Vorrang. Bei Schließungen wegen Wetter oder Parkbedingungen kann die Route auf eine vergleichbare Alternative umgestellt werden. Tarifanpassungen erfolgen angemessen unter Berücksichtigung von Eintrittsdifferenzen und Mehrkosten.',
    },
  },
  '082f6b27-6146-4de8-81cd-035c0cf98aa7': {
    question: {
      ja: '乳幼児や子どもも参加できますか？',
      'zh-CN': '婴幼儿和儿童可以参加吗？',
      'zh-TW': '嬰幼兒和兒童可以參加嗎？',
      es: '¿Pueden unirse bebés y niños?',
      fr: 'Les nourrissons et enfants peuvent-ils participer ?',
      de: 'Können Kleinkinder und Kinder mitfahren?',
    },
    answer: {
      ja: '多くのツアーは参加可能ですが、年齢制限がある場合があります（例：一部キャニオンは8歳以上）。チャイルドシート／ブースターが必要な場合は事前申請が必要で、追加料金がかかります。',
      'zh-CN': '多数行程可带儿童，但部分有年龄限制（例如某些峡谷需满 8 岁）。如需儿童安全座椅／增高垫，请提前申请，可能产生额外费用。',
      'zh-TW': '多數行程可帶兒童，但部分有年齡限制（例如某些峽谷需滿 8 歲）。如需兒童安全座椅／增高墊，請提前申請，可能產生額外費用。',
      es: 'Algunos tours tienen límite de edad (p. ej., ciertos cañones requieren **8 años o más**). Si necesita **silla infantil o booster**, solicítelo con antelación. **Hay cargo adicional.**',
      fr: 'Certains circuits ont une limite d’âge (ex. : certains canyons à partir de **8 ans**). Pour un **siège enfant ou rehausseur**, demandez à l’avance. **Supplément applicable.**',
      de: 'Einige Touren haben Altersgrenzen (z. B. bestimmte Canyons ab **8 Jahren**). Kinder- oder Sitzerhöhung bitte vorab anfordern. **Zusatzkosten möglich.**',
    },
  },
  '22d5596e-f5df-4a64-8b46-8ba43c0d2149': {
    question: {
      ja: '最少催行人数が集まらない場合はどうなりますか？',
      'zh-CN': '人数不够成团怎么办？',
      'zh-TW': '人數不夠成團怎麼辦？',
      es: '¿Qué ocurre si no se alcanza el mínimo de participantes?',
      fr: 'Que se passe-t-il si le minimum de participants n’est pas atteint ?',
      de: 'Was passiert, wenn die Mindestteilnehmerzahl nicht erreicht wird?',
    },
    answer: {
      ja: '出発72時間前までに最少人数未達の場合、別日程への変更・類似ツアーへの振替・キャンセル全額返金などをご提案します。運営判断により少人数でも催行する場合があります。最終案内は出発72時間前です。',
      'zh-CN': '若出发前 72 小时仍未达人数，我们将提议改期、转至相似行程，或取消并全额退款。运营商也可决定照常出发。最终通知于出发前 72 小时发出。',
      'zh-TW': '若出發前 72 小時仍未達人數，我們將提議改期、轉至相似行程，或取消並全額退款。營運方亦可決定照常出發。最終通知於出發前 72 小時發出。',
      es: 'Si no se alcanza el mínimo, ofreceremos alternativas como **cambiar de fecha, transferir a otro tour o crédito de viaje**. A criterio del operador, el tour también puede confirmarse con un grupo menor.',
      fr: 'Si le minimum n’est pas atteint, nous proposons notamment **un report, un transfert vers un autre circuit ou un avoir**. L’opérateur peut aussi confirmer le départ avec un groupe plus réduit.',
      de: 'Wird die Mindestzahl nicht erreicht, bieten wir Alternativen wie **Umbuchung, Wechsel zu einer anderen Tour oder Reiseguthaben**. Der Veranstalter kann die Tour auch mit kleinerer Gruppe bestätigen.',
    },
  },
}

const CHOICES = {
  'a3fb2ee9-e915-4ae4-85d7-ba07969b5750': {
    name: {
      ja: '米国居住区分およびその他入場料',
      'zh-CN': '美国居住身份及其他门票',
      'zh-TW': '美國居住身分及其他門票',
      es: 'Residente / No residente y tarifa de entrada',
      fr: 'Résident / Non-résident et droits d’entrée',
      de: 'Resident / Non-Resident & Eintritt',
    },
    description: {
      ja: '国立公園入場料のご案内（2026年1月1日より適用）\n\n米国国立公園局（NPS）の方針により、居住区分に応じて追加入場料が適用される場合があります。\n\n米国居住者\n\n通常の国立公園入場料のみ。ツアー当日、政府発行の居住証明が必要です。\n\n非米国居住者（16歳以上）\n\n指定国立公園では通常入場料に加え、1人あたり追加$100が必要です。NPS追加料金が適用される公園のみ対象です。\n\n混合グループ\n\n居住者と非居住者が混在する場合、予約時に16歳以上の非居住者人数を正確に入力してください。\n\nお支払い\n\n追加NPS料金は予約時またはツアー前にオンラインでお支払い可能です。カード払いの場合、追加NPS金額に5%の決済手数料がかかります。',
      'zh-CN': '国家公园门票说明（自 2026 年 1 月 1 日起生效）\n\n根据美国国家公园管理局（NPS）政策，可能因居住身份收取额外门票。\n\n美国居民\n\n仅支付标准国家公园门票。行程当天需出示政府签发的居住证明。\n\n非美国居民（年满 16 岁）\n\n在指定国家公园需在标准门票之外另付每人 $100。仅适用于实施 NPS 附加费的公园。\n\n混合团队\n\n若同行含居民与非居民，请在预订时准确填写年满 16 岁非居民人数。\n\n支付\n\n额外 NPS 费用可在预订时或出发前在线支付。刷卡支付额外 NPS 费用时收取 5% 手续费。',
      'zh-TW': '國家公園門票說明（自 2026 年 1 月 1 日起生效）\n\n依美國國家公園管理局（NPS）政策，可能因居住身分收取額外門票。\n\n美國居民\n\n僅支付標準國家公園門票。行程當天需出示政府核發之居住證明。\n\n非美國居民（年滿 16 歲）\n\n在指定國家公園需於標準門票之外另付每人 $100。僅適用於實施 NPS 附加費的公園。\n\n混合團隊\n\n若同行含居民與非居民，請於預訂時正確填寫年滿 16 歲非居民人數。\n\n支付\n\n額外 NPS 費用可於預訂時或出發前線上支付。刷卡支付額外 NPS 費用時收取 5% 手續費。',
      es: 'Política de entrada a Parques Nacionales (vigente desde el 1 de enero de 2026)\n\nSegún la política del NPS de EE. UU., pueden aplicarse tarifas adicionales según su residencia.\n\nResidentes de EE. UU.\n\nSolo la tarifa estándar de parque nacional. El día del tour se requiere prueba oficial de residencia.\n\nNo residentes (16+)\n\nEn parques designados se requiere $100 adicionales por persona, además de la entrada estándar. Solo donde aplique el recargo NPS.\n\nGrupos mixtos\n\nSi hay residentes y no residentes, indique exactamente cuántos no residentes de 16+ hay al reservar.\n\nPago\n\nLa tarifa NPS adicional puede pagarse online al reservar o antes del tour. Con tarjeta se aplica un 5% de comisión sobre el importe NPS adicional.',
      fr: 'Politique d’entrée des parcs nationaux (à compter du 1er janvier 2026)\n\nSelon la politique du NPS américain, des frais supplémentaires peuvent s’appliquer selon le statut de résidence.\n\nRésidents américains\n\nUniquement le droit d’entrée standard. Une preuve officielle de résidence est requise le jour du circuit.\n\nNon-résidents (16 ans et +)\n\nDans les parcs désignés, 100 $ supplémentaires par personne s’ajoutent au droit standard. Uniquement là où le surcoût NPS s’applique.\n\nGroupes mixtes\n\nSi le groupe mélange résidents et non-résidents, indiquez précisément le nombre de non-résidents de 16 ans et + à la réservation.\n\nPaiement\n\nLes frais NPS supplémentaires peuvent être réglés en ligne à la réservation ou avant le départ. Un frais de carte de 5 % s’applique sur le montant NPS supplémentaire.',
      de: 'Eintrittspolitik Nationalparks (gültig ab 1. Januar 2026)\n\nGemäß NPS-Politik können je nach Wohnsitzstatus Zusatzgebühren anfallen.\n\nUS-Residenten\n\nNur der Standard-Parkeintritt. Am Tourtag ist ein behördlicher Wohnsitznachweis erforderlich.\n\nNicht-Residenten (16+)\n\nIn ausgewiesenen Parks zusätzlich $100 pro Person zum Standardeintritt. Nur wo der NPS-Zuschlag gilt.\n\nGemischte Gruppen\n\nBei gemischten Gruppen bitte bei der Buchung die genaue Zahl der Nicht-Residenten ab 16 angeben.\n\nZahlung\n\nDie zusätzliche NPS-Gebühr kann online bei Buchung oder vor der Tour gezahlt werden. Bei Kartenzahlung fällt 5 % Gebühr auf den zusätzlichen NPS-Betrag an.',
    },
  },
  '76612c23-31ff-4501-a1c9-b90c7224a7b9': {
    name: {
      ja: 'アンテロープキャニオンの選択',
      'zh-CN': '羚羊峡谷选择',
      'zh-TW': '羚羊峽谷選擇',
      es: 'Opciones de Antelope Canyon',
      fr: 'Choix Antelope Canyon',
      de: 'Antelope-Canyon-Auswahl',
    },
    description: {
      ja: 'Lower Antelope Canyon\n\nドラマチックな光の筋、狭い砂岩の壁、鮮やかな色彩で最も人気のアンテロープ。階段やはしごを何度も昇降します。Canyon Xより体力が必要で、混雑しやすいです。定番体験を求める方に最適。\n\n\nAntelope Canyon X\n\nより静かで空いている代替ルート。通路が広く階段も少なめ。美しい砂岩と写真映えのスポットが魅力。家族・シニア・歩きやすいコース希望の方に向いています。',
      'zh-CN': 'Lower Antelope Canyon（下羚羊峡谷）\n\n最受欢迎的羚羊峡谷，光线、窄缝与色彩极具戏剧性。需多次上下楼梯与梯子，比 Canyon X 更费体力，通常更拥挤。适合想体验经典羚羊峡谷的旅客。\n\n\nAntelope Canyon X\n\n更安静、人少的选择。通道更宽、楼梯更少，便于行走。砂岩与拍照点出色，适合家庭、长者或偏好轻松步行的旅客。',
      'zh-TW': 'Lower Antelope Canyon（下羚羊峽谷）\n\n最受歡迎的羚羊峽谷，光線、窄縫與色彩極具戲劇性。需多次上下樓梯與梯子，比 Canyon X 更費體力，通常更擁擠。適合想體驗經典羚羊峽谷的旅客。\n\n\nAntelope Canyon X\n\n更安靜、人少的選擇。通道更寬、樓梯更少，便於行走。砂岩與拍照點出色，適合家庭、長者或偏好輕鬆步行的旅客。',
      es: 'Lower Antelope Canyon\n\nEl más popular, con haces de luz, paredes estrechas y colores intensos. Requiere subir varias escaleras y escaleras de mano. Más exigente y habitualmente más concurrido que Canyon X. Ideal para la experiencia clásica.\n\n\nAntelope Canyon X\n\nAlternativa más tranquila y con menos gente. Pasillos más anchos y menos escaleras. Excelente para fotos y paseos más cómodos; ideal para familias, seniors y quien prefiera un recorrido más fácil.',
      fr: 'Lower Antelope Canyon\n\nLe plus populaire, avec faisceaux de lumière, parois étroites et couleurs vives. Plusieurs escaliers et échelles ; plus exigeant et souvent plus fréquenté que Canyon X. Idéal pour l’expérience classique.\n\n\nAntelope Canyon X\n\nAlternative plus calme et moins bondée. Couloirs plus larges, moins d’escaliers. Beau pour la photo et la marche ; adapté aux familles, seniors et parcours plus faciles.',
      de: 'Lower Antelope Canyon\n\nDer beliebteste Canyon mit Lichtstrahlen, engen Sandsteinwänden und intensiven Farben. Mehrere Treppen und Leitern; anstrengender und meist voller als Canyon X. Ideal für das klassische Erlebnis.\n\n\nAntelope Canyon X\n\nRuhigere, weniger überlaufene Alternative. Breitere Gänge, weniger Treppen. Schön für Fotos und entspanntes Gehen – gut für Familien, Senioren und leichtere Touren.',
    },
  },
}

const OPTIONS = {
  '010c5310-65e8-49da-adc1-8828fee489b5': {
    name: {
      ja: 'Lower Antelope Canyon',
      'zh-CN': '下羚羊峡谷（Lower）',
      'zh-TW': '下羚羊峽谷（Lower）',
      es: 'Lower Antelope Canyon',
      fr: 'Lower Antelope Canyon',
      de: 'Lower Antelope Canyon',
    },
    description: {
      ja: 'はしごを昇降しながら、S字にうねる狭いスロットキャニオンを歩くダイナミックなコース。写真映えスポットが多く、満足度はCanyon Xより高い傾向です。',
      'zh-CN': '沿狭窄的 S 形槽谷上下梯子前行，拍照点丰富、更具动感；满意度通常高于 Canyon X。',
      'zh-TW': '沿狹窄的 S 形槽谷上下梯子前行，拍照點豐富、更具動感；滿意度通常高於 Canyon X。',
      es: 'Cañón de ranura dinámico con escaleras y paredes en forma de S; muchos puntos fotográficos. La satisfacción suele ser mayor que en Antelope Canyon X.',
      fr: 'Canyon étroit dynamique avec échelles et parois en S ; de nombreux spots photo. Satisfaction souvent supérieure à Antelope Canyon X.',
      de: 'Dynamischer Slot Canyon mit Leitern und S-förmigen Wänden – viele Fotospots. Zufriedenheit oft höher als bei Antelope Canyon X.',
    },
  },
  '58c77309-2ac9-4490-9d0c-2b9c2b2b0971': {
    name: {
      ja: 'Antelope Canyon X',
      'zh-CN': '羚羊峡谷 X',
      'zh-TW': '羚羊峽谷 X',
      es: 'Antelope Canyon X',
      fr: 'Antelope Canyon X',
      de: 'Antelope Canyon X',
    },
    description: {
      ja: '通路が広く、X字のスカイライトが特徴。比較的空いており、ゆったり広角撮影に向いています。',
      'zh-CN': '通道较宽，以 X 形天窗著称；人相对较少，适合从容广角拍摄。',
      'zh-TW': '通道較寬，以 X 形天窗著稱；人相對較少，適合從容廣角拍攝。',
      es: 'Pasillos más amplios y tragaluces en forma de X; suele haber menos gente y es ideal para fotos gran angular con calma.',
      fr: 'Couloirs plus larges et puits de lumière en X ; souvent moins fréquenté, idéal pour la photo grand-angle en douceur.',
      de: 'Breitere Gänge und X-förmige Lichtschächte; meist weniger Andrang – ideal für ruhige Weitwinkel-Fotos.',
    },
  },
  '8cc89bd7-d4df-4366-ae64-bf5e546c4212': {
    name: {
      ja: '米国居住者',
      'zh-CN': '美国居民',
      'zh-TW': '美國居民',
      es: 'Residentes',
      fr: 'Résidents',
      de: 'Residenten',
    },
    description: {
      ja: '✅ グランドキャニオン入場料（$8）\n✅ ホースシューベンド入場料（$5）',
      'zh-CN': '✅ 大峡谷门票（$8）\n✅ 马蹄湾门票（$5）',
      'zh-TW': '✅ 大峽谷門票（$8）\n✅ 馬蹄灣門票（$5）',
      es: '✅ Entrada Gran Cañón ($8)\n✅ Entrada Horseshoe Bend ($5)',
      fr: '✅ Entrée Grand Canyon ($8)\n✅ Entrée Horseshoe Bend ($5)',
      de: '✅ Eintritt Grand Canyon ($8)\n✅ Eintritt Horseshoe Bend ($5)',
    },
  },
  '7cb03ab2-94f8-44a0-91e0-1a5163dc0881': {
    name: {
      ja: '非居住者',
      'zh-CN': '非居民',
      'zh-TW': '非居民',
      es: 'No residentes',
      fr: 'Non-résidents',
      de: 'Nicht-Residenten',
    },
    description: {
      ja: '✅ グランドキャニオン入場料（$8）\n✅ ホースシューベンド入場料（$5）\n\n📌 17歳以上の米国非居住者の人数のみ入力してください。',
      'zh-CN': '✅ 大峡谷门票（$8）\n✅ 马蹄湾门票（$5）\n\n📌 请只填写年满 17 岁的美国非居民人数。',
      'zh-TW': '✅ 大峽谷門票（$8）\n✅ 馬蹄灣門票（$5）\n\n📌 請只填寫年滿 17 歲的美國非居民人數。',
      es: '✅ Entrada Gran Cañón ($8)\n✅ Entrada Horseshoe Bend ($5)\n\n📌 Indique solo el número de no residentes de EE. UU. de 17 años o más.',
      fr: '✅ Entrée Grand Canyon ($8)\n✅ Entrée Horseshoe Bend ($5)\n\n📌 Indiquez uniquement le nombre de non-résidents américains de 17 ans ou plus.',
      de: '✅ Eintritt Grand Canyon ($8)\n✅ Eintritt Horseshoe Bend ($5)\n\n📌 Bitte nur die Anzahl der US-Nicht-Residenten ab 17 Jahren eingeben.',
    },
  },
  '89b9a873-1d74-4f4f-a6ca-6c6af68a6ec0': {
    name: {
      ja: '非居住者（パス所持）',
      'zh-CN': '非居民（已持有通行证）',
      'zh-TW': '非居民（已持有通行證）',
      es: 'No residente (con pase)',
      fr: 'Non-résident (avec pass)',
      de: 'Nicht-Resident (mit Pass)',
    },
    description: {
      ja: '✅ グランドキャニオン入場料（$8）\n✅ ホースシューベンド入場料（$5）\n\n📌 America the Beautiful Non-resident Pass（$250）をご持参いただくと非居住者追加料金が免除されます。ご自身で購入される場合はこのオプションを選択してください。\n\n📌 パス1枚で最大4名までカバー。持参枚数を入力してください。',
      'zh-CN': '✅ 大峡谷门票（$8）\n✅ 马蹄湾门票（$5）\n\n📌 需自备 America the Beautiful Non-resident Pass（$250）方可免除非居民附加费。若自行购买请选此项。\n\n📌 每张通行证最多覆盖 4 人，请填写持有张数。',
      'zh-TW': '✅ 大峽谷門票（$8）\n✅ 馬蹄灣門票（$5）\n\n📌 需自備 America the Beautiful Non-resident Pass（$250）方可免除非居民附加費。若自行購買請選此項。\n\n📌 每張通行證最多涵蓋 4 人，請填寫持有張數。',
      es: '✅ Entrada Gran Cañón ($8)\n✅ Entrada Horseshoe Bend ($5)\n\n📌 Debe comprar y traer el America the Beautiful Non-resident Pass ($250) para eximir la tarifa de no residente. Elija esta opción si lo compra usted.\n\n📌 Un pase cubre hasta 4 personas. Indique cuántos pases traerá.',
      fr: '✅ Entrée Grand Canyon ($8)\n✅ Entrée Horseshoe Bend ($5)\n\n📌 Apportez l’America the Beautiful Non-resident Pass ($250) pour exonérer les frais non-résident. Choisissez cette option si vous l’achetez vous-même.\n\n📌 Un pass couvre jusqu’à 4 personnes. Indiquez le nombre de pass.',
      de: '✅ Eintritt Grand Canyon ($8)\n✅ Eintritt Horseshoe Bend ($5)\n\n📌 Bringen Sie den America the Beautiful Non-resident Pass ($250) mit, um die Nicht-Residenten-Gebühr zu erlassen. Wählen Sie diese Option bei Eigenkauf.\n\n📌 Ein Pass gilt für bis zu 4 Personen. Bitte Anzahl der Pässe angeben.',
    },
  },
  '95666ed1-4c9f-432b-b851-04393acf543f': {
    name: {
      ja: '非居住者（16歳以下）',
      'zh-CN': '非居民（16 岁及以下）',
      'zh-TW': '非居民（16 歲及以下）',
      es: 'No residentes (menores de 16)',
      fr: 'Non-résidents (16 ans et moins)',
      de: 'Nicht-Residenten (bis 16 Jahre)',
    },
    description: {
      ja: '✅ グランドキャニオン入場料（$8）\n✅ ホースシューベンド入場料（$5）\n\n📌 16歳以下の米国非居住者の子ども／青少年の人数のみ入力してください。',
      'zh-CN': '✅ 大峡谷门票（$8）\n✅ 马蹄湾门票（$5）\n\n📌 请只填写 16 岁及以下美国非居民儿童／青少年人数。',
      'zh-TW': '✅ 大峽谷門票（$8）\n✅ 馬蹄灣門票（$5）\n\n📌 請只填寫 16 歲及以下美國非居民兒童／青少年人數。',
      es: '✅ Entrada Gran Cañón ($8)\n✅ Entrada Horseshoe Bend ($5)\n\n📌 Indique solo el número de niños/adolescentes no residentes de 16 años o menos.',
      fr: '✅ Entrée Grand Canyon ($8)\n✅ Entrée Horseshoe Bend ($5)\n\n📌 Indiquez uniquement le nombre d’enfants/ados non-résidents de 16 ans ou moins.',
      de: '✅ Eintritt Grand Canyon ($8)\n✅ Eintritt Horseshoe Bend ($5)\n\n📌 Bitte nur die Anzahl der Nicht-Residenten-Kinder/Jugendlichen bis 16 Jahre eingeben.',
    },
  },
  'd6a43b51-2fb1-4d2b-94a8-6ce8dd611f39': {
    name: {
      ja: '非居住者パスを購入',
      'zh-CN': '购买非居民通行证',
      'zh-TW': '購買非居民通行證',
      es: 'Comprar pase de no residente',
      fr: 'Acheter un pass non-résident',
      de: 'Non-Resident-Pass kaufen',
    },
    description: {
      ja: '✅ グランドキャニオン入場料（$8）\n✅ ホースシューベンド入場料（$5）\n\n📌 予約時に America the Beautiful Non-resident Pass（$250）を一緒にお支払いいただくと、当社が代理購入し当日お渡しします。\n\n📌 パス1枚で最大4名まで。購入枚数を入力してください。',
      'zh-CN': '✅ 大峡谷门票（$8）\n✅ 马蹄湾门票（$5）\n\n📌 若预订时一并支付 America the Beautiful Non-resident Pass（$250），我们将代为购买并于当日交付。\n\n📌 每张最多覆盖 4 人，请填写购买张数。',
      'zh-TW': '✅ 大峽谷門票（$8）\n✅ 馬蹄灣門票（$5）\n\n📌 若預訂時一併支付 America the Beautiful Non-resident Pass（$250），我們將代為購買並於當日交付。\n\n📌 每張最多涵蓋 4 人，請填寫購買張數。',
      es: '✅ Entrada Gran Cañón ($8)\n✅ Entrada Horseshoe Bend ($5)\n\n📌 Si compra el America the Beautiful Non-resident Pass ($250) al reservar, lo adquirimos por usted y se lo entregamos el día del tour.\n\n📌 Un pase cubre hasta 4 personas. Indique cuántos desea comprar.',
      fr: '✅ Entrée Grand Canyon ($8)\n✅ Entrée Horseshoe Bend ($5)\n\n📌 Si vous achetez l’America the Beautiful Non-resident Pass ($250) à la réservation, nous l’achetons pour vous et vous le remettons le jour du circuit.\n\n📌 Un pass couvre jusqu’à 4 personnes. Indiquez le nombre souhaité.',
      de: '✅ Eintritt Grand Canyon ($8)\n✅ Eintritt Horseshoe Bend ($5)\n\n📌 Wenn Sie den America the Beautiful Non-resident Pass ($250) bei der Buchung mitzahlen, kaufen wir ihn für Sie und übergeben ihn am Tourtag.\n\n📌 Ein Pass gilt für bis zu 4 Personen. Bitte gewünschte Anzahl angeben.',
    },
  },
}

const COURSES = {
  'e7e83d98-29e7-4fce-936f-9939876fbaff': {
    name: {
      ja: 'ホテルピックアップ',
      'zh-CN': '酒店接驾',
      'zh-TW': '飯店接送',
      es: 'Recogida en hotel',
      fr: 'Prise en charge à l’hôtel',
      de: 'Hotelabholung',
    },
  },
  '34baa5d7-e5b8-462e-9ba6-0f1618f963b0': {
    name: {
      ja: 'グランドビュー・ポイント',
      'zh-CN': '大观角（Grandview Point）',
      'zh-TW': '大觀角（Grandview Point）',
      es: 'Grandview Point',
      fr: 'Grandview Point',
      de: 'Grandview Point',
    },
    description: {
      ja: 'サウスリム屈指の広いパノラマと階段状の地層が見どころ。日の出・日没の撮影スポットであり、歴史あるグランドビュー・トレイルの起点でもあります。',
      'zh-CN': '南缘视野极开阔的观景点之一，层层岩层尽收眼底，是日出日落摄影与历史悠久 Grandview Trail 的起点。',
      'zh-TW': '南緣視野極開闊的觀景點之一，層層岩層盡收眼底，是日出日落攝影與歷史悠久 Grandview Trail 的起點。',
      es: 'Uno de los miradores más amplios del South Rim, con formaciones en capas y un favorito para amanecer, atardecer y fotografía.',
      fr: 'L’un des points de vue les plus vastes du South Rim, avec strates spectaculaires — idéal pour lever/coucher de soleil et photo.',
      de: 'Einer der weitläufigsten Aussichtspunkte am South Rim mit dramatischen Gesteinsschichten – beliebt für Sonnenauf-/untergang und Fotografie.',
    },
  },
  '58d538c2-338c-4860-8bfc-149f8d207a6a': {
    name: {
      ja: 'リパン・ポイント',
      'zh-CN': '利潘角（Lipan Point）',
      'zh-TW': '利潘角（Lipan Point）',
      es: 'Lipan Point',
      fr: 'Lipan Point',
      de: 'Lipan Point',
    },
    description: {
      ja: 'サウスリムでも特に広いパノラマと、コロラド川の長い区間（Unkar Delta含む）が見える展望台。日の出・日没・星空鑑賞に人気です。',
      'zh-CN': '南缘视野极宽的观景点，可看见科罗拉多河很长一段（含 Unkar Delta），是日出、日落与观星的热门点。',
      'zh-TW': '南緣視野極寬的觀景點，可見科羅拉多河很長一段（含 Unkar Delta），是日出、日落與觀星的熱門點。',
      es: 'Uno de los panoramas más amplios del South Rim y el tramo más largo visible del Colorado, incluido Unkar Delta; ideal para amanecer, atardecer y estrellas.',
      fr: 'L’un des plus vastes panoramas du South Rim et le plus long tronçon visible du Colorado, dont Unkar Delta — parfait pour lever/coucher de soleil et ciel étoilé.',
      de: 'Einer der breitesten Panoramablicke am South Rim und der längste sichtbare Colorado-Abschnitt inkl. Unkar Delta – ideal für Sonnenauf-/untergang und Sterne.',
    },
  },
  '42e6af66-72f4-481a-b53b-3668e347cbdd': {
    name: {
      ja: 'アンテロープキャニオン',
      'zh-CN': '羚羊峡谷',
      'zh-TW': '羚羊峽谷',
      es: 'Antelope Canyon',
      fr: 'Antelope Canyon',
      de: 'Antelope Canyon',
    },
    description: {
      ja: 'ナバホ族の砂岩スロットキャニオン。自然に削られた壁、狭い通路、季節によって現れる光の柱が魅力です。',
      'zh-CN': '纳瓦霍砂岩槽谷，岩壁如天然雕刻，狭缝与季节性光柱是其魅力所在。',
      'zh-TW': '納瓦霍砂岩槽谷，岩壁如天然雕刻，狹縫與季節性光柱是其魅力所在。',
      es: 'Cañón de ranura de arenisca navajo con paredes esculpidas, pasillos estrechos y haces de luz estacionales.',
      fr: 'Canyon de grès navajo aux parois sculptées, passages étroits et faisceaux de lumière saisonniers.',
      de: 'Navajo-Sandstein-Slot-Canyon mit skulptierten Wänden, engen Passagen und jahreszeitlichen Lichtstrahlen.',
    },
  },
  '8b5b0e23-bad6-4827-a5a8-af108d869663': {
    name: {
      ja: 'ホースシューベンド',
      'zh-CN': '马蹄湾',
      'zh-TW': '馬蹄灣',
      es: 'Horseshoe Bend',
      fr: 'Horseshoe Bend',
      de: 'Horseshoe Bend',
    },
    description: {
      ja: 'コロラド川が馬蹄形に曲がる象徴的な展望地。往復約2.4kmの散策で到達。日の出・日没が特に美しいです。水・帽子・日焼け止めを持ち、崖端から離れて観覧してください。',
      'zh-CN': '科罗拉多河呈马蹄形弯曲的标志性观景点。往返步行约 2.4 公里。日出日落景色尤佳。请带水与防晒，并远离悬崖边缘。',
      'zh-TW': '科羅拉多河呈馬蹄形彎曲的標誌性觀景點。往返步行約 2.4 公里。日出日落景色尤佳。請帶水與防曬，並遠離懸崖邊緣。',
      es: 'Mirador icónico donde el Colorado traza una herradura. Paseo de ida y vuelta ~1,5 mi. Mejor al amanecer/atardecer. Lleve agua y protección solar; aléjese del borde.',
      fr: 'Point de vue iconique où le Colorado forme un fer à cheval. Marche A/R ~1,5 mi. Idéal au lever/coucher du soleil. Eau et protection solaire ; restez loin du bord.',
      de: 'Ikonischer Aussichtspunkt, an dem der Colorado einen Hufeisenbogen bildet. Hin und zurück ca. 2,4 km. Am schönsten bei Sonnenauf-/untergang. Wasser & Sonnenschutz mitnehmen; Abstand zur Kante halten.',
    },
  },
  '75a3e435-c4a4-4d95-b108-5a4dde28d5ac': {
    name: {
      ja: 'グランドキャニオン',
      'zh-CN': '大峡谷',
      'zh-TW': '大峽谷',
      es: 'Gran Cañón',
      fr: 'Grand Canyon',
      de: 'Grand Canyon',
    },
    description: {
      ja: 'コロラド川が何百万年もかけて削った巨大峡谷。リムごとに景色が異なります。サウスリムはクラシックな展望ポイントが集まる区間。イーストリムはコロラド川とホースシューベンド方向の開けた眺めと多彩な岩肌が特徴です。',
      'zh-CN': '科罗拉多河历经数百万年切割而成的巨大峡谷，不同边缘景色各异。南缘汇集经典观景点；东缘面向河流与马蹄湾方向，视野开阔、岩层色彩丰富。',
      'zh-TW': '科羅拉多河歷經數百萬年切割而成的巨大峽谷，不同邊緣景色各異。南緣匯集經典觀景點；東緣面向河流與馬蹄灣方向，視野開闊、岩層色彩豐富。',
      es: 'Garganta inmensa tallada por el Colorado durante millones de años; cada rim ofrece una perspectiva distinta. El South Rim es el clásico; el East Rim mira hacia el río y Horseshoe Bend con vistas amplias y rocas de colores.',
      fr: 'Immense gorge sculptée par le Colorado pendant des millions d’années ; chaque rim offre une vue différente. Le South Rim est le plus classique ; l’East Rim s’ouvre vers le fleuve et Horseshoe Bend.',
      de: 'Eine riesige Schlucht, die der Colorado über Millionen Jahre geformt hat – jeder Rim bietet eine andere Perspektive. Der South Rim ist der Klassiker; der East Rim blickt Richtung Fluss und Horseshoe Bend.',
    },
  },
  '3a390e75-6a97-4432-ba82-cfcb5ef0a8e2': {
    name: {
      ja: 'イーストリム',
      'zh-CN': '东缘（East Rim）',
      'zh-TW': '東緣（East Rim）',
      es: 'East Rim',
      fr: 'East Rim',
      de: 'East Rim',
    },
    description: {
      ja: '広大な峡谷と層状の岩肌が広がるイーストリム。サウスリムとは異なる角度からグランドキャニオンの壮大さを楽しめます。',
      'zh-CN': '东缘视野开阔，层状岩壁分明，可从不同于南缘的角度欣赏大峡谷壮丽景色。',
      'zh-TW': '東緣視野開闊，層狀岩壁分明，可從不同於南緣的角度欣賞大峽谷壯麗景色。',
      es: 'El East Rim ofrece vistas amplias, formaciones en capas y una perspectiva distinta a la del South Rim más desarrollado.',
      fr: 'L’East Rim offre de vastes vues, des strates colorées et une perspective différente du South Rim plus aménagé.',
      de: 'Der East Rim bietet weite Blicke, Schichtgestein und eine andere Perspektive als der stärker erschlossene South Rim.',
    },
  },
  'd18ce50b-1d9e-4a2f-a655-abae8772e46d': {
    name: {
      ja: 'グランドキャニオン・サウスリム',
      'zh-CN': '大峡谷南缘',
      'zh-TW': '大峽谷南緣',
      es: 'Grand Canyon South Rim',
      fr: 'Grand Canyon South Rim',
      de: 'Grand Canyon South Rim',
    },
    description: {
      ja: '最も代表的な展望ポイントが集まるクラシック区間。峡谷の深さ・幅・色彩を一度に感じられます。',
      'zh-CN': '最经典的观景路段，汇集代表性观景点，能同时感受峡谷的深度、宽度与色彩。',
      'zh-TW': '最經典的觀景路段，匯集代表性觀景點，能同時感受峽谷的深度、寬度與色彩。',
      es: 'El área más clásica e icónica, con miradores que muestran profundidad, amplitud y colores del cañón.',
      fr: 'La zone la plus classique et emblématique, avec des points de vue montrant profondeur, largeur et couleurs.',
      de: 'Der klassischste Bereich mit ikonischen Aussichten auf Tiefe, Breite und Farben der Schlucht.',
    },
  },
  'fc6ea231-6f42-4e80-aa21-53f3a2cae938': {
    name: {
      ja: '休憩所',
      'zh-CN': '休息站',
      'zh-TW': '休息站',
      es: 'Parada de descanso',
      fr: 'Arrêt pause',
      de: 'Rastplatz',
    },
  },
  '2f476205-86d6-433a-99ee-ef742f26fe75': {
    name: {
      ja: '休憩所',
      'zh-CN': '休息站',
      'zh-TW': '休息站',
      es: 'Parada de descanso',
      fr: 'Arrêt pause',
      de: 'Rastplatz',
    },
  },
  '54fcaa01-29b9-4000-a1fa-da72614fb37c': {
    name: {
      ja: '休憩所',
      'zh-CN': '休息站',
      'zh-TW': '休息站',
      es: 'Parada de descanso',
      fr: 'Arrêt pause',
      de: 'Rastplatz',
    },
  },
  'd5a21b5c-3692-474f-9db3-97590079b83b': {
    name: {
      ja: '休憩所',
      'zh-CN': '休息站',
      'zh-TW': '休息站',
      es: 'Parada de descanso',
      fr: 'Arrêt pause',
      de: 'Rastplatz',
    },
  },
  '6928140a-2a0c-4be7-b14b-e79242aa4e75': {
    name: {
      ja: 'ホテルドロップオフ',
      'zh-CN': '酒店送回',
      'zh-TW': '飯店送回',
      es: 'Devolución en hotel',
      fr: 'Dépose à l’hôtel',
      de: 'Hotel-Rückfahrt',
    },
  },
}

function mergeLocaleMaps(existing, fieldMap) {
  const next = { ...(existing || {}) }
  for (const [field, byLocale] of Object.entries(fieldMap)) {
    next[field] = { ...(next[field] || {}), ...byLocale }
  }
  return next
}

async function main() {
  // FAQs
  for (const [id, maps] of Object.entries(FAQS)) {
    const { data: row, error: fe } = await sb
      .from('faq_library')
      .select('content_i18n')
      .eq('id', id)
      .maybeSingle()
    if (fe) throw fe
    const content_i18n = mergeLocaleMaps(row?.content_i18n, maps)
    const { error } = await sb.from('faq_library').update({ content_i18n }).eq('id', id)
    if (error) throw error
    console.log('faq', id.slice(0, 8))
  }

  for (const [id, maps] of Object.entries(CHOICES)) {
    const { data: row } = await sb
      .from('product_choices')
      .select('content_i18n')
      .eq('id', id)
      .maybeSingle()
    const content_i18n = mergeLocaleMaps(row?.content_i18n, maps)
    const { error } = await sb.from('product_choices').update({ content_i18n }).eq('id', id)
    if (error) throw error
    console.log('choice', id.slice(0, 8))
  }

  for (const [id, maps] of Object.entries(OPTIONS)) {
    const { data: row } = await sb
      .from('choice_options')
      .select('content_i18n')
      .eq('id', id)
      .maybeSingle()
    const content_i18n = mergeLocaleMaps(row?.content_i18n, maps)
    const { error } = await sb.from('choice_options').update({ content_i18n }).eq('id', id)
    if (error) throw error
    console.log('option', id.slice(0, 8))
  }

  for (const [id, maps] of Object.entries(COURSES)) {
    const { data: row } = await sb
      .from('tour_courses')
      .select('content_i18n')
      .eq('id', id)
      .maybeSingle()
    const content_i18n = mergeLocaleMaps(row?.content_i18n, maps)
    const { error } = await sb.from('tour_courses').update({ content_i18n }).eq('id', id)
    if (error) throw error
    console.log('course', id.slice(0, 8))
  }

  console.log('OK related i18n applied', {
    faqs: Object.keys(FAQS).length,
    choices: Object.keys(CHOICES).length,
    options: Object.keys(OPTIONS).length,
    courses: Object.keys(COURSES).length,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
