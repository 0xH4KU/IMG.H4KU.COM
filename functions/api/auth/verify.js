import { authenticateRequest } from '../../_utils/auth';

export async function onRequestGet(context) {
  if (await authenticateRequest(context.request, context.env)) {
    return new Response('OK', { status: 200 });
  }
  return new Response('Unauthorized', { status: 401 });
}
