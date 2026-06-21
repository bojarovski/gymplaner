import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAuthInit } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import WaitingPage from './pages/WaitingPage'
import SetupPage from './pages/SetupPage'
import AdminLayout from './layouts/AdminLayout'
import TrainerLayout from './layouts/TrainerLayout'
import UserLayout from './layouts/UserLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminExercises from './pages/admin/Exercises'
import SeedFindzzerPlan from './pages/admin/SeedFindzzerPlan'
import AdminPlans from './pages/admin/Plans'
import TrainerDashboard from './pages/trainer/Dashboard'
import TrainerClients from './pages/trainer/Clients'
import TrainerWorkoutPlans from './pages/trainer/WorkoutPlans'
import TrainerNutritionPlans from './pages/trainer/NutritionPlans'
import TrainerWorkoutPlanDetail from './pages/trainer/WorkoutPlanDetail'
import TrainerNutritionPlanDetail from './pages/trainer/NutritionPlanDetail'
import UserDashboard from './pages/user/Dashboard'
import UserToday from './pages/user/Today'
import UserPlans from './pages/user/Plans'
import UserWorkoutPlanBuilder from './pages/user/WorkoutPlanBuilder'
import UserNutritionPlanBuilder from './pages/user/NutritionPlanBuilder'
import UserProgress from './pages/user/Progress'
import UserShoppingListHome from './pages/user/ShoppingListHome'
import UserShoppingListDetail from './pages/user/ShoppingListDetail'
import LoadingSpinner from './components/ui/LoadingSpinner'

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles: string[]
}) {
  const { user, loading } = useAuthStore()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'inactive') return <Navigate to="/waiting" replace />
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />

  return <>{children}</>
}

function RootRedirect() {
  const { user, loading } = useAuthStore()

  if (loading) return <LoadingSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'inactive') return <Navigate to="/waiting" replace />
  if (user.role === 'admin') return <Navigate to="/admin" replace />
  if (user.role === 'trainer') return <Navigate to="/trainer" replace />
  return <Navigate to="/user" replace />
}

export default function App() {
  useAuthInit()

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/waiting" element={<WaitingPage />} />
      <Route path="/setup" element={<SetupPage />} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="exercises" element={<AdminExercises />} />
        <Route path="plans" element={<AdminPlans />} />
        <Route path="plans/nutrition/:id" element={<TrainerNutritionPlanDetail />} />
        <Route path="plans/workout/:id" element={<TrainerWorkoutPlanDetail />} />
        <Route path="seed" element={<SeedFindzzerPlan />} />
      </Route>

      <Route
        path="/trainer"
        element={
          <ProtectedRoute allowedRoles={['trainer', 'admin']}>
            <TrainerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TrainerDashboard />} />
        <Route path="clients" element={<TrainerClients />} />
        <Route path="workout-plans" element={<TrainerWorkoutPlans />} />
        <Route path="workout-plans/:id" element={<TrainerWorkoutPlanDetail />} />
        <Route path="nutrition-plans" element={<TrainerNutritionPlans />} />
        <Route path="nutrition-plans/:id" element={<TrainerNutritionPlanDetail />} />
      </Route>

      <Route
        path="/user"
        element={
          <ProtectedRoute allowedRoles={['user', 'trainer', 'admin']}>
            <UserLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserDashboard />} />
        <Route path="today" element={<UserToday />} />
        <Route path="plans" element={<UserPlans />} />
        <Route path="plans/workout/:id" element={<UserWorkoutPlanBuilder />} />
        <Route path="plans/nutrition/:id" element={<UserNutritionPlanBuilder />} />
        <Route path="shopping" element={<UserShoppingListHome />} />
        <Route path="shopping/:id" element={<UserShoppingListDetail />} />
        <Route path="progress" element={<UserProgress />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
