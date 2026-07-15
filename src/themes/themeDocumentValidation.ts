import { z } from 'zod';

type UnknownRecord = Record<string, unknown>;
const TOKEN_TYPES = new Set([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'shadow',
  'number',
  'string',
]);

const isoDateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid date-time string',
});

const colorTokenSchema = z
  .object({
    $type: z.literal('color'),
    $value: z.string(),
    $description: z.string().optional(),
  })
  .strict();

const dimensionTokenSchema = z
  .object({
    $type: z.literal('dimension'),
    $value: z.string(),
    $description: z.string().optional(),
  })
  .strict();

const fontFamilyTokenSchema = z
  .object({
    $type: z.literal('fontFamily'),
    $value: z.string(),
    $description: z.string().optional(),
  })
  .strict();

const fontWeightTokenSchema = z
  .object({
    $type: z.literal('fontWeight'),
    $value: z.union([z.string(), z.number()]),
    $description: z.string().optional(),
  })
  .strict();

const durationTokenSchema = z
  .object({
    $type: z.literal('duration'),
    $value: z.string(),
    $description: z.string().optional(),
  })
  .strict();

const numberTokenSchema = z
  .object({
    $type: z.literal('number'),
    $value: z.number(),
    $description: z.string().optional(),
  })
  .strict();

const stringTokenSchema = z
  .object({
    $type: z.literal('string'),
    $value: z.string(),
    $description: z.string().optional(),
  })
  .strict();

const shadowTokenSchema = z
  .object({
    $type: z.literal('shadow'),
    $value: z.unknown(),
    $description: z.string().optional(),
  })
  .strict();

const tokenLeafSchema = z.union([
  colorTokenSchema,
  dimensionTokenSchema,
  fontFamilyTokenSchema,
  fontWeightTokenSchema,
  durationTokenSchema,
  shadowTokenSchema,
  numberTokenSchema,
  stringTokenSchema,
]);

const tokenGroupSchema: z.ZodType<UnknownRecord> = z.lazy(() =>
  z.record(z.string(), z.union([tokenGroupSchema, tokenLeafSchema]))
);

const stateTripletSchema = z
  .object({
    bg: colorTokenSchema,
    fg: colorTokenSchema,
    border: colorTokenSchema,
  })
  .strict();

const interactiveTripletSchema = z
  .object({
    bg: colorTokenSchema,
    fg: colorTokenSchema,
    border: colorTokenSchema,
    hoverBg: colorTokenSchema,
    activeBg: colorTokenSchema,
  })
  .strict();

const foundationTokensSchema = z
  .object({
    color: z
      .object({
        brand: tokenGroupSchema,
        neutral: tokenGroupSchema,
        success: tokenGroupSchema,
        warning: tokenGroupSchema,
        danger: tokenGroupSchema,
        info: tokenGroupSchema.optional(),
      })
      .catchall(tokenGroupSchema),
    spacing: z
      .object({
        '0': dimensionTokenSchema,
        '1': dimensionTokenSchema,
        '2': dimensionTokenSchema,
        '3': dimensionTokenSchema,
        '4': dimensionTokenSchema,
        '5': dimensionTokenSchema.optional(),
        '6': dimensionTokenSchema,
        '8': dimensionTokenSchema,
        '10': dimensionTokenSchema.optional(),
        '12': dimensionTokenSchema.optional(),
        '16': dimensionTokenSchema.optional(),
      })
      .strict(),
    radius: z
      .object({
        none: dimensionTokenSchema.optional(),
        sm: dimensionTokenSchema,
        md: dimensionTokenSchema,
        lg: dimensionTokenSchema,
        xl: dimensionTokenSchema.optional(),
        full: dimensionTokenSchema,
      })
      .strict(),
    typography: z
      .object({
        family: z
          .object({
            base: fontFamilyTokenSchema,
            mono: fontFamilyTokenSchema,
            display: fontFamilyTokenSchema.optional(),
          })
          .strict(),
        size: z
          .object({
            xs: dimensionTokenSchema,
            sm: dimensionTokenSchema,
            md: dimensionTokenSchema,
            lg: dimensionTokenSchema,
            xl: dimensionTokenSchema,
            '2xl': dimensionTokenSchema.optional(),
          })
          .strict(),
        weight: z
          .object({
            regular: fontWeightTokenSchema,
            medium: fontWeightTokenSchema,
            semibold: fontWeightTokenSchema,
            bold: fontWeightTokenSchema,
          })
          .strict(),
        lineHeight: z
          .object({
            tight: numberTokenSchema,
            normal: numberTokenSchema,
            relaxed: numberTokenSchema,
          })
          .strict(),
      })
      .strict(),
    shadow: z
      .object({
        xs: shadowTokenSchema.optional(),
        sm: shadowTokenSchema.optional(),
        md: shadowTokenSchema.optional(),
        lg: shadowTokenSchema.optional(),
        xl: shadowTokenSchema.optional(),
      })
      .strict()
      .optional(),
    opacity: z
      .object({
        disabled: numberTokenSchema.optional(),
        overlay: numberTokenSchema.optional(),
      })
      .strict()
      .optional(),
    zIndex: z
      .object({
        base: numberTokenSchema.optional(),
        dropdown: numberTokenSchema.optional(),
        modal: numberTokenSchema.optional(),
        toast: numberTokenSchema.optional(),
      })
      .strict()
      .optional(),
    motion: z
      .object({
        duration: z
          .object({
            fast: durationTokenSchema.optional(),
            normal: durationTokenSchema.optional(),
            slow: durationTokenSchema.optional(),
          })
          .strict()
          .optional(),
        easing: z
          .object({
            standard: stringTokenSchema.optional(),
            emphasized: stringTokenSchema.optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const semanticTokensSchema = z
  .object({
    surface: z
      .object({
        canvas: colorTokenSchema,
        sunken: colorTokenSchema,
        card: colorTokenSchema,
        overlay: colorTokenSchema,
      })
      .strict(),
    text: z
      .object({
        primary: colorTokenSchema,
        muted: colorTokenSchema,
        inverse: colorTokenSchema,
        link: colorTokenSchema,
      })
      .strict(),
    border: z
      .object({
        subtle: colorTokenSchema,
        default: colorTokenSchema,
        strong: colorTokenSchema,
      })
      .strict(),
    focus: z
      .object({
        ring: colorTokenSchema,
        offset: colorTokenSchema.optional(),
      })
      .strict(),
    status: z
      .object({
        success: stateTripletSchema,
        warning: stateTripletSchema,
        danger: stateTripletSchema,
        info: stateTripletSchema.optional(),
      })
      .strict(),
    interactive: z
      .object({
        primary: interactiveTripletSchema,
        secondary: interactiveTripletSchema,
        ghost: interactiveTripletSchema,
      })
      .strict(),
  })
  .strict();

const componentTokensSchema = z
  .object({
    widget: z
      .object({
        background: colorTokenSchema.optional(),
        borderColor: colorTokenSchema.optional(),
        borderWidth: dimensionTokenSchema.optional(),
        radius: dimensionTokenSchema.optional(),
        shadow: shadowTokenSchema.optional(),
        padding: dimensionTokenSchema.optional(),
      })
      .strict()
      .optional(),
    toolbar: z
      .object({
        background: colorTokenSchema.optional(),
        text: colorTokenSchema.optional(),
        icon: colorTokenSchema.optional(),
        divider: colorTokenSchema.optional(),
        height: dimensionTokenSchema.optional(),
      })
      .strict()
      .optional(),
    badge: z
      .object({
        background: colorTokenSchema.optional(),
        text: colorTokenSchema.optional(),
        radius: dimensionTokenSchema.optional(),
        paddingX: dimensionTokenSchema.optional(),
        paddingY: dimensionTokenSchema.optional(),
      })
      .strict()
      .optional(),
    control: z
      .object({
        height: dimensionTokenSchema.optional(),
        radius: dimensionTokenSchema.optional(),
        borderColor: colorTokenSchema.optional(),
        background: colorTokenSchema.optional(),
        text: colorTokenSchema.optional(),
        placeholder: colorTokenSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const modeGroupSchema = z
  .object({
    semantic: semanticTokensSchema,
    components: componentTokensSchema.optional(),
  })
  .strict();

const themeDocumentSchema = z
  .object({
    $schema: z.string().optional(),
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    version: z.number().int().min(1),
    isActive: z.boolean(),
    createdAt: isoDateTimeSchema.optional(),
    updatedAt: isoDateTimeSchema.optional(),
    tokens: z
      .object({
        foundation: foundationTokensSchema,
        modes: z
          .object({
            dark: modeGroupSchema,
            light: modeGroupSchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const ALIAS_RE = /^\{([\w.]+)\}$/;

function findAliasIssues(
  doc: unknown,
  prefix: string[] = [],
): ThemeValidationIssue[] {
  if (!doc || typeof doc !== "object") return [];
  const issues: ThemeValidationIssue[] = [];
  const record = doc as Record<string, unknown>;
  if (typeof record.$value === "string") {
    const v = record.$value;
    if ((v.includes("{") || v.includes("}")) && !ALIAS_RE.test(v)) {
      issues.push({
        path: prefix.join(".") || "$",
        message: `Malformed alias reference: ${JSON.stringify(v)}`,
      });
    }
  }
  for (const [key, value] of Object.entries(record)) {
    if (key === "$value" || key === "$type" || key === "$description") continue;
    issues.push(...findAliasIssues(value, [...prefix, key]));
  }
  return issues;
}

export type ThemeDocument = z.infer<typeof themeDocumentSchema>;

export interface ThemeValidationIssue {
  path: string;
  message: string;
}

export interface ThemeValidationResult {
  ok: boolean;
  data?: ThemeDocument;
  issues: ThemeValidationIssue[];
}

function issuePath(path: PropertyKey[]): string {
  if (path.length === 0) return '$';
  return path
    .map((segment) => {
      if (typeof segment === 'number') {
        return `[${segment}]`;
      }
      if (typeof segment === 'symbol') {
        return segment.toString();
      }
      return segment;
    })
    .join('.');
}

function isTokenType(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_TYPES.has(value);
}

function normalizeTokenTypeCascade(value: unknown, inheritedType?: string): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeTokenTypeCascade(item, inheritedType));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const input = value as UnknownRecord;
  const ownType = isTokenType(input.$type) ? input.$type : undefined;
  const nextInheritedType = ownType ?? inheritedType;
  const hasValue = Object.prototype.hasOwnProperty.call(input, '$value');
  const output: UnknownRecord = {};

  for (const [key, childValue] of Object.entries(input)) {
    if (key === '$type') continue;
    if (key === '$value') {
      output.$value = childValue;
      continue;
    }
    output[key] = normalizeTokenTypeCascade(childValue, nextInheritedType);
  }

  if (hasValue && nextInheritedType) {
    output.$type = nextInheritedType;
  }

  return output;
}

export function validateThemeDocument(input: unknown): ThemeValidationResult {
  const normalized = normalizeTokenTypeCascade(input);
  const parsed = themeDocumentSchema.safeParse(normalized);
  if (!parsed.success) {
    const issues: ThemeValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issuePath(issue.path),
      message: issue.message,
    }));
    return { ok: false, issues };
  }

  const aliasIssues = findAliasIssues(parsed.data.tokens);
  if (aliasIssues.length > 0) {
    return { ok: false, issues: aliasIssues };
  }

  return { ok: true, data: parsed.data, issues: [] };
}

export function isThemeDocumentCandidate(input: unknown): input is UnknownRecord {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const record = input as UnknownRecord;
  return 'tokens' in record || '$schema' in record;
}
