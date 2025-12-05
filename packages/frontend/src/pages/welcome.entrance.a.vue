<template>
<div v-if="meta" class="rsqzvsbo">
	<div class="shape1"></div>
	<div class="shape2"></div>
	<img src="/client-assets/misskey.svg" class="misskey"/>
	<div class="contents">
		<MkVisitorDashboard/>
	</div>
</div>
</template>

<script lang="ts" setup>
import { } from 'vue';
import { Instance } from 'misskey-js/built/entities';
import * as os from '@/os';
import MkVisitorDashboard from '@/components/MkVisitorDashboard.vue';

let meta = $ref<Instance>();

os.api('meta', { detail: true }).then(_meta => {
	meta = _meta;
});
</script>

<style lang="scss" scoped>
.rsqzvsbo {
	> .bg {
		position: fixed;
		top: 0;
		right: 0;
		width: 80vw; // 100%からshapeの幅を引いている
		height: 100vh;
	}

	> .tl {
		position: fixed;
		top: 0;
		bottom: 0;
		right: 64px;
		margin: auto;
		padding: 128px 0;
		width: 500px;
		height: calc(100% - 256px);
		overflow: hidden;
		-webkit-mask-image: linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 128px, rgba(0,0,0,1) calc(100% - 128px), rgba(0,0,0,0) 100%);
		mask-image: linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 128px, rgba(0,0,0,1) calc(100% - 128px), rgba(0,0,0,0) 100%);

		@media (max-width: 1200px) {
			display: none;
		}
	}

	> .shape1 {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: var(--accent);
		clip-path: polygon(0% 0%, 45% 0%, 20% 100%, 0% 100%);
	}
	> .shape2 {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background: var(--accent);
		clip-path: polygon(0% 0%, 25% 0%, 35% 100%, 0% 100%);
		opacity: 0.5;
	}

	> .misskey {
		position: fixed;
		top: 42px;
		left: 42px;
		width: 140px;

		@media (max-width: 450px) {
			width: 130px;
		}
	}

	> .contents {
		position: relative;
		width: min(430px, calc(100% - 32px));
		margin-left: 128px;
		padding: 100px 0 100px 0;
		margin: auto;
	}
}
</style>
