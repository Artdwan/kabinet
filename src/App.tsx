import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider, useStore } from "./services/StoreContext";
import { ToastProvider } from "./services/ToastContext";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/auth/AuthPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { JoinGroupPage } from "./pages/auth/JoinGroupPage";
import { HomePage } from "./pages/student/HomePage";
import { HomeworkListPage } from "./pages/student/HomeworkListPage";
import { HomeworkReaderPage } from "./pages/student/HomeworkReaderPage";
import { TheoryListPage } from "./pages/student/TheoryListPage";
import { TheoryMaterialPage } from "./pages/student/TheoryMaterialPage";
import { TestsCatalogPage } from "./pages/student/TestsCatalogPage";
import { TestRunnerPage } from "./pages/student/TestRunnerPage";
import { TestResultPage } from "./pages/student/TestResultPage";
import { StatsPage } from "./pages/student/StatsPage";
import { TechniquesPage } from "./pages/student/TechniquesPage";
import { TrainersPage } from "./pages/student/TrainersPage";
import { GamePage } from "./pages/student/games/GamePage";
import { SettingsPage } from "./pages/student/SettingsPage";
import { TeacherHomePage } from "./pages/teacher/TeacherHomePage";
import { TeacherStudentsPage } from "./pages/teacher/TeacherStudentsPage";
import { TeacherStudentProfilePage } from "./pages/teacher/TeacherStudentProfilePage";
import { TeacherGroupsPage } from "./pages/teacher/TeacherGroupsPage";
import { TeacherGroupWorkspacePage } from "./pages/teacher/TeacherGroupWorkspacePage";
import { TeacherCalendarPage } from "./pages/teacher/TeacherCalendarPage";
import { TeacherReviewPage } from "./pages/teacher/TeacherReviewPage";
import { TeacherAssignPage } from "./pages/teacher/TeacherAssignPage";
import { ParentHomePage } from "./pages/parent/ParentHomePage";
import { ParentReportsPage } from "./pages/parent/ParentReportsPage";

function RoleHomeRedirect() {
  const { account } = useStore();
  if (account?.role === "teacher") return <Navigate to="/teacher" replace />;
  if (account?.role === "parent") return <Navigate to="/parent" replace />;
  return <Navigate to="/home" replace />;
}

function AppRoutes() {
  const { account, ready } = useStore();

  if (!ready) return null;

  if (!account) {
    return (
      <Routes>
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="join-group/:groupId" element={<JoinGroupPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="join-group/:groupId" element={<JoinGroupPage />} />
      <Route element={<AppShell />}>
        <Route index element={<RoleHomeRedirect />} />
        <Route path="home" element={<HomePage />} />
        <Route path="homework" element={<HomeworkListPage />} />
        <Route path="homework/:hwId" element={<HomeworkReaderPage />} />
        <Route path="theory" element={<TheoryListPage />} />
        <Route path="theory/:materialId" element={<TheoryMaterialPage />} />
        <Route path="tests" element={<TestsCatalogPage />} />
        <Route path="tests/:testId/run" element={<TestRunnerPage />} />
        <Route path="tests/:testId/result" element={<TestResultPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="techniques" element={<TechniquesPage />} />
        <Route path="trainers" element={<TrainersPage />} />
        <Route path="trainers/:trainerId" element={<GamePage />} />
        <Route path="settings" element={<SettingsPage />} />

        <Route path="teacher" element={<TeacherHomePage />} />
        <Route path="teacher/students" element={<TeacherStudentsPage />} />
        <Route path="teacher/students/:id" element={<TeacherStudentProfilePage />} />
        <Route path="teacher/groups" element={<TeacherGroupsPage />} />
        <Route path="teacher/groups/:id" element={<TeacherGroupWorkspacePage />} />
        <Route path="teacher/calendar" element={<TeacherCalendarPage />} />
        <Route path="teacher/review" element={<TeacherReviewPage />} />
        <Route path="teacher/assign" element={<TeacherAssignPage />} />

        <Route path="parent" element={<ParentHomePage />} />
        <Route path="parent/reports" element={<ParentReportsPage />} />

        <Route path="*" element={<RoleHomeRedirect />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </StoreProvider>
  );
}

export default App;
