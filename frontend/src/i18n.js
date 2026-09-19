import { createContext, useContext } from 'react'

// ====================================================
// 🌍 Languages — Tajik, Russian, English, Persian
// ====================================================

export const LANGS = [
    { code: 'tg', native: 'Тоҷикӣ', dir: 'ltr' },
    { code: 'ru', native: 'Русский', dir: 'ltr' },
    { code: 'en', native: 'English', dir: 'ltr' },
    { code: 'fa', native: 'فارسی', dir: 'rtl' },
]

export const langMeta = (code) => LANGS.find((l) => l.code === code) || LANGS[2]

const STRINGS = {
    tg: {
        title: 'Дафни қарорҳои аблаҳона',
        subtitle: 'Бадтарин қарори худро иқрор кун. Мо онро бо тамоми эҳтиром ба хок месупорем.',
        confessLabel: 'Гуноҳатро иқрор кун…',
        placeholders: [
            'Шаби пеш аз имтиҳон то субҳ сериал тамошо кардам…',
            'Ҳамаи маошамро барои телефони нав додам…',
            'Ба дӯстам қарз додам ва ӯ нопадид шуд…',
        ],
        bury: 'Дафн кун',
        answerIn: 'Ҷавоб',
        micStart: 'Бо овоз гӯй',
        micListening: 'Гӯш мекунам… барои қатъ пахш кун',
        micTranscribing: 'Ба матн мегардонам…',
        micDenied: 'Ба микрофон иҷозат нест. Онро дар танзимоти браузер фаъол кун.',
        micUnsupported: 'Ин браузер сабти овозро дастгирӣ намекунад.',
        loading: [
            'Гӯр мекобем…',
            'Санги қабрро сайқал медиҳем…',
            'Навиштаҷотро бо хун менависем…',
            'Шамъҳоро месӯзонем…',
            'Азодоронро ҷамъ мекунем…',
            'Сухани видоъро омода мекунем…',
            'Тобути дараҷаи олӣ фармоиш медиҳем…',
            'Арвоҳро даъват мекунем…',
            'Заминро барои қабр тайёр мекунем…',
            'Нақлгӯ гулӯяшро тоза мекунад…',
        ],
        rip: 'Ором хоб',
        causeLabel: 'Сабаби марг',
        tapHint: 'барои сухани видоъ пахш кун',
        readEulogy: 'Сухани видоъ',
        listen: 'Гӯш кардан',
        stop: 'Қатъ',
        narratorWarming: 'Нақлгӯ гулӯяшро тоза мекунад…',
        narratorError: 'Нақлгӯ ҳоло гап зада наметавонад. Каме дертар кӯшиш кун.',
        share: 'Фиристодан',
        shareSaved: 'Расм захира шуд',
        shareText: 'Ман қарори аблаҳонаамро дафн кардам 🪦 Қарори худро низ дафн кун:',
        buryAnother: 'Боз дафн кун',
        scrollTitle: 'Сухани расмии видоъ',
        scrollSigned: '— Бюрои дафни шоиста',
        close: 'Пӯшидан',
        cemeteryTitle: 'Қабристони ман',
        cemeterySubtitle: 'Қабрро пахш кун, то сухани видоъро боз хонӣ',
        deleteGrave: 'Қабрро то абад нест кун',
        soundOn: 'Садо фаъол аст',
        soundOff: 'Садо хомӯш аст',
        language: 'Забон',
        genericError: 'Дар сағона чизе хато шуд…',
        offline: 'Сервер ҷавоб намедиҳад — ин қабр танҳо дар ҳамин дастгоҳ монд.',
        langNames: { tg: 'тоҷикӣ', ru: 'русӣ', en: 'англисӣ', fa: 'форсӣ' },
    },
    ru: {
        title: 'Похороны глупых решений',
        subtitle: 'Исповедай своё худшее решение. Мы устроим ему достойные похороны.',
        confessLabel: 'Исповедай свой грех…',
        placeholders: [
            'Всю ночь перед экзаменом смотрел сериал…',
            'Потратил всю зарплату на новый телефон…',
            'Одолжил другу денег, и он пропал…',
        ],
        bury: 'Похоронить',
        answerIn: 'Ответ',
        micStart: 'Сказать голосом',
        micListening: 'Слушаю… нажми, чтобы остановить',
        micTranscribing: 'Расшифровываю…',
        micDenied: 'Нет доступа к микрофону. Разреши его в настройках браузера.',
        micUnsupported: 'Этот браузер не умеет записывать звук.',
        loading: [
            'Копаем могилу…',
            'Полируем надгробие…',
            'Пишем эпитафию кровью…',
            'Зажигаем свечи…',
            'Собираем скорбящих…',
            'Готовим панихиду…',
            'Заказываем гроб премиум-класса…',
            'Призываем духов…',
            'Готовим землю для могилы…',
            'Чтец прочищает горло…',
        ],
        rip: 'Покойся с миром',
        causeLabel: 'Причина смерти',
        tapHint: 'нажми, чтобы прочитать панихиду',
        readEulogy: 'Панихида',
        listen: 'Послушать',
        stop: 'Стоп',
        narratorWarming: 'Чтец прочищает горло…',
        narratorError: 'Чтец сейчас не может говорить. Попробуй чуть позже.',
        share: 'Поделиться',
        shareSaved: 'Картинка сохранена',
        shareText: 'Я похоронил своё глупое решение 🪦 Похорони и ты своё:',
        buryAnother: 'Похоронить ещё',
        scrollTitle: 'Официальная панихида',
        scrollSigned: '— Бюро достойных похорон',
        close: 'Закрыть',
        cemeteryTitle: 'Моё кладбище',
        cemeterySubtitle: 'Нажми на могилу, чтобы перечитать панихиду',
        deleteGrave: 'Удалить могилу навсегда',
        soundOn: 'Звук включён',
        soundOff: 'Звук выключен',
        language: 'Язык',
        genericError: 'Что-то пошло не так в склепе…',
        offline: 'Сервер не отвечает — эта могила сохранена только на этом устройстве.',
        langNames: { tg: 'таджикский', ru: 'русский', en: 'английский', fa: 'персидский' },
    },
    en: {
        title: 'Funeral for Stupid Decisions',
        subtitle: "Confess your worst decision. We'll give it the funeral it deserves.",
        confessLabel: 'Confess your sin…',
        placeholders: [
            'I binge-watched a whole series the night before my exam…',
            'I spent my entire salary on a new phone…',
            'I lent my friend money and he vanished…',
        ],
        bury: 'Bury it',
        answerIn: 'Answer in',
        micStart: 'Say it out loud',
        micListening: 'Listening… tap to stop',
        micTranscribing: 'Transcribing…',
        micDenied: 'No microphone access. Allow it in your browser settings.',
        micUnsupported: "This browser can't record audio.",
        loading: [
            'Digging the grave…',
            'Polishing the tombstone…',
            'Writing the epitaph in blood…',
            'Lighting the candles…',
            'Gathering the mourners…',
            'Preparing the eulogy…',
            'Ordering a premium coffin…',
            'Summoning the spirits…',
            'Preparing the ground…',
            'The narrator clears his throat…',
        ],
        rip: 'Rest in Peace',
        causeLabel: 'Cause of death',
        tapHint: 'tap to read the eulogy',
        readEulogy: 'Eulogy',
        listen: 'Listen',
        stop: 'Stop',
        narratorWarming: 'The narrator clears his throat…',
        narratorError: "The narrator can't speak right now. Try again a bit later.",
        share: 'Share',
        shareSaved: 'Image saved',
        shareText: 'I just buried my stupid decision 🪦 Bury yours:',
        buryAnother: 'Bury another',
        scrollTitle: 'Official Eulogy',
        scrollSigned: '— Bureau of Dignified Funerals',
        close: 'Close',
        cemeteryTitle: 'My Cemetery',
        cemeterySubtitle: 'Tap a grave to reread its eulogy',
        deleteGrave: 'Delete this grave forever',
        soundOn: 'Sound on',
        soundOff: 'Sound off',
        language: 'Language',
        genericError: 'Something went wrong in the crypt…',
        offline: "The server isn't answering — this grave is saved on this device only.",
        langNames: { tg: 'Tajik', ru: 'Russian', en: 'English', fa: 'Persian' },
    },
    fa: {
        title: 'خاکسپاری تصمیم‌های احمقانه',
        subtitle: 'بدترین تصمیمت را اعتراف کن. ما با تمام احترام به خاکش می‌سپاریم.',
        confessLabel: 'به گناهت اعتراف کن…',
        placeholders: [
            'شب قبل از امتحان تا صبح سریال دیدم…',
            'کل حقوقم را خرج یک گوشی جدید کردم…',
            'به دوستم قرض دادم و دیگر جواب تلفنم را نمی‌دهد…',
        ],
        bury: 'به خاک بسپار',
        answerIn: 'پاسخ',
        micStart: 'با صدا بگو',
        micListening: 'دارم گوش می‌دهم… برای توقف بزن',
        micTranscribing: 'در حال تبدیل به متن…',
        micDenied: 'اجازهٔ میکروفون داده نشد. آن را در تنظیمات مرورگر فعال کن.',
        micUnsupported: 'این مرورگر ضبط صدا را پشتیبانی نمی‌کند.',
        loading: [
            'در حال کندن قبر…',
            'در حال صیقل دادن سنگ قبر…',
            'نوشتن سنگ‌نوشته با خون…',
            'روشن کردن شمع‌ها…',
            'جمع کردن عزاداران…',
            'آماده کردن مرثیه…',
            'سفارش تابوت درجه‌یک…',
            'احضار ارواح…',
            'آماده کردن زمین قبر…',
            'راوی دارد گلویش را صاف می‌کند…',
        ],
        rip: 'آرام بخواب',
        causeLabel: 'علت مرگ',
        tapHint: 'برای خواندن مرثیه بزن',
        readEulogy: 'مرثیه',
        listen: 'گوش کن',
        stop: 'توقف',
        narratorWarming: 'راوی دارد گلویش را صاف می‌کند…',
        narratorError: 'راوی الان نمی‌تواند صحبت کند. کمی بعد امتحان کن.',
        share: 'فرستادن',
        shareSaved: 'تصویر ذخیره شد',
        shareText: 'تصمیم احمقانه‌ام را به خاک سپردم 🪦 تو هم مال خودت را دفن کن:',
        buryAnother: 'یکی دیگر را دفن کن',
        scrollTitle: 'مرثیهٔ رسمی',
        scrollSigned: '— دفتر خاکسپاری آبرومندانه',
        close: 'بستن',
        cemeteryTitle: 'گورستان من',
        cemeterySubtitle: 'روی قبر بزن تا مرثیه‌اش را دوباره بخوانی',
        deleteGrave: 'این قبر را برای همیشه پاک کن',
        soundOn: 'صدا روشن است',
        soundOff: 'صدا خاموش است',
        language: 'زبان',
        genericError: 'در دخمه چیزی خراب شد…',
        offline: 'سرور پاسخ نمی‌دهد — این قبر فقط روی همین دستگاه ذخیره شد.',
        langNames: { tg: 'تاجیکی', ru: 'روسی', en: 'انگلیسی', fa: 'فارسی' },
    },
}

export function translator(lang) {
    const table = STRINGS[lang] || STRINGS.en
    return (key) => table[key] ?? STRINGS.en[key] ?? key
}

// First visit: follow the phone's language; afterwards, remember the choice.
// ?lang=tg in a shared link wins over both.
export function initialLang() {
    try {
        const fromUrl = normalize(new URLSearchParams(location.search).get('lang'))
        if (fromUrl) return fromUrl
        const saved = normalize(localStorage.getItem('funeral-lang'))
        if (saved) return saved
    } catch { /* private mode */ }
    for (const l of navigator.languages || [navigator.language]) {
        const code = normalize(l)
        if (code) return code
        if (/^prs|^ps/i.test(l)) return 'fa' // Dari / Pashto speakers read Persian
    }
    return 'en'
}

function normalize(value) {
    const v = String(value || '').toLowerCase().slice(0, 2)
    if (v === 'tj') return 'tg'
    return STRINGS[v] ? v : ''
}

// Which language the AI will most likely answer in — the same rules as the server.
export function guessAnswerLang(text, uiLang) {
    const count = (re) => (text.match(re) || []).length
    const arabic = count(/[؀-ۿﭐ-﷿ﹰ-﻿]/g)
    const cyrillic = count(/[Ѐ-ӿ]/g)
    const latin = count(/[A-Za-z]/g)
    if (arabic + cyrillic + latin === 0) return uiLang
    if (arabic >= cyrillic && arabic >= latin) return 'fa'
    if (cyrillic >= latin) {
        if (/[ғӣқӯҳҷҒӢҚӮҲҶ]/.test(text)) return 'tg'
        if (/[ыщьцЫЩЬЦ]/.test(text)) return 'ru'
        return uiLang === 'tg' ? 'tg' : 'ru'
    }
    return uiLang === 'en' ? 'en' : uiLang
}

export const I18nContext = createContext({ lang: 'en', t: translator('en'), setLang: () => {} })
export const useI18n = () => useContext(I18nContext)

// Used only when the backend cannot be reached at all.
export const OFFLINE_TEMPLATES = {
    tg: {
        epitaphs: [(m) => `Дар ин ҷо «${m}» хуфтааст. Соати сеи шаб ин фикри олӣ менамуд.`],
        eulogies: [(m) => `Азизони сӯгвор, имрӯз мо «${m}»-ро гусел мекунем. Он бо садо омад ва бо дуд рафт. Бигзор дар шарми абадӣ ором гирад.`],
        causes: ['Норасоии шадиди ақли солим', 'Оқибатҳои табиӣ'],
    },
    ru: {
        epitaphs: [(m) => `Здесь покоится «${m}». В 3 часа ночи это казалось гениальной идеей.`],
        eulogies: [(m) => `Дорогие скорбящие, мы провожаем «${m}» в последний путь. Оно ворвалось громко и ушло с дымом. Пусть покоится в вечном кринже.`],
        causes: ['Острая нехватка здравого смысла', 'Естественные последствия'],
    },
    en: {
        epitaphs: [(m) => `Here lies "${m}". It seemed brilliant at 3am.`],
        eulogies: [(m) => `Dearly departed, we bid farewell to "${m}". It arrived loudly and left in smoke. May it rest in eternal cringe.`],
        causes: ['Acute lack of common sense', 'Natural consequences'],
    },
    fa: {
        epitaphs: [(m) => `اینجا «${m}» آرمیده است. ساعت سه نیمه‌شب ایدهٔ درخشانی به نظر می‌رسید.`],
        eulogies: [(m) => `سوگواران عزیز، امروز «${m}» را بدرقه می‌کنیم. پرسروصدا آمد و با دود رفت. در شرمساری ابدی آرام گیرد.`],
        causes: ['کمبود حاد عقل سلیم', 'پیامدهای طبیعی'],
    },
}
