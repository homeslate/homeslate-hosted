import { useEffect, useState, useCallback } from 'react';
import { Center, Paper, Title, Text, Stack, Code, Loader, CopyButton, Tooltip, ActionIcon, Box } from '@mantine/core';
import { IconLayoutDashboard, IconCopy, IconCheck } from '@tabler/icons-react';
import { apiClient, ApiError } from '../services/apiClient';
import { persistDisplayId } from '../displayPersistence';
import type { PairCreateResponse, PairStatusResponse } from '../types/api';
import classes from './PairPage.module.css';

const POLL_INTERVAL_MS = 2000;

export function PairPage() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'pending' | 'expired' | 'claimed'>('loading');

  const fetchStatus = useCallback(async (c: string) => {
    const data = await apiClient.get<PairStatusResponse>('/api/pair', {
      query: { code: c },
    });
    if (data.status === 'claimed' && data.displayId) {
      setStatus('claimed');
      persistDisplayId(data.displayId);
      window.location.href = `/?display=${data.displayId}`;
      return;
    }
    if (data.status === 'expired') setStatus('expired');
    else if (data.status === 'invalid') setStatus('expired');
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function createPairing() {
      try {
        const data = await apiClient.post<PairCreateResponse>('/api/pair');
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setStatus('expired');
          return;
        }
        if (data.code) {
          setCode(data.code);
          setStatus('pending');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to get pairing code');
          setStatus('expired');
        }
      }
    }

    createPairing();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status !== 'pending' || !code) return;
    const t = setInterval(() => fetchStatus(code), POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [status, code, fetchStatus]);

  if (status === 'loading' && !code) {
    return (
      <div className={classes.root}>
        <Center className={classes.center}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Getting pairing code…</Text>
          </Stack>
        </Center>
      </div>
    );
  }

  if (status === 'expired' || error) {
    return (
      <div className={classes.root}>
        <Center className={classes.center}>
          <Paper className={classes.card} p="xl" radius="lg">
            <Stack align="center" gap="lg">
              <div className={classes.iconWrap}>
                <IconLayoutDashboard size={48} />
              </div>
              <Title order={2} className={classes.title}>
                {error ? 'Something went wrong' : 'Code expired'}
              </Title>
              <Text c="dimmed" size="sm" ta="center">
                {error ?? 'Refresh the page to get a new pairing code.'}
              </Text>
              <Text
                component="button"
                size="sm"
                c="indigo"
                style={{ cursor: 'pointer', background: 'none', border: 'none' }}
                onClick={() => window.location.reload()}
              >
                Refresh page
              </Text>
            </Stack>
          </Paper>
        </Center>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      <Center className={classes.center}>
        <Paper className={classes.card} p="xl" radius="lg">
          <Stack align="center" gap="lg">
            <div className={classes.iconWrap}>
              <IconLayoutDashboard size={48} />
            </div>
            <Title order={2} className={classes.title}>
              Register this display
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              Open the management app, go to Your Displays, and enter this code to link this device.
            </Text>
            <Box className={classes.codeWrap}>
              <Code className={classes.code} block>
                {code}
              </Code>
              <CopyButton value={code ?? ''} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Copied!' : 'Copy code'} withArrow>
                    <ActionIcon variant="subtle" size="lg" onClick={copy}>
                      {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Box>
            <Text size="xs" c="dimmed" ta="center">
              This code expires in 15 minutes. Waiting for you to register…
            </Text>
          </Stack>
        </Paper>
      </Center>
    </div>
  );
}
