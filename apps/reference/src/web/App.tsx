import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, BrowserRouter, Routes, useNavigate, useParams } from 'react-router-dom';
import { Anchor, AppShell, Button, Group, Loader, Stack, Text, Title } from '@mantine/core';
import type { DisplayDocument } from '@homeslate/schema';
import { Editor } from '@homeslate/editor';
import { Display } from '@homeslate/display';
import { createDebouncedPersist } from './editorPersist';
import { ReferenceGoogleRuntime } from './ReferenceGoogleRuntime';

type DisplaySummary = { id: string; name: string };
type DisplayRecord = { id: string; publicId: string; document: DisplayDocument };

const EDITOR_PUT_DEBOUNCE_MS = 400;
const KIOSK_POLL_MS = 10_000;

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DisplayListPage />} />
        <Route path="/edit/:id" element={<EditorPage />} />
        <Route path="/d/:publicId" element={<KioskPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function DisplayListPage() {
  const navigate = useNavigate();
  const [displays, setDisplays] = useState<Array<DisplaySummary & { publicId?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await getJson<DisplaySummary[]>('/api/displays');
        const withPublicIds = await Promise.all(
          list.map(async (item) => {
            const record = await getJson<DisplayRecord>(`/api/displays/${item.id}`);
            return { ...item, publicId: record.publicId };
          }),
        );
        if (!cancelled) setDisplays(withPublicIds);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createDisplay = async () => {
    setCreating(true);
    setError(null);
    try {
      const record = await postJson<DisplayRecord>('/api/displays');
      navigate(`/edit/${record.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setCreating(false);
    }
  };

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={3}>Homeslate</Title>
          <Button onClick={() => void createDisplay()} loading={creating}>
            New display
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        {loading && <Loader />}
        {error && <Text c="red">{error}</Text>}
        {!loading && displays.length === 0 && (
          <Text c="dimmed">No displays yet. Create one to open the editor.</Text>
        )}
        <Stack gap="sm" mt="md">
          {displays.map((display) => (
            <Group key={display.id} justify="space-between">
              <Text>{display.name}</Text>
              <Group gap="md">
                <Anchor component={Link} to={`/edit/${display.id}`}>
                  Editor
                </Anchor>
                {display.publicId && (
                  <Anchor component={Link} to={`/d/${display.publicId}`}>
                    Kiosk
                  </Anchor>
                )}
              </Group>
            </Group>
          ))}
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}

function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<DisplayRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persist = useMemo(
    () =>
      createDebouncedPersist((next: DisplayDocument) => {
        if (!id) return;
        void fetch(`/api/displays/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
          keepalive: true,
        });
      }, EDITOR_PUT_DEBOUNCE_MS),
    [id],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await getJson<DisplayRecord>(`/api/displays/${id}`);
        if (!cancelled) setRecord(next);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    return () => {
      persist.flush();
      persist.dispose();
    };
  }, [persist]);

  const onChange = useCallback(
    (next: DisplayDocument) => {
      setRecord((current) => (current ? { ...current, document: next } : current));
      persist.schedule(next);
    },
    [persist],
  );

  if (error) return <Text c="red" p="md">{error}</Text>;
  if (!record) return <Loader m="md" />;

  const viewId = record.document.activeViewId ?? record.document.views[0].id;

  return (
    <ReferenceGoogleRuntime displayId={record.publicId}>
      <AppShell header={{ height: 56 }} padding={0}>
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Anchor component={Link} to="/">Displays</Anchor>
              <Title order={4}>{record.document.name}</Title>
            </Group>
            <Button component={Link} to={`/d/${record.publicId}`} variant="default">
              Open kiosk
            </Button>
          </Group>
        </AppShell.Header>
        <AppShell.Main style={{ height: 'calc(100vh - 56px)', display: 'flex' }}>
          <Editor
            document={record.document}
            viewId={viewId}
            onChange={onChange}
          />
        </AppShell.Main>
      </AppShell>
    </ReferenceGoogleRuntime>
  );
}

function KioskPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const [document, setDocument] = useState<DisplayDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const body = await getJson<{ document: DisplayDocument }>(`/api/public/${publicId}`);
        if (!cancelled) {
          setDocument(body.document);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    };

    void load();
    const interval = setInterval(() => void load(), KIOSK_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicId]);

  const onChange = useCallback(
    (next: DisplayDocument) => {
      setDocument(next);
      if (!publicId) return;
      void fetch(`/api/public/${publicId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    },
    [publicId],
  );

  if (error && !document) return <Text c="red" p="md">{error}</Text>;
  if (!document || !publicId) return <Loader m="md" />;

  return (
    <ReferenceGoogleRuntime displayId={publicId}>
      <Display document={document} onChange={onChange} />
    </ReferenceGoogleRuntime>
  );
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}
