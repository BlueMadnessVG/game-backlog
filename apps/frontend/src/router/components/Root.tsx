import { useEffect } from 'react';

import { Outlet } from '@tanstack/react-router';

import MainLayout from '@/common/components/layout/MainLayout/MainLayout';
import { useAuthStore } from '@/store/useAuth.store';

export const RootComponent = () => {
  const hydrate = useAuthStore((state) => state.actions.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
};
