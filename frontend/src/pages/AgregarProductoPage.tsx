import {
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { getErrorMessage } from '../api/client';
import { calcPrecioVenta, formatMXN } from '../api/format';
import { useCreateProducto } from '../api/hooks';
import type { CreateProductoInput } from '../api/types';
import { useAuth } from '../auth/AuthContext';

type Mode = 'descripcion' | 'estructurado';

interface FormValues {
  descripcion: string;
  medida: string;
  marca: string;
  modelo: string;
  specs: string;
  stock: number;
  precio_costo: number;
}

export function AgregarProductoPage() {
  const { user } = useAuth();
  const isVisor = user?.rol === 'visor';
  const [mode, setMode] = useState<Mode>('descripcion');
  const createMut = useCreateProducto();

  if (isVisor) {
    return (
      <Stack maw={600}>
        <Title order={2}>Agregar producto</Title>
        <Alert color="blue" icon={<IconInfoCircle size={18} />} title="Solo tienes acceso de vista">
          No tienes permisos para agregar productos. Contacta al administrador si necesitas realizar cambios.
        </Alert>
      </Stack>
    );
  }

  const form = useForm<FormValues>({
    initialValues: {
      descripcion: '',
      medida: '',
      marca: '',
      modelo: '',
      specs: '',
      stock: 0,
      precio_costo: 0,
    },
    validate: {
      descripcion: (v, values) =>
        mode === 'descripcion' && !v.trim()
          ? 'Ingresa la descripción'
          : mode === 'estructurado' && !values.medida.trim()
            ? null
            : null,
    },
  });

  const previewVenta = calcPrecioVenta(form.values.precio_costo);

  const handleSubmit = async (values: FormValues) => {
    // In structured mode require at least a medida so the row is meaningful.
    if (mode === 'estructurado' && !values.medida.trim()) {
      form.setFieldError('medida', 'Ingresa al menos la medida');
      return;
    }

    const input: CreateProductoInput = {
      proveedor: 'LLANTERO_OFICIAL',
      stock: values.stock,
      precio_costo: values.precio_costo,
    };

    if (mode === 'descripcion') {
      input.descripcion = values.descripcion.trim();
    } else {
      if (values.medida.trim()) input.medida = values.medida.trim();
      if (values.marca.trim()) input.marca = values.marca.trim();
      if (values.modelo.trim()) input.modelo = values.modelo.trim();
      if (values.specs.trim()) input.specs = values.specs.trim();
    }

    try {
      await createMut.mutateAsync(input);
      notifications.show({ color: 'green', message: 'Producto agregado' });
      form.reset();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Error al agregar',
        message: getErrorMessage(err),
      });
    }
  };

  return (
    <Stack maw={620}>
      <Title order={2}>Agregar producto</Title>

      <Paper withBorder p="md" radius="md">
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <Tabs value={mode} onChange={(v) => setMode((v as Mode) ?? 'descripcion')}>
              <Tabs.List>
                <Tabs.Tab value="descripcion">Descripción completa</Tabs.Tab>
                <Tabs.Tab value="estructurado">Campos estructurados</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="descripcion" pt="md">
                <TextInput
                  label="Descripción completa"
                  placeholder="225/45R17 Michelin Primacy 4 91W"
                  description="El servidor interpretará medida, marca, etc."
                  {...form.getInputProps('descripcion')}
                />
              </Tabs.Panel>

              <Tabs.Panel value="estructurado" pt="md">
                <Stack>
                  <Group grow>
                    <TextInput
                      label="Medida"
                      placeholder="225/45R17"
                      {...form.getInputProps('medida')}
                    />
                    <TextInput
                      label="Marca"
                      placeholder="Michelin"
                      {...form.getInputProps('marca')}
                    />
                  </Group>
                  <Group grow>
                    <TextInput
                      label="Modelo"
                      placeholder="Primacy 4"
                      {...form.getInputProps('modelo')}
                    />
                    <TextInput
                      label="Specs"
                      placeholder="91W"
                      {...form.getInputProps('specs')}
                    />
                  </Group>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            <Group grow>
              <NumberInput
                label="Stock"
                min={0}
                {...form.getInputProps('stock')}
              />
              <NumberInput
                label="Precio costo"
                min={0}
                prefix="$ "
                thousandSeparator=","
                {...form.getInputProps('precio_costo')}
              />
            </Group>

            <Text size="sm" c="dimmed">
              Precio venta (calculado):{' '}
              <Text span fw={700} c="teal.4">
                {formatMXN(previewVenta)}
              </Text>
            </Text>

            <Group justify="flex-end">
              <Button type="submit" loading={createMut.isPending}>
                Agregar
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
