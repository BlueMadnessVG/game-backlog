import { useState } from 'react';

import { valibotResolver } from '@hookform/resolvers/valibot';
import {
  AuthEmailSchema,
  AuthPasswordSchema,
  AuthUsernameSchema,
} from '@repo/shared';
import { useNavigate } from '@tanstack/react-router';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import * as v from 'valibot';

import styles from '../css/Auth.module.css';

import { getApiErrorMessage } from '@/common/utils/ApiError/getApiErrorMessage';
import { useAuthStore } from '@/store/useAuth.store';

interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterFormSchema = v.object({
  username: AuthUsernameSchema,
  email: AuthEmailSchema,
  password: AuthPasswordSchema,
  confirmPassword: v.string(),
});

export const RegisterForm = () => {
  const navigate = useNavigate();
  const registerUser = useAuthStore((state) => state.actions.register);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: valibotResolver(RegisterFormSchema) as unknown as Resolver<RegisterFormValues>,
    defaultValues: { username: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ confirmPassword, ...values }) => {
    if (values.password !== confirmPassword) {
      setConfirmError('Las contraseñas no coinciden');
      return;
    }

    try {
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      void navigate({ to: '/library', replace: true });
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'No se pudo crear la cuenta. Intenta de nuevo.'),
      );
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Nombre de usuario</span>
        <input
          type="text"
          autoComplete="username"
          className={styles.input}
          {...register('username')}
        />
        {errors.username && (
          <span className={styles.error_message}>{errors.username.message}</span>
        )}
      </label>

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
          autoComplete="new-password"
          className={styles.input}
          {...register('password')}
        />
        {errors.password && (
          <span className={styles.error_message}>{errors.password.message}</span>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Confirmar contraseña</span>
        <input
          type="password"
          autoComplete="new-password"
          className={styles.input}
          {...register('confirmPassword', {
            onChange: () => {
              if (confirmError) setConfirmError(null);
            },
          })}
        />
        {confirmError && (
          <span className={styles.error_message}>{confirmError}</span>
        )}
      </label>

      <button type="submit" className={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
    </form>
  );
};