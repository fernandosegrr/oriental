import {
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface FormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    initialValues: { email: '', password: '' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Email inválido'),
      password: (v) => (v.length > 0 ? null : 'Ingresa tu contraseña'),
    },
  });

  // Already logged in? Skip the form.
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      navigate('/', { replace: true });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'No se pudo iniciar sesión',
        message: getErrorMessage(err, 'Credenciales inválidas'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Center h="100vh">
      <Paper withBorder shadow="md" p="xl" radius="md" w={360}>
        <Title order={3} mb="md" ta="center">
          Iniciar sesión
        </Title>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="correo@ejemplo.com"
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Contraseña"
              required
              {...form.getInputProps('password')}
            />
            <Button type="submit" loading={submitting} fullWidth>
              Entrar
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
