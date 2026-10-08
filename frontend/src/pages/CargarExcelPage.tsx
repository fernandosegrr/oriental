import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  List,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { Dropzone, type FileWithPath } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconFileSpreadsheet,
  IconInfoCircle,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { getErrorDetalles, getErrorMessage, type FormatoExcelDetalles } from '../api/client';
import { useUploadExcel } from '../api/hooks';
import type { Proveedor, UploadResult } from '../api/types';
import { useAuth } from '../auth/AuthContext';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const PROVEEDOR: Proveedor = 'LLANTERO_OFICIAL';

/** Panel con los formatos aceptados — se muestra cuando el Excel no es reconocido. */
function PanelFormatosAceptados({ detalles }: { detalles: FormatoExcelDetalles | null }) {
  const formatos = detalles?.formatosAceptados ?? [
    {
      nombre: 'Formato clásico (una hoja)',
      columnas: [
        'A: DESCRIPCION',
        'B: PRECIO DE LISTA (precio_venta)',
        'C: PRECIO CON % DESC. (precio_costo)',
      ],
    },
    {
      nombre: 'Formato nuevo (una o varias hojas)',
      columnas: [
        'A: DESCRIPCION',
        'B: EXISTS. (existencias, se ignora)',
        'E: PRECIO CON 25% DESC. (precio_costo)',
        'F: PRECIO DE LISTA (precio_venta)',
      ],
    },
  ];
  const ejemplo = detalles?.ejemploFila ?? {
    descripcion: 'P175/70R13 GOODYEAR ASSURANCE 82T BLK',
    precioLista: 1007,
    precio25Desc: 755,
  };

  return (
    <Stack gap="xs" mt="xs">
      <Text size="sm" fw={600}>
        Formatos aceptados:
      </Text>

      {formatos.map((fmt) => (
        <Card key={fmt.nombre} withBorder radius="sm" p="sm" bg="gray.0">
          <Text size="sm" fw={600} mb={4}>
            {fmt.nombre}
          </Text>
          <List size="sm" spacing={2}>
            {fmt.columnas.map((col) => (
              <List.Item key={col}>
                <Code style={{ overflowWrap: 'anywhere' }}>{col}</Code>
              </List.Item>
            ))}
          </List>
        </Card>
      ))}

      <Card withBorder radius="sm" p="sm" bg="gray.0">
        <Text size="sm" fw={600} mb={4}>
          Ejemplo de fila válida:
        </Text>
        <Stack gap={2}>
          <Group gap="xs" wrap="wrap">
            <Badge color="blue" variant="light" size="sm">
              Descripción
            </Badge>
            <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
              {ejemplo.descripcion}
            </Text>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Badge color="green" variant="light" size="sm">
              Precio lista
            </Badge>
            <Text size="sm">${ejemplo.precioLista}</Text>
          </Group>
          <Group gap="xs" wrap="wrap">
            <Badge color="orange" variant="light" size="sm">
              25% desc.
            </Badge>
            <Text size="sm">${ejemplo.precio25Desc}</Text>
          </Group>
        </Stack>
      </Card>
    </Stack>
  );
}

export function CargarExcelPage() {
  const { user } = useAuth();
  const isVisor = user?.rol === 'visor';
  const [file, setFile] = useState<FileWithPath | null>(null);
  const [preview, setPreview] = useState<UploadResult | null>(null);
  const [formatoError, setFormatoError] = useState<{
    message: string;
    detalles: FormatoExcelDetalles | null;
  } | null>(null);

  const uploadMut = useUploadExcel();

  const reset = () => {
    setFile(null);
    setPreview(null);
    setFormatoError(null);
  };

  const handleDrop = async (files: FileWithPath[]) => {
    if (isVisor) {
      notifications.show({ color: 'blue', title: 'Acceso restringido', message: 'Solo tienes acceso de vista.' });
      return;
    }
    const dropped = files[0];
    if (!dropped) return;
    setFile(dropped);
    setPreview(null);
    setFormatoError(null);
    try {
      const result = await uploadMut.mutateAsync({
        file: dropped,
        proveedor: PROVEEDOR,
        dryRun: true,
      });
      setPreview(result);
    } catch (err) {
      setFile(null);
      setPreview(null);
      const message = getErrorMessage(err);
      const detalles = getErrorDetalles(err);
      setFormatoError({ message, detalles });
      notifications.show({
        color: 'red',
        title: 'No se pudo analizar el archivo',
        message,
      });
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    try {
      await uploadMut.mutateAsync({ file, proveedor: PROVEEDOR, dryRun: false });
      notifications.show({
        color: 'green',
        title: 'Carga completada',
        message: 'Inventario de Llantero Oficial reemplazado correctamente.',
      });
      reset();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Error en la carga',
        message: getErrorMessage(err),
      });
    }
  };

  const analyzing = uploadMut.isPending && !preview;
  const stats = preview?.stats;
  const sample = preview?.sample ?? [];

  return (
    <Stack maw={760}>
      <Title order={2}>Cargar Excel</Title>

      {!stats && !formatoError && (
        <>
          <Dropzone
            onDrop={handleDrop}
            accept={[XLSX_MIME]}
            maxFiles={1}
            multiple={false}
            disabled={uploadMut.isPending}
          >
            <Group
              justify="center"
              gap="xl"
              mih={140}
              style={{ pointerEvents: 'none' }}
            >
              <Dropzone.Accept>
                <IconUpload size={48} />
              </Dropzone.Accept>
              <Dropzone.Reject>
                <IconX size={48} />
              </Dropzone.Reject>
              <Dropzone.Idle>
                {analyzing ? <Loader size={48} /> : <IconFileSpreadsheet size={48} />}
              </Dropzone.Idle>
              <div>
                {analyzing ? (
                  <Text size="lg" c="dimmed">Analizando archivo…</Text>
                ) : (
                  <>
                    <Text size="lg">Arrastra el archivo .xlsx de Llantero Oficial</Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      o haz clic aquí para seleccionarlo
                    </Text>
                  </>
                )}
              </div>
            </Group>
          </Dropzone>
        </>
      )}

      {/* Error de formato no reconocido */}
      {formatoError && (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title="Formato no reconocido"
          withCloseButton
          onClose={reset}
        >
          <Text size="sm" mb="xs">
            {formatoError.message}
          </Text>
          <PanelFormatosAceptados detalles={formatoError.detalles} />
        </Alert>
      )}

      {/* Vista previa tras análisis exitoso */}
      {stats && (
        <Paper withBorder p="md" radius="md">
          <Stack>
            <Group gap="xs" wrap="wrap">
              <IconCircleCheck size={18} color="green" />
              <Text>
                Hoja(s) detectada(s):{' '}
                <Text span fw={600}>
                  {stats.hojaUsada}
                </Text>{' '}
                · {stats.total} filas ({stats.sinMedida} sin medida)
              </Text>
            </Group>

            <Alert
              color="yellow"
              icon={<IconAlertTriangle size={18} />}
              title="Atención"
            >
              Confirmar esta carga{' '}
              <Text span fw={700}>
                REEMPLAZARÁ todo el inventario de Llantero Oficial
              </Text>
              . Esta acción no se puede deshacer.
            </Alert>

            {sample.length > 0 && (
              <>
                <Group gap="xs">
                  <IconInfoCircle size={16} />
                  <Text size="sm" c="dimmed">
                    Muestra de los primeros 5 productos detectados:
                  </Text>
                </Group>

                {/* Pantallas medianas+: tabla */}
                <Paper withBorder radius="sm" visibleFrom="sm">
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Medida</Table.Th>
                        <Table.Th>Marca</Table.Th>
                        <Table.Th>Modelo</Table.Th>
                        <Table.Th>Precio lista</Table.Th>
                        <Table.Th>25% desc.</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sample.slice(0, 5).map((p, i) => (
                        <Table.Tr key={p.id ?? i}>
                          <Table.Td>{p.medida ?? '—'}</Table.Td>
                          <Table.Td>{p.marca ?? '—'}</Table.Td>
                          <Table.Td>{p.modelo ?? '—'}</Table.Td>
                          <Table.Td>${p.precio_venta ?? '—'}</Table.Td>
                          <Table.Td>${p.precio_costo ?? '—'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>

                {/* Móvil: tarjetas apiladas */}
                <Stack hiddenFrom="sm" gap="xs">
                  {sample.slice(0, 5).map((p, i) => (
                    <Card key={p.id ?? i} withBorder radius="md" p="sm">
                      <Text fw={700} style={{ overflowWrap: 'anywhere' }}>
                        {p.medida ?? '—'}
                      </Text>
                      <Text size="sm" style={{ overflowWrap: 'anywhere' }}>
                        {[p.marca, p.modelo].filter(Boolean).join(' ') || '—'}
                      </Text>
                      <Group gap="xs" mt={4} wrap="wrap">
                        <Text size="sm">
                          Lista:{' '}
                          <Text span fw={600}>
                            ${p.precio_venta ?? '—'}
                          </Text>
                        </Text>
                        <Text size="sm">
                          25% desc.:{' '}
                          <Text span fw={600}>
                            ${p.precio_costo ?? '—'}
                          </Text>
                        </Text>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </>
            )}

            <Group justify="flex-end">
              <Button variant="default" onClick={reset}>
                Cancelar
              </Button>
              <Button
                color="red"
                loading={uploadMut.isPending}
                onClick={handleConfirm}
              >
                Confirmar carga
              </Button>
            </Group>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
