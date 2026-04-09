import { Outlet } from '@tanstack/react-router';

import MainLayout from '@/common/components/layout/MainLayout/MainLayout';

export const RootComponent = () => (
  <MainLayout>
    <Outlet />
  </MainLayout>
);
