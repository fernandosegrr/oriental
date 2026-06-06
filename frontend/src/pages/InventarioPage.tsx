import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Loader,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { calcPrecioVenta, formatMXN } from '../api/format';
import {
  useDeleteProducto,
  useInventory,
  useUpdateProducto,
} from '../api/hooks';
import type { InventoryFilters, Producto } from '../api/types';

interface EditFormValues {
  descripcion: string;
  medida: string;
  marca: string;
  modelo: string;
  specs: string;
  stock: number;
  precio_costo: number;
}

const PAGE_SIZE = 20;

export function InventarioPage() {
  const [medida, setMedida] = useState('');
  const [marca, setMarca] = useState('');
  const [conStock, setConStock] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // Debounce free-text inputs to avoid a request per keystroke.
  const [debMedida] = useDebouncedValue(medida, 350);
  const [debMarca] = useDebouncedValue(marca, 350);
  const [debQ] = useDebouncedValue(q, 350);

  const filters: InventoryFilters = useMemo(
    () => ({
      medida: debMedida || undefined,
      marca: debMarca || undefined,
      conStock: conStock || undefined,
      q: debQ || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debMedida, debMarca, conStock, debQ, page],
  );

  const { data, isLoading, isError, error } = useInventory(filters);
  const updateMut = useUpdateProducto();
  const deleteMut = useDeleteProducto();

  const [editing, setEditing] = useState<Producto | null>(null);
  const [deleting, setDeleting] = useState<Producto | null>(null);
  const [editOpened, editModal] = useDisclosure(false);
  const [delOpened, delModal] = useDisclosure(false);

  const form = useForm<EditFormValues>({
    initialValues: {
      descripcion: '',
      medida: '',
      marca: '',
      modelo: '',
      specs: '',
      stock: 0,
      precio_costo: 0,
    },
  });

  const openEdit = (p: Producto) => {
    setEditing(p);
    form.setValues({
      descripcion: p.descripcion ?? '',
      medida: p.medida ?? '',
      marca: p.marca ?? '',
      modelo: p.modelo ?? '',
      specs: p.specs ?? '',
      stock: p.stock,
      precio_costo: p.precio_costo,
    });
    editModal.open();
  };

  const submitEdit = async (values: EditFormValues) => {
    if (!editing) return;
    try {
      await updateMut.mutateAsync({
        id: editing.id,
        input: {
          descripcion: values.descripcion,
          medida: values.medida,
          marca: values.marca,
          modelo: values.modelo,
          specs: values.specs,
          stock: values.stock,
          precio_costo: values.precio_costo,
        },
      });
      notifications.show({ color: 'green', message: 'Producto actualizado' });
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

  const openDelete = (p: Producto) => {
    setDeleting(p);
    delModal.open();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      notifications.show({ color: 'green', message: 'Producto eliminado' });
      delModal.close();
      setDeleting(null);
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Error al eliminar',
        message: getErrorMessage(err),
      });
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previewVenta = calcPrecioVenta(form.values.precio_costo);

  // Reset to page 1 whenever a filter changes.
  const resetPage = () => setPage(1);

  return (
    <Stack>
      <Title order={2}>Inventario</Title>

      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="md" wrap="wrap">
          <TextInput
            label="Medida"
            placeholder="225/45R17"
            value={medida}
            onChange={(e) => {
              setMedida(e.currentTarget.value);
              resetPage();
            }}
          />
          <TextInput
            label="Marca"
            placeholder="Michelin"
            value={marca}
            onChange={(e) => {
              setMarca(e.currentTarget.value);
              resetPage();
            }}
          />
          <TextInput
            label="Búsqueda libre"
            placeholder="Texto…"
            value={q}
            onChange={(e) => {
              setQ(e.currentTarget.value);
              resetPage();
            }}
          />
          <Checkbox
            label="Solo con stock"
            checked={conStock}
            onChange={(e) => {
              setConStock(e.currentTarget.checked);
              resetPage();
            }}
            mb={6}
          />
        </Group>
      </Paper>

      {isError && (
        <Alert color="red" title="Error">
          {getErrorMessage(error)}
        </Alert>
      )}

      {isLoading ? (
        <Paper withBorder radius="md">
          <Center p="xl">
            <Loader />
          </Center>
        </Paper>
      ) : items.length === 0 ? (
        <Paper withBorder radius="md">
          <Center p="xl">
            <Text c="dimmed">No se encontraron productos.</Text>
          </Center>
        </Paper>
      ) : (
        <>
          {/* Pantallas grandes: tabla */}
          <Paper withBorder radius="md" visibleFrom="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Medida</Table.Th>
                  <Table.Th>Marca</Table.Th>
                  <Table.Th>Modelo</Table.Th>
                  <Table.Th>Specs</Table.Th>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th>Precio venta</Table.Th>
                  <Table.Th>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{p.medida ?? '—'}</Table.Td>
                    <Table.Td>{p.marca ?? '—'}</Table.Td>
                    <Table.Td>{p.modelo ?? '—'}</Table.Td>
                    <Table.Td>{p.specs ?? '—'}</Table.Td>
                    <Table.Td>{p.stock}</Table.Td>
                    <Table.Td>{formatMXN(p.precio_venta)}</Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <ActionIcon
                          variant="subtle"
                          aria-label="Editar"
                          onClick={() => openEdit(p)}
                        >
                          <IconEdit size={18} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label="Eliminar"
                          onClick={() => openDelete(p)}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          {/* Móvil / tablet: tarjetas (sin scroll horizontal) */}
          <Stack hiddenFrom="md" gap="sm">
            {items.map((p) => (
              <Card key={p.id} withBorder radius="md" p="sm">
                <Text fw={700} mb={4}>{p.medida ?? '—'}</Text>
                <Text size="sm">
                  {[p.marca, p.modelo].filter(Boolean).join(' ') || '—'}
                </Text>
                {p.specs && (
                  <Text size="xs" c="dimmed">
                    {p.specs}
                  </Text>
                )}
                <Group justify="space-between" align="center" mt="xs">
                  <Text size="sm">
                    Stock:{' '}
                    <Text span fw={600}>
                      {p.stock}
                    </Text>
                  </Text>
                  <Text fw={700} c="teal.4">
                    {formatMXN(p.precio_venta)}
                  </Text>
                </Group>
                <Group gap="xs" mt="sm">
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconEdit size={16} />}
                    onClick={() => openEdit(p)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => openDelete(p)}
                  >
                    Eliminar
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        </>
      )}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {total} resultado{total === 1 ? '' : 's'}
        </Text>
        <Pagination value={page} onChange={setPage} total={totalPages} />
      </Group>

      {/* Edit modal */}
      <Modal
        opened={editOpened}
        onClose={() => {
          editModal.close();
          setEditing(null);
        }}
        title="Editar producto"
        centered
      >
        <form onSubmit={form.onSubmit(submitEdit)}>
          <Stack>
            <TextInput
              label="Descripción"
              {...form.getInputProps('descripcion')}
            />
            <Group grow>
              <TextInput label="Medida" {...form.getInputProps('medida')} />
              <TextInput label="Marca" {...form.getInputProps('marca')} />
            </Group>
            <Group grow>
              <TextInput label="Modelo" {...form.getInputProps('modelo')} />
              <TextInput label="Specs" {...form.getInputProps('specs')} />
            </Group>
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

      {/* Delete confirmation modal */}
      <Modal
        opened={delOpened}
        onClose={() => {
          delModal.close();
          setDeleting(null);
        }}
        title="Eliminar producto"
        centered
      >
        <Stack>
          <Text>
            ¿Seguro que deseas eliminar{' '}
            <Text span fw={600}>
              {deleting?.descripcion || deleting?.medida || `#${deleting?.id}`}
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
              Eliminar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
