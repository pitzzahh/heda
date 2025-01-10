import { getEnv } from '@/helpers/security/index.js';

export const prerender = true;
export const ssr = false;

export const load = async () => {
  return {
    app_pass_phrase: await getEnv('APP_PASS_PHRASE'),
    file_encryption_salt: await getEnv('FILE_ENCRYPTION_SALT')
  }
}