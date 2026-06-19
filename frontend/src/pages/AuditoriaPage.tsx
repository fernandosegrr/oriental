import {
  Alert,
  Badge,
  Card,
  Center,
  Collapse,
  Group,
  Loader,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { IconActivity, IconChevronDown, IconChevronRight, IconRobot } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { getErrorMessage } from '../api/client';
import { formatMXN } from '../api/format';
import { useAuditLogs, useSearchLogs } from '../api/hooks';
import type { AuditLog, AuditLogsFilters, BotSearchLog, SearchLogsFilters } from '../api/types';

const PAGE_SIZE = 40;

/* ─── helpers ─── */

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(iso));
}

/* ─── Bot search logs ─── */

const ESTRATEGIA_LABELS: Record<string, { label: string; color: string }> = {
  exacta:        { label: 'Exacta',        color: 'teal' },
  prefijo:       { label: 'Prefijo',       color: 'blue' },
  digitos:       { label: 'Solo dígitos',  color: 'cyan' },
  flotacion:     { label: 'Flotación',     color: 'indigo' },
  texto_libre:   { label: 'Texto libre',   color: 'orange' },
  sin_resultado: { label: 'Sin resultado', color: 'red' },
};

function EstrategiaBadge({ estrategia }: { estrategia: string | null }) {
  const info = estrategia
    ? (ESTRATEGIA_LABELS[estrategia] ?? { label: estrategia, color: 'gray' })
    : { label: '—', color: 'gray' };
  return <Badge color={info.color} variant="light" size="sm">{info.label}</Badge>;
}

function OpcionesRow({ log }: { log: BotSearchLog }) {
  const [opened, { toggle }] = useDisclosure(false);
  if (log.total_resultados === 0) return <Text size="xs" c="dimmed">Sin resultados</Text>;
  return (
    <>
      <Group gap={4} style={{ cursor: 'pointer' }} onClick={toggle}>
        {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        <Text size="xs" c="dimmed">
          {log.total_resultados} opción{log.total_resultados !== 1 ? 'es' : ''}
        </Text>
      </Group>
      <Collapse in={opened}>
        <Stack gap={2} mt={4}>
          {log.opciones.map((o, idx) => (
            <Text key={idx} size="xs">
              {[o.marca, o.modelo].filter(Boolean).join(' ') || '—'}
              {' — '}
              <Text span fw={600} c="teal.6">{formatMXN(o.precio_lista)}</Text>
            </Text>
          ))}
        </Stack>
      </Collapse>
    </>
  );
}

function ConsultasBotTab() {
  const [medida, setMedida] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [debMedida] = useDebouncedValue(medida, 400);
  const [debFrom] = useDebouncedValue(from, 400);
  const [debTo] = useDebouncedValue(to, 400);

  const filters: SearchLogsFilters = useMemo(
    () => ({ medida: debMedida || undefined, from: debFrom || undefined, to: debTo || undefined, page, pageSize: PAGE_SIZE }),
    [debMedida, debFrom, debTo, page],
  );
  const { data, isLoading, isError, error } = useSearchLogs(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const resetPage = () => setPage(1);

  return (
    <Stack>
      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="md" wrap="wrap">
          <TextInput label="Medida" placeholder="225/65R17" value={medida}
            onChange={(e) => { setMedida(e.currentTarget.value); resetPage(); }} />
          <TextInput label="Desde" type="date" value={from}
            onChange={(e) => { setFrom(e.currentTarget.value); resetPage(); }} />
          <TextInput label="Hasta" type="date" value={to}
            onChange={(e) => { setTo(e.currentTarget.value); resetPage(); }} />
        </Group>
      </Paper>

      {isError && <Alert color="red" title="Error">{getErrorMessage(error)}</Alert>}

      {isLoading ? (
        <Paper withBorder radius="md"><Center p="xl"><Loader /></Center></Paper>
      ) : items.length === 0 ? (
        <Paper withBorder radius="md"><Center p="xl"><Text c="dimmed">Sin consultas registradas.</Text></Center></Paper>
      ) : (
        <>
          <Paper withBorder radius="md" visibleFrom="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha / hora</Table.Th>
                  <Table.Th>Medida buscada</Table.Th>
                  <Table.Th>Medida norm</Table.Th>
                  <Table.Th>Estrategia</Table.Th>
                  <Table.Th>Resultados</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td><Text size="sm" style={{ whiteSpace: 'nowrap' }}>{formatFecha(log.consultado_at)}</Text></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{log.medida}</Text>
                      {log.marca && <Text size="xs" c="dimmed">marca: {log.marca}</Text>}
                    </Table.Td>
                    <Table.Td><Text size="xs" ff="monospace" c="dimmed">{log.medida_norm ?? '—'}</Text></Table.Td>
                    <Table.Td><EstrategiaBadge estrategia={log.estrategia} /></Table.Td>
                    <Table.Td><OpcionesRow log={log} /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          <Stack hiddenFrom="md" gap="sm">
            {items.map((log) => (
              <Card key={log.id} withBorder radius="md" p="sm">
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">{formatFecha(log.consultado_at)}</Text>
                  <EstrategiaBadge estrategia={log.estrategia} />
                </Group>
                <Text fw={600}>{log.medida}</Text>
                {log.medida_norm && <Text size="xs" c="dimmed" ff="monospace">{log.medida_norm}</Text>}
                {log.marca && <Text size="xs" c="dimmed">marca: {log.marca}</Text>}
                <OpcionesRow log={log} />
              </Card>
            ))}
          </Stack>
        </>
      )}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">{total} consulta{total === 1 ? '' : 's'}</Text>
        <Pagination value={page} onChange={setPage} total={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
      </Group>
    </Stack>
  );
}

/* ─── Audit logs (logins + Excel) ─── */

const TIPO_LABELS: Record<string, { label: string; color: string }> = {
  login_ok:    { label: 'Login exitoso', color: 'teal' },
  login_fallo: { label: 'Login fallido', color: 'red' },
  excel_carga: { label: 'Carga Excel',   color: 'blue' },
};

function TipoBadge({ tipo }: { tipo: string }) {
  const info = TIPO_LABELS[tipo] ?? { label: tipo, color: 'gray' };
  return <Badge color={info.color} variant="light" size="sm">{info.label}</Badge>;
}

function DetalleRow({ log }: { log: AuditLog }) {
  const [opened, { toggle }] = useDisclosure(false);
  const d = log.detalle;
  if (!d || Object.keys(d).length === 0) return null;

  if (log.tipo === 'excel_carga') {
    return (
      <>
        <Group gap={4} style={{ cursor: 'pointer' }} onClick={toggle}>
          {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <Text size="xs" c="dimmed">ver detalle</Text>
        </Group>
        <Collapse in={opened}>
          <Stack gap={2} mt={4}>
            <Text size="xs">Proveedor: <Text span fw={600}>{String(d.proveedor ?? '—')}</Text></Text>
            <Text size="xs">Hoja: <Text span fw={600}>{String(d.hoja ?? '—')}</Text></Text>
            <Text size="xs">Total filas: <Text span fw={600}>{String(d.total ?? 0)}</Text></Text>
            <Text size="xs">Con medida: <Text span fw={600} c="teal.6">{String(d.con_medida ?? 0)}</Text></Text>
            <Text size="xs">Sin medida: <Text span fw={600} c="orange.6">{String(d.sin_medida ?? 0)}</Text></Text>
          </Stack>
        </Collapse>
      </>
    );
  }
  return null;
}

function ActividadTab() {
  const [tipo, setTipo] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [debFrom] = useDebouncedValue(from, 400);
  const [debTo] = useDebouncedValue(to, 400);

  const filters: AuditLogsFilters = useMemo(
    () => ({ tipo: tipo ?? undefined, from: debFrom || undefined, to: debTo || undefined, page, pageSize: PAGE_SIZE }),
    [tipo, debFrom, debTo, page],
  );
  const { data, isLoading, isError, error } = useAuditLogs(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const resetPage = () => setPage(1);

  return (
    <Stack>
      <Paper withBorder p="md" radius="md">
        <Group align="flex-end" gap="md" wrap="wrap">
          <Select
            label="Tipo de evento"
            placeholder="Todos"
            clearable
            value={tipo}
            onChange={(v) => { setTipo(v); resetPage(); }}
            data={[
              { value: 'login_ok',    label: 'Login exitoso' },
              { value: 'login_fallo', label: 'Login fallido' },
              { value: 'excel_carga', label: 'Carga Excel' },
            ]}
          />
          <TextInput label="Desde" type="date" value={from}
            onChange={(e) => { setFrom(e.currentTarget.value); resetPage(); }} />
          <TextInput label="Hasta" type="date" value={to}
            onChange={(e) => { setTo(e.currentTarget.value); resetPage(); }} />
        </Group>
      </Paper>

      {isError && <Alert color="red" title="Error">{getErrorMessage(error)}</Alert>}

      {isLoading ? (
        <Paper withBorder radius="md"><Center p="xl"><Loader /></Center></Paper>
      ) : items.length === 0 ? (
        <Paper withBorder radius="md"><Center p="xl"><Text c="dimmed">Sin actividad registrada.</Text></Center></Paper>
      ) : (
        <>
          <Paper withBorder radius="md" visibleFrom="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha / hora</Table.Th>
                  <Table.Th>Evento</Table.Th>
                  <Table.Th>Usuario</Table.Th>
                  <Table.Th>Detalle</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td><Text size="sm" style={{ whiteSpace: 'nowrap' }}>{formatFecha(log.evento_at)}</Text></Table.Td>
                    <Table.Td><TipoBadge tipo={log.tipo} /></Table.Td>
                    <Table.Td><Text size="sm">{log.usuario_email ?? '—'}</Text></Table.Td>
                    <Table.Td><DetalleRow log={log} /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>

          <Stack hiddenFrom="md" gap="sm">
            {items.map((log) => (
              <Card key={log.id} withBorder radius="md" p="sm">
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">{formatFecha(log.evento_at)}</Text>
                  <TipoBadge tipo={log.tipo} />
                </Group>
                <Text size="sm" fw={500}>{log.usuario_email ?? '—'}</Text>
                <DetalleRow log={log} />
              </Card>
            ))}
          </Stack>
        </>
      )}

      <Group justify="space-between">
        <Text size="sm" c="dimmed">{total} evento{total === 1 ? '' : 's'}</Text>
        <Pagination value={page} onChange={setPage} total={Math.max(1, Math.ceil(total / PAGE_SIZE))} />
      </Group>
    </Stack>
  );
}

/* ─── Page ─── */

export function AuditoriaPage() {
  return (
    <Stack>
      <Title order={2}>Auditoría</Title>
      <Tabs defaultValue="actividad">
        <Tabs.List mb="md">
          <Tabs.Tab value="actividad" leftSection={<IconActivity size={16} />}>
            Actividad del sistema
          </Tabs.Tab>
          <Tabs.Tab value="bot" leftSection={<IconRobot size={16} />}>
            Consultas del bot
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="actividad">
          <ActividadTab />
        </Tabs.Panel>
        <Tabs.Panel value="bot">
          <ConsultasBotTab />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
