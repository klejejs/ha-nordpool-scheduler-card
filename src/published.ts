import type {
  HomeAssistant,
  PublishedSnapshot,
  ScheduleSnapshot,
  SlotSnapshot,
  SlotState,
} from './types';

const SLOT_MS = 15 * 60 * 1000;

const STATE_FLAGS: Record<string, SlotState | null> = { '1': 'on', '0': 'off', '-': null };

/** The snapshot a scheduler's Schedule sensor publishes, if the entity has one. */
export function publishedSnapshot(
  hass: HomeAssistant,
  entityId: string
): PublishedSnapshot | undefined {
  const schedule = hass.states[entityId]?.attributes.schedule;
  return schedule && typeof schedule === 'object' ? (schedule as PublishedSnapshot) : undefined;
}

/** Whether Remote Home-Assistant mirrors this entity from another instance. */
export function isMirrored(hass: HomeAssistant, entityId: string): boolean {
  return hass.entities?.[entityId]?.platform === 'remote_homeassistant';
}

/**
 * The entity prefix Remote Home-Assistant puts in front of a mirrored entity's
 * object ID, found by comparing it with the ID it has on the other instance.
 */
export function mirrorPrefix(localId: string, remoteId: string): string {
  const local = localId.slice(localId.indexOf('.') + 1);
  const remote = remoteId.slice(remoteId.indexOf('.') + 1);
  return local.endsWith(remote) ? local.slice(0, local.length - remote.length) : '';
}

function mirroredId(remoteId: string, prefix: string): string {
  const dot = remoteId.indexOf('.');
  return `${remoteId.slice(0, dot)}.${prefix}${remoteId.slice(dot + 1)}`;
}

/** The set_slots service to call for a published snapshot read through `entityId`. */
export function setSlotsService(entityId: string, published: PublishedSnapshot): string {
  return `nordpool_scheduler.${mirrorPrefix(entityId, published.entity_id)}set_slots`;
}

/** Which of the snapshot's auto mode entities are mirrored here, as a string that changes when they do. */
export function mirroredEntities(
  hass: HomeAssistant,
  entityId: string,
  published: PublishedSnapshot
): string {
  const prefix = mirrorPrefix(entityId, published.entity_id);
  const { auto } = published;
  return [
    auto.switch_entity,
    auto.run_hours_entity,
    auto.max_price_entity,
    auto.cheap_price_entity,
    auto.window_enabled_entity,
    auto.window_start_entity,
    auto.window_end_entity,
    auto.cheap_all_day_entity,
    auto.runs_limited_entity,
    auto.max_runs_entity,
  ]
    .map((id) => (id && hass.states[mirroredId(id, prefix)] ? '1' : '0'))
    .join('');
}

/** Python's isoformat() for a UTC instant, which is how the integration writes slot starts. */
function utcIsoformat(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/**
 * Unpack a published snapshot into the shape nordpool_scheduler/subscribe
 * sends, with entity IDs mapped to their mirrors on this instance. An auto
 * mode entity that isn't mirrored here comes back null, so its control is
 * disabled.
 */
export function unpackSnapshot(
  hass: HomeAssistant,
  entityId: string,
  published: PublishedSnapshot
): ScheduleSnapshot {
  const prefix = mirrorPrefix(entityId, published.entity_id);
  const local = (remoteId: string | null): string | null => {
    if (!remoteId) {
      return null;
    }
    const id = mirroredId(remoteId, prefix);
    return hass.states[id] ? id : null;
  };

  const first = Date.parse(published.slots_start);
  const slots: SlotSnapshot[] = published.slot_prices.map((price, i) => {
    const override = STATE_FLAGS[published.slot_overrides[i]] ?? null;
    const base = STATE_FLAGS[published.slot_base[i]] ?? 'off';
    const auto = STATE_FLAGS[published.slot_auto[i]];
    return {
      start: utcIsoformat(first + i * SLOT_MS),
      end: utcIsoformat(first + (i + 1) * SLOT_MS),
      price,
      override,
      base,
      auto: auto === null || auto === undefined ? null : auto === 'on',
      effective: override ?? base,
    };
  });

  const { auto } = published;
  return {
    config_entry_id: published.config_entry_id,
    target_entity: published.target_entity && mirroredId(published.target_entity, prefix),
    default_state: published.default_state,
    control_mode: published.control_mode,
    time_zone: published.time_zone,
    currency: published.currency,
    vat_percent: published.vat_percent,
    now_slot_start: published.now_slot_start,
    target_state: published.target_state,
    auto: {
      ...auto,
      switch_entity: local(auto.switch_entity),
      run_hours_entity: local(auto.run_hours_entity),
      max_price_entity: local(auto.max_price_entity),
      cheap_price_entity: local(auto.cheap_price_entity),
      ...(auto.window_enabled_entity === undefined
        ? {}
        : {
            window_enabled_entity: local(auto.window_enabled_entity),
            window_start_entity: local(auto.window_start_entity ?? null),
            window_end_entity: local(auto.window_end_entity ?? null),
            cheap_all_day_entity: local(auto.cheap_all_day_entity ?? null),
          }),
      ...(auto.runs_limited_entity === undefined
        ? {}
        : {
            runs_limited_entity: local(auto.runs_limited_entity),
            max_runs_entity: local(auto.max_runs_entity ?? null),
          }),
    },
    averages: published.averages,
    slots,
  };
}
