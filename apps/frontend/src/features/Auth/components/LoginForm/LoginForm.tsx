import { valibotResolver } from '@hookform/resolvers/valibot';
import { LoginSchema, type LoginInput } from '@repo/shared';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import styles from '../../css/AuthForm.module.css';

import { getApiErrorMessage } from '@/common/utils/ApiError/getApiErrorMessage';
import { useAuthStore } from '@/store/useAuth.store';

interface LoginFormProps {
  onSuccess: () => void;
}

export const LoginForm = ({ onSuccess }: LoginFormProps) => {
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
      onSuccess();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, 'Could not sign in. Check your email and password, then try again.'),
      );
    }
  });

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          type="email"
          autoComplete="username"
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
          autoComplete="current-password"
          required
          className={styles.input}
          {...register('password')}
        />
        {errors.password && (
          <span className={styles.error_message}>{errors.password.message}</span>
        )}
      </label>

      <button type="submit" className={styles.submit} disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
};