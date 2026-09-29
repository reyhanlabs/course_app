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
import { ParentArea } from './parent/ParentArea';
import {
  ChildOverviewPage,
  ParentAttendancePage,
  ParentHomeworkPage,
  ParentInvoicesPage,
  ParentLessonsPage,
  ParentMaterialsPage,
  ParentPaymentsPage,
  ParentProgressPage,
  ParentReceiptsPage,
  ParentSchedulePage,
} from './parent/ParentPages';
import { NotFoundPage } from './pages/NotFoundPage';
import { RoomsPage } from './pages/RoomsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { AttendancePage } from './pages/AttendancePage';
import { CurriculumPage } from './pages/CurriculumPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { HomeworkPage } from './pages/HomeworkPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { BillingPage } from './pages/BillingPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { GenerateInvoicesPage } from './pages/GenerateInvoicesPage';
import { InvoiceDetailPage } from './pages/InvoiceDetailPage';
import { InvoicePrintPage } from './pages/InvoicePrintPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { ReceiptPrintPage } from './pages/ReceiptPrintPage';
import { FinancePage } from './pages/FinancePage';
import { ReportsPage } from './pages/ReportsPage';
import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { AuditLogPage } from './pages/AuditLogPage';

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
            <Route element={<RequireRole roles={['parent']}><ParentArea /></RequireRole>}>
              <Route path="my-children" element={<ChildOverviewPage />} />
              <Route path="p/schedule" element={<ParentSchedulePage />} />
              <Route path="p/attendance" element={<ParentAttendancePage />} />
              <Route path="p/lessons" element={<ParentLessonsPage />} />
              <Route path="p/materials" element={<ParentMaterialsPage />} />
              <Route path="p/homework" element={<ParentHomeworkPage />} />
              <Route path="p/progress" element={<ParentProgressPage />} />
              <Route path="p/invoices" element={<ParentInvoicesPage />} />
              <Route path="p/payments" element={<ParentPaymentsPage />} />
              <Route path="p/receipts" element={<ParentReceiptsPage />} />
            </Route>
            <Route path="rooms" element={<RequireRole roles={['admin']}><RoomsPage /></RequireRole>} />
            <Route path="schedules" element={<RequireRole roles={['admin', 'teacher']}><SchedulesPage /></RequireRole>} />
            <Route path="sessions" element={<RequireRole roles={['admin', 'teacher']}><SessionsPage /></RequireRole>} />
            <Route path="sessions/:id" element={<RequireRole roles={['admin', 'owner', 'teacher']}><SessionDetailPage /></RequireRole>} />
            <Route path="attendance" element={<RequireRole roles={['admin', 'owner', 'teacher']}><AttendancePage /></RequireRole>} />
            <Route path="curriculum" element={<RequireRole roles={['admin', 'teacher']}><CurriculumPage /></RequireRole>} />
            <Route path="materials" element={<RequireRole roles={['admin', 'teacher']}><MaterialsPage /></RequireRole>} />
            <Route path="homework" element={<RequireRole roles={['admin', 'teacher']}><HomeworkPage /></RequireRole>} />
            <Route path="progress" element={<RequireRole roles={['admin', 'teacher']}><ProgressPage /></RequireRole>} />
            <Route path="settings" element={<RequireRole roles={['admin']}><SettingsPage /></RequireRole>} />
            <Route path="finance" element={<RequireRole roles={['admin', 'owner']}><FinancePage /></RequireRole>} />
            <Route path="billing" element={<RequireRole roles={['admin']}><BillingPage /></RequireRole>} />
            <Route path="invoices" element={<RequireRole roles={['admin', 'owner']}><InvoicesPage /></RequireRole>} />
            <Route path="invoices/new" element={<RequireRole roles={['admin']}><GenerateInvoicesPage /></RequireRole>} />
            <Route path="invoices/:id" element={<RequireRole roles={['admin', 'owner']}><InvoiceDetailPage /></RequireRole>} />
            <Route path="invoices/:id/print" element={<RequireRole roles={['admin', 'owner', 'parent']}><InvoicePrintPage /></RequireRole>} />
            <Route path="payments" element={<RequireRole roles={['admin', 'owner']}><PaymentsPage /></RequireRole>} />
            <Route path="receipts" element={<RequireRole roles={['admin', 'owner']}><ReceiptsPage /></RequireRole>} />
            <Route path="receipts/:id" element={<RequireRole roles={['admin', 'owner', 'parent']}><ReceiptPrintPage /></RequireRole>} />
            <Route path="reports" element={<RequireRole roles={['admin', 'owner']}><ReportsPage /></RequireRole>} />
            <Route path="announcements" element={<AnnouncementsPage />} />
            <Route path="audit-logs" element={<RequireRole roles={['admin', 'owner']}><AuditLogPage /></RequireRole>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
