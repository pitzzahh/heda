import { phase_main_load_schema } from "@/schema/load";
import { superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";

export const entries = () => {
  // TODO: Fetch entries from db
  return [
    { id: 'hello-world' },
    { id: 'another-blog-post' }
  ];
};


export const load = (async () => {
  return {
    phase_main_load_form: await superValidate(zod(phase_main_load_schema))
  };
});
