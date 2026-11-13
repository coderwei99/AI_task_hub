import { createBrowserRouter, Navigate } from 'react-router';
import AppShell from '@/components/AppShell';
import AllTasksPage from '@/pages/AllTasksPage';
import BoardPage from '@/pages/BoardPage';
import NotFoundPage from '@/pages/NotFoundPage';
import ProjectsPage from '@/pages/ProjectsPage';
import SettingsPage from '@/pages/SettingsPage';
import TodoDetailPage from '@/pages/TodoDetailPage';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Navigate to="/projects" replace /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:projectId', element: <BoardPage /> },
      { path: '/projects/:projectId/todos/:todoId', element: <TodoDetailPage /> },
      { path: '/tasks', element: <AllTasksPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);