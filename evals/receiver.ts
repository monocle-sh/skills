import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { isAbsolute, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import protobuf from 'protobufjs'
import type { Check } from './verify.ts'

export interface KeyValue {
  key: string
  value?: { stringValue?: string; intValue?: string | number }
}

export interface Span {
  kind?: number | string
  traceId?: string
  attributes?: KeyValue[]
  events?: { name?: string; attributes?: KeyValue[] }[]
}

export interface LogRecord {
  traceId?: string
  body?: { stringValue?: string }
  attributes?: KeyValue[]
}

interface ExportRequest {
  resourceSpans?: { resource?: { attributes?: KeyValue[] }; scopeSpans?: { spans?: Span[] }[] }[]
  resourceLogs?: { scopeLogs?: { logRecords?: LogRecord[] }[] }[]
}

export interface Packet {
  path: string
  data: ExportRequest
}

export interface Receiver {
  packets: Packet[]
  port: number
  reset: () => void
  close: () => Promise<void>
}

export interface Account {
  orderId: string
  userId: string | number
}

const maxBodyBytes = 8 * 1024 * 1024

const signals = [
  {
    path: '/v1/traces',
    file: 'opentelemetry/proto/collector/trace/v1/trace_service.proto',
    type: 'opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest',
  },
  {
    path: '/v1/logs',
    file: 'opentelemetry/proto/collector/logs/v1/logs_service.proto',
    type: 'opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest',
  },
  {
    path: '/v1/metrics',
    file: 'opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
    type: 'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
  },
]

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodyBytes) throw new Error('OTLP request too large')
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks)

  if (request.headers['content-encoding'] === 'gzip') return gunzipSync(body, { maxOutputLength: maxBodyBytes })

  return body
}

/**
 * Local OTLP HTTP receiver in place of Monocle Studio. Accepts JSON and protobuf, including gzip.
 */
export async function createReceiver({ protoPath, port = 4200 }: { protoPath: string; port?: number }): Promise<Receiver> {
  const root = new protobuf.Root()
  root.resolvePath = (_origin, target) => (isAbsolute(target) ? target : join(protoPath, target))
  await root.load(signals.map(({ file }) => file))

  const types = new Map(signals.map(({ path, type }) => [path, root.lookupType(type)]))
  const packets: Packet[] = []

  const server = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', '*')

    if (request.method === 'OPTIONS') return response.writeHead(204).end()

    const type = types.get(request.url ?? '')
    if (!type || request.method !== 'POST') return response.writeHead(404).end()

    try {
      const body = await readBody(request)
      const isJson = request.headers['content-type']?.includes('json')
      const data = isJson
        ? JSON.parse(body.toString())
        : type.toObject(type.decode(body), { longs: String, bytes: String, enums: Number })

      packets.push({ path: request.url!, data })

      response
        .writeHead(200, { 'Content-Type': isJson ? 'application/json' : 'application/x-protobuf' })
        .end(isJson ? '{}' : '')
    } catch {
      response.writeHead(400).end()
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  return {
    packets,
    port: (server.address() as AddressInfo).port,
    reset: () => {
      packets.length = 0
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

function attributes(values: KeyValue[] = []) {
  return Object.fromEntries(values.map(({ key, value }) => [key, value?.stringValue ?? value?.intValue]))
}

function mentions(attrs: Record<string, unknown>, text: string) {
  return Object.values(attrs).some((value) => typeof value === 'string' && value.includes(text))
}

function isReportable(attrs: Record<string, unknown>) {
  return attrs['monocle.exception.should_report'] !== 'false'
}

function serverSpansFor(spans: Span[], path: string) {
  return spans.filter(
    (span) => (span.kind === 2 || span.kind === 'SPAN_KIND_SERVER') && mentions(attributes(span.attributes), path),
  )
}

/**
 * Reportable exception records for a request: `exception` events on its server span, and
 * exception reporter logs of its trace. Records marked should_report=false stay in the
 * trace without opening an issue, so they are not counted.
 */
function exceptionRecords({ spans, logs, path, message }: { spans: Span[]; logs: LogRecord[]; path: string; message: string }) {
  const requests = serverSpansFor(spans, path)
  const records: { user: unknown }[] = []

  for (const span of requests) {
    for (const event of span.events ?? []) {
      const attrs = attributes(event.attributes)
      if (event.name !== 'exception' || !mentions(attrs, message) || !isReportable(attrs)) continue

      records.push({ user: attributes(span.attributes)['user.id'] ?? attrs['user.id'] })
    }
  }

  for (const log of logs) {
    const attrs = attributes(log.attributes)
    if (attrs['monocle.log.source'] !== 'exception_reporter' || !isReportable(attrs)) continue
    if (!requests.some((span) => span.traceId === log.traceId) || !mentions(attrs, message)) continue

    records.push({ user: attrs['user.id'] })
  }

  return records
}

function collect(packets: Pick<Packet, 'data'>[]) {
  const spans: Span[] = []
  const logs: LogRecord[] = []
  const versions = new Set<unknown>()

  for (const { data } of packets) {
    for (const resource of data.resourceSpans ?? []) {
      versions.add(attributes(resource.resource?.attributes)['service.version'])
      for (const scope of resource.scopeSpans ?? []) spans.push(...(scope.spans ?? []))
    }

    for (const resource of data.resourceLogs ?? []) {
      for (const scope of resource.scopeLogs ?? []) logs.push(...(scope.logRecords ?? []))
    }
  }

  return { spans, logs, versions }
}

export function telemetryChecks({
  packets,
  orderId,
  account,
  version,
}: {
  packets: Pick<Packet, 'data'>[]
  orderId: string
  account?: Account
  version?: string
}): Check[] {
  const { spans, logs, versions } = collect(packets)

  const orders = serverSpansFor(spans, `/pilot/orders/${orderId}`)
  const correlated = logs.some(
    (log) =>
      log.traceId &&
      orders.some((span) => span.traceId === log.traceId) &&
      (log.body?.stringValue?.includes('pilot-order') || attributes(log.attributes).orderId === orderId),
  )

  const accountOrders = account ? serverSpansFor(spans, `/pilot/account/orders/${account.orderId}`) : []
  const accountUsers = accountOrders.map((span) => attributes(span.attributes)['user.id'])

  const anonymousFailures = exceptionRecords({ spans, logs, path: '/pilot/failure', message: 'PILOT_ORDER_FAILURE' })
  const accountFailures = exceptionRecords({
    spans,
    logs,
    path: '/pilot/account/failure',
    message: 'PILOT_ACCOUNT_FAILURE',
  })

  const isAccountUser = (user: unknown) => account !== undefined && String(user) === String(account.userId)

  return [
    {
      check: 'One server span for the exercised order request',
      pass: orders.length === 1,
      observed: orders.length,
    },
    {
      check: 'The order log is correlated with that request',
      pass: correlated,
    },
    {
      check: 'Server spans carry the release version',
      pass: versions.size === 1 && versions.has(version),
      observed: [...versions],
    },
    {
      check: 'The authenticated request span carries the user ID',
      pass: accountUsers.length === 1 && isAccountUser(accountUsers[0]),
      observed: accountUsers,
    },
    {
      check: 'The anonymous failure is reported once',
      pass: anonymousFailures.length === 1,
      observed: anonymousFailures.length,
    },
    {
      check: 'The authenticated failure is reported once with the user ID',
      pass: accountFailures.length === 1 && isAccountUser(accountFailures[0].user),
      observed: accountFailures,
    },
  ]
}
