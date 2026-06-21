import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuthStore } from '../../store/authStore'
import { CheckCircle2, Loader2, Utensils, Dumbbell, ShoppingCart } from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────
const uid = () => crypto.randomUUID()
type Status = 'idle' | 'loading' | 'done' | 'error'

// ─── Supplement strings ────────────────────────────────────────────────────
const BS = '💊 МултиВитамини + МултиМин. 1 доза\n🥛 WHEY Изолат 1 доза\n🔷 Цинк 30мг'
const LS = '⚡ Витарго + Електролити 80гр\n☀️ Витамин Д3 3000 IU\n💪 Глутамин 10гр+5гр\n🏋️ Креатин 5гр+5гр'
const DS = '🌙 Магнезиум 300мг'
const sup = (s: string) => `\n\n💊 Supplements:\n${s}`

// ─── Nutrition plan ────────────────────────────────────────────────────────
function buildNutritionPlan(userId: string) {
  return {
    name: 'Findzzer Plan',
    description: 'Weekly nutrition plan',
    createdBy: userId,
    repeatCycle: true,
    weeks: [
      {
        id: uid(),
        weekNumber: 1,
        days: [
          // ── Monday ──────────────────────────────────────────────────────
          {
            id: uid(), name: 'Monday', order: 1,
            meals: [
              { id: uid(), name: 'Чиа пудинг', time: '01:00 – 12:00', foods: [], instructions: sup(BS) },
              { id: uid(), name: 'Мисиркин стек со зелена салата', time: '12:00 – 17:00', foods: [], instructions: sup(LS) },
              { id: uid(), name: 'Протеин + Јаболко', foods: [] },
              {
                id: uid(), name: 'Кус-кус салата со туна', time: 'After 17:00', foods: [],
                ingredients: '80гр кус-кус\n200гр туна конзерва\nдомат\n½ краставица\n50гр пченка',
                instructions: 'Полиј го кус-кусот со топла вода и остави да одстои. Кога ќе се олади додај исецкан домат, краставица и пченка.' + sup(DS),
              },
            ],
          },
          // ── Tuesday ─────────────────────────────────────────────────────
          {
            id: uid(), name: 'Tuesday', order: 2,
            meals: [
              { id: uid(), name: 'Омлет', time: '01:00 – 12:00', foods: [], instructions: sup(BS) },
              { id: uid(), name: 'Пилешко бурито', time: '12:00 – 17:00', foods: [], instructions: sup(LS) },
              { id: uid(), name: '1 доза протеин', foods: [] },
              {
                id: uid(), name: 'Зелена салата со туна', time: 'After 17:00', foods: [],
                ingredients: '1 голема конзерва туна\nмарула\nрукола\nбебе спанаќ\nсемки од тиква\nлимон\nсол',
                instructions: sup(DS),
              },
            ],
          },
          // ── Wednesday ───────────────────────────────────────────────────
          {
            id: uid(), name: 'Wednesday', order: 3,
            meals: [
              { id: uid(), name: 'Протеински шејк', time: '01:00 – 12:00', foods: [], instructions: sup(BS) },
              { id: uid(), name: 'Ослиќ со печен компир', time: '12:00 – 17:00', foods: [], instructions: sup(LS) },
              { id: uid(), name: 'Протеин + Јаболко + Сливи', foods: [] },
              {
                id: uid(), name: 'Бурито со туна', time: 'After 17:00', foods: [],
                ingredients: '1 тортиља од хељда\n200гр туна\nкромид\nавокадо\nдомат',
                instructions: 'Измешај туна, ситно сецкан кромид, домат и авокадо со сол и лимон. Стави врз тортиља и завиткај.' + sup(DS),
              },
            ],
          },
          // ── Thursday ────────────────────────────────────────────────────
          {
            id: uid(), name: 'Thursday', order: 4,
            meals: [
              { id: uid(), name: 'Протеински кришки', time: '01:00 – 12:00', foods: [], instructions: sup(BS) },
              { id: uid(), name: 'Мелено јунешко со печен компир', time: '12:00 – 17:00', foods: [], instructions: sup(LS) },
              { id: uid(), name: '1½ доза протеин + Јаболко', foods: [] },
              {
                id: uid(), name: 'Варена леќа со печурки', time: 'After 17:00', foods: [],
                ingredients: '100гр леќа\n½ кромид\n1 чешне лук\n200гр печурки (шампињони)\nмагдонос\nкопар\nсол\nпипер',
                instructions: 'Свари ја леќата 15-20 мин. Пржи кромид, додај печурки, лук и зачини. Измешај сè.' + sup(DS),
              },
            ],
          },
          // ── Friday ──────────────────────────────────────────────────────
          {
            id: uid(), name: 'Friday', order: 5,
            meals: [
              { id: uid(), name: 'Овесна каша со овошје', time: '01:00 – 12:00', foods: [], instructions: sup(BS) },
              { id: uid(), name: 'Мисиркин стек со ориз', time: '12:00 – 17:00', foods: [], instructions: sup(LS) },
              { id: uid(), name: 'Протеин + Урми', foods: [] },
              {
                id: uid(), name: 'Зелена салата со јајца', time: 'After 17:00', foods: [],
                ingredients: 'Зелена салата по избор (марула, рукола, зелка, бебе спанаќ)\n4 варени јајца\n50гр пченка\nлажичка ленено семе\nлажичка сончоглед\nзачини по избор',
                instructions: sup(DS),
              },
            ],
          },
          // ── Saturday ────────────────────────────────────────────────────
          {
            id: uid(), name: 'Saturday', order: 6,
            meals: [
              {
                id: uid(), name: 'Овесна какао каша', time: '01:00 – 12:00', foods: [],
                ingredients: '250мл вода\n70гр овес\n1 лажичка какао\n½ банана\n1½ доза протеин',
                instructions: 'Свари овесот во вода и додај какао. Кога ќе се впие водата, сервирај. Протеинот разреди со малце вода до крем, прелиј и додај банана на кругови.' + sup(BS),
              },
              { id: uid(), name: 'Печени мисиркини батаци со пире и салата', time: '12:00 – 17:00', foods: [], instructions: sup(LS) },
              { id: uid(), name: 'Протеин + Јаболко', foods: [] },
              { id: uid(), name: 'Бурито со урда', time: 'After 17:00', foods: [], instructions: sup(DS) },
            ],
          },
          // ── Sunday ──────────────────────────────────────────────────────
          {
            id: uid(), name: 'Sunday', order: 7,
            meals: [
              {
                id: uid(), name: 'Белки и Rice Cakes со Хумус', time: '01:00 – 12:00', foods: [],
                ingredients: '6 варени белки + 3 жолчки\n5 тркала rice cakes\nнамаз од хумус\nдомат',
                instructions: 'Зачини белките со сол и оригано. Премачкај ги rice cakes со хумус. Послужете со домат.' + sup(BS),
              },
              {
                id: uid(), name: 'Морски плодови со пржен зеленчук', time: '12:00 – 17:00', foods: [],
                ingredients: '200гр морски плодови по избор\nтиквичка\nпиперка\nпечурки\nзачин по избор',
                instructions: 'Пржи зеленчукот (тиквичка, пиперка, печурки) со зачин по избор. Додај морски плодови.' + sup(LS),
              },
              { id: uid(), name: 'Протеин + Јаболко (2 дози)', foods: [] },
              {
                id: uid(), name: 'Салата од киноа со грав', time: 'After 17:00', foods: [],
                ingredients: '70гр варена киноа\n40гр варен црвен грав\n2 млад кромид, ситно сецкан\n1 домат, ситно сецкан\n1 рака бебе спанаќ\n1 лажица магдонос\n2 лажици свежо нане\n2 лажички маслиново масло\n¼ лимон, исцеден\nмешавина од суви зачини\nсол и бибер по вкус',
                instructions: 'Во поголем сад измешајте ги киноата, гравот, младиот кромид и доматите (претходно процедени). Потоа додадете магдонос, нане и бебе спанаќ. Во чаша измешајте маслиново масло и сок од лимон, додадете сол и бибер, па прелијте ја салатата со преливот.' + sup(DS),
              },
            ],
          },
        ],
      },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

// ─── Workout plan ──────────────────────────────────────────────────────────
const ex = (name: string, order: number, reps: number[]) => ({
  id: uid(), exerciseId: uid(),
  exerciseName: name,
  order,
  sets: reps.map((r) => ({ reps: r })),
})

const walk = (order: number) => ({
  id: uid(), exerciseId: uid(),
  exerciseName: 'Incline Walk',
  order,
  sets: [{ duration: 20 }],
  notes: '20 min incline treadmill',
})

function buildWorkoutPlan(userId: string) {
  return {
    name: 'Findzzer Workout Plan',
    description: 'Arms · Back · Chest+Core · Legs · Shoulders+Core · Rest · Rest',
    createdBy: userId,
    repeatCycle: true,
    weeks: [
      {
        id: uid(),
        weekNumber: 1,
        days: [
          // ── Monday – Arms ────────────────────────────────────────────────
          {
            id: uid(), name: 'Monday – Arms', order: 1, isRestDay: false,
            exercises: [
              ex('Overhead Triceps Extension', 1, [20, 15, 12, 10]),
              ex('Single-Arm DB Overhead Triceps Extension', 2, [20, 10, 12, 12]),
              ex('Cable Overhead Triceps Extension', 3, [20, 12, 12, 12]),
              ex('EZ-Bar Biceps Curl', 4, [20, 15, 12, 10]),
              ex('Preacher Curl', 5, [15, 12, 12]),
              ex('Hammer Curl', 6, [10, 12, 10]),
              walk(7),
            ],
          },
          // ── Tuesday – Back ───────────────────────────────────────────────
          {
            id: uid(), name: 'Tuesday – Back', order: 2, isRestDay: false,
            exercises: [
              ex('Wide-Grip Lat Pulldown', 1, [20, 15, 12, 10]),
              ex('Single-Arm Cable Lat Pulldown', 2, [12, 12, 12]),
              ex('Bent-Over Barbell Row', 3, [10, 12, 10]),
              ex('Seated Cable Row', 4, [10, 10, 8, 8]),
              ex('Back Extension', 5, [15, 15, 12]),
              ex('Hyperextension', 6, [15, 12, 10]),
              walk(7),
            ],
          },
          // ── Wednesday – Chest + Core ─────────────────────────────────────
          {
            id: uid(), name: 'Wednesday – Chest + Core', order: 3, isRestDay: false,
            exercises: [
              ex('Incline Bench Press', 1, [20, 15, 10, 8]),
              ex('Flat Barbell Bench Press', 2, [15, 10, 10, 8]),
              ex('Chest Press Machine', 3, [10, 8, 8]),
              ex('Chest Fly', 4, [15, 15, 12]),
              {
                id: uid(), exerciseId: uid(), exerciseName: 'Push-Ups', order: 5,
                sets: [{}, {}, {}],
                notes: 'Bodyweight – max reps per set',
              },
              ex('Hanging Leg Raises', 6, [20, 20, 20]),
              ex('Weighted Crunches', 7, [20, 20, 20]),
              walk(8),
            ],
          },
          // ── Thursday – Legs (no walk) ────────────────────────────────────
          {
            id: uid(), name: 'Thursday – Legs', order: 4, isRestDay: false,
            exercises: [
              ex('Barbell Squat', 1, [20, 15, 12, 10]),
              ex('Leg Press', 2, [12, 12, 10, 8]),
              ex('Leg Extension', 3, [20, 8, 10, 8]),
              ex('Leg Curl', 4, [15, 12, 12, 12]),
              ex('Standing Calf Raise', 5, [15, 15, 15]),
              ex('Seated Calf Raise', 6, [20, 15, 12, 8]),
            ],
          },
          // ── Friday – Shoulders + Core ────────────────────────────────────
          {
            id: uid(), name: 'Friday – Shoulders + Core', order: 5, isRestDay: false,
            exercises: [
              ex('Standing Barbell Shoulder Press', 1, [20, 15, 12, 8]),
              ex('Shoulder Press Machine', 2, [12, 10, 10, 8]),
              ex('Dumbbell Lateral Raise', 3, [20, 10, 12, 12]),
              ex('Cable Front Raise', 4, [20, 8, 12, 10]),
              ex('Rear Delt Cable Fly', 5, [15, 12, 12, 10]),
              ex('Decline Crunch', 6, [20, 20, 15, 15]),
              ex('Abdominal Exercise', 7, [20, 15, 15]),
              walk(8),
            ],
          },
          // ── Saturday – Rest + Walk ───────────────────────────────────────
          {
            id: uid(), name: 'Saturday – Rest', order: 6, isRestDay: true,
            exercises: [walk(1)],
          },
          // ── Sunday – Rest + Walk ─────────────────────────────────────────
          {
            id: uid(), name: 'Sunday – Rest', order: 7, isRestDay: true,
            exercises: [walk(1)],
          },
        ],
      },
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

// ─── Shopping list ─────────────────────────────────────────────────────────
const cat = (emoji: string, name: string, items: [string, string][]) => ({
  id: uid(), emoji, name,
  items: items.map(([n, amount]) => ({ id: uid(), name: n, amount })),
})

function buildShoppingList(userId: string) {
  return {
    name: 'Findzzer Shopping List',
    description: 'Weekly groceries for the Findzzer nutrition plan',
    createdBy: userId,
    categories: [
      cat('🥩', 'Месо', [
        ['Мисиркин стек', '600гр'],
        ['Пилешко месо', '400гр'],
        ['Мелено месо (јунешко/пилешко)', '300гр'],
      ]),
      cat('🐟', 'Риба', [
        ['Туна конзерва', '3–4 конзерви'],
        ['Морски плодови по избор', '200гр'],
        ['Лосос / риба по избор', '200–300гр'],
      ]),
      cat('🥛', 'Млечни', [
        ['Јајца', '20 јајца (2 кутии)'],
        ['Грчки јогурт (0% или без лактоза)', '500–750гр'],
        ['Растително млеко (бадем или по избор)', '1 литар'],
      ]),
      cat('🌾', 'Јаглехидрати', [
        ['Овесни снегулки', '500гр'],
        ['Кус-кус', '200гр'],
        ['Ориз', '500гр'],
        ['Компир', '500гр'],
        ['Интегрална тортиља', '1 пакет'],
        ['Грав (конзерва)', '1 конзерва'],
        ['Rice cakes (оризови галети)', '1 пакет'],
        ['Протеински леб', '1 шифа'],
      ]),
      cat('🍎', 'Овошје', [
        ['Јаболко', '7 парчиња'],
        ['Банана', '3–4 парчиња'],
        ['Замрзнато мешано овошје (малина, аронија)', '500гр'],
        ['Бобинки (малина, боровница)', '200гр'],
      ]),
      cat('🥦', 'Зеленчук', [
        ['Краставица', '3–4 парчиња'],
        ['Домат', '4–5 парчиња'],
        ['Пиперка', '3–4 парчиња'],
        ['Печурки', '200гр'],
        ['Зелка', '¼ глава'],
        ['Марула (зелена салата)', '2 шалти'],
        ['Пченка (конзерва)', '1 конзерва'],
        ['Авокадо', '2 парчиња'],
        ['Магдонос / рукола', '1 врска'],
        ['Спанаќ', '200гр'],
        ['Брокула', '200гр'],
        ['Кромид', '1 глава'],
        ['Лук', '1 глава'],
      ]),
      cat('💊', 'Суплементи', [
        ['Протеин WHEY Изолат (~10+ дози неделно)', '1 пакет'],
        ['Мултивитамини и мулитминерали', 'По потреба'],
        ['Цинк 30мг', 'По потреба'],
        ['Витамин Д3 3000 IU', 'По потреба'],
        ['Магнезиум 300мг', 'По потреба'],
        ['Витарго со електролити', '80гр × тренинг'],
      ]),
      cat('🧂', 'Основни', [
        ['Чиа семе', '200гр'],
        ['Мед', '1 тегла'],
        ['Маслиново масло', '1 шише'],
        ['Сол, бибер, зачини', 'По потреба'],
        ['Хумус', '1 тегла'],
        ['Какао прашок (несладено)', '1 пакет'],
        ['Кикирики путер / путер од јатки', '1 тегла'],
      ]),
      cat('🥜', 'Орев / Семки', [
        ['Ореви / бадеми', '200гр'],
        ['Семки (сончоглед, тиква, лен)', '200гр'],
      ]),
      cat('🌿', 'Зачин', [
        ['Цимет', '1 пакет'],
        ['Сусам', '1 пакет'],
        ['Соја сос', '1 шише'],
        ['Сенф', '1 тегла'],
        ['Пате од маслинки', '1 тегла'],
      ]),
    ],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

// ─── Reusable seed card ────────────────────────────────────────────────────
function SeedCard({
  icon, iconBg, iconColor, title, subtitle, bullets, buttonLabel, buttonBg, buttonHover,
  status, planId, error, onSeed,
}: {
  icon: React.ReactNode
  iconBg: string; iconColor: string
  title: string; subtitle: string
  bullets: string[]
  buttonLabel: string; buttonBg: string; buttonHover: string
  status: Status; planId: string | null; error: string | null
  onSeed: () => void
}) {
  return (
    <div className="border border-[#E5E0D8] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-[#E5E0D8]">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <div>
          <h2 className="text-base font-bold text-[#16213E]">{title}</h2>
          <p className="text-xs text-[#9E998F]">{subtitle}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <ul className="space-y-1.5 text-sm text-[#6B6560]">
          {bullets.map((b) => <li key={b}>• {b}</li>)}
        </ul>

        {status === 'idle' && (
          <button
            onClick={onSeed}
            className={`w-full py-3 ${buttonBg} ${buttonHover} text-white font-semibold rounded-xl transition-colors text-sm`}
          >
            {buttonLabel}
          </button>
        )}

        {status === 'loading' && (
          <div className={`w-full py-3 flex items-center justify-center gap-2 rounded-xl opacity-70 ${buttonBg} text-white`}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm font-medium">Creating...</span>
          </div>
        )}

        {status === 'done' && (
          <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Created successfully!</p>
              <p className="text-xs text-emerald-600 mt-1 font-mono break-all">ID: {planId}</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-700">Error</p>
            <p className="text-xs text-red-500 mt-1 font-mono">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function SeedFindzzerPlan() {
  const { user } = useAuthStore()

  const [nutritionStatus, setNutritionStatus] = useState<Status>('idle')
  const [nutritionId, setNutritionId] = useState<string | null>(null)
  const [nutritionError, setNutritionError] = useState<string | null>(null)

  const [workoutStatus, setWorkoutStatus] = useState<Status>('idle')
  const [workoutId, setWorkoutId] = useState<string | null>(null)
  const [workoutError, setWorkoutError] = useState<string | null>(null)

  const [shoppingStatus, setShoppingStatus] = useState<Status>('idle')
  const [shoppingId, setShoppingId] = useState<string | null>(null)
  const [shoppingError, setShoppingError] = useState<string | null>(null)

  const seedNutrition = async () => {
    if (!user) return
    setNutritionStatus('loading')
    setNutritionError(null)
    try {
      const ref = await addDoc(collection(db, 'nutritionPlans'), buildNutritionPlan(user.uid))
      setNutritionId(ref.id)
      setNutritionStatus('done')
    } catch (e) {
      setNutritionError(String(e))
      setNutritionStatus('error')
    }
  }

  const seedWorkout = async () => {
    if (!user) return
    setWorkoutStatus('loading')
    setWorkoutError(null)
    try {
      const ref = await addDoc(collection(db, 'workoutPlans'), buildWorkoutPlan(user.uid))
      setWorkoutId(ref.id)
      setWorkoutStatus('done')
    } catch (e) {
      setWorkoutError(String(e))
      setWorkoutStatus('error')
    }
  }

  const seedShopping = async () => {
    if (!user) return
    setShoppingStatus('loading')
    setShoppingError(null)
    try {
      const ref = await addDoc(collection(db, 'shoppingLists'), buildShoppingList(user.uid))
      setShoppingId(ref.id)
      setShoppingStatus('done')
    } catch (e) {
      setShoppingError(String(e))
      setShoppingStatus('error')
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#16213E]">Seed Findzzer Plans</h1>
        <p className="text-sm text-[#9E998F] mt-1">Create the official Findzzer plans in Firestore, then assign them from Plan Templates.</p>
      </div>

      <SeedCard
        icon={<Utensils size={20} />}
        iconBg="bg-purple-500"
        iconColor="text-white"
        title="Findzzer Nutrition Plan"
        subtitle="7-day Macedonian meal plan"
        bullets={[
          'Repeating weekly cycle (Mon – Sun)',
          '4 meals per day: breakfast, lunch, snack, dinner',
          'Ingredients + preparation for complex meals',
          'Supplements listed per meal (morning, pre-workout, evening)',
        ]}
        buttonLabel="Create Nutrition Plan in Firebase"
        buttonBg="bg-purple-500"
        buttonHover="hover:bg-purple-600"
        status={nutritionStatus}
        planId={nutritionId}
        error={nutritionError}
        onSeed={seedNutrition}
      />

      <SeedCard
        icon={<ShoppingCart size={20} />}
        iconBg="bg-emerald-500"
        iconColor="text-white"
        title="Findzzer Shopping List"
        subtitle="Weekly grocery list — 54 items across 10 categories"
        bullets={[
          '🥩 Meat · 🐟 Fish · 🥛 Dairy · 🌾 Carbs · 🍎 Fruit',
          '🥦 Vegetables (13 items) · 💊 Supplements',
          '🧂 Pantry basics · 🥜 Nuts & seeds · 🌿 Spices',
        ]}
        buttonLabel="Create Shopping List in Firebase"
        buttonBg="bg-emerald-500"
        buttonHover="hover:bg-emerald-600"
        status={shoppingStatus}
        planId={shoppingId}
        error={shoppingError}
        onSeed={seedShopping}
      />

      <SeedCard
        icon={<Dumbbell size={20} />}
        iconBg="bg-orange-500"
        iconColor="text-white"
        title="Findzzer Workout Plan"
        subtitle="5-day training split + 2 active rest days"
        bullets={[
          'Mon: Arms (Triceps + Biceps)',
          'Tue: Back · Wed: Chest + Core · Thu: Legs',
          'Fri: Shoulders + Core · Sat/Sun: Active Rest',
          '20 min incline walk every day except Leg Day',
        ]}
        buttonLabel="Create Workout Plan in Firebase"
        buttonBg="bg-orange-500"
        buttonHover="hover:bg-orange-600"
        status={workoutStatus}
        planId={workoutId}
        error={workoutError}
        onSeed={seedWorkout}
      />
    </div>
  )
}
