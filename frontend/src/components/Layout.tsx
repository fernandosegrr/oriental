import {
  AppShell,
  Burger,
  Button,
  Group,
  NavLink,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconBoxSeam,
  IconLogout,
  IconPlus,
  IconUpload,
  IconUsers,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import {
  NavLink as RouterNavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { HelpChat } from './HelpChat';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Inventario', to: '/', icon: <IconBoxSeam size={18} /> },
  { label: 'Cargar Excel', to: '/cargar', icon: <IconUpload size={18} /> },
  { label: 'Agregar producto', to: '/agregar', icon: <IconPlus size={18} /> },
  {
    label: 'Usuarios',
    to: '/usuarios',
    icon: <IconUsers size={18} />,
    adminOnly: true,
  },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, { toggle, close }] = useDisclosure();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.rol === 'admin',
  );

  return (
    <>
      <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 240,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>Llantas Oriental</Title>
          </Group>
          <Group>
            {user && (
              <Text size="sm" fw={500}>
                {user.nombre}
              </Text>
            )}
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
            >
              Salir
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            component={RouterNavLink}
            to={item.to}
            label={item.label}
            leftSection={item.icon}
            active={
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to)
            }
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
      </AppShell>
      <HelpChat />
    </>
  );
}
