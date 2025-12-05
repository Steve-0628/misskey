<template>
<XEntrance/>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import XEntrance from './welcome.entrance.a.vue';
import { instanceName } from '@/config';
import { definePageMetadata, PageMetadata } from '@/scripts/page-metadata';

definePageMetadata(computed(() => ({
	title: instanceName,
	icon: null,
} as PageMetadata)));
</script>
