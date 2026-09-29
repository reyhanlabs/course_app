import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedLayout, RequireRole } from './auth/guards';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { StudentsPage } from './pages/StudentsPage';
import { StudentDetailPage } from './pages/StudentDetailPage';
import { ParentsPage } from './pages/ParentsPage';
import { TeachersPage } from './pages/TeachersPage';
import { LevelsPage } from './pages/LevelsPage';
import { ClassesPage } from './pages/ClassesPage';
import { ClassDetailPage } from './pages/ClassDetailPage';
import { UsersPage } from './pages/UsersPage';
import { MyClassesPage } from './pages/MyClassesPage';
import { MyChildrenPage } from './pages/MyChildrenPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route element={<ProtectedLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="students" element={<RequireRole roles={['admin', 'owner']}><StudentsPage /></RequireRole>} />
            <Route path="students/:id" element={<RequireRole roles={['admin', 'owner']}><StudentDetailPage /></RequireRole>} />
            <Route path="parents" element={<RequireRole roles={['admin']}><ParentsPage /></RequireRole>} />
            <Route path="teachers" element={<RequireRole roles={['admin']}><TeachersPage /></RequireRole>} />
            <Route path="levels" element={<RequireRole roles={['admin']}><LevelsPage /></RequireRole>} />
            <Route path="classes" element={<RequireRole roles={['admin', 'owner']}><ClassesPage /></RequireRole>} />
            <Route path="classes/:id" element={<RequireRole roles={['admin', 'owner', 'teacher']}><ClassDetailPage /></RequireRole>} />
            <Route path="users" element={<RequireRole roles={['admin']}><UsersPage /></RequireRole>} />
            <Route path="my-classes" element={<RequireRole roles={['teacher']}><MyClassesPage /></RequireRole>} />
            <Route path="my-children" element={<RequireRole roles={['parent']}><MyChildrenPage /></RequireRole>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
