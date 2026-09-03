import { Center, Paper, Title, Text, Button, Stack, Anchor } from '@mantine/core';
import { IconLayoutDashboard, IconBrandGoogle } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import classes from './AuthPage.module.css';

export function AuthPage() {
  const { signIn, isLoading } = useAuth();

  return (
    <div className={classes.root}>
      <Center className={classes.center}>
        <Paper className={classes.card} p="xl" radius="lg">
          <Stack align="center" gap="lg">
            <div className={classes.iconWrap}>
              <IconLayoutDashboard size={48} />
            </div>
            <Stack align="center" gap={4}>
              <Title order={2} className={classes.title}>Homeslate</Title>
              <Text c="dimmed" size="sm" ta="center">
                Manage your home displays from any device
              </Text>
            </Stack>
            <Button
              leftSection={<IconBrandGoogle size={18} />}
              onClick={signIn}
              loading={isLoading}
              size="md"
              fullWidth
            >
              Sign in with Google
            </Button>
            <Text size="xs" c="dimmed" ta="center">
              <Anchor component={Link} to="/" c="dimmed" underline="hover">
                About Homeslate
              </Anchor>
              {' · '}
              <Anchor component={Link} to="/privacy" c="dimmed" underline="hover">
                Privacy
              </Anchor>
              {' · '}
              <Anchor component={Link} to="/terms" c="dimmed" underline="hover">
                Terms
              </Anchor>
            </Text>
          </Stack>
        </Paper>
      </Center>
    </div>
  );
}
