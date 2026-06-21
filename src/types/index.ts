export type UserRole = 'admin' | 'trainer' | 'user'
export type UserStatus = 'active' | 'inactive'
export type InviteStatus = 'pending' | 'accepted' | 'declined'

export interface Invite {
  id: string
  trainerId: string
  trainerName: string
  trainerPhoto?: string
  userEmail: string
  status: InviteStatus
  createdAt: Date
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  role: UserRole
  status: UserStatus
  createdAt: Date
  trainerId?: string
  activeWorkoutPlanId?: string
  activeNutritionPlanId?: string
  activeShoppingListId?: string
  assignedWorkoutPlanId?: string
  assignedNutritionPlanId?: string
  workoutPlanStartDate?: Date
}

export interface ShoppingItem {
  id: string
  name: string
  amount: string
}

export interface ShoppingCategory {
  id: string
  emoji: string
  name: string
  items: ShoppingItem[]
}

export interface ShoppingList {
  id: string
  name: string
  description?: string
  createdBy: string
  ownedBy?: string
  isUserCopy?: boolean
  categories: ShoppingCategory[]
  createdAt: Date
  updatedAt: Date
}

export interface ShoppingAssignment {
  id: string
  listId: string
  userId: string
  assignedBy: string
  assignedByLabel: string
  assignedAt: Date
}

export interface Assignment {
  userId: string
  trainerId: string
  workoutPlanId?: string
  nutritionPlanId?: string
  createdAt: Date
}

export interface Exercise {
  id: string
  name: string
  category: string
  muscleGroups: string[]
  description?: string
  videoUrl?: string
  imageUrl?: string
  createdBy: string
}

export interface WorkoutSet {
  reps?: number
  weight?: number
  duration?: number
  rest?: number
  notes?: string
}

export interface WorkoutExercise {
  id: string
  exerciseId: string
  exerciseName: string
  order: number
  sets: WorkoutSet[]
  notes?: string
  videoUrl?: string
}

export interface WorkoutDay {
  id: string
  name: string
  order: number
  exercises: WorkoutExercise[]
  isRestDay?: boolean
}

export interface WorkoutWeek {
  id: string
  weekNumber: number
  days: WorkoutDay[]
}

export interface WorkoutPlan {
  id: string
  name: string
  description?: string
  createdBy: string
  ownedBy?: string
  isUserCopy?: boolean
  repeatCycle: boolean
  weeks: WorkoutWeek[]
  createdAt: Date
  updatedAt: Date
}

export interface Meal {
  id: string
  name: string
  time?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  foods: MealFood[]
  ingredients?: string
  instructions?: string
}

export interface MealFood {
  name: string
  quantity: number
  unit: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface NutritionDay {
  id: string
  name: string
  order: number
  meals: Meal[]
  totalCalories?: number
}

export interface NutritionWeek {
  id: string
  weekNumber: number
  days: NutritionDay[]
}

export interface NutritionPlan {
  id: string
  name: string
  description?: string
  createdBy: string
  ownedBy?: string
  isUserCopy?: boolean
  repeatCycle: boolean
  dailyCalorieTarget?: number
  weeks: NutritionWeek[]
  createdAt: Date
  updatedAt: Date
}

export interface BodyMeasurement {
  id: string
  userId: string
  date: Date
  weight?: number
  bodyFat?: number
  chest?: number
  waist?: number
  hips?: number
  arms?: number
  thighs?: number
  notes?: string
}

export interface WorkoutLog {
  id: string
  userId: string
  planId: string
  weekId: string
  dayId: string
  date: Date
  exercises: LoggedExercise[]
  duration?: number
  notes?: string
}

export interface LoggedExercise {
  exerciseId: string
  exerciseName: string
  sets: LoggedSet[]
}

export interface LoggedSet {
  reps?: number
  weight?: number
  duration?: number
  completed: boolean
}

export interface MealTracking {
  id: string
  userId: string
  planId: string
  date: string
  mealId: string
  completed: boolean
  notes?: string
}
