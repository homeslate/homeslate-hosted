import type { StickyNote } from './widget';
import type { ColorMode, DisplayTheme } from './theme';
import type { ThemeDocument } from '../themes/themeDocumentValidation';
import type { HolidayId } from '../holidays/registry';

export interface ApiOkResponse {
  ok: true;
}

export interface DisplayDto {
  id: string;
  display_id: string;
  name: string;
  created_at?: string;
  passcode_enabled?: boolean;
}

export interface PairCreateResponse {
  code?: string;
  error?: string;
}

export interface PairStatusResponse {
  status: 'invalid' | 'expired' | 'pending' | 'claimed';
  displayId?: string;
}

export interface ClaimDisplayRequest {
  code: string;
}

export type ClaimDisplayResponse = DisplayDto;

export interface DisplayRenameRequest {
  name: string;
}

export interface DisplayPasscodeRequest {
  passcode: string | null;
}

export interface ConfigUpsertRequest {
  layouts: unknown[];
  activeLayoutId: string | null;
  rotationEnabled: boolean;
  rotationIntervalMs: number;
  theme?: DisplayTheme | Record<string, unknown>;
  themeDocuments?: ThemeDocument[];
  activeThemeDocumentId?: string | null;
  colorMode?: ColorMode;
  stickyNotesEnabled?: boolean;
  holidayEffectsEnabled?: boolean;
  holidayPreviewId?: HolidayId;
}

export interface InviteSummaryDto {
  id: string;
  invited_email: string;
  created_at: string;
}

export interface CollaboratorDto {
  id: string;
  email: string;
  name: string;
  picture: string;
  created_at: string;
}

export interface InviteListResponse {
  invites: InviteSummaryDto[];
  collaborators: CollaboratorDto[];
}

export interface InviteCreateRequest {
  displayId: string;
  email: string;
}

export interface InviteCreateResponse {
  id?: string;
  invited_email?: string;
  created_at?: string;
}

export interface TodoItemDto {
  id: string;
  text: string;
  checked: boolean;
}

export interface TodosPatchRequest {
  items: TodoItemDto[];
}

export interface NotesPatchRequest {
  notes: StickyNote[];
}
