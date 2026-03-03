import {
  Modal,
  Stack,
  Text,
  Group,
  CopyButton,
  Code,
  Divider,
  ActionIcon,
  Tooltip,
  Box,
} from '@mantine/core';
import { QRCodeSVG } from 'qrcode.react';
import { IconCopy, IconCheck, IconExternalLink } from '@tabler/icons-react';

interface Props {
  opened: boolean;
  onClose: () => void;
  displayId: string;
  displayName: string;
}

export function ShareDisplayModal({ opened, onClose, displayId, displayName }: Props) {
  const url = `${window.location.origin}/?display=${displayId}`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Share "${displayName}"`}
      centered
      size="sm"
    >
      <Stack gap="lg">
        <Stack gap="xs" align="center">
          <Text size="sm" c="dimmed">Scan to open on a display device</Text>
          <Box
            style={{
              background: 'white',
              padding: 12,
              borderRadius: 8,
              display: 'inline-block',
              lineHeight: 0,
            }}
          >
            <QRCodeSVG value={url} size={200} />
          </Box>
        </Stack>

        <Divider label="or copy the URL" labelPosition="center" />

        <Group gap="xs" wrap="nowrap">
          <Code
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              fontSize: 11,
            }}
          >
            {url}
          </Code>
          <CopyButton value={url} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied!' : 'Copy URL'} withArrow>
                <ActionIcon
                  variant={copied ? 'filled' : 'default'}
                  color={copied ? 'teal' : undefined}
                  onClick={copy}
                  size="lg"
                  flex="0 0 auto"
                >
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
          <Tooltip label="Open in new tab" withArrow>
            <ActionIcon
              variant="default"
              size="lg"
              flex="0 0 auto"
              onClick={() => window.open(url, '_blank')}
            >
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
}
