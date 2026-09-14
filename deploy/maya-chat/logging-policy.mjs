// Build-side verification only: no API calls, writes, logging or coercion.
// Cloudflare's pinned remote-config normalization treats null observability as
// disabled logs/traces. Unlike that general normalizer, malformed/missing API
// fields here still fail closed. See README for the pinned source and evidence.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);
const keysAllowed = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
const emptyOrNull = value => value === null || Array.isArray(value) && value.length === 0;
const optionalBoolean = (value, key) => !own(value, key) || typeof value[key] === 'boolean';
const optionalRate = value => !own(value, 'head_sampling_rate') || typeof value.head_sampling_rate === 'number'
  && Number.isFinite(value.head_sampling_rate) && value.head_sampling_rate >= 0 && value.head_sampling_rate <= 1;
function channelOff(channel, trace) {
  const keys = trace ? ['enabled','persist','head_sampling_rate','destinations','propagation_policy']
    : ['enabled','persist','head_sampling_rate','destinations','invocation_logs'];
  return object(channel) && keysAllowed(channel, keys)
    && (!own(channel, 'enabled') || channel.enabled === false)
    && optionalBoolean(channel, 'persist') && optionalRate(channel)
    && (!own(channel, 'destinations') || emptyOrNull(channel.destinations))
    && (trace ? !own(channel, 'propagation_policy') || [null,'authenticated','accept'].includes(channel.propagation_policy)
      : optionalBoolean(channel, 'invocation_logs'));
}
export function loggingOffRepresentation(settings) {
  if (!object(settings) || !keysAllowed(settings, ['observability','logpush','tail_consumers','streaming_tail_consumers','tags'])
    || !own(settings, 'observability') || !own(settings, 'logpush') || settings.logpush !== false
    || !own(settings, 'tail_consumers') || !emptyOrNull(settings.tail_consumers)
    || own(settings, 'streaming_tail_consumers') && !emptyOrNull(settings.streaming_tail_consumers)) return 'blocked';
  const obs = settings.observability;
  if (obs === null) return 'null-disabled';
  if (!object(obs) || !keysAllowed(obs, ['enabled','head_sampling_rate','logs','traces','redact_query_string'])
    || !own(obs, 'enabled') || obs.enabled !== false || !optionalRate(obs) || !optionalBoolean(obs, 'redact_query_string')
    || own(obs, 'logs') && !channelOff(obs.logs, false) || own(obs, 'traces') && !channelOff(obs.traces, true)) return 'blocked';
  // A channel's explicit true override is refused even when global enabled is
  // false. Persist/invocation defaults alone do not enable a disabled channel.
  return 'explicit-disabled';
}
