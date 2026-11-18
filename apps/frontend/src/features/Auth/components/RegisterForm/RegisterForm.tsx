import { useState } from 'react';

import { valibotResolver } from '@hookform/resolvers/valibot';
import {
  AuthEmailSchema,
  AuthPasswordSchema,
  AuthUsernameSchema,
} from '@repo/shared';
import { useForm, type Resolver } from 'react-hook-form';
import { toast } from 'sonner';
import * as v from 'valibot';

import styles from '../../css/AuthForm.module.css';

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

interface RegisterFormProps {
  onSuccess: () => void;
}

export const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
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
      setConfirmError('Passwords do not match');
      return;
    }

    try {
      await registerUser({
        username: values.username,
        email: values.email,
        password: values.password,
      });
      onSuccess();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Could not create the account. Try again.'),
      );
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Username</span>
        <input
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
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
          spellCheck={false}
          required
          className={styles.input}
          {...register('email')}
        />
        {errors.email && <span className={styles.error_message}>{errors.email.message}</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          className={styles.input}
          {...register('password')}
        />
        {errors.password && (
          <span className={styles.error_message}>{errors.password.message}</span>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
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
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
};