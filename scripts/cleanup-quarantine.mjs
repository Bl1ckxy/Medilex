import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await s.from('legal_chunks').select('id,citation').in('citation', ['Ramashankar Prasad and Ors. v. Dr. Amod Kumar and Ors., (2006) 3 SCC 223', 'Nilambati Hospital and Ors. v. V.S. Gopinath and Ors., (1993) 2 SCC 731']);
  console.log('DB delete targets:', JSON.stringify(data));
})();
