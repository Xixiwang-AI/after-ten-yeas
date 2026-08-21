import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dbuv7xq60hymlbd5kl.database.sankuai.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzQ2OTc5MjAwLCJleHAiOjE5MDQ3NDU2MDB9.hXaTZMjEl1tOJjqP__WsYXevAwXN2uh2fqlC-l1nQsY";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

