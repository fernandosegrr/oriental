import {
  ActionIcon,
  Affix,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconMessageChatbot, IconSend, IconX } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { api, getErrorMessage } from '../api/client';

interface Msg {
  from: 'bot' | 'user';
  text: string;
}

const GREETING =
  'Hola, soy el asistente del sistema. Pregúntame cómo cargar el Excel, agregar o editar productos, usar los filtros, los precios, etc.';

export function HelpChat() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const [messages, setMessages] = useState<Msg[]>([{ from: 'bot', text: GREETING }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
  }, [messages, opened, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const history: Msg[] = [...messages, { from: 'user', text }];
    setMessages(history);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post<{ reply: string }>('/assistant', {
        messages: history.map((m) => ({
          role: m.from === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
      });
      setMessages((m) => [...m, { from: 'bot', text: data.reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { from: 'bot', text: getErrorMessage(err, 'No pude responder ahora mismo. Intenta de nuevo.') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Affix position={{ bottom: 20, right: 20 }}>
      {opened ? (
        <Paper
          withBorder
          shadow="lg"
          radius="md"
          w={360}
          maw="calc(100vw - 40px)"
          h={460}
          mah="calc(100vh - 120px)"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <Group
            justify="space-between"
            px="sm"
            py="xs"
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
          >
            <Group gap="xs">
              <IconMessageChatbot size={20} />
              <Title order={6}>Asistente del sistema</Title>
            </Group>
            <ActionIcon variant="subtle" color="gray" onClick={close} aria-label="Cerrar">
              <IconX size={18} />
            </ActionIcon>
          </Group>

          <ScrollArea style={{ flex: 1 }} viewportRef={viewport} p="sm">
            <Stack gap="xs">
              {messages.map((m, i) => (
                <Group key={i} justify={m.from === 'user' ? 'flex-end' : 'flex-start'} wrap="nowrap">
                  <Paper
                    p="xs"
                    radius="md"
                    maw="80%"
                    withBorder={m.from === 'bot'}
                    bg={m.from === 'user' ? 'blue' : undefined}
                    c={m.from === 'user' ? 'white' : undefined}
                  >
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {m.text}
                    </Text>
                  </Paper>
                </Group>
              ))}
              {loading && (
                <Group justify="flex-start" wrap="nowrap">
                  <Paper p="xs" radius="md" withBorder>
                    <Group gap="xs">
                      <Loader size="xs" />
                      <Text size="sm" c="dimmed">
                        Escribiendo…
                      </Text>
                    </Group>
                  </Paper>
                </Group>
              )}
            </Stack>
          </ScrollArea>

          <Group
            gap="xs"
            p="sm"
            wrap="nowrap"
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
          >
            <TextInput
              style={{ flex: 1 }}
              placeholder="Escribe tu duda…"
              value={input}
              disabled={loading}
              onChange={(e) => setInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <ActionIcon size={36} onClick={() => void send()} loading={loading} aria-label="Enviar">
              <IconSend size={18} />
            </ActionIcon>
          </Group>
        </Paper>
      ) : (
        <ActionIcon
          size={56}
          radius="xl"
          variant="filled"
          onClick={toggle}
          aria-label="Abrir asistente del sistema"
        >
          <IconMessageChatbot size={28} />
        </ActionIcon>
      )}
    </Affix>
  );
}
