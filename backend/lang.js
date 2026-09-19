// ====================================================
// 💀 Languages — English, Russian, Tajik, Persian
// ====================================================
//
// Everything language-specific the backend needs: detection, dates, the static
// fallback templates and the messages it sends back to the visitor.

export const LANGS = ['en', 'ru', 'tg', 'fa']

export function normalizeLang(value) {
    const v = String(value || '').toLowerCase().slice(0, 2)
    if (v === 'tj') return 'tg'
    return LANGS.includes(v) ? v : ''
}

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g
const CYRILLIC = /[Ѐ-ӿ]/g
const LATIN = /[A-Za-z]/g
// Letters only Tajik has / only Russian has (Tajik spelling dropped ы, щ, ь, ц).
const TAJIK_ONLY = /[ғӣқӯҳҷҒӢҚӮҲҶ]/
const RUSSIAN_ONLY = /[ыщьцЫЩЬЦ]/

// Which language the AI should answer in, and whether that is a sure thing.
// Script decides first; the site language breaks the ties script cannot
// (Cyrillic without Tajik or Russian letters, or Latin text on a non-English
// site, which may be transliterated Tajik/Russian/Persian).
export function detectLanguage(text, uiLang) {
    const ui = normalizeLang(uiLang)
    const count = (re) => (text.match(re) || []).length
    const arabic = count(ARABIC)
    const cyrillic = count(CYRILLIC)
    const latin = count(LATIN)

    if (arabic + cyrillic + latin === 0) return { lang: ui || 'en', certain: false }
    if (arabic >= cyrillic && arabic >= latin) return { lang: 'fa', certain: true }
    if (cyrillic >= latin) {
        if (TAJIK_ONLY.test(text)) return { lang: 'tg', certain: true }
        if (RUSSIAN_ONLY.test(text)) return { lang: 'ru', certain: true }
        return { lang: ui === 'tg' ? 'tg' : 'ru', certain: false }
    }
    if (!ui || ui === 'en') return { lang: 'en', certain: true }
    return { lang: ui, certain: false }
}

// ====================================================
// 💀 Dates
// ====================================================

const MONTHS = {
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    tg: ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'],
}

// Persian readers get the Solar Hijri calendar they actually use (۱۵ اسفند ۱۳۹۹).
const persianDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })

export function formatDate(date, lang) {
    if (lang === 'fa') return persianDate.format(date)
    const d = date.getDate()
    const m = MONTHS[lang === 'en' ? 'en' : lang === 'tg' ? 'tg' : 'ru'][date.getMonth()]
    const y = date.getFullYear()
    return lang === 'en' ? `${m} ${d}, ${y}` : `${d} ${m} ${y}`
}

export function randomPastDate(yearStart = 2015, yearEnd = 2025) {
    const year = yearStart + Math.floor(Math.random() * (yearEnd - yearStart))
    return new Date(year, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1, 12)
}

// ====================================================
// 💀 Static Fallback Templates
// ====================================================

export const EPITAPHS = {
    ru: [
        (m) => `Здесь покоится «${m}» — решение настолько дерзкое, что даже Дарвин аплодировал.`,
        (m) => `Светлая память «${m}». В 3 часа ночи это казалось гениальной идеей.`,
        (m) => `«${m}» — ушло, но не забыто. В основном потому, что мы всё заскринили.`,
        (m) => `Покойся с миром, «${m}». Ты научило нас, как НЕ надо делать.`,
        (m) => `Любимое «${m}» — рождённое в самоуверенности, умершее от здравого смысла.`,
        (m) => `«${m}» — прекрасная катастрофа. Как фейерверк внутри квартиры.`,
        (m) => `Здесь лежит «${m}». Продержалось дольше, чем ожидалось.`,
        (m) => `Памяти «${m}» — доказавшего, что гравитация всегда побеждает.`,
        (m) => `«${m}» — идея, объединившая всех в чувстве вторичного стыда.`,
        (m) => `Прощай, «${m}». Ты был спидбампом на шоссе мудрости.`,
        (m) => `Здесь покоится «${m}» — уверенность без компетентности — просто вайб.`,
        (m) => `«${m}» — легендарное решение. Не в хорошем смысле. Но легендарное.`,
    ],
    en: [
        (m) => `Here lies "${m}" — a decision so bold, even Darwin applauded.`,
        (m) => `In loving memory of "${m}". It seemed brilliant at 3am.`,
        (m) => `"${m}" — Gone but never forgotten. We screenshot everything now.`,
        (m) => `Rest in peace, "${m}". You taught us all what NOT to do.`,
        (m) => `Beloved "${m}" — born in overconfidence, died in hindsight.`,
        (m) => `"${m}" — A beautiful disaster. Like a firework inside a house.`,
        (m) => `Here lies "${m}". Lasted longer than expected, not long enough to matter.`,
        (m) => `In memory of "${m}" — proof that gravity always wins.`,
        (m) => `"${m}" — the idea that united everyone in secondhand embarrassment.`,
        (m) => `Farewell, "${m}". The speedbump on the highway of wisdom.`,
        (m) => `Here rests "${m}" — confidence without competence is just vibes.`,
        (m) => `"${m}" — legendary. Not in a good way. But legendary.`,
    ],
    tg: [
        (m) => `Дар ин ҷо «${m}» хуфтааст — қароре чунон ҷасурона, ки ҳатто Дарвин кафкӯбӣ кард.`,
        (m) => `Ёди «${m}» гиромӣ бод. Соати сеи шаб ин фикри олӣ менамуд.`,
        (m) => `«${m}» — рафт, вале фаромӯш нашуд. Асосан барои он ки ҳама скриншот гирифтанд.`,
        (m) => `Ором хоб, «${m}». Ту ба мо омӯхтӣ, ки чӣ корро НАБОЯД кард.`,
        (m) => `«${m}» — дар худбоварӣ ба дунё омад, аз ақли солим ҷон дод.`,
        (m) => `«${m}» — фоҷиаи зебо. Мисли мушакбозӣ дар дохили хона.`,
        (m) => `Дар ин ҷо «${m}» хобидааст. Аз интизорӣ дида дарозтар тоб овард.`,
        (m) => `Ба хотираи «${m}» — далели он ки ҷозиба ҳамеша ғолиб мебарояд.`,
        (m) => `«${m}» — қароре, ки ҳамаро дар шарми дигарон муттаҳид кард.`,
        (m) => `Алвидо, «${m}». Ту монеаи хурде дар шоҳроҳи хирад будӣ.`,
    ],
    fa: [
        (m) => `اینجا «${m}» آرمیده است — تصمیمی آن‌قدر جسورانه که حتی داروین برایش دست زد.`,
        (m) => `یادش گرامی، «${m}». ساعت سه نیمه‌شب ایدهٔ درخشانی به نظر می‌رسید.`,
        (m) => `«${m}» — رفت، اما فراموش نشد. بیشتر به این خاطر که همه از آن اسکرین‌شات گرفتند.`,
        (m) => `آرام بخواب، «${m}». تو به ما یاد دادی چه کاری را نباید کرد.`,
        (m) => `«${m}» — با اعتمادبه‌نفس به دنیا آمد و به دست عقل سلیم درگذشت.`,
        (m) => `«${m}» — فاجعه‌ای زیبا. مثل آتش‌بازی داخل خانه.`,
        (m) => `اینجا «${m}» خفته است. بیشتر از آنچه انتظار داشتیم دوام آورد.`,
        (m) => `به یاد «${m}» — گواهی بر این‌که جاذبه همیشه برنده است.`,
        (m) => `«${m}» — تصمیمی که همه را در خجالت‌کشیدن به جای دیگران متحد کرد.`,
        (m) => `بدرود، «${m}». تو دست‌انداز کوچکی در بزرگراه خرد بودی.`,
    ],
}

export const EULOGIES = {
    ru: [
        (m) => `Дорогие скорбящие, мы собрались здесь, чтобы проводить «${m}» в последний путь. Оно ворвалось в нашу жизнь как товарный поезд плохих решений и ушло так же — громко, с дымом и оставив всех в недоумении. Мы, возможно, никогда не поймём, зачем это произошло, но всегда будем помнить уроки, которые оно нам вбило. Пусть покоится в вечном кринже.`,
        (m) => `Друзья, мы здесь, чтобы почтить память «${m}». Некоторые решения делают нас сильнее. Это — заставило нас сомневаться во всём. Рождённое в момент безрассудного вдохновения, оно горело ярко — как мусорный контейнер. Оно научило нас смирению, сожалению и важности обдумывания больших идей. Тебя будут скучать. Наверное.`,
        (m) => `Сегодня мы провожаем «${m}» — решение, которое шло, чтобы наша мудрость могла бежать. Оно появилось в момент слабости и задержалось ровно настолько, чтобы вызвать максимальный стыд. Хотя оно ушло, его дух живёт в каждом моменте, когда мы думаем: «погоди, это вообще хорошая идея?» Спасибо за службу.`,
        (m) => `Склоним головы перед «${m}». На великом кладбище глупых решений это заслужило место в VIP-зоне. Оно было амбициозным, бесстрашным и абсолютно безумным. И всё же без него мы бы никогда не узнали истинного значения фразы «учиться на своих ошибках». Прощай, старый друг.`,
        (m) => `Мы предаём земле «${m}» — решение, бросившее вызов логике, разуму и базовой арифметике. Это был тот выбор, от которого ангелы плачут, а комики ликуют. Хоть и короткое, его влияние ощущалось во множестве групповых чатов. Опуская его в землю, мы обещаем стать лучше. Наверное. Может быть. Попробуем.`,
        (m) => `Сегодня мы хороним «${m}» — решение настолько уверенное, насколько и ошибочное. Оно вошло в нашу жизнь с размахом, а ушло с запретительным ордером от здравого смысла. Как и все великие трагедии, его можно было предотвратить. Но мы здесь, стоим у могилы, каким-то образом богаче опытом и беднее достоинством.`,
    ],
    en: [
        (m) => `Dearly departed, we gather here today to bid farewell to "${m}". It arrived in our lives like a freight train of bad judgment, and it left the same way — loudly, with smoke, and leaving everyone confused. We may never understand why it happened, but we will always remember the lessons it beat into us. May it rest in eternal cringe.`,
        (m) => `Friends, we are here to honor the memory of "${m}". Some decisions make us stronger. This one made us question everything. Born from a moment of reckless inspiration, it burned brightly — like a dumpster fire. It taught us humility, regret, and the importance of sleeping on big ideas. You will be missed. Sort of.`,
        (m) => `We come together to mourn "${m}" — a decision that walked so our wisdom could run. It appeared during a moment of weakness and stayed just long enough to cause maximum embarrassment. Though it is gone, its spirit lives on in every moment we pause and think "wait, is this actually a good idea?" Thank you for your service.`,
        (m) => `Let us bow our heads for "${m}". In the grand cemetery of stupid decisions, this one earned a premium plot. It was ambitious, it was fearless, it was absolutely unhinged. And yet, without it, we would never have known the true meaning of "learning the hard way." Goodbye, old friend.`,
        (m) => `Today we lay to rest "${m}" — a decision as confident as it was misguided. It entered our lives with swagger and left with a restraining order from common sense. Like all great tragedies, it was completely preventable. Yet here we are, standing at its grave, somehow richer in experience and poorer in dignity.`,
        (m) => `We commend to the earth "${m}", a decision that defied logic, reason, and basic math. It was the kind of choice that makes angels weep and comedians rejoice. Though short-lived, its impact was felt across multiple group chats. As we lower it into the ground, we promise to do better. Probably. Maybe. We'll try.`,
    ],
    tg: [
        (m) => `Азизони сӯгвор, имрӯз мо ҷамъ омадем, то «${m}»-ро ба роҳи охират гусел кунем. Он ба ҳаёти мо мисли қатори боркаши қарорҳои бад даромад ва ҳамон тавр рафт — бо садо, бо дуд ва ҳамаро дар ҳайрат гузошта. Шояд мо ҳеҷ гоҳ нафаҳмем, ки чаро ин рӯй дод, аммо дарсҳояшро ҳамеша дар хотир хоҳем дошт. Бигзор дар шарми абадӣ ором гирад.`,
        (m) => `Дӯстон, мо ин ҷо ҳастем, то хотираи «${m}»-ро гиромӣ дорем. Баъзе қарорҳо моро қавитар мекунанд. Ин яке моро водор кард, ки ба ҳама чиз шубҳа кунем. Он дар лаҳзаи илҳоми бепарвоёна таваллуд шуд ва дурахшон сӯхт — мисли қуттии партови оташгирифта. Мо туро пазмон мешавем. Шояд.`,
        (m) => `Имрӯз мо «${m}»-ро гусел мекунем — қароре, ки оҳиста рафт, то ақли мо давида тавонад. Он дар лаҳзаи сустӣ пайдо шуд ва маҳз ҳамон қадар монд, ки шармандагии ҳадди аксарро орад. Гарчанде ки он рафт, рӯҳаш дар ҳар лаҳзае зинда аст, ки мо мегӯем: «Истед, оё ин воқеан фикри хуб аст?» Ташаккур барои хизматат.`,
        (m) => `Сар хам кунем барои «${m}». Дар қабристони бузурги қарорҳои аблаҳона ин яке ҷойи беҳтаринро сазовор шуд. Он шуҷоъ, бебок ва комилан девона буд. Ва бо вуҷуди ин, бе он мо ҳеҷ гоҳ маънои аслии «аз хатои худ омӯхтан»-ро намедонистем. Алвидо, дӯсти деринаи мо.`,
    ],
    fa: [
        (m) => `سوگواران عزیز، امروز گرد هم آمده‌ایم تا «${m}» را بدرقه کنیم. مثل قطار باری تصمیم‌های بد وارد زندگی‌مان شد و همان‌طور هم رفت — پرسروصدا، با دود، و همه را حیران گذاشت. شاید هرگز نفهمیم چرا اتفاق افتاد، اما درس‌هایی را که به ما داد همیشه به یاد خواهیم داشت. در شرمساری ابدی آرام گیرد.`,
        (m) => `دوستان، اینجا هستیم تا یاد «${m}» را گرامی بداریم. بعضی تصمیم‌ها ما را قوی‌تر می‌کنند. این یکی ما را به همه‌چیز مشکوک کرد. در لحظه‌ای از الهام بی‌پروا زاده شد و درخشان سوخت — درست مثل سطل زباله‌ای در آتش. دلمان برایت تنگ خواهد شد. احتمالاً.`,
        (m) => `امروز «${m}» را بدرقه می‌کنیم — تصمیمی که آهسته رفت تا خرد ما بتواند بدود. در لحظهٔ ضعف پیدا شد و درست به اندازه‌ای ماند که بیشترین شرمندگی را به بار آورد. هرچند رفته است، روحش در هر لحظه‌ای زنده است که از خودمان می‌پرسیم: «صبر کن، این واقعاً ایدهٔ خوبی است؟» از خدماتت سپاسگزاریم.`,
        (m) => `سر خم کنیم برای «${m}». در گورستان بزرگ تصمیم‌های احمقانه، این یکی بهترین جایگاه را به دست آورد. جاه‌طلب بود، بی‌باک بود و کاملاً دیوانه. و با این حال، بدون آن هرگز معنای واقعی «درس گرفتن از راه سخت» را نمی‌فهمیدیم. بدرود، دوست قدیمی.`,
    ],
}

export const CAUSES_OF_DEATH = {
    ru: [
        "Терминальное перемудривание",
        "Острая нехватка здравого смысла",
        "Хронический синдром самоуверенности",
        "Спонтанное самовозгорание логики",
        "Смерть от проверки реальностью",
        "Массивный отказ эго",
        "Передозировка плохими вайбами",
        "Поражён суровым светом утра",
        "Осложнения от чрезмерной дерзости",
        "Естественные последствия",
        "Фатальная встреча с ретроспективой",
        "Осложнения от принятия решений в 3 часа ночи",
    ],
    en: [
        "Terminal overthinking",
        "Acute lack of common sense",
        "Chronic overconfidence syndrome",
        "Spontaneous combustion of logic",
        "Death by reality check",
        "Massive ego failure",
        "Overdose of bad vibes",
        "Struck by the harsh light of dawn",
        "Complications from being too bold",
        "Natural consequences",
        "Fatal encounter with hindsight",
        "Complications arising from 3am decision-making",
    ],
    tg: [
        "Зиёдфикрии марговар",
        "Норасоии шадиди ақли солим",
        "Синдроми музмини худбоварӣ",
        "Худсӯзии ногаҳонии мантиқ",
        "Марг аз рӯ ба рӯ шудан бо воқеият",
        "Шикасти азими ғурур",
        "Вояи барзиёди кайфияти бад",
        "Гирифтори нури бераҳми субҳ",
        "Оқибатҳои табиӣ",
        "Мушкилот пас аз қарорҳои соати сеи шаб",
    ],
    fa: [
        "زیادفکری مرگبار",
        "کمبود حاد عقل سلیم",
        "سندروم مزمن اعتمادبه‌نفس کاذب",
        "خودسوزی ناگهانی منطق",
        "مرگ بر اثر برخورد با واقعیت",
        "فروپاشی عظیم غرور",
        "مصرف بیش از حد حال بد",
        "برخورد مرگبار با پشیمانی",
        "پیامدهای طبیعی",
        "عوارض تصمیم‌گیری ساعت سه نیمه‌شب",
    ],
}

// ====================================================
// 💀 Messages sent back to the visitor
// ====================================================

const MESSAGES = {
    tooShort: {
        en: 'Confess at least a short mistake.',
        ru: 'Нужно исповедать хотя бы короткую ошибку.',
        tg: 'Ақаллан як хатои кӯтоҳро иқрор кун.',
        fa: 'دست‌کم یک اشتباه کوتاه را اعتراف کن.',
    },
    tooLong: {
        en: 'Too long a confession — {max} characters at most.',
        ru: 'Слишком длинная исповедь — максимум {max} символов.',
        tg: 'Иқрор хеле дароз аст — ҳадди аксар {max} аломат.',
        fa: 'اعتراف خیلی طولانی است — حداکثر {max} نویسه.',
    },
    rateLimited: {
        en: 'The cemetery is full. Take a breath and come back in a minute.',
        ru: 'Кладбище переполнено. Передохни минуту и возвращайся.',
        tg: 'Қабристон пур шуд. Як дам нафас рост кун ва баъди як дақиқа баргард.',
        fa: 'گورستان پر شده. نفسی تازه کن و یک دقیقهٔ دیگر برگرد.',
    },
    notFound: {
        en: 'Grave not found.',
        ru: 'Могила не найдена.',
        tg: 'Қабр ёфт нашуд.',
        fa: 'قبر پیدا نشد.',
    },
    deleted: {
        en: 'The grave is sealed forever.',
        ru: 'Могила упокоена навечно.',
        tg: 'Қабр то абад мӯҳр зада шуд.',
        fa: 'این قبر برای همیشه مهر و موم شد.',
    },
    voiceBusy: {
        en: 'The narrator is resting. Try again a little later.',
        ru: 'Чтец отдыхает. Попробуй чуть позже.',
        tg: 'Нақлгӯ дам мегирад. Каме дертар боз кӯшиш кун.',
        fa: 'راوی در حال استراحت است. کمی بعد دوباره امتحان کن.',
    },
    voiceFailed: {
        en: 'The narrator lost his voice. Try again.',
        ru: 'Чтец потерял голос. Попробуй ещё раз.',
        tg: 'Нақлгӯ овозашро гум кард. Боз кӯшиш кун.',
        fa: 'راوی صدایش را از دست داد. دوباره امتحان کن.',
    },
    voiceOff: {
        en: 'The narrator is not here today.',
        ru: 'Чтеца сегодня нет.',
        tg: 'Нақлгӯ имрӯз нест.',
        fa: 'راوی امروز اینجا نیست.',
    },
    audioTooLong: {
        en: 'That recording is too long — keep it under 30 seconds.',
        ru: 'Слишком длинная запись — не больше 30 секунд.',
        tg: 'Сабт хеле дароз аст — на зиёда аз 30 сония.',
        fa: 'ضبط خیلی طولانی است — حداکثر ۳۰ ثانیه.',
    },
    badAudio: {
        en: 'This recording could not be read. Try again.',
        ru: 'Не удалось прочитать запись. Попробуй ещё раз.',
        tg: 'Сабтро хондан нашуд. Боз кӯшиш кун.',
        fa: 'این ضبط خوانده نشد. دوباره امتحان کن.',
    },
    noSpeech: {
        en: "I couldn't hear anything. Try again, a little louder.",
        ru: 'Ничего не расслышал. Попробуй ещё раз, чуть громче.',
        tg: 'Чизе нашунидам. Боз кӯшиш кун, каме баландтар.',
        fa: 'چیزی نشنیدم. دوباره امتحان کن، کمی بلندتر.',
    },
    sttFailed: {
        en: "Couldn't make out the recording. Try again, or type it.",
        ru: 'Не удалось разобрать запись. Попробуй ещё раз или напиши.',
        tg: 'Сабтро фаҳмида натавонистам. Боз кӯшиш кун ё бинавис.',
        fa: 'نتوانستم صدای ضبط‌شده را بفهمم. دوباره امتحان کن یا بنویس.',
    },
    adminOff: {
        en: 'Admin is disabled: ADMIN_KEY is not set.',
        ru: 'Админка выключена: ADMIN_KEY не задан.',
        tg: 'Панели админ хомӯш аст: ADMIN_KEY муқаррар нашудааст.',
        fa: 'بخش مدیریت خاموش است: ADMIN_KEY تنظیم نشده است.',
    },
    forbidden: {
        en: 'Access denied.',
        ru: 'Доступ запрещён.',
        tg: 'Дастрасӣ манъ аст.',
        fa: 'دسترسی ممنوع است.',
    },
}

export function message(code, lang, vars = {}) {
    const entry = MESSAGES[code]
    if (!entry) return code
    const code2 = normalizeLang(lang) || 'en'
    const text = (entry[code2] || entry.en)
        .replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
    return code2 === 'fa' ? toPersianDigits(text) : text
}

export function toPersianDigits(text) {
    return String(text).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
}

export const LANGUAGE_NAMES = {
    en: 'English',
    ru: 'Russian',
    tg: 'Tajik',
    fa: 'Persian',
}
