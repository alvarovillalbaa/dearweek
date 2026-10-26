import { deleteRequested } from '../_shared/deletion.ts';

Deno.serve((request: Request) => deleteRequested(request, false));
