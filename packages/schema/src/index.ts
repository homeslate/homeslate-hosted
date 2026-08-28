export const SCHEMA_PACKAGE_NAME = '@homeslate/schema';
export type {
  AlarmDefinition,
  AlarmToneId,
  ColorMode,
  DisplayDocument,
  HolidayId,
  StickyNote,
  View,
  ViewBackground,
  WidgetInstance,
  WidgetLayout,
} from './types';
export { migrateDisplayDocument } from './migrate';
export {
  validateDisplayDocument,
  registerWidgetConfigSchema,
  clearWidgetConfigSchemas,
} from './validate';
export type { DisplayValidationError, DisplayValidationResult } from './validate';
export {
  validateThemeDocument,
  isThemeDocumentCandidate,
} from './themeDocumentValidation';
export type {
  ThemeDocument,
  ThemeValidationIssue,
  ThemeValidationResult,
} from './themeDocumentValidation';

