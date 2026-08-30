import { BRAND } from "@/lib/brand";
import type { Lang } from "@/lib/i18n";

export type Localized<T> = Readonly<Record<Lang, T>>;

export function marketingText<
  const T extends Readonly<Record<Lang, unknown>>,
  L extends Lang,
>(lang: L, value: T): T[L] {
  return value[lang];
}

export function marketingTemplate(
  template: string,
  values: Record<string, string | number>,
): string {
  return Object.entries(values).reduce(
    (result, [key, value]) =>
      result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}

/**
 * Single source of truth for the public marketing experience.
 *
 * All biography, credentials, statistics, reviews, pricing and asset paths
 * live here so the marketing components remain structural and copy-free.
 */
export const MARKETING = {
  brand: BRAND,
  locale: {
    en: "en-CA",
    tr: "tr-TR",
  },
  metadata: {
    homeTitle: {
      en: "Train with Alisan — Personal training & physiotherapy",
      tr: "Train with Alisan — Kişisel antrenman ve fizyoterapi",
    },
    homeDescription: BRAND.tagline,
    pricingTitle: {
      en: "Pricing — Train with Alisan",
      tr: "Fiyatlandırma — Train with Alisan",
    },
    pricingDescription: {
      en: "Choose a coaching plan built around your training, recovery and progress.",
      tr: "Antrenmanınıza, toparlanmanıza ve ilerlemenize göre hazırlanan koçluk planını seçin.",
    },
  },
  nav: {
    primaryLabel: { en: "Primary navigation", tr: "Ana navigasyon" },
    skipLabel: { en: "Skip to main content", tr: "Ana içeriğe geç" },
    languageLabel: { en: "Choose language", tr: "Dil seçin" },
    menuLabel: { en: "Open navigation menu", tr: "Navigasyon menüsünü aç" },
    closeMenuLabel: { en: "Close navigation menu", tr: "Navigasyon menüsünü kapat" },
    links: [
      { href: "/", label: { en: "Main page", tr: "Ana sayfa" } },
      { href: "/demo", label: { en: "Demo", tr: "Demo" } },
      { href: "/pricing", label: { en: "Pricing", tr: "Fiyatlandırma" } },
    ],
    portal: {
      anonymous: { en: "Log in", tr: "Giriş yap" },
      client: { en: "Dashboard", tr: "Panel" },
      staff: { en: "Admin", tr: "Yönetim" },
    },
  },
  section: {
    about: { en: "About", tr: "Hakkında" },
    why: { en: "The method", tr: "Yaklaşım" },
    reviews: { en: "Client notes", tr: "Danışan notları" },
    pricing: { en: "Pricing", tr: "Fiyatlandırma" },
    faq: { en: "Questions", tr: "Sorular" },
  },
  hero: {
    videoId: { en: "", tr: "" },
    poster: "/media/introduction-film-poster.svg",
    posterAlt: {
      en: "Abstract introduction-film artwork in forest green",
      tr: "Orman yeşili tonlarında soyut tanıtım filmi görseli",
    },
    videoTitle: {
      en: "Meet Alişan and the coaching method",
      tr: "Alişan ve koçluk yaklaşımıyla tanışın",
    },
    comingSoon: { en: "Introduction film coming soon", tr: "Tanıtım filmi yakında" },
    playLabel: { en: "Play introduction film", tr: "Tanıtım filmini oynat" },
    eyebrow: { en: "Training, rebuilt around you", tr: "Size göre yeniden tasarlanan antrenman" },
    headline: {
      en: ["Pain isn't the end of training.", "It's where we start."],
      tr: ["Ağrı antrenmanın sonu değil.", "Başladığımız yer."],
    },
    subhead: {
      en: "Your programme is written by a clinically trained physiotherapist — not a general trainer.",
      tr: "Programını klinik eğitimli bir fizyoterapist yazıyor — genel bir antrenör değil.",
    },
    primaryCta: { en: "Explore plans", tr: "Planları incele" },
    secondaryCta: { en: "Meet Alişan", tr: "Alişan'ı tanıyın" },
    scrollLabel: { en: "Scroll to discover", tr: "Keşfetmek için kaydırın" },
    credibilityLabel: {
      en: "Credentials and experience",
      tr: "Eğitim, uzmanlık ve deneyim",
    },
    credibilityItems: [
      { en: "İSTİNYE UNIVERSITY", tr: "İSTİNYE ÜNİVERSİTESİ" },
      { en: "SENECA COLLEGE", tr: "SENECA COLLEGE" },
      { en: "CORRECTIVE EXERCISE SPECIALIST", tr: "DÜZELTİCİ EGZERSİZ UZMANI" },
      { en: "MEDICAL EXERCISE TRAINER", tr: "MEDİKAL EGZERSİZ EĞİTMENİ" },
      { en: "50+ CLIENTS", tr: "50+ DANIŞAN" },
      { en: "2 COUNTRIES", tr: "2 ÜLKE" },
    ],
  },
  about: {
    portrait: "/media/alisan-portrait.svg",
    portraitAlt: {
      en: "Abstract portrait illustration representing Alişan Alpdoğan",
      tr: "Alişan Alpdoğan'ı temsil eden soyut portre illüstrasyonu",
    },
    eyebrow: { en: "Coach + physiotherapy perspective", tr: "Koç + fizyoterapi bakışı" },
    title: {
      en: "A plan should fit the person, not the other way around.",
      tr: "Plan kişiye uymalı; kişi plana değil.",
    },
    bio: [
      {
        en: "Alişan Alpdoğan is a physiotherapist and personal trainer who works with clients in Türkiye and Canada, in Turkish and English. He brings his physiotherapy background and personal training experience together in an individual approach.",
        tr: "Alişan Alpdoğan, Türkiye ve Kanada'daki danışanlarla Türkçe ve İngilizce çalışan bir fizyoterapist ve kişisel antrenördür. Fizyoterapi altyapısını kişisel antrenman deneyimiyle kişiye özel bir yaklaşımda bir araya getirir.",
      },
      {
        en: "He earned a BSc in Physiotherapy & Rehabilitation from İstinye University in Istanbul (2017–2021), then completed the one-year Fitness Health & Promotion Diploma at Seneca College in Toronto (2024–2025).",
        tr: "İstanbul'daki İstinye Üniversitesi'nde Fizyoterapi ve Rehabilitasyon lisans eğitimini tamamladı (2017–2021). Ardından Toronto'daki Seneca College'da bir yıllık Fitness Health & Promotion kolej diplomasını tamamladı (2024–2025).",
      },
      {
        en: "From 2022 to 2023, he founded Alenex Therapy in Türkiye and worked with more than 50 clients. From 2024 to 2026, he worked as a Personal Trainer and Assistant to Physiotherapy at Vive Fitness in Toronto and as a Personal Trainer at Pure Fitness.",
        tr: "2022–2023 yıllarında Türkiye'de Alenex Therapy'yi kurdu ve 50'den fazla danışanla çalıştı. 2024–2026 arasında Toronto'daki Vive Fitness'ta Kişisel Antrenör ve Fizyoterapi Asistanı, Pure Fitness'ta ise Kişisel Antrenör olarak görev yaptı.",
      },
    ],
    credentialsLabel: { en: "Education & certifications", tr: "Eğitim ve sertifikalar" },
    credentials: [
      {
        en: "BSc Physiotherapy & Rehabilitation — İstinye University, Istanbul (2017–2021)",
        tr: "Fizyoterapi ve Rehabilitasyon Lisansı — İstinye Üniversitesi, İstanbul (2017–2021)",
      },
      {
        en: "Fitness Health & Promotion Diploma — Seneca College, Toronto (2024–2025)",
        tr: "Fitness Health & Promotion Kolej Diploması — Seneca College, Toronto (2024–2025)",
      },
      {
        en: "Corrective Exercise Specialist · Medical Exercise Trainer — Fitness Movement Institute",
        tr: "Düzeltici Egzersiz Uzmanı · Medikal Egzersiz Eğitmeni — Fitness Movement Institute",
      },
      {
        en: "Reformer, Cadillac, Mat and Chair Pilates Instructor — Urban Health Pilates Academy",
        tr: "Reformer, Cadillac, Mat ve Chair Pilates Eğitmeni — Urban Health Pilates Academy",
      },
      {
        en: "Standard First Aid & CPR/AED",
        tr: "Standart İlk Yardım ve CPR/AED",
      },
    ],
    stats: [
      { count: 5, suffix: "+", value: { en: "5+", tr: "5+" }, label: { en: "years in practice", tr: "yıllık mesleki deneyim" } },
      { count: 50, suffix: "+", value: { en: "50+", tr: "50+" }, label: { en: "clients", tr: "danışan" } },
      { count: 2, suffix: "", value: { en: "2", tr: "2" }, label: { en: "countries", tr: "ülke" } },
      { count: 9, suffix: "", value: { en: "9", tr: "9" }, label: { en: "professional certifications", tr: "profesyonel sertifika" } },
    ],
  },
  why: {
    eyebrow: { en: "Why this works", tr: "Neden işe yarar" },
    title: {
      en: "Specific enough to work. Flexible enough to last.",
      tr: "İşe yarayacak kadar net. Sürdürülecek kadar esnek.",
    },
    intro: {
      en: "Six parts of one coaching system—designed to make progress visible and the next step clear.",
      tr: "Tek bir koçluk sisteminin altı parçası—ilerlemeyi görünür, sıradaki adımı net kılmak için tasarlandı.",
    },
    items: [
      {
        icon: "stethoscope",
        title: { en: "Written by a physiotherapist", tr: "Fizyoterapist tarafından hazırlanır" },
        body: {
          en: "Your programme comes from clinical training, not a generic trainer template. That difference matters before an injury, not only after one.",
          tr: "Programınız genel bir antrenör şablonundan değil, klinik eğitimden beslenir. Bu fark yalnızca sakatlık sonrasında değil, öncesinde de önemlidir.",
        },
      },
      {
        icon: "heartPulse",
        title: { en: "We work with pain, not around it", tr: "Ağrıyı görmezden gelmeden çalışırız" },
        body: {
          en: "Back, neck, knee or post-surgery: instead of waiting for it to pass, the programme is shaped around what you can do now.",
          tr: "Bel, boyun, diz ya da ameliyat sonrası süreç: geçmesini beklemek yerine program, bugün yapabildiklerinizin çevresinde şekillenir.",
        },
      },
      {
        icon: "portal",
        title: { en: "Your own client portal", tr: "Size ait danışan portalı" },
        body: {
          en: "Programme, exercise videos, measurements and nutrition plan stay together in one place—with PDF download when you need it.",
          tr: "Programınız, egzersiz videolarınız, ölçümleriniz ve beslenme planınız tek yerde durur; gerektiğinde PDF olarak indirebilirsiniz.",
        },
      },
      {
        icon: "chart",
        title: { en: "Progress you can actually see", tr: "Gerçekten görebildiğiniz ilerleme" },
        body: {
          en: "Weight and circumference measurements become clear charts. Decisions come from data, not a vague feeling.",
          tr: "Kilo ve çevre ölçümleri anlaşılır grafiklere dönüşür. Kararlar belirsiz hislere değil, veriye dayanır.",
        },
      },
      {
        icon: "message",
        title: { en: "Direct weekday access", tr: "Hafta içi doğrudan erişim" },
        body: {
          en: "Get a reply within 24 hours on weekdays. No bot or assistant—the response comes directly from Alişan.",
          tr: "Hafta içi 24 saat içinde yanıt alın. Bot ya da asistan yok; doğrudan Alişan'la iletişim kurarsınız.",
        },
      },
      {
        icon: "refresh",
        title: { en: "Renewed every month", tr: "Her ay yenilenir" },
        body: {
          en: "Your body adapts, so the programme should too. Each month closes with a review and an updated plan.",
          tr: "Vücudunuz uyum sağladıkça programınız da değişmelidir. Her ay değerlendirme ve güncellenmiş bir planla tamamlanır.",
        },
      },
    ],
  },
  demoEntry: {
    href: "/demo",
    eyebrow: { en: "Inside the client portal", tr: "Danışan panelinin içinde" },
    title: {
      en: "See how your coaching comes together.",
      tr: "Koçluğunuzun nasıl bir araya geldiğini görün.",
    },
    body: {
      en: "Preview how weekly programmes, exercise guidance, nutrition and progress tracking live together in one clear client experience.",
      tr: "Haftalık programların, egzersiz yönlendirmelerinin, beslenmenin ve ilerleme takibinin tek bir anlaşılır danışan deneyiminde nasıl buluştuğunu inceleyin.",
    },
    cta: { en: "Explore the demo", tr: "Demoyu incele" },
  },
  demo: {
    metadata: {
      title: {
        en: "Client dashboard demo — Train with Alisan",
        tr: "Danışan paneli demosu — Train with Alisan",
      },
      description: {
        en: "Explore a public, read-only walkthrough of the Train with Alisan client dashboard using sample data.",
        tr: "Train with Alisan danışan panelini örnek verilerle, herkese açık ve salt okunur bir demoda inceleyin.",
      },
    },
    intro: {
      eyebrow: { en: "A look inside", tr: "İçeriden bir bakış" },
      title: {
        en: "Your whole coaching plan, in one calm place.",
        tr: "Tüm koçluk planınız, sade ve tek bir yerde.",
      },
      body: {
        en: "Explore a realistic sample client panel. Switch views, browse programme months and open exercise guidance—nothing here is connected to a real account.",
        tr: "Gerçekçi bir örnek danışan panelini inceleyin. Görünümler arasında geçin, program aylarına göz atın ve egzersiz yönlendirmelerini açın—buradaki hiçbir şey gerçek bir hesaba bağlı değildir.",
      },
    },
    frame: {
      bannerTitle: { en: "Demo · sample data", tr: "Demo · örnek veriler" },
      bannerBody: {
        en: "This read-only walkthrough is fictional and resets when you leave.",
        tr: "Bu salt okunur tanıtım kurgusaldır ve sayfadan ayrıldığınızda sıfırlanır.",
      },
      panelLabel: { en: "Sample client panel", tr: "Örnek danışan paneli" },
      navigationLabel: { en: "Demo views", tr: "Demo görünümleri" },
      signedInAs: { en: "Sample client", tr: "Örnek danışan" },
    },
    views: [
      { id: "overview", icon: "home", label: { en: "Overview", tr: "Genel bakış" } },
      { id: "programme", icon: "dumbbell", label: { en: "Programme", tr: "Program" } },
      { id: "nutrition", icon: "apple", label: { en: "Nutrition", tr: "Beslenme" } },
      { id: "progress", icon: "chart", label: { en: "Progress", tr: "İlerleme" } },
      { id: "schedule", icon: "calendar", label: { en: "Schedule", tr: "Takvim" } },
    ],
    common: {
      readOnly: { en: "Read only", tr: "Salt okunur" },
      current: { en: "Current", tr: "Güncel" },
      previousMonth: { en: "Previous month", tr: "Önceki ay" },
      nextMonth: { en: "Next month", tr: "Sonraki ay" },
      monthNavigation: { en: "Programme month", tr: "Program ayı" },
      openExercise: { en: "Open exercise guidance", tr: "Egzersiz yönlendirmesini aç" },
      closeExercise: { en: "Close exercise guidance", tr: "Egzersiz yönlendirmesini kapat" },
      videoPreview: { en: "Exercise video preview", tr: "Egzersiz videosu ön izlemesi" },
      designedThumbnail: { en: "Designed sample thumbnail", tr: "Tasarlanmış örnek küçük resim" },
      sets: { en: "Sets", tr: "Set" },
      reps: { en: "Reps", tr: "Tekrar" },
      tempo: { en: "Tempo", tr: "Tempo" },
      rest: { en: "Rest", tr: "Dinlenme" },
      seconds: { en: "sec", tr: "sn" },
      notes: { en: "Coach cue", tr: "Koç notu" },
      minutes: { en: "min", tr: "dk" },
      calories: { en: "Calories", tr: "Kalori" },
      mealTotal: { en: "Meal total", tr: "Öğün toplamı" },
      dailyTotal: { en: "Daily total", tr: "Günlük toplam" },
      dailyTarget: { en: "Daily guide", tr: "Günlük hedef" },
      kcal: { en: "kcal", tr: "kcal" },
      booked: { en: "Booked", tr: "Planlandı" },
      available: { en: "Available", tr: "Uygun" },
      unavailable: { en: "Unavailable", tr: "Uygun değil" },
      close: { en: "Close", tr: "Kapat" },
    },
    client: {
      name: { en: "Deniz Aydın", tr: "Deniz Aydın" },
      initials: "DA",
      goal: {
        en: "Build full-body strength and return to pain-confident running",
        tr: "Tüm vücut kuvvetini geliştirmek ve ağrı kaygısı olmadan koşuya dönmek",
      },
      coach: { en: "Coach: Alişan Alpdoğan", tr: "Koç: Alişan Alpdoğan" },
      memberSince: { en: "Coaching since March 2026", tr: "Mart 2026'dan beri koçluk alıyor" },
      avatarAlt: { en: "Sample profile for Deniz Aydın", tr: "Deniz Aydın için örnek profil" },
    },
    overview: {
      greeting: { en: "Good morning, Deniz.", tr: "Günaydın, Deniz." },
      intro: {
        en: "Here is the shape of your current week and the next coaching touchpoint.",
        tr: "Güncel haftanızın özeti ve sıradaki koçluk adımınız burada.",
      },
      metrics: [
        { value: { en: "3", tr: "3" }, label: { en: "training days", tr: "antrenman günü" } },
        { value: { en: "9", tr: "9" }, label: { en: "guided exercises", tr: "yönlendirmeli egzersiz" } },
        { value: { en: "2,040", tr: "2.040" }, label: { en: "daily kcal plan", tr: "günlük kcal planı" } },
        { value: { en: "−3.6 kg", tr: "−3,6 kg" }, label: { en: "since March", tr: "Mart'tan beri" } },
      ],
      programmeEyebrow: { en: "This month", tr: "Bu ay" },
      programmeTitle: { en: "Strength & capacity", tr: "Kuvvet ve kapasite" },
      programmeBody: {
        en: "Three balanced sessions with controlled lower-body loading and a gradual return to running.",
        tr: "Kontrollü alt vücut yüklenmesi ve koşuya kademeli dönüş içeren üç dengeli seans.",
      },
      openProgramme: { en: "View programme", tr: "Programı görüntüle" },
      appointmentEyebrow: { en: "Next appointment", tr: "Sıradaki randevu" },
      appointmentTitle: { en: "Monthly video check-in", tr: "Aylık görüntülü görüşme" },
      appointmentTime: { en: "Thursday, August 27 · 6:30 PM", tr: "27 Ağustos Perşembe · 18.30" },
      appointmentBody: {
        en: "30 minutes · Review running tolerance and plan September's progression.",
        tr: "30 dakika · Koşu toleransını değerlendirme ve Eylül ilerlemesini planlama.",
      },
      coachNoteEyebrow: { en: "Coach note", tr: "Koç notu" },
      coachNoteTitle: { en: "The trend is moving in the right direction.", tr: "Gidişat doğru yönde ilerliyor." },
      coachNoteBody: {
        en: "Your squat control and weekly consistency both improved. Keep the final two reps smooth; we will add load only when the tempo stays steady.",
        tr: "Squat kontrolünüz ve haftalık devamlılığınız gelişti. Son iki tekrarı akıcı tutun; yükü yalnızca tempo sabit kaldığında artıracağız.",
      },
      reviewEyebrow: { en: "Weekly check-in", tr: "Haftalık değerlendirme" },
      reviewTitle: { en: "Review due Sunday", tr: "Değerlendirme pazar günü" },
      reviewBody: {
        en: "In the real panel, your energy, pain and session feedback help shape the next week.",
        tr: "Gerçek panelde enerji, ağrı ve seans geri bildirimleriniz sonraki haftayı şekillendirir.",
      },
      reviewAction: { en: "Send weekly review", tr: "Haftalık değerlendirmeyi gönder" },
    },
    programme: {
      eyebrow: { en: "Monthly training programme", tr: "Aylık antrenman programı" },
      title: { en: "A clear plan for every session.", tr: "Her seans için net bir plan." },
      body: {
        en: "Move between months, open any exercise and see the exact set, rep, tempo and coaching cues a client receives.",
        tr: "Aylar arasında geçin, istediğiniz egzersizi açın ve danışanın aldığı set, tekrar, tempo ve koçluk notlarını görün.",
      },
      downloadAction: { en: "Download programme", tr: "Programı indir" },
      months: [
        {
          id: "2026-07",
          label: { en: "July 2026", tr: "Temmuz 2026" },
          phase: { en: "Foundation & control", tr: "Temel ve kontrol" },
          range: { en: "July 6–31", tr: "6–31 Temmuz" },
          summary: {
            en: "Build repeatable movement quality and a comfortable training rhythm.",
            tr: "Tekrarlanabilir hareket kalitesi ve rahat bir antrenman düzeni oluşturun.",
          },
          days: [
            {
              id: "jul-a",
              title: { en: "Day 1 · Lower-body control", tr: "1. Gün · Alt vücut kontrolü" },
              focus: { en: "Knee-friendly strength", tr: "Diz dostu kuvvet" },
              duration: 44,
              note: { en: "Leave two calm reps in reserve.", tr: "İki rahat tekrarı yedekte bırakın." },
              exercises: [
                { id: "box-squat", name: { en: "Box squat", tr: "Kutuya squat" }, sets: "3", reps: { en: "8", tr: "8" }, tempo: { en: "3-1-1", tr: "3-1-1" }, rest: { en: "75 sec", tr: "75 sn" }, cue: { en: "Touch the box softly and drive through the whole foot.", tr: "Kutuya yumuşakça dokunun ve tüm ayaktan kuvvet alın." }, tone: "forest" },
                { id: "cable-row", name: { en: "Half-kneeling cable row", tr: "Yarım diz çökerek kablo row" }, sets: "3", reps: { en: "10 / side", tr: "10 / taraf" }, tempo: { en: "2-1-2", tr: "2-1-2" }, rest: { en: "60 sec", tr: "60 sn" }, cue: { en: "Keep the ribs stacked as the elbow travels back.", tr: "Dirsek geriye giderken göğüs kafesini dengede tutun." }, tone: "sage" },
              ],
            },
            {
              id: "jul-b",
              title: { en: "Day 2 · Upper-body base", tr: "2. Gün · Üst vücut temeli" },
              focus: { en: "Push, pull and trunk", tr: "İtiş, çekiş ve gövde" },
              duration: 42,
              note: { en: "Keep shoulder effort below 3 out of 10.", tr: "Omuz zorlanmasını 10 üzerinden 3'ün altında tutun." },
              exercises: [
                { id: "split-squat-supported", name: { en: "Supported split squat", tr: "Destekli split squat" }, sets: "3", reps: { en: "8 / side", tr: "8 / taraf" }, tempo: { en: "3-0-1", tr: "3-0-1" }, rest: { en: "75 sec", tr: "75 sn" }, cue: { en: "Use the support for balance, not to pull yourself up.", tr: "Desteği yukarı çekilmek için değil, denge için kullanın." }, tone: "clay" },
                { id: "incline-press", name: { en: "Incline dumbbell press", tr: "Eğimli dambıl press" }, sets: "3", reps: { en: "10", tr: "10" }, tempo: { en: "2-0-2", tr: "2-0-2" }, rest: { en: "60 sec", tr: "60 sn" }, cue: { en: "Finish with the wrists stacked above the elbows.", tr: "Bilekler dirseklerin üzerinde hizalı şekilde bitirin." }, tone: "forest" },
              ],
            },
            {
              id: "jul-c",
              title: { en: "Day 3 · Full-body rhythm", tr: "3. Gün · Tüm vücut ritmi" },
              focus: { en: "Hinge and carry", tr: "Kalça menteşesi ve taşıma" },
              duration: 39,
              note: { en: "Move continuously without rushing transitions.", tr: "Geçişleri aceleye getirmeden sürekli hareket edin." },
              exercises: [
                { id: "glute-bridge", name: { en: "Glute bridge", tr: "Kalça köprüsü" }, sets: "3", reps: { en: "12", tr: "12" }, tempo: { en: "2-2-2", tr: "2-2-2" }, rest: { en: "45 sec", tr: "45 sn" }, cue: { en: "Pause at the top without arching the lower back.", tr: "Belinizi çukurlaştırmadan üstte bekleyin." }, tone: "sage" },
                { id: "farmer-carry", name: { en: "Farmer carry", tr: "Çift taraflı ağırlık taşıma" }, sets: "4", reps: { en: "30 m", tr: "30 m" }, tempo: { en: "Steady", tr: "Sabit" }, rest: { en: "45 sec", tr: "45 sn" }, cue: { en: "Walk quietly with tall posture and relaxed shoulders.", tr: "Dik duruş ve rahat omuzlarla sessiz adımlar atın." }, tone: "clay" },
              ],
            },
          ],
        },
        {
          id: "2026-08",
          label: { en: "August 2026", tr: "Ağustos 2026" },
          phase: { en: "Strength & capacity", tr: "Kuvvet ve kapasite" },
          range: { en: "August 3–30", tr: "3–30 Ağustos" },
          summary: {
            en: "Progress strength while building tolerance for short run intervals.",
            tr: "Kısa koşu aralıklarına tolerans geliştirirken kuvveti ilerletin.",
          },
          days: [
            {
              id: "aug-a",
              title: { en: "Day 1 · Squat strength", tr: "1. Gün · Squat kuvveti" },
              focus: { en: "Controlled loading", tr: "Kontrollü yüklenme" },
              duration: 48,
              note: { en: "Add load only if every rep keeps the same depth.", tr: "Yalnızca her tekrar aynı derinlikteyse yük ekleyin." },
              exercises: [
                { id: "goblet-squat", name: { en: "Goblet squat", tr: "Goblet squat" }, sets: "4", reps: { en: "8", tr: "8" }, tempo: { en: "3-1-1", tr: "3-1-1" }, rest: { en: "90 sec", tr: "90 sn" }, cue: { en: "Keep pressure through heel, big toe and little toe.", tr: "Topuk, başparmak ve küçük parmakta basıncı koruyun." }, tone: "forest" },
                { id: "chest-row", name: { en: "Chest-supported row", tr: "Göğüs destekli row" }, sets: "4", reps: { en: "10", tr: "10" }, tempo: { en: "2-1-2", tr: "2-1-2" }, rest: { en: "75 sec", tr: "75 sn" }, cue: { en: "Lead with the elbows and keep the neck relaxed.", tr: "Hareketi dirseklerle başlatın ve boynu rahat tutun." }, tone: "sage" },
              ],
            },
            {
              id: "aug-b",
              title: { en: "Day 2 · Hinge & press", tr: "2. Gün · Kalça menteşesi ve itiş" },
              focus: { en: "Posterior chain", tr: "Arka zincir" },
              duration: 46,
              note: { en: "Stop the set if hamstring tension changes to back strain.", tr: "Arka bacak gerilimi bel zorlanmasına dönüşürse seti bırakın." },
              exercises: [
                { id: "rdl", name: { en: "Romanian deadlift", tr: "Romanian deadlift" }, sets: "4", reps: { en: "8", tr: "8" }, tempo: { en: "3-0-1", tr: "3-0-1" }, rest: { en: "90 sec", tr: "90 sn" }, cue: { en: "Push the hips back and keep the weights close to the legs.", tr: "Ağırlıkları bacaklara yakın tutarak kalçayı geriye gönderin." }, tone: "clay" },
                { id: "half-kneeling-press", name: { en: "Half-kneeling press", tr: "Yarım diz çökerek press" }, sets: "3", reps: { en: "9 / side", tr: "9 / taraf" }, tempo: { en: "2-0-2", tr: "2-0-2" }, rest: { en: "60 sec", tr: "60 sn" }, cue: { en: "Exhale gently as the arm reaches overhead.", tr: "Kol yukarı uzanırken yumuşakça nefes verin." }, tone: "forest" },
              ],
            },
            {
              id: "aug-c",
              title: { en: "Day 3 · Run support", tr: "3. Gün · Koşu desteği" },
              focus: { en: "Single-leg control", tr: "Tek bacak kontrolü" },
              duration: 43,
              note: { en: "Finish with six rounds of one-minute easy run intervals.", tr: "Altı tur bir dakikalık rahat koşu aralığıyla bitirin." },
              exercises: [
                { id: "step-up", name: { en: "Low box step-up", tr: "Alçak kutuya step-up" }, sets: "3", reps: { en: "10 / side", tr: "10 / taraf" }, tempo: { en: "2-1-1", tr: "2-1-1" }, rest: { en: "60 sec", tr: "60 sn" }, cue: { en: "Control the lowering and keep the pelvis level.", tr: "Aşağı inişi kontrol edin ve leğen kemiğini dengede tutun." }, tone: "sage" },
                { id: "dead-bug", name: { en: "Dead bug with band", tr: "Bantla dead bug" }, sets: "3", reps: { en: "8 / side", tr: "8 / taraf" }, tempo: { en: "Slow", tr: "Yavaş" }, rest: { en: "45 sec", tr: "45 sn" }, cue: { en: "Move only as far as the ribs stay quiet.", tr: "Yalnızca göğüs kafesi sabit kaldığı mesafede hareket edin." }, tone: "clay" },
              ],
            },
          ],
        },
        {
          id: "2026-09",
          label: { en: "September 2026", tr: "Eylül 2026" },
          phase: { en: "Build & consolidate", tr: "Gelişim ve pekiştirme" },
          range: { en: "September 1–27", tr: "1–27 Eylül" },
          summary: {
            en: "Turn the new movement capacity into steady, confident work.",
            tr: "Yeni hareket kapasitesini istikrarlı ve güvenli çalışmaya dönüştürün.",
          },
          days: [
            {
              id: "sep-a",
              title: { en: "Day 1 · Unilateral strength", tr: "1. Gün · Tek taraflı kuvvet" },
              focus: { en: "Leg strength", tr: "Bacak kuvveti" },
              duration: 50,
              note: { en: "Match the working range on both sides.", tr: "Her iki tarafta aynı çalışma aralığını koruyun." },
              exercises: [
                { id: "ffe-split-squat", name: { en: "Front-foot elevated split squat", tr: "Ön ayak yükseltilmiş split squat" }, sets: "4", reps: { en: "8 / side", tr: "8 / taraf" }, tempo: { en: "3-1-1", tr: "3-1-1" }, rest: { en: "90 sec", tr: "90 sn" }, cue: { en: "Let the front knee travel while the heel stays grounded.", tr: "Topuk yerde kalırken ön dizin ilerlemesine izin verin." }, tone: "forest" },
                { id: "lat-pulldown", name: { en: "Neutral-grip lat pulldown", tr: "Nötr tutuş lat pulldown" }, sets: "4", reps: { en: "9", tr: "9" }, tempo: { en: "2-1-2", tr: "2-1-2" }, rest: { en: "75 sec", tr: "75 sn" }, cue: { en: "Bring the elbows toward the side pockets.", tr: "Dirsekleri yan ceplere doğru çekin." }, tone: "sage" },
              ],
            },
            {
              id: "sep-b",
              title: { en: "Day 2 · Hip drive", tr: "2. Gün · Kalça kuvveti" },
              focus: { en: "Strength endurance", tr: "Kuvvette dayanıklılık" },
              duration: 47,
              note: { en: "Keep one strong rep in reserve on the final set.", tr: "Son sette bir güçlü tekrarı yedekte bırakın." },
              exercises: [
                { id: "hip-thrust", name: { en: "Hip thrust", tr: "Hip thrust" }, sets: "4", reps: { en: "10", tr: "10" }, tempo: { en: "2-2-1", tr: "2-2-1" }, rest: { en: "90 sec", tr: "90 sn" }, cue: { en: "Finish with the ribs down and hips fully extended.", tr: "Göğüs kafesi aşağıda ve kalça tam açık şekilde bitirin." }, tone: "clay" },
                { id: "incline-push-up", name: { en: "Incline push-up", tr: "Yükseltide şınav" }, sets: "4", reps: { en: "8–12", tr: "8–12" }, tempo: { en: "2-0-1", tr: "2-0-1" }, rest: { en: "60 sec", tr: "60 sn" }, cue: { en: "Move the chest and hips as one unit.", tr: "Göğüs ve kalçayı tek parça halinde hareket ettirin." }, tone: "forest" },
              ],
            },
            {
              id: "sep-c",
              title: { en: "Day 3 · Athletic base", tr: "3. Gün · Atletik temel" },
              focus: { en: "Hinge and anti-rotation", tr: "Kalça menteşesi ve rotasyon kontrolü" },
              duration: 45,
              note: { en: "Use crisp technique before increasing pace.", tr: "Hızı artırmadan önce tekniği net tutun." },
              exercises: [
                { id: "kb-deadlift", name: { en: "Kettlebell deadlift", tr: "Kettlebell deadlift" }, sets: "4", reps: { en: "10", tr: "10" }, tempo: { en: "2-0-1", tr: "2-0-1" }, rest: { en: "75 sec", tr: "75 sn" }, cue: { en: "Create tension before the bell leaves the floor.", tr: "Kettlebell yerden ayrılmadan önce gövdede gerginlik oluşturun." }, tone: "sage" },
                { id: "pallof", name: { en: "Pallof press", tr: "Pallof press" }, sets: "3", reps: { en: "10 / side", tr: "10 / taraf" }, tempo: { en: "2-2-2", tr: "2-2-2" }, rest: { en: "45 sec", tr: "45 sn" }, cue: { en: "Keep the sternum and belt buckle facing forward.", tr: "Göğüs kemiği ve kemer tokasını öne dönük tutun." }, tone: "clay" },
              ],
            },
          ],
        },
      ],
    },
    nutrition: {
      eyebrow: { en: "Daily nutrition plan", tr: "Günlük beslenme planı" },
      title: { en: "Simple meals with useful context.", tr: "Faydalı bağlamla sade öğünler." },
      body: {
        en: "Meals follow the same food-and-portion structure as the client library, with calories and a clear daily total.",
        tr: "Öğünler danışan kütüphanesindeki besin ve porsiyon yapısını izler; kalori ve günlük toplam açıkça gösterilir.",
      },
      day: { en: "Monday · Training day", tr: "Pazartesi · Antrenman günü" },
      summaryTitle: { en: "Daily guide", tr: "Günlük rehber" },
      macros: [
        { value: "142 g", label: { en: "Protein", tr: "Protein" } },
        { value: "220 g", label: { en: "Carbohydrate", tr: "Karbonhidrat" } },
        { value: "64 g", label: { en: "Fat", tr: "Yağ" } },
      ],
      totalCalories: 2040,
      targetCalories: 2100,
      coachNote: {
        en: "Training is after work today. Keep the afternoon snack 60–90 minutes before the session and add water through the day.",
        tr: "Antrenman bugün işten sonra. İkindi öğününü seanstan 60–90 dakika önce tüketin ve gün boyunca su içmeyi sürdürün.",
      },
      coachNoteLabel: { en: "Coach note", tr: "Koç notu" },
      meals: [
        {
          id: "breakfast",
          time: "08:00",
          name: { en: "Greek yogurt breakfast bowl", tr: "Süzme yoğurtlu kahvaltı kasesi" },
          items: [
            { name: { en: "Greek yogurt", tr: "Süzme yoğurt" }, portion: { en: "250 g", tr: "250 g" }, calories: 190 },
            { name: { en: "Rolled oats", tr: "Yulaf ezmesi" }, portion: { en: "45 g", tr: "45 g" }, calories: 170 },
            { name: { en: "Blueberries", tr: "Yaban mersini" }, portion: { en: "100 g", tr: "100 g" }, calories: 57 },
            { name: { en: "Walnuts", tr: "Ceviz" }, portion: { en: "15 g", tr: "15 g" }, calories: 98 },
          ],
          total: 515,
        },
        {
          id: "snack",
          time: "16:30",
          name: { en: "Pre-training snack", tr: "Antrenman öncesi ara öğün" },
          items: [
            { name: { en: "Banana", tr: "Muz" }, portion: { en: "1 medium", tr: "1 orta boy" }, calories: 105 },
            { name: { en: "Kefir", tr: "Kefir" }, portion: { en: "250 ml", tr: "250 ml" }, calories: 125 },
          ],
          total: 230,
        },
        {
          id: "lunch",
          time: "12:30",
          name: { en: "Chicken, rice & salad", tr: "Tavuk, pilav ve salata" },
          items: [
            { name: { en: "Grilled chicken breast", tr: "Izgara tavuk göğsü" }, portion: { en: "170 g", tr: "170 g" }, calories: 280 },
            { name: { en: "Cooked basmati rice", tr: "Pişmiş basmati pirinci" }, portion: { en: "180 g", tr: "180 g" }, calories: 235 },
            { name: { en: "Seasonal salad + olive oil", tr: "Mevsim salatası + zeytinyağı" }, portion: { en: "1 bowl", tr: "1 kase" }, calories: 120 },
          ],
          total: 635,
        },
        {
          id: "dinner",
          time: "20:15",
          name: { en: "Salmon & roasted vegetables", tr: "Somon ve fırın sebze" },
          items: [
            { name: { en: "Baked salmon", tr: "Fırında somon" }, portion: { en: "160 g", tr: "160 g" }, calories: 330 },
            { name: { en: "Roasted potatoes", tr: "Fırın patates" }, portion: { en: "220 g", tr: "220 g" }, calories: 230 },
            { name: { en: "Roasted vegetables", tr: "Fırın sebze" }, portion: { en: "2 cups", tr: "2 su bardağı" }, calories: 100 },
          ],
          total: 660,
        },
      ],
    },
    progress: {
      eyebrow: { en: "Progress & measurements", tr: "İlerleme ve ölçümler" },
      title: { en: "Trends, not isolated numbers.", tr: "Tekil sayılar değil, gidişat." },
      body: {
        en: "Six months of consistent sample measurements make the direction visible without turning one number into a verdict.",
        tr: "Altı aylık tutarlı örnek ölçümler, tek bir sayıyı hükme dönüştürmeden gidişatı görünür kılar.",
      },
      chartLabel: { en: "Weight trend from March to August 2026", tr: "Mart–Ağustos 2026 kilo değişimi" },
      chartSummary: { en: "Weight gradually moved from 78.4 to 74.8 kilograms.", tr: "Kilo kademeli olarak 78,4'ten 74,8 kilograma ilerledi." },
      historyTitle: { en: "Measurement history", tr: "Ölçüm geçmişi" },
      weight: { en: "Weight", tr: "Kilo" },
      waist: { en: "Waist", tr: "Bel" },
      hip: { en: "Hip", tr: "Kalça" },
      chest: { en: "Chest", tr: "Göğüs" },
      bmi: { en: "BMI reference", tr: "BKİ referansı" },
      bmiValue: { en: "25.3", tr: "25,3" },
      bmiContext: { en: "Just above the reference range", tr: "Referans aralığının hemen üzerinde" },
      bmiNote: {
        en: "One planning signal among many. Training history, strength, energy and how you feel matter too.",
        tr: "Planlamadaki birçok göstergeden yalnızca biri. Antrenman geçmişi, kuvvet, enerji ve nasıl hissettiğiniz de önemlidir.",
      },
      records: [
        { date: "2026-03-02", dateLabel: { en: "Mar 2", tr: "2 Mar" }, weight: 78.4, waist: 89.0, hip: 101.5, chest: 96.0 },
        { date: "2026-04-01", dateLabel: { en: "Apr 1", tr: "1 Nis" }, weight: 77.8, waist: 88.0, hip: 101.0, chest: 96.2 },
        { date: "2026-05-04", dateLabel: { en: "May 4", tr: "4 May" }, weight: 77.1, waist: 87.0, hip: 100.4, chest: 96.5 },
        { date: "2026-06-01", dateLabel: { en: "Jun 1", tr: "1 Haz" }, weight: 76.3, waist: 85.8, hip: 99.6, chest: 96.8 },
        { date: "2026-07-06", dateLabel: { en: "Jul 6", tr: "6 Tem" }, weight: 75.5, waist: 84.6, hip: 98.9, chest: 97.2 },
        { date: "2026-08-03", dateLabel: { en: "Aug 3", tr: "3 Ağu" }, weight: 74.8, waist: 83.5, hip: 98.2, chest: 97.5 },
      ],
    },
    schedule: {
      eyebrow: { en: "Appointments & availability", tr: "Randevu ve uygunluk" },
      title: { en: "The next conversation stays clear.", tr: "Sıradaki görüşme net kalır." },
      body: {
        en: "See the booked coaching call and a read-only view of the week's sample availability.",
        tr: "Planlanmış koçluk görüşmesini ve haftanın örnek uygunluk durumunu salt okunur olarak görün.",
      },
      weekLabel: { en: "August 24–30, 2026", tr: "24–30 Ağustos 2026" },
      appointmentTitle: { en: "Monthly video check-in", tr: "Aylık görüntülü görüşme" },
      appointmentDate: { en: "Thursday, August 27", tr: "27 Ağustos Perşembe" },
      appointmentTime: { en: "6:30–7:00 PM", tr: "18.30–19.00" },
      appointmentNote: {
        en: "Agenda: running tolerance, August review and September progression.",
        tr: "Gündem: koşu toleransı, Ağustos değerlendirmesi ve Eylül ilerlemesi.",
      },
      availabilityTitle: { en: "Coach availability", tr: "Koç uygunluğu" },
      availabilityNote: {
        en: "Availability is shown for context. Changes are disabled in this public demo.",
        tr: "Uygunluk bilgi amaçlı gösterilir. Bu herkese açık demoda değişiklik yapılamaz.",
      },
      changeAction: { en: "Request a different time", tr: "Farklı bir saat talep et" },
      days: [
        { id: "mon", day: { en: "Mon", tr: "Pzt" }, date: "24", status: "unavailable", time: { en: "—", tr: "—" } },
        { id: "tue", day: { en: "Tue", tr: "Sal" }, date: "25", status: "available", time: { en: "5:30 PM", tr: "17.30" } },
        { id: "wed", day: { en: "Wed", tr: "Çar" }, date: "26", status: "available", time: { en: "7:00 PM", tr: "19.00" } },
        { id: "thu", day: { en: "Thu", tr: "Per" }, date: "27", status: "booked", time: { en: "6:30 PM", tr: "18.30" } },
        { id: "fri", day: { en: "Fri", tr: "Cum" }, date: "28", status: "unavailable", time: { en: "—", tr: "—" } },
        { id: "sat", day: { en: "Sat", tr: "Cmt" }, date: "29", status: "available", time: { en: "10:00 AM", tr: "10.00" } },
        { id: "sun", day: { en: "Sun", tr: "Paz" }, date: "30", status: "unavailable", time: { en: "—", tr: "—" } },
      ],
    },
    actionDialog: {
      eyebrow: { en: "Demo action", tr: "Demo işlemi" },
      title: { en: "This walkthrough is read only.", tr: "Bu tanıtım salt okunurdur." },
      body: {
        en: "In a real client account, this control would save or request the change. The demo never sends data or starts a download.",
        tr: "Gerçek bir danışan hesabında bu kontrol değişikliği kaydeder veya talep ederdi. Demo hiçbir veri göndermez ve indirme başlatmaz.",
      },
      assessment: { en: "Request an assessment", tr: "Değerlendirme talep et" },
    },
    closing: {
      eyebrow: { en: "Ready for your own plan?", tr: "Kendi planınıza hazır mısınız?" },
      title: { en: "Start with a personal assessment.", tr: "Kişisel değerlendirmeyle başlayın." },
      body: {
        en: "Share your goals and current context. Alişan will review the request personally and contact you within 24 hours on weekdays.",
        tr: "Hedeflerinizi ve mevcut durumunuzu paylaşın. Alişan talebinizi bizzat inceleyip hafta içi 24 saat içinde sizinle iletişime geçsin.",
      },
      action: { en: "Request an assessment", tr: "Değerlendirme talep et" },
    },
  },
  ticker: {
    label: { en: "Training priorities", tr: "Antrenman öncelikleri" },
    words: [
      { en: "Mobility", tr: "Mobilite" },
      { en: "Strength", tr: "Kuvvet" },
      { en: "Recovery", tr: "Toparlanma" },
      { en: "Physiotherapy", tr: "Fizyoterapi" },
      { en: "Nutrition", tr: "Beslenme" },
    ],
  },
  motion: {
    railLabel: { en: "Page sections", tr: "Sayfa bölümleri" },
    sectionLinks: [
      { id: "hero", label: { en: "Introduction", tr: "Giriş" } },
      { id: "about", label: { en: "About", tr: "Hakkında" } },
      { id: "why", label: { en: "The method", tr: "Yaklaşım" } },
      { id: "reviews", label: { en: "Client notes", tr: "Danışan notları" } },
      { id: "pricing", label: { en: "Pricing", tr: "Fiyatlandırma" } },
      { id: "cta", label: { en: "Next step", tr: "Sıradaki adım" } },
    ],
  },
  reviews: {
    avatar: "/media/client-avatar.svg",
    avatarAlt: { en: "", tr: "" },
    eyebrow: { en: "Notes from the process", tr: "Süreçten notlar" },
    title: { en: "Progress feels personal.", tr: "İlerleme kişisel hissettirir." },
    intro: {
      en: "These testimonials will be replaced with real client feedback before launch.",
      tr: "Bu yorumlar yayından önce gerçek danışan geri bildirimleriyle değiştirilecektir.",
    },
    ratingLabel: { en: "{rating} out of 5 stars", tr: "5 üzerinden {rating} yıldız" },
    // TODO: replace with real testimonials before launch
    items: [
      {
        name: { en: "Deniz K.", tr: "Deniz K." },
        descriptor: { en: "Office worker", tr: "Ofis çalışanı" },
        quote: {
          en: "Long workdays stopped dictating whether I could train. The plan gave me clear priorities for the time I had.",
          tr: "Uzun iş günleri artık antrenman yapıp yapamayacağımı belirlemiyordu. Plan, ayırabildiğim süre için net öncelikler sundu.",
        },
        rating: 5,
      },
      {
        name: { en: "Michael R.", tr: "Michael R." },
        descriptor: { en: "Returning after knee surgery", tr: "Diz ameliyatı sonrası antrenmana dönüş" },
        quote: {
          en: "I understood the purpose of each exercise and knew what to focus on as I returned to training.",
          tr: "Her egzersizin amacını anladım ve antrenmana dönerken neye odaklanmam gerektiğini biliyordum.",
        },
        rating: 5,
      },
      {
        name: { en: "Ece A.", tr: "Ece A." },
        descriptor: { en: "Strength-focused training", tr: "Kuvvet odaklı antrenman" },
        quote: {
          en: "The monthly updates kept the programme challenging while making the next step easy to understand.",
          tr: "Aylık güncellemeler programı zorlayıcı tutarken bir sonraki adımı anlamayı kolaylaştırdı.",
        },
        rating: 5,
      },
      {
        name: { en: "Daniel M.", tr: "Daniel M." },
        descriptor: { en: "Remote coaching", tr: "Uzaktan koçluk" },
        quote: {
          en: "Even at a distance, the process felt organised and the feedback felt personal.",
          tr: "Uzaktan çalışmamıza rağmen süreç düzenli, geri bildirimler ise kişisel hissettirdi.",
        },
        rating: 5,
      },
      {
        name: { en: "Selin T.", tr: "Selin T." },
        descriptor: { en: "Busy parent", tr: "Yoğun ebeveyn" },
        quote: {
          en: "Short sessions and clear priorities made it easier to keep training through an unpredictable week.",
          tr: "Kısa seanslar ve net öncelikler, öngörülemeyen bir haftada antrenmana devam etmeyi kolaylaştırdı.",
        },
        rating: 5,
      },
      {
        name: { en: "Alex P.", tr: "Alex P." },
        descriptor: { en: "Mobility-focused training", tr: "Mobilite odaklı antrenman" },
        quote: {
          en: "Seeing my measurements and training progress together gave me a clearer view than the scale alone.",
          tr: "Ölçümlerimi ve antrenman ilerlememi birlikte görmek, yalnızca tartıya bakmaktan daha net bir tablo sundu.",
        },
        rating: 5,
      },
    ],
  },
  pricing: {
    eyebrow: { en: "Coaching plans", tr: "Koçluk planları" },
    title: { en: "Choose your rhythm.", tr: "Ritminizi seçin." },
    intro: {
      en: "The same personal coaching standard, with a commitment that suits your next chapter.",
      tr: "Aynı kişisel koçluk standardı; sıradaki döneminize uygun taahhüt seçeneğiyle.",
    },
    pageTitle: { en: "Invest in a stronger next season.", tr: "Daha güçlü bir döneme yatırım yapın." },
    pageIntro: {
      en: "Two clear options. Both include the programme, support and feedback loop needed to keep moving forward.",
      tr: "İki net seçenek. Her ikisi de ilerlemek için gereken programı, desteği ve geri bildirim döngüsünü içerir.",
    },
    mostPopular: { en: "Most popular", tr: "En çok tercih edilen" },
    contactForPricing: { en: "Contact for pricing", tr: "Fiyat için iletişime geçin" },
    gettingStartedNote: {
      en: "Choose the option that suits your timeline, then request an assessment to get started.",
      tr: "Sürenize uygun seçeneği belirleyin, ardından başlamak için değerlendirme talep edin.",
    },
    anchorLabel: { en: "Three monthly payments", tr: "Üç aylık ayrı ödeme" },
    saveLabel: { en: "Save {percent}%", tr: "%{percent} tasarruf" },
    equivalentLabel: { en: "Equivalent to {price} / month", tr: "Aylık karşılığı {price}" },
    periodLabels: {
      month: { en: "month", tr: "ay" },
      threeMonths: { en: "3 months", tr: "3 ay" },
    },
    featureListLabel: { en: "Plan includes", tr: "Plana dahil" },
    sharedFeatures: [
      { en: "Fully personalised monthly training programme", tr: "Tamamen kişiye özel aylık antrenman programı" },
      { en: "Professional nutrition and supplement plan", tr: "Profesyonel beslenme ve takviye planı" },
      { en: "Direct weekday access — replies within 24 hours", tr: "Hafta içi doğrudan erişim — 24 saat içinde yanıt" },
      { en: "Full access to the client app", tr: "Danışan uygulamasına tam erişim" },
      { en: "Monthly progress review and programme update", tr: "Aylık ilerleme değerlendirmesi ve program güncellemesi" },
    ],
    viewAllCta: { en: "Compare plans", tr: "Planları karşılaştır" },
    plans: [
      {
        id: "monthly",
        name: { en: "Monthly", tr: "Aylık" },
        description: {
          en: "A focused month-to-month coaching partnership.",
          tr: "Aydan aya ilerleyen odaklı koçluk ortaklığı.",
        },
        recommended: false,
        price: {
          en: { amount: 120, currency: "CAD", period: "month" },
          tr: { amount: 120, currency: "CAD", period: "month" },
        },
        monthlyEquivalent: {
          en: { amount: 120, currency: "CAD" },
          tr: { amount: 120, currency: "CAD" },
        },
        cta: { en: "Request an assessment", tr: "Değerlendirme talep et" },
      },
      {
        id: "quarterly",
        name: { en: "Quarterly", tr: "Üç Aylık" },
        description: {
          en: "A full training block with space to adapt and compound progress.",
          tr: "Uyarlama ve ilerlemeyi büyütme alanı sunan tam bir antrenman dönemi.",
        },
        recommended: true,
        price: {
          en: { amount: 300, currency: "CAD", period: "threeMonths" },
          tr: { amount: 300, currency: "CAD", period: "threeMonths" },
        },
        monthlyEquivalent: {
          en: { amount: 100, currency: "CAD" },
          tr: { amount: 100, currency: "CAD" },
        },
        cta: { en: "Start a quarterly plan", tr: "Üç aylık plana başla" },
      },
    ],
    faqEyebrow: { en: "Before you begin", tr: "Başlamadan önce" },
    faqTitle: { en: "Straight answers.", tr: "Net yanıtlar." },
    faqIntro: {
      en: "What to know before choosing a plan.",
      tr: "Bir plan seçmeden önce bilmeniz gerekenler.",
    },
    faqs: [
      {
        question: { en: "Is this coaching fully online?", tr: "Bu koçluk tamamen çevrim içi mi?" },
        answer: {
          en: "Yes. Your programme, reviews and direct support are delivered through the client app, video and messaging.",
          tr: "Evet. Programınız, değerlendirmeleriniz ve doğrudan desteğiniz danışan uygulaması, video ve mesajlaşma üzerinden sunulur.",
        },
      },
      {
        question: { en: "Do I need gym equipment?", tr: "Spor salonu ekipmanına ihtiyacım var mı?" },
        answer: {
          en: "No fixed setup is required. Your plan is built around the equipment and space you can use consistently.",
          tr: "Sabit bir kurulum gerekmez. Planınız düzenli kullanabildiğiniz ekipman ve alana göre hazırlanır.",
        },
      },
      {
        question: { en: "Can the plan account for pain or an old injury?", tr: "Plan ağrıyı veya eski bir sakatlığı dikkate alabilir mi?" },
        answer: {
          en: "Your history and current capacity are considered when the programme is written. Online coaching does not replace an in-person medical assessment when one is needed.",
          tr: "Program hazırlanırken geçmişiniz ve mevcut kapasiteniz dikkate alınır. Çevrim içi koçluk, gerektiğinde yüz yüze tıbbi değerlendirmenin yerini tutmaz.",
        },
      },
      {
        question: { en: "How often is my programme updated?", tr: "Programım ne sıklıkta güncellenir?" },
        answer: {
          en: "Your progress is reviewed monthly and the programme is updated for the next training period.",
          tr: "İlerlemeniz her ay değerlendirilir ve programınız bir sonraki antrenman dönemi için güncellenir.",
        },
      },
      {
        question: { en: "What happens after I request an assessment?", tr: "Değerlendirme talebinden sonra ne olur?" },
        answer: {
          en: "Request an assessment and share your goals and training history. Alişan will contact you to discuss whether the service is a good fit.",
          tr: "Değerlendirme talep ederek hedeflerinizi ve antrenman geçmişinizi paylaşın. Alişan, hizmetin size uygun olup olmadığını görüşmek için sizinle iletişime geçer.",
        },
      },
      {
        question: { en: "How quickly will I receive a reply?", tr: "Ne kadar sürede yanıt alırım?" },
        answer: {
          en: "Alişan replies within 24 hours on weekdays.",
          tr: "Alişan hafta içi 24 saat içinde yanıt verir.",
        },
      },
    ],
  },
  assessment: {
    metaTitle: {
      en: "Request an assessment — Train with Alisan",
      tr: "Değerlendirme talep edin — Train with Alisan",
    },
    metaDescription: {
      en: "Tell Alişan about your goals, training background and current needs.",
      tr: "Hedeflerinizi, antrenman geçmişinizi ve mevcut ihtiyaçlarınızı Alişan'la paylaşın.",
    },
    eyebrow: { en: "Your starting point", tr: "Başlangıç noktanız" },
    title: {
      en: "A thoughtful plan starts with the full picture.",
      tr: "Özenli bir plan, bütünü görmekle başlar.",
    },
    intro: {
      en: "Share the context Alişan needs to understand where you are, what you want to change and how training can fit your life.",
      tr: "Alişan'ın bulunduğunuz noktayı, değiştirmek istediklerinizi ve antrenmanın hayatınıza nasıl uyabileceğini anlaması için gereken bilgileri paylaşın.",
    },
    formLabel: { en: "Assessment request form", tr: "Değerlendirme talep formu" },
    progressLabel: { en: "Form progress", tr: "Form ilerlemesi" },
    progressTemplate: {
      en: "Step {current} of {total}",
      tr: "{total} adımın {current}. adımı",
    },
    requiredNote: {
      en: "Fields marked with * are required.",
      tr: "* ile işaretli alanlar zorunludur.",
    },
    honeypotLabel: { en: "Website", tr: "Web sitesi" },
    optional: { en: "Optional", tr: "İsteğe bağlı" },
    steps: [
      {
        short: { en: "Contact", tr: "İletişim" },
        title: { en: "How can Alişan reach you?", tr: "Alişan size nasıl ulaşabilir?" },
        intro: {
          en: "Start with the essentials. Your details are used only to respond to this request.",
          tr: "Temel bilgilerle başlayın. Bilgileriniz yalnızca bu talebe yanıt vermek için kullanılır.",
        },
      },
      {
        short: { en: "Body & goal", tr: "Beden ve hedef" },
        title: { en: "What are you working toward?", tr: "Neye doğru ilerliyorsunuz?" },
        intro: {
          en: "A little context helps shape a realistic first conversation.",
          tr: "Biraz bağlam, gerçekçi bir ilk görüşme hazırlamaya yardımcı olur.",
        },
      },
      {
        short: { en: "Training", tr: "Antrenman" },
        title: { en: "What does training look like today?", tr: "Bugünkü antrenman düzeniniz nasıl?" },
        intro: {
          en: "There is no ideal answer—only the setup you can use consistently.",
          tr: "İdeal bir yanıt yok; önemli olan sürdürülebilir biçimde kullanabildiğiniz düzendir.",
        },
      },
      {
        short: { en: "Health", tr: "Sağlık" },
        title: { en: "What should the programme respect?", tr: "Program neleri dikkate almalı?" },
        intro: {
          en: "Share only what feels relevant to planning safe, appropriate training.",
          tr: "Güvenli ve uygun bir antrenman planı için yalnızca ilgili gördüğünüz bilgileri paylaşın.",
        },
      },
      {
        short: { en: "Review", tr: "Kontrol" },
        title: { en: "Review and send your request.", tr: "Talebinizi kontrol edip gönderin." },
        intro: {
          en: "Check the summary, add anything else Alişan should know, then send it securely.",
          tr: "Özeti kontrol edin, Alişan'ın bilmesi gereken başka bir şey varsa ekleyin ve güvenle gönderin.",
        },
      },
    ],
    plan: {
      confirmed: { en: "Plan selected", tr: "Plan seçildi" },
      change: { en: "Change", tr: "Değiştir" },
      done: { en: "Done", tr: "Tamam" },
      choose: { en: "Choose a plan", tr: "Plan seçin" },
      none: { en: "I am not sure yet", tr: "Henüz emin değilim" },
      noneShort: { en: "No plan selected", tr: "Plan seçilmedi" },
    },
    fields: {
      fullName: { label: { en: "Full name", tr: "Ad soyad" }, placeholder: { en: "Your full name", tr: "Adınız ve soyadınız" } },
      email: { label: { en: "Email", tr: "E-posta" }, placeholder: { en: "you@example.com", tr: "siz@ornek.com" } },
      phone: { label: { en: "Phone", tr: "Telefon" }, placeholder: { en: "+1 416 555 0123", tr: "+90 555 555 55 55" } },
      country: { label: { en: "Country", tr: "Ülke" }, placeholder: { en: "Canada", tr: "Türkiye" } },
      city: { label: { en: "City", tr: "Şehir" }, placeholder: { en: "Toronto", tr: "İstanbul" } },
      birthYear: { label: { en: "Birth year", tr: "Doğum yılı" }, placeholder: { en: "1990", tr: "1990" } },
      sex: { label: { en: "Sex", tr: "Cinsiyet" } },
      height: { label: { en: "Height (cm)", tr: "Boy (cm)" }, placeholder: { en: "175", tr: "175" } },
      weight: { label: { en: "Weight (kg)", tr: "Kilo (kg)" }, placeholder: { en: "72", tr: "72" } },
      primaryGoal: { label: { en: "Primary goal", tr: "Ana hedef" }, placeholder: { en: "What would meaningful progress look like for you?", tr: "Sizin için anlamlı ilerleme nasıl görünürdü?" } },
      experience: { label: { en: "Training experience", tr: "Antrenman deneyimi" } },
      days: { label: { en: "Preferred days per week", tr: "Haftada tercih edilen gün sayısı" }, placeholder: { en: "Choose", tr: "Seçin" } },
      equipment: { label: { en: "Equipment access", tr: "Ekipman erişimi" } },
      injury: { label: { en: "Injury or pain history", tr: "Sakatlık veya ağrı geçmişi" }, placeholder: { en: "Past injuries, current pain, surgery or movement concerns…", tr: "Geçmiş sakatlıklar, mevcut ağrı, ameliyat veya hareketle ilgili endişeler…" } },
      medical: { label: { en: "Relevant medical notes", tr: "İlgili tıbbi notlar" }, placeholder: { en: "Conditions, medication or guidance from a clinician that may affect training…", tr: "Antrenmanı etkileyebilecek durumlar, ilaçlar veya bir uzmanın yönlendirmeleri…" } },
      message: { label: { en: "Anything else?", tr: "Eklemek istediğiniz başka bir şey var mı?" }, placeholder: { en: "Questions, schedule considerations or context you would like Alişan to know…", tr: "Sorularınız, programla ilgili koşullarınız veya Alişan'ın bilmesini istediğiniz diğer bilgiler…" } },
    },
    options: {
      choose: { en: "Choose an option", tr: "Bir seçenek belirleyin" },
      sex: [
        { value: "female", label: { en: "Female", tr: "Kadın" } },
        { value: "male", label: { en: "Male", tr: "Erkek" } },
        { value: "non-binary", label: { en: "Non-binary", tr: "İkili olmayan" } },
        { value: "prefer-not-to-say", label: { en: "Prefer not to say", tr: "Belirtmek istemiyorum" } },
      ],
      experience: [
        { value: "none", label: { en: "No consistent experience yet", tr: "Henüz düzenli deneyimim yok" } },
        { value: "under-1y", label: { en: "Under 1 year", tr: "1 yıldan az" } },
        { value: "1-3y", label: { en: "1–3 years", tr: "1–3 yıl" } },
        { value: "3y-plus", label: { en: "3+ years", tr: "3+ yıl" } },
      ],
      equipment: [
        { value: "full-gym", label: { en: "Full gym", tr: "Tam donanımlı spor salonu" } },
        { value: "home-basic", label: { en: "Basic home equipment", tr: "Temel ev ekipmanları" } },
        { value: "none", label: { en: "No equipment", tr: "Ekipman yok" } },
        { value: "other", label: { en: "Another setup", tr: "Başka bir düzen" } },
      ],
    },
    healthPrivacy: {
      en: "This information is used only to prepare an appropriate programme and is seen only by Alişan.",
      tr: "Bu bilgiler yalnızca uygun bir program hazırlamak için kullanılır ve sadece Alişan tarafından görülür.",
    },
    review: {
      contact: { en: "Contact", tr: "İletişim" },
      profile: { en: "Body & goal", tr: "Beden ve hedef" },
      training: { en: "Training", tr: "Antrenman" },
      health: { en: "Health context", tr: "Sağlık bağlamı" },
      plan: { en: "Plan", tr: "Plan" },
      notProvided: { en: "Not provided", tr: "Belirtilmedi" },
    },
    consent: {
      en: "I consent to Alişan using the information in this request to contact me and assess whether the coaching service is appropriate for me.",
      tr: "Alişan'ın bu talepteki bilgileri benimle iletişime geçmek ve koçluk hizmetinin bana uygun olup olmadığını değerlendirmek için kullanmasına onay veriyorum.",
    },
    actions: {
      back: { en: "Back", tr: "Geri" },
      next: { en: "Continue", tr: "Devam et" },
      submit: { en: "Send assessment request", tr: "Değerlendirme talebini gönder" },
      submitting: { en: "Sending securely…", tr: "Güvenle gönderiliyor…" },
      edit: { en: "Edit", tr: "Düzenle" },
      editSection: { en: "Edit {section}", tr: "{section} bölümünü düzenle" },
    },
    validation: {
      requiredName: { en: "Enter your full name.", tr: "Adınızı ve soyadınızı girin." },
      invalidEmail: { en: "Enter a valid email address.", tr: "Geçerli bir e-posta adresi girin." },
      requiredGoal: { en: "Tell us your primary goal.", tr: "Ana hedefinizi paylaşın." },
      requiredConsent: { en: "Consent is required before sending.", tr: "Göndermeden önce onay vermeniz gerekir." },
      invalidValue: { en: "Check this value and try again.", tr: "Bu değeri kontrol edip yeniden deneyin." },
      generic: { en: "We could not send your request. Your answers are still here—please try again.", tr: "Talebiniz gönderilemedi. Yanıtlarınız korunuyor; lütfen yeniden deneyin." },
    },
    success: {
      eyebrow: { en: "Request received", tr: "Talep alındı" },
      title: { en: "Thank you. Alişan will take it from here.", tr: "Teşekkürler. Bundan sonrasını Alişan üstlenecek." },
      body: { en: "Alişan will personally review your request and contact you by email or phone within 24 hours on weekdays.", tr: "Alişan talebinizi bizzat inceleyecek ve hafta içi 24 saat içinde e-posta veya telefonla sizinle iletişime geçecek." },
      nextTitle: { en: "What happens next", tr: "Bundan sonra ne olur" },
      nextSteps: [
        { en: "Your goals and training context are reviewed.", tr: "Hedefleriniz ve antrenman bağlamınız incelenir." },
        { en: "Alişan contacts you to discuss fit and next steps.", tr: "Alişan uygunluğu ve sonraki adımları görüşmek için sizinle iletişime geçer." },
        { en: "If you decide to continue, account setup is handled together.", tr: "Devam etmeye karar verirseniz hesap kurulumu birlikte tamamlanır." },
      ],
      homeLink: { en: "Back to the main page", tr: "Ana sayfaya dön" },
    },
  },
  cta: {
    eyebrow: { en: "Your next chapter", tr: "Sıradaki döneminiz" },
    title: { en: "Train for the life you actually live.", tr: "Gerçekten yaşadığınız hayat için antrenman yapın." },
    body: {
      en: "Start with a plan that understands where you are and builds toward where you want to be.",
      tr: "Bulunduğunuz yeri anlayan ve ulaşmak istediğiniz yere doğru ilerleyen bir planla başlayın.",
    },
    button: { en: "See coaching plans", tr: "Koçluk planlarını görün" },
  },
  footer: {
    blurb: {
      en: "Personal training and physiotherapy insight for stronger, more capable movement.",
      tr: "Daha güçlü ve yetkin hareket için kişisel antrenman ve fizyoterapi bakışı.",
    },
    navLabel: { en: "Footer navigation", tr: "Alt bilgi navigasyonu" },
    links: [
      { href: "/", label: { en: "Main page", tr: "Ana sayfa" } },
      { href: "/#about", label: { en: "About", tr: "Hakkında" } },
      { href: "/#why", label: { en: "The method", tr: "Yaklaşım" } },
      { href: "/demo", label: { en: "Demo", tr: "Demo" } },
      { href: "/#reviews", label: { en: "Client notes", tr: "Danışan notları" } },
      { href: "/pricing", label: { en: "Pricing", tr: "Fiyatlandırma" }, prominent: true },
    ],
    socialTitle: { en: "Connect", tr: "Bağlantı" },
    socialState: { en: "Channels coming soon", tr: "Kanallar yakında" },
    socialNames: [
      { en: "Instagram", tr: "Instagram" },
      { en: "YouTube", tr: "YouTube" },
      { en: "WhatsApp", tr: "WhatsApp" },
    ],
    copyright: {
      en: "© {year} {brand}. All rights reserved.",
      tr: "© {year} {brand}. Tüm hakları saklıdır.",
    },
    serviceNote: {
      en: "Working with clients in Türkiye and Canada, in Turkish and English.",
      tr: "Türkiye ve Kanada'daki danışanlarla Türkçe ve İngilizce çalışır.",
    },
  },
} as const;
