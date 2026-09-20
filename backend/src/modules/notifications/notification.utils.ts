import {
  DEFAULT_NOTIFICATION_TEMPLATES,
  isEventEnabledByDefault,
  NotificationEventKey,
} from "./notification.constants";

/** Replaces `{key}` tokens in a template with values from `vars`; a token
 * with no matching var is left untouched rather than silently blanked out,
 * so a typo in a template is obvious instead of producing a broken message. */
export const renderTemplate = (template: string, vars: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));

/** The slice of NotificationRepository needed to decide whether an event fires. */
export interface EventConfigSource {
  findMasterEnabled(madrasaId: number): Promise<boolean>;
  findSetting(
    madrasaId: number,
    eventKey: string,
  ): Promise<{ isEnabled: number; template: string } | null>;
}

/**
 * Single source of truth for "should this auto-notification event fire, and
 * with which template": master switch on AND the event's own NotificationSetting
 * enabled (no row = the event's default, see DEFAULT_DISABLED_EVENTS), template
 * from the setting or the default.
 */
export const resolveEventConfig = async (
  source: EventConfigSource,
  madrasaId: number,
  eventKey: NotificationEventKey,
): Promise<{ enabled: boolean; template: string }> => {
  const fallbackTemplate = DEFAULT_NOTIFICATION_TEMPLATES[eventKey];
  if (!(await source.findMasterEnabled(madrasaId))) return { enabled: false, template: fallbackTemplate };

  const setting = await source.findSetting(madrasaId, eventKey);
  return {
    enabled: setting ? !!setting.isEnabled : isEventEnabledByDefault(eventKey),
    template: setting?.template || fallbackTemplate,
  };
};
