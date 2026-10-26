import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const bucket = 'memory-photos';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const photoPath = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

class DeletionError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryable = false) {
    super(message);
  }
}

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const boundedFetch: typeof fetch = (input, init = {}) => fetch(input, {
  ...init,
  signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
});

function configuration(): { url: string; publishableKey: string } {
  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!url || !publishableKey?.startsWith('sb_publishable_')) {
    throw new DeletionError(503, 'configuration_required', 'Account services are not configured.');
  }
  return { url, publishableKey };
}

async function authenticate(request: Request): Promise<{ client: SupabaseClient; userId: string; url: string }> {
  const authorization = request.headers.get('Authorization');
  const token = /^Bearer ([^\s]+)$/i.exec(authorization ?? '')?.[1];
  if (!token) throw new DeletionError(401, 'sign_in_required', 'Sign in to continue.');
  const { url, publishableKey } = configuration();
  const client = createClient(url, publishableKey, {
    global: { headers: { Authorization: 'Bearer ' + token }, fetch: boundedFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  // getUser verifies this JWT with Auth; decoding a token or trusting body user_id is insufficient.
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at || data.user.is_anonymous) {
    throw new DeletionError(401, 'sign_in_required', 'Sign in with a verified email to continue.');
  }
  return { client, userId: data.user.id, url };
}

function administrator(url: string): SupabaseClient {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new DeletionError(503, 'configuration_required', 'Account services are not configured.');
  return createClient(url, serviceKey, {
    global: { fetch: boundedFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function confirmedBody(request: Request, family: boolean): Promise<string | null> {
  if (Number(request.headers.get('Content-Length')) > 1024) {
    throw new DeletionError(400, 'invalid_request', 'Invalid deletion request.');
  }
  const raw = await request.text();
  if (raw.length > 1024) throw new DeletionError(400, 'invalid_request', 'Invalid deletion request.');
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { throw new DeletionError(400, 'invalid_request', 'Confirm deletion to continue.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || body.confirm !== true
    || Object.keys(body).some(key => !['confirm', ...(family ? ['family_id'] : [])].includes(key))
    || (family && (typeof body.family_id !== 'string' || !uuid.test(body.family_id)))) {
    throw new DeletionError(400, 'invalid_request', 'Confirm deletion and provide a valid family when required.');
  }
  return family ? body.family_id as string : null;
}

async function checkedRpc(client: SupabaseClient, name: string, parameters: Record<string, unknown> = {}): Promise<unknown> {
  const { data, error } = await client.rpc(name, parameters);
  if (error) {
    if (name === 'begin_account_deletion' && error.code === '42501') {
      throw new DeletionError(409, 'ownership_or_access_required', 'Verify your account and transfer ownership or delete each owned family before deleting your account.');
    }
    if (name === 'begin_family_deletion' && error.code === '42501') {
      throw new DeletionError(403, 'owner_required', 'Only the current family owner can delete this family.');
    }
    throw new DeletionError(409, 'deletion_pending', 'Deletion could not finish. Sign in again if needed, then retry deletion.', true);
  }
  return data;
}

async function removePhotos(client: SupabaseClient, admin: SupabaseClient, familyId: string | null): Promise<void> {
  const started = Date.now();
  // Each batch selects the first remaining existing objects, so successful removals advance the cursor.
  // A persistent failure or a large account returns a retryable response rather than looping forever.
  for (let batch = 0; batch < 20 && Date.now() - started < 40_000; batch++) {
    const data = await checkedRpc(client, 'deletion_photo_paths', { p_family_id: familyId, p_limit: 100 });
    if (!Array.isArray(data) || data.length > 100) {
      throw new DeletionError(503, 'deletion_pending', 'Photo cleanup could not finish. Retry deletion.', true);
    }
    const paths = data.map(row => row?.storage_path);
    if (!paths.every(path => typeof path === 'string' && photoPath.test(path))) {
      throw new DeletionError(503, 'deletion_pending', 'Photo cleanup could not finish. Retry deletion.', true);
    }
    if (!paths.length) return;
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) throw new DeletionError(503, 'deletion_pending', 'Photo cleanup could not finish. Retry deletion.', true);
  }
  const remaining = await checkedRpc(client, 'deletion_photo_paths', { p_family_id: familyId, p_limit: 1 });
  if (!Array.isArray(remaining) || remaining.length) {
    throw new DeletionError(409, 'deletion_pending', 'Cleanup is still in progress. Retry deletion to finish.', true);
  }
}

export async function deleteRequested(request: Request, family: boolean): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return response(405, { error: 'Use POST to request deletion.', code: 'method_not_allowed' });
  try {
    const familyId = await confirmedBody(request, family);
    const { client, userId, url } = await authenticate(request);
    const admin = administrator(url);
    await checkedRpc(client, family ? 'begin_family_deletion' : 'begin_account_deletion', family ? { p_family_id: familyId } : {});
    await removePhotos(client, admin, familyId);
    await checkedRpc(client, family ? 'finish_family_deletion' : 'finish_account_deletion', family ? { p_family_id: familyId } : {});
    if (!family) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new DeletionError(503, 'deletion_pending', 'Your data cleanup finished, but account deletion needs a retry.', true);
    }
    return response(200, { ok: true, deleted: true, scope: family ? 'family' : 'account' });
  } catch (error) {
    if (error instanceof DeletionError) return response(error.status, { error: error.message, code: error.code, retryable: error.retryable });
    // Never echo provider errors, tokens, object paths or server configuration into logs/responses.
    return response(503, { error: 'Deletion could not finish. Retry deletion.', code: 'deletion_pending', retryable: true });
  }
}
