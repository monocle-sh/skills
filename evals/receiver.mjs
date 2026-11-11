import { createServer } from 'node:http'
import { isAbsolute, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import protobuf from 'protobufjs'

export async function createReceiver({ protoPath, port = 4200 }) {
  const root = new protobuf.Root()
  root.resolvePath = (_origin, target) => isAbsolute(target) ? target : join(protoPath, target)
  await root.load([
    'opentelemetry/proto/collector/trace/v1/trace_service.proto',
    'opentelemetry/proto/collector/logs/v1/logs_service.proto',
    'opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
  ])
  const types = Object.fromEntries(['trace', 'logs', 'metrics'].map((signal) => [
    `/v1/${signal === 'trace' ? 'traces' : signal}`,
    root.lookupType(`opentelemetry.proto.collector.${signal}.v1.Export${signal === 'trace' ? 'Trace' : signal === 'logs' ? 'Logs' : 'Metrics'}ServiceRequest`),
  ]))
  const packets = []
  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', '*')
    if (request.method === 'OPTIONS') return response.writeHead(204).end()
    const type = types[request.url]
    if (!type || request.method !== 'POST') return response.writeHead(404).end()
    try {
      const chunks = []
      let size = 0
      for await (const chunk of request) {
        size += chunk.length
        if (size > 8 * 1024 * 1024) throw new Error('OTLP request too large')
        chunks.push(chunk)
      }
      let body = Buffer.concat(chunks)
      if (request.headers['content-encoding'] === 'gzip') body = gunzipSync(body, { maxOutputLength: 8 * 1024 * 1024 })
      const json = request.headers['content-type']?.includes('json')
      const data = json ? JSON.parse(body.toString()) : type.toObject(type.decode(body), { longs: String, bytes: String, enums: Number })
      packets.push({ path: request.url, data })
      response.writeHead(200, { 'Content-Type': json ? 'application/json' : 'application/x-protobuf' }).end(json ? '{}' : '')
    } catch {
      response.writeHead(400).end()
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return {
    packets,
    port: server.address().port,
    reset: () => { packets.length = 0 },
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

function attributes(values = []) {
  return Object.fromEntries(values.map(({ key, value }) => [key, value?.stringValue ?? value?.intValue]))
}

const isServer = (span) => span.kind === 2 || span.kind === 'SPAN_KIND_SERVER'
const mentions = (attrs, text) => Object.values(attrs).some((value) => typeof value === 'string' && value.includes(text))

/**
 * Reportable exception records for a request: `exception` events on its server span, and
 * exception reporter logs of its trace. Records marked should_report=false stay in the
 * trace without opening an issue, so they are not counted.
 */
function exceptionRecords({ spans, logs, path, message }) {
  const requests = spans.filter((span) => isServer(span) && mentions(attributes(span.attributes), path))
  const records = []
  for (const span of requests) {
    for (const event of span.events ?? []) {
      const attrs = attributes(event.attributes)
      if (event.name !== 'exception' || !mentions(attrs, message) || attrs['monocle.exception.should_report'] === 'false') continue
      records.push({ user: attributes(span.attributes)['user.id'] ?? attrs['user.id'] })
    }
  }
  for (const log of logs) {
    const attrs = attributes(log.attributes)
    if (attrs['monocle.log.source'] !== 'exception_reporter' || attrs['monocle.exception.should_report'] === 'false') continue
    if (!requests.some((span) => span.traceId === log.traceId) || !mentions(attrs, message)) continue
    records.push({ user: attrs['user.id'] })
  }
  return { requests, records }
}

export function telemetryChecks({ packets, orderId, account, version }) {
  const spans = []
  const logs = []
  const versions = new Set()
  for (const packet of packets) {
    for (const resource of packet.data.resourceSpans ?? []) {
      versions.add(attributes(resource.resource?.attributes)['service.version'])
      for (const scope of resource.scopeSpans ?? []) spans.push(...(scope.spans ?? []))
    }
    for (const resource of packet.data.resourceLogs ?? []) {
      for (const scope of resource.scopeLogs ?? []) logs.push(...(scope.logRecords ?? []))
    }
  }
  const orders = spans.filter((span) => isServer(span) && mentions(attributes(span.attributes), `/pilot/orders/${orderId}`))
  const correlated = logs.some((log) => {
    const attrs = attributes(log.attributes)
    return log.traceId && orders.some((span) => span.traceId === log.traceId) &&
      (log.body?.stringValue?.includes('pilot-order') || attrs.orderId === orderId)
  })
  const accountOrders = account
    ? spans.filter((span) => isServer(span) && mentions(attributes(span.attributes), `/pilot/account/orders/${account.orderId}`))
    : []
  const accountUser = accountOrders.map((span) => attributes(span.attributes)['user.id'])
  const anonymous = exceptionRecords({ spans, logs, path: '/pilot/failure', message: 'PILOT_ORDER_FAILURE' })
  const authenticated = exceptionRecords({ spans, logs, path: '/pilot/account/failure', message: 'PILOT_ACCOUNT_FAILURE' })
  return [
    { check: 'One server span for the exercised order request', pass: orders.length === 1, observed: orders.length },
    { check: 'The order log is correlated with that request', pass: correlated },
    { check: 'Server spans carry the release version', pass: versions.size === 1 && versions.has(version), observed: [...versions] },
    {
      check: 'The authenticated request span carries the user ID',
      pass: Boolean(account) && accountUser.length === 1 && String(accountUser[0]) === String(account.userId),
      observed: accountUser,
    },
    { check: 'The anonymous failure is reported once', pass: anonymous.records.length === 1, observed: anonymous.records.length },
    {
      check: 'The authenticated failure is reported once with the user ID',
      pass: Boolean(account) && authenticated.records.length === 1 && String(authenticated.records[0].user) === String(account.userId),
      observed: authenticated.records,
    },
  ]
}
