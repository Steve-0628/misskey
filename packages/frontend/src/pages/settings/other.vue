<template>
<div class="_gaps_m">
	<!--
	<MkSwitch v-model="$i.injectFeaturedNote" @update:model-value="onChangeInjectFeaturedNote">
		<template #label>{{ i18n.ts.showFeaturedNotesInTimeline }}</template>
	</MkSwitch>
	-->

	<!--
	<MkSwitch v-model="reportError">{{ i18n.ts.sendErrorReports }}<template #caption>{{ i18n.ts.sendErrorReportsDescription }}</template></MkSwitch>
	-->

	<FormSection first>
		<div class="_gaps_s">
			<MkFolder>
				<template #icon><i class="ti ti-info-circle"></i></template>
				<template #label>{{ i18n.ts.accountInfo }}</template>

				<div class="_gaps_m">
					<MkKeyValue>
						<template #key>ID</template>
						<template #value><span class="_monospace">{{ $i.id }}</span></template>
					</MkKeyValue>

					<MkKeyValue>
						<template #key>{{ i18n.ts.registeredDate }}</template>
						<template #value><MkTime :time="$i.createdAt" mode="detail"/></template>
					</MkKeyValue>

					<FormLink to="/settings/account-stats"><template #icon><i class="ti ti-info-circle"></i></template>{{ i18n.ts.statistics }}</FormLink>
				</div>
			</MkFolder>

			<MkFolder>
				<template #icon><i class="ti ti-alert-triangle"></i></template>
				<template #label>{{ i18n.ts.closeAccount }}</template>

				<div class="_gaps_m">
					<FormInfo warn>{{ i18n.ts._accountDelete.mayTakeTime }}</FormInfo>
					<FormInfo>{{ i18n.ts._accountDelete.sendEmail }}</FormInfo>
					<MkButton v-if="!$i.isDeleted" danger @click="deleteAccount">{{ i18n.ts._accountDelete.requestAccountDelete }}</MkButton>
					<MkButton v-else disabled>{{ i18n.ts._accountDelete.inProgress }}</MkButton>
				</div>
			</MkFolder>

			<MkFolder>
				<template #icon><i class="ti ti-code"></i></template>
				<template #label>{{ i18n.ts.developer }}</template>

				<div class="_gaps_m">
					<MkSwitch v-model="devMode">
						<template #label>{{ i18n.ts.devMode }}</template>
					</MkSwitch>
				</div>
			</MkFolder>
		</div>
	</FormSection>

	<FormSection>
		<FormLink to="/registry"><template #icon><i class="ti ti-adjustments"></i></template>{{ i18n.ts.registry }}</FormLink>
	</FormSection>
</div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import MkSwitch from '@/components/MkSwitch.vue';
import FormLink from '@/components/form/link.vue';
import MkFolder from '@/components/MkFolder.vue';
import FormInfo from '@/components/MkInfo.vue';
import MkKeyValue from '@/components/MkKeyValue.vue';
import MkButton from '@/components/MkButton.vue';
import * as os from '@/os';
import { defaultStore } from '@/store';
import { signout, $i } from '@/account';
import { i18n } from '@/i18n';
import { definePageMetadata } from '@/scripts/page-metadata';
import { unisonReload } from '@/scripts/unison-reload';
import FormSection from '@/components/form/section.vue';

const devMode = computed(defaultStore.makeGetterSetter('devMode'));

async function deleteAccount(): Promise<void> {
	{
		const { canceled } = await os.confirm({
			type: 'warning',
			text: i18n.ts.deleteAccountConfirm,
		});
		if (canceled) return;
	}

	const { canceled, result: password } = await os.inputText({
		title: i18n.ts.password,
		type: 'password',
	});
	if (canceled) return;

	await os.apiWithDialog('i/delete-account', {
		password: password,
	});

	await os.alert({
		title: i18n.ts._accountDelete.started,
	});

	await signout();
}

async function reloadAsk(): Promise<void> {
	const { canceled } = await os.confirm({
		type: 'info',
		text: i18n.ts.reloadToApplySetting,
	});
	if (canceled) return;

	unisonReload();
}

definePageMetadata({
	title: i18n.ts.other,
	icon: 'ti ti-dots',
});
</script>
