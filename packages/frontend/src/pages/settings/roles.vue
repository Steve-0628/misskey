<template>
<div class="_gaps_m">
	<FormSection first>
		<template #label>{{ i18n.ts.rolesAssignedToMe }}</template>
		<div class="_gaps_s">
			<MkRolePreview v-for="role in $i.roles" :key="role.id" :role="role" :forModeration="false"/>
		</div>
	</FormSection>
	<FormSection>
		<template #label>{{ i18n.ts._role.policies }}</template>
		<div class="_gaps_s">
			<div v-for="policy in Object.keys($i.policies)" :key="policy">
				{{ policy }} ... {{ $i.policies[policy] }}
			</div>
		</div>
	</FormSection>
</div>
</template>

<script lang="ts" setup>
import FormSection from '@/components/form/section.vue';
import * as os from '@/os';
import { i18n } from '@/i18n';
import { $i } from '@/account';
import { definePageMetadata } from '@/scripts/page-metadata';
import MkRolePreview from '@/components/MkRolePreview.vue';

function save() {
	os.apiWithDialog('i/update', {

	});
}

const headerActions = $computed(() => []);

const headerTabs = $computed(() => []);

definePageMetadata({
	title: i18n.ts.roles,
	icon: 'ti ti-badges',
});
</script>

<style lang="scss" module>

</style>
