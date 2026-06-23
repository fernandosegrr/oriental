import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { getErrorMessage } from '../api/client';
import {
  useCreateUsuario,
  useDeleteUsuario,
  useUpdateUsuario,
  useUsuarios,
} from '../api/hooks';
import type { Rol, Usuario } from '../api/types';

interface CreateValues {
  email: string;
  nombre: string;
  password: string;
  rol: Rol;
}

interface EditValues {
  nombre: string;
  rol: Rol;
  activo: boolean;
  password: string;
}

const ROL_DATA = [
  { value: 'admin', label: 'admin' },
  { value: 'operador', label: 'operador' },
  { value: 'visor', label: 'visor (solo lectura)' },
];

export function UsuariosPage() {
  const { data: usuarios, isLoading, isError, error } = useUsuarios();
  const createMut = useCreateUsuario();
  const updateMut = useUpdateUsuario();
  const deleteMut = useDeleteUsuario();

  const [createOpened, createModal] = useDisclosure(false);
  const [editOpened, editModal] = useDisclosure(false);
  const [delOpened, delModal] = useDisclosure(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState<Usuario | null>(null);

  const createForm = useForm<CreateValues>({
    initialValues: { email: '', nombre: '', password: '', rol: 'operador' },
    validate: {
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Email inválido'),
      nombre: (v) => (v.trim() ? null : 'Ingresa el nombre'),
      password: (v) => (v.length >= 6 ? null : 'Mínimo 6 caracteres'),
    },
  });

  const editForm = useForm<EditValues>({
    initialValues: { nombre: '', rol: 'operador', activo: true, password: '' },
    validate: {
      nombre: (v) => (v.trim() ? null : 'Ingresa el nombre'),
      password: (v) =>
        v.length === 0 || v.length >= 6 ? null : 'Mínimo 6 caracteres',
    },
  });

  const submitCreate = async (values: CreateValues) => {
    try {
      await createMut.mutateAsync(values);
      notifications.show({ color: 'green', message: 'Usuario creado' });
      createForm.reset();
      createModal.close();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Error al crear',
        message: getErrorMessage(err),
      });
    }
  };

  const openEdit = (u: Usuario) => {
    setEditing(u);
    editForm.setValues({
      nombre: u.nombre,
      rol: u.rol,
      activo: u.activo,
      password: '',
    });
    editModal.open();
  };

  const submitEdit = async (values: EditValues) => {
    if (!editing) return;
    try {
      await updateMut.mutateAsync({
        id: editing.id,
        input: {
          nombre: values.nombre,
          rol: values.rol,
          activo: values.activo,
          ...(values.password ? { password: values.password } : {}),
        },
      });
      notifications.show({ color: 'green', message: 'Usuario actualizado' });
      editModal.close();
      setEditing(null);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Error al guardar',
        message: getErrorMessage(err),
      });
    }
  };

  const openDelete = (u: Usuario) => {
    setDeleting(u);
    delModal.open();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      notifications.show({ color: 'green', message: 'Usuario desactivado' });
      delModal.close();
      setDeleting(null);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Error al desactivar',
        message: getErrorMessage(err),
      });
    }
  };

  const rows = usuarios ?? [];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Usuarios</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            createForm.reset();
            createModal.open();
          }}
        >
          Nuevo usuario
        </Button>
      </Group>

      <Paper withBorder radius="md">
        {isLoading ? (
          <Center p="xl">
            <Loader />
          </Center>
        ) : isError ? (
          <Center p="xl">
            <Text c="red">{getErrorMessage(error)}</Text>
          </Center>
        ) : rows.length === 0 ? (
          <Center p="xl">
            <Text c="dimmed">No hay usuarios.</Text>
          </Center>
        ) : (
          <>
            {/* Pantallas grandes: tabla */}
            <Table striped highlightOnHover visibleFrom="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Nombre</Table.Th>
                  <Table.Th>Rol</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>{u.email}</Table.Td>
                    <Table.Td>{u.nombre}</Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={u.rol === 'admin' ? 'grape' : 'blue'}
                      >
                        {u.rol}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={u.activo ? 'green' : 'gray'}
                      >
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => openEdit(u)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          disabled={!u.activo}
                          onClick={() => openDelete(u)}
                        >
                          Desactivar
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {/* Móvil / tablet: tarjetas (sin scroll horizontal) */}
            <Stack hiddenFrom="md" gap="sm" p="sm">
              {rows.map((u) => (
                <Card key={u.id} withBorder radius="md" p="sm">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={600} style={{ wordBreak: 'break-all' }}>
                      {u.email}
                    </Text>
                    <Badge
                      variant="light"
                      color={u.activo ? 'green' : 'gray'}
                    >
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Group>
                  <Group justify="space-between" mt={4}>
                    <Text size="sm">{u.nombre}</Text>
                    <Badge
                      variant="light"
                      color={u.rol === 'admin' ? 'grape' : 'blue'}
                    >
                      {u.rol}
                    </Badge>
                  </Group>
                  <Group gap="xs" mt="sm">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => openEdit(u)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      disabled={!u.activo}
                      onClick={() => openDelete(u)}
                    >
                      Desactivar
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>
          </>
        )}
      </Paper>

      {/* Create modal */}
      <Modal
        opened={createOpened}
        onClose={createModal.close}
        title="Nuevo usuario"
        centered
      >
        <form onSubmit={createForm.onSubmit(submitCreate)}>
          <Stack>
            <TextInput
              label="Email"
              required
              {...createForm.getInputProps('email')}
            />
            <TextInput
              label="Nombre"
              required
              {...createForm.getInputProps('nombre')}
            />
            <PasswordInput
              label="Contraseña"
              required
              {...createForm.getInputProps('password')}
            />
            <Select
              label="Rol"
              data={ROL_DATA}
              allowDeselect={false}
              {...createForm.getInputProps('rol')}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={createModal.close}>
                Cancelar
              </Button>
              <Button type="submit" loading={createMut.isPending}>
                Crear
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        opened={editOpened}
        onClose={() => {
          editModal.close();
          setEditing(null);
        }}
        title="Editar usuario"
        centered
      >
        <form onSubmit={editForm.onSubmit(submitEdit)}>
          <Stack>
            <TextInput
              label="Nombre"
              required
              {...editForm.getInputProps('nombre')}
            />
            <Select
              label="Rol"
              data={ROL_DATA}
              allowDeselect={false}
              {...editForm.getInputProps('rol')}
            />
            <Switch
              label="Activo"
              {...editForm.getInputProps('activo', { type: 'checkbox' })}
            />
            <PasswordInput
              label="Nueva contraseña"
              placeholder="Dejar en blanco para no cambiar"
              {...editForm.getInputProps('password')}
            />
            <Group justify="flex-end">
              <Button
                variant="default"
                onClick={() => {
                  editModal.close();
                  setEditing(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" loading={updateMut.isPending}>
                Guardar
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Deactivate confirmation */}
      <Modal
        opened={delOpened}
        onClose={() => {
          delModal.close();
          setDeleting(null);
        }}
        title="Desactivar usuario"
        centered
      >
        <Stack>
          <Text>
            ¿Seguro que deseas desactivar a{' '}
            <Text span fw={600}>
              {deleting?.nombre}
            </Text>
            ?
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                delModal.close();
                setDeleting(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              color="red"
              loading={deleteMut.isPending}
              onClick={confirmDelete}
            >
              Desactivar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
