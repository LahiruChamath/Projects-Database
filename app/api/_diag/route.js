export async function POST() { return new Response('ok', { status: 201 }); }
export async function GET() { return new Response('ok', { status: 200 }); }
export function OPTIONS() { return new Response(null, { status: 204, headers: { Allow: 'GET,POST,OPTIONS' } }); }
