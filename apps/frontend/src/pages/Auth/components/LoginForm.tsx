import { valibotResolver } from '@hookform/resolvers/valibot';
import { LoginSchema, type LoginInput } from '@repo/shared';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import styles from '../css/Auth.module.css';

import { getApiErrorMessage } from '@/common/utils/ApiError/getApiErrorMessage';
import { useAuthStore } from '@/store/useAuth.store';

export const LoginForm = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.actions.login);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: valibotResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values);
      void navigate({ to: '/library', replace: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'No se pudo iniciar sesión. Intenta de nuevo.'),
      );
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          type="email"
          autoComplete="email"
          className={styles.input}
          {...register('email')}
        />
        {errors.email && <span className={styles.error_message}>{errors.email.message}</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Contraseña</span>
        <input
          type="password"
          autoComplete="current-password"
          className={styles.input}
          {...register('password')}
        />
        {errors.password && (
          <span className={styles.error_message}>{errors.password.message}</span>
        )}
      </label>

      <button type="submit" className={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? 'Entrando…' : 'Iniciar sesión'}
      </button>
    </form>
  );
};