import { createApp, defineAsyncComponent } from 'vue';
import { common } from './common';

export async function subBoot() {
	await common(() => createApp(
		defineAsyncComponent(() => import('@/ui/minimum.vue')),
	));
}
