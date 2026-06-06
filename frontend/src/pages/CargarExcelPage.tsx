import {
  Alert,
  Button,
  Card,
  Center,
  Group,
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
  IconFileSpreadsheet,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { getErrorMessage } from '../api/client';
import { useUploadExcel } from '../api/hooks';
import type { Proveedor, UploadResult } from '../api/types';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const PROVEEDOR: Proveedor = 'LLANTERO_OFICIAL';

export function CargarExcelPage() {
  const [file, setFile] = useState<FileWithPath | null>(null);
  const [preview, setPreview] = useState<UploadResult | null>(null);

  const uploadMut = useUploadExcel();

  const reset = () => {
    setFile(null);
    setPreview(null);
  };

  const handleDrop = async (files: FileWithPath[]) => {
    const dropped = files[0];
    if (!dropped) return;
    setFile(dropped);
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
      notifications.show({
        color: 'red',
        title: 'No se pudo analizar el archivo',
        message: getErrorMessage(err),
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

      <Dropzone
        onDrop={handleDrop}
        accept={[XLSX_MIME]}
        maxFiles={1}
        multiple={false}
        disabled={uploadMut.isPending}
        loading={analyzing}
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
            <IconFileSpreadsheet size={48} />
          </Dropzone.Idle>
          <div>
            <Text size="lg">Arrastra el archivo .xlsx de Llantero Oficial</Text>
            <Text size="sm" c="dimmed" mt={4}>
              o haz clic aquí para seleccionarlo
            </Text>
          </div>
        </Group>
      </Dropzone>

      {analyzing && (
        <Center>
          <Loader size="sm" />
        </Center>
      )}

      {stats && (
        <Paper withBorder p="md" radius="md">
          <Stack>
            <Text>
              Hoja detectada:{' '}
              <Text span fw={600}>
                {stats.hojaUsada}
              </Text>{' '}
              · {stats.total} filas ({stats.sinMedida} sin medida)
            </Text>

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
                {/* Pantallas medianas+: tabla */}
                <Paper withBorder radius="sm" visibleFrom="sm">
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Medida</Table.Th>
                        <Table.Th>Marca</Table.Th>
                        <Table.Th>Modelo</Table.Th>
                        <Table.Th>Stock</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sample.slice(0, 5).map((p, i) => (
                        <Table.Tr key={p.id ?? i}>
                          <Table.Td>{p.medida ?? '—'}</Table.Td>
                          <Table.Td>{p.marca ?? '—'}</Table.Td>
                          <Table.Td>{p.modelo ?? '—'}</Table.Td>
                          <Table.Td>{p.stock}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>

                {/* Móvil: tarjetas */}
                <Stack hiddenFrom="sm" gap="xs">
                  {sample.slice(0, 5).map((p, i) => (
                    <Card key={p.id ?? i} withBorder radius="md" p="sm">
                      <Text fw={700}>{p.medida ?? '—'}</Text>
                      <Text size="sm">
                        {[p.marca, p.modelo].filter(Boolean).join(' ') || '—'}
                      </Text>
                      <Text size="sm" mt={4}>
                        Stock:{' '}
                        <Text span fw={600}>
                          {p.stock}
                        </Text>
                      </Text>
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
