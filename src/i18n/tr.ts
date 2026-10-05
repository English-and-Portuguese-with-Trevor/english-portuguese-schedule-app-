/**
 * Marks English text outside components (error messages, data) for
 * translation; it's translated where it's shown. i18n.test.ts checks that
 * every literal passed to tr or t has a translation. Its own file, so the
 * error pages can use it without downloading the translations.
 */
export const tr = (text: string) => text;
